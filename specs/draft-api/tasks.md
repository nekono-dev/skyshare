# 下書きAPI タスク一覧

## Phase 1: 下書きの形式とハンドラ

- 対応: D-1, D-2
- [x] T-1.1: 下書きのスキーマと `draft.ts` の検証を投稿の配列に対応させる。
- [x] T-1.2: `drafts.ts` の各メソッドを投稿の配列に対応させる。
- [x] T-1.3: 検証とハンドラのテストを受け入れ条件のタグ付きで追加する。
- [ ] T-1.4: 下書きと投稿の作成が同じスレッドの上限の定数を参照することを確認するテストを追加する。
- 検証: `npx vitest run tests/pages/v2/bsky/drafts.test.ts tests/lib/atproto/draft.test.ts`
