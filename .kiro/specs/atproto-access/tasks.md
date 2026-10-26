# Implementation Plan

- [x] 1. エージェントとblob
- [x] 1.1 `agentFactory.ts`・`publicAgent.ts`・`blob.ts` を実装する。
  - _Requirements: 1.1, 1.2_
- [x] 1.2 blobのアップロードの単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/atproto/blob.test.ts`
  - _Requirements: 1.1, 1.2_

- [x] 2. 全件取得と参照
- [x] 2.1 `repo.ts`・`profile.ts`・`lists.ts` を実装する。
  - _Requirements: 2.1, 3.1, 3.2, 3.3_
- [x] 2.2 全件取得・表示名・リストの単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/atproto/repo.test.ts tests/lib/atproto/profile.test.ts tests/lib/atproto/lists.test.ts`
  - _Requirements: 2.1, 3.1, 3.2, 3.3_

- [x] 3. PDSの解決
- [x] 3.1 `did.ts` を実装する。
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
- [x] 3.2 PDSの取り出しと解決の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/atproto/did.test.ts`
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
