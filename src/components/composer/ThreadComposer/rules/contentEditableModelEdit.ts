/**
 * contenteditableの削除操作を判定し（CARET_ANCHORへの配慮）、平文インデックスの画素位置を測定するファイル。
 *
 * 責務と処理概要:
 * - Backspace/DeleteがCARET_ANCHORに触れるかを判定し、本来の平文の編集結果を返す（`resolveAnchorAwareDeleteText`）。
 * - 平文インデックスに対応する画面上の座標（root左上原点）を測定する（`measureIndexPixelPosition`）。
 * - 走査・選択・キャレットは `contentEditableModelDom.ts` を使う。
 */

import {
    findCaretAnchorNode,
    getPlainTextSelection,
    resolveIndexToNodeOffset,
} from "./contentEditableModelDom"

/**
 * Backspace/DeleteキーがCARET_ANCHOR（末尾の不可視マーカー文字）に触れる操作かどうかを
 * 判定し、触れる場合は本来ユーザーが意図した平文編集結果を返す。
 *
 * 背景: CARET_ANCHORは平文モデルから常に除去される「透明」な1文字のため、ブラウザの
 * ネイティブ削除処理にこの文字付近の削除を任せると、実際のDOM編集結果が平文モデル上の
 * 削除意図（「行末の改行を1つ消す」）と食い違う既知の挙動がある（Chromeの実機トレースで
 * 確認済み: 末尾の空行でBackspaceを押すと、改行が消えるどころか`<br>`が1つ増える）。
 * この関数は`keydown`の時点でその危険な操作を検知し、ネイティブ削除に処理させる前に
 * 呼び出し側が横取りできるようにする。
 *
 * Input:
 * - `root`: contenteditableな要素
 * - `value`: 現在の平文（React state）
 * - `key`: 押されたキー（"Backspace" | "Delete"）
 *
 * Output:
 * - `undefined`: CARET_ANCHORに無関係。ネイティブ処理に任せてよい
 * - `null`: 横取りが必要だが、削除対象が無く平文は変化しない（preventDefaultのみ行う）
 * - `string`: 横取りが必要で、この文字列を次のvalueとして扱うべき
 */
export const resolveAnchorAwareDeleteText = (
    root: HTMLElement,
    value: string,
    key: "Backspace" | "Delete",
): string | null | undefined => {
    const anchorNode = findCaretAnchorNode(root)
    if (!anchorNode) return undefined

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return undefined
    const range = selection.getRangeAt(0)
    if (
        !root.contains(range.startContainer) ||
        !root.contains(range.endContainer)
    ) {
        return undefined
    }

    const collapsedAtAnchor =
        selection.isCollapsed && range.startContainer === anchorNode
    if (!collapsedAtAnchor && !range.intersectsNode(anchorNode)) {
        return undefined
    }

    const plainSelection = getPlainTextSelection(root)
    if (!plainSelection) return null

    const { start, end } = plainSelection
    if (start !== end) return value.slice(0, start) + value.slice(end)
    if (key === "Delete") return null
    if (start === 0) return null
    return value.slice(0, start - 1) + value.slice(start)
}

/**
 * root配下の平文インデックスに対応するピクセル座標を、root左上原点で返す。
 * SuggestPopoverの表示位置決めに使う（`caretPosition.ts`のmirror-div技法の置き換え）。
 *
 * Input:
 * - `root`: contenteditableな要素
 * - `index`: 座標を求めたい平文文字インデックス
 *
 * Output:
 * - `root`の左上を原点としたpx座標(top/left)と、その位置の行の高さ(height)
 */
export const measureIndexPixelPosition = (
    root: HTMLElement,
    index: number,
): { top: number; left: number; height: number } => {
    const { node, offset } = resolveIndexToNodeOffset(root, index)
    const range = document.createRange()
    range.setStart(node, offset)
    range.setEnd(node, offset)

    let rect: DOMRect | undefined = range.getClientRects()[0]
    if (
        (!rect || (rect.width === 0 && rect.height === 0)) &&
        node.nodeType === Node.TEXT_NODE &&
        offset > 0
    ) {
        // 行末など矩形が幅0/高さ0になる既知のケースへのフォールバック:
        // 直前の1文字を含むrangeで代替測定し、その右端を使う
        range.setStart(node, offset - 1)
        range.setEnd(node, offset)
        const fallbackRect = range.getClientRects()[0]
        if (fallbackRect) {
            rect = new DOMRect(
                fallbackRect.right,
                fallbackRect.top,
                0,
                fallbackRect.height,
            )
        }
    }
    if (!rect) rect = range.getBoundingClientRect()

    const rootRect = root.getBoundingClientRect()
    return {
        top: rect.top - rootRect.top,
        left: rect.left - rootRect.left,
        height:
            rect.height || parseFloat(getComputedStyle(root).lineHeight) || 16,
    }
}
