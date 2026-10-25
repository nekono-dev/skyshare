# 不具合報告と機能提案のフォーム タスク一覧

## Phase 1: 環境の情報と入力の状態

- 対応: D-1, D-2
- [x] T-1.1: `clientEnvironment.ts` の `parseUserAgent`・`detectStandalone`・`collectClientEnvironment` を実装する。
- [x] T-1.2: `feedbackDraft.ts` の `emptyDraft`・`isDraftSubmittable`・`toFeedbackRequest` を実装する。
- [x] T-1.3: 単体テストを受け入れ条件のタグ付きで追加する。
- 検証: `npx vitest run tests/util/clientEnvironment.test.ts tests/lib/feedback/feedbackDraft.test.ts`

## Phase 2: フォームとページ

- 対応: D-3, D-4
- [x] T-2.1: 日本語・英語の辞書 `feedback` とページの題名を追加する。
- [x] T-2.2: `FeedbackForm` のコンポーネントと `feedback.astro` を実装する。
- [x] T-2.3: 設定のページのヘルプへのリンクの下に報告と提案へのリンクを置く。
- 検証: `npx tsc --noEmit`
- E2E: `tests/e2e/feedbackForm.spec.ts` 設定のページのリンクから開いて種別を切り替えて送信する → 入力欄が切り替わり、Issue へのリンクが表示される
