# 検索付きプルダウン タスク一覧

## Phase 1: 絞り込み

- 対応: D-3
- [x] T-1.1: `filter.ts` に正規化と絞り込みを実装し、単体テストを受け入れ条件のタグ付きで追加する。
- [ ] T-1.2: 約180件の絞り込みの処理時間を計測するテストを追加する。
- 検証: `npx vitest run tests/util/listbox/filter.test.ts`

## Phase 2: 検索モード

- 対応: D-1, D-2
- [x] T-2.1: `Dropdown` に `searchable` と検索モードの遷移を実装する。
- [ ] T-2.2: 絞り込み結果の変化でアクティブ項目が先頭になることを確認するE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/dropdown.spec.ts` 投稿言語のプルダウンを開いて再クリックし「ko」と入力する → 該当する言語だけに絞り込まれ、Escキーで直前の選択に戻る
