package db

import (
	"fmt"
	"log"
	"os"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func getenvD(k, def string) string {
    v := strings.TrimSpace(os.Getenv(k))
    if v == "" {
        return def
    }
    return v
}

func InitDB() *gorm.DB {
    // 環境変数から DSN 組み立て
    host := getenvD("PGHOST", "localhost")
    port := getenvD("PGPORT", "5434") // ← あなたは 5434 にしてね
    user := getenvD("PGUSER", "lineapi")
    pass := os.Getenv("PGPASSWORD")
    name := getenvD("PGDATABASE", "lineapi")
    ssl  := getenvD("PGSSLMODE", "disable")
    tz   := getenvD("TIMEZONE", "Asia/Tokyo")

    dsn := fmt.Sprintf(
        "host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=%s",
        host, user, pass, name, port, ssl, tz,
    )

    gdb, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
    if err != nil {
        log.Fatalf("db open failed: %v", err)
    }

    // // 必要ならマイグレーション（既存テーブルがあるなら不要）
    // if err := gdb.AutoMigrate(&models.Todo{}); err != nil {
    //     log.Fatalf("auto migrate failed: %v", err)
    // }

    return gdb
}