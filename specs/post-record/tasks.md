# 投稿レコードの組み立てと検証 タスク一覧

## Phase 1: レコードと検証

- 対応: D-1, D-2
- [x] T-1.1: `post.ts` に `buildBskyPostRecord` と `isReplyRefOwnedBySelf` を実装する。
- [x] T-1.2: `facet.ts` に `validateFacets` を実装する。
- [x] T-1.3: レコードと検証の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/atproto/post.test.ts tests/lib/atproto/facet.test.ts`

## Phase 2: 抽出・集計・検出

- 対応: D-3
- [x] T-2.1: `richtext.ts` に抽出・集計・検出の関数を実装する。
- [x] T-2.2: 抽出・集計・検出の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/atproto/richtext.test.ts`
