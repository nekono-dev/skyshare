# Implementation Plan

- [x] 1. 注と案内
- [x] 1.1 `InlineIcon` に画像と動画のアイコンを加え、予約投稿の下に注を置く。
  - _Requirements: 1.1, 2.1, 2.2, 3.1_
- [x] 1.2 Chronosky のロゴを同梱し、予約投稿の下に案内とリンクを置く。
  - _Requirements: 1.1, 2.1, 2.2, 3.1_
- [x] 1.3 日本語と英語の文言を加え、受け入れ条件 1.1 と 2.1, 2.2 の E2E をタグ付きで追加する。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/scheduleSetting.spec.ts` 設定のページを開く → 予約投稿の下に、画像と動画のアイコンつきの注と、Chronosky のロゴとリンクが表示される
  - _Requirements: 1.1, 2.1, 2.2, 3.1_
