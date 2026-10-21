# ブラウザ向けの汎用処理 タスク一覧

## Phase 1: 判定と待機

- 対応: D-1, D-3
- [x] T-1.1: `object.ts` と `waitForImageLoad.ts` を実装する。
- [x] T-1.2: 判定と待機の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/util/object.test.ts tests/util/waitForImageLoad.test.ts`

## Phase 2: スクロールの固定

- 対応: D-2
- [x] T-2.1: `scrollLock.ts` を実装する。
- [x] T-2.2: 固定の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/util/scrollLock.test.ts`
