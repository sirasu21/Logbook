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

type BodyMetricController interface {
	List(c echo.Context) error
	Create(c echo.Context) error
	Update(c echo.Context) error
	Delete(c echo.Context) error
}

type bodyMetricController struct {
	cfg models.Config
	uc  usecase.BodyMetricUsecase
}

func NewBodyMetricController(cfg models.Config, uc usecase.BodyMetricUsecase) BodyMetricController {
	return &bodyMetricController{cfg: cfg, uc: uc}
}

func (h *bodyMetricController) currentUserID(c echo.Context) string {
	if uid, _ := c.Get("userID").(string); uid != "" {
		return uid
	}
	sess, _ := echoSession.Get("session", c)
	if v, _ := sess.Values["userId"].(string); v != "" {
		return v
	}
	if sub, _ := sess.Values["user_id"].(string); sub != "" {
		return sub
	}
	return ""
}

func (h *bodyMetricController) parseRFC3339Ptr(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (h *bodyMetricController) List(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}

	from, err := h.parseRFC3339Ptr(c.QueryParam("from"))
	if err != nil {
		return c.String(http.StatusBadRequest, "invalid from")
	}
	to, err := h.parseRFC3339Ptr(c.QueryParam("to"))
	if err != nil {
		return c.String(http.StatusBadRequest, "invalid to")
	}

	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	offset, _ := strconv.Atoi(c.QueryParam("offset"))

	out, err := h.uc.List(c.Request().Context(), userID, usecase.BodyMetricListInput{
		From:   from,
		To:     to,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return c.String(http.StatusInternalServerError, err.Error())
	}
	return c.JSON(http.StatusOK, out)
}

func (h *bodyMetricController) Create(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}
	var in usecase.CreateBodyMetricInput
	if err := c.Bind(&in); err != nil {
		return c.String(http.StatusBadRequest, "invalid body")
	}
	m, err := h.uc.Create(c.Request().Context(), userID, in)
	if err != nil {
		return c.String(http.StatusBadRequest, err.Error())
	}
	return c.JSON(http.StatusCreated, m)
}

func (h *bodyMetricController) Update(c echo.Context) error {
	userID := h.currentUserID(c)
	if userID == "" {
		return c.NoContent(http.StatusUnauthorized)
	}
	id := c.Param("id")
	var in usecase.UpdateBodyMetricInput
	if err := c.Bind(&in); err != nil {
		return c.String(http.StatusBadRequest, "invalid body")
	}
	m, err := h.uc.Update(c.Request().Context(), userID, id, in)
	if err != nil {
		return c.NoContent(http.StatusNotFound) // 自分のデータ以外 or 無い
	}
	return c.JSON(http.StatusOK, m)
}

func (h *bodyMetricController) Delete(c echo.Context) error {
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