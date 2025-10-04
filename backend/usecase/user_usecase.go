// backend/usecase/user_usecase.go（コピペ）
package usecase

import (
	"context"

	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/repository"
)

type UserUsecase interface {
	// 認可URLを作る（state/nonce/challenge は Controller 側で作って渡す）
	BuildAuthorizeURL(channelID, redirectURI, state, nonce, codeChallenge string) string
	// 認可コードをアクセストークンへ交換
	ExchangeCode(ctx context.Context, channelID, channelSecret, redirectURI, code, verifier string) (string, error)
	// アクセストークンでプロフィール取得
	FetchProfile(ctx context.Context, accessToken string) (models.Profile, error)
}

type userUsecase struct {
	authRepo repository.AuthRepository
}

func NewUserUsecase(auth repository.AuthRepository) UserUsecase {
	return &userUsecase{authRepo: auth}
}

func (u *userUsecase) BuildAuthorizeURL(channelID, redirectURI, state, nonce, codeChallenge string) string {
	return u.authRepo.BuildAuthorizeURL(channelID, redirectURI, state, nonce, codeChallenge)
}

func (u *userUsecase) ExchangeCode(ctx context.Context, channelID, channelSecret, redirectURI, code, verifier string) (string, error) {
	return u.authRepo.ExchangeCode(ctx, channelID, channelSecret, redirectURI, code, verifier)
}


func (u *userUsecase) FetchProfile(ctx context.Context, accessToken string) (models.Profile, error) {
    rp, err := u.authRepo.FetchProfile(ctx, accessToken) // rp: repository.Profile
    if err != nil {
        return models.Profile{}, err
    }
    // repository.Profile → models.Profile へ詰め替え
    return models.Profile{
        UserID:        rp.UserID,
        DisplayName:   rp.DisplayName,
        PictureURL:    rp.PictureURL,
        StatusMessage: rp.StatusMessage,
    }, nil
}