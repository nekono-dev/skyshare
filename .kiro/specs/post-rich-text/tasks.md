# Implementation Plan

- [x] 1. 区間の切り出し
- [x] 1.1 `richTextSegments.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/atproto/richTextSegments.test.ts`
  - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [x] 2. リンクの描画
- [x] 2.1 `PostRichText` を作成し、`PostBody` の本文に組み込む。
  - _Requirements: 1.2, 2.2_
- [x] 2.2 タイムラインとentry詳細ページのリンクを確認するE2Eテストを追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/postRichText.spec.ts` ゲスト表示とサンプルのentry詳細ページを開く → 本文のメンション・ハッシュタグ・URLが新しいタブで開くリンクになる
  - _Requirements: 1.2, 2.2_

- [x] 3. 注釈の受け渡し
- [x] 3.1 一覧APIのスキーマと `normalizeTimelinePost` に注釈を加える。
  - _Requirements: 2.1_
- [x] 3.2 entry詳細とゲスト表示の投稿に注釈を加える。
  - 検証: `npx vitest run tests/lib/entry/posts.test.ts`
  - _Requirements: 2.1_

- [x] 4. 注釈の無いURLのリンク表示
- [x] 4.1 `autoLink.ts` を実装し、`segmentRichText` の注釈の範囲外の区間に適用する。単体テストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 3.1, 3.2, 3.3_
- [x] 4.2 entry詳細ページの説明文を `PostRichText` で描画する。
  - _Requirements: 3.1, 3.2, 3.3_
- [x] 4.3 サンプルのentry詳細ページの説明文にスキームを省略したURLを加え、リンクを確認するE2Eテストを追加する。
  - 検証: `npx vitest run tests/util/autoLink.test.ts tests/lib/atproto/richTextSegments.test.ts`
  - E2E: `tests/e2e/postRichText.spec.ts` サンプルのentry詳細ページを開く → 説明文のスキームを省略したURLが https を補った新しいタブで開くリンクになる
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 5. entry一覧のキャプションとタグのリンク表示
- [x] 5.1 `autoLink.ts` に `findHashtagRanges` を実装し、`segmentRichText` の注釈の範囲外の区間に適用する。単体テストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 3.4, 3.5, 3.6_
- [x] 5.2 `EntryCard` のキャプションを `PostRichText` で描画する。
  - _Requirements: 3.4, 3.5, 3.6_
- [x] 5.3 ゲスト表示のentryのキャプションにURLとタグを加え、一覧のリンクを確認するE2Eテストを追加する。
  - 検証: `npx vitest run tests/util/autoLink.test.ts`
  - E2E: `tests/e2e/postRichText.spec.ts` ゲスト表示の一覧ページを開く → キャプションのスキームを省略したURLとタグが新しいタブで開くリンクになる
  - _Requirements: 3.4, 3.5, 3.6_
