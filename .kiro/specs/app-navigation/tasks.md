# Implementation Plan

- [x] 1. 判定と項目の定義
- [x] 1.1 `guestMode.ts` と `navItems.ts` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_
- [x] 1.2 判定と項目の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/guestMode.test.ts tests/components/layout/nav/navItems.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 2. 表示と同期
- [x] 2.1 `Sidebar/index.astro`・`FooterNav/index.astro`・`NavIcon.astro` と同期の3つのスクリプトを実装する。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/appNavigation.spec.ts` デスクトップ幅とモバイル幅でページを開き、ゲスト表示とアカウントの取得を差し替える → サイドバーとフッターが幅で切り替わり、現在地の印とゲスト表示のクエリとアカウントのアイコンが反映される
  - _Requirements: 1.5, 3.1, 3.2, 4.1_
