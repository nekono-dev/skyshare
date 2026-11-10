# Brief: scheduled-posting

## Problem

利用者は投稿を未来の日時に予約し、Cron が時刻に実行する。実行はログインしていない時間に行われるため、予約用の認可を別に持ち、トークンを暗号化して保管する必要がある。失敗時の再試行と、途中で止まった実行の扱いも決めないと、投稿が重複する。

## Current State

- API（`src/pages/v2/schedules*`）: `POST /v2/schedules`（作成）、`GET`（一覧、実行時刻の昇順）、`GET`・`PUT`・`DELETE /v2/schedules/{id}`、`GET /v2/schedules/{id}/images/{index}`、`GET /v2/schedules/limits`。
- 認可（`src/pages/v2/schedules/credential*`）: `POST .../credential/authorization`（開始）と `.../completion`（完了）。`GET`・`DELETE /v2/schedules/credential`（登録の状態、解除。解除は待機中の予約と失敗の履歴を消す）。認可の部品は `src/lib/schedule/oauth/flow.ts`（PAR・トークン・取消）。
- 保管: D1 のテーブル `scheduled_posts`・`schedule_credentials`・`schedule_oauth_states`（`migrations/0001_initial.sql`）。画像は R2（`SCHEDULE_IMAGES`）。認証情報は `credentialCrypto.ts`（AES-GCM、DID を追加認証データにする。鍵は `SCHEDULE_ENC_KEY`）。
- 状態: `pending`・`running`・`failed`（成功した予約は消える）。`store.ts` が `running` への遷移を一文の更新で行い、同じ予約を二つの実行が取らないようにする。
- 実行（Cron、毎分）: `src/worker.ts` → `runScheduledPosts`（`runner.ts`）。`CLAIM_LIMIT` 件を実行時刻の早い順に取り出し、`executor.ts` が段階的に実行する。通信の予算は全体で共有し、尽きたら残りを待機へ戻す。TID（`tid.ts`）で rkey を先に採番し、再実行で重複させない。
- 後片付け（1 日 1 回）: `runHousekeeping`。`FINISHED_RETENTION_SECONDS` を過ぎた予約の削除、`CREDENTIAL_IDLE_SECONDS` を過ぎた認証情報の無効化（`REAUTH_MARKER_KEEP_SECONDS` で古い印を消す）。
- 期限の目安: `credentialExpiry.ts`（使われていない許可の期限と、認可サーバーの寿命の早い方）。
- 画面: `components/schedule/`（`ScheduleSetting`（設定ページに配置）、`CredentialDialog`、`AuthorizationReturn`（全ページ共通の戻り）、`RunAtPicker`、`ScheduleList`（下書きページの予約タブ））。投稿フォームへの組み込みは `lib/schedule/scheduleMode.ts`・`submitSchedule.ts`。
- 予約の作成の受付: `stageSchedule.ts`・`validateSchedule.ts`（実行時刻の範囲は `MIN_LEAD_SECONDS`〜`MAX_LEAD_SECONDS`）。

## Desired Outcome

- 予約の作成・編集・取消の規則（実行時刻の範囲、待機中の件数の上限、実行中の予約の扱い）が記録されている。
- 認可・認証情報の保管・解除・有効期限の目安が記録されている。
- Cron の実行、再試行、失敗の分類、後片付けの規則が記録されている。

## Approach

予約の一連（作成・保管・実行・後片付け）と、その画面の部品を所有する。投稿フォームの状態は post-composition が所有し、本 spec はそれを拡張する。

## Scope

- **In**: 予約の API と画面、予約用の認可と認証情報、暗号化、Cron の実行と後片付け、失敗の分類、予約の状態の表示。
- **Out**: 投稿の検証と送信の本体（post-composition）、Entry の作成（entry-sharing）、Worker の入口（platform-runtime）、アカウントのログイン（session-accounts）。

## Boundary Candidates

- 予約の API と保管（v2/schedules・store.ts・stageSchedule.ts・validateSchedule.ts・scheduleLimits.ts）
- 認可と認証情報（oauth/flow.ts・oauth/storedCredential.ts・credentialCrypto.ts・credentialExpiry.ts）
- 実行（runner.ts・executor.ts・imageStaging.ts・tid.ts・xrpcClient.ts）
- 予約の画面（components/schedule/・scheduleMode.ts・submitSchedule.ts）

## Out of Boundary

- 投稿の検証と送信の本体、Entry の作成、Worker の入口、ログイン

## Upstream / Downstream

- **Upstream**: post-composition、entry-sharing、media-attachments、atproto-records、oauth-client、session-accounts、api-contract、platform-runtime、i18n、ui-primitives。
- **Downstream**: なし。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: post-composition（フォームの状態）、session-accounts（別の Cookie と鍵）、oauth-client（認可の部品）、platform-runtime（Cron の入口と D1 の型の所在）。

## Constraints

- 実行に使うトークンと鍵をログや応答に出さない。
- Cron の経路は `@atproto/*` を読み込まない（`executor.ts` と `runner.ts` の header の規則）。
- 解消済み（2026-10-31）: 共有の型 `cfTypes.ts` は `lib/platform/` へ移した。

## 確定した判断（2026-10-21〜22）

- 無料枠のみを使う: D1（予約と暗号化したトークン）・R2（画像）・Cron Trigger（毎分）。
- Cron の実行（runner）は `@atproto` を読まず、fetch の XRPC だけを使う（Free の CPU 10ms のため）。
- 認証は Bluesky OAuth（confidential client・DPoP・granular scope）。秘密は `SCHEDULE_OAUTH_KEY`。client_id は配信元ごとに、認可情報と一緒に保管する。granular scope の実認可サーバーでの検証と、DPoP の CPU 実測は未実施。
- 制限値は API（`GET /v2/schedules/limits`）が持ち、画面はそれに従う。
- プレビューとステージングは本番の D1・R2 を共用する。暗号鍵は全環境で同じ値にする（違うと共用 D1 の認証情報を復号できず、予約が失敗する）。
- 設定のトグルで有効化する。ON と OFF は認証情報の有無で決まる。OFF にするときは、待機中の予約があれば確認のうえ全件取り消す。
- 認証情報の自動削除: 予約がなく、最終の作成・更新・実行から 30 日経ったとき。認証の失効が分かったら削除して OFF に戻す。
- カレンダーボタンは、編集中セグメントの「＋」の左に置く。既定は翌日の同時刻。送信ボタンは「予約」「すべて予約」に変わる。予約時は他 SNS への共有をしない。
- 上限: 待機中 5 件（スレッドも 1 件）、5 分後から 14 日後まで。履歴は 7 日、R2 のライフサイクルは 15 日。
- 「下書き・予約」ダイアログにタブを置く。`/schedules/` ページは廃止する。
- 編集は PUT で全置換し、画像も毎回アップロードし直す（R2 の期限より先に古い画像が消えるのを防ぐため）。日時の解除は確認なしで即取り消し、フォームは残す。

## 別 spec に回した構想（未着手）

予約時に entry を先に作って共有し、実行後に source を書き戻す。取り消し・失敗のときは entry を削除する。画像のない予約は本文だけで共有する。lexicon は source を任意にするだけで、日時はレコードに持たない。
