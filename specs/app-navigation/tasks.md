# 画面遷移のナビゲーション タスク一覧

## Phase 1: 判定と項目の定義

- 対応: D-1, D-2
- [x] T-1.1: `guestMode.ts` と `navItems.ts` を実装する。
- [x] T-1.2: 判定と項目の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/guestMode.test.ts tests/components/layout/nav/navItems.test.ts`

## Phase 2: 表示と同期

- 対応: D-3
- [x] T-2.1: `Sidebar/index.astro`・`FooterNav/index.astro`・`NavIcon.astro` と同期の3つのスクリプトを実装する。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/appNavigation.spec.ts` デスクトップ幅とモバイル幅でページを開き、ゲスト表示とアカウントの取得を差し替える → サイドバーとフッターが幅で切り替わり、現在地の印とゲスト表示のクエリとアカウントのアイコンが反映される
