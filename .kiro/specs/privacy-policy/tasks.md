# Implementation Plan

- [x] 1. 本文の組み立て
- [x] 1.1 運用者ごとの設定から運営者の活動名・連絡先・日付を受け取る。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 3.1, 4.1_
- [x] 1.2 日本語・英語の辞書 `privacy` を追加し、`buildPrivacyPolicy` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 3.1, 4.1_
- [x] 1.3 単体テストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 3.1, 4.1_
- [x] 1.4 不具合の報告と機能の提案の区分・GitHub での公開の例外・保持期間を辞書と組み立てに加える。
  - 検証: `npx vitest run tests/lib/privacy`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 3.1, 4.1_

- [x] 2. 表示とリンク
- [x] 2.1 `PolicyCards.tsx`・`privacy.astro` を実装し、設定・ログイン・予約の許可の案内にリンクを加える。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/privacyPage.spec.ts` ログインなしでプライバシーポリシーを開く → 節の見出しがカードごとに表示され、連絡先の Bluesky のアカウントがリンクになる
  - _Requirements: 4.2, 4.3_
