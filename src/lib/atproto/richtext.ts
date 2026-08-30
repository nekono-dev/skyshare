import { RichText } from "@atproto/api"

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

/**
 * facets/features からハッシュタグ(app.bsky.richtext.facet#tag)を抽出する。
 *
 * 責務と処理概要:
 * - `extractLinkUrisFromFacets` と同型の走査ロジックで facet/feature 配列を横断的に処理する。
 * - PostForm の投稿確定時、`RichText.detectFacetsWithoutResolution()` の結果からハッシュタグ履歴
 *   （`src/lib/settings/hashtagHistorySettings.ts`）へ記録するタグを取り出す用途で使う。
 *
 * 想定する入力形状(最小要件):
 * - `extractLinkUrisFromFacets` と同じ（Array<Facet> / Array<Feature> / それらを内包するオブジェクト）
 *
 * Input:
 * - `input`: facets/features を含む任意値（unknown）
 *
 * Output:
 * - 重複を除いたタグ文字列配列（"#"を含まない）
 *
 * 例:
 * - 入力: `{ facets: [{ features: [{ $type: "app.bsky.richtext.facet#tag", tag: "猫" }] }] }`
 * - 出力: `["猫"]`
 */
function extractTagsFromFacets(input?: unknown): string[] {
    const tags = new Set<string>()
    if (!input) return []

    const processArray = (arr: any[]) => {
        for (const item of arr) {
            if (!item) continue

            if (Array.isArray((item as any).features)) {
                for (const f of (item as any).features) {
                    if (
                        f &&
                        typeof f === "object" &&
                        f["$type"] === "app.bsky.richtext.facet#tag" &&
                        typeof f.tag === "string" &&
                        f.tag.length > 0
                    ) {
                        tags.add(f.tag)
                    }
                }
                continue
            }

            if (
                item &&
                typeof item === "object" &&
                item["$type"] === "app.bsky.richtext.facet#tag" &&
                typeof item.tag === "string" &&
                item.tag.length > 0
            ) {
                tags.add(item.tag)
                continue
            }

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

    return Array.from(tags)
}

/**
 * 複数の投稿本文から、使われているハッシュタグの使用数（何件の投稿で使われたか）を集計する。
 *
 * 責務と処理概要:
 * - Timeline読み込み時、ハッシュタグ履歴（`src/lib/settings/hashtagHistorySettings.ts`）が空の場合の
 *   初回候補seed用に使う。1投稿内で同じタグが複数回使われても、その投稿については1件としてのみ数える
 *   （`extractTagsFromFacets` が既に1投稿分のfacetsを重複排除して返すため）。
 * - タグの照合は大文字小文字を無視し、表記は最初に出現したものを採用する。
 *
 * Input:
 * - `texts`: 集計対象の投稿本文配列
 *
 * Output:
 * - 使用数の多い順（降順）に並べた `{ tag, count }` の配列
 *
 * 例:
 * - 入力: `["#猫 かわいい", "#猫 と #犬", "#犬"]`
 * - 出力: `[{ tag: "猫", count: 2 }, { tag: "犬", count: 2 }]`
 */
function countHashtagUsage(texts: string[]): { tag: string; count: number }[] {
    const counts = new Map<string, { tag: string; count: number }>()

    for (const text of texts) {
        let tags: string[]
        try {
            const rt = new RichText({ text })
            rt.detectFacetsWithoutResolution()
            tags = extractTagsFromFacets(rt.facets)
        } catch {
            continue
        }

        for (const tag of tags) {
            const key = tag.toLowerCase()
            const existing = counts.get(key)
            if (existing) {
                existing.count += 1
            } else {
                counts.set(key, { tag, count: 1 })
            }
        }
    }

    return Array.from(counts.values()).sort((a, b) => b.count - a.count)
}

export { extractLinkUrisFromFacets, extractTagsFromFacets, countHashtagUsage }
