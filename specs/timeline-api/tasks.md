# タイムラインAPI タスク一覧

## Phase 1: 系統の選出と構築

- 対応: D-2, D-3
- [x] T-1.1: `threadChain.ts` に連鎖の抽出と起点・所有者の判定を実装し、単体テストを追加する。
- [x] T-1.2: `timelineThreads.ts` に `buildTimelineThreads` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/entry/timelineThreads.test.ts tests/lib/atproto/threadChain.test.ts`

## Phase 2: 応答

- 対応: D-1
- [x] T-2.1: `entries.ts` と応答のスキーマをスレッドグループの配列に変更する。
- [x] T-2.2: ハンドラのテストを追加する。
- 検証: `npx vitest run tests/pages/v2/entries.test.ts`

## Phase 3: 処理量の削減

- 対応: D-4, D-5
- [x] T-3.1: `repo.ts` に `listRecordsSince` を実装し、単体テストを追加する。
- [x] T-3.2: `threadChain.ts` に `buildThreadViewFromPosts` を実装し、単体テストを追加する。
- [x] T-3.3: `timelineThreads.ts` を、entryを付与しない構築と `attachSkyshareEntries` に分け、一覧だけで確定できる起点の個別取得を省く。
- [x] T-3.4: `entries.ts` を D-1 の流れに変更し、ハンドラのテストを更新する。
- 検証: `npx vitest run tests/lib/entry/timelineThreads.test.ts tests/lib/atproto tests/pages/v2/entries.test.ts`
