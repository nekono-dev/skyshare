/**
 * CountedTextInput の autoGrow（textareaの自動伸長）に関わる純粋関数群。
 *
 * 責務と処理概要:
 * - getComputedStyle等で得たDOM由来の生値（lineHeight文字列、scrollHeight等）を
 *   受け取り、実際に textarea へ適用すべき height / overflow-y を計算する。
 * - DOM/Reactに依存しないため、Node環境（vitest）で単体テストできる。
 */

/**
 * getComputedStyle().lineHeight の値をpx数値に解決する。
 * "normal" や（環境によって起こりうる）unitless値にはフォールバックで対応する。
 *
 * Input:
 * - `computedLineHeight`: 例 "22.4px" / "normal" / "1.4"
 * - `fontSizePx`: 同要素のcomputed font-size（px）
 *
 * Output:
 * - px単位の行の高さ
 *
 * 例:
 * - 入力: `("22.4px", 16)`
 * - 出力: `22.4`
 */
export const resolveLineHeightPx = (
    computedLineHeight: string,
    fontSizePx: number,
): number => {
    if (computedLineHeight.endsWith("px")) {
        const px = parseFloat(computedLineHeight)
        if (!Number.isNaN(px)) return px
    }
    const unitless = parseFloat(computedLineHeight)
    if (!Number.isNaN(unitless) && !computedLineHeight.endsWith("px")) {
        return unitless * fontSizePx
    }
    // "normal" 等、解決できない場合は一般的なブラウザ既定値(1.2倍)にフォールバック
    return fontSizePx * 1.2
}

/**
 * 行数(rows/maxRows)から、textareaに適用する最小/最大高さ(px)を算出する。
 *
 * Input:
 * - `rows`: 初期/最小行数
 * - `maxRows`: 最大行数（undefinedなら無制限）
 * - `lineHeightPx`: 1行の高さ(px)
 * - `verticalExtraPx`: padding-top/bottom + border-top/bottom-width の合計(px)
 *
 * Output:
 * - `minHeightPx` / `maxHeightPx`（maxRows未指定ならmaxHeightPxはundefined）
 *
 * 例:
 * - 入力: `(2, 7, 20, 8)`
 * - 出力: `{ minHeightPx: 48, maxHeightPx: 148 }`
 */
export const computeAutoGrowBounds = (
    rows: number,
    maxRows: number | undefined,
    lineHeightPx: number,
    verticalExtraPx: number,
): { minHeightPx: number; maxHeightPx: number | undefined } => ({
    minHeightPx: rows * lineHeightPx + verticalExtraPx,
    maxHeightPx:
        maxRows === undefined
            ? undefined
            : maxRows * lineHeightPx + verticalExtraPx,
})

/**
 * scrollHeightをmin/max(px)にクランプし、適用すべきheightとoverflow-yを決める。
 *
 * Input:
 * - `scrollHeightPx`: リセット直後に読み取ったel.scrollHeight
 * - `minHeightPx` / `maxHeightPx`（undefinedなら上限なし）
 *
 * Output:
 * - `heightPx`: style.heightに設定するpx値
 * - `overflowY`: 上限に達していれば"auto"、そうでなければ"hidden"
 *
 * 例:
 * - 入力: `(200, 48, 148)`
 * - 出力: `{ heightPx: 148, overflowY: "auto" }`
 */
export const clampAutoGrowHeightPx = (
    scrollHeightPx: number,
    minHeightPx: number,
    maxHeightPx: number | undefined,
): { heightPx: number; overflowY: "hidden" | "auto" } => {
    const exceedsMax = maxHeightPx !== undefined && scrollHeightPx > maxHeightPx
    const clampedToMax = exceedsMax ? maxHeightPx : scrollHeightPx
    const heightPx = Math.max(minHeightPx, clampedToMax)
    return { heightPx, overflowY: exceedsMax ? "auto" : "hidden" }
}
