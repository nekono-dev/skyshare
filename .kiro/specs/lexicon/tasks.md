# Implementation Plan

- [x] 1. レコード定義
- [x] 1.1 `entry.json` と `defs.json` を定義し、`goat lex publish` で公開する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
- [x] 1.2 投稿以外を指す派生元・代表画像の欠落・見出しと説明文の省略のテストを追加する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
- [x] 1.3 公開済みのlexiconと比べて既存フィールドが変わっていないことを確認するテストを追加する。
  - 検証: `npm run test:lexicon` と `npx vitest run tests/lexicons/lexicons.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. NSIDの導出と利用
- [x] 2.1 `nsid.ts` を実装し、NSIDの直書きを置き換える。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_
- [x] 2.2 導出・異常系・URIの単体テストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_
- [x] 2.3 別ドメインのNSIDに書き換えた定義で、導出とURIの扱いと定義の妥当性を確認するテストを追加する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_
- [x] 2.4 NSIDの導出が実行時にファイルを読まないことを確認するテストを追加する。
  - 検証: `npx vitest run tests/lib/atproto/nsid.test.ts`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1_

- [x] 3. 検証
- [x] 3.1 lexicon定義の検証テストとNSIDの直書き検出テストを追加する。
  - 検証: `npx vitest run tests/lexicons/lexicons.test.ts tests/lib/atproto/nsidLiteral.test.ts`
  - _Requirements: 4.1, 4.2, 4.3_
