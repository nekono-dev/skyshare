# 投稿先選択ダイアログ タスク一覧

## Phase 1: ダイアログ

- 対応: D-1
- [x] T-1.1: `IntentShareDialog` を実装する。
- [ ] T-1.2: entryのない投稿での選択肢の表示と、不正なMastodonドメインでの操作不能を確認するE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/intentShare.spec.ts` 不正なMastodonドメインを保存してタイムラインの投稿の共有ダイアログを開く → Mastodonの選択肢が操作不能で、他の3つは操作できる

## Phase 2: 呼び出し側

- 対応: D-2
- [x] T-2.1: `ThreadComposer` と `PostLauncher` から `keepOpenOnSelect` 付きでダイアログを表示する。
- [x] T-2.2: `PostCard` からダイアログを表示する。
- 検証: `npx playwright test tests/e2e/intentShare.spec.ts`
- E2E: `tests/e2e/intentShare.spec.ts` 投稿直後のダイアログでXとタイッツーを続けて選ぶ → ダイアログが閉じず、閉じる・背景クリック・Escキーで閉じる
