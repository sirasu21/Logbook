package main

import (
	"fmt"
	"log"

	"github.com/sirasu21/Logbook/backend/db"
	"github.com/sirasu21/Logbook/backend/models"
)

func main() {
	dbConn := db.InitDB()
	defer db.CloseDB(dbConn)

	// グローバル種目のシードデータ
	exercises := []models.Exercise{
		{
			ID:            "5638ccdd-71da-4977-a53b-bc21afa04b6c",
			OwnerUserID:   nil,
			Name:          "デッドリフト",
			Type:          models.ExerciseTypeStrength,
			PrimaryMuscle: stringPtr("背中"),
			IsActive:      true,
		},
		{
			ID:            "6e1ee985-7bbe-45d6-b4c6-d2f7892ded8d",
			OwnerUserID:   nil,
			Name:          "ベンチプレス",
			Type:          models.ExerciseTypeStrength,
			PrimaryMuscle: stringPtr("胸"),
			IsActive:      true,
		},
		{
			ID:            "b9d17a4f-20ba-4983-88fb-2fefe713e132",
			OwnerUserID:   nil,
			Name:          "ラットプルダウン",
			Type:          models.ExerciseTypeStrength,
			PrimaryMuscle: stringPtr("背中"),
			IsActive:      true,
		},
		{
			ID:            "d2aa8df7-d422-4f87-b103-dd10ef9b1838",
			OwnerUserID:   nil,
			Name:          "ショルダープレス",
			Type:          models.ExerciseTypeStrength,
			PrimaryMuscle: stringPtr("肩"),
			IsActive:      true,
		},
		{
			ID:            "de1ed478-9973-4c7c-b623-f4562f11e29e",
			OwnerUserID:   nil,
			Name:          "バックスクワット",
			Type:          models.ExerciseTypeStrength,
			PrimaryMuscle: stringPtr("脚"),
			IsActive:      true,
		},
	}

	// 各種目をシード（既存の場合はスキップ）
	for _, exercise := range exercises {
		result := dbConn.Where(models.Exercise{ID: exercise.ID}).FirstOrCreate(&exercise)
		if result.Error != nil {
			log.Fatalf("Failed to seed exercise %s: %v", exercise.Name, result.Error)
		}
		if result.RowsAffected > 0 {
			fmt.Printf("✓ Created exercise: %s (ID: %s)\n", exercise.Name, exercise.ID)
		} else {
			fmt.Printf("- Exercise already exists: %s (ID: %s)\n", exercise.Name, exercise.ID)
		}
	}

	fmt.Println("\nSeed completed successfully!")
}

// stringPtr はstring値のポインタを返すヘルパー関数
func stringPtr(s string) *string {
	return &s
}

