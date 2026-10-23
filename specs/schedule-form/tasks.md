# 予約投稿の画面 タスク一覧

## Phase 1: 日時と状態と文言

- 対応: D-1, D-6, D-9
- [x] T-1.1: `src/lib/schedule/runAtInput.ts` に日時の既定値・変換・範囲の判定を実装する。
- [x] T-1.2: 日本語と英語の辞書に `schedule` 名前空間を追加し、`scheduleErrorKey.ts` を実装する。
- [x] T-1.3: 日時の既定値を翌日の同時刻に改め、`formatRunAtLabel` を追加する。
- [x] T-1.4: `src/lib/schedule/scheduleMode.ts` に予約の状態の遷移と判定を実装する。
- [x] T-1.5: 404 の文言を加え、不要になった認証情報の使用中の文言を辞書と判定から除く。
- [x] T-1.6: 受け入れ条件 AC-6、AC-7、AC-11、AC-20 の単体テストをタグ付きで更新する。
- [x] T-1.7: 失敗の予約から書き戻した入力の履歴の識別子を投稿フォームが持ち、投稿か予約の成功で履歴を削除する。
- 検証: `npx vitest run tests/lib/schedule/runAtInput.test.ts tests/lib/schedule/scheduleMode.test.ts tests/lib/i18n/messages.test.ts`

## Phase 2: 設定と認証情報

- 対応: D-2, D-3, D-4
- [x] T-2.1: `src/lib/schedule/useScheduleAvailability.ts` に登録状態と制限値の取得と通知の購読を実装する。
- [x] T-2.2: 認証情報の入力を `src/components/schedule/CredentialDialog/index.tsx` に移し、文言を3行に絞る。
- [x] T-2.3: `src/components/schedule/ScheduleSetting/index.tsx` を実装し、設定の投稿フォームのグループに置く。
- [x] T-2.4: 受け入れ条件 AC-1 から AC-4、AC-21、AC-23、AC-27 の E2E をタグ付きで追加する。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/scheduleSetting.spec.ts` 設定の予約投稿をオンにしてアプリパスワードを登録し、次にオフにする → 登録後にオンになり、オフの確認を承諾するとオフになる

## Phase 3: 日時の指定と送信

- 対応: D-5, D-7
- [x] T-3.1: `src/components/schedule/RunAtPicker/index.tsx` と CSS モジュールを実装する。
- [x] T-3.2: `src/lib/schedule/submitSchedule.ts` に作成・置き換え・取消・編集用の内容の取得を実装する。
- [x] T-3.3: 予約ダイアログと `scheduleDialogState.ts` を削除する。
- [x] T-3.4: 受け入れ条件 AC-5、AC-8 から AC-10、AC-22 の E2E をタグ付きで追加する。
- [x] T-3.5: 動画を含むときのカレンダーのボタンを確認ダイアログに改め、日時の設定中は動画のボタンを無効にする。
- [x] T-3.6: 受け入れ条件 AC-24、AC-25 の E2E をタグ付きで追加する。
- 検証: `npx vitest run tests/lib/schedule/submitSchedule.test.ts`
- E2E: `tests/e2e/scheduleComposer.spec.ts` 投稿フォームでカレンダーのボタンから日時を設定して予約を押す → 既定値が翌日の同時刻で、ボタンが予約になり、作成が1回呼ばれて本文が空になる

## Phase 4: 予約のタブと編集

- 対応: D-8
- [x] T-4.1: `src/components/schedule/ScheduleList/index.tsx` を予約のタブの中身に改め、待機中の行の選択を加える。
- [x] T-4.2: `src/pages/schedules.astro` と設定ページの一覧への導線を削除する。
- [x] T-4.3: 受け入れ条件 AC-12 から AC-19 の E2E をタグ付きで追加する。
- [x] T-4.4: 成功の履歴と投稿へのリンクを除き、失敗の予約に書き戻しの操作を加える。
- [x] T-4.5: 受け入れ条件 AC-26 の E2E をタグ付きで追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/scheduleList.spec.ts` 下書き・予約の予約のタブで待機中の予約を選び、キャンセルして予約を取り消す → 内容がフォームに戻り、3択の確認の後に取消が呼ばれてフォームが空になる
