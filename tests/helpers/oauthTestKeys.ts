/**
 * 予約投稿の OAuth のテスト用の鍵と、保管する認可の情報。
 *
 * - `createTestClientSecret`: Worker のシークレット `OAUTH_CLIENT_KEY` に入れる JSON を作る。
 * - `createTestCredentialToken`: 保管の層の `token` に入れる、OAuth の認可の情報の文字列を作る。
 *   トークンの端点は fakePds が受ける `https://pds/oauth/token` にする。
 */
import { generateEcJwk } from "@/lib/oauth/jose"
import { serializeCredential } from "@/lib/schedule/oauth/storedCredential"

export const TEST_TOKEN_ENDPOINT = "https://pds/oauth/token"
export const TEST_ISSUER = "https://pds"

export const createTestClientSecret = async (): Promise<string> =>
    JSON.stringify({ ...(await generateEcJwk()), kid: "test-key" })

export const createTestCredentialToken = async (
    refreshToken = "OLD-REFRESH",
): Promise<string> =>
    serializeCredential({
        v: 1,
        clientId: "https://skyshare.test/oauth/client-metadata.json",
        refreshToken,
        dpopJwk: await generateEcJwk(),
        issuer: TEST_ISSUER,
        tokenEndpoint: TEST_TOKEN_ENDPOINT,
    })
