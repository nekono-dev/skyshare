# 通知バッジ タスク一覧

## Phase 1: 件数ロジック

- 対応: D-1
- [ ] T-1.1: `fetchUnreadCount` を実装する。
- [ ] T-1.2: `formatBadge` を実装し、0件・1件・100件の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/notification/unreadCount.test.ts`

## Phase 2: バッジ表示

- 対応: D-2
- [ ] T-2.1: `NotificationBadge.tsx` を作成し、ヘッダーへ組み込む。
- 検証: `npm run build`
- E2E: `tests/e2e/notificationBadge.spec.ts` 未読3件の状態でトップページを開く → ヘッダーのバッジに「3」が1秒以内に表示される
