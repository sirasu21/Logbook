# API / Usecase / Interface 設計（ドラフト）

本書は、Web と LINE の両方から共通ロジックを呼び出すことを目的に、エンドポイント一覧と、それを支える層ごとのインターフェイス（Usecase/Repository/Adapter）の設計方針をまとめた要件定義ドキュメントです。ドキュメント駆動で v2 のリファクタを進めるための土台にします。

## 目的と方針

- 入口（Web/LINE）が異なっても、ユースケースは同一（重複コードをなくす）
- 認証・権限をシンプルに：Web は LINE OAuth によるセッション、LINE は Webhook 内で LINE ユーザー ID をアプリ内ユーザー ID へ解決
- I/O（HTTP や LINE イベント）とビジネスロジック（Usecase）を分離し、Repository は DB アクセスに限定
- エラー/レスポンス形式の標準化（後述）

---

## エンドポイント一覧（Web API）

認証が必要なものは「Auth: 必須」。応答は JSON 基本、時間は RFC3339。

- ヘルス

  - GET `/healthz`（Auth: 不要）

- 認証/ユーザー

  - GET `/api/me`（Auth: 必須）
    - 現在ユーザー情報を返却（`userId`, `name`, `picture` など）
  - GET `/api/auth/line/login`（Auth: 不要）
    - LINE 認可へ 302 リダイレクト
  - GET `/api/auth/line/callback`（Auth: 不要）
    - セッション確立後、フロントへ 302 リダイレクト
  - GET `/api/logout`（Auth: 必須）

- Workouts（トレーニングセッション）

  - POST `/api/workouts`（Auth: 必須）
  - PATCH `/api/workouts/:id`（Auth: 必須）
  - PATCH `/api/workouts/:id/end`（Auth: 必須）
  - DELETE `/api/workouts/:id`（Auth: 必須）
  - GET `/api/workouts`（Auth: 必須, クエリ: `from,to,limit,offset`）
  - GET `/api/workouts/:id/detail`（Auth: 必須）

- Workout Sets

  - POST `/api/workouts/:workoutId/sets`（Auth: 必須）
  - PATCH `/api/workout_sets/:setId`（Auth: 必須）
  - DELETE `/api/workout_sets/:setId`（Auth: 必須）

- Exercises（種目）

  - GET `/api/exercises`（Auth: 必須, クエリ: `q,type,onlyMine,limit,offset`）
  - GET `/api/exercises/:id`（Auth: 必須）
  - POST `/api/exercises`（Auth: 必須）
  - PATCH `/api/exercises/:id`（Auth: 必須）
  - DELETE `/api/exercises/:id`（Auth: 必須）

- Body Metrics（体組成）

  - GET `/api/body_metrics`（Auth: 必須, クエリ: `from,to,limit,offset`）
  - POST `/api/body_metrics`（Auth: 必須）
  - PATCH `/api/body_metrics/:id`（Auth: 必須）
  - DELETE `/api/body_metrics/:id`（Auth: 必須）

- LINE Webhook（参考：外部 → 当サーバ）
  - POST `/line/webhook`（検証用の署名必須）
    - Postback/Message（ボタン操作を推奨）を受け、Usecase を呼び出す

---

## 層ごとの責務とインターフェイス

### Adapter 層（HTTP / LINE）

- HTTP（Web）
  - リクエストのバインド/バリデーション/認証チェック
  - Usecase 呼び出しと標準レスポンス/エラー変換
- LINE（Webhook）
  - 署名検証、イベント（Postback/Message）パース
  - LINE の`userId`→ アプリ`userId`へ解決（UserUsecase に依頼）
  - ボタン操作に応じて対応する Usecase を呼び出し、返信を構築

### Usecase 層（アプリケーションロジック）

- 入力 DTO を受け、権限チェック・バリデーション・ドメインルールを適用
- Repository を呼び出して永続化/取得
- 出力 DTO を返却（Adapter 層が最終表現を整形）

### Repository 層（永続化）

- DB/RDB への CRUD を責務とし、Usecase にドメインモデルを返却
- 検索条件/並び/ページングの実装

---

## Usecase インターフェイス（案）

```go
// 認証/ユーザー
type AuthUsecase interface {
    BuildAuthorizeURL(channelID, redirectURI, state, nonce, codeChallenge string) string
    ExchangeCode(ctx context.Context, channelID, channelSecret, redirectURI, code, verifier string) (string, error)
    FetchProfile(ctx context.Context, accessToken string) (models.Profile, error)
    EnsureUserFromLineProfile(ctx context.Context, sub string, displayName, pictureURL, email *string) (*models.User, error)
}

type UserUsecase interface {
    Me(ctx context.Context, userID string) (*models.User, error)
}

// Workouts
type WorkoutUsecase interface {
    Create(ctx context.Context, userID string, in models.CreateWorkoutInput) (*models.Workout, error)
    End(ctx context.Context, workoutID, userID string, endedAt time.Time) (*models.Workout, error)
    Update(ctx context.Context, workoutID, userID string, in models.UpdateWorkoutInput) (*models.Workout, error)
    Delete(ctx context.Context, workoutID, userID string) error
    ListByUser(ctx context.Context, userID string, f WorkoutListFilter) ([]models.Workout, int, error)
    GetDetail(ctx context.Context, userID, workoutID string) (*models.WorkoutDetail, error)
    // 追加（LINE向けボタンフローが必要なら）
    // FindOngoing(ctx context.Context, userID string, source string) (*models.Workout, error)
}

type WorkoutListFilter struct {
    From *time.Time
    To   *time.Time
    Limit, Offset int
}

// Workout Sets
type WorkoutSetUsecase interface {
    AddSet(ctx context.Context, userID, workoutID string, in models.WorkoutSetCreateInput) (*models.WorkoutSet, error)
    UpdateSet(ctx context.Context, userID, setID string, in models.WorkoutSetUpdateInput) (*models.WorkoutSet, error)
    DeleteSet(ctx context.Context, userID, setID string) error
}

// Exercises
type ExerciseUsecase interface {
    List(ctx context.Context, userID string, in ListExercisesInput) (ExerciseListOutput, error)
    Get(ctx context.Context, userID, id string) (*models.Exercise, error)
    Create(ctx context.Context, userID string, in CreateExerciseInput) (*models.Exercise, error)
    Update(ctx context.Context, userID, id string, in UpdateExerciseInput) (*models.Exercise, error)
    Delete(ctx context.Context, userID, id string) error
}

// Body Metrics
type BodyMetricUsecase interface {
    List(ctx context.Context, userID string, in BodyMetricListInput) (BodyMetricListOutput, error)
    Create(ctx context.Context, userID string, in CreateBodyMetricInput) (*models.BodyMetric, error)
    Update(ctx context.Context, userID, id string, in UpdateBodyMetricInput) (*models.BodyMetric, error)
    Delete(ctx context.Context, userID, id string) error
}
```

---

## Repository インターフェイス（案）

```go
// Auth（LINE）
type AuthRepository interface {
    BuildAuthorizeURL(clientID, redirectURI, state, nonce, codeChallenge string) string
    ExchangeCode(ctx context.Context, clientID, clientSecret, redirectURI, code, verifier string) (accessToken string, err error)
    FetchProfile(ctx context.Context, accessToken string) (Profile, error)
    ResolveOrCreateBySub(ctx context.Context, sub string, name, pictureURL, email *string) (*models.User, error)
}

// Workouts
type WorkoutRepository interface {
    Create(ctx context.Context, w *models.Workout) error
    FindByIDForUser(ctx context.Context, workoutID, userID string) (*models.Workout, error)
    UpdateEndedAt(ctx context.Context, workoutID string, endedAt time.Time) (*models.Workout, error)
    FindWorkoutsByUser(ctx context.Context, userID string, q WorkoutQuery) ([]models.Workout, int, error)
    FindByID(ctx context.Context, id string) (*models.Workout, error)
    FindByIDAndUser(ctx context.Context, workoutID, userID string) (*models.Workout, error)
    ListSetsByWorkout(ctx context.Context, workoutID string) ([]models.WorkoutSet, error)
    UpdateWorkoutByIDAndUser(ctx context.Context, workoutID, userID string, values map[string]any) (*models.Workout, error)
    DeleteWorkoutByIDAndUser(ctx context.Context, workoutID, userID string) error
    // Optional: ongoing 検索（LINEフローで使う）
    // FindOngoingBySource(ctx, userID, source string) (*models.Workout, error)
}

type WorkoutQuery struct { From, To *time.Time; Limit, Offset int }

// Workout Sets
type WorkoutSetRepository interface {
    FindByID(ctx context.Context, id string) (*models.WorkoutSet, error)
    Create(ctx context.Context, ws *models.WorkoutSet) error
    Update(ctx context.Context, ws *models.WorkoutSet) error
    Delete(ctx context.Context, id string) error
    DeleteByWorkoutID(ctx context.Context, workoutID string) error
}

// Exercises
type ExerciseRepository interface {
    FindByID(ctx context.Context, id string) (*models.Exercise, error)
    List(ctx context.Context, userID string, f ListExercisesFilter) ([]models.Exercise, int64, error)
    GetByID(ctx context.Context, id string) (*models.Exercise, error)
    Create(ctx context.Context, ex *models.Exercise) error
    UpdateOwned(ctx context.Context, userID, id string, upd UpdateExerciseFields) (*models.Exercise, error)
    DeleteOwned(ctx context.Context, userID, id string) error
}

// Body Metrics
type BodyMetricRepository interface {
    ListByUser(ctx context.Context, userID string, f BodyMetricListFilter) ([]models.BodyMetric, int64, error)
    Create(ctx context.Context, m *models.BodyMetric) error
    UpdateOwned(ctx context.Context, userID, id string, upd UpdateBodyMetricFields) (*models.BodyMetric, error)
    DeleteOwned(ctx context.Context, userID, id string) error
}
```

---

## Adapter の操作（LINE ボタン/ポストバック 例）

- 記録開始: `postback.data = action=start` → Usecase: `WorkoutUsecase.Create(userID, { StartedAt: now })`
- 記録終了: `postback.data = action=end` → Usecase: `WorkoutUsecase.End(workoutID, userID, now)`
- セット追加: `postback.data = action=add_set&exerciseId=...&reps=...&weight=...` → Usecase: `WorkoutSetUsecase.AddSet(...)`
- 今日の記録: `postback.data = action=today` → Usecase: `WorkoutUsecase.ListByUser(userID, { From: today, To: tomorrow })`

（Web からも同じ Usecase を呼ぶため、LINE 固有の整形は Adapter 側で行う）

---

## 標準レスポンス/エラー（方針）

- 成功: データ本体 or `{ items, total, limit, offset }`
- 失敗: `{ code, message, requestId }`
  - `400`: バリデーションエラー
  - `401`: 未認証
  - `403`: 所有権なし
  - `404`: 見つからない
  - `429`: レート制限
  - `5xx`: 内部エラー（詳細はログへ）

---

## バリデーション/認可（方針）

- UUID/数値範囲/日時整合性は Adapter→Usecase の段階で検証
- 認可は「`userID` と対象レコードの所有者一致」を Repository クエリで保証

---

## 補足：共通 DTO（抜粋）

既存 `backend/models/*.go` の JSON タグに準拠。必要に応じて v2 で入力 DTO/出力 DTO を分ける。

- `CreateWorkoutInput`, `UpdateWorkoutInput`
- `WorkoutSetCreateInput`, `WorkoutSetUpdateInput`
- `ListExercisesInput`, `ExerciseListOutput`
- `BodyMetricListInput`, `BodyMetricListOutput`

---

## 付録 A: エンドポイント一覧（表）

認証は「必須/不要/署名」。レスポンスは JSON、日時は RFC3339。

| Method | Path                            | Auth | Request（Body/Query/Path）                             | Response                                | 説明                                                 |
| ------ | ------------------------------- | ---- | ------------------------------------------------------ | --------------------------------------- | ---------------------------------------------------- |
| GET    | `/healthz`                      | 不要 | —                                                      | `ok`                                    | ヘルスチェック                                       |
| GET    | `/api/me`                       | 必須 | —                                                      | `{ provider, userId, name?, picture? }` | 現在ユーザー情報                                     |
| GET    | `/api/auth/line/login`          | 不要 | —                                                      | 302 Redirect                            | LINE 認可へリダイレクト                              |
| GET    | `/api/auth/line/callback`       | 不要 | `?code&state`                                          | 302 Redirect                            | セッション確立 → フロントへ                          |
| GET    | `/api/logout`                   | 必須 | —                                                      | 302 Redirect                            | セッション破棄                                       |
| POST   | `/api/workouts`                 | 必須 | Body: `{ startedAt, note? }`                           | `Workout`                               | ワークアウト作成                                     |
| PATCH  | `/api/workouts/:id`             | 必須 | Body: `{ startedAt?, endedAt?, note? }`                | `Workout`                               | 更新                                                 |
| PATCH  | `/api/workouts/:id/end`         | 必須 | Body: `{ endedAt? }`                                   | `Workout`                               | 終了時間を設定                                       |
| DELETE | `/api/workouts/:id`             | 必須 | —                                                      | 204                                     | 削除（本人のみ）                                     |
| GET    | `/api/workouts`                 | 必須 | Query: `from?,to?,limit?,offset?`                      | `{ items[], total, limit, offset }`     | 一覧（本人）                                         |
| GET    | `/api/workouts/:id/detail`      | 必須 | —                                                      | `{ workout, sets[] }`                   | 詳細（本人）                                         |
| POST   | `/api/workouts/:workoutId/sets` | 必須 | Body: `WorkoutSetCreateInput`                          | `WorkoutSet`                            | セット追加                                           |
| PATCH  | `/api/workout_sets/:setId`      | 必須 | Body: `WorkoutSetUpdateInput`                          | `WorkoutSet`                            | セット更新                                           |
| DELETE | `/api/workout_sets/:setId`      | 必須 | —                                                      | 204                                     | セット削除                                           |
| GET    | `/api/exercises`                | 必須 | Query: `q?,type?,onlyMine?,limit?,offset?`             | `{ items[], total, limit, offset }`     | 種目一覧（可視範囲）                                 |
| GET    | `/api/exercises/:id`            | 必須 | —                                                      | `Exercise`                              | 取得（可視範囲）                                     |
| POST   | `/api/exercises`                | 必須 | Body: `{ name, type, primaryMuscle? }`                 | `Exercise`                              | 自分の独自種目作成                                   |
| PATCH  | `/api/exercises/:id`            | 必須 | Body: `{ name?, type?, primaryMuscle?, isActive? }`    | `Exercise`                              | 自分の独自種目更新                                   |
| DELETE | `/api/exercises/:id`            | 必須 | —                                                      | 204                                     | 自分の独自種目削除                                   |
| GET    | `/api/body_metrics`             | 必須 | Query: `from?,to?,limit?,offset?`                      | `{ items[], total, limit, offset }`     | 体組成一覧（本人）                                   |
| POST   | `/api/body_metrics`             | 必須 | Body: `{ measuredAt, weightKg, bodyFatPct?, note? }`   | `BodyMetric`                            | 体組成作成                                           |
| PATCH  | `/api/body_metrics/:id`         | 必須 | Body: `{ measuredAt?, weightKg?, bodyFatPct?, note? }` | `BodyMetric`                            | 体組成更新                                           |
| DELETE | `/api/body_metrics/:id`         | 必須 | —                                                      | 204                                     | 体組成削除                                           |
| POST   | `/line/webhook`                 | 署名 | LINE 署名ヘッダ                                        | 200/204                                 | ボタン/メッセージ受付（Adapter で Usecase 呼び出し） |

---

## 付録 B: Usecase メソッド詳細（表）

| Area              | Method                    | 目的                                      | 入力                                                                       | 出力                                                | 主なエラー/注意      |
| ----------------- | ------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- | -------------------- |
| AuthUsecase       | BuildAuthorizeURL         | LINE 認可 URL を生成                      | `channelID, redirectURI, state, nonce, codeChallenge`                      | URL 文字列                                          | —                    |
| AuthUsecase       | ExchangeCode              | 認可コード → アクセストークン交換（PKCE） | `channelID, channelSecret, redirectURI, code, verifier`                    | `accessToken`                                       | 通信/4xx/5xx         |
| AuthUsecase       | FetchProfile              | LINE プロフィール取得                     | `accessToken`                                                              | `models.Profile{ userId, displayName, pictureUrl }` | 通信/認可エラー      |
| AuthUsecase       | EnsureUserFromLineProfile | `line_user_id` で Upsert                  | `sub, displayName?, pictureURL?, email?`                                   | `*models.User`                                      | DB エラー            |
| UserUsecase       | Me                        | 現在ユーザー情報を返却                    | `userID`                                                                   | `*models.User`                                      | NotFound 可          |
| WorkoutUsecase    | Create                    | 本人のワークアウト作成                    | `userID`, `CreateWorkoutInput{ startedAt, note? }`                         | `*Workout`                                          | `startedAt` 必須     |
| WorkoutUsecase    | End                       | 終了時刻の設定                            | `workoutID`, `userID`, `endedAt`                                           | `*Workout`                                          | 権限なし/存在しない  |
| WorkoutUsecase    | Update                    | 部分更新                                  | `workoutID`, `userID`, `UpdateWorkoutInput{ startedAt?, endedAt?, note? }` | `*Workout`                                          | NotFound/NULL 扱い   |
| WorkoutUsecase    | Delete                    | 本人レコード削除                          | `workoutID`, `userID`                                                      | `error`                                             | NotFound             |
| WorkoutUsecase    | ListByUser                | 本人一覧（期間/ページング）               | `userID`, `WorkoutListFilter{ from?, to?, limit, offset }`                 | `[]Workout, total`                                  | 期間妥当性/DB        |
| WorkoutUsecase    | GetDetail                 | 本人の詳細（セット付き）                  | `userID`, `workoutID`                                                      | `*WorkoutDetail`                                    | NotFound             |
| WorkoutSetUsecase | AddSet                    | セット追加（種目存在チェック）            | `userID`, `workoutID`, `WorkoutSetCreateInput`                             | `*WorkoutSet`                                       | 権限なし/種目未存在  |
| WorkoutSetUsecase | UpdateSet                 | セットの部分更新                          | `userID`, `setID`, `WorkoutSetUpdateInput`                                 | `*WorkoutSet`                                       | NotFound/DB          |
| WorkoutSetUsecase | DeleteSet                 | セット削除                                | `userID`, `setID`                                                          | `error`                                             | NotFound             |
| ExerciseUsecase   | List                      | 可視範囲の一覧（グローバル/自分）         | `userID`, `ListExercisesInput{ q?, type?, onlyMine?, limit?, offset? }`    | `ExerciseListOutput`                                | —                    |
| ExerciseUsecase   | Get                       | 可視範囲内の取得                          | `userID`, `id`                                                             | `*Exercise`                                         | NotFound             |
| ExerciseUsecase   | Create                    | 自分の独自種目作成                        | `userID`, `CreateExerciseInput`                                            | `*Exercise`                                         | name/type 必須、重複 |
| ExerciseUsecase   | Update                    | 自分の独自種目更新                        | `userID`, `id`, `UpdateExerciseInput`                                      | `*Exercise`                                         | NotFound/重複        |
| ExerciseUsecase   | Delete                    | 自分の独自種目削除                        | `userID`, `id`                                                             | `error`                                             | NotFound             |
| BodyMetricUsecase | List                      | 本人一覧                                  | `userID`, `BodyMetricListInput{ from?, to?, limit?, offset? }`             | `BodyMetricListOutput`                              | —                    |
| BodyMetricUsecase | Create                    | 本人作成（`weightKg>0`）                  | `userID`, `CreateBodyMetricInput`                                          | `*BodyMetric`                                       | weightKg>0           |
| BodyMetricUsecase | Update                    | 本人更新                                  | `userID`, `id`, `UpdateBodyMetricInput`                                    | `*BodyMetric`                                       | —                    |
| BodyMetricUsecase | Delete                    | 本人削除                                  | `userID`, `id`                                                             | `error`                                             | NotFound             |

---

## 付録 C: Repository メソッド詳細（表）

| Area                 | Method                   | 目的                              | 入力                                                  | 出力                         | 主なエラー/注意     |
| -------------------- | ------------------------ | --------------------------------- | ----------------------------------------------------- | ---------------------------- | ------------------- |
| AuthRepository       | BuildAuthorizeURL        | 認可 URL 生成                     | `clientID, redirectURI, state, nonce, codeChallenge`  | URL 文字列                   | —                   |
| AuthRepository       | ExchangeCode             | 認可コード → アクセストークン交換 | `clientID, clientSecret, redirectURI, code, verifier` | `accessToken`                | 通信/4xx/5xx        |
| AuthRepository       | FetchProfile             | LINE プロフィール取得             | `accessToken`                                         | `Profile`                    | 通信/認可エラー     |
| AuthRepository       | ResolveOrCreateBySub     | `line_user_id` で解決/作成        | `sub, name?, pictureURL?, email?`                     | `*models.User`               | DB エラー           |
| WorkoutRepository    | Create                   | ワークアウト作成                  | `*models.Workout`                                     | `error`                      | —                   |
| WorkoutRepository    | FindByIDForUser          | 本人レコード取得                  | `workoutID, userID`                                   | `*Workout`                   | NotFound            |
| WorkoutRepository    | UpdateEndedAt            | 終了時刻更新 → 再取得             | `workoutID, endedAt`                                  | `*Workout`                   | NotFound/DB         |
| WorkoutRepository    | FindWorkoutsByUser       | 本人一覧+総件数                   | `userID, WorkoutQuery{ from?, to?, limit, offset }`   | `[]Workout, total(int)`      | —                   |
| WorkoutRepository    | FindByID                 | ID で 1 件                        | `id`                                                  | `*Workout or nil`            | —                   |
| WorkoutRepository    | FindByIDAndUser          | ID+本人で 1 件                    | `workoutID, userID`                                   | `*Workout`                   | NotFound            |
| WorkoutRepository    | ListSetsByWorkout        | セット一覧（順序付）              | `workoutID`                                           | `[]WorkoutSet`               | —                   |
| WorkoutRepository    | UpdateWorkoutByIDAndUser | 部分更新                          | `workoutID, userID, values(map[string]any)`           | `*Workout`                   | NULL/DTO 設計に注意 |
| WorkoutRepository    | DeleteWorkoutByIDAndUser | 本人レコード削除                  | `workoutID, userID`                                   | `error`                      | NotFound            |
| WorkoutSetRepository | FindByID                 | セット 1 件                       | `id`                                                  | `*WorkoutSet or nil`         | —                   |
| WorkoutSetRepository | Create                   | セット作成                        | `*WorkoutSet`                                         | `error`                      | —                   |
| WorkoutSetRepository | Update                   | セット更新                        | `*WorkoutSet`                                         | `error`                      | —                   |
| WorkoutSetRepository | Delete                   | セット削除                        | `id`                                                  | `error`                      | NotFound            |
| WorkoutSetRepository | DeleteByWorkoutID        | 親のセット一括削除                | `workoutID`                                           | `error`                      | —                   |
| ExerciseRepository   | FindByID                 | ID で 1 件                        | `id`                                                  | `*Exercise or nil`           | —                   |
| ExerciseRepository   | List                     | 一覧+総件数（可視条件考慮）       | `userID, ListExercisesFilter{...}`                    | `[]Exercise, total(int64)`   | —                   |
| ExerciseRepository   | GetByID                  | ID で 1 件                        | `id`                                                  | `*Exercise`                  | NotFound            |
| ExerciseRepository   | Create                   | 新規作成                          | `*Exercise`                                           | `error`                      | 重複/制約           |
| ExerciseRepository   | UpdateOwned              | 自分の独自種目更新                | `userID, id, UpdateExerciseFields`                    | `*Exercise`                  | NotFound/重複       |
| ExerciseRepository   | DeleteOwned              | 自分の独自種目削除                | `userID, id`                                          | `error`                      | NotFound            |
| BodyMetricRepository | ListByUser               | 本人一覧+総件数                   | `userID, BodyMetricListFilter{...}`                   | `[]BodyMetric, total(int64)` | —                   |
| BodyMetricRepository | Create                   | 本人レコード作成                  | `*BodyMetric`                                         | `error`                      | —                   |
| BodyMetricRepository | UpdateOwned              | 本人レコード更新                  | `userID, id, UpdateBodyMetricFields`                  | `*BodyMetric`                | NotFound            |
| BodyMetricRepository | DeleteOwned              | 本人レコード削除                  | `userID, id`                                          | `error`                      | NotFound            |

## 次ステップ

1. 本ドラフトに追記（不足エンドポイント/操作の洗い出し）
2. OpenAPI（Swagger）を導入し、エンドポイント I/O を機械可読に
3. v2 スケルトン（Router/Adapter/Usecase/Repo）を作成し、Workouts から実装
4. LINE ボタンフロー（Postback 設計）を詰め、Webhook を Adapter として実装

この文書はリファクタのベースラインです。変更や追加の要望があれば追記していきます。

```mermaid
sequenceDiagramxx
    autonumber
    participant U as User（ユーザー）
    participant C as Client（SPA/Native App）
    participant AS as Authorization Server（認可サーバー：/authorize, /token）
    participant RS as Resource Server（API）

    rect rgb(245,245,245)
    note over C: 事前準備（クライアント側）
    C->>C: 1) code_verifier を十分長いランダム文字列で生成（高エントロピー）
    C->>C: 2) code_challenge = BASE64URL(SHA-256(code_verifier)) を計算（S256方式）
    C->>C: 3) state（CSRF対策）と nonce（リプレイ対策）を生成し、<br/>   一時安全ストレージに保存（メモリ/セッション等）
    end

    U->>C: 4) 「ログイン」クリック（認証開始）
    C->>AS: 5) /authorize へリダイレクト（GET）<br/>   client_id, redirect_uri, response_type=code,<br/>   scope, state, nonce, code_challenge,<br/>   code_challenge_method=S256
    AS->>AS: 6) 認可リクエスト検証（client_id/redirect_uri/登録確認、rate limit 等）
    AS->>U: 7) 認証画面を表示（ログイン & 同意UI）
    U->>AS: 8) ユーザー認証（ID/PW, MFA 等）＆同意

    alt 認証/同意 成功
        AS->>AS: 9) 認可コードを生成し、一時的に code_challenge と関連付けて保存
        AS->>C: 10) redirect_uri に code と state を付けてリダイレクト（302）
        C->>C: 11) 受け取った state を保存済み state と比較（CSRF検証）
        C->>AS: 12) /token へ（POST）トークン交換<br/>   grant_type=authorization_code,<br/>   code, redirect_uri, client_id,<br/>   code_verifier（生の秘密）
        AS->>AS: 13) PKCE検証：<br/>   code_verifier を S256→base64url して<br/>   保存済み code_challenge と一致確認
        alt PKCE一致 & コード有効
            AS->>C: 14) 200 OK（JSON）<br/>   access_token, token_type=Bearer,<br/>   expires_in, refresh_token（任意）, id_token（OIDCの場合）
        else PKCE不一致/コード無効
            AS-->>C: 14x) 400/401 エラー（invalid_grant/invalid_request）
            note over C,AS: code を盗まれても code_verifier が無ければ交換失敗＝PKCEの効力
        end

        rect rgb(240,255,240)
        note over C,RS: アクセストークンでAPI利用
        C->>RS: 15) API呼び出し（Authorization: Bearer <access_token>）
        RS->>RS: 16) トークン検証（いずれか）<br/>  a) JWT署名・exp/aud/scope 検証（ローカル）<br/>  b) introspection エンドポイントで有効性照会
        alt 有効トークン
            RS->>C: 17) 200 OK（保護リソース）
        else 無効/失効/権限不足
            RS-->>C: 17x) 401/403（WWW-Authenticate にエラー詳細）
        end
        end

    else 認証/同意 失敗 or ユーザー取消
        AS-->>C: 10x) redirect_uri?error=access_denied&state=...
        C->>C: 11x) state 検証後にUIへエラー表示
    end

    opt アクセストークン期限切れ（更新）
        C->>AS: 18) /token（POST）<br/>   grant_type=refresh_token, refresh_token
        AS->>C: 19) 新しい access_token（場合により refresh_token もローテーション）
    end

    opt ログアウト/セッション無効化
        C->>AS: 20) RP-initiated logout 等（OIDCの場合）
        AS->>C: 21) セッション終了後、post_logout_redirect_uri へ
    end

    %% セキュリティ注意点メモ
    note over C,AS: ・/authorize, /token, API は HTTPS 必須<br/>・state/nonce は毎回ランダム生成＆検証<br/>・code_verifier はクライアント内で安全に保持（短寿命）<br/>・id_token 使用時は nonce 検証（OIDC）
```
