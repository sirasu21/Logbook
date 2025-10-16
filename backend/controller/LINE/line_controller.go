package controller

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/line/line-bot-sdk-go/linebot"
	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/usecase"
)

type LineExerciseController interface {
	Webhook(echo.Context) error
}



type lineExerciseController struct {
	client *linebot.Client
	ucuser usecase.UserUsecase
	ucworkout usecase.WorkoutUsecase
	ucworkoutSet usecase.WorkoutSetUsecase
	addSetWizards *addSetStore
}

func NewLineExerciseController(client *linebot.Client, ucuser usecase.UserUsecase, ucworkout usecase.WorkoutUsecase, ucworkoutSet usecase.WorkoutSetUsecase) LineExerciseController {
	return &lineExerciseController{client: client, ucuser: ucuser, ucworkout: ucworkout, ucworkoutSet: ucworkoutSet, addSetWizards: newAddSetStore()}
}

var ErrAwaitingInput = errors.New("awaiting further user input")

type setStep int

const (
	stepNone setStep = iota
	stepExercise
	stepReps
	stepWeight
	stepDone
)

type addSetWizard struct {
	WorkoutID  string
	ExerciseID string
	Reps       int
	WeightKg   float32
	Step       setStep
}

type addSetStore struct {
	mu   sync.Mutex
	data map[string]*addSetWizard // key: lineUserID
}

func newAddSetStore() *addSetStore {
	return &addSetStore{data: make(map[string]*addSetWizard)}
}
func (s *addSetStore) Get(uid string) (*addSetWizard, bool) {
	s.mu.Lock(); defer s.mu.Unlock()
	w, ok := s.data[uid]
	return w, ok
}
func (s *addSetStore) Set(uid string, w *addSetWizard) {
	s.mu.Lock(); defer s.mu.Unlock()
	s.data[uid] = w
}
func (s *addSetStore) Delete(uid string) {
	s.mu.Lock(); defer s.mu.Unlock()
	delete(s.data, uid)
}

func parseInt(s string) (int, error) {
	return strconv.Atoi(strings.TrimSpace(s))
}
func parseFloat32(s string) (float32, error) {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 32)
	return float32(f), err
}

func (h *lineExerciseController) Webhook(c echo.Context) error {
	req := c.Request()
	events, err := h.client.ParseRequest(req)
	if err != nil {
			return errors.New(err.Error())
		}
	for _, event := range events {
		switch event.Type {
		case linebot.EventTypeFollow:
			// フォローイベント（友だち追加）
			userID := event.Source.UserID

			// LINEのプロフィールを取得
			profile, err := h.client.GetProfile(userID).Do()
			if err != nil {
				return err
			}

			// usecaseを通してDBに登録
			ctx := c.Request().Context()
			user, err := h.ucuser.EnsureUserFromLineProfile(ctx, userID,
				&profile.DisplayName, &profile.PictureURL, nil)
			if err != nil {
				return err
			}

			// 登録成功メッセージを返信
			if user.Name != nil {
				_, err = h.client.ReplyMessage(event.ReplyToken,
					linebot.NewTextMessage(fmt.Sprintf("%sさん、登録しました", *user.Name)),
				).Do()
				if err != nil {
					return err
				}
			} else {
				_, err = h.client.ReplyMessage(event.ReplyToken,
					linebot.NewTextMessage("登録しました"),
				).Do()
				if err != nil {
					return err
				}
			}
		
		
		case linebot.EventTypeMessage:
			switch msg := event.Message.(type) {
			case *linebot.TextMessage:
				userText := msg.Text
				if userText == "開始" {
					ctx, UserID, in, err := h.createWorkout(event)
					if err != nil {
						return err
					}
					_, err = h.ucworkout.Create(ctx, UserID, in, true)
					if err != nil {
						return err
					}
					_, err = h.client.ReplyMessage(event.ReplyToken,
						linebot.NewTextMessage("ワークアウトを開始しました。セットを追加するときは追加と送信してください。"),
					).Do()
					if err != nil {
						return err
					}
				}
				if userText == "終了" {
					ctx, workoutID, userID, EndedAt, err := h.endWorkout(event)
					if err != nil {
						return err
					}
					_, err = h.ucworkout.End(ctx, workoutID, userID, EndedAt)
					if err != nil {
						return err
					}
					_, err = h.client.ReplyMessage(event.ReplyToken,
						linebot.NewTextMessage("ワークアウトを終了しました"),
					).Do()
					if err != nil {
						return err
					}
				}
				if userText == "追加" {
					ctx, userID, workoutID, in,err := h.addSet(event)
					if err != nil {
						return err
					}
					_, err = h.ucworkoutSet.AddSet(ctx, userID, workoutID, in, true)
					if err != nil {
						return err
					}
					_, err = h.client.ReplyMessage(event.ReplyToken,
						linebot.NewTextMessage("ワークアウトセットを登録しました。セットを追加するときは追加と送信してください。終了するときは終了と送信してください"),
					).Do()
					if err != nil {
						return err
					}
				}
				
			}
		}
		
	}
	return nil
}

func (h *lineExerciseController) createWorkout(event *linebot.Event) (context.Context, string, models.CreateWorkoutInput, error) {
	profile , err := h.client.GetProfile(event.Source.UserID).Do()
	if err != nil {
		return nil, "", models.CreateWorkoutInput{}, err
	}

	ctx := context.Background()
	user, err := h.ucuser.EnsureUserFromLineProfile(
		ctx,
		profile.UserID, // LINEのID
		&profile.DisplayName,
		&profile.PictureURL,
		nil, // email
	)

	if err != nil {
		return nil, "", models.CreateWorkoutInput{}, err
	}

	// ワークアウトの入力を作成
	in := models.CreateWorkoutInput{
		StartedAt: time.Now(),
		Note:      nil,
	}

	return ctx, user.ID, in, nil
}

func (h *lineExerciseController) endWorkout(event *linebot.Event) (context.Context, string, string, time.Time, error) {
	profile , err := h.client.GetProfile(event.Source.UserID).Do()
	if err != nil {
		return nil, "", "", time.Time{}, err
	}

	ctx := context.Background()
	user, err := h.ucuser.EnsureUserFromLineProfile(
		ctx,
		profile.UserID, // LINEのID
		&profile.DisplayName,
		&profile.PictureURL,
		nil,
	)
	if err != nil {
		return nil, "", "", time.Time{}, err
	}
	EndedAt := time.Now()

	workoutID, err := h.ucworkout.GetLatestLineWorkoutID(ctx, user.ID, true)
	if err != nil {
		return nil, "", "", time.Time{}, err
	}
	return ctx,  workoutID, user.ID, EndedAt, nil
}


// controller/line_exercise_controller.go（追記）
func (h *lineExerciseController) addSet(event *linebot.Event) (context.Context, string, string, models.WorkoutSetCreateInput, error) {
	// 1) LINEユーザー → DBユーザーID解決
	profile, err := h.client.GetProfile(event.Source.UserID).Do()
	if err != nil {
		// ここでReplyしない（上位で一元的に扱う前提）。必要なら簡易返信してもOK
		return nil, "", "", models.WorkoutSetCreateInput{}, err
	}
	ctx := context.Background()
	user, err := h.ucuser.EnsureUserFromLineProfile(ctx, profile.UserID, &profile.DisplayName, &profile.PictureURL, nil)
	if err != nil {
		return nil, "", "", models.WorkoutSetCreateInput{}, err
	}

	// 2) 進行中ワークアウトを取得（is_from_line=true の最新・未終了）
	workoutID, err := h.ucworkout.GetLatestLineWorkoutID(ctx, user.ID, true)
	if err != nil || workoutID == "" {
		_, _ = h.client.ReplyMessage(event.ReplyToken,
			linebot.NewTextMessage("まだ開始中のワークアウトがありません。「開始」と送って始めてください。"),
		).Do()
		return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
	}

	// 3) 今のメッセージ（テキスト）を取得
	msg, ok := event.Message.(*linebot.TextMessage)
	if !ok {
		return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
	}
	text := strings.TrimSpace(msg.Text)

	// 4) ウィザード状態をロード／初期化
	wz, exists := h.addSetWizards.Get(event.Source.UserID)
	if !exists {
		// 「追加」で呼ばれた最初の一回：ウィザード開始
		wz = &addSetWizard{
			WorkoutID: workoutID,
			Step:      stepExercise,
		}
		h.addSetWizards.Set(event.Source.UserID, wz)
		_, _ = h.client.ReplyMessage(event.ReplyToken,
			linebot.NewTextMessage("種目IDを教えてください（例: 11111111-1111-...）。名前対応は後で拡張できます。"),
		).Do()
		return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
	}

	// 5) ステップ進行
	switch wz.Step {
	case stepExercise:
		wz.ExerciseID = text
		wz.Step = stepReps
		_, _ = h.client.ReplyMessage(event.ReplyToken,
			linebot.NewTextMessage("回数は？（例: 8）"),
		).Do()
		return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput

	case stepReps:
		n, err := parseInt(text)
		if err != nil || n <= 0 {
			fmt.Println("error", err)
			_, _ = h.client.ReplyMessage(event.ReplyToken,
				linebot.NewTextMessage("回数は正の整数で入力してください。例: 8"),
			).Do()
			return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
		}
		wz.Reps = n
		wz.Step = stepWeight
		_, _ = h.client.ReplyMessage(event.ReplyToken,
			linebot.NewTextMessage("重量(kg)は？（例: 60 / 0 は自重）"),
		).Do()
		return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput

	case stepWeight:
		f, err := parseFloat32(text)
		if err != nil || f < 0 {
			_, _ = h.client.ReplyMessage(event.ReplyToken,
				linebot.NewTextMessage("重量は0以上の数値で入力してください。例: 60"),
			).Do()
			return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
		}
		wz.WeightKg = f
		wz.Step = stepDone

		// 6) 入力が揃ったので返す
		in := models.WorkoutSetCreateInput{
			ExerciseID: wz.ExerciseID,
			SetIndex:   0, // repo側で自動採番に任せる
			Reps:       &wz.Reps,
			WeightKg:   &wz.WeightKg,
			// RPE, Warmup, Rest, Note などは対話を増やせばここに足す
		}
		// ウィザード終了
		h.addSetWizards.Delete(event.Source.UserID)
		return ctx, user.ID, wz.WorkoutID, in, nil

	default:
		// 想定外：やり直し
		h.addSetWizards.Delete(event.Source.UserID)
		_, _ = h.client.ReplyMessage(event.ReplyToken,
			linebot.NewTextMessage("すみません、最初からやり直します。もう一度「追加」と送ってください。"),
		).Do()
		return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
	}
}