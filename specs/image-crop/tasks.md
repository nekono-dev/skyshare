# 画像の切り抜き表示 タスク一覧

## Phase 1: プレビューの表示

- 対応: D-1
- [x] T-1.1: `croppedImageStyle.ts` を実装する。
- [x] T-1.2: 算出の単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/lib/image/croppedImageStyle.test.ts`

## Phase 2: 切り抜きスロット

- 対応: D-2
- [x] T-2.1: `CropSlot/index.tsx` を実装し、切り抜きのダイアログへ組み込む。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/multiImage.spec.ts` ゲスト表示の投稿ページに6枚の画像を添付して切り抜きのダイアログを開く → 先頭4枚のスロットだけが表示される
