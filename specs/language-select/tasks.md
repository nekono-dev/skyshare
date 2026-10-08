# 投稿言語の選択欄 タスク一覧

## Phase 1: 国旗の対応

- 対応: D-1
- [x] T-1.1: `countryFlag.ts` と `languageFlag.ts` を実装する。
- [x] T-1.2: 変換と対応表の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/util/emoji/countryFlag.test.ts tests/lib/atproto/languageFlag.test.ts`

## Phase 2: 選択肢

- 対応: D-2
- [x] T-2.1: `LanguageSelect` を国旗付きの検索付きプルダウンにする。
- 検証: `npm run build`
- E2E: `tests/e2e/dropdown.spec.ts` 投稿言語で「ko」と入力して確定する → トリガーに国旗と言語名が表示される
