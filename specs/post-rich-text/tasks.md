# 投稿本文のリンク表示 タスク一覧

## Phase 1: 区間の切り出し

- 対応: D-1
- [x] T-1.1: `richTextSegments.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/atproto/richTextSegments.test.ts`

## Phase 2: リンクの描画

- 対応: D-2
- [x] T-2.1: `PostRichText` を作成し、`PostBody` の本文に組み込む。
- [x] T-2.2: タイムラインとentry詳細ページのリンクを確認するE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/postRichText.spec.ts` ゲスト表示とサンプルのentry詳細ページを開く → 本文のメンション・ハッシュタグ・URLが新しいタブで開くリンクになる

## Phase 3: 注釈の受け渡し

- 対応: D-3
- [x] T-3.1: 一覧APIのスキーマと `normalizeTimelinePost` に注釈を加える。
- [x] T-3.2: entry詳細とゲスト表示の投稿に注釈を加える。
- 検証: `npx vitest run tests/lib/entry/posts.test.ts`
