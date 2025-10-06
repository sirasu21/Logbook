package router

import (
	"log"
	"net/http"
	"strings"

	"github.com/gorilla/sessions"
	echoSession "github.com/labstack/echo-contrib/session"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/sirasu21/Logbook/backend/controller"
	"github.com/sirasu21/Logbook/backend/models"
	"gorm.io/gorm"
)


    func NewRouter(cfg models.Config, gdb *gorm.DB, todoCtl controller.TodoController, userCtl controller.UserController, workoutCtl controller.WorkoutController, workoutSetCtl controller.WorkoutSetController) *echo.Echo {
        e := echo.New()
        store := sessions.NewCookieStore([]byte("super-secret-key")) 
	    store.Options = &sessions.Options{
		Path:     "/",
		HttpOnly: true,
		Secure:   true, 
		SameSite: http.SameSiteNoneMode,
		MaxAge: 86400, 
	    }
	    e.Use(echoSession.Middleware(store))
        e.HideBanner = true

        e.Pre(middleware.RemoveTrailingSlash())
        e.Use(middleware.Recover())
        e.Use(middleware.RequestID())

        e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
            AllowOrigins:     []string{cfg.FrontendOrigin},
            AllowMethods:     []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
            AllowHeaders:     []string{"Content-Type", "Authorization", "X-Debug-User"},
            AllowCredentials: true,
        }))

        

        e.GET("/healthz", userCtl.Healthz)
        e.GET("/api/auth/line/login",    userCtl.LineLogin)
        e.GET("/api/auth/line/callback", userCtl.LineCallback)


        

        api := e.Group("/api")
        api.GET("/me", userCtl.Me)

        // authが必要
        api.GET("/todos", todoCtl.GetTodos)
        api.POST("/todos", todoCtl.CreateTodo)
        api.PUT("/todos/:id",  todoCtl.UpdateTodo)
        api.DELETE("/todos/:id", todoCtl.DeleteTodo)

        api.POST("/workouts", workoutCtl.CreateWorkout)
        api.PATCH("/workouts/:id/end", workoutCtl.EndWorkout) 
        api.GET("/workouts", workoutCtl.ListWorkouts)
        api.GET("/workouts/:id", workoutCtl.GetWorkout)
        api.GET("/workouts/:id/detail", workoutCtl.GetWorkoutDetail)

        // 既存の api := e.Group("/api") の下あたりに追記
        api.POST("/workouts/:workoutId/sets", workoutSetCtl.AddSet)
        api.PATCH("/workout_sets/:setId",     workoutSetCtl.UpdateSet)
        api.DELETE("/workout_sets/:setId",    workoutSetCtl.DeleteSet)
        

        e.GET("/api/logout", userCtl.Logout)

        e.Any("/*", func(c echo.Context) error {
            if strings.HasPrefix(c.Request().URL.Path, "/api/") {
                return echo.NewHTTPError(http.StatusNotFound, "not found")
            }
            target := cfg.FrontendOrigin + "/"
            log.Printf("fallback '/': redirecting to %s", target)
            return c.Redirect(http.StatusFound, target)
        })

        return e
    }
