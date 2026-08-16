/**
 * RichText の facets / features からリンク URI を抽出するユーティリティ。
 *
 * 責務と処理概要:
 * - facets 配列・features 配列・それらを内包するオブジェクト入力を横断的に処理する。
 * - `app.bsky.richtext.facet#link` 型 feature の `uri` を重複排除して返す。
 *
 * 想定する入力形状(最小要件):
 * - Array<Facet>  -> [{ index: {...}, features: [{ $type, uri, ... }, ...] }, ...]
 * - Array<Feature> -> [{ $type, uri, ... }, ...]
 * - RichTextオブジェクトのように `.facets` または `.features` を持つオブジェクト
 *
 * Input:
 * - `input`: facets/features を含む任意値（unknown）
 *
 * Output:
 * - 重複を除いた URI 文字列配列
 *
 * 例:
 * - 入力: `{ facets: [{ features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://example.com" }] }] }`
 * - 出力: `["https://example.com"]`
 */
function extractLinkUrisFromFacets(input?: unknown): string[] {
    const uris = new Set<string>()
    if (!input) return []

    /**
     * facets/features 配列を走査し、link 型 feature の uri を収集する。
     *
     * Input:
     * - `arr`: facet または feature を含む配列
     *
     * Output:
     * - 返り値なし（外側 `uris` へ副作用的に追加）
     *
     * 例:
     * - 入力: `[{ features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://a" }] }]`
     * - 出力: `uris` に `https://a` が追加される
     */
    const processArray = (arr: any[]) => {
        for (const item of arr) {
            if (!item) continue

            // facetオブジェクト (内側にfeatures配列を持つ)
            if (Array.isArray((item as any).features)) {
                for (const f of (item as any).features) {
                    if (
                        f &&
                        typeof f === "object" &&
                        f["$type"] === "app.bsky.richtext.facet#link" &&
                        typeof f.uri === "string"
                    ) {
                        uris.add(f.uri)
                    }
                }
                continue
            }

            // 直接 feature オブジェクトの場合
            if (
                item &&
                typeof item === "object" &&
                item["$type"] === "app.bsky.richtext.facet#link" &&
                typeof item.uri === "string"
            ) {
                uris.add(item.uri)
                continue
            }

            // ネスト配列を再帰展開し、取りこぼしを防ぐ。
            if (Array.isArray(item)) {
                processArray(item)
            }
        }
    }

    if (Array.isArray(input)) {
        processArray(input)
    } else {
        const obj = input as any
        if (Array.isArray(obj.facets)) {
            processArray(obj.facets)
        } else if (Array.isArray(obj.features)) {
            processArray(obj.features)
        }
    }

    return Array.from(uris)
}

export { extractLinkUrisFromFacets }
