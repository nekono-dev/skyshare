# Implementation Plan

- [x] 1. 認証情報とログイン
- [x] 1.1 認証情報の読み込みと、ライブテストのプロジェクトの登録を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 7.1, 7.2_
- [x] 1.2 テスト開始前のログインと、ログイン状態・ログインフォームの検証を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 7.1, 7.2_
- [x] 1.3 設定ファイルとログイン状態の保存先をGitの無視対象にし、アプリ本体への混入を検査するテストを追加する。
  - 検証: `npx vitest run tests/lib/e2e tests/repo`
  - E2E: `tests/e2e/live/loginForm.spec.ts` ログイン画面のフォームに認証情報を入力して送信する → トップページへ遷移しセッションが確立される
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 7.1, 7.2_

- [x] 2. PDSの直接操作と後始末
- [x] 2.1 PDSの直接操作（作成・削除・掃除）と削除対象の選別を実装し、選別の単体テストを追加する。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4_
- [x] 2.2 終了時の自動削除、事前掃除、手動の掃除コマンドを実装する。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4_
- [x] 2.3 後始末と掃除を検証するライブテストを追加する。
  - 検証: `npx vitest run tests/lib/e2e`
  - E2E: `tests/e2e/live/cleanup.spec.ts` 識別子付きの投稿を作って終了時の削除と掃除を実行する → 古い投稿だけが削除される
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4_

- [x] 3. 投稿から削除までの検証
- [x] 3.1 スレッド投稿から削除までのライブテストを追加する。
  - _Requirements: 5.1, 5.2, 5.3_
- [x] 3.2 5枚の画像の投稿と、visualが先頭4枚から作られることのライブテストを追加する。
  - _Requirements: 5.1, 5.2, 5.3_
- [x] 3.3 mp4・mov・webmの動画投稿のライブテストを追加する。
  - 検証: `npx playwright test --project=live-setup --project=live threadEntry multiImage video`
  - E2E: `tests/e2e/live/threadEntry.spec.ts` 画像付きの3件のスレッドを投稿して削除する → entryが1件作られ、削除の確定で3件とも消える
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. 事後entry作成と削除フロー
- [x] 4.1 画像投稿・スレッド・動画の事後entry作成のライブテストを追加する。
  - _Requirements: 6.1, 6.2, 6.3, 6.4_
- [x] 4.2 削除フロー、旧実装のentry、分岐したスレッドのライブテストを追加する。
  - 検証: `npx playwright test --project=live-setup --project=live postHocEntry visualSource deleteFlow branch`
  - E2E: `tests/e2e/live/deleteFlow.spec.ts` 削除の最終確認でキャンセルして再度開き確定する → 一覧が再表示され投稿が消える
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 5. 第三者の返信
- [x] 5.1 第三者アカウントの読み込みと、第三者の返信が残ることのライブテストを追加する。
  - 検証: `npx playwright test --project=live-setup --project=live peerReply`
  - E2E: `tests/e2e/live/peerReply.spec.ts` 第三者が返信した後にルートを削除する → 第三者の返信が残る
  - _Requirements: 6.5_
