# Implementation Plan

- [x] 1. 枚数とプレビュー
- [x] 1.1 `ImagePicker` の上限を10枚にし、通知と対象外のラベルを追加する。
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2_
- [x] 1.2 `MediaThumb` を切り出し、ボタンを大きく縁取り付きにする。
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2_
- [x] 1.3 4枚の投稿の代表画像が4枚の合成で作られることを確認するテストを追加する。
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2_
- [x] 1.4 外から渡された画像の組でスロットを組み立て、2.3 の E2E をタグ付きで追加する。
  - 検証: `npm run build`
  - E2E: `tests/e2e/multiImage.spec.ts` 11枚の画像を選んで先頭を取り外す → 10枚で止まり通知が出て、繰り上がった5枚目のラベルが消える
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2_

- [x] 2. 圧縮
- [x] 2.1 全画像を個別に圧縮し、単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/image/postImageProcessing.test.ts`
  - _Requirements: 4.1, 4.2_
