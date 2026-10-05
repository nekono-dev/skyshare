import twitterText from "twitter-text"
import { taittsuuIntentMeasure } from "@/util/share/intentLength"

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
 * twitter-textの重み付きカウントを2で割って切り上げる（旧実装 TextInputBox を踏襲）。
 */
export const countWeightedTweetLength = (rawText: string): number => {
    try {
        return Math.ceil(twitterText.parseTweet(rawText).weightedLength / 2)
    } catch {
        return rawText.length
    }
}

/**
 * タイッツー投稿本文の文字数換算値（全角1・半角0.5、URLも全文字）を返す。
 * 半角単位の長さを2で割って切り上げる（X側の `countWeightedTweetLength` と同じ単位）。
 */
export const countTaittsuuLength = (rawText: string): number =>
    Math.ceil(taittsuuIntentMeasure(rawText) / 2)
