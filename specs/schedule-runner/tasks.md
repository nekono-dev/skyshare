# 予約投稿の実行 タスク一覧

## Phase 1: 通信と採番

- 対応: D-3
- [x] T-1.1: `src/lib/schedule/xrpcClient.ts` に予算つきの通信と応答の分類を実装する。
- [x] T-1.2: `src/lib/schedule/tid.ts` に TID の採番を実装し、単調増加の単体テストを追加する。
- [x] T-1.3: 受け入れ条件 AC-12、AC-14、AC-17 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/schedule/xrpcClient.test.ts tests/lib/schedule/tid.test.ts`

## Phase 2: 予約の実行

- 対応: D-4, D-5
- [x] T-2.1: `src/lib/schedule/executor.ts` に認証の更新と画像のアップロードを実装する。
- [x] T-2.2: 投稿・制限・entry を順次作成する段階を実装し、進捗を保存する。
- [x] T-2.3: 失敗の分類と再試行の分岐を実装する。
- [x] T-2.4: 受け入れ条件 AC-2 から AC-9 と AC-15 のテストをタグ付きで追加する。
- [ ] T-2.5: 認証の失効で認証情報を削除し、成功時の不要な認証情報の削除をやめ、AC-8 のテストを更新する。
- 検証: `npx vitest run tests/lib/schedule/executor.test.ts`

## Phase 3: 定期実行とエントリ

- 対応: D-1, D-2
- [x] T-3.1: `src/lib/schedule/runner.ts` に復帰・取り出し・実行・後片付けを実装する。
- [x] T-3.2: `src/worker.ts` を作成し、`wrangler.template.jsonc` に `main` とトリガーとバインディングを追加する。
- [x] T-3.3: 受け入れ条件 AC-1、AC-10、AC-11、AC-13、AC-16 のテストをタグ付きで追加する。
- [ ] T-3.4: 後片付けに30日の未使用の認証情報の削除を加え、AC-11 のテストを更新する。
- 検証: `npx vitest run tests/lib/schedule/runner.test.ts && npm run build`
