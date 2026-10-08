# 表示言語の判定と切り替え タスク一覧

## Phase 1: 判定と保存

- 対応: D-1
- [x] T-1.1: `locale.ts` と `localeSetting.ts` を実装する。
- [x] T-1.2: 判定と保存の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/i18n/locale.test.ts tests/lib/i18n/localeSetting.test.ts`

## Phase 2: クライアントでの切り替え

- 対応: D-2
- [x] T-2.1: `store.ts`・`react.ts`・`applyDom.ts` を実装する。
- [x] T-2.2: `Baselayout.astro` に言語属性の初期化と遷移時の複製を追加する。
- [ ] T-2.3: 別タブでの言語設定の変更に追従することを確認するE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/i18n.spec.ts` 設定画面でEnglishを選び、再読み込みと別ページへの遷移をする → 文言と言語属性が英語のまま維持される

## Phase 3: サーバーでの判定

- 対応: D-3
- [x] T-3.1: `lib/i18n/middleware.ts` を実装し、`src/middleware.ts` で合成する。
- [ ] T-3.2: 依存パッケージ・並行リクエスト・静的生成の言語を確認するテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/i18n.spec.ts` 受け入れ言語を英語にしてEntry詳細ページを開く → 初回HTMLの言語属性が英語になる

## Phase 4: 選択欄

- 対応: D-4
- [x] T-4.1: `LocaleSelect` を実装し、設定画面とログイン画面に配置する。
- 検証: `npm run build`
- E2E: `tests/e2e/i18n.spec.ts` ログイン画面の選択欄でEnglishを選ぶ → フォームの文言が即座に英語になる
