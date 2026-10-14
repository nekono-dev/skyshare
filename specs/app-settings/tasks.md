# 設定ページと表示テーマ タスク一覧

## Phase 1: 表示テーマ

- 対応: D-1
- [x] T-1.1: `themeSettings.ts` を実装する。
- [x] T-1.2: 保存と適用の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/settings/themeSettings.test.ts`

## Phase 2: 設定項目の一覧

- 対応: D-2
- [x] T-2.1: `SettingList/index.tsx` を実装する。
- [x] T-2.2: 描画の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/components/settings/SettingList.test.ts`
- E2E: `tests/e2e/settingsPage.spec.ts` ゲスト表示の設定ページを開く → 表示・投稿フォーム・返信可否の3つの見出しが表示される

## Phase 3: ページとダイアログ

- 対応: D-3
- [x] T-3.1: `Settings/index.tsx`・`SettingsDialog/index.tsx`・`ThemeModeSelect/index.tsx`・`settings.astro` を実装する。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/settingsTheme.spec.ts` ゲスト表示の設定ページで表示テーマをダークに切り替えて再読み込みする → 文書のテーマ指定がダークになり、再読み込み後も保たれる
