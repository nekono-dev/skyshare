/**
 * Skyshare v2 bsky/images API。
 *
 * 責務と処理概要:
 * - Cookie セッションを検証した上で、Bluesky PDS の生 blob（com.atproto.sync.getBlob）を
 *   同一オリジンでそのまま返す。
 * - cdn.bsky.app（画像CDN）は Access-Control-Allow-Origin を返さないため、ブラウザの
 *   Canvas 合成（Timelineからのentry作成時のデフォルト配置サムネイル生成）用に画像バイトを
 *   読み出す手段として、PDS本体の getBlob を経由するこのエンドポイントを用意している。
 *
 * 実装上の制約:
 * - Cloudflare Workers 環境で動作するため Node.js 固有 API は使わない。
 * - 対象は常にセッション自身の repo（session.did）に限定し、他人の repo を
 *   任意に読み出せる汎用プロキシにはしない（必要になれば did パラメータを追加検討する）。
 */
import type { APIRoute } from "astro"

import {
    errorResponseFromStatus,
    resolveXrpcStatus,
} from "@/lib/api/response.js"

/**
 * GET /v2/bsky/images: 自分自身の repo から画像 blob を取得する。
 *
 * 想定する入力形状(最小要件):
 * - クエリ: `cid`（必須、非空文字列）
 *
 * 処理の趣旨:
 * - `com.atproto.sync.getBlob` を呼び出し、得られた生バイト列を上流の Content-Type を
 *   引き継いだままそのまま返す。JSON化はせず、クライアントの Canvas 合成で直接扱える形にする。
 *
 * Input:
 * - `request`: cookie と `cid` クエリを含む HTTP リクエスト
 *
 * Output:
 * - 200: 画像バイナリ（Content-Type は上流のものを引き継ぐ）
 * - 400: `cid` 未指定/不正
 * - 401: 未認証
 * - 404: blob もしくは repo が見つからない
 * - 500: その他失敗
 *
 * 例:
 * - 入力: `GET /v2/bsky/images?cid=bafkreiaocls5vzoyou3nn6wgweg5uxpxelbfjgejgcnnj4bqi3jkbdipm`
 * - 出力: `image/jpeg` バイナリ
 */
export const GET: APIRoute = async ({ request, locals }) => {
    try {
        const { agent, session } = locals
        if (!agent || !session) {
            return errorResponseFromStatus(401)
        }

        const cid = new URL(request.url).searchParams.get("cid")
        if (!cid || cid.trim().length === 0) {
            return errorResponseFromStatus(400)
        }

        const blobRes = await agent.com.atproto.sync.getBlob({
            did: session.did,
            cid,
        })

        return new Response(new Uint8Array(blobRes.data), {
            status: 200,
            headers: {
                "Content-Type":
                    blobRes.headers["content-type"] ??
                    "application/octet-stream",
            },
        })
    } catch (err) {
        console.error("bsky/images.ts GET:", err)
        return errorResponseFromStatus(resolveXrpcStatus(err))
    }
}
