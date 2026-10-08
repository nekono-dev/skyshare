# クリエイターモードのentry詳細設定 タスク一覧

## Phase 1: 指定の状態とパネル

- 対応: D-1
- [ ] T-1.1: `entryManifest.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
- [ ] T-1.2: `EntryManifestPanel` を実装し、ツールの一覧に登録する。
- 検証: `npx vitest run tests/lib/postFeatures/entryManifest.test.ts`
- E2E: `tests/e2e/creatorEntryManifest.spec.ts` 画像を自分で添付をONにする → entry詳細設定のツールが無効になる

## Phase 2: 送信への反映

- 対応: D-2
- [ ] T-2.1: `submitThread` で素材のセグメントの指定を見出し・説明文・代表画像に反映する。
- 検証: `npx vitest run tests/components/post/ThreadComposer/submitThread.test.ts`
- E2E: `tests/e2e/creatorEntryManifest.spec.ts` 見出しとカバー画像を指定して画像の投稿をする → 送信される見出しと代表画像が指定した値になる
