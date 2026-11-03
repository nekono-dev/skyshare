/**
 * legacy pageDB 連携ユーティリティ。
 *
 * 責務と処理概要:
 * - openapi(`/legacy/page`)経由で orval 生成された client 関数を呼び出す。
 *   legacy backend へのホスト付け替えは `@/lib/codegen/fetcher` の `customFetcher` が担う。
 * - レスポンスを成功/失敗を判別可能な型へ正規化する。
 *
 * 実装上の制約:
 * - Cloudflare Workers 環境で動作するため Node.js 固有 API は利用しない。
 */
import { deleteLegacyPage, getLegacyPage } from "@/client/openapi/client"

export type PageDbImage = {
    thumb: string
    alt: string
}

export type PageDbEntry = {
    ogp: string
    handle: string
    imgs: PageDbImage[]
}

export type PageDbErrorReason =
    "BadRequest" | "RateLimitExceeded" | "InternalServerError" | "UnknownError"

export type PageDbError = {
    error: PageDbErrorReason
}

/**
 * legacy pageDB から投稿情報(OGP画像・投稿者handle・添付画像)を削除する。
 *
 * 処理の趣旨:
 * - 旧システムのpageDBはlegacy backend経由でのみ参照可能なため、SSR上でHTTP越しに問い合わせる。
 * - legacy backend の `DELETE /page` を呼び出す。投稿者本人であることの検証は
 *   legacy backend 側が `accessJwt` から解決した DID と pageDB 上の DID を突き合わせて行う。
 * - `did` / `accessJwt` は呼び出し元（v2 セッション）由来のものをそのまま転送し、
 *   本関数では改めて検証しない。
 * - fetch失敗はいずれも `UnknownError` として呼び出し側へ返し、例外を投げない。
 *
 * Input:
 * - `dbIndex`: pageDBのシャード番号、または旧形式データを示す `"legacy"`
 * - `dbKey`: `${did}@${rkey}` 形式の投稿識別子
 * - `did`: 呼び出しユーザーの DID（legacy dbIndex の場合に必須）
 * - `accessJwt`: 呼び出しユーザーの Bluesky accessJwt
 *
 * Output:
 * - 成功時: `{ ok: true }`
 * - 失敗時: `PageDbError`(理由付き)
 *
 * 例:
 * - 入力: `{ dbIndex: "0", dbKey: "did:plc:abc@3lxyz", did: "did:plc:abc", accessJwt: "..." }`
 * - 出力: `{ ok: true }`
 */
export const deletePageDbEntry = async ({
    dbIndex,
    dbKey,
    did,
    accessJwt,
}: {
    dbIndex: string
    dbKey: string
    did: string
    accessJwt: string
}): Promise<{ ok: true } | PageDbError> => {
    try {
        const res = await deleteLegacyPage({
            pageId: `${dbIndex}/${dbKey}`,
            did,
            accessJwt,
        })

        if (res.status === 200) {
            return { ok: true }
        }

        return { error: res.data.error }
    } catch (error) {
        console.warn("deletePageDbEntry failed", {
            reason: error instanceof Error ? error.message : String(error),
            dbIndex,
            dbKey,
        })
        return { error: "UnknownError" }
    }
}

/**
 * legacy pageDB から投稿情報(OGP画像・投稿者handle・添付画像)を取得する。
 *
 * 処理の趣旨:
 * - 旧システムのpageDBはlegacy backend経由でのみ参照可能なため、SSR上でHTTP越しに問い合わせる。
 * - fetch失敗はいずれも `UnknownError` として呼び出し側へ返し、例外を投げない。
 *
 * Input:
 * - `dbIndex`: pageDBのシャード番号、または旧形式データを示す `"legacy"`
 * - `dbKey`: `${did}@${rkey}` 形式の投稿識別子
 *
 * Output:
 * - 成功時: `PageDbEntry`
 * - 失敗時: `PageDbError`(理由付き)
 *
 * 例:
 * - 入力: `{ dbIndex: "0", dbKey: "did:plc:abc@3lxyz" }`
 * - 出力: `{ ogp: "https://...", handle: "alice.bsky.social", imgs: [...] }`
 */
export const fetchPageDbEntry = async ({
    dbIndex,
    dbKey,
}: {
    dbIndex: string
    dbKey: string
}): Promise<PageDbEntry | PageDbError> => {
    try {
        const res = await getLegacyPage(
            encodeURIComponent(dbIndex),
            encodeURIComponent(dbKey),
        )

        if (res.status === 200) {
            return res.data
        }

        return { error: res.data.error }
    } catch (error) {
        console.warn("fetchPageDbEntry failed", {
            reason: error instanceof Error ? error.message : String(error),
            dbIndex,
            dbKey,
        })
        return { error: "UnknownError" }
    }
}
