package models

type Config struct {
	ChannelID      string
	ChannelSecret  string
	RedirectURI    string
	FrontendOrigin string
	SessionSecret  string
	Addr           string // e.g., :3000
}
