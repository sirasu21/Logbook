// backend/controller/user_controller.go（コピペ）
package controller

import (
	"fmt"
	"log"
	"net/http"

	echoSession "github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"

	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/security"
	usecase "github.com/sirasu21/Logbook/backend/usecase/web"
)

type UserController interface {
	Healthz(c echo.Context) error
	Me(c echo.Context) error
	Logout(c echo.Context) error
	LineLogin(c echo.Context) error
	LineCallback(c echo.Context) error
}	

type userController struct {
	cfg models.Config
	uc  usecase.UserUsecase
}

func NewUserController(cfg models.Config, uc usecase.UserUsecase) UserController {
	return &userController{cfg: cfg, uc: uc}
}

func (h *userController) Healthz(c echo.Context) error {
	return c.String(http.StatusOK, "ok")
}

func (h *userController) Me(c echo.Context) error {
	sess, _ := echoSession.Get("session", c)
	sub, _ := sess.Values["sub"].(string)
	if sub == "" {
		return c.NoContent(http.StatusUnauthorized)
	}
	name, _ := sess.Values["name"].(string)
	picture, _ := sess.Values["picture"].(string)

	return c.JSON(http.StatusOK, map[string]any{
		"provider":      "line",
		"userId":        sub,
		"name":          name,
		"picture":       picture,
		"statusMessage": "", // 必要なら保存・返却
	})
}

func (h *userController) Logout(c echo.Context) error {
	sess, _ := echoSession.Get("session", c)
	sess.Options.MaxAge = -1 // 破棄
	_ = sess.Save(c.Request(), c.Response())

	target := h.cfg.FrontendOrigin + "/"
	log.Printf("logout: redirecting to %s", target)
	return c.Redirect(http.StatusFound, target)
}

func (h *userController) LineLogin(c echo.Context) error {
	// PKCE/一時値を生成してセッションに保存
	state := security.RandB64URL(32)
	nonce := security.RandB64URL(32)
	verifier := security.RandB64URL(64)
	challenge := security.B64url(security.Sha256Sum(verifier))

	sess, _ := echoSession.Get("session", c)
	sess.Values["oauth_state"] = state
	sess.Values["oauth_nonce"] = nonce
	sess.Values["oauth_verifier"] = verifier
	_ = sess.Save(c.Request(), c.Response())

	// 認可URLを作成してリダイレクト
	authURL := h.uc.BuildAuthorizeURL(h.cfg.ChannelID, h.cfg.RedirectURI, state, nonce, challenge)
	return c.Redirect(http.StatusFound, authURL)
}

func (h *userController) LineCallback(c echo.Context) error {
	q := c.Request().URL.Query()
	state := q.Get("state")
	code := q.Get("code")
	if state == "" || code == "" {
		return c.String(http.StatusBadRequest, "invalid callback")
	}

	sess, _ := echoSession.Get("session", c)
	gotState, _ := sess.Values["oauth_state"].(string)
	verifier, _ := sess.Values["oauth_verifier"].(string)
	if gotState == "" || gotState != state {
		return c.String(http.StatusBadRequest, "state mismatch")
	}
	if verifier == "" {
		return c.String(http.StatusBadRequest, "missing verifier")
	}

	// トークン交換 → プロフィール取得
	accessToken, err := h.uc.ExchangeCode(c.Request().Context(), h.cfg.ChannelID, h.cfg.ChannelSecret, h.cfg.RedirectURI, code, verifier)
	if err != nil {
		return c.String(http.StatusBadGateway, fmt.Sprintf("token exchange failed: %v", err))
	}
	prof, err := h.uc.FetchProfile(c.Request().Context(), accessToken)
	if err != nil {
		return c.String(http.StatusBadGateway, fmt.Sprintf("profile fetch failed: %v", err))
	}

	// ★ ここでDBへ登録/更新を確定させる（無ければ作る）
	user, err := h.uc.EnsureUserFromLineProfile(
		c.Request().Context(),
		prof.UserID,       // sub
		&prof.DisplayName, // name
		&prof.PictureURL,  // picture
		nil,               // email（必要ならLINE側から取得して渡す）
	)
	if err != nil {
		return c.String(http.StatusInternalServerError, fmt.Sprintf("user upsert failed: %v", err))
	}

	// セッション確立（固定化対策したければ、一旦破棄→新セッションに再保存でもOK）
	// sess.Options.MaxAge = -1; sess.Save(...) のあと、新たに sub等を入れて再保存 など
	delete(sess.Values, "oauth_state")
	delete(sess.Values, "oauth_nonce")
	delete(sess.Values, "oauth_verifier")
	sess.Values["sub"] = prof.UserID
	sess.Values["user_id"] = user.ID
	sess.Values["name"] = user.Name
	sess.Values["picture"] = user.PictureURL
	_ = sess.Save(c.Request(), c.Response())

	target := h.cfg.FrontendOrigin + "/"
	log.Printf("callback ok: redirecting to %s", target)
	return c.Redirect(http.StatusFound, target)
}
