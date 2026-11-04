/**
 * 投稿本文のcontenteditableの「平文モデル」を担うファイル（DOMに依存しない純粋な型・定数・関数）。
 *
 * 責務と処理概要:
 * - `TextPart`（テキストと`<br>`の中間表現）と、キャレット用の不可視マーカー`CARET_ANCHOR`を定める。
 * - 中間表現から平文を組み立て（`partsToPlainText`）、平文インデックスを部品の位置へ解決する（`resolvePartOffset`）。
 * - DOM（Node/Range/Selection）には依存しない。DOM の走査とキャレットは `contentEditableModelDom.ts` が担う。
 */

export type TextPart = { type: "text"; value: string } | { type: "br" }

/**
 * 改行直後（<br>の直後）にキャレットを置くための、実DOM上でのみ使う不可視の目印文字。
 *
 * 空のテキストノードへは、実際にキャレットを置いても以降のタイピングがそこへ向かわず
 * 直前の行へ混ざってしまう既知のブラウザ挙動があるため、`computeHighlightNodeParts`
 * （`highlightNodeParts.ts`）は末尾が<br>の場合にこの文字1つだけを持つテキストノードを
 * 後続させる。平文モデル
 * （extractPlainText等）からは常に取り除かれ、外部に漏れることはない。
 */
export const CARET_ANCHOR = "​"

// 以下2件は `contentEditableModelDom.ts` からのみ使う内部ヘルパ。入口（`contentEditableModel.ts`）では再エクスポートしない。
export const hasLeadingAnchor = (raw: string): boolean =>
    raw.startsWith(CARET_ANCHOR)
export const stripLeadingAnchor = (raw: string): string =>
    hasLeadingAnchor(raw) ? raw.slice(CARET_ANCHOR.length) : raw

/**
 * 中間表現(TextPart[])を平文に組み立てる（pure）。
 *
 * Input:
 * - `parts`: `extractPlainText`等が内部で構築する中間表現
 *
 * Output:
 * - `<br>`を`"\n"`として連結した平文
 */
export const partsToPlainText = (parts: TextPart[]): string =>
    parts.map(part => (part.type === "br" ? "\n" : part.value)).join("")

/**
 * 中間表現(TextPart[])上の平文インデックスから、該当するpartのインデックスと
 * そのpart内オフセットを求める（pure）。
 *
 * Input:
 * - `parts`: 中間表現
 * - `index`: 平文全体に対する文字インデックス(UTF-16単位)
 *
 * Output:
 * - `partIndex`/`offsetInPart`。`parts`が空の場合は`{0, 0}`。indexが末尾を超える場合は
 *   最後のpartの末尾にクランプする。
 *
 * 例:
 * - 入力: `([{type:"text",value:"ab"},{type:"br"},{type:"text",value:"cd"}], 3)`
 * - 出力: `{ partIndex: 2, offsetInPart: 0 }`
 */
export const resolvePartOffset = (
    parts: TextPart[],
    index: number,
): { partIndex: number; offsetInPart: number } => {
    if (parts.length === 0) return { partIndex: 0, offsetInPart: 0 }

    let remaining = index
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const length = part.type === "br" ? 1 : part.value.length
        if (remaining <= length) {
            return { partIndex: i, offsetInPart: Math.max(remaining, 0) }
        }
        remaining -= length
    }

    const lastIndex = parts.length - 1
    const lastPart = parts[lastIndex]
    const lastLength = lastPart.type === "br" ? 1 : lastPart.value.length
    return { partIndex: lastIndex, offsetInPart: lastLength }
}
