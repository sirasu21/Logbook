// backend/controller/todo_controller.go（コピペ）
package controller

import (
	"errors"
	"log"
	"net/http"
	"strings"

	echoSession "github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"

	"github.com/sirasu21/Logbook/backend/models"
	"github.com/sirasu21/Logbook/backend/usecase"
)

type TodoController interface {
	GetTodos(c echo.Context) error
	CreateTodo(c echo.Context) error
	UpdateTodo(c echo.Context) error
	DeleteTodo(c echo.Context) error
}

type todoController struct {
	cfg     models.Config
	usecase usecase.TodoUsecase
}

func NewTodoController(cfg models.Config, u usecase.TodoUsecase) TodoController {
	return &todoController{cfg: cfg, usecase: u}
}


func (ct *todoController) currentUserID(c echo.Context) string {
	if uid, _ := c.Get("userID").(string); uid != "" {
		return uid
	}
	sess, _ := echoSession.Get("session", c)
	sub, _ := sess.Values["sub"].(string)
	return sub
}

func (ct *todoController) GetTodos(c echo.Context) error {
	userID := ct.currentUserID(c)
	if userID == "" {
		return c.String(http.StatusUnauthorized, "unauthorized")
	}
	log.Printf("GetTodos: user=%s", userID)

	todos, err := ct.usecase.ListByUser(c.Request().Context(), userID)
	if err != nil {
		log.Printf("usecase list error: %v", err)
		return c.String(http.StatusInternalServerError, "failed to fetch todos")
	}
	return c.JSON(http.StatusOK, todos)
}

func (ct *todoController) CreateTodo(c echo.Context) error {
	userID := ct.currentUserID(c)
	if userID == "" {
		return c.String(http.StatusUnauthorized, "unauthorized")
	}

	var in struct {
		Content string `json:"content"`
	}
	if err := c.Bind(&in); err != nil {
		return c.String(http.StatusBadRequest, "invalid json")
	}

	t, err := ct.usecase.Create(c.Request().Context(), userID, in.Content)
	if err != nil {
		if strings.Contains(err.Error(), "content is required") ||
			strings.Contains(err.Error(), "content too long") ||
			strings.Contains(err.Error(), "missing user id") {
			return c.String(http.StatusBadRequest, err.Error())
		}
		log.Printf("create todo error: %v", err)
		return c.String(http.StatusInternalServerError, "failed to create")
	}
	return c.JSON(http.StatusCreated, t)
}

func (ct *todoController) UpdateTodo(c echo.Context) error {
	userID := ct.currentUserID(c)
	if userID == "" {
		return c.String(http.StatusUnauthorized, "unauthorized")
	}

	var in struct {
		Content *string `json:"content"`
	}
	if err := c.Bind(&in); err != nil {
		return c.String(http.StatusBadRequest, "invalid json")
	}
	content := ""
	if in.Content != nil {
		content = *in.Content
	}

	t, err := ct.usecase.UpdateContent(c.Request().Context(), userID, c.Param("id"), content)
	if err != nil {
		switch {
		case errors.Is(err, usecase.ErrBadRequest):
			return c.String(http.StatusBadRequest, err.Error())
		case errors.Is(err, usecase.ErrNotFound):
			return c.String(http.StatusNotFound, "not found")
		default:
			log.Printf("update todo error: %v", err)
			return c.String(http.StatusInternalServerError, "failed to update")
		}
	}
	return c.JSON(http.StatusOK, t)
}

func (ct *todoController) DeleteTodo(c echo.Context) error {
	userID := ct.currentUserID(c)
	if userID == "" {
		return c.String(http.StatusUnauthorized, "unauthorized")
	}

	if err := ct.usecase.Delete(c.Request().Context(), userID, c.Param("id")); err != nil {
		switch {
		case errors.Is(err, usecase.ErrBadRequest):
			return c.String(http.StatusBadRequest, err.Error())
		case errors.Is(err, usecase.ErrNotFound):
			return c.String(http.StatusNotFound, "not found")
		default:
			log.Printf("delete todo error: %v", err)
			return c.String(http.StatusInternalServerError, "failed to delete")
		}
	}
	return c.NoContent(http.StatusNoContent)
}