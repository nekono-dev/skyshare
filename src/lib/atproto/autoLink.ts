import TLDs from "tlds"

/**
 * 平文の中から URL らしき文字列を探し、リンク先の URL を付けて返す汎用ユーティリティ。
 *
 * 責務と処理概要:
 * - `https://` `http://` で始まる URL と、スキームを省略したドメイン（`example.com/path` など）を検出する。
 *   スキーム省略のものは `https://` を補ってリンク先とする。
 * - 日本語の文中では URL の前後に空白が無いことが多いため、空白の有無ではなく
 *   「URL に使える ASCII 文字が続く範囲」で URL の切れ目を決める（`見てexample.comです` の `example.com`）。
 * - スキーム省略のドメインは、既知の TLD で終わるものだけを URL とみなす
 *   （`1.0.0` のような版の表記や `file.txt` のようなファイル名の誤検出を防ぐ）。
 * - メールアドレスやメンション（`@` の直後）の一部は URL とみなさない。
 * - 平文のハッシュタグ（`#tag`）の範囲も検出する（`findHashtagRanges`）。リンク先はアプリ側が決める。
 * - アプリのドメイン知識を持たない（入出力は文字列と数値のみ）。
 */

/** 検出した URL 1件。`start`/`end` は文字列（UTF-16）の位置 */
export type UrlRange = { start: number; end: number; href: string }

// URL に使える ASCII 文字（RFC 3986 の unreserved / reserved と `%`）。
// これ以外の文字（日本語・空白・全角の括弧など）で URL が終わる。
const URL_CHAR = "[A-Za-z0-9\\-._~:/?#\\[\\]@!$&'()*+,;=%]"
// ドメインのラベル（英数字とハイフン。先頭と末尾はハイフン以外）
const LABEL = "[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?"

// 1つ目の選択肢: スキームあり。2つ目: スキーム省略のドメイン（＋任意のパス等）。
// 直前が英数字・`.`・`-`・`@`・`/`・`_` の位置からは始めない（単語の途中・メールアドレス・
// メンション・パスの途中から拾わないため）。
const URL_PATTERN = new RegExp(
    `(?<![A-Za-z0-9.\\-@/_])(?:` +
        `(?<scheme>https?://${URL_CHAR}+)` +
        `|(?<domain>(?:${LABEL}\\.)+${LABEL})(?![A-Za-z0-9\\-@])(?<rest>[/?#]${URL_CHAR}*)?` +
        `)`,
    "gi",
)

const TLD_SET = new Set(TLDs.map(tld => tld.toLowerCase()))

/**
 * URL の末尾に付いた、文の区切りとみなす記号を取り除く。
 *
 * 処理の趣旨:
 * - `.,;:!?` で終わる場合は、文の区切りとみなして除く（`example.com.` の `.`）。
 * - `)` で終わり、URL の中に対応する `(` が無ければ除く（`(example.com)` の `)`）。
 *   `@atproto/api` の `RichText` の検出と同じ扱いにする。
 *
 * Input:
 * - `url`: 検出した URL の文字列
 *
 * Output:
 * - 末尾の記号を除いた文字列
 *
 * 例:
 * - 入力: `"example.com/a)."` → 出力: `"example.com/a"`
 */
const trimTrailingPunctuation = (url: string): string => {
    let result = url
    for (;;) {
        if (/[.,;:!?]$/.test(result)) {
            result = result.slice(0, -1)
        } else if (result.endsWith(")") && !result.includes("(")) {
            result = result.slice(0, -1)
        } else {
            return result
        }
    }
}

/**
 * ドメインが既知の TLD で終わるかを判定する。
 *
 * Input:
 * - `domain`: `example.com` のようなドメイン
 *
 * Output:
 * - 最後のラベルが既知の TLD なら true
 */
const hasKnownTld = (domain: string): boolean => {
    const tld = domain.slice(domain.lastIndexOf(".") + 1)
    return TLD_SET.has(tld.toLowerCase())
}

/**
 * 平文の中の URL の範囲とリンク先を、出現順に返す。
 *
 * 処理の趣旨:
 * - スキームありはそのままリンク先にし、スキーム省略は既知の TLD のものだけ `https://` を補う。
 * - 末尾の文の区切りの記号は範囲に含めない。
 *
 * Input:
 * - `text`: 平文
 *
 * Output:
 * - URL の範囲の配列（重なりなし・開始位置の昇順）。見つからなければ空配列
 *
 * 例:
 * - 入力: `"見てexample.com/aです"`
 * - 出力: `[{ start: 2, end: 15, href: "https://example.com/a" }]`
 * - 入力: `"mail@example.com"`、`"v1.0.0"` → 出力: `[]`
 */
export const findUrlRanges = (text: string): UrlRange[] => {
    const ranges: UrlRange[] = []
    URL_PATTERN.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = URL_PATTERN.exec(text))) {
        const { scheme, domain } = m.groups ?? {}
        // スキーム省略は既知の TLD で終わるドメインだけを URL とみなす
        if (!scheme && domain && !hasKnownTld(domain)) continue
        const matched = trimTrailingPunctuation(m[0])
        // スキームだけ（`https://` のみ）など、ドメインを持たないものは除く
        if (scheme && !/^https?:\/\/[A-Za-z0-9]/i.test(matched)) continue
        ranges.push({
            start: m.index,
            end: m.index + matched.length,
            href: scheme ? matched : `https://${matched}`,
        })
    }
    return ranges
}

/** 検出したハッシュタグ1件。`start`/`end` は `#` を含む文字列（UTF-16）の位置、`tag` は `#` を除いた文字列 */
export type HashtagRange = { start: number; end: number; tag: string }

// 文頭・空白・`(`・`（` の直後の `#` から、空白と `#` までの範囲。
// 単語の途中（`a#b`）や URL のフラグメント（`/x#y`）を拾わないための条件。
const HASHTAG_PATTERN = /(?<=^|[\s(（])#([^\s#]+)/gu
const HASHTAG_MAX_LENGTH = 64

/**
 * 平文の中のハッシュタグの範囲を、出現順に返す。
 *
 * 処理の趣旨:
 * - 末尾の句読点（`#猫。` の `。`）は範囲に含めない。
 * - 数字と句読点だけのもの（`#123`）と、64文字を超えるものはタグとみなさない。
 *
 * Input:
 * - `text`: 平文
 *
 * Output:
 * - ハッシュタグの範囲の配列（開始位置の昇順）。見つからなければ空配列
 *
 * 例:
 * - 入力: `"今日は #猫。"` → 出力: `[{ start: 4, end: 6, tag: "猫" }]`
 * - 入力: `"#123 a#b"` → 出力: `[]`
 */
export const findHashtagRanges = (text: string): HashtagRange[] => {
    const ranges: HashtagRange[] = []
    for (const m of text.matchAll(HASHTAG_PATTERN)) {
        const tag = m[1].replace(/\p{P}+$/u, "")
        if (!/[^\d\p{P}]/u.test(tag) || [...tag].length > HASHTAG_MAX_LENGTH) {
            continue
        }
        ranges.push({
            start: m.index,
            end: m.index + 1 + tag.length,
            tag,
        })
    }
    return ranges
}
