// backend/main.go（コピペの目安：SCS関連を削除＋ミドルウェア追加は router 側でやるのもOK）
package main

import (
	"net/http"

	"github.com/joho/godotenv"

	"github.com/sirasu21/Logbook/backend/bot"
	controllerLine "github.com/sirasu21/Logbook/backend/controller/LINE"
	controller "github.com/sirasu21/Logbook/backend/controller/web"
	"github.com/sirasu21/Logbook/backend/db"
	repository "github.com/sirasu21/Logbook/backend/repository/web"
	"github.com/sirasu21/Logbook/backend/router"
	"github.com/sirasu21/Logbook/backend/usecase"
)

func main() {
	_ = godotenv.Load()
	cfg := bot.LoadConfig()
	gdb := db.InitDB()
	client := bot.InitLineBot()

	userRepo := repository.NewLineAuthRepository(http.DefaultClient, gdb)
	workoutRepo := repository.NewWorkoutRepository(gdb)
	workoutSetRepo := repository.NewWorkoutSetRepository(gdb)
	exerciseRepo := repository.NewExerciseRepository(gdb)
	bodyMetricRepo := repository.NewBodyMetricRepository(gdb)

	userUC := usecase.NewUserUsecase(userRepo)
	workoutUC := usecase.NewWorkoutUsecase(workoutRepo, workoutSetRepo)
	workoutSetUC := usecase.NewWorkoutSetUsecase(workoutRepo, workoutSetRepo, exerciseRepo)
	exerciseUC := usecase.NewExerciseUsecase(exerciseRepo)
	bodyMetricUC := usecase.NewBodyMetricUsecase(bodyMetricRepo)

	userCtl := controller.NewUserController(cfg, userUC)
	workoutCtl := controller.NewWorkoutController(cfg, workoutUC)
	workoutSetCtl := controller.NewWorkoutSetController(workoutSetUC)
	exerciseCtl := controller.NewExerciseController(cfg, exerciseUC)
	bodyCtl := controller.NewBodyMetricController(cfg, bodyMetricUC)

	lineExerciseCtl := controllerLine.NewLineExerciseController(client, userUC, workoutUC)

	e := router.NewRouter(cfg, gdb, userCtl, workoutCtl, workoutSetCtl, exerciseCtl, bodyCtl, lineExerciseCtl)

	e.Logger.Fatal(e.Start(cfg.Addr))
}
