package controller

import (
	"net/http"

	echoSession "github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"

	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/usecase"
)

type WorkoutSetController interface {
	AddSet(c echo.Context) error
	UpdateSet(c echo.Context) error
	DeleteSet(c echo.Context) error
}

type workoutSetController struct {
	uc usecase.WorkoutSetUsecase
}

func NewWorkoutSetController(uc usecase.WorkoutSetUsecase) WorkoutSetController {
	return &workoutSetController{uc: uc}
}

func (h *workoutSetController) currentUserID(c echo.Context) string {
	if uid, _ := c.Get("userID").(string); uid != "" {
		return uid
	}
	sess, _ := echoSession.Get("session", c)
	userID, _ := sess.Values["user_id"].(string) // いまは LINE の sub を userID として使っている
	return userID
}

func (h *workoutSetController) AddSet(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}

	workoutID := c.Param("workoutId")
	if workoutID == "" {
		return c.String(http.StatusBadRequest, "missing workoutId")
	}

	var in models.WorkoutSetCreateInput
	if err := c.Bind(&in); err != nil {
		return c.String(http.StatusBadRequest, "invalid body")
	}

	ws, err := h.uc.AddSet(c.Request().Context(), userID, workoutID, in, false)
	if err != nil {
		// 将来的にエラー種別で 400/403/404/500 を出し分け
		return c.String(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, ws)
}

func (h *workoutSetController) UpdateSet(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}

	setID := c.Param("setId")
	if setID == "" {
		return c.String(http.StatusBadRequest, "missing setId")
	}

	var in models.WorkoutSetUpdateInput
	if err := c.Bind(&in); err != nil {
		return c.String(http.StatusBadRequest, "invalid body")
	}

	ws, err := h.uc.UpdateSet(c.Request().Context(), userID, setID, in)
	if err != nil {
		return c.String(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, ws)
}

func (h *workoutSetController) DeleteSet(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}

	setID := c.Param("setId")
	if setID == "" {
		return c.String(http.StatusBadRequest, "missing setId")
	}

	if err := h.uc.DeleteSet(c.Request().Context(), userID, setID); err != nil {
		return c.String(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}
