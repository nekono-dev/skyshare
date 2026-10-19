# 予約投稿API タスク一覧

## Phase 1: 検証処理とスキーマ

- 対応: D-3
- [ ] T-1.1: `src/lib/schedule/validateSchedule.ts` に実行時刻の範囲検証を実装する。
- [ ] T-1.2: 作成・一覧・取消のスキーマを `src/lib/api/schema/v2/schedules/` に定義し、OpenAPI の生成に登録する。
- [ ] T-1.3: `npm run codegen` を実行し、クライアントの生成を確認する。
- 検証: `npx vitest run tests/lib/schedule/validateSchedule.test.ts`

## Phase 2: 予約の作成

- 対応: D-2
- [ ] T-2.1: `src/pages/v2/schedules.ts` に POST を実装し、画像の保管と予約の保存を行う。
- [ ] T-2.2: 動画・件数・実行時刻・認証情報の未登録・件数の上限を拒否する分岐を実装する。
- [ ] T-2.3: 受け入れ条件 AC-1 から AC-4、AC-10、AC-12 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/pages/v2/schedules.test.ts`

## Phase 3: 一覧と取消

- 対応: D-4, D-5
- [ ] T-3.1: `src/pages/v2/schedules.ts` に GET を実装する。
- [ ] T-3.2: `src/pages/v2/schedules/[id].ts` に DELETE を実装する。
- [ ] T-3.3: 受け入れ条件 AC-8 と AC-9 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/pages/v2/schedules.test.ts tests/pages/v2/schedulesId.test.ts`

## Phase 4: 認証情報

- 対応: D-6, D-7
- [ ] T-4.1: `src/lib/schedule/registerCredential.ts` にログインと検証を実装する。
- [ ] T-4.2: `src/pages/v2/schedules/credential.ts` に GET・PUT・DELETE を実装する。
- [ ] T-4.3: 受け入れ条件 AC-5 から AC-7、AC-11 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/schedule/registerCredential.test.ts tests/pages/v2/scheduleCredential.test.ts`

## Phase 5: 横断の確認

- 対応: D-1
- [ ] T-5.1: 受け入れ条件 AC-13 から AC-16 のテストをタグ付きで追加する。
- [ ] T-5.2: 起動時の読み込みを検査する既存のテストに、予約の API の経路を追加する。
- 検証: `npm test`
