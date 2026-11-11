/**
 * 投稿本文や entry の見出し・説明文の文字数を、用途に応じた単位で数える。
 *
 * - X は twitter-text の重み付き長、タイッツーは全角 2・半角 1 の単純加算を使う。
 */
import {
    halfUnitLength,
    taittsuuIntentMeasure,
    xIntentMeasure,
} from "@/lib/share/intentLength"

/**
 * grapheme（書記素）単位で文字数を数える。
 * Bluesky投稿本文・skyshare entryのheading/captionなど、
 * 絵文字などの結合文字を1文字として数えたい箇所で共通して使う。
 * Intl.Segmenter非対応環境では文字列長にフォールバックする。
 */
export const countGraphemes = (rawText: string): number => {
    try {
        const segmenterJa = new Intl.Segmenter("ja-JP", {
            granularity: "grapheme",
        })
        return Array.from(segmenterJa.segment(rawText)).length
    } catch {
        return rawText.length
    }
}

/**
 * X.com投稿本文の文字数換算値を返す。
 * twitter-text の重み付きカウントを 2 で割って切り上げる。
 */
export const countWeightedTweetLength = (rawText: string): number =>
    halfUnitLength(xIntentMeasure, rawText)

/**
 * タイッツー投稿本文の文字数換算値（全角1・半角0.5、URLも全文字）を返す。
 * 半角単位の長さを2で割って切り上げる（X側の `countWeightedTweetLength` と同じ単位）。
 */
export const countTaittsuuLength = (rawText: string): number =>
    halfUnitLength(taittsuuIntentMeasure, rawText)
