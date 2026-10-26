# Implementation Plan

- [x] 1. 下書きの形式とハンドラ
- [x] 1.1 下書きのスキーマと `draft.ts` の検証を投稿の配列に対応させる。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2_
- [x] 1.2 `drafts.ts` の各メソッドを投稿の配列に対応させる。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2_
- [x] 1.3 検証とハンドラのテストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2_
- [x] 1.4 下書きと投稿の作成が同じスレッドの上限の定数を参照することを確認するテストを追加する。
  - 検証: `npx vitest run tests/pages/v2/bsky/drafts.test.ts tests/lib/atproto/draft.test.ts tests/lib/api/schema/threadLimit.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2_
