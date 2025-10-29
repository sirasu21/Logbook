// backend/controller/line_exercise_controller.go
package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/line/line-bot-sdk-go/linebot"

	"github.com/sirasu21/Logbook/backend/lineflow"
	"github.com/sirasu21/Logbook/backend/models"
	usecaseLine "github.com/sirasu21/Logbook/backend/usecase/LINE"
	usecase "github.com/sirasu21/Logbook/backend/usecase/web"
)

type LineWorkoutState struct {
	State     string    `json:"state"`     // 例: "in_workout"
	WorkoutID string    `json:"workoutId"` // DBのworkout.id
	StartedAt time.Time `json:"startedAt"`
}

type LineWorkoutSet struct {
	ExerciseID  string    `json:"exerciseId"`
	Weight      *float64  `json:"weight,omitempty"`
	Repetitions *int      `json:"repetitions,omitempty"`
	Sets        *int      `json:"sets,omitempty"` // 必要なら今後追加ボタンで
	WorkoutID   string    `json:"workoutId"`      // 直近のLINEワークアウト
	StartedAt   time.Time `json:"startedAt"`
}

const workoutStateTTL = 2 * time.Hour

func stateKey(lineUserID string) string {
	return "line:workout:" + lineUserID
}

func marshalState(st LineWorkoutState) ([]byte, error)     { return json.Marshal(st) }
func unmarshalState(b []byte, dst *LineWorkoutState) error { return json.Unmarshal(b, dst) }

const stateTTL = 45 * time.Minute

type LineController interface {
	Webhook(c echo.Context) error
}

type lineController struct {
	bot          *linebot.Client
	lineuc       usecaseLine.LineUsecase
	exerciseuc   usecase.ExerciseUsecase
	workoutuc    usecase.WorkoutUsecase
	useruc       usecase.UserUsecase
	workoutSetuc usecase.WorkoutSetUsecase
}

func NewLineController(bot *linebot.Client, lineuc usecaseLine.LineUsecase, exerciseuc usecase.ExerciseUsecase, workoutuc usecase.WorkoutUsecase, useruc usecase.UserUsecase, workoutSetuc usecase.WorkoutSetUsecase) LineController {
	return &lineController{bot: bot, lineuc: lineuc, exerciseuc: exerciseuc, workoutuc: workoutuc, useruc: useruc, workoutSetuc: workoutSetuc}
}

func (l *lineController) Webhook(c echo.Context) error {
	events, err := l.bot.ParseRequest(c.Request())
	if err != nil {
		return err
	}
	for _, event := range events {
		switch event.Type {
		// 初回登録時
		case linebot.EventTypeFollow:
			if err := l.CreateUser(event); err != nil {
				l.replyText(event.ReplyToken, fmt.Sprintf("登録時にエラーが発生しました: %v", err))
				l.pushStartMenu(event.Source.UserID)
				continue
			}
			l.replyText(event.ReplyToken, "登録しました！「開始」「終了」ボタン（またはメッセージ）でどうぞ💪")
			l.pushStartMenu(event.Source.UserID)
		case linebot.EventTypeMessage:
			l.handleText(event)

		case linebot.EventTypePostback:
			ctx := context.Background()
			uid := event.Source.UserID
			s, _ := lineflow.LoadState(ctx, l.lineuc, uid)
			switch event.Postback.Data {



			case "action=start":
				if err := l.createWorkout(event); err != nil {
					return err
				}
				l.replyText(event.ReplyToken, "ワークアウトを開始しました！")
				l.pushAddMenu(event.Source.UserID)

			case "action=end":
				if err := l.endWorkout(event); err != nil {
					return err
				}
				l.replyText(event.ReplyToken, "ワークアウトを終了しました！")
				l.pushStartMenu(event.Source.UserID)
			case "action=add":
				// 最新 LINE 由来ワークアウトIDを取得
				user, err := l.getOrCreateUser(ctx, uid)
				if err != nil {
					return err
				}
				wid, err := l.workoutuc.GetLatestLineWorkoutID(ctx, user.ID, true)
				if err != nil || wid == "" {
					return errors.New("まず「開始」してください")
				}
				s.WorkoutID = wid
				s.Pending = lineflow.Pending{}
				s.State = lineflow.StateAddExercise
				_ = lineflow.SaveState(ctx, l.lineuc, uid, s, stateTTL)
				l.replyText(event.ReplyToken, "種目IDを送ってください（例: 11111111-....）")
				l.pushExerciseListMenu(event.Source.UserID)
			case "action=exercise":
				s.State = lineflow.StateAddExercise
				_ = lineflow.SaveState(ctx, l.lineuc, uid, s, stateTTL)
				l.replyText(event.ReplyToken, "種目IDを送ってください")

			case "action=weight":
				s.State = lineflow.StateAddWeight
				_ = lineflow.SaveState(ctx, l.lineuc, uid, s, stateTTL)
				l.replyText(event.ReplyToken, "重量(kg)を送ってください（例: 60）")

			case "action=count":
				s.State = lineflow.StateAddCount
				_ = lineflow.SaveState(ctx, l.lineuc, uid, s, stateTTL)
				l.replyText(event.ReplyToken, "回数を送ってください（例: 8）")

			case "action=cancel":
				lineflow.ClearState(ctx, l.lineuc, uid)
				l.replyText(event.ReplyToken, "キャンセルしました。『追加』からやり直してください")
				l.pushAddMenu(event.Source.UserID)


			default:
				l.replyText(event.ReplyToken, "未対応の操作です")
				l.pushStartMenu(event.Source.UserID)
			}

		}
	}

	return nil
}

func (l *lineController) createWorkout(event *linebot.Event) error {
	if event.Source == nil || event.Source.UserID == "" {
		return errors.New("user id not found in event")
	}
	ctx := context.Background()

	user, err := l.getOrCreateUser(ctx, event.Source.UserID)
	if err != nil {
		return err
	}

	in := models.CreateWorkoutInput{
		StartedAt: time.Now(),
		Note:      nil,
	}
	// 第4引数 isFromLine=true（あなたの実装に合わせて）
	w, err := l.workoutuc.Create(ctx, user.ID, in, true)
	if err != nil {
		return err
	}

	st := LineWorkoutState{
		State:     "in_workout",
		WorkoutID: w.ID,
		StartedAt: w.StartedAt,
	}

	if err := l.lineuc.Set(ctx, stateKey(event.Source.UserID), st, workoutStateTTL); err != nil {
		log.Printf("❌ ワークアウト開始失敗 / userID=%s / err=%v", event.Source.UserID, err)
		return err
	}

	return nil
}

func (l *lineController) endWorkout(event *linebot.Event) error {
	if event.Source == nil || event.Source.UserID == "" {
		return errors.New("user id not found in event")
	}
	ctx := context.Background()

	user, err := l.getOrCreateUser(ctx, event.Source.UserID)
	if err != nil {
		return err
	}

	key := stateKey(event.Source.UserID)

	if raw, err := l.lineuc.Get(ctx, key); err == nil && raw != "" {
		var st LineWorkoutState
		if err := unmarshalState([]byte(raw), &st); err == nil && st.WorkoutID != "" {
			if _, err := l.workoutuc.End(ctx, st.WorkoutID, user.ID, time.Now()); err != nil {
				return err
			}
			_ = l.lineuc.Del(ctx, key) // 終了に成功したら状態を消す（エラーは握りつぶし）
			return nil
		}
		// 破損していた場合はフォールバックに進む
	}

	// 2) フォールバック：DBの「最新 is_from_line=true で未終了」を閉じる
	wid, err := l.workoutuc.GetLatestLineWorkoutID(ctx, user.ID, true)
	if err != nil {
		return err
	}
	if wid == "" {
		return errors.New("進行中のワークアウトが見つかりません。まずは『開始』してください")
	}

	if _, err := l.workoutuc.End(ctx, wid, user.ID, time.Now()); err != nil {
		return err
	}
	_ = l.lineuc.Del(ctx, key) // 念のため掃除（なければ何もしない）

	return nil
}

func (l *lineController) handleText(event *linebot.Event) {
	ctx := context.Background()
	uid := event.Source.UserID
	msg, _ := event.Message.(*linebot.TextMessage)
	text := strings.TrimSpace(msg.Text)

	s, _ := lineflow.LoadState(ctx, l.lineuc, uid)
	if s.State == lineflow.StateIdle {
		l.replyText(event.ReplyToken, "『追加』ボタン → 入力を進めてね")
		l.pushAddMenu(uid)
		return
	}

	switch s.State {

	case lineflow.StateAddExercise:
		// TODO: UUIDバリデーション（簡易）
		if len(text) < 8 {
			l.replyText(event.ReplyToken, "種目IDが短すぎます。正しいIDを送ってください")
			l.pushAddMenu(uid)
			return
		}
		s.Pending.ExerciseID = text
		s.State = lineflow.StateAddWeight
		_ = lineflow.SaveState(ctx, l.lineuc, uid, s, stateTTL)
		l.replyText(event.ReplyToken, "OK! 次は重量(kg)を送ってください（例: 60）")

	case lineflow.StateAddWeight:
		w, err := strconv.ParseFloat(text, 64)
		if err != nil || w < 0 {
			l.replyText(event.ReplyToken, "重量は0以上の数値で送ってください")
			return
		}
		s.Pending.Weight = &w
		s.State = lineflow.StateAddCount
		_ = lineflow.SaveState(ctx, l.lineuc, uid, s, stateTTL)
		l.replyText(event.ReplyToken, "OK! 次は回数を送ってください（例: 8）")

	case lineflow.StateAddCount:
		n, err := strconv.Atoi(text)
		if err != nil || n <= 0 {
			l.replyText(event.ReplyToken, "回数は正の整数で送ってください")
			return
		}
		s.Pending.Repetitions = &n

		if !s.Ready() {
			_ = lineflow.SaveState(ctx, l.lineuc, uid, s, stateTTL)
			l.replyText(event.ReplyToken, "まだ情報が足りません。ボタンで続けてください")
			return
		}

		// ここで DB 登録
		user, err := l.getOrCreateUser(ctx, uid)
		if err != nil {
			l.replyText(event.ReplyToken, "ユーザー解決に失敗しました")
			l.pushStartMenu(uid)
			return
		}
		in := models.WorkoutSetCreateInput{
			ExerciseID: s.Pending.ExerciseID,
			SetIndex:   0, // 自動採番なら0
			Reps:       s.Pending.Repetitions,
			WeightKg:   (*float32)(nil),
		}
		if s.Pending.Weight != nil {
			tmp := float32(*s.Pending.Weight)
			in.WeightKg = &tmp
		}

		if _, err := l.workoutSetuc.AddSet(ctx, user.ID, s.WorkoutID, in, true); err != nil {
			l.replyText(event.ReplyToken, "セット登録に失敗しました。『回数』からやり直してください")

			return
		}

		// 完了 → idle に戻す
		lineflow.ClearState(ctx, l.lineuc, uid)
		l.replyText(event.ReplyToken, "セットを登録しました！ 続けて『追加』でどうぞ")
		l.pushAddMenu(uid)
	}
}

func (l *lineController) CreateUser(event *linebot.Event) error {
	if event.Source == nil || event.Source.UserID == "" {
		return errors.New("user id not found in event")
	}
	_, err := l.getOrCreateUser(context.Background(), event.Source.UserID)
	return err
}

func (l *lineController) getOrCreateUser(ctx context.Context, lineUserID string) (*models.User, error) {
	prof, err := l.bot.GetProfile(lineUserID).Do()
	if err != nil {
		return nil, err
	}
	return l.useruc.EnsureUserFromLineProfile(ctx, prof.UserID, &prof.DisplayName, &prof.PictureURL, nil)
}

func (l *lineController) replyText(token, text string) {
	_, _ = l.bot.ReplyMessage(
		token,
		linebot.NewTextMessage(text)).Do()
}

func (l *lineController) pushStartMenu(userID string) {
	container, err := getFlexContainer("start")
	if err != nil {
		return
	}
	_, _ = l.bot.PushMessage(
		userID,
		linebot.NewFlexMessage("メニュー", container),
	).Do()
}

func (l *lineController) pushAddMenu(userID string) {
	container, err := getFlexContainer("add")
	if err != nil {
		return
	}
	_, _ = l.bot.PushMessage(
		userID,
		linebot.NewFlexMessage("メニュー", container),
	).Do()
}

func (l *lineController) pushExerciseListMenu(userID string) {
	container, err := getFlexContainer("exercise_list")
	if err != nil {
		return
	}
	_, _ = l.bot.PushMessage(
		userID,
		linebot.NewFlexMessage("メニュー", container),
	).Do()
}


func getFlexContainer(filename string) (linebot.FlexContainer, error) {
    path := fmt.Sprintf("assets/flex/%s.json", filename)
    data, err := ioutil.ReadFile(path)
    if err != nil {
        return nil, err
    }
    return linebot.UnmarshalFlexMessageJSON(data)
}
