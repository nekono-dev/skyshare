# Implementation Plan

- [x] 1. 表示テーマ
- [x] 1.1 `themeSettings.ts` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
- [x] 1.2 保存と適用の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/settings/themeSettings.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 設定項目の一覧
- [x] 2.1 `SettingList/index.tsx` を実装する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
- [x] 2.2 描画の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/components/settings/SettingList.test.ts`
  - E2E: `tests/e2e/settingsPage.spec.ts` ゲスト表示の設定ページを開く → 表示・投稿・クロスポストの3つの見出しが表示される
  - E2E: `tests/e2e/settingsPage.spec.ts` ゲスト表示の設定ページでラベルと説明文を押し、次にスイッチを押す → ラベルと説明文では状態が変わらず、スイッチで状態が変わる
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 3. ページとダイアログ
- [x] 3.1 `Settings/index.tsx`・`SettingsDialog/index.tsx`・`ThemeModeSelect/index.tsx`・`settings.astro` を実装する。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/settingsTheme.spec.ts` ゲスト表示の設定ページで表示テーマをダークに切り替えて再読み込みする → 文書のテーマ指定がダークになり、再読み込み後も保たれる
  - _Requirements: 1.4, 3.1_
