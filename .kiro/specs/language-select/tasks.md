# Implementation Plan

- [x] 1. 国旗の対応
- [x] 1.1 `countryFlag.ts` と `languageFlag.ts` を実装する。
  - _Requirements: 2.1, 2.2, 2.3_
- [x] 1.2 変換と対応表の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/util/emoji/countryFlag.test.ts tests/lib/atproto/languageFlag.test.ts`
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. 選択肢
- [x] 2.1 `LanguageSelect` を国旗付きの検索付きプルダウンにする。
  - 検証: `npm run build`
  - E2E: `tests/e2e/dropdown.spec.ts` 投稿言語で「ko」と入力して確定する → トリガーに国旗と言語名が表示される
  - _Requirements: 1.1, 2.4_
