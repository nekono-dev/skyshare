/**
 * `computeHighlightSegments`の出力を、contenteditableのDOM子ノード1つずつに対応する
 * 単位（`NodePart`）まで展開し、新旧の並びを比較するためのユーティリティ。
 *
 * 責務と処理概要:
 * - PostBodyEditorはもはやキー入力の度にDOMを全て作り直さない。代わりに、現在の実DOMから
 *   読み取った`NodePart[]`（旧）と、`value`から計算した`NodePart[]`（新）を比較し、
 *   両者が一致する区間はDOMに一切触れず、差分のある区間だけをピンポイントで置き換える
 *   （`contentEditableReconcile.ts`が担当）。このファイルはその比較に使う純粋関数のみを持つ。
 * - CARET_ANCHOR（末尾が`<br>`の場合にのみ付与する不可視のキャレット用マーカー文字。
 *   `contentEditableModel.ts`参照）の付与判定もここに集約する。従来は
 *   `PostBodyEditor`内の`rebuildContent`とこのファイルの2箇所に分散していたロジックを
 *   1箇所にまとめる。
 */
import {
    computeHighlightSegments,
    type HighlightSegment,
} from "@/util/textarea/facetHighlightSegments"

export type NodePart =
    | { type: "text"; value: string; highlighted: boolean }
    | { type: "br" }
    | { type: "anchor" }

const appendSegmentParts = (parts: NodePart[], segment: HighlightSegment) => {
    const lines = segment.text.split("\n")
    lines.forEach((line, i) => {
        if (line.length > 0) {
            parts.push({
                type: "text",
                value: line,
                highlighted: segment.highlighted,
            })
        }
        if (i < lines.length - 1) parts.push({ type: "br" })
    })
}

/**
 * 投稿本文をDOM子ノード1つずつに対応する`NodePart[]`へ変換する。
 *
 * Input:
 * - `text`: 投稿本文（平文）
 *
 * Output:
 * - `text`/`br`/`anchor`からなる配列。末尾が`br`の場合のみ末尾に`anchor`を1つ追加する
 *   （Chromeが「末尾`<br>`の直後で何も後続しない」キャレット位置を直前行末へ正規化して
 *   しまう既知の挙動を避けるための足場。詳細は`contentEditableModel.ts`のCARET_ANCHOR）。
 */
export const computeHighlightNodeParts = (text: string): NodePart[] => {
    const parts: NodePart[] = []
    for (const segment of computeHighlightSegments(text)) {
        appendSegmentParts(parts, segment)
    }
    if (parts.length > 0 && parts[parts.length - 1].type === "br") {
        parts.push({ type: "anchor" })
    }
    return parts
}

/** 2つの`NodePart`が「同じDOMノードとみなせる」かどうかを判定する。 */
export const partsEqual = (a: NodePart, b: NodePart): boolean => {
    if (a.type !== b.type) return false
    if (a.type === "text" && b.type === "text") {
        return a.value === b.value && a.highlighted === b.highlighted
    }
    return true
}

/**
 * `oldParts`と`newParts`の共通接頭辞長・共通接尾辞長を求める。
 *
 * Input:
 * - `oldParts`: 現在の実DOMから読み取った並び
 * - `newParts`: `value`から計算されるべき並び
 *
 * Output:
 * - `{prefixLen, suffixLen}`。`oldParts[prefixLen..oldParts.length-suffixLen)`が
 *   `newParts[prefixLen..newParts.length-suffixLen)`に置き換えるべき差分区間となる。
 *   1回のキー入力による差分は挿入/削除点に隣接する区間にしか影響しないため常に
 *   連続した1区間に収まるが、この関数自体はpaste/undoなど大規模な変更でも
 *   （差分区間が広がるだけで）そのまま正しく機能する。
 */
export const diffNodeParts = (
    oldParts: NodePart[],
    newParts: NodePart[],
): { prefixLen: number; suffixLen: number } => {
    const maxCommon = Math.min(oldParts.length, newParts.length)

    let prefixLen = 0
    while (
        prefixLen < maxCommon &&
        partsEqual(oldParts[prefixLen], newParts[prefixLen])
    ) {
        prefixLen++
    }

    const maxSuffix = maxCommon - prefixLen
    let suffixLen = 0
    while (
        suffixLen < maxSuffix &&
        partsEqual(
            oldParts[oldParts.length - 1 - suffixLen],
            newParts[newParts.length - 1 - suffixLen],
        )
    ) {
        suffixLen++
    }

    return { prefixLen, suffixLen }
}
