// backend/main.go（コピペの目安：SCS関連を削除＋ミドルウェア追加は router 側でやるのもOK）
package main

import (
	"net/http"

	"github.com/joho/godotenv"

	"github.com/sirasu21/Logbook/backend/bot"
	"github.com/sirasu21/Logbook/backend/controller"
	"github.com/sirasu21/Logbook/backend/db"
	"github.com/sirasu21/Logbook/backend/repository"
	"github.com/sirasu21/Logbook/backend/router"
	"github.com/sirasu21/Logbook/backend/usecase"
)

func main() {
	_ = godotenv.Load()
	cfg := bot.LoadConfig()
	gdb := db.InitDB()

	todoRepo := repository.NewTodoRepository(gdb)
	userRepo := repository.NewLineAuthRepository(http.DefaultClient)
	todoUC := usecase.NewTodoUsecase(todoRepo)
	userUC := usecase.NewUserUsecase(userRepo) 
	todoCtl := controller.NewTodoController(cfg, todoUC)
	userCtl := controller.NewUserController(cfg, userUC)

	e := router.NewRouter(cfg, gdb, todoCtl, userCtl)

	e.Logger.Fatal(e.Start(cfg.Addr))	
}