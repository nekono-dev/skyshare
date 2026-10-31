/**
 * フィードバック（不具合の報告・機能の提案）の送信内容の型。
 *
 * 責務と処理概要:
 * - Issue の本文を作る処理（`issueContent.ts`）が受け取る形を定める。
 * - API のスキーマ（`api/schema/v2/feedback/post.ts`）の推論結果は、この型に代入可能であることを、api 側の型検査で確かめる。
 *   feedback は api を import しない（依存の向きは lib/api → lib/feedback の一方向）。
 *
 * 実装上の制約:
 * - 型だけを持つ。実行時の処理と import を持たない（`limits.ts` の型は参照してよい）。
 */
import type { Reproducibility } from "./limits"

/** 画面が自動で集めた環境の情報。 */
export type FeedbackEnvironment = {
    os: string
    browser: string
    userAgent: string
    standalone: boolean
    version: string
    commit: string
}

/** 送信内容の共通部分。 */
type FeedbackCommon = {
    title: string
    environment: FeedbackEnvironment
}

/** 不具合の報告。 */
export type BugSubmission = FeedbackCommon & {
    kind: "bug"
    steps: string
    reproducibility: Reproducibility
}

/** 機能の提案。 */
export type EnhancementSubmission = FeedbackCommon & {
    kind: "enhancement"
    description: string
    technicalNotes?: string
}

/** 送信内容（`kind` で判別する）。 */
export type FeedbackSubmission = BugSubmission | EnhancementSubmission
