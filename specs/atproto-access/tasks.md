# atprotoデータ取得の共通処理 タスク一覧

## Phase 1: エージェントとblob

- 対応: D-1
- [x] T-1.1: `agentFactory.ts`・`publicAgent.ts`・`blob.ts` を実装する。
- [x] T-1.2: blobのアップロードの単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/atproto/blob.test.ts`

## Phase 2: 全件取得と参照

- 対応: D-2
- [x] T-2.1: `repo.ts`・`profile.ts`・`lists.ts` を実装する。
- [x] T-2.2: 全件取得・表示名・リストの単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/atproto/repo.test.ts tests/lib/atproto/profile.test.ts tests/lib/atproto/lists.test.ts`

## Phase 3: PDSの解決

- 対応: D-3
- [x] T-3.1: `did.ts` を実装する。
- [x] T-3.2: PDSの取り出しと解決の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/atproto/did.test.ts`
