/**
 * 予約投稿の OAuth のクライアントの秘密鍵（P-256 の JWK）を生成し、1行の JSON で標準出力へ出す。
 *
 * 使い方（値を画面やファイルに残さず、そのままシークレットへ渡す）:
 *   node hack/generate-oauth-key.mjs | npx wrangler secret put SCHEDULE_OAUTH_KEY --name <Worker 名>
 *
 * - `kid` は生成の日時から作る。鍵を入れ替えたときに、認可サーバーが新しい鍵を区別できるようにする。
 * - 出力は秘密鍵そのもの。ログやリポジトリに残さないこと。
 */
import { webcrypto } from "node:crypto"

const { subtle } = webcrypto
const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
])
const jwk = await subtle.exportKey("jwk", pair.privateKey)
const kid = `skyshare-${new Date().toISOString().slice(0, 10)}`
process.stdout.write(
    JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d, kid }),
)
