/**
 * Skyshare Entry作成直後に発行済みURLをOGP抽出サービスへ通し、
 * Cloudflareエッジ側のDNS/レスポンスキャッシュを事前に温める。
 *
 * 処理の趣旨:
 * - Intent/WebShareでの共有直後に相手側がOGPカードを生成する際、
 *   `skyshare.nekono.dev` への初回アクセスがコールドスタートになるのを避ける。
 * - あくまでキャッシュ温めが目的のbest-effort処理のため、失敗しても
 *   呼び出し元のEntry作成・共有フローを妨げないよう例外を外へ投げない。
 *
 * Input:
 * - `url`: 温め対象のSkyshare Entry URL(空文字なら何もしない)
 *
 * Output:
 * - なし
 */
import { extractUrl } from "@/client/openapi/client"

export const warmOgpCache = async (url: string): Promise<void> => {
    if (!url) return
    try {
        await extractUrl({ url }, { signal: AbortSignal.timeout(3000) })
    } catch {
        // best-effort: 失敗してもEntry作成/共有フローは継続する
    }
}
