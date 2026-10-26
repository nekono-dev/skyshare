# Implementation Plan

- [x] 1. 配置
- [x] 1.1 `galleryLayout.ts` と `ImageGallery` を実装し、配置の単体テストを追加する。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 3.2, 3.3, 4.3_
- [x] 1.2 サムネイルの代替テキストを確認するE2Eテストを追加する。
  - 検証: `npx vitest run tests/lib/image/galleryLayout.test.ts tests/components/image/ImageGallery.test.ts`
  - E2E: `tests/e2e/imageGallery.spec.ts` 画像3枚と5枚の投稿を表示する → 3枚は2:1の左1枚右2枚、5枚は高さ固定の横スクロールになる
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 3.2, 3.3, 4.3_

- [x] 2. 拡大表示
- [x] 2.1 `ImageLightbox` を実装する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/imageGallery.spec.ts` サムネイルを押して矢印キーとスワイプで切り替え、Escキーで閉じる → 位置表示が変わり、閉じるとサムネイルにフォーカスが戻る
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3_

- [x] 3. タイムラインの画像
- [x] 3.1 `PostCard` でentryの有無に応じて表示する画像を選ぶ。
  - _Requirements: 4.1, 4.2_
- [x] 3.2 entryを持つ投稿の代表画像が拡大しないことを確認するE2Eテストを追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/imageGallery.spec.ts` タイムラインでentryを持つ投稿の画像を押す → 拡大表示が開かない
  - _Requirements: 4.1, 4.2_
