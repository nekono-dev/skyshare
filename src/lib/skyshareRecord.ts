/**
 * dev.nekono.skyshare.entry レコード作成ユーティリティ。
 *
 * 責務と処理概要:
 * - bsky 投稿情報と visual blob から skyshare entry レコードを組み立て、atproto へ作成する。
 * - `/v1/entry`（新規投稿時）と `/v1/entry/from-post`（既存投稿からの発行）の両方から共有される。
 */
import type { AtpAgent, ComAtprotoServerRefreshSession } from "@atproto/api"
import { parseAtUri, skyshareEntryUrlgen } from "@/lib/url"

/**
 * skyshare entry レコードを作成し、skyshareUri を返す。
 *
 * 処理の趣旨:
 * - bsky 投稿の URI・CID と、visual blob、テキスト情報を含むレコード構造を生成・作成する。
 * - 副作用: atproto 外部 API を呼び出してレコードを作成。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent
 * - `bskyPostUri`: bsky 投稿の AT URI（source）
 * - `bskyPostCid`: bsky 投稿の CID
 * - `visual`: skyshare entry の manifest.visual に使う blob 参照
 * - `postText`: 投稿本文（caption として使用）
 * - `userName`: 投稿者表示名
 * - `session`: セッション情報（DID 取得用）
 *
 * Output:
 * - skyshareUri: string（skyshare エントリの URL、作成失敗時は空文字列）
 *
 * 失敗時の方針:
 * - atproto API 失敗時は Error を throw。呼び出し元で catch して 500 を返す。
 *
 * 例:
 * - 入力：agent(Auth済み),uri="at://...",cid="bafy...",visual=blobRef,postText="Hello",userName="alice"
 * - 出力：skyshareUri="https://skyshare.dev/did/rkey"
 */
export const createSkyshareEntry = async (
    agent: AtpAgent,
    bskyPostUri: string,
    bskyPostCid: string,
    visual: any,
    postText: string,
    userName: string,
    session: ComAtprotoServerRefreshSession.OutputSchema,
) => {
    const createdAt = new Date().toISOString()
    const headingText = postText.trim()

    const record = {
        $type: "dev.nekono.skyshare.entry",
        source: {
            uri: bskyPostUri,
            cid: bskyPostCid,
        },
        manifest: {
            $type: "dev.nekono.skyshare.defs#manifest",
            visual,
            heading: `${userName} 's Post`,
            caption: headingText.length > 0 ? headingText : "",
        },
        createdAt,
    }

    console.debug("createSkyshareEntry: record to create", record)

    const createRecordRes = await agent.com.atproto.repo.createRecord({
        repo: session.did,
        collection: "dev.nekono.skyshare.entry",
        record,
    })

    const parsedSkyshareUri = parseAtUri(createRecordRes.data.uri)
    if (!parsedSkyshareUri) {
        return ""
    }

    return skyshareEntryUrlgen(parsedSkyshareUri.repo, parsedSkyshareUri.rkey)
}
