# Implementation Plan

- [x] 1. 共通の検証と新規投稿
- [x] 1.1 入力スキーマと共通の検証・エラー変換を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.4, 2.5, 2.6, 3.2, 4.1, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5_
- [x] 1.2 埋め込みの組み立てと `createBskyThread` による原子的な作成を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.4, 2.5, 2.6, 3.2, 4.1, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5_
- [x] 1.3 新規投稿とスレッドのハンドラテストを受け入れ条件のタグ付きで追加する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.4, 2.5, 2.6, 3.2, 4.1, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5_
- [x] 1.4 スレッドの上限の定数の共有と、APIドキュメントとスキーマの一致を確認するテストを追加する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.4, 2.5, 2.6, 3.2, 4.1, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5_
- [x] 1.5 見出しと説明文の上限をバイト数で判定し、確認するテストを追加する。
  - 検証: `npx vitest run tests/pages/v2/entry.test.ts tests/lib/api/schema/threadLimit.test.ts tests/lib/api/schema/entryTextBytes.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.4, 2.5, 2.6, 3.2, 4.1, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2. 既存の投稿からの作成と編集
- [x] 2.1 `fromPost.ts` と PUT のハンドラを実装する。
  - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3_
- [x] 2.2 既存の投稿からの作成と編集のテストを追加する。
  - 検証: `npx vitest run tests/pages/v2/entry.test.ts -t PUT`
  - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3_

- [x] 3. 削除
- [x] 3.1 `resolveDeleteTargets` と DELETE のハンドラを実装する。
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
- [x] 3.2 削除の各分岐のテストを追加する。
  - 検証: `npx vitest run tests/pages/v2/entry.test.ts tests/lib/entry/resolveDeleteTargets.test.ts`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
