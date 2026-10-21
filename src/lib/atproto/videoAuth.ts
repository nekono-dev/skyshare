/**
 * 動画アップロード用サービス認証トークンの発行。
 *
 * 責務と処理概要:
 * - 動画サービス（video.bsky.app）は、`aud` が利用者の PDS の `did:web:<PDSホスト>`、
 *   `lxm` が `com.atproto.repo.uploadBlob` のトークンのみを受け付ける。
 * - 対応PDSは Bluesky 公式ホスティング（bsky.social 系）のみ。
 */
import type { AtpAgent } from "@atproto/api"

import { readPdsServiceFromDidDoc, resolvePdsServiceForDid } from "./did"
import { VIDEO_UPLOAD_TOKEN_TTL_SEC } from "../video/postVideoLimits"

/**
 * PDS の URL が動画投稿の対応PDS（bsky.social 系）か判定する。
 *
 * 例:
 * - 入力: `"https://bsky.social"` / `"https://amanita.us-east.host.bsky.network"`
 * - 出力: `true`
 * - 入力: `"https://example.com"` / `"https://evilbsky.social"`
 * - 出力: `false`
 */
export const isSupportedVideoPds = (pdsUrl: string): boolean => {
    let host: string
    try {
        host = new URL(pdsUrl).host
    } catch {
        return false
    }
    return host === "bsky.social" || host.endsWith(".host.bsky.network")
}

type VideoAuthAgent = Pick<AtpAgent, "com">

export type VideoUploadTokenResult =
    | { ok: true; token: string; did: string; expiresAt: number }
    | { ok: false; status: 400 | 500 }

/**
 * 動画アップロード用のサービス認証トークンを発行する。
 *
 * Input:
 * - `agent`: 認証済みエージェント
 * - `session`: 利用者のセッション（`didDoc` があれば PDS 解決に使う）
 * - `nowSec`: 現在時刻（UNIX 秒）
 *
 * Output:
 * - 成功: トークン・DID・有効期限
 * - 失敗: 対応PDS以外は 400、PDS 解決失敗・トークン発行失敗は 500
 *
 * トークンはログに出力しない（NFR-2）。
 */
export const createVideoUploadToken = async (
    agent: VideoAuthAgent,
    session: { did: string; didDoc?: unknown },
    nowSec: number,
): Promise<VideoUploadTokenResult> => {
    const pdsUrl =
        readPdsServiceFromDidDoc(session.didDoc) ??
        (await resolvePdsServiceForDid(session.did))
    if (!pdsUrl) return { ok: false, status: 500 }
    if (!isSupportedVideoPds(pdsUrl)) return { ok: false, status: 400 }

    const expiresAt = nowSec + VIDEO_UPLOAD_TOKEN_TTL_SEC
    try {
        const res = await agent.com.atproto.server.getServiceAuth({
            aud: `did:web:${new URL(pdsUrl).host}`,
            lxm: "com.atproto.repo.uploadBlob",
            exp: expiresAt,
        })
        return { ok: true, token: res.data.token, did: session.did, expiresAt }
    } catch {
        return { ok: false, status: 500 }
    }
}
