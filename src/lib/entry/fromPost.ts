/**
 * 既存の Bluesky 投稿から skyshare entry を発行する（from-post 相当）処理。
 *
 * 責務と処理概要:
 * - POST /v2/entry で `uri` が指定された場合のオーケストレーション処理を担う。
 * - `uri` の所有権検証・サムネイルアップロード・
 *   skyshare entry 作成という一連の流れを合成する。
 */

import {
    type AtpAgent,
    type AppBskyFeedPost,
    type ComAtprotoServerRefreshSession,
} from "@atproto/api"
import { uploadBlob } from "@/lib/atproto/blob"
import { resolveDisplayName } from "@/lib/atproto/profile"
import { ENTRY_COLLECTION } from "@/lib/atproto/nsid"
import {
    buildSkyshareEntryRecord,
    toCreatedSkyshareEntry,
    type CreatedSkyshareEntry,
} from "@/lib/entry/skyshareRecord"
import { bskyPostUrlgen, parseOwnedAtUri } from "@/lib/entry/url"

type FromPostAgent = Pick<AtpAgent, "uploadBlob" | "getProfile"> & {
    com: {
        atproto: {
            repo: Pick<
                AtpAgent["com"]["atproto"]["repo"],
                "getRecord" | "createRecord"
            >
        }
    }
}

/**
 * `uri` 指定時（from-post 相当）のレスポンス種別。
 */
export type FromPostResult =
    | { ok: true; bskyUrl: string; skyshareEntry: CreatedSkyshareEntry }
    | { ok: false; status: 400 | 404 | 500 }

/**
 * 既存の Bluesky 投稿から skyshare entry を発行する（from-post 相当の処理）。
 *
 * 処理の趣旨:
 * - `uri` の repo が session の DID と一致することを確認し、他人の投稿からの発行を防ぐ。
 * - 対象投稿が画像を持つか等の作成可否判定は行わない（クライアントの責務）。
 *   クライアントが合成した `visual` をアップロードし、entry の visual として採用する。
 * - entry の `source` は常に検証済みの対象投稿自身とする（自動解決しない）。
 * - bsky 投稿は新規作成せず、既存投稿の URL をそのまま返す。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent（または同等の最小インターフェース）
 * - `postUri`: 対象となる自分自身の app.bsky.feed.post の AT URI
 * - `session`: セッション情報（DID・handle 取得用）
 * - `visual`: クライアントが合成したサムネイル Blob（必須）
 *
 * Output:
 * - 成功時: `{ ok: true, bskyUrl, skyshareUri }`
 * - 失敗時: `{ ok: false, status }`（400: URI 不正/visual欠落、404: 投稿が見つからない、500: 発行失敗）
 */
export const createEntryFromExistingPost = async (
    agent: FromPostAgent,
    postUri: string,
    session: ComAtprotoServerRefreshSession.OutputSchema,
    visual: Blob | undefined,
): Promise<FromPostResult> => {
    const parsedPostUri = parseOwnedAtUri(
        postUri,
        "app.bsky.feed.post",
        session.did,
    )
    if (!parsedPostUri) {
        return { ok: false, status: 400 }
    }

    let postRecordRes
    try {
        postRecordRes = await agent.com.atproto.repo.getRecord({
            repo: session.did,
            collection: "app.bsky.feed.post",
            rkey: parsedPostUri.rkey,
        })
    } catch (err) {
        console.warn("createEntry: source post not found (from-post)", err)
        return { ok: false, status: 404 }
    }

    const postCid = postRecordRes.data.cid
    const postRecord = postRecordRes.data.value as AppBskyFeedPost.Main
    if (!postCid) {
        return { ok: false, status: 500 }
    }

    if (!visual) {
        console.warn("createEntry: visual is required (from-post)")
        return { ok: false, status: 400 }
    }

    let uploadedVisual
    try {
        uploadedVisual = await uploadBlob(agent, visual)
    } catch (err) {
        console.error("createEntry: visual upload failed (from-post)", err)
        return { ok: false, status: 500 }
    }

    const postText = typeof postRecord.text === "string" ? postRecord.text : ""
    const userName = await resolveDisplayName(
        agent,
        session.did,
        session.handle,
    )

    // sourceは検証済みの対象投稿自身。reply.rootを辿る自動解決は行わない
    // （どの投稿をsourceにするかはクライアントの責務、specs/entry/backend/design.md §7.2）。
    const source = { uri: postUri, cid: postCid }

    let skyshareEntry: CreatedSkyshareEntry
    try {
        const createdAt = new Date().toISOString()
        const record = buildSkyshareEntryRecord({
            sourceUri: source.uri,
            sourceCid: source.cid,
            visual: uploadedVisual,
            postText,
            userName,
            createdAt,
        })
        const createRecordRes = await agent.com.atproto.repo.createRecord({
            repo: session.did,
            collection: ENTRY_COLLECTION,
            record,
        })
        skyshareEntry = toCreatedSkyshareEntry(record, session.did, {
            uri: createRecordRes.data.uri,
            cid: createRecordRes.data.cid,
        })
    } catch (err) {
        console.error(
            `createEntry: ${ENTRY_COLLECTION} create failed (from-post)`,
            err,
        )
        return { ok: false, status: 500 }
    }

    return {
        ok: true,
        bskyUrl: bskyPostUrlgen(session.handle, parsedPostUri.rkey),
        skyshareEntry,
    }
}
