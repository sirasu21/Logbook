package controller

import (
	"net/http"
	"strconv"
	"strings"

	echoSession "github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"

	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/usecase"
)

type ExerciseController interface {
	List(c echo.Context) error
	Get(c echo.Context) error
	Create(c echo.Context) error
	Update(c echo.Context) error
	Delete(c echo.Context) error
}

type exerciseController struct {
	cfg models.Config
	uc  usecase.ExerciseUsecase
}

func NewExerciseController(cfg models.Config, uc usecase.ExerciseUsecase) ExerciseController {
	return &exerciseController{cfg: cfg, uc: uc}
}

func (h *exerciseController) currentUserID(c echo.Context) string {
	sess, _ := echoSession.Get("session", c)
	if v, _ := sess.Values["user_id"].(string); v != "" {
		return v
	}
	return ""
}

func (h *exerciseController) List(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}

	q := c.QueryParam("q")
	typ := c.QueryParam("type")
	var typePtr *string
	if strings.TrimSpace(typ) != "" {
		typePtr = &typ
	}
	onlyMine := c.QueryParam("onlyMine") == "true"

	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	offset, _ := strconv.Atoi(c.QueryParam("offset"))

	out, err := h.uc.List(c.Request().Context(), userID, usecase.ListExercisesInput{
		Q:        q,
		Type:     typePtr,
		OnlyMine: onlyMine,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		return c.String(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, out)
}

func (h *exerciseController) Get(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}
	id := c.Param("id")
	ex, err := h.uc.Get(c.Request().Context(), userID, id)
	if err != nil {
		return c.NoContent(http.StatusNotFound)
	}
	return c.JSON(http.StatusOK, ex)
}

func (h *exerciseController) Create(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}
	var in usecase.CreateExerciseInput
	if err := c.Bind(&in); err != nil {
		return c.String(http.StatusBadRequest, "invalid body")
	}
	ex, err := h.uc.Create(c.Request().Context(), userID, in)
	if err != nil {
		// 必須チェックやバリデーションエラーは 400 にしてもOK
		return c.String(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusCreated, ex)
}

func (h *exerciseController) Update(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}
	id := c.Param("id")
	var in usecase.UpdateExerciseInput
	if err := c.Bind(&in); err != nil {
		return c.String(http.StatusBadRequest, "invalid body")
	}
	ex, err := h.uc.Update(c.Request().Context(), userID, id, in)
	if err != nil {
		return c.NoContent(http.StatusNotFound) // 権限なし or 無い
	}
	return c.JSON(http.StatusOK, ex)
}



func (h *exerciseController) Delete(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}
	id := c.Param("id")
	if err := h.uc.Delete(c.Request().Context(), userID, id); err != nil {
		return c.NoContent(http.StatusNotFound)
	}
	return c.NoContent(http.StatusNoContent)
}