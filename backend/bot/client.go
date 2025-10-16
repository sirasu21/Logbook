package bot

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"github.com/line/line-bot-sdk-go/linebot"
	"github.com/sirasu21/Logbook/backend/models"
)

func mustEnv(key string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		log.Fatalf("missing required env: %s", key)
	}
	return v
}

func LoadConfig() models.Config {
	addr := os.Getenv("ADDR")
	if strings.TrimSpace(addr) == "" {
		addr = ":3000"
	}
	return models.Config{
		ChannelID:      mustEnv("LINE_CHANNEL_ID"),
		ChannelSecret:  mustEnv("LINE_CHANNEL_SECRET"),
		RedirectURI:    mustEnv("LINE_REDIRECT_URI"),
		FrontendOrigin: mustEnv("APP_FRONTEND_ORIGIN"),
		SessionSecret:  mustEnv("APP_SESSION_SECRET"),
		Addr:           addr,
	}
}

func InitLineBot() *linebot.Client {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env")
	}

	bot, err := linebot.New(
		os.Getenv("LINE_BOT_CHANNEL_SECRET"),
		os.Getenv("LINE_BOT_CHANNEL_TOKEN"),
	)
	if err != nil {
		log.Fatal("LINE bot 初期化失敗:", err)
	}
	return bot
}
