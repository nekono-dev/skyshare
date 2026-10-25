/**
 * 不具合の報告と機能の提案の入力の制約値。
 *
 * 責務と処理概要:
 * - 受付の API のスキーマと、画面の文字数カウンタ・送信の可否の判定が同じ値を使うために置く。
 * - 画面のバンドルにも入るため、zod などの重い依存を import しない。
 */

/** 書記素で数えた文字数の上限（件名と、本文の各項目） */
export const FEEDBACK_LIMITS = { title: 100, text: 2000 } as const

/** 不具合の再現の頻度（毎回起きる・ときどき起きる・起きない・試していない） */
export const REPRODUCIBILITY_VALUES = [
    "always",
    "sometimes",
    "no",
    "untested",
] as const

export type Reproducibility = (typeof REPRODUCIBILITY_VALUES)[number]

/**
 * 件名と本文の文字数を、書記素（結合文字を含む絵文字を1文字）で数える。
 *
 * 処理の趣旨:
 * - 受付のスキーマ（Node で動くコード生成からも読み込まれる）と画面のカウンタが同じ数え方をするため、
 *   依存のないこのファイルに置く。Intl.Segmenter がない環境では UTF-16 の長さで数える。
 *
 * Input:
 * - `text`: 数える文字列
 *
 * Output:
 * - 書記素の数
 *
 * 例:
 * - 入力: "👨‍👩‍👧" → 出力: 1
 */
export const countFeedbackLength = (text: string): number => {
    try {
        const segmenter = new Intl.Segmenter("ja-JP", {
            granularity: "grapheme",
        })
        return Array.from(segmenter.segment(text)).length
    } catch {
        return text.length
    }
}
