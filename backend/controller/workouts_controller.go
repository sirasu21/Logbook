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
	userID, ok := h.requireUserID(c)
	if !ok {
		return nil
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
	userID, ok := h.requireUserID(c)
	if !ok {
		return nil
	}

	workoutID, ok := requirePathID(c, "id", "missing workout ID")
	if !ok {
		return nil
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
	userID, ok := h.requireUserID(c)
	if !ok {
		return nil
	}

	filter, ok := parseListFilter(c)
	if !ok {
		return nil
	}

	items, total, err := h.uc.ListByUser(
		c.Request().Context(),
		userID,
		filter,
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
		Items: items, Total: total, Limit: filter.Limit, Offset: filter.Offset,
	})
}

func (h *workoutController) GetWorkoutDetail(c echo.Context) error {
	userID, ok := h.requireUserID(c)
	if !ok {
		return nil
	}
	workoutID, ok := requirePathID(c, "id", "missing id")
	if !ok {
		return nil
	}

	detail, err := h.uc.GetDetail(c.Request().Context(), userID, workoutID)
	if err != nil {
		// gorm.ErrRecordNotFound や forbidden 相当なら 404/403 に振り分けてもOK
		return c.String(http.StatusNotFound, "not found")
	}
	return c.JSON(http.StatusOK, detail)
}

func (h *workoutController) UpdateWorkout(c echo.Context) error {
	userID, ok := h.requireUserID(c)
	if !ok {
		return nil
	}
	workoutID, ok := requirePathID(c, "id", "missing id")
	if !ok {
		return nil
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
	userID, ok := h.requireUserID(c)
	if !ok {
		return nil
	}
	workoutID, ok := requirePathID(c, "id", "missing id")
	if !ok {
		return nil
	}
	if err := h.uc.Delete(c.Request().Context(), workoutID, userID); err != nil {
		if usecase.IsNotFound(err) {
			return c.NoContent(http.StatusNotFound)
		}
		return c.String(http.StatusInternalServerError, err.Error())
	}
	return c.NoContent(http.StatusNoContent)
}

// Shared helpers ------------------------------------------------------------

func (h *workoutController) requireUserID(c echo.Context) (string, bool) {
	userID := h.currentUserID(c)
	if userID == "" {
		c.NoContent(http.StatusUnauthorized)
		return "", false
	}
	return userID, true
}

func requirePathID(c echo.Context, key string, missingMsg string) (string, bool) {
	id := c.Param(key)
	if id == "" {
		c.String(http.StatusBadRequest, missingMsg)
		return "", false
	}
	return id, true
}

func parseListFilter(c echo.Context) (usecase.WorkoutListFilter, bool) {
	var filter usecase.WorkoutListFilter

	if v := c.QueryParam("from"); v != "" {
		tp, err := time.Parse(time.RFC3339, v)
		if err != nil {
			c.String(http.StatusBadRequest, "invalid 'from' (RFC3339)")
			return filter, false
		}
		filter.From = &tp
	}
	if v := c.QueryParam("to"); v != "" {
		tp, err := time.Parse(time.RFC3339, v)
		if err != nil {
			c.String(http.StatusBadRequest, "invalid 'to' (RFC3339)")
			return filter, false
		}
		filter.To = &tp
	}
	if filter.From != nil && filter.To != nil && filter.From.After(*filter.To) {
		c.String(http.StatusBadRequest, "'from' must be <= 'to'")
		return filter, false
	}

	filter.Limit = 20
	filter.Offset = 0

	if v := c.QueryParam("limit"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed < 1 || parsed > 200 {
			c.String(http.StatusBadRequest, "invalid 'limit'")
			return filter, false
		}
		filter.Limit = parsed
	}

	if v := c.QueryParam("offset"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed < 0 {
			c.String(http.StatusBadRequest, "invalid 'offset'")
			return filter, false
		}
		filter.Offset = parsed
	}

	return filter, true
}
