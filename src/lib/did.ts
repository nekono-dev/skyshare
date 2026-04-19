/**
 * DID(Decentralized Identifier) から PDS(Personal Data Server) の URL を解決するユーティリティ群。
 *
 * 概要:
 * - `did:plc:` 形式の DID を受け取り、PLC Directory から DID Document を取得する。
 * - DID Document の `service` 配列を走査し、atproto PDS 用のエンドポイントを抽出する。
 * - 取得失敗や形式不正時は例外を投げず `undefined` を返す設計にしている。
 *
 * 背景:
 * - atproto 公式実装 (`atproto/packages/identity/src/did/did-resolver.ts`) を
 *   本コードベース向けに最小限へ簡易化している。
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
 * 処理の趣旨:
 * - `didDoc` が期待する形を満たすか段階的に検証する。
 * - 検証を通過した要素のうち、以下をすべて満たす service を探索する。
 *   - `id === "#atproto_pds"`
 *   - `type === "AtprotoPersonalDataServer"`
 *   - `serviceEndpoint` が空でない文字列
 * - 最初に一致した `serviceEndpoint` を抽出して返す。
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
const readPdsServiceFromDidDoc = (didDoc: unknown): string | undefined => {
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

        // atproto PDS の service 定義だけを通し、妥当な URL 文字列を返す。
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
 * 処理:
 * - DID が `did:plc:` で始まるかを確認する。
 * - PLC Directory に DID Document を問い合わせる。
 * - HTTP レスポンスが成功時のみ JSON を読み取り、`readPdsServiceFromDidDoc` で抽出する。
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
    const response = await fetch(url, {
        redirect: "error",
        headers: {
            accept: "application/did+ld+json,application/json",
        },
    })

    if (!response.ok) return

    const didDoc = (await response.json()) as unknown
    return readPdsServiceFromDidDoc(didDoc)
}
