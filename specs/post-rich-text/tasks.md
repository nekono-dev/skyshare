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

## Phase 4: 注釈の無いURLのリンク表示

- 対応: D-4
- [x] T-4.1: `autoLink.ts` を実装し、`segmentRichText` の注釈の範囲外の区間に適用する。単体テストを受け入れ条件のタグ付きで追加する。
- [x] T-4.2: entry詳細ページの説明文を `PostRichText` で描画する。
- [x] T-4.3: サンプルのentry詳細ページの説明文にスキームを省略したURLを加え、リンクを確認するE2Eテストを追加する。
- 検証: `npx vitest run tests/util/autoLink.test.ts tests/lib/atproto/richTextSegments.test.ts`
- E2E: `tests/e2e/postRichText.spec.ts` サンプルのentry詳細ページを開く → 説明文のスキームを省略したURLが https を補った新しいタブで開くリンクになる

## Phase 5: entry一覧のキャプションとタグのリンク表示

- 対応: D-5, D-6
- [x] T-5.1: `autoLink.ts` に `findHashtagRanges` を実装し、`segmentRichText` の注釈の範囲外の区間に適用する。単体テストを受け入れ条件のタグ付きで追加する。
- [x] T-5.2: `EntryCard` のキャプションを `PostRichText` で描画する。
- [x] T-5.3: ゲスト表示のentryのキャプションにURLとタグを加え、一覧のリンクを確認するE2Eテストを追加する。
- 検証: `npx vitest run tests/util/autoLink.test.ts`
- E2E: `tests/e2e/postRichText.spec.ts` ゲスト表示の一覧ページを開く → キャプションのスキームを省略したURLとタグが新しいタブで開くリンクになる
