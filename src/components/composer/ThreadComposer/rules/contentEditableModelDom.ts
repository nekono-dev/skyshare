/**
 * contenteditable の DOM と平文インデックス、Selection を相互変換する。
 * 想定する要素はテキストノード・装飾 span・br に限る。
 */

import {
    CARET_ANCHOR,
    hasLeadingAnchor,
    partsToPlainText,
    resolvePartOffset,
    stripLeadingAnchor,
} from "./contentEditableModelParts"
import type { TextPart } from "./contentEditableModelParts"

type CollectedPart = { part: TextPart; node: Node }

/**
 * root配下のテキストノードと`<br>`要素を文書順に収集する（DOM依存）。
 * spanなどの装飾要素は透過的に読み飛ばす。
 */
const collectParts = (root: HTMLElement): CollectedPart[] => {
    const collected: CollectedPart[] = []

    const walk = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const value = stripLeadingAnchor(node.textContent ?? "")
            if (value.length > 0) {
                collected.push({ part: { type: "text", value }, node })
            }
            return
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return

        const el = node as Element
        if (el.tagName === "BR") {
            collected.push({ part: { type: "br" }, node: el })
            return
        }
        for (const child of Array.from(el.childNodes)) walk(child)
    }

    for (const child of Array.from(root.childNodes)) walk(child)
    return collected
}

/**
 * contenteditable要素の現在のDOM内容から平文を抽出する。`<br>`は`"\n"`として扱う。
 *
 * 全選択+削除などでcontenteditableの中身が空になった際、ブラウザが自動的に
 * プレースホルダーとして`<br>`だけを挿入する既知の挙動があり、これを他の内容と
 * 区別なく`"\n"`と解釈すると「削除して空にしたつもり」が「改行1文字だけの本文」に
 * なってしまう。中身が`<br>`単体（前後に他の内容が一切無い）の場合のみ、意図的な
 * 改行ではなくこのプレースホルダーとみなし、空文字列として扱う。
 *
 * Input:
 * - `root`: contenteditableな要素
 *
 * Output:
 * - 平文文字列
 */
export const extractPlainText = (root: HTMLElement): string => {
    const parts = collectParts(root).map(c => c.part)
    if (parts.length === 1 && parts[0].type === "br") return ""
    return partsToPlainText(parts)
}

/**
 * root配下の平文インデックスに対応する実DOM上の`{node, offset}`を求める。
 * `<br>`要素境界では、その親ノードと子インデックスで位置を表す
 * （`<br>`自身は子を持てず`Range`の起点にできないため）。
 *
 * Input:
 * - `root`: contenteditableな要素
 * - `index`: 平文文字インデックス(UTF-16単位)
 *
 * Output:
 * - `Range.setStart`にそのまま渡せる`{node, offset}`
 */
export const resolveIndexToNodeOffset = (
    root: HTMLElement,
    index: number,
): { node: Node; offset: number } => {
    const collected = collectParts(root)
    if (collected.length === 0) return { node: root, offset: 0 }

    const parts = collected.map(c => c.part)
    const { partIndex, offsetInPart } = resolvePartOffset(parts, index)
    const { node, part } = collected[partIndex]

    if (part.type === "br") {
        const parent = node.parentNode
        if (!parent) return { node, offset: 0 }

        if (offsetInPart === 0) {
            const nodeIndex = Array.from(parent.childNodes).indexOf(
                node as ChildNode,
            )
            return { node: parent, offset: nodeIndex }
        }

        // <br>の直後（改行直後）は、親要素基準の子インデックスではなく直後のテキスト
        // ノードへ直接ポイントする。要素相対座標(parent, nodeIndex+1)だとChromeが
        // キャレット位置を直前のテキスト末尾へ正規化してしまう既知の挙動があり、
        // 改行直後に入力した文字が前の行へ混ざってしまうため（computeHighlightNodeParts
        // は末尾が<br>の場合に必ずCARET_ANCHOR付きテキストノードを後続させるので、
        // 通常はここで見つかる）。CARET_ANCHORがあればその直後(offset 1)を指す。
        const nextSibling = node.nextSibling
        if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
            const anchorLen = hasLeadingAnchor(nextSibling.textContent ?? "")
                ? CARET_ANCHOR.length
                : 0
            return { node: nextSibling, offset: anchorLen }
        }

        const nodeIndex = Array.from(parent.childNodes).indexOf(
            node as ChildNode,
        )
        return { node: parent, offset: nodeIndex + 1 }
    }

    const anchorLen = hasLeadingAnchor(node.textContent ?? "")
        ? CARET_ANCHOR.length
        : 0
    return { node, offset: offsetInPart + anchorLen }
}

/**
 * DOMの`{node, offset}`（Selectionから得たもの）を、root基準の平文インデックスに変換する
 * （`resolveIndexToNodeOffset`の逆変換）。
 */
const nodeOffsetToPlainTextIndex = (
    root: HTMLElement,
    targetNode: Node,
    targetOffset: number,
): number => {
    const collected = collectParts(root)
    let cumulative = 0

    for (const { node, part } of collected) {
        const length = part.type === "br" ? 1 : part.value.length

        if (node === targetNode) {
            const anchorLen = hasLeadingAnchor(node.textContent ?? "")
                ? CARET_ANCHOR.length
                : 0
            const strippedOffset = Math.max(
                0,
                Math.max(targetOffset, 0) - anchorLen,
            )
            return cumulative + Math.min(strippedOffset, length)
        }

        if (node.parentNode === targetNode) {
            const nodeIndex = Array.from(targetNode.childNodes).indexOf(
                node as ChildNode,
            )
            if (targetOffset <= nodeIndex) return cumulative
            cumulative += length
            continue
        }

        cumulative += length
    }

    return cumulative
}

/**
 * root配下の現在のSelectionを、root基準の平文インデックス範囲として取得する。
 *
 * Input:
 * - `root`: contenteditableな要素
 *
 * Output:
 * - `{start, end}`（UTF-16文字インデックス）。Selectionがroot外にある/存在しない場合は`null`。
 */
export const getPlainTextSelection = (
    root: HTMLElement,
): { start: number; end: number } | null => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null

    const range = selection.getRangeAt(0)
    if (
        !root.contains(range.startContainer) ||
        !root.contains(range.endContainer)
    ) {
        return null
    }

    return {
        start: nodeOffsetToPlainTextIndex(
            root,
            range.startContainer,
            range.startOffset,
        ),
        end: nodeOffsetToPlainTextIndex(
            root,
            range.endContainer,
            range.endOffset,
        ),
    }
}

/**
 * root配下の平文インデックスへキャレット（collapsed selection）を設定する。
 *
 * Input:
 * - `root`: contenteditableな要素
 * - `index`: 平文文字インデックス(UTF-16単位)
 *
 * Output:
 * - なし（副作用としてSelectionを更新する）
 */
export const setPlainTextCaret = (root: HTMLElement, index: number): void => {
    const { node, offset } = resolveIndexToNodeOffset(root, index)
    const selection = window.getSelection()
    if (!selection) return

    const range = document.createRange()
    range.setStart(node, offset)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
}

/**
 * `root`の最終子が「CARET_ANCHOR単体のテキストノードで、直前が`<br>`要素」である場合のみ
 * それを返す。この構築上の不変条件（CARET_ANCHORは必ず末尾`<br>`の直後にのみ現れる）に
 * より、ユーザーが偶然入力したU+200Bを誤って対象にしてしまうことを避ける。
 */
export const findCaretAnchorNode = (root: HTMLElement): Text | null => {
    const last = root.lastChild
    if (
        !last ||
        last.nodeType !== Node.TEXT_NODE ||
        last.textContent !== CARET_ANCHOR
    ) {
        return null
    }
    const prev = last.previousSibling
    if (
        !prev ||
        prev.nodeType !== Node.ELEMENT_NODE ||
        (prev as Element).tagName !== "BR"
    ) {
        return null
    }
    return last as Text
}
