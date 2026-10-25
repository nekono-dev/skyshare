# 予約投稿API タスク一覧

## Phase 1: 検証処理とスキーマ

- 対応: D-3
- [x] T-1.1: `src/lib/schedule/validateSchedule.ts` に実行時刻の範囲検証を実装する。
- [x] T-1.2: 作成・一覧・取消のスキーマを `src/lib/api/schema/v2/schedules/` に定義し、OpenAPI の生成に登録する。
- [x] T-1.3: `npm run codegen` を実行し、クライアントの生成を確認する。
- [x] T-1.4: 上限を14日後と待機中5件に改め、`src/lib/schedule/stageSchedule.ts` に共通の検証と画像の保管を切り出す。
- [x] T-1.5: 受け入れ条件 AC-3 と AC-10 のテストを新しい上限に合わせて更新する。
- 検証: `npx vitest run tests/lib/schedule/validateSchedule.test.ts`

## Phase 2: 予約の作成

- 対応: D-2
- [x] T-2.1: `src/pages/v2/schedules.ts` に POST を実装し、画像の保管と予約の保存を行う。
- [x] T-2.2: 動画・件数・実行時刻・認証情報の未登録・件数の上限を拒否する分岐を実装する。
- [x] T-2.3: 受け入れ条件 AC-1 から AC-4、AC-10、AC-12 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/pages/v2/schedules.test.ts`

## Phase 3: 一覧と取消

- 対応: D-4, D-5, D-8, D-9, D-10
- [x] T-3.1: `src/pages/v2/schedules.ts` に GET を実装する。
- [x] T-3.2: `src/pages/v2/schedules/[id].ts` に DELETE を実装する。
- [x] T-3.3: `src/pages/v2/schedules/limits.ts` に制限値の取得を実装する。
- [x] T-3.4: 受け入れ条件 AC-8、AC-9、AC-17 のテストをタグ付きで追加する。
- [x] T-3.5: 内容の取得と置き換えのスキーマを `_id/get.ts` と `_id/put.ts` に定義し、`[id].ts` に GET と PUT を実装する。
- [x] T-3.6: 画像の取得のスキーマと `src/pages/v2/schedules/[id]/images/[index].ts` を実装する。
- [x] T-3.7: 取消で認証情報を削除しない形に改め、受け入れ条件 AC-18 から AC-21 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/pages/v2/schedules.test.ts tests/pages/v2/schedulesId.test.ts`

## Phase 4: 認証情報

- 対応: D-6, D-7
- [x] T-4.1: `src/lib/schedule/oauth/` に OAuth の認可の開始・完了とトークンの更新・取消を実装する。
- [x] T-4.2: `credential.ts` に GET・DELETE を、`credential/authorization.ts` に認可の開始と戻りを実装する。
- [x] T-4.3: `src/pages/oauth/` にクライアントのメタデータと公開鍵の一覧を実装する。
- [x] T-4.4: 受け入れ条件 AC-5 から AC-7、AC-11 のテストをタグ付きで追加する。
- [x] T-4.5: 認証情報の削除で待機中の予約と失敗の履歴を削除する形に改め、AC-11 のテストを更新する。
- [x] T-4.6: 戻り先を `/oauth/callback/` に移し、完了を `authorization/completion.ts` に分け、AC-22 のテストを追加する。
- [x] T-4.7: 登録状態に再度の許可の要否と有効期限の目安を加え、開始で戻り先のパスを受けて戻り先から転送し、AC-23 と AC-24 のテストを追加する。
- [x] T-4.8: 認可の処理を共通の OAuth のクライアントの上に移し、戻り先の cookie を用途つきにして、AC-22 と AC-24 のテストを合わせる。
- 検証: `npx vitest run tests/lib/schedule/oauthFlow.test.ts tests/pages/v2/scheduleCredential.test.ts tests/pages/v2/scheduleAuthorization.test.ts`

## Phase 5: 横断の確認

- 対応: D-1
- [x] T-5.1: 受け入れ条件 AC-13 から AC-16 のテストをタグ付きで追加する。
- [x] T-5.2: 起動時の読み込みを検査する既存のテストに、予約の API の経路を追加する。
- [x] T-5.3: 取得・置き換え・画像の経路を AC-13 と AC-16 のテストに加え、`npm run codegen` で生成し直す。
- 検証: `npm run test:unit`
