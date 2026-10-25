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
- [x] T-2.5: 待機中の予約の置き換えと一括削除を実装し、AC-15 と AC-17 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/schedule/store.test.ts`

## Phase 3: 認証情報と画像

- 対応: D-5, D-6
- [x] T-3.1: `src/lib/schedule/credentialCrypto.ts` に暗号化と復号を実装する。
- [x] T-3.2: `store.ts` に認証情報の保存・読み出し・不要時の削除を実装する。
- [x] T-3.3: `src/lib/schedule/imageStaging.ts` に画像の保管と削除を実装し、AC-5 から AC-7、AC-12 のテストをタグ付きで追加する。
- [x] T-3.4: 使用時刻の更新・未使用と失効での再度の許可が必要な印への置き換え・印の削除・指示による削除に改め、AC-6・AC-16・AC-21 のテストを更新・追加する。
- [x] T-3.5: `imageStaging.ts` に世代つきのキーと画像の読み出しを実装し、AC-18 のテストをタグ付きで追加する。
- [x] T-3.6: `DEVELOP.md` のライフサイクルを15日に改め、AC-19 のテストをタグ付きで追加する。
- [x] T-3.7: 認可の途中の状態の保管と取り出しを加え、AC-20 のテストをタグ付きで追加する。
- [x] T-3.8: `migrations/0005_schedule_owner_index.sql` で予約の所有者の索引に `run_at` を加え、AC-22 のテストをタグ付きで追加する。
- 検証: `npx vitest run tests/lib/schedule/credentialCrypto.test.ts tests/lib/schedule/imageStaging.test.ts tests/lib/schedule/store.test.ts tests/lib/schedule/ownerIndex.test.ts`
