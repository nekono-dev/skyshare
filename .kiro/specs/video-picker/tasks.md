# Implementation Plan

- [x] 1. 検査と読み取り
- [x] 1.1 `probeVideo.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/video/probeVideo.test.ts`
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. 添付とプレビュー
- [x] 2.1 `VideoPicker` と `MediaThumb` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
- [x] 2.2 排他・投稿の抑止・ドロップを `ThreadSegmentForm` と `segments.ts` に実装する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
- [x] 2.3 アップロードの失敗の後も本文が残ることを確認するE2Eテストを追加する。
  - 検証: `npx vitest run tests/components/post/ThreadComposer/segments.test.ts`
  - E2E: `tests/e2e/videoComposer.spec.ts` 動画を選んで変換の完了を待つ → 進捗が表示され、完了まで投稿ボタンが無効で理由が表示される
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
