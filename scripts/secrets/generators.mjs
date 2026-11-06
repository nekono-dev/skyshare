// 自動生成するシークレットの生成関数の、唯一の定義。
//
// 使う場所: scripts/secrets/prepare-local-env.mjs（ローカルの .dev.vars に書く）と、scripts/secrets/ensure-worker-secrets.mjs（Worker へ登録する）。
// 責務: 名前と生成関数の対応だけを持つ。値を保存はしない（呼び出し側が扱う）。
// 手作業で値を出す使い方（値をファイルに残さず、そのままシークレットへ渡す）:
//   node scripts/secrets/generators.mjs OAUTH_CLIENT_KEY | npx wrangler secret put OAUTH_CLIENT_KEY --name <Worker 名>
import { randomBytes, webcrypto } from "node:crypto"
import { pathToFileURL } from "node:url"

/**
 * OAuth のクライアント秘密鍵（`kid` を含む P-256 の JWK）を1行の JSON 文字列で生成する。
 * - `kid` は生成の日時から作る。鍵を入れ替えたときに、認可サーバーが新しい鍵を区別できるようにする。
 * - 出力は秘密鍵そのもの。ログやリポジトリに残さないこと。
 */
const generateOauthKey = async () => {
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

/** 自動生成するシークレットと、その生成関数 */
export const GENERATORS = {
  SCHEDULE_ENC_KEY: async () => randomBytes(32).toString("base64"),
  OAUTH_CLIENT_KEY: generateOauthKey,
  // アンケートの回答者の値を求める鍵（予約投稿の暗号鍵とは別のキーと値）
  SURVEY_HASH_KEY: async () => randomBytes(32).toString("base64"),
}

// 直接実行されたときだけ、指定した名前の値を標準出力へ出す（import されたときは出さない）
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const name = process.argv[2]
  const generate = Object.hasOwn(GENERATORS, name) ? GENERATORS[name] : null
  if (!generate) {
    console.error(
      `未知のシークレット名です（使える名前: ${Object.keys(GENERATORS).join(", ")}）`,
    )
    process.exit(1)
  }
  process.stdout.write(await generate())
}
