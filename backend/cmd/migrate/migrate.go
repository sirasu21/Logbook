package main

import (
	"fmt"

	"github.com/sirasu21/Logbook/backend/db"
	"github.com/sirasu21/Logbook/backend/models"
)

func main() {
	dbConn := db.InitDB()
	defer fmt.Println("Successfully Migrated")
	defer db.CloseDB(dbConn)
	dbConn.AutoMigrate(&models.User{}, &models.Exercise{}, &models.Workout{}, &models.WorkoutSet{}, &models.BodyMetric{})
}
