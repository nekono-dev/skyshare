# Implementation Plan

- [x] 1. 通信と採番
- [x] 1.1 `src/lib/schedule/xrpcClient.ts` に予算つきの通信と応答の分類を実装する。
  - _Requirements: 1.3, 3.1, 3.2, 6.1, 6.2_
- [x] 1.2 `src/lib/schedule/tid.ts` に TID の採番を実装し、単調増加の単体テストを追加する。
  - _Requirements: 1.3, 3.1, 3.2, 6.1, 6.2_
- [x] 1.3 受け入れ条件 3.2、1.3、6.2 のテストをタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/schedule/xrpcClient.test.ts tests/lib/schedule/tid.test.ts`
  - _Requirements: 1.3, 3.1, 3.2, 6.1, 6.2_

- [x] 2. 予約の実行
- [x] 2.1 `src/lib/schedule/executor.ts` に認証の更新と画像のアップロードを実装する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_
- [x] 2.2 投稿・制限・entry を順次作成する段階を実装し、進捗を保存する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_
- [x] 2.3 失敗の分類と再試行の分岐を実装する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_
- [x] 2.4 受け入れ条件 2.1 から 4.4, 4.5 と 3.4 のテストをタグ付きで追加する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_
- [x] 2.5 認証の失効で認証情報を削除し、成功時の不要な認証情報の削除をやめ、4.2, 4.3 のテストを更新する。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_
- [x] 2.6 認証の更新を OAuth の更新用トークンと DPoP に改め、2.1 と 2.2 のテストを更新・追加する。
  - 検証: `npx vitest run tests/lib/schedule/executor.test.ts`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3. 定期実行とエントリ
- [x] 3.1 `src/lib/schedule/runner.ts` に復帰・取り出し・実行・後片付けを実装する。
  - _Requirements: 1.1, 1.2, 3.5, 5.1, 5.2, 5.3_
- [x] 3.2 `src/worker.ts` を作成し、`wrangler.template.jsonc` に `main` とトリガーとバインディングを追加する。
  - _Requirements: 1.1, 1.2, 3.5, 5.1, 5.2, 5.3_
- [x] 3.3 受け入れ条件 1.1、3.5、5.1, 5.2、1.2、6.1 のテストをタグ付きで追加する。
  - _Requirements: 1.1, 1.2, 3.5, 5.1, 5.2, 5.3_
- [x] 3.4 後片付けに30日の未使用の認証情報の削除を加え、5.1, 5.2 のテストを更新する。
  - _Requirements: 1.1, 1.2, 3.5, 5.1, 5.2, 5.3_
- [x] 3.5 失効と未使用の認証情報を再度の許可が必要な印に替え、印の削除を加え、4.2, 4.3 と 5.1, 5.2 のテストを更新する。
  - _Requirements: 1.1, 1.2, 3.5, 5.1, 5.2, 5.3_
- [x] 3.6 後片付けを `runHousekeeping` に分けて `worker.ts` が1日1回だけ呼ぶ形に改め、5.1, 5.2 のテストを後片付けの呼び出しに合わせ、5.3 のテストをタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/schedule/runner.test.ts && npm run build`
  - _Requirements: 1.1, 1.2, 3.5, 5.1, 5.2, 5.3_
