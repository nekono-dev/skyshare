# Implementation Plan

- [x] 1. ダイアログ
- [x] 1.1 `IntentShareDialog` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2_
- [x] 1.2 entryのない投稿での選択肢の表示と、不正なMastodonドメインでの操作不能を確認するE2Eテストを追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/intentShare.spec.ts` 不正なMastodonドメインを保存してタイムラインの投稿の共有ダイアログを開く → Mastodonの選択肢が操作不能で、他の4つは操作できる
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2_

- [x] 2. 呼び出し側
- [x] 2.1 `ThreadComposer` と `PostLauncher` から `keepOpenOnSelect` 付きでダイアログを表示する。
  - _Requirements: 2.1, 2.2, 2.3_
- [x] 2.2 `PostCard` からダイアログを表示する。
  - 検証: `npx playwright test tests/e2e/intentShare.spec.ts`
  - E2E: `tests/e2e/intentShare.spec.ts` 投稿直後のダイアログでXとタイッツーを続けて選ぶ → ダイアログが閉じず、閉じる・背景クリック・Escキーで閉じる
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. entryの無い投稿のボタン
- [x] 3.1 `PostCardEntryActions` でダイアログを開くボタンを常に表示する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/intentShare.spec.ts` ゲスト表示でentryの無い投稿のカードを表示する → ダイアログを開くボタンが表示される
  - _Requirements: 3.3_
