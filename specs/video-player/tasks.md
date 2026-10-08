# 動画の表示と再生 タスク一覧

## Phase 1: 抽出と表示

- 対応: D-1, D-2
- [x] T-1.1: 動画の抽出と、`VideoThumbnail`・`VideoPlayButton`・`PostBody` の切り替えを実装する。
- [ ] T-1.2: 代替テキストと他のクライアントの動画の表示を確認するテストを追加する。
- 検証: `npx vitest run tests/lib/entry/entry.test.ts`
- E2E: `tests/e2e/videoDisplay.spec.ts` ゲスト表示のタイムラインを開く → 動画の投稿がposterと再生ボタンで表示され、再生されない

## Phase 2: 再生

- 対応: D-3
- [x] T-2.1: `VideoPlayer` を実装し、`hls.js` を再生時に読み込む。
- [ ] T-2.2: Firefox と Safari での再生を確認するE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/videoDisplay.spec.ts` サンプルのentryページで再生ボタンを押す → 押す前は動画のデータが取得されず、押すと再生され、表示領域の大きさが変わらない

## Phase 3: 再生できない動画

- 対応: D-4
- [x] T-3.1: `VideoUnavailable` を実装する。
- 検証: `npm run build`
- E2E: `tests/e2e/videoDisplay.spec.ts` 引用投稿の動画を表示する → 暗いposterに文言とリンクが表示され、再生ボタンが無い
