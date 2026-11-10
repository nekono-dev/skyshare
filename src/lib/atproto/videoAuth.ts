/**
 * 動画アップロード用のサービス認証トークンを発行する。
 *
 * - 動画アップロード用トークンは、`aud` を `did:web:<PDS ホスト>`、`lxm` を `com.atproto.repo.uploadBlob` にして発行する（`getServiceAuth` の引数）。
 * - 発行するのは対応 PDS（`bsky.social` と `*.host.bsky.network`）のトークンだけ。
 */
import type { Agent } from "@atproto/api"

import { readPdsServiceFromDidDoc, resolvePdsServiceForDid } from "./did"
import { VIDEO_UPLOAD_TOKEN_TTL_SEC } from "@/lib/video/postVideoLimits"

/**
 * PDS の URL が動画投稿の対応 PDS（`bsky.social` と `*.host.bsky.network`）か判定する。URL として解釈できなければ `false`。
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

type VideoAuthAgent = Pick<Agent, "com">

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
 * - 成功: `token`・`did`（`session.did`）・`expiresAt`（UNIX 秒。`nowSec` に `VIDEO_UPLOAD_TOKEN_TTL_SEC` を足した値）
 * - 失敗: 対応 PDS 以外は 400。PDS 解決が `undefined` を返したとき（`did:plc:` 以外、PLC Directory の応答が成功でない、DID Document に PDS が無い）と、`getServiceAuth` が失敗したときは 500。PLC Directory への `fetch` と JSON の読み取りの例外は捕捉せず、reject として呼び出し元へ伝播する。
 *
 * トークンをログに出力しない。
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
