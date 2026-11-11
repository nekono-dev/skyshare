/**
 * フィードバック送信内容の契約を定義する。
 *
 * - 業務の処理から参照される基盤の契約として、業務領域に依存しない。
 */
import type { Reproducibility } from "@/lib/api/contract/feedbackLimits"

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
