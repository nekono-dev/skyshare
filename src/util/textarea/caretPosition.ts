/**
 * textarea内の文字インデックスを、そのtextarea自身の左上を原点としたピクセル座標に変換する
 * mirror-div技法のユーティリティ。
 *
 * 責務と処理概要:
 * - 非表示のdiv(mirror)をtextareaと同一のフォント/余白/折り返し設定で生成し、対象インデックスまでの
 *   テキストを流し込んだ末尾に marker要素を置いてその位置を測る。
 * - 候補ポップアップ(SuggestPopover)をキャレット直下に表示するために使う。呼び出し頻度は
 *   新しいトリガー開始時のみで低いため、mirror要素はキャッシュせず呼び出しごとに生成/破棄する。
 * - DOM操作のみで完結し、skyshare固有の型・APIには依存しない。
 */

export type CaretPixelPosition = { top: number; left: number; height: number }

// textarea-caret-position の定番実装が複製対象とするCSSプロパティ一覧を踏襲する。
const MIRRORED_STYLE_PROPS = [
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderStyle",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "textDecoration",
    "letterSpacing",
    "wordSpacing",
    "tabSize",
    "whiteSpace",
    "wordWrap",
    "wordBreak",
] as const satisfies readonly (keyof CSSStyleDeclaration)[]

/**
 * textarea内の文字インデックス(caretIndex)を、`el` の左上を原点としたピクセル座標(top/left)に変換する。
 *
 * Input:
 * - `el`: 対象のtextarea DOM要素
 * - `caretIndex`: 座標を求めたい文字インデックス
 *
 * Output:
 * - `el` の左上を原点としたpx座標(top/left)と、その行の高さ(height)
 */
export const measureCaretPixelPosition = (
    el: HTMLTextAreaElement,
    caretIndex: number,
): CaretPixelPosition => {
    const computed = window.getComputedStyle(el)
    const mirror = document.createElement("div")
    const style = mirror.style
    style.position = "absolute"
    style.visibility = "hidden"
    style.whiteSpace = "pre-wrap"
    style.wordWrap = "break-word"
    for (const prop of MIRRORED_STYLE_PROPS) {
        style[prop] = computed[prop]
    }
    style.width = `${el.clientWidth}px`

    mirror.textContent = el.value.slice(0, caretIndex)
    const marker = document.createElement("span")
    marker.textContent = el.value.slice(caretIndex) || "."
    mirror.appendChild(marker)
    document.body.appendChild(mirror)

    const top = marker.offsetTop - el.scrollTop
    const left = marker.offsetLeft - el.scrollLeft
    const height = marker.offsetHeight

    document.body.removeChild(mirror)
    return { top, left, height }
}
