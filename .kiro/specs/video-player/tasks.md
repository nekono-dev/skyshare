# Implementation Plan

- [x] 1. 抽出と表示
- [x] 1.1 動画の抽出と、`VideoThumbnail`・`VideoPlayButton`・`PostBody` の切り替えを実装する。
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 3.1_
- [x] 1.2 代替テキストと他のクライアントの動画の表示を確認するテストを追加する。
  - 検証: `npx vitest run tests/lib/entry/entry.test.ts tests/components/video/VideoThumbnail.test.ts`
  - E2E: `tests/e2e/videoDisplay.spec.ts` ゲスト表示のタイムラインを開く → 動画の投稿がposterと再生ボタンで表示され、再生されない
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 3.1_

- [x] 2. 再生
- [x] 2.1 `VideoPlayer` を実装し、`hls.js` を再生時に読み込む。
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5_
- [x] 2.2 Firefox と Safari での再生を確認するE2Eテストを追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/videoDisplay.spec.ts` サンプルのentryページで再生ボタンを押す → 押す前は動画のデータが取得されず、押すと再生され、表示領域の大きさが変わらない
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. 再生できない動画
- [x] 3.1 `VideoUnavailable` を実装する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/videoDisplay.spec.ts` 引用投稿の動画を表示する → 暗いposterに文言とリンクが表示され、再生ボタンが無い
  - _Requirements: 3.1_
