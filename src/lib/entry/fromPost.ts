/**
 * 既存の Bluesky 投稿から skyshare entry を発行する（from-post 相当）処理。
 *
 * 責務と処理概要:
 * - POST /v2/entry で `uri` が指定された場合のオーケストレーション処理を担う。
 * - `uri` の所有権検証・対象投稿の画像投稿判定・サムネイルアップロード・
 *   skyshare entry 作成という一連の流れを合成する。
 */

import type {
    AtpAgent,
    AppBskyEmbedImages,
    AppBskyFeedPost,
    ComAtprotoServerRefreshSession,
} from "@atproto/api"
import { uploadBlob } from "@/lib/atproto/blob"
import { resolveDisplayName } from "@/lib/atproto/profile"
import {
    createSkyshareEntry,
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
 * - 対象投稿が画像投稿であることを確認した上で、クライアントが元投稿の全画像から
 *   デフォルト配置（クロップ編集なし）で合成した `ogImage` をアップロードし、
 *   その blob 参照を manifest.visual として採用する（先頭画像の直接流用はしない）。
 * - bsky 投稿は新規作成せず、既存投稿の URL をそのまま返す。
 *
 * Input:
 * - `agent`: 認証済み AtpAgent（または同等の最小インターフェース）
 * - `postUri`: 対象となる自分自身の app.bsky.feed.post の AT URI
 * - `session`: セッション情報（DID・handle 取得用）
 * - `ogImage`: クライアントが合成したサムネイル Blob（必須）
 *
 * Output:
 * - 成功時: `{ ok: true, bskyUrl, skyshareUri }`
 * - 失敗時: `{ ok: false, status }`（400: URI 不正/画像なし/ogImage欠落、404: 投稿が見つからない、500: 発行失敗）
 */
export const createEntryFromExistingPost = async (
    agent: FromPostAgent,
    postUri: string,
    session: ComAtprotoServerRefreshSession.OutputSchema,
    ogImage: Blob | undefined,
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

    const embed = postRecord.embed
    const hasEligibleImage =
        embed?.$type === "app.bsky.embed.images" &&
        ((embed as AppBskyEmbedImages.Main).images?.length ?? 0) > 0
    if (!hasEligibleImage) {
        console.warn(
            "createEntry: source post has no eligible image (from-post)",
        )
        return { ok: false, status: 400 }
    }

    if (!ogImage) {
        console.warn("createEntry: ogImage is required (from-post)")
        return { ok: false, status: 400 }
    }

    let visual
    try {
        visual = await uploadBlob(agent, ogImage)
    } catch (err) {
        console.error("createEntry: ogImage upload failed (from-post)", err)
        return { ok: false, status: 500 }
    }

    const postText = typeof postRecord.text === "string" ? postRecord.text : ""
    const userName = await resolveDisplayName(
        agent,
        session.did,
        session.handle,
    )

    let skyshareEntry: CreatedSkyshareEntry | undefined
    try {
        skyshareEntry = await createSkyshareEntry(
            agent,
            postUri,
            postCid,
            visual,
            postText,
            userName,
            session,
        )
    } catch (err) {
        console.error(
            "createEntry: dev.nekono.skyshare.entry create failed (from-post)",
            err,
        )
        return { ok: false, status: 500 }
    }

    if (!skyshareEntry) {
        return { ok: false, status: 500 }
    }

    return {
        ok: true,
        bskyUrl: bskyPostUrlgen(session.handle, parsedPostUri.rkey),
        skyshareEntry,
    }
}
