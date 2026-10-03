/**
 * リストボックスの項目間移動に関する純粋関数群。
 *
 * 責務と処理概要:
 * - 無効（disabled）項目を飛ばしたindex移動と、ラベル先頭一致検索を提供する。
 * - 項目の型には依存せず、`disabled`/`label`/`value` を持つ最小の形だけを要求する。
 * - indexが取れない場合は常に `-1` を返す。
 */

type Navigable = { disabled?: boolean }

/**
 * 先頭の有効項目のindexを返す。
 *
 * Input: `items` 項目一覧
 * Output: 有効項目のindex。無ければ `-1`
 *
 * 例: `[{disabled:true},{}]` → `1`
 */
export const firstEnabledIndex = (items: Navigable[]): number =>
    items.findIndex(item => !item.disabled)

/**
 * 末尾の有効項目のindexを返す。
 *
 * Input: `items` 項目一覧
 * Output: 有効項目のindex。無ければ `-1`
 *
 * 例: `[{},{disabled:true}]` → `0`
 */
export const lastEnabledIndex = (items: Navigable[]): number => {
    for (let i = items.length - 1; i >= 0; i--) {
        if (!items[i].disabled) return i
    }
    return -1
}

/**
 * 現在位置から指定方向の次の有効項目のindexを返す。端で循環しない。
 *
 * Input:
 * - `items`: 項目一覧
 * - `current`: 現在のindex（`-1` は未選択）
 * - `direction`: `1`（下）または `-1`（上）
 *
 * Output:
 * - 次の有効項目のindex。その方向に有効項目が無ければ `current` のまま。
 *   未選択（`-1`）からは、下なら先頭・上なら末尾の有効項目。全項目が無効なら `-1`
 *
 * 例: `([{},{disabled:true},{}], 0, 1)` → `2`
 */
export const nextEnabledIndex = (
    items: Navigable[],
    current: number,
    direction: 1 | -1,
): number => {
    if (current < 0) {
        return direction === 1
            ? firstEnabledIndex(items)
            : lastEnabledIndex(items)
    }
    for (
        let i = current + direction;
        i >= 0 && i < items.length;
        i += direction
    ) {
        if (!items[i].disabled) return i
    }
    return current
}

/**
 * 値に対応する有効項目のindexを返す。無ければ先頭の有効項目。
 *
 * Input:
 * - `items`: 項目一覧
 * - `value`: 探す値
 *
 * Output: index。有効項目が全く無ければ `-1`
 *
 * 例: `([{value:"a"},{value:"b"}], "b")` → `1`
 */
export const indexOfEnabled = (
    items: (Navigable & { value: string })[],
    value: string,
): number => {
    const index = items.findIndex(
        item => item.value === value && !item.disabled,
    )
    return index >= 0 ? index : firstEnabledIndex(items)
}

/**
 * ラベルが入力文字列で始まる有効項目のindexを返す（ネイティブ `<select>` 相当）。
 *
 * 処理の趣旨:
 * - 同一文字の連打（"aaa"）は、現在位置の次から巡回して同じ文字で始まる項目を順に巡る。
 * - それ以外は現在位置自身を起点に探し、末尾まで無ければ先頭へ巡回する。
 * - 大文字小文字は区別しない。
 *
 * Input:
 * - `items`: 項目一覧
 * - `text`: 連続入力された文字列
 * - `current`: 現在のindex
 *
 * Output: 一致した項目のindex。無ければ `-1`
 *
 * 例: `([{label:"Apple"},{label:"Avocado"}], "a", 0)` → `0`
 */
export const findPrefixIndex = (
    items: (Navigable & { label: string })[],
    text: string,
    current: number,
): number => {
    if (text === "" || items.length === 0) return -1
    const needle = text.toLowerCase()
    const isRepeat =
        needle.length > 1 && [...needle].every(c => c === needle[0])
    const search = isRepeat ? needle[0] : needle
    const start = isRepeat ? current + 1 : Math.max(current, 0)
    for (let offset = 0; offset < items.length; offset++) {
        const i = (start + offset) % items.length
        if (
            !items[i].disabled &&
            items[i].label.toLowerCase().startsWith(search)
        ) {
            return i
        }
    }
    return -1
}
