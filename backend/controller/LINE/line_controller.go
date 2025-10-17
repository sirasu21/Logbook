package controller

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/line/line-bot-sdk-go/linebot"

	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/usecase"
)

// ========== Public Interface ==========

type LineExerciseController interface {
	Webhook(echo.Context) error
}

// ========== Controller ==========

type lineExerciseController struct {
	client        *linebot.Client
	ucuser        usecase.UserUsecase
	ucworkout     usecase.WorkoutUsecase
	ucworkoutSet  usecase.WorkoutSetUsecase
	addSetWizards *addSetStore
}

func NewLineExerciseController(
	client *linebot.Client,
	ucuser usecase.UserUsecase,
	ucworkout usecase.WorkoutUsecase,
	ucworkoutSet usecase.WorkoutSetUsecase,
) LineExerciseController {
	return &lineExerciseController{
		client:        client,
		ucuser:        ucuser,
		ucworkout:     ucworkout,
		ucworkoutSet:  ucworkoutSet,
		addSetWizards: newAddSetStore(),
	}
}

// ========== Wizard State (in-memory) ==========

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
	data map[string]*addSetWizard // key: LINE userID
}

func newAddSetStore() *addSetStore {
	return &addSetStore{data: make(map[string]*addSetWizard)}
}
func (s *addSetStore) Get(uid string) (*addSetWizard, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	w, ok := s.data[uid]
	return w, ok
}
func (s *addSetStore) Set(uid string, w *addSetWizard) {
	s.mu.Lock()
	s.data[uid] = w
	s.mu.Unlock()
}
func (s *addSetStore) Delete(uid string) {
	s.mu.Lock()
	delete(s.data, uid)
	s.mu.Unlock()
}

// ========== Utilities ==========

func parseInt(s string) (int, error) {
	return strconv.Atoi(strings.TrimSpace(s))
}
func parseFloat32(s string) (float32, error) {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 32)
	return float32(f), err
}
func (h *lineExerciseController) replyText(token, text string) {
	_, _ = h.client.ReplyMessage(token, linebot.NewTextMessage(text)).Do()
}

// resolve LINE userID -> DB userID (and soft-sync profile)
func (h *lineExerciseController) resolveUser(ctx context.Context, lineUserID string) (string, error) {
	prof, err := h.client.GetProfile(lineUserID).Do()
	if err != nil {
		return "", err
	}
	u, err := h.ucuser.EnsureUserFromLineProfile(ctx, prof.UserID, &prof.DisplayName, &prof.PictureURL, nil)
	if err != nil {
		return "", err
	}
	return u.ID, nil
}

// start wizard entry (so we can reuse from Postback later)
func (h *lineExerciseController) startAddSetWizard(lineUID, replyToken, workoutID string) {
	wz := &addSetWizard{WorkoutID: workoutID, Step: stepExercise}
	h.addSetWizards.Set(lineUID, wz)
	h.replyText(replyToken, "種目IDを教えてください（例: 11111111-1111-...）。名前検索は今後対応予定です。")
}

// ========== Webhook ==========

const cancelKeyword = "キャンセル"

func (h *lineExerciseController) Webhook(c echo.Context) error {
	events, err := h.client.ParseRequest(c.Request())
	if err != nil {
		// 署名不一致などは 400 を返す
		return c.NoContent(http.StatusBadRequest)
	}

	for _, event := range events {
		switch event.Type {

		case linebot.EventTypeFollow:
			// 友だち追加 → ユーザー登録
			lineUID := event.Source.UserID
			ctx := c.Request().Context()
			userID, err := h.resolveUser(ctx, lineUID)
			if err != nil {
				// ユーザーには簡潔に
				h.replyText(event.ReplyToken, "登録に失敗しました。少し時間をおいて再度お試しください。")
				continue
			}
			_ = userID // 以降のフローで利用。ここでは挨拶のみ。
			h.replyText(event.ReplyToken, "登録しました。『開始』『追加』『終了』を使って操作できます。")

		case linebot.EventTypeMessage:
			tm, ok := event.Message.(*linebot.TextMessage)
			if !ok {
				continue
			}
			text := strings.TrimSpace(tm.Text)
			lineUID := event.Source.UserID
			ctx := c.Request().Context()

			// キャンセル
			if strings.EqualFold(text, cancelKeyword) {
				if _, exists := h.addSetWizards.Get(lineUID); exists {
					h.addSetWizards.Delete(lineUID)
					h.replyText(event.ReplyToken, "入力をキャンセルしました。『追加』『開始』『終了』から選んでください。")
					continue
				}
			}

			// ウィザード継続中なら、基本 addSet の続きとして処理（ただし「終了」は例外）
			if _, exists := h.addSetWizards.Get(lineUID); exists && !strings.EqualFold(text, "終了") {
				if _, _, _, _, err := h.addSet(ctx, event); err != nil && !errors.Is(err, ErrAwaitingInput) {
					// ここで500を返さず、ユーザーへ簡潔に伝えて会話を継続
					h.replyText(event.ReplyToken, "エラーが発生しました。『追加』からやり直してください。")
				}
				continue
			}

			switch text {
			case "開始":
				if err := h.handleStart(ctx, event); err != nil {
					h.replyText(event.ReplyToken, "開始に失敗しました。少し時間をおいて再度お試しください。")
				}

			case "終了":
				if err := h.handleEnd(ctx, event); err != nil {
					h.replyText(event.ReplyToken, "終了に失敗しました。進行中のワークアウトが無い可能性があります。")
				}

			case "追加":
				// 入口（開始 or 進行）へ
				if err := h.handleAddEntry(ctx, event); err != nil && !errors.Is(err, ErrAwaitingInput) {
					h.replyText(event.ReplyToken, "追加の開始に失敗しました。『開始』してから『追加』してください。")
				}

			default:
				h.replyText(event.ReplyToken, "コマンド: 『開始』/『追加』/『終了』 を使ってね。入力中は『キャンセル』で中断できます。")
			}

		case linebot.EventTypePostback:
			// 未来：Flexのボタンでハンドリングしたい時にここへ追加
			// data := event.Postback.Data
			// switch data { ... }

		default:
			// noop
		}
	}

	return nil
}

// ========== Handlers (split) ==========

func (h *lineExerciseController) handleStart(ctx context.Context, event *linebot.Event) error {
	userID, err := h.resolveUser(ctx, event.Source.UserID)
	if err != nil {
		return err
	}
	in := models.CreateWorkoutInput{
		StartedAt: time.Now(),
		Note:      nil,
	}
	if _, err := h.ucworkout.Create(ctx, userID, in, true); err != nil {
		return err
	}
	h.replyText(event.ReplyToken, "ワークアウトを開始しました。セットを追加する時は『追加』と送信してください。")
	return nil
}

func (h *lineExerciseController) handleEnd(ctx context.Context, event *linebot.Event) error {
	userID, err := h.resolveUser(ctx, event.Source.UserID)
	if err != nil {
		return err
	}
	workoutID, err := h.ucworkout.GetLatestLineWorkoutID(ctx, userID, true)
	if err != nil || workoutID == "" {
		return errors.New("no active line workout")
	}
	if _, err := h.ucworkout.End(ctx, workoutID, userID, time.Now()); err != nil {
		return err
	}
	h.replyText(event.ReplyToken, "ワークアウトを終了しました。おつかれさま！")
	return nil
}

func (h *lineExerciseController) handleAddEntry(ctx context.Context, event *linebot.Event) error {
	userID, err := h.resolveUser(ctx, event.Source.UserID)
	if err != nil {
		return err
	}
	workoutID, err := h.ucworkout.GetLatestLineWorkoutID(ctx, userID, true)
	if err != nil || workoutID == "" {
		h.replyText(event.ReplyToken, "まだ開始中のワークアウトがありません。『開始』と送って始めてください。")
		return ErrAwaitingInput
	}
	h.startAddSetWizard(event.Source.UserID, event.ReplyToken, workoutID)
	return ErrAwaitingInput
}

// “続き”の処理（入力を1歩進める or 完了してUsecaseへ）
func (h *lineExerciseController) addSet(ctx context.Context, event *linebot.Event) (context.Context, string, string, models.WorkoutSetCreateInput, error) {
	// user resolve
	userID, err := h.resolveUser(ctx, event.Source.UserID)
	if err != nil {
		return nil, "", "", models.WorkoutSetCreateInput{}, err
	}

	// ongoing workout
	workoutID, err := h.ucworkout.GetLatestLineWorkoutID(ctx, userID, true)
	if err != nil || workoutID == "" {
		h.replyText(event.ReplyToken, "まだ開始中のワークアウトがありません。『開始』と送って始めてください。")
		return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
	}

	// message
	tm, ok := event.Message.(*linebot.TextMessage)
	if !ok {
		return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
	}
	text := strings.TrimSpace(tm.Text)

	// wizard
	lineUID := event.Source.UserID
	wz, exists := h.addSetWizards.Get(lineUID)
	if !exists {
		// 念のため入口から再誘導
		h.startAddSetWizard( lineUID, event.ReplyToken, workoutID)
		return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
	}

	switch wz.Step {
	case stepExercise:
		wz.ExerciseID = text
		wz.Step = stepReps
		h.replyText(event.ReplyToken, "回数（Reps）を数字で入力してください（例: 8）")
		return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput

	case stepReps:
		n, err := parseInt(text)
		if err != nil || n <= 0 {
			h.replyText(event.ReplyToken, "回数は正の整数で入力してください。例: 8")
			return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
		}
		wz.Reps = n
		wz.Step = stepWeight
		h.replyText(event.ReplyToken, "重量(kg) を入力してください（例: 60、0は自重）")
		return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput

	case stepWeight:
		f, err := parseFloat32(text)
		if err != nil || f < 0 {
			h.replyText(event.ReplyToken, "重量は0以上の数値で入力してください。例: 60")
			return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
		}
		wz.WeightKg = f
		wz.Step = stepDone

		in := models.WorkoutSetCreateInput{
			ExerciseID: wz.ExerciseID,
			SetIndex:   0, // repo側自動採番運用
			Reps:       &wz.Reps,
			WeightKg:   &wz.WeightKg,
			// RPE / Warmup / Rest / Note は会話を拡張して追加
		}

		// 実際に登録
		if _, err := h.ucworkoutSet.AddSet(ctx, userID, wz.WorkoutID, in, true); err != nil {
			h.replyText(event.ReplyToken, "セット登録でエラーが発生しました。『追加』からやり直してください。")
			// ウィザードは消さずに再入力させても良いが、ここでは消す
			h.addSetWizards.Delete(lineUID)
			return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
		}

		// 完了メッセージ
		h.replyText(event.ReplyToken, "ワークアウトセットを登録しました。続けて追加する場合は『追加』、終了する場合は『終了』と送信してください。")

		// 後片付け
		h.addSetWizards.Delete(lineUID)
		return ctx, userID, wz.WorkoutID, in, nil

	default:
		// 想定外：リセット
		h.addSetWizards.Delete(lineUID)
		h.replyText(event.ReplyToken, "すみません、最初からやり直します。もう一度『追加』と送ってください。")
		return nil, "", "", models.WorkoutSetCreateInput{}, ErrAwaitingInput
	}
}