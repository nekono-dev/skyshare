# 画像のサムネイルと拡大表示 タスク一覧

## Phase 1: 配置

- 対応: D-1, D-2
- [x] T-1.1: `galleryLayout.ts` と `ImageGallery` を実装し、配置の単体テストを追加する。
- [ ] T-1.2: サムネイルの代替テキストを確認するE2Eテストを追加する。
- 検証: `npx vitest run tests/lib/image/galleryLayout.test.ts`
- E2E: `tests/e2e/imageGallery.spec.ts` 画像3枚と5枚の投稿を表示する → 3枚は2:1の左1枚右2枚、5枚は高さ固定の横スクロールになる

## Phase 2: 拡大表示

- 対応: D-3
- [x] T-2.1: `ImageLightbox` を実装する。
- 検証: `npm run build`
- E2E: `tests/e2e/imageGallery.spec.ts` サムネイルを押して矢印キーとスワイプで切り替え、Escキーで閉じる → 位置表示が変わり、閉じるとサムネイルにフォーカスが戻る

## Phase 3: タイムラインの画像

- 対応: D-4
- [x] T-3.1: `PostCard` でentryの有無に応じて表示する画像を選ぶ。
- [ ] T-3.2: entryを持つ投稿の代表画像が拡大しないことを確認するE2Eテストを追加する。
- 検証: `npm run build`
- E2E: `tests/e2e/imageGallery.spec.ts` タイムラインでentryを持つ投稿の画像を押す → 拡大表示が開かない
