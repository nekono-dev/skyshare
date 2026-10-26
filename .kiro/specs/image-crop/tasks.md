# Implementation Plan

- [x] 1. プレビューの表示
- [x] 1.1 `croppedImageStyle.ts` を実装する。
  - _Requirements: 1.1, 1.2_
- [x] 1.2 算出の単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/image/croppedImageStyle.test.ts`
  - _Requirements: 1.1, 1.2_

- [x] 2. 切り抜きスロット
- [x] 2.1 `CropSlot/index.tsx` を実装し、切り抜きのダイアログへ組み込む。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/multiImage.spec.ts` ゲスト表示の投稿ページに6枚の画像を添付して切り抜きのダイアログを開く → 先頭4枚のスロットだけが表示される
  - _Requirements: 2.1_
