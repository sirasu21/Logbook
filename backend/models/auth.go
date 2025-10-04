package models

type TokenResponse struct {
    AccessToken  string `json:"access_token"`
    IDToken      string `json:"id_token"`
    TokenType    string `json:"token_type"`
    ExpiresIn    int    `json:"expires_in"`
    Scope        string `json:"scope"`
    RefreshToken string `json:"refresh_token"`
}

type Profile struct {
    UserID        string `json:"userId"`
    DisplayName   string `json:"displayName"`
    PictureURL    string `json:"pictureUrl"`
    StatusMessage string `json:"statusMessage"`
}

type Session struct {
    Sub     string `json:"sub"`
    Name    string `json:"name"`
    Picture string `json:"picture"`
    Status  string `json:"status"`
    Exp     int64  `json:"exp"`
}