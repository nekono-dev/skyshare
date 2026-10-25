/**
 * contenteditableな要素と、その「平文表現」（`<br>`を`"\n"`とみなした文字列）を相互変換する
 * ユーティリティ。
 *
 * 責務と処理概要:
 * - PostBodyEditor（投稿本文欄）は、表示上はハッシュタグ/メンションをspanで色付けした
 *   テキストノード+`<br>`のフラットなDOM構造を自前で構築・維持する。このファイルは、その
 *   DOM構造と「平文文字インデックス(UTF-16単位)」を相互変換する層を担う。
 * - DOM(Node/Range/Selection)には依存するが、Reactやskyshare固有の型には依存しない。
 * - テスト容易性のため、「DOM→中間表現(TextPart[])への変換」（DOM依存・未テスト）と
 *   「中間表現をベースにした平文組み立て・インデックス解決」（pure・テスト可能）を分離する。
 * - ここで想定するDOM構造はPostBodyEditorが自ら構築するもの（テキストノード / spanで
 *   ラップされたテキストノード / `<br>`）に限る。ブラウザが独自に`<div>`等を挿入する
 *   ような想定外の構造への完全な対応はスコープ外とし、PostBodyEditor側のonBlur時の
 *   強制再構築を安全弁として扱う。
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

const hasLeadingAnchor = (raw: string): boolean => raw.startsWith(CARET_ANCHOR)
const stripLeadingAnchor = (raw: string): string =>
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
