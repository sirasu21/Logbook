package controller

import (
	"net/http"
	"strconv"
	"time"

	echoSession "github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"

	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/usecase"
)

type WorkoutController interface {
	CreateWorkout(c echo.Context) error
	EndWorkout(c echo.Context) error
	ListWorkouts(c echo.Context) error
	GetWorkout(c echo.Context) error
	GetWorkoutDetail(c echo.Context) error
	UpdateWorkout(c echo.Context) error
	DeleteWorkout(c echo.Context) error
}

type workoutController struct {
	cfg models.Config
	uc  usecase.WorkoutUsecase
}

func NewWorkoutController(cfg models.Config, uc usecase.WorkoutUsecase) WorkoutController {
	return &workoutController{cfg: cfg, uc: uc}
}

func (h *workoutController) currentUserID(c echo.Context) string {
	if uid, _ := c.Get("userID").(string); uid != "" {
		return uid
	}
	sess, _ := echoSession.Get("session", c)
	sub, _ := sess.Values["user_id"].(string)
	return sub
}

func (h *workoutController) CreateWorkout(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized) // 401
	}

	var in models.CreateWorkoutInput
	if err := c.Bind(&in); err != nil {
		return c.String(http.StatusBadRequest, "invalid body") // 400
	}

	w, err := h.uc.Create(c.Request().Context(), userID, in)
	if err != nil {
		// 将来はエラー種別で 400/500 を出し分け
		return c.String(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusCreated, w) // 201
}

// backend/controller/workout_controller.go
func (h *workoutController) EndWorkout(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}

	workoutID := c.Param("id") // /api/workouts/:id/end みたいなルート想定
	if workoutID == "" {
		return c.String(http.StatusBadRequest, "missing workout ID")
	}

	var in struct {
		EndedAt time.Time `json:"endedAt"`
	}
	if err := c.Bind(&in); err != nil {
		return c.String(http.StatusBadRequest, "invalid body")
	}
	if in.EndedAt.IsZero() {
		in.EndedAt = time.Now()
	}

	w, err := h.uc.End(c.Request().Context(), workoutID, userID, in.EndedAt)
	if err != nil {
		return c.String(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, w)
}

func (h *workoutController) ListWorkouts(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}

	var (
		fromStr   = c.QueryParam("from")
		toStr     = c.QueryParam("to")
		limitStr  = c.QueryParam("limit")
		offsetStr = c.QueryParam("offset")
	)

	var fromPtr, toPtr *time.Time
	if fromStr != "" {
		t, err := time.Parse(time.RFC3339, fromStr)
		if err != nil {
			return c.String(http.StatusBadRequest, "invalid 'from' (RFC3339)")
		}
		fromPtr = &t
	}
	if toStr != "" {
		t, err := time.Parse(time.RFC3339, toStr)
		if err != nil {
			return c.String(http.StatusBadRequest, "invalid 'to' (RFC3339)")
		}
		toPtr = &t
	}
	limit := 20
	offset := 0
	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err != nil || v < 1 || v > 200 {
			return c.String(http.StatusBadRequest, "invalid 'limit'")
		} else {
			limit = v
		}
	}
	if offsetStr != "" {
		if v, err := strconv.Atoi(offsetStr); err != nil || v < 0 {
			return c.String(http.StatusBadRequest, "invalid 'offset'")
		} else {
			offset = v
		}
	}
	if fromPtr != nil && toPtr != nil && fromPtr.After(*toPtr) {
		return c.String(http.StatusBadRequest, "'from' must be <= 'to'")
	}

	items, total, err := h.uc.ListByUser(
		c.Request().Context(),
		userID,
		usecase.WorkoutListFilter{From: fromPtr, To: toPtr, Limit: limit, Offset: offset},
	)
	if err != nil {
		return c.String(http.StatusInternalServerError, err.Error())
	}

	type response struct {
		Items  []models.Workout `json:"items"`
		Total  int              `json:"total"`
		Limit  int              `json:"limit"`
		Offset int              `json:"offset"`
	}
	return c.JSON(http.StatusOK, response{
		Items: items, Total: total, Limit: limit, Offset: offset,
	})
}

// GET /api/workouts/:id
func (h *workoutController) GetWorkout(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}
	id := c.Param("id")
	if id == "" {
		return c.String(http.StatusBadRequest, "missing id")
	}

	w, err := h.uc.GetDetail(c.Request().Context(), userID, id)
	if err != nil {
		if usecase.IsNotFound(err) {
			return c.NoContent(http.StatusNotFound)
		}
		return c.String(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, w)
}

func (h *workoutController) GetWorkoutDetail(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}
	workoutID := c.Param("id")
	if workoutID == "" {
		return c.String(http.StatusBadRequest, "missing id")
	}

	detail, err := h.uc.GetDetail(c.Request().Context(), userID, workoutID)
	if err != nil {
		// gorm.ErrRecordNotFound や forbidden 相当なら 404/403 に振り分けてもOK
		return c.String(http.StatusNotFound, "not found")
	}
	return c.JSON(http.StatusOK, detail)
}

func (h *workoutController) UpdateWorkout(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}
	workoutID := c.Param("id")
	if workoutID == "" {
		return c.String(http.StatusBadRequest, "missing id")
	}
	var in models.UpdateWorkoutInput
	if err := c.Bind(&in); err != nil {
		return c.String(http.StatusBadRequest, "invalid body")
	}
	w, err := h.uc.Update(c.Request().Context(), workoutID, userID, in)
	if err != nil {
		if usecase.IsNotFound(err) {
			return c.NoContent(http.StatusNotFound)
		}
		return c.String(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, w)
}

func (h *workoutController) DeleteWorkout(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}
	workoutID := c.Param("id")
	if workoutID == "" {
		return c.String(http.StatusBadRequest, "missing id")
	}
	if err := h.uc.Delete(c.Request().Context(), workoutID, userID); err != nil {
		if usecase.IsNotFound(err) {
			return c.NoContent(http.StatusNotFound)
		}
		return c.String(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}
