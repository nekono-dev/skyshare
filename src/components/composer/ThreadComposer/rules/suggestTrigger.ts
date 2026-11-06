/**
 * textarea内のカーソル位置から、「入力途中の@メンション/#ハッシュタグ」を検出する純粋関数。
 *
 * 責務と処理概要:
 * - あくまで候補ポップアップを出すか出さないかを決めるUXヒューリスティックであり、投稿時の
 *   最終的なfacet判定（メンションのhandle→did解決含む）はサーバー側の `RichText.detectFacets` に委ねる。
 * - DOM・atproto型など一切依存せず、文字列とインデックスのみで完結する（他プロジェクトへの移植も可能）。
 */

export type SuggestTriggerKind = "mention" | "hashtag"

export type SuggestTrigger = {
    kind: SuggestTriggerKind
    /** "@"/"#" 自体の開始インデックス(UTF-16コード単位) */
    startIndex: number
    /** トリガー記号を除いた、キャレット直前までのクエリ文字列 */
    query: string
}

// メンションのトークン文字はhandle(a-z0-9.-)に準じてASCIIのみ許可する。
const MENTION_TOKEN_CHAR = /[a-zA-Z0-9.-]/
// ハッシュタグは日本語含むUnicode文字全般を許可する（\p{L}=文字, \p{N}=数字, \p{M}=結合記号）。
const HASHTAG_TOKEN_CHAR = /[\p{L}\p{N}\p{M}_]/u
const MAX_QUERY_LENGTH = 40

/**
 * `caretIndex` から後方へ、指定したトリガー種別のトークン文字が続く限り走査し、
 * その直前が対応するトリガー記号かつ文字列先頭または空白の直後であれば `SuggestTrigger` を返す。
 */
const detectTriggerOfKind = (
    text: string,
    caretIndex: number,
    kind: SuggestTriggerKind,
    tokenChar: RegExp,
    triggerChars: string[],
): SuggestTrigger | null => {
    let i = caretIndex
    while (i > 0 && tokenChar.test(text[i - 1])) i--

    const triggerIndex = i - 1
    if (triggerIndex < 0 || !triggerChars.includes(text[triggerIndex])) {
        return null
    }

    const before = triggerIndex === 0 ? "" : text[triggerIndex - 1]
    if (before !== "" && !/\s/.test(before)) return null

    const query = text.slice(i, caretIndex)
    if (query.length > MAX_QUERY_LENGTH) return null

    return { kind, startIndex: triggerIndex, query }
}

/**
 * textarea内の任意カーソル位置(caretIndex)から、直前に「入力途中の@メンション/#ハッシュタグ」が
 * あるかを判定する。
 *
 * 想定する入力形状(最小要件):
 * - `caretIndex` は範囲選択なし（selectionStart === selectionEnd）の状態で呼ぶこと。
 *   範囲選択がある場合は呼び出し側で呼び出しをスキップする。
 * - IME変換中は呼び出し側が評価自体をスキップすること（変換確定前の中間文字列を渡さない）。
 *
 * Input:
 * - `text`: textarea全体の値
 * - `caretIndex`: カーソル位置
 *
 * Output:
 * - トリガーが見つかれば `SuggestTrigger`、無ければ `null`
 *
 * 例:
 * - 入力: `("こんにちは @alice", 12)` (caretが"@alice"末尾)
 * - 出力: `{ kind: "mention", startIndex: 6, query: "alice" }`
 */
export const detectSuggestTrigger = (
    text: string,
    caretIndex: number,
): SuggestTrigger | null => {
    if (caretIndex <= 0) return null

    return (
        detectTriggerOfKind(text, caretIndex, "mention", MENTION_TOKEN_CHAR, [
            "@",
        ]) ??
        detectTriggerOfKind(text, caretIndex, "hashtag", HASHTAG_TOKEN_CHAR, [
            "#",
            "＃",
        ])
    )
}
