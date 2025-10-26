// backend/controller/line_exercise_controller.go
package controller

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/line/line-bot-sdk-go/linebot"

	"github.com/sirasu21/Logbook/backend/models"
	usecase "github.com/sirasu21/Logbook/backend/usecase/web"
)


func getFlexMenuContainer() (linebot.FlexContainer, error) {
    data, err := ioutil.ReadFile("assets/flex/menu.json") // 実行時に読み込む
    if err != nil {
        return nil, err
    }
    return linebot.UnmarshalFlexMessageJSON(data)
}
type LineExerciseController interface {
	Webhook(echo.Context) error
}

type lineExerciseController struct {
	bot       *linebot.Client
	ucUser    usecase.UserUsecase
	ucWorkout usecase.WorkoutUsecase
}

func NewLineExerciseController(
	bot *linebot.Client,
	ucUser usecase.UserUsecase,
	ucWorkout usecase.WorkoutUsecase,
) LineExerciseController {
	return &lineExerciseController{
		bot:       bot,
		ucUser:    ucUser,
		ucWorkout: ucWorkout,
	}
}

// ================ Webhook ================
func (h *lineExerciseController) Webhook(c echo.Context) error {
	events, err := h.bot.ParseRequest(c.Request())
	if err != nil {
		// 署名不正などは 400 を返すのが親切だが、ここではそのまま返す
		return err
	}

	for _, event := range events {
		switch event.Type {

		case linebot.EventTypeFollow:
			// 初回フォロー：ユーザー登録だけ済ませる
			if err := h.ensureUserRegistered(event); err != nil {
				h.replyTextAndMenu(event.ReplyToken, fmt.Sprintf("登録時にエラーが発生しました: %v", err))
				continue
			}
			h.replyTextAndMenu(event.ReplyToken, "登録しました！「開始」「終了」ボタン（またはメッセージ）でどうぞ💪")

		case linebot.EventTypePostback:
			// Flex のボタン押下
			switch event.Postback.Data {
			case "action=start":
				if err := h.createWorkout(event); err != nil {
					h.replyTextAndMenu(event.ReplyToken, fmt.Sprintf("開始時にエラーが発生しました: %v", err))
					continue
				}
				h.replyTextAndMenu(event.ReplyToken, "ワークアウトを開始しました！💪")

			case "action=end":
				if err := h.endWorkout(event); err != nil {
					h.replyTextAndMenu(event.ReplyToken, fmt.Sprintf("終了時にエラーが発生しました: %v", err))
					continue
				}
				h.replyTextAndMenu(event.ReplyToken, "ワークアウトを終了しました。おつかれさま！🔥")

			default:
				h.replyTextAndMenu(event.ReplyToken, "未対応の操作です。『開始』か『終了』を選んでください。")
			}

		case linebot.EventTypeMessage:
			// テキストメッセージでも同じ動作を提供
			tm, ok := event.Message.(*linebot.TextMessage)
			if !ok {
				continue
			}
			text := strings.TrimSpace(tm.Text)
			switch text {
			case "開始":
				if err := h.createWorkout(event); err != nil {
					h.replyTextAndMenu(event.ReplyToken, fmt.Sprintf("開始時にエラーが発生しました: %v", err))
					continue
				}
				h.replyTextAndMenu(event.ReplyToken, "ワークアウトを開始しました！💪")

			case "終了":
				if err := h.endWorkout(event); err != nil {
					h.replyTextAndMenu(event.ReplyToken, fmt.Sprintf("終了時にエラーが発生しました: %v", err))
					continue
				}
				h.replyTextAndMenu(event.ReplyToken, "ワークアウトを終了しました。おつかれさま！🔥")

			default:
				h.replyTextAndMenu(event.ReplyToken, "コマンド: 「開始」/「終了」 を使ってね。")
			}

		default:
			// noop
		}
	}

	return nil
}

// ================ Helpers ================
func (h *lineExerciseController) replyTextAndMenu(token, text string) {
	container, err := getFlexMenuContainer()
	if err != nil {
		// menu.json が壊れているなどの時はテキストのみ
		_, _ = h.bot.ReplyMessage(token, linebot.NewTextMessage(text+"\n(メニューの読み込みに失敗しました)")).Do()
		return
	}
	_, _ = h.bot.ReplyMessage(
		token,
		linebot.NewTextMessage(text),
		linebot.NewFlexMessage("メニュー", container),
	).Do()
}

// LINE の userId からプロファイル取得 → DB ユーザーを作成/更新して返す
func (h *lineExerciseController) getOrCreateUser(ctx context.Context, lineUserID string) (*models.User, error) {
	prof, err := h.bot.GetProfile(lineUserID).Do()
	if err != nil {
		return nil, err
	}
	return h.ucUser.EnsureUserFromLineProfile(ctx, prof.UserID, &prof.DisplayName, &prof.PictureURL, nil)
}

// 友だち追加時など、ユーザー登録だけ行う
func (h *lineExerciseController) ensureUserRegistered(event *linebot.Event) error {
	if event.Source == nil || event.Source.UserID == "" {
		return errors.New("user id not found in event")
	}
	_, err := h.getOrCreateUser(context.Background(), event.Source.UserID)
	return err
}

// ================ Usecase ラッパ（Controller 内で完結） ================

// 「開始」：usecase.Create まで
func (h *lineExerciseController) createWorkout(event *linebot.Event) error {
	if event.Source == nil || event.Source.UserID == "" {
		return errors.New("user id not found in event")
	}
	ctx := context.Background()

	user, err := h.getOrCreateUser(ctx, event.Source.UserID)
	if err != nil {
		return err
	}

	in := models.CreateWorkoutInput{
		StartedAt: time.Now(),
		Note:      nil,
	}
	// 第4引数 isFromLine=true（あなたの実装に合わせて）
	_, err = h.ucWorkout.Create(ctx, user.ID, in, true)
	return err
}

// 「終了」：最新の LINE 由来ワークアウトを終える
func (h *lineExerciseController) endWorkout(event *linebot.Event) error {
	if event.Source == nil || event.Source.UserID == "" {
		return errors.New("user id not found in event")
	}
	ctx := context.Background()

	user, err := h.getOrCreateUser(ctx, event.Source.UserID)
	if err != nil {
		return err
	}

	// 最新 / is_from_line=true のワークアウト ID を取得（usecase 側に実装済み想定）
	workoutID, err := h.ucWorkout.GetLatestLineWorkoutID(ctx, user.ID, true)
	if err != nil {
		return err
	}
	if workoutID == "" {
		return errors.New("進行中のワークアウトがありません。まずは『開始』してください")
	}

	_, err = h.ucWorkout.End(ctx, workoutID, user.ID, time.Now())
	return err
}