package models

import "time"

type Todo struct {
  ID         uint      `gorm:"primaryKey" json:"id"`
  LineUserID string    `gorm:"index" json:"lineUserId"`
  Content    string    `json:"content"`
  CreatedAt  time.Time `json:"createdAt"`
  UpdatedAt  time.Time `json:"updatedAt"`
}