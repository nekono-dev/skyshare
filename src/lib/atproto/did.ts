/**
 * `did:plc:` の DID から PDS（個人データを保存するサーバー）の URL を解決する。取得や抽出に失敗したときは例外を投げず `undefined` を返す。
 *
 * - atproto 公式実装（`atproto/packages/identity/src/did/did-resolver.ts`）の最小版。
 */

import { plcDirectoryBaseUrl } from "@/env"

/**
 * DID Document から atproto PDS の service endpoint を抽出する。
 *
 * 想定する入力形状(最小要件):
 * - `didDoc` は object
 * - `didDoc.service` は配列
 * - 配列要素は object で、次のプロパティを持ちうる:
 *   - `id`
 *   - `type`
 *   - `serviceEndpoint`
 *
 * 一致条件（すべて満たす service のうち、最初のものの `serviceEndpoint` を返す）:
 * - `id === "#atproto_pds"`
 * - `type === "AtprotoPersonalDataServer"`
 * - `serviceEndpoint` が空でない文字列
 *
 * Input:
 * - `didDoc`: PLC Directory 等から得た DID Document (unknown)
 *
 * Output:
 * - 見つかった場合: PDS の URL 文字列
 * - 見つからない/不正形式の場合: `undefined`
 *
 * 例:
 * - 入力: `{ service: [{ id: "#atproto_pds", type: "AtprotoPersonalDataServer", serviceEndpoint: "https://example.social" }] }`
 * - 出力: `"https://example.social"`
 */
export const readPdsServiceFromDidDoc = (
    didDoc: unknown,
): string | undefined => {
    if (!didDoc || typeof didDoc !== "object") return

    const services = (didDoc as { service?: unknown }).service
    if (!Array.isArray(services)) return

    for (const service of services) {
        if (!service || typeof service !== "object") continue

        const serviceRecord = service as {
            id?: unknown
            type?: unknown
            serviceEndpoint?: unknown
        }

        if (serviceRecord.id !== "#atproto_pds") continue
        if (serviceRecord.type !== "AtprotoPersonalDataServer") continue
        if (typeof serviceRecord.serviceEndpoint !== "string") continue
        if (serviceRecord.serviceEndpoint.length === 0) continue

        return serviceRecord.serviceEndpoint
    }

    return
}

/**
 * `did:plc:` 形式の DID から PDS service endpoint を解決する。
 *
 * 副作用: PLC Directory（`plcDirectoryBaseUrl`）へ `fetch` で問い合わせる。HTTP が成功したときだけ JSON を読む。
 *
 * Input:
 * - `did`: 例 `"did:plc:z72i7hdynmk6r22z27h6tvur"`
 *
 * Output:
 * - 解決成功時: PDS の URL 文字列
 * - DID 不正/取得失敗/抽出失敗時: `undefined`
 *
 * 例:
 * - 入力: `"did:plc:z72i7hdynmk6r22z27h6tvur"`
 * - 出力: `"https://bsky.social"` (DID Document の内容に依存)
 */
export const resolvePdsServiceForDid = async (
    did: string,
): Promise<string | undefined> => {
    if (!did.startsWith("did:plc:")) return

    const url = new URL(`/${encodeURIComponent(did)}`, plcDirectoryBaseUrl)
    const response = await fetch(url)

    if (!response.ok) return

    const didDoc = (await response.json()) as unknown
    return readPdsServiceFromDidDoc(didDoc)
}
