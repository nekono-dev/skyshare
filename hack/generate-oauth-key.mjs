/**
 * 予約投稿の OAuth のクライアントの秘密鍵（P-256 の JWK）を生成し、1行の JSON で標準出力へ出す。
 *
 * 使い方（値を画面やファイルに残さず、そのままシークレットへ渡す）:
 *   node hack/generate-oauth-key.mjs | npx wrangler secret put OAUTH_CLIENT_KEY --name <Worker 名>
 *
 * - `kid` は生成の日時から作る。鍵を入れ替えたときに、認可サーバーが新しい鍵を区別できるようにする。
 * - 出力は秘密鍵そのもの。ログやリポジトリに残さないこと。
 * - ローカル実行用の `.dev.vars` には、`hack/prepare-local-env.mjs` がこの関数で自動生成する。
 */
import { webcrypto } from "node:crypto"
import { pathToFileURL } from "node:url"

/**
 * OAuth のクライアント秘密鍵（`kid` を含む P-256 の JWK）を1行の JSON 文字列で生成する。
 */
export const generateOauthKey = async () => {
  const { subtle } = webcrypto
  const pair = await subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  )
  const jwk = await subtle.exportKey("jwk", pair.privateKey)
  const kid = `skyshare-${new Date().toISOString().slice(0, 10)}`
  return JSON.stringify({
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    y: jwk.y,
    d: jwk.d,
    kid,
  })
}

// 直接実行されたときだけ標準出力へ出す（import されたときは出さない）
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.stdout.write(await generateOauthKey())
}
