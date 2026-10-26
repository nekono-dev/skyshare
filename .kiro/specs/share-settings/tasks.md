# Implementation Plan

- [x] 1. 設定の読み書き
- [x] 1.1 `shareSettings.ts` に共有設定の読み書きと `resolveMastodonInstanceDomain` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 4.1, 4.2_
- [x] 1.2 `legacyShareSettings.ts` に引き継ぎ処理を実装し、`readAutoPopupTargetSetting` から呼び出す。
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 4.1, 4.2_
- [x] 1.3 読み書き・ドメイン解決・引き継ぎ規則の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/settings/shareSettings.test.ts tests/lib/settings/legacyShareSettings.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 4.1, 4.2_

- [x] 2. フックと設定ページ
- [x] 2.1 `useShareToggles.ts` に共有設定フックを実装する。
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 3.1, 3.2_
- [x] 2.2 設定ページに共有設定の行を配置する。
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 3.1, 3.2_
- [x] 2.3 共有設定を保存した状態でハイドレーション警告が出ないことを確認するE2Eテストを追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/intentShare.spec.ts` 設定ページでポップアップを開く設定をONにする → 自動ポップアップするSNSのプルダウンが現れ、Mastodonの入力欄は常に表示される
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 3.1, 3.2_
