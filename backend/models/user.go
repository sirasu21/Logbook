package models

import "time"

type User struct {
	ID         string    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	LineUserID string    `gorm:"uniqueIndex;size:128;not null"                 json:"lineUserId"`
	Name       *string   `gorm:"size:100"                                      json:"name,omitempty"`
	PictureURL *string   `gorm:"size:2048"                                     json:"picture,omitempty"`
	Email      *string   `gorm:"size:255"                                      json:"email,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}
