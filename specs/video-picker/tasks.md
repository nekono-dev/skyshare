# 動画の添付 タスク一覧

## Phase 1: 検査と読み取り

- 対応: D-1
- [x] T-1.1: `probeVideo.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/video/probeVideo.test.ts`

## Phase 2: 添付とプレビュー

- 対応: D-2, D-3
- [x] T-2.1: `VideoPicker` と `MediaThumb` を実装する。
- [x] T-2.2: 排他・投稿の抑止・ドロップを `ThreadSegmentForm` と `segments.ts` に実装する。
- [ ] T-2.3: アップロードの失敗の後も本文が残ることを確認するE2Eテストを追加する。
- 検証: `npx vitest run tests/components/post/ThreadComposer/segments.test.ts`
- E2E: `tests/e2e/videoComposer.spec.ts` 動画を選んで変換の完了を待つ → 進捗が表示され、完了まで投稿ボタンが無効で理由が表示される
