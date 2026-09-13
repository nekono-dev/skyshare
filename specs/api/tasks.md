# API全体におけるlexicon（AT Protocolレコード）の扱い方 タスク一覧

対応する要件定義書: [`requirements.md`](./requirements.md) / 設計書: [`design.md`](./design.md)

本書が定める横断的な設計パターンは、個別APIの実装（各featureのtasks.md）を通じて実現される。新しいエンドポイント・lexiconを追加する際は、以下のPhaseで本書への適合を確認する。

## Phase 1: 新規エンドポイント追加時の適合確認

- [ ] クライアント指定のat://URIを操作対象にする場合、所有権検証（FR-1）を経由しているか確認する。
- [ ] 複数lexiconレコードにまたがる作成・削除を行う場合、`applyWrites`による原子性（FR-2）を満たしているか確認する。
- [ ] 複雑な公式lexicon型をクライアントに直接露出させていないか、簡略化スキーマ（FR-3）の要否を検討する。
- [ ] スレッド関連の制約値を新設する場合、既存の共有定数（FR-4、`MAX_THREAD_POST_COUNT`等）を再利用しているか確認する。
- [ ] `[TEST]` 上記の適合確認項目を、新規エンドポイントの受け入れ条件テスト（各featureのtasks.md）に含める。

## 参考: 現在この横断パターンに従っている実装

| パターン | 実装箇所 | 実装作業を管理するtasks.md |
|---|---|---|
| 所有権検証（FR-1） | [src/lib/entry/url.ts](../../src/lib/entry/url.ts)の`parseOwnedAtUri` | [specs/entry/backend/tasks.md](../entry/backend/tasks.md) |
| 原子的な複数レコード書き込み（FR-2） | [src/lib/entry/createBskyThread.ts](../../src/lib/entry/createBskyThread.ts) | [specs/threadpost/tasks.md](../threadpost/tasks.md) |
| lexicon簡略化（FR-3） | [src/lib/atproto/gate.ts](../../src/lib/atproto/gate.ts)のbuilder関数群 | [specs/entry/backend/tasks.md](../entry/backend/tasks.md) |
| スレッド上限値の共有（FR-4） | [src/lib/atproto/post.ts](../../src/lib/atproto/post.ts)の`MAX_THREAD_POST_COUNT` | [specs/entry/backend/tasks.md](../entry/backend/tasks.md)（前提条件として実装済み） |
