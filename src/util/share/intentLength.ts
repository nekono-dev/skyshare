/**
 * 共有先SNSごとの文字数換算ユーティリティ。
 *
 * 責務と処理概要:
 * - 共有文の長さを「半角単位」（全角=2、半角=1）で数える関数を、宛先別に提供する。
 *   上限280（全角140字相当）と同じ尺度で比較できる。
 * - X は twitter-text の重み付きカウント（URL は長さに関わらず 23）で数える。
 * - タイッツー は URL も例外とせず、全文字を全角=2・半角=1・改行=1で単純加算する。
 */
import twitterText from "twitter-text"

/** 共有文の長さを半角単位で返す関数。 */
export type IntentMeasure = (text: string) => number

/**
 * X（twitter-text）の重み付き長を返す。
 *
 * 失敗時の方針:
 * - 解析に失敗した場合は、文字列長の2倍を返す（全角主体の本文を想定した安全側の見積り）。
 *
 * Input:
 * - `text`: 計測対象の文字列
 *
 * Output:
 * - 重み付き長（全角=2、半角=1、改行=1、URL=23）
 *
 * 例:
 * - 入力: `"あ"`
 * - 出力: `2`
 */
export const xIntentMeasure: IntentMeasure = text => {
    try {
        return twitterText.parseTweet(text).weightedLength
    } catch {
        return text.length * 2
    }
}

/**
 * 1コードポイントが全角（幅2）として扱われるかを判定する。
 *
 * 処理の趣旨:
 * - 東アジアの全角・広幅文字（ハングル字母、CJK、ハングル音節、互換漢字、全角形）と、
 *   絵文字（Extended_Pictographic）を全角とみなす。半角カナ（U+FF61〜FF9F）は半角。
 *
 * Input:
 * - `codePoint`: 判定対象のコードポイント
 *
 * Output:
 * - 全角なら `true`
 *
 * 例:
 * - 入力: `0x3042`（あ）
 * - 出力: `true`
 */
const isWideCodePoint = (codePoint: number): boolean =>
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    /\p{Extended_Pictographic}/u.test(String.fromCodePoint(codePoint))

/**
 * タイッツー向けの長さを返す。全角=2、半角=1、改行=1で、URLも含め全文字を単純加算する。
 *
 * 処理の趣旨:
 * - 異体字セレクタ（U+FE00〜FE0F）とゼロ幅接合子（U+200D）は表示幅を持たないため0とする。
 *
 * Input:
 * - `text`: 計測対象の文字列
 *
 * Output:
 * - 半角単位の長さ（全角140字 = 280）
 *
 * 例:
 * - 入力: `"あa"`
 * - 出力: `3`
 */
export const taittsuuIntentMeasure: IntentMeasure = text =>
    Array.from(text).reduce((sum, char) => {
        const codePoint = char.codePointAt(0) ?? 0
        if (
            codePoint === 0x200d ||
            (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
        ) {
            return sum
        }
        return sum + (isWideCodePoint(codePoint) ? 2 : 1)
    }, 0)

/**
 * 宛先に対応する換算関数を返す。
 *
 * Input:
 * - `target`: 字数制限のある共有先（`"x"` | `"taittsuu"`）
 *
 * Output:
 * - 換算関数
 *
 * 例:
 * - 入力: `"taittsuu"`
 * - 出力: `taittsuuIntentMeasure`
 */
export const resolveIntentMeasure = (
    target: "x" | "taittsuu",
): IntentMeasure =>
    target === "taittsuu" ? taittsuuIntentMeasure : xIntentMeasure
