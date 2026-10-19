# 予約ストア タスク一覧

## Phase 1: 型とスキーマ

- 対応: D-1
- [x] T-1.1: `src/lib/schedule/types.ts` に予約の型・状態・上限値を定義する。
- [x] T-1.2: `migrations/0001_schedule.sql` に2つのテーブルと索引を作成する。
- [x] T-1.3: D1 互換の SQLite アダプタを `tests/helpers/fakeD1.ts` に作成し、マイグレーションを適用できるようにする。
- 検証: `npx vitest run tests/lib/schedule/types.test.ts`

## Phase 2: 予約の保存と取り出し

- 対応: D-2, D-3, D-4
- [x] T-2.1: `src/lib/schedule/store.ts` に保存・取得・一覧・削除・件数の関数を実装する。
- [x] T-2.2: 取り出し・進捗の保存・待機への戻し・終了の関数を実装し、取り出しを1文の更新にする。
- [x] T-2.3: 停止した予約の復帰と履歴の削除を実装する。
- [x] T-2.4: 受け入れ条件 AC-1 から AC-4、AC-8 から AC-11、AC-13、AC-14 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/schedule/store.test.ts`

## Phase 3: 認証情報と画像

- 対応: D-5, D-6
- [x] T-3.1: `src/lib/schedule/credentialCrypto.ts` に暗号化と復号を実装する。
- [x] T-3.2: `store.ts` に認証情報の保存・読み出し・不要時の削除を実装する。
- [x] T-3.3: `src/lib/schedule/imageStaging.ts` に画像の保管と削除を実装する。
- [x] T-3.4: 受け入れ条件 AC-5 から AC-7、AC-12 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/schedule/credentialCrypto.test.ts tests/lib/schedule/imageStaging.test.ts`
