/**
 * rtのfacets/featuresからリンクURIを抽出するユーティリティ
 *
 * 対応入力例:
 * - Array<Facet>  -> [{ index: {...}, features: [{ $type, uri, ... }, ...] }, ...]
 * - Array<Feature> -> [{ $type, uri, ... }, ...]
 * - RichTextオブジェクトのように `.facets` または `.features` を持つオブジェクト
 *
 * 戻り値: 重複を除いたURI文字列配列
 */
function extractLinkUrisFromFacets(input?: unknown): string[] {
    const uris = new Set<string>()
    if (!input) return []

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

            // ネストした配列などがあれば再帰で処理
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
