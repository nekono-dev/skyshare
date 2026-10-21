/**
 * twitter-text の重み付きカウントに基づく共有文の字数省略ユーティリティ。
 *
 * 責務と処理概要:
 * - 「本文 + 改行 + 末尾要素（URL等）」の形の共有文を、重み付き長が上限以内に
 *   収まるよう、本文のみを「...」付きで省略する。末尾要素が無い場合は本文のみを省略する。
 * - 末尾要素（URL等）は削らない。URL は twitter-text の規則で、長さに関わらず
 *   重み23として数えられる。
 */
import { xIntentMeasure, type IntentMeasure } from "@/util/share/intentLength"

/** 重み付き長の上限（全角140字相当。全角=2、半角=1、改行=1、URL=23として数える）。 */
export const INTENT_WEIGHTED_LIMIT = 280

/**
 * intent 先（Xなど）が共有文の末尾へ空白を1文字付け足すため、省略時に確保しておく
 * 重み付き長の余裕。上限ちょうどまで詰めると付け足された空白で溢れ、そのまま投稿できない。
 */
export const INTENT_TRAILING_MARGIN = 1

const ELLIPSIS = "..."

export type TruncateResult = {
    text: string
    /** 本文を省略した場合のみ true */
    truncated: boolean
}

/**
 * twitter-text（X）の重み付き長を返す（全角=2、半角=1、改行=1、URL=23）。
 * 宛先別の換算は `intentLength.ts` を参照。
 */
export const weightedLength: IntentMeasure = xIntentMeasure

/**
 * 文字列を書記素（絵文字などの結合文字を1つとして扱う単位）の配列に分割する。
 *
 * 失敗時の方針:
 * - Intl.Segmenter 非対応環境ではコードポイント単位へフォールバックする。
 */
const splitGraphemes = (text: string): string[] => {
    try {
        const segmenter = new Intl.Segmenter("ja-JP", {
            granularity: "grapheme",
        })
        return Array.from(segmenter.segment(text), item => item.segment)
    } catch {
        return Array.from(text)
    }
}

/**
 * 本文を省略し、`${本文}...\n${suffix}`（suffix が空なら `${本文}...`）の重み付き長を
 * 上限以内に収める。
 *
 * 処理の趣旨:
 * - 全体が上限以内なら加工しない。
 * - 本文の書記素数を1つずつ減らし、上限以内に収まる最長の本文を採用する。
 *   線形に探索するのは、切り取り位置によりURL判定が変わって重みが単調でなくなる
 *   場合があるため（本文は高々数百書記素のため性能上の問題はない）。
 * - 本文を1文字も残せない（suffix だけで上限近い）場合は、ユーザの本文を尊重して
 *   省略せず、上限超過のまま元の共有文を返す。
 *
 * Input:
 * - `params.body`: 省略対象の本文（前後の空白は呼び出し側で除去済みの想定）
 * - `params.suffix`: 末尾に付ける要素（URL等。空文字なら本文のみを省略する）
 * - `params.limit`: 重み付き長の上限
 * - `params.measure`: 長さの換算関数（省略時はX＝twitter-text。タイッツーは `taittsuuIntentMeasure`）
 *
 * Output:
 * - 組み立て後の共有文と、省略したかどうか
 *
 * 例:
 * - 入力: `{ body: "あ".repeat(200), suffix: "https://example.com/x", limit: 280 }`
 * - 出力: `{ text: "あ".repeat(126) + "...\nhttps://example.com/x", truncated: true }`
 */
export const truncateBodyWithSuffix = (params: {
    body: string
    suffix: string
    limit: number
    measure?: IntentMeasure
}): TruncateResult => {
    const { body, suffix, limit, measure = weightedLength } = params
    const join = (head: string) =>
        head.length === 0 ? suffix : `${head}\n${suffix}`
    const full = suffix.length === 0 ? body : join(body)
    if (measure(full) <= limit) {
        return { text: full, truncated: false }
    }

    const graphemes = splitGraphemes(body)
    for (let count = graphemes.length - 1; count >= 1; count--) {
        const head = graphemes.slice(0, count).join("").trimEnd()
        if (head.length === 0) {
            continue
        }
        const candidate =
            suffix.length === 0
                ? `${head}${ELLIPSIS}`
                : `${head}${ELLIPSIS}\n${suffix}`
        if (measure(candidate) <= limit) {
            return { text: candidate, truncated: true }
        }
    }

    return { text: full, truncated: false }
}
