# 共有設定 タスク一覧

## Phase 1: 設定の読み書き

- 対応: D-1, D-2
- [x] T-1.1: `shareSettings.ts` に共有設定の読み書きと `resolveMastodonInstanceDomain` を実装する。
- [x] T-1.2: `legacyShareSettings.ts` に引き継ぎ処理を実装し、`readAutoPopupTargetSetting` から呼び出す。
- [x] T-1.3: 読み書き・ドメイン解決・引き継ぎ規則の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/settings/shareSettings.test.ts tests/lib/settings/legacyShareSettings.test.ts`

## Phase 2: フックと設定ページ

- 対応: D-3, D-4
- [x] T-2.1: `useShareToggles.ts` に共有設定フックを実装する。
- [x] T-2.2: 設定ページに共有設定の行を配置する。
- [ ] T-2.3: 共有設定を保存した状態でハイドレーション警告が出ないことを確認するE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/intentShare.spec.ts` 設定ページでポップアップを開く設定をONにする → 自動ポップアップするSNSのプルダウンが現れ、Mastodonの入力欄は常に表示される
