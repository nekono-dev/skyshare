# 予約投稿の画面 タスク一覧

## Phase 1: 日時と文言

- 対応: D-1, D-6
- [x] T-1.1: `src/lib/schedule/runAtInput.ts` と `scheduleDialogState.ts` を実装する。
- [x] T-1.2: 日本語と英語の辞書に `schedule` 名前空間を追加し、`scheduleErrorKey.ts` を実装する。
- [x] T-1.3: 受け入れ条件 AC-1 から AC-4、AC-11、AC-13、AC-15 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/schedule/runAtInput.test.ts tests/lib/i18n/messages.test.ts`

## Phase 2: 予約ダイアログ

- 対応: D-2, D-3
- [x] T-2.1: `src/components/schedule/ScheduleDialog/index.tsx` と CSS モジュールを実装し、投稿フォームに予約の操作を置く。
- [x] T-2.2: `src/components/schedule/CredentialForm/index.tsx` に登録フォームを実装する。
- [x] T-2.3: 投稿フォームの要件と設計に、予約ダイアログを開く導線を追記する。
- [x] T-2.4: 受け入れ条件 AC-4 から AC-6、AC-14、AC-15 の E2E をタグ付きで追加する。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/scheduleDialog.spec.ts` 投稿フォームで本文を入力して予約を選ぶ → 日時の既定値が1時間後で、未登録なら先にパスワードの入力が現れ、成功後に一覧への案内が表示される

## Phase 3: 予約の一覧

- 対応: D-4, D-5
- [x] T-3.1: `src/components/schedule/ScheduleList/index.tsx` と CSS モジュールに一覧・取消・履歴の削除を実装する。
- [x] T-3.2: 認証情報の登録状態の表示と削除を実装する。
- [x] T-3.3: `src/pages/schedules.astro` を作成し、設定ページに一覧への導線を追加する。
- [x] T-3.4: 受け入れ条件 AC-7 から AC-12 の E2E をタグ付きで追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/scheduleList.spec.ts` 予約の一覧のページを開いて待機中の予約を取消す → 確認の後に行が消え、失敗の予約に理由が表示される
