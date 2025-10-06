package security

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"strings"
)

func RandB64URL(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return B64url(b)
}

func B64url(b []byte) string {
	return strings.TrimRight(base64.URLEncoding.EncodeToString(b), "=")
}

func Sha256Sum(s string) []byte {
	h := sha256.Sum256([]byte(s))
	return h[:]
}
