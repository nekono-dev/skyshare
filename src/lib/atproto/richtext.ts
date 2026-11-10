/**
 * 投稿本文の facets（リンク・メンション・ハッシュタグ）の抽出と検出。
 *
 * - メンションの DID を解決するのは `detectFacetsForSubmission` だけで、公開 AppView に通信する。ほかの関数は通信しない。
 */
import { RichText } from "@atproto/api"
import type { BskyFacets } from "@/lib/atproto/recordTypes"
import { publicAtpAgent } from "./publicAgent"
import {
    filterLinkFacets,
    normalizePostFacets,
    type PostFacet,
} from "./richTextSegments"

/**
 * facets / features から `app.bsky.richtext.facet#link` 型 feature の `uri` を集め、重複を除いて返す。
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

            // 配列の要素が feature そのもの（`features` を持たない）の場合
            if (
                item &&
                typeof item === "object" &&
                item["$type"] === "app.bsky.richtext.facet#link" &&
                typeof item.uri === "string"
            ) {
                uris.add(item.uri)
                continue
            }

            // ネストした配列は再帰的に展開する。
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
 * facets / features から `app.bsky.richtext.facet#tag` 型 feature の `tag` を集め、重複を除いて返す。
 *
 * 想定する入力形状(最小要件):
 * - `extractLinkUrisFromFacets` と同じ（Array<Facet> / Array<Feature> / それらを内包するオブジェクト）
 *
 * Input:
 * - `input`: facets/features を含む任意値（unknown）
 *
 * Output:
 * - 重複を除いたタグ文字列配列（"#"を含まない。空文字のタグは除く）
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
 * 複数の投稿本文から、ハッシュタグが何件の投稿で使われたかを数える。
 *
 * - 1 投稿内で同じタグが複数回あっても、その投稿の 1 件として数える。
 * - タグの照合は大文字小文字を区別せず、表記は最初に出現したものを採用する。
 * - 検出が例外を投げた投稿は数えない。
 * - 通信は行わない（`RichText.detectFacetsWithoutResolution` で検出する）。
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

/**
 * 投稿本文の facets（URL・メンション・ハッシュタグ）を `RichText.detectFacets` で検出する。
 *
 * - メンション（`@handle`）の DID は公開 AppView（`publicAtpAgent`）で解決する。解決に失敗した feature の `did` は空文字になり、例外は投げない（`@atproto/api` の既定の動作）。
 *
 * Input:
 * - `text`: 投稿本文
 *
 * Output:
 * - 検出された facets 配列。該当がなければ空配列（`undefined` の場合もある）
 *
 * 例:
 * - 入力: `"https://example.com を見て @alice.bsky.social #猫"`
 * - 出力: `[{index:{byteStart,byteEnd}, features:[{$type:"app.bsky.richtext.facet#link", uri:"https://example.com"}]}, ...]`
 */
const detectFacetsForSubmission = async (
    text: string,
): Promise<BskyFacets | undefined> => {
    const rt = new RichText({ text })
    await rt.detectFacets(publicAtpAgent)
    // 検出が生成する feature は mention・link・tag の 3 種だけなので、`BskyFacets` として返す
    return rt.facets as BskyFacets | undefined
}

/**
 * 投稿本文から URL（link）の facets だけを、通信せずに検出する。
 *
 * - `detectFacetsWithoutResolution` で検出し、link の feature を持つ facets だけを返す（メンションの DID は解決しない）。
 *
 * Input:
 * - `text`: 投稿本文
 *
 * Output:
 * - link の feature を持つ facets。該当なしなら空配列
 *
 * 失敗時の方針:
 * - 検出が例外を投げた場合は、警告を出して空配列を返す。
 *
 * 例:
 * - 入力: `"見て https://example.com"`
 * - 出力: `[{ index: { byteStart: 7, byteEnd: 26 }, features: [{ $type: "app.bsky.richtext.facet#link", uri: "https://example.com" }] }]`
 */
const detectLinkFacets = (text: string): PostFacet[] => {
    try {
        const rt = new RichText({ text })
        rt.detectFacetsWithoutResolution()
        return filterLinkFacets(normalizePostFacets(rt.facets))
    } catch (err) {
        console.warn("detectLinkFacets: failed to detect links", err)
        return []
    }
}

export {
    detectLinkFacets,
    extractLinkUrisFromFacets,
    extractTagsFromFacets,
    countHashtagUsage,
    detectFacetsForSubmission,
}
