# entry API タスク一覧

## Phase 1: 共通の検証と新規投稿

- 対応: D-1, D-2, D-3
- [x] T-1.1: 入力スキーマと共通の検証・エラー変換を実装する。
- [x] T-1.2: 埋め込みの組み立てと `createBskyThread` による原子的な作成を実装する。
- [x] T-1.3: 新規投稿とスレッドのハンドラテストを受け入れ条件のタグ付きで追加する。
- [ ] T-1.4: スレッドの上限の定数の共有と、APIドキュメントとスキーマの一致を確認するテストを追加する。
- 検証: `npx vitest run tests/pages/v2/entry.test.ts -t POST`

## Phase 2: 既存の投稿からの作成と編集

- 対応: D-4, D-5
- [x] T-2.1: `fromPost.ts` と PUT のハンドラを実装する。
- [x] T-2.2: 既存の投稿からの作成と編集のテストを追加する。
- 検証: `npx vitest run tests/pages/v2/entry.test.ts -t PUT`

## Phase 3: 削除

- 対応: D-6
- [x] T-3.1: `resolveDeleteTargets` と DELETE のハンドラを実装する。
- [x] T-3.2: 削除の各分岐のテストを追加する。
- 検証: `npx vitest run tests/pages/v2/entry.test.ts tests/lib/entry/resolveDeleteTargets.test.ts`
