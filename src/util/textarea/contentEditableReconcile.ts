/**
 * PostBodyEditor（投稿本文欄）のcontenteditable DOMを、`value`から計算される理想構造へ
 * 同期させるための差分パッチ実装。
 *
 * 責務と処理概要:
 * - キー入力の時点で、ブラウザは既にネイティブに実DOMを編集済み（`input`イベントは
 *   その後に発火する）。そのため「現在の実DOMから読み取った構造(oldParts)」と
 *   「`value`から計算されるべき理想構造(newParts)」を比較し、両者が一致していれば
 *   一切DOMに触れない（＝そのキー入力に対するブラウザ自身のDOM変更をそのまま残す＝
 *   ネイティブUndoが追跡できる）。一致しない場合（ハイライトのオン/オフ境界を
 *   またいだ入力など）のみ、差分区間だけをピンポイントで置き換える。
 * - 想定外のDOM構造（本コンポーネントが構築するもの以外）に遭遇した場合は
 *   `null`を返し、呼び出し側は`rebuildContentFully`（従来の全置換）にフォールバックする。
 * - DOM(Node/Range/Selection)には依存するが、Reactやskyshare固有の型には依存しない。
 *   `contentEditableModel.ts`と同様、テスト容易性より実ブラウザでの検証を優先する
 *   （このファイルのロジックはvitest対象外）。
 */
import {
    CARET_ANCHOR,
    getPlainTextSelection,
    setPlainTextCaret,
} from "@/util/textarea/contentEditableModel"
import {
    computeHighlightNodeParts,
    diffNodeParts,
    type NodePart,
} from "@/util/textarea/highlightNodeParts"

const buildNodePartElement = (
    part: NodePart,
    highlightClassName: string,
): Node => {
    if (part.type === "br") return document.createElement("br")
    if (part.type === "anchor") return document.createTextNode(CARET_ANCHOR)

    if (!part.highlighted) return document.createTextNode(part.value)

    const span = document.createElement("span")
    span.className = highlightClassName
    span.appendChild(document.createTextNode(part.value))
    return span
}

/**
 * `root`直下の子ノード列を`NodePart[]`として読み取る。想定外の構造に遭遇したら
 * `null`を返す（呼び出し側は全置換へフォールバックする）。
 */
const collectNodeParts = (
    root: HTMLElement,
    highlightClassName: string,
): { parts: NodePart[]; nodes: Node[] } | null => {
    const nodes = Array.from(root.childNodes)
    const parts: NodePart[] = []

    for (const node of nodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent ?? ""
            parts.push(
                text === CARET_ANCHOR
                    ? { type: "anchor" }
                    : { type: "text", value: text, highlighted: false },
            )
            continue
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element
            if (el.tagName === "BR") {
                parts.push({ type: "br" })
                continue
            }
            if (
                el.tagName === "SPAN" &&
                el.classList.contains(highlightClassName) &&
                el.childNodes.length === 1 &&
                el.firstChild?.nodeType === Node.TEXT_NODE
            ) {
                parts.push({
                    type: "text",
                    value: el.firstChild.textContent ?? "",
                    highlighted: true,
                })
                continue
            }
        }

        return null
    }

    return { parts, nodes }
}

/**
 * `root`の中身を`text`の理想構造と比較し、差分のある区間だけをピンポイントで置き換える。
 * フォーカス中は処理前後でキャレット位置（平文インデックス）を保存・復元する。
 *
 * Input:
 * - `root`: contenteditableな要素
 * - `text`: 表示すべき投稿本文（平文）
 * - `highlightClassName`: ハイライト用spanに付与するクラス名
 *
 * Output:
 * - なし（副作用として必要最小限のDOM操作とキャレット復元を行う）
 */
export const reconcileContent = (
    root: HTMLElement,
    text: string,
    highlightClassName: string,
): void => {
    const hasFocus = document.activeElement === root
    const savedSelection = hasFocus ? getPlainTextSelection(root) : null

    const collected = collectNodeParts(root, highlightClassName)
    if (!collected) {
        rebuildContentFully(root, text, highlightClassName)
        return
    }

    const { parts: oldParts, nodes: oldNodes } = collected
    const newParts = computeHighlightNodeParts(text)
    const { prefixLen, suffixLen } = diffNodeParts(oldParts, newParts)
    const oldMiddleEnd = oldParts.length - suffixLen
    const newMiddleParts = newParts.slice(
        prefixLen,
        newParts.length - suffixLen,
    )

    if (prefixLen < oldMiddleEnd || newMiddleParts.length > 0) {
        const insertBeforeNode = oldNodes[oldMiddleEnd] ?? null
        for (let i = prefixLen; i < oldMiddleEnd; i++) {
            root.removeChild(oldNodes[i])
        }
        for (const part of newMiddleParts) {
            root.insertBefore(
                buildNodePartElement(part, highlightClassName),
                insertBeforeNode,
            )
        }
    }

    if (hasFocus && savedSelection)
        setPlainTextCaret(root, savedSelection.start)
}

/**
 * `root`の中身を`text`から常に全置換で再構築する（差分計算を行わない）。
 * `onBlur`時の安全弁として使う想定（毎キー入力のホットパスではないため全置換のままでよい）。
 */
export const rebuildContentFully = (
    root: HTMLElement,
    text: string,
    highlightClassName: string,
): void => {
    const hasFocus = document.activeElement === root
    const savedSelection = hasFocus ? getPlainTextSelection(root) : null

    const fragment = document.createDocumentFragment()
    for (const part of computeHighlightNodeParts(text)) {
        fragment.appendChild(buildNodePartElement(part, highlightClassName))
    }
    root.replaceChildren(fragment)

    if (hasFocus && savedSelection)
        setPlainTextCaret(root, savedSelection.start)
}
