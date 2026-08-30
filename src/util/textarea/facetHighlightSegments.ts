/**
 * 投稿本文からハッシュタグ/メンション/URL部分を抽出し、色付け対象のセグメントに分割する。
 *
 * 責務と処理概要:
 * - 独自の正規表現でハッシュタグ(#/＃)・メンション(@)・URL(http(s)://)を検出する。
 *   `@atproto/api` の `RichText` は使わない: `isMention()` はハンドルが既知TLDで終わる
 *   （ドメインらしい形になる）までtrueを返さない実装のため、「#/@/httpの直後に文字列が
 *   入力された時点で即座に色を付けたい」という要件に合わない。
 * - 各パターンは行頭・空白・開き括弧の直後からのみ始まる（メール内の"@"やC#のような
 *   "#"を誤って拾わないため）。トリガー文字の直後に1文字以上のトークン文字が続けば
 *   即座にマッチする。
 * - 複数パターンの一致範囲が重なる場合（通常はURL内の"#"がハッシュタグと誤認される
 *   ケースだが、境界条件により発生しない設計。念のための安全策として）は、開始位置が
 *   早いものを優先し、後続の重なる一致は破棄する。
 * - PostFormの本文入力欄（contenteditable）が、タイピングの度にこの関数を呼びハイライト表示を
 *   再構築する用途で使う。
 */

export type HighlightSegment = {
    text: string
    highlighted: boolean
}

// 行頭・空白・開き括弧の直後からのみマッチする（メールアドレスの"@"や"C#"のような
// "#"を誤って拾わないため）。
const HASHTAG_PATTERN = /(?<=^|[\s(])[#＃][\p{L}\p{N}\p{M}_]+/gu
const MENTION_PATTERN = /(?<=^|[\s(])@[a-zA-Z0-9.-]+/g
const URL_PATTERN = /(?<=^|[\s(])https?:\/\/[^\s]+/g

type Range = { start: number; end: number }

const collectMatches = (text: string, pattern: RegExp): Range[] => {
    const matches: Range[] = []
    pattern.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = pattern.exec(text))) {
        matches.push({ start: m.index, end: m.index + m[0].length })
    }
    return matches
}

/**
 * 投稿本文を、ハッシュタグ/メンション/URL部分とそれ以外に分割する。
 *
 * Input:
 * - `text`: 投稿本文（contenteditable要素から抽出した平文）
 *
 * Output:
 * - 連結すると必ず元の `text` に一致するセグメント配列。
 *
 * 例:
 * - 入力: `"今日も #猫 と @alice を見て https://example.com へ"`
 * - 出力: `[{text:"今日も ",highlighted:false}, {text:"#猫",highlighted:true}, {text:" と ",highlighted:false}, {text:"@alice",highlighted:true}, {text:" を見て ",highlighted:false}, {text:"https://example.com",highlighted:true}, {text:" へ",highlighted:false}]`
 */
export const computeHighlightSegments = (text: string): HighlightSegment[] => {
    if (!text) return []

    const allMatches = [
        ...collectMatches(text, HASHTAG_PATTERN),
        ...collectMatches(text, MENTION_PATTERN),
        ...collectMatches(text, URL_PATTERN),
    ].sort((a, b) => a.start - b.start)

    const accepted: Range[] = []
    let cursor = 0
    for (const match of allMatches) {
        if (match.start < cursor) continue
        accepted.push(match)
        cursor = match.end
    }

    const segments: HighlightSegment[] = []
    let pos = 0
    for (const match of accepted) {
        if (match.start > pos) {
            segments.push({
                text: text.slice(pos, match.start),
                highlighted: false,
            })
        }
        segments.push({
            text: text.slice(match.start, match.end),
            highlighted: true,
        })
        pos = match.end
    }
    if (pos < text.length) {
        segments.push({ text: text.slice(pos), highlighted: false })
    }

    return segments
}
