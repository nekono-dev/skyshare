/**
 * リストボックス項目の絞り込み判定。
 *
 * 責務と処理概要:
 * - 全角半角・大文字小文字を区別しない部分一致で項目を絞り込む。
 */

type Filterable = { label: string; searchText?: string }

/**
 * 絞り込み用に文字列を正規化する（NFKC + 小文字化）。
 *
 * Input: `s` 任意の文字列
 * Output: 正規化後の文字列
 *
 * 例: `"ＫＯ"` → `"ko"`
 */
export const normalizeForSearch = (s: string): string =>
    s.normalize("NFKC").toLowerCase()

/**
 * `label` または `searchText` に `query` を含む項目だけを返す。
 *
 * Input:
 * - `items`: 項目一覧
 * - `query`: 入力文字列（前後の空白は無視。空なら全件）
 *
 * Output: 絞り込み後の項目一覧（元の順序を保つ）
 *
 * 例: `([{label:"한국어",searchText:"ko"}], "KO")` → 同項目1件
 */
export const filterOptions = <T extends Filterable>(
    items: T[],
    query: string,
): T[] => {
    const q = normalizeForSearch(query.trim())
    if (q === "") return items
    return items.filter(
        item =>
            normalizeForSearch(item.label).includes(q) ||
            (item.searchText !== undefined &&
                normalizeForSearch(item.searchText).includes(q)),
    )
}
