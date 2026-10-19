# 予約投稿の画面 タスク一覧

## Phase 1: 日時と文言

- 対応: D-1, D-6
- [ ] T-1.1: `src/lib/schedule/runAtInput.ts` に日時の既定値・変換・範囲の判定を実装する。
- [ ] T-1.2: 日本語と英語の辞書に `schedule` 名前空間を追加する。
- [ ] T-1.3: 受け入れ条件 AC-2、AC-3、AC-11、AC-13 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/schedule/runAtInput.test.ts tests/lib/i18n/messages.test.ts`

## Phase 2: 予約ダイアログ

- 対応: D-2, D-3
- [ ] T-2.1: `src/components/ScheduleDialog/index.tsx` と CSS モジュールに、状態遷移と日時の入力を実装する。
- [ ] T-2.2: 認証情報の登録フォームを非モーダルのダイアログで実装する。
- [ ] T-2.3: 投稿フォームの要件と設計に、予約ダイアログを開く導線を追記する。
- [ ] T-2.4: 受け入れ条件 AC-1、AC-4 から AC-6、AC-12、AC-14、AC-15 のテストをタグ付きで追加する。
- 検証: `npx vitest run -c vitest.astro.config.ts tests/components/ScheduleDialog.test.tsx`
- E2E: `tests/e2e/scheduleDialog.spec.ts` 投稿フォームで本文を入力して予約を選ぶ → 日時の既定値が1時間後で、未登録なら先にパスワードの入力が現れ、成功後に一覧への案内が表示される

## Phase 3: 予約の一覧

- 対応: D-4, D-5
- [ ] T-3.1: `src/components/ScheduleList/index.tsx` と CSS モジュールに一覧・取消・履歴の削除を実装する。
- [ ] T-3.2: 認証情報の登録状態の表示と削除を実装する。
- [ ] T-3.3: `src/pages/schedules.astro` を作成し、ヘッダーの導線を追加する。
- [ ] T-3.4: 受け入れ条件 AC-7 から AC-10 のテストをタグ付きで追加する。
- 検証: `npx vitest run -c vitest.astro.config.ts tests/components/ScheduleList.test.tsx`
- E2E: `tests/e2e/scheduleList.spec.ts` 予約の一覧のページを開いて待機中の予約を取消す → 確認の後に行が消え、失敗の予約に理由が表示される
