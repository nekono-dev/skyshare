/**
 * Skyshare Entry の OGP キャッシュを共有直後に best-effort で温める。
 *
 * - 失敗しても Entry 作成・共有フローを妨げないよう、例外を呼び出し元へ投げない。
 * - URL が空文字なら何もしない。
 */
import { extractUrl } from "@/client/openapi/client"

/**
 * 発行済みの URL を OGP 抽出サービスへ通し、Cloudflare のエッジ側の DNS とレスポンスのキャッシュを温める。
 *
 * - Intent や WebShare での共有の直後に、相手側が OGP カードを作る際の初回アクセスがコールドスタートになるのを避ける。
 *
 * Input:
 * - `url`: 温め対象の Skyshare Entry URL（空文字なら何もしない）
 *
 * Output:
 * - なし
 */
export const warmOgpCache = async (url: string): Promise<void> => {
    if (!url) return
    try {
        await extractUrl({ url }, { signal: AbortSignal.timeout(3000) })
    } catch {
        // best-effort: 失敗してもEntry作成/共有フローは継続する
    }
}
