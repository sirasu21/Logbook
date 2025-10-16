# バックエンド改善ガイド（リファクタ / セキュリティ）

本ドキュメントは、Logbook バックエンドの「新機能追加」よりも「リファクタ」と「セキュリティ強化」にフォーカスした具体的な改善提案をまとめたものです。優先度と実装のヒント、影響範囲、参考コードを併記します。

---

## 優先度の高い改善（Quick Wins）

- セッションキーを固定文字列から秘密値に変更（HMAC/暗号化キー分離）
- ログイン成功時のセッション再生成（Session Fixation対策）
- CSRF 対策ミドルウェア導入（状態変更系の保護）
- LINE API 呼び出しの HTTP タイムアウト設定
- `.env` に含まれる機密の見直し（リポジトリから除外/ローテーション）
- Cookie の `Secure` を環境に応じて切替（Devでも可能ならHTTPS）
- エラーハンドラの統一（レスポンス形式の標準化と情報漏えい防止）

---

## セッション管理の強化

対象: `backend/router/router.go:1`, `backend/controller/user_controller.go:1`, `backend/models/config.go:1`

- キー管理
  - いま `sessions.NewCookieStore([]byte("super-secret-key"))` で固定文字列を使用。
  - 対応: `cfg.SessionSecret` から「署名鍵（authKey）」と「暗号鍵（encKey）」を導出・分離。
  - 可能なら `APP_SESSION_AUTH_KEY` と `APP_SESSION_ENC_KEY` を別々に管理。

- オプション
  - `HttpOnly`/`Secure`/`SameSite=None`/`MaxAge` は既に設定済み。ローカル開発での `Secure` は HTTPS が前提（SameSite=NoneはSecure必須）。
  - 本番のみ `Secure=true` を強制し、開発時は HTTPS で動かすか、一時的に `SameSite=Lax` 運用も検討。

- Fixation対策
  - ログイン成功後、旧セッションを `MaxAge=-1; Save()` で破棄→新セッションでID再発行してから `user_id` 等をセット。

参考コード（例: routerのCookieStore生成）:

```go
// router.go（概略）
import (
    "crypto/sha256"
    "github.com/gorilla/sessions"
    // ...
)

func NewRouter(cfg models.Config, /* ... */) *echo.Echo {
    // 派生鍵（例：1つのSecretから暗号鍵を導出）
    authKey := []byte(cfg.SessionSecret) // 32バイト以上推奨
    encKeyBytes := sha256.Sum256([]byte(cfg.SessionSecret + ":enc"))

    store := sessions.NewCookieStore(authKey, encKeyBytes[:])
    store.Options = &sessions.Options{
        Path:     "/",
        HttpOnly: true,
        Secure:   true,           // devは要HTTPS
        SameSite: http.SameSiteNoneMode,
        MaxAge:   86400,
    }
    // ...
}
```

参考コード（例: ログイン時の再生成）:

```go
// user_controller.go（概略: LineCallback成功時）
old, _ := echoSession.Get("session", c)
old.Options.MaxAge = -1
_ = old.Save(c.Request(), c.Response())

sess, _ := echoSession.Get("session", c) // 新セッション
sess.Values["sub"] = prof.UserID
sess.Values["user_id"] = user.ID
sess.Values["name"] = user.Name
sess.Values["picture"] = user.PictureURL
_ = sess.Save(c.Request(), c.Response())
```

---

## CSRF 対策

対象: `backend/router/router.go:1`

- Echo の `middleware.CSRFWithConfig` を導入（Double Submit Cookie方式）。
- フロントは Cookie から `csrf` トークンを読み、`X-CSRF-Token` ヘッダに付与。
- CORS の `AllowHeaders` に `X-CSRF-Token` を追加。

参考コード:

```go
e.Use(middleware.CSRFWithConfig(middleware.CSRFConfig{
    TokenLookup:  "header:X-CSRF-Token",
    CookieName:   "csrf_token",
    CookiePath:   "/",
    CookieSecure: true, // 本番はtrue
    // CookieSameSite: http.SameSiteLaxMode, // cross-site要件に応じて調整
}))

// 既存のCORSに追加
AllowHeaders: []string{"Content-Type", "Authorization", "X-CSRF-Token"},
```

---

## セキュアヘッダ / レート制限 / サイズ制限

対象: `backend/router/router.go:1`

- ヘッダ強化
  - `middleware.Secure()` を有効化（X-Frame-Options, X-Content-Type-Options 等）。
  - 必要に応じて CSP（Content-Security-Policy）も追加検討。

- リクエスト制限
  - `middleware.BodyLimit("1M")` などで過大ボディを抑止。
  - `/api/auth/line/login` / `/api/auth/line/callback` にレート制限（連続アタック対策）。

---

## LINE OAuth/外部通信の堅牢化

対象: `backend/repository/user_repository.go:1`

- HTTP クライアントにタイムアウトを設定（例: `Timeout: 10 * time.Second`）。
- 今後 `id_token` を扱う場合は `nonce` 検証・署名検証を実装。
- ネットワーク/JSONエラーは内部ログに留め、クライアントへは一般化したメッセージを返却。

参考コード:

```go
httpClient := &http.Client{ Timeout: 10 * time.Second }
authRepo := repository.NewLineAuthRepository(httpClient, gdb)
```

---

## エラーハンドリングの標準化

対象: `backend/router/router.go:1` もしくは `backend/cmd/api/main.go:1`

- Echo の `HTTPErrorHandler` を差し替え、統一レスポンス `{ code, message, requestId }` を返却。
- 内部エラーの詳細はログにのみ残し、外向けは簡潔な文言に。

参考コード（概略）:

```go
e.HTTPErrorHandler = func(err error, c echo.Context) {
    code := http.StatusInternalServerError
    msg := http.StatusText(code)
    if he, ok := err.(*echo.HTTPError); ok {
        code = he.Code
        if s, ok := he.Message.(string); ok { msg = s }
    }
    rid := c.Response().Header().Get(echo.HeaderXRequestID)
    _ = c.JSON(code, map[string]any{"code": code, "message": msg, "requestId": rid})
}
```

---

## 入力バリデーション

対象: `backend/controller/*_controller.go:1`, `backend/usecase/*.go:1`

- `go-playground/validator` の導入を検討。`binding + validate` のパターンに統一。
- 代表例
  - UUID 形式検証（`exerciseId`, `id` 等）
  - `RPE` は `0..10` 範囲
  - 日付の整合性（`from <= to` など）

---

## 認証ミドルウェアの共通化

対象: `backend/controller/*.go:1`, `backend/router/router.go:1`

- 各コントローラの `currentUserID` を削除し、共通ミドルウェアで `userID` を `Context` にセット。
- ルーター側で `/api` グループに `RequireAuth` を適用し、401 の共通処理を実装。

---

## 取引（トランザクション）

対象: `backend/usecase/workouts_usecase.go:1`, `backend/repository/*.go:1`

- ワークアウト削除（本体 + セット全削除）は DB トランザクションで一貫性確保。
- リポジトリに `WithTx(tx *gorm.DB)` を追加するか、ユースケース層で `db.Transaction()` を使用できる設計へ調整。

---

## リポジトリ更新の明確化（NULL の扱い）

対象: `backend/repository/bodyMetric_repository.go:1`, `backend/repository/exercise_repository.go:1`

- `map[string]any` + ポインタの組み合わせは NULL/ゼロ値の意図が曖昧になりやすい。
- 方針例
  - `sql.Null*` 系の利用
  - 更新専用の DTO を `Select()` と組み合わせて明示更新
  - `gorm.Expr("NULL")` を使い、`NULL` にする操作を明示

---

## 設定と初期化の整理

対象: `backend/db/db.go:1`, `backend/cmd/api/main.go:1`, `backend/bot/client.go:1`

- `db.InitDB()` 内で `godotenv.Load()` を呼ばず、エントリポイントでのみ環境変数を読む。
- `bot.LoadConfig()` を `config` パッケージとして切り出し、設定取得の責務を一本化。

---

## ロギング/監査

- リクエストID と関連づけた構造化ログ（JSON）を出力。
- LINE のアクセストークン/認可コードなど機密はログ出力しない（マスク/除外）。

---

## 秘密情報の取り扱い

対象: `backend/.env:1`

- 実値がコミットされているため「即時ローテーション」を推奨。
- リポジトリには `.env.example` のみを残し、本番/開発の実値は別のシークレットストアやローカル環境で管理。

---

## DB 制約・インデックス（推奨SQL）

- 一意制約

```sql
-- Exercises: グローバル名一意（owner_user_id IS NULL）
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS exercises_global_name_uq
  ON exercises (name) WHERE owner_user_id IS NULL;

-- Exercises: ユーザー独自の (owner_user_id, name) 一意
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS exercises_owned_name_uq
  ON exercises (owner_user_id, name) WHERE owner_user_id IS NOT NULL;

-- BodyMetrics: 同一時刻の重複登録防止
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS body_metrics_user_measured_at_uq
  ON body_metrics (user_id, measured_at);
```

- 性能インデックス

```sql
-- Workouts 一覧
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workouts_user_started
  ON workouts (user_id, started_at DESC);

-- WorkoutSets の並び
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workout_sets_workout_order
  ON workout_sets (workout_id, set_index);
```

- 外部キー（必要に応じて明示付与）

```sql
ALTER TABLE workouts
  ADD CONSTRAINT workouts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE workout_sets
  ADD CONSTRAINT workout_sets_workout_id_fkey
  FOREIGN KEY (workout_id) REFERENCES workouts(id);

ALTER TABLE workout_sets
  ADD CONSTRAINT workout_sets_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id);

ALTER TABLE exercises
  ADD CONSTRAINT exercises_owner_user_id_fkey
  FOREIGN KEY (owner_user_id) REFERENCES users(id);

ALTER TABLE body_metrics
  ADD CONSTRAINT body_metrics_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id);
```

---

## Dev/Prod 差分の運用指針

- 本番: `Secure=true` + `SameSite=None` を強制（フロント別オリジン前提）。
- 開発: 可能ならローカルでも HTTPS を導入。難しければ、同一オリジンでの開発や `SameSite=Lax` の暫定運用を検討。

---

## 実装タスク（チェックリスト）

- [ ] CookieStore を `SessionSecret` 起点の鍵に変更（HMAC/ENC 分離）
- [ ] ログイン成功時のセッション再生成（Fixation対策）
- [ ] CSRF ミドルウェア導入 + `X-CSRF-Token` を CORS に追加
- [ ] HTTP クライアントにタイムアウト設定（LINE API）
- [ ] エラーハンドラの統一と情報最小化
- [ ] `RequireAuth` ミドルウェアの追加・適用
- [ ] トランザクション対応（ワークアウト削除などの複合操作）
- [ ] 更新時の NULL/ゼロ値扱いの明確化（DTO/Null型/Expr）
- [ ] 設定読み出しの責務整理（dotenv読み出しの集約）
- [ ] 重要インデックス/制約の適用（SQL）
- [ ] 機密情報のローテーションと `.env.example` 運用徹底

---

## 参考

- ルーター: `backend/router/router.go:1`
- コントローラ: `backend/controller/*.go:1`
- ユースケース: `backend/usecase/*.go:1`
- リポジトリ: `backend/repository/*.go:1`
- モデル: `backend/models/*.go:1`

このリストから進めたい項目があれば、具体的なパッチ提案（差分）を用意します。
