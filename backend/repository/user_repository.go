// internal/repository/auth_repository.go
package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/sirasu21/Logbook/backend/models"
	"gorm.io/gorm"
)

type AuthRepository interface {
	BuildAuthorizeURL(clientID, redirectURI, state, nonce, codeChallenge string) string
	ExchangeCode(ctx context.Context, clientID, clientSecret, redirectURI, code, verifier string) (accessToken string, err error)
	FetchProfile(ctx context.Context, accessToken string) (Profile, error)
	ResolveOrCreateBySub(ctx context.Context, sub string, name, pictureURL, email *string) (*models.User, error)
}

type Profile struct {
	UserID        string
	DisplayName   string
	PictureURL    string
	StatusMessage string
}

type lineAuthRepository struct{ httpClient *http.Client; db *gorm.DB }

func NewLineAuthRepository(httpClient *http.Client, db *gorm.DB) AuthRepository {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &lineAuthRepository{httpClient: httpClient, db: db}
}

func (r *lineAuthRepository) BuildAuthorizeURL(clientID, redirectURI, state, nonce, codeChallenge string) string {
	v := url.Values{}
	v.Set("response_type", "code")
	v.Set("client_id", clientID)
	v.Set("redirect_uri", redirectURI)
	v.Set("state", state)
	v.Set("scope", "openid profile")
	v.Set("nonce", nonce)
	v.Set("code_challenge", codeChallenge)
	v.Set("code_challenge_method", "S256")
	return "https://access.line.me/oauth2/v2.1/authorize?" + v.Encode()
}

func (r *lineAuthRepository) ExchangeCode(ctx context.Context, clientID, clientSecret, redirectURI, code, verifier string) (string, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"code_verifier": {verifier},
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.line.me/oauth2/v2.1/token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("token endpoint error: %s", string(body))
	}
	var tr struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tr); err != nil {
		return "", err
	}
	return tr.AccessToken, nil
}

func (r *lineAuthRepository) FetchProfile(ctx context.Context, accessToken string) (Profile, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.line.me/v2/profile", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return Profile{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(resp.Body)
		return Profile{}, fmt.Errorf("profile error: %s", string(b))
	}
	var p struct {
		UserID        string `json:"userId"`
		DisplayName   string `json:"displayName"`
		PictureURL    string `json:"pictureUrl"`
		StatusMessage string `json:"statusMessage"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&p); err != nil {
		return Profile{}, err
	}
	return Profile{UserID: p.UserID, DisplayName: p.DisplayName, PictureURL: p.PictureURL, StatusMessage: p.StatusMessage}, nil
}

func (r *lineAuthRepository) ResolveOrCreateBySub(ctx context.Context, sub string, name, pictureURL, email *string) (*models.User, error) {
	var u models.User
	err := r.db.WithContext(ctx).Where("line_user_id = ?", sub).First(&u).Error
	switch {
	case err == nil:
		// 既存ユーザー：必要なら表示名やアイコンを軽く同期
		updates := map[string]any{}
		if name != nil && (u.Name == nil || *u.Name != *name) {
			updates["name"] = *name
		}
		if pictureURL != nil && (u.PictureURL == nil || *u.PictureURL != *pictureURL) {
			updates["picture_url"] = *pictureURL
		}
		if email != nil && (u.Email == nil || *u.Email != *email) {
			updates["email"] = *email
		}
		if len(updates) > 0 {
			if err := r.db.WithContext(ctx).Model(&u).Updates(updates).Error; err != nil {
				return nil, err
			}
		}
		return &u, nil

	case err == gorm.ErrRecordNotFound:
		// 新規ユーザー：sub を主として作成
		u = models.User{
			LineUserID: sub,
			Name:       name,
			PictureURL: pictureURL,
			Email:      email,
		}
		if err := r.db.WithContext(ctx).Create(&u).Error; err != nil {
			return nil, err
		}
		return &u, nil

	default:
		// 予期しないDBエラー
		return nil, err
	}
}