# Implementation Plan

- [x] 1. 絞り込み
- [x] 1.1 `filter.ts` に正規化と絞り込みを実装し、単体テストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 2.1, 2.3, 2.4, 2.5_
- [x] 1.2 約180件の絞り込みの処理時間を計測するテストを追加する。
  - 検証: `npx vitest run tests/util/listbox/filter.test.ts`
  - _Requirements: 2.1, 2.3, 2.4, 2.5_

- [x] 2. 検索モード
- [x] 2.1 `Dropdown` に `searchable` と検索モードの遷移を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_
- [x] 2.2 絞り込み結果の変化でアクティブ項目が先頭になることを確認するE2Eテストを追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/dropdown.spec.ts` 投稿言語のプルダウンを開いて再クリックし「ko」と入力する → 該当する言語だけに絞り込まれ、Escキーで直前の選択に戻る
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_
