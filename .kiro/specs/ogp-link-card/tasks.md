# Implementation Plan

- [x] 1. 抽出APIとキャッシュの事前取得
- [x] 1.1 `warmOgpCache.ts` と抽出APIのスキーマを実装する。
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_
- [x] 1.2 事前取得とスキーマの単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/lib/entry/warmOgpCache.test.ts tests/lib/api/schema/extract.test.ts`
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

- [x] 2. 取得と表示
- [x] 2.1 `OgpFetchButton/index.tsx` と `OgpPreview/index.tsx` を実装し、投稿フォームへ組み込む。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/ogpLinkCard.spec.ts` ゲスト表示の投稿ページで本文にURLを入力して取得ボタンを押す → ボタンはURLがあるときだけ現れ、成功では取得済みの表示とプレビューが、失敗では失敗の表示が現れる
  - _Requirements: 1.1, 1.2, 1.3_
