// backend/controller/line_exercise_controller.go
package controller

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/line/line-bot-sdk-go/linebot"

	"github.com/sirasu21/Logbook/backend/models"
	usecaseLine "github.com/sirasu21/Logbook/backend/usecase/LINE"
	usecase "github.com/sirasu21/Logbook/backend/usecase/web"
)

type LineController interface {
	Webhook(c echo.Context) error
}

type lineController struct {
	bot *linebot.Client
	lineuc usecaseLine.LineUsecase
	exerciseuc usecase.ExerciseUsecase
	workoutuc usecase.WorkoutUsecase
	useruc usecase.UserUsecase

}

func NewLineController(bot *linebot.Client, lineuc usecaseLine.LineUsecase, exerciseuc usecase.ExerciseUsecase, workoutuc usecase.WorkoutUsecase, useruc usecase.UserUsecase) LineController {
	return &lineController{bot: bot, lineuc: lineuc, exerciseuc: exerciseuc, workoutuc: workoutuc, useruc: useruc}
}


func (l *lineController) Webhook(c echo.Context) error {
	events, err := l.bot.ParseRequest(c.Request())
	if err != nil{
		return err
	}
	for _, event := range events{
		switch event.Type{
		// 初回登録時
		case linebot.EventTypeFollow:
			if err := l.CreateUser(event); err != nil {
				l.replyTextAndMenu(event.ReplyToken, fmt.Sprintf("登録時にエラーが発生しました: %v", err))
				continue
			}
			l.replyTextAndMenu(event.ReplyToken, "登録しました！「開始」「終了」ボタン（またはメッセージ）でどうぞ💪")
			
		
		case linebot.EventTypePostback:
			postback := event.Postback
			switch postback.Data{
			case "action=start":
				if err := l.createWorkout(event); err != nil {
					l.replyTextAndMenu(event.ReplyToken, fmt.Sprintf("開始時にエラーが発生しました: %v", err))
					continue
				}
				l.replyTextAndMenu(event.ReplyToken, "ワークアウトを開始しました！💪")
			}
			case "action=end":
				if err := l.endWorkout(event); err != nil {
					l.replyTextAndMenu(event.ReplyToken, fmt.Sprintf("終了時にエラーが発生しました: %v", err))
					continue
				}
				l.replyTextAndMenu(event.ReplyToken, "ワークアウトを終了しました！💪")
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
	_, err = l.workoutuc.Create(ctx, user.ID, in, true)
	return err
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

	// 最新 / is_from_line=true のワークアウト ID を取得（usecase 側に実装済み想定）
	workoutID, err := l.workoutuc.GetLatestLineWorkoutID(ctx, user.ID, true)
	if err != nil {
		return err
	}
	if workoutID == "" {
		return errors.New("進行中のワークアウトがありません。まずは『開始』してください")
	}

	_, err = l.workoutuc.End(ctx, workoutID, user.ID, time.Now())
	return err
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

func (l *lineController) replyTextAndMenu(token, text string) {
	container, err := getFlexMenuContainer()
	if err != nil {
		// menu.json が壊れているなどの時はテキストのみ
		_, _ = l.bot.ReplyMessage(token, linebot.NewTextMessage(text+"\n(メニューの読み込みに失敗しました)")).Do()
		return
	}
	_, _ = l.bot.ReplyMessage(
		token,
		linebot.NewTextMessage(text),
		linebot.NewFlexMessage("メニュー", container),
	).Do()
}

func getFlexMenuContainer() (linebot.FlexContainer, error) {
    data, err := ioutil.ReadFile("assets/flex/menu.json") // 実行時に読み込む
    if err != nil {
        return nil, err
    }
    return linebot.UnmarshalFlexMessageJSON(data)
}




	




