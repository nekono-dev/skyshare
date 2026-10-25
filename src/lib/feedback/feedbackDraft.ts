/**
 * 不具合の報告と機能の提案のフォームの入力の状態と、送信の本文の組み立て。
 *
 * 責務と処理概要:
 * - 両方の種別の入力を1つの状態に持ち、種別を切り替えても他の種別の入力を残す。
 * - 種別に合う必須の項目がそろい、すべての欄が上限以内かを判定する（送信のボタンの可否）。
 * - 種別に合う項目だけを載せた、受付の API の本文を組み立てる。
 * - 文字数の数え方と上限は受付と共有する（`./limits`）。
 */
import type { CreateFeedbackBody } from "@/client/openapi/model"
import type { ClientEnvironment } from "@/util/clientEnvironment"
import {
    FEEDBACK_LIMITS,
    countFeedbackLength,
    type Reproducibility,
} from "./limits"

export type FeedbackKind = "bug" | "enhancement"
export type { Reproducibility }

export type FeedbackDraft = {
    kind: FeedbackKind
    title: string
    /** 不具合: 操作した内容 */
    steps: string
    /** 不具合: もう一度操作して同じことが起きるか。未選択は null */
    reproducibility: Reproducibility | null
    /** 新機能の提案: どのような機能か */
    description: string
    /** 新機能の提案: 技術的な補足（任意） */
    technicalNotes: string
}

/**
 * 空の入力を作る。
 *
 * Input:
 * - `kind`: 種別（省略時は不具合）
 *
 * Output:
 * - すべての欄が空で、再現の頻度が未選択の `FeedbackDraft`
 *
 * 例:
 * - 入力: `emptyDraft("enhancement")` → 出力: `{ kind: "enhancement", title: "", ... }`
 */
export const emptyDraft = (kind: FeedbackKind = "bug"): FeedbackDraft => ({
    kind,
    title: "",
    steps: "",
    reproducibility: null,
    description: "",
    technicalNotes: "",
})

const isFilled = (text: string): boolean => text.trim() !== ""
const withinLimit = (text: string, max: number): boolean =>
    countFeedbackLength(text) <= max

/**
 * 入力を送信できるかを判定する。
 *
 * 処理の趣旨:
 * - 件名と、種別ごとの必須の項目（不具合: 操作した内容と再現の頻度、提案: 機能の内容）が空白だけでないこと。
 * - 種別に合う欄（任意の技術的な補足を含む）が上限以内であること。他の種別の欄は送らないため判定しない。
 *
 * Input:
 * - `draft`: 入力の状態
 *
 * Output:
 * - 送信できるなら true
 *
 * 例:
 * - 入力: `{ kind: "bug", title: "落ちる", steps: "送信した", reproducibility: "always", ... }` → 出力: true
 * - 入力: `{ kind: "bug", title: " ", ... }` → 出力: false
 */
export const isDraftSubmittable = (draft: FeedbackDraft): boolean => {
    const { title: titleMax, text: textMax } = FEEDBACK_LIMITS
    if (!isFilled(draft.title) || !withinLimit(draft.title, titleMax)) {
        return false
    }
    if (draft.kind === "bug") {
        return (
            isFilled(draft.steps) &&
            withinLimit(draft.steps, textMax) &&
            draft.reproducibility !== null
        )
    }
    return (
        isFilled(draft.description) &&
        withinLimit(draft.description, textMax) &&
        withinLimit(draft.technicalNotes, textMax)
    )
}

/**
 * 入力と環境の情報から、受付の API の本文を組み立てる。
 *
 * 処理の趣旨:
 * - 種別に合う項目だけを載せる（受付は他の種別の項目を拒否するため）。
 * - 技術的な補足は空白だけなら省く。
 * - 呼び出し側は `isDraftSubmittable` が true のときだけ呼ぶ（再現の頻度が未選択なら "untested" とする）。
 *
 * Input:
 * - `draft`: 入力の状態
 * - `env`: 集めた環境の情報
 * - `build`: 画面のビルドの版とコミット
 *
 * Output:
 * - `CreateFeedbackBody`
 *
 * 例:
 * - 入力: `({ kind: "enhancement", title: "t", description: "d", technicalNotes: " ", ... }, env, build)`
 * - 出力: `{ kind: "enhancement", title: "t", description: "d", environment: {...} }`
 */
export const toFeedbackRequest = (
    draft: FeedbackDraft,
    env: ClientEnvironment,
    build: { version: string; commit: string | null },
): CreateFeedbackBody => {
    // 受付の長さの上限を超える識別文字列で送信が拒否されないよう、上限で切り詰める
    const environment = {
        os: env.os.slice(0, 100),
        browser: env.browser.slice(0, 100),
        userAgent: env.userAgent.slice(0, 1000),
        standalone: env.standalone,
        version: build.version,
        commit: build.commit ?? "",
    }
    if (draft.kind === "bug") {
        return {
            kind: "bug",
            title: draft.title,
            steps: draft.steps,
            reproducibility: draft.reproducibility ?? "untested",
            environment,
        }
    }
    return {
        kind: "enhancement",
        title: draft.title,
        description: draft.description,
        ...(isFilled(draft.technicalNotes)
            ? { technicalNotes: draft.technicalNotes }
            : {}),
        environment,
    }
}
