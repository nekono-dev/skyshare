# entryの代表画像と見出し タスク一覧

## Phase 1: 合成と再生ボタン

- 対応: D-1, D-2
- [x] T-1.1: `postImageProcessing.ts` に先頭4枚の合成と overlay を実装する。
- [x] T-1.2: `videoOverlay.ts` を実装し、単体テストを受け入れ条件のタグ付きで追加する。
- [x] T-1.3: iPhone AirのXアプリのスクリーンショットを実測し、referenceCardWidthを342pxに更新する。
- 検証: `npx vitest run tests/lib/image/postImageProcessing.test.ts tests/lib/video/videoOverlay.test.ts`

## Phase 2: サムネ調整

- 対応: D-3
- [x] T-2.1: `ThumbnailAdjustButton` を切り出し、`ImageCropDialog` に overlay を追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/videoComposer.spec.ts` 動画を添付してサムネ調整で切り抜きを変える → アップロード中でも調整でき、プレビューの再生ボタンの位置が変わらない

## Phase 3: 見出しと既存の投稿

- 対応: D-4
- [x] T-3.1: `entryText.ts`・`formatVideoDuration.ts`・`fetchVideoDuration.ts`・`createPostVisual.ts` を実装する。
- [x] T-3.2: 見出し・再生時間・既存の投稿の代表画像の単体テストを追加する。
- 検証: `npx vitest run tests/lib/entry/entryText.test.ts tests/lib/entry/createPostVisual.test.ts tests/lib/video/fetchVideoDuration.test.ts`
