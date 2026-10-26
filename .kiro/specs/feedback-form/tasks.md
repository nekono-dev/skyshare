# Implementation Plan

- [x] 1. 環境の情報と入力の状態
- [x] 1.1 `clientEnvironment.ts` の `parseUserAgent`・`detectStandalone`・`collectClientEnvironment` を実装する。
  - _Requirements: 2.1, 2.3, 2.4, 2.6, 3.2_
- [x] 1.2 `feedbackDraft.ts` の `emptyDraft`・`isDraftSubmittable`・`toFeedbackRequest` を実装する。
  - _Requirements: 2.1, 2.3, 2.4, 2.6, 3.2_
- [x] 1.3 単体テストを受け入れ条件のタグ付きで追加する。
  - 検証: `npx vitest run tests/util/clientEnvironment.test.ts tests/lib/feedback/feedbackDraft.test.ts`
  - _Requirements: 2.1, 2.3, 2.4, 2.6, 3.2_

- [x] 2. フォームとページ
- [x] 2.1 日本語・英語の辞書 `feedback` とページの題名を追加する。
  - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.5, 3.1, 4.1, 4.2_
- [x] 2.2 `FeedbackForm` のコンポーネントと `feedback.astro` を実装する。
  - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.5, 3.1, 4.1, 4.2_
- [x] 2.3 設定のページのヘルプへのリンクの下に報告と提案へのリンクを置く。
  - 検証: `npx tsc --noEmit`
  - E2E: `tests/e2e/feedbackForm.spec.ts` 設定のページのリンクから開いて種別を切り替えて送信する → 入力欄が切り替わり、Issue へのリンクが表示される
  - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.5, 3.1, 4.1, 4.2_
