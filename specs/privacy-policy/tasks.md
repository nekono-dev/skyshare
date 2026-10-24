# プライバシーポリシー タスク一覧

## Phase 1: 本文の組み立て

- 対応: D-1, D-2
- [x] T-1.1: 運用者ごとの設定から運営者の活動名・連絡先・日付を受け取る。
- [x] T-1.2: 日本語・英語の辞書 `privacy` を追加し、`buildPrivacyPolicy` を実装する。
- [x] T-1.3: 単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/privacy`

## Phase 2: 表示とリンク

- 対応: D-3
- [x] T-2.1: `PolicyCards.tsx`・`privacy.astro` を実装し、設定・ログイン・予約の許可の案内にリンクを加える。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/privacyPage.spec.ts` ログインなしでプライバシーポリシーを開く → 節の見出しがカードごとに表示され、連絡先の Bluesky のアカウントがリンクになる
