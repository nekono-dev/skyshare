// ローカル実行（npm run dev）の前に、手作業が要らないよう .dev.vars を整えるスクリプト。
//
// 責務:
// - .dev.vars が無ければ .dev.vars.template から作る
// - 予約投稿のシークレット（SCHEDULE_ENC_KEY・OAUTH_CLIENT_KEY）が未設定なら、ランダムに生成して書き込む
// - 設定済みの値は決して上書きしない（鍵を替えると、保管済みの予約の認証情報が復号できなくなるため）
//
// 使い方: node hack/prepare-local-env.mjs
// 生成した値は .dev.vars（.gitignore 対象）にだけ書き、標準出力には出さない。
import { randomBytes } from "node:crypto"
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { generateOauthKey } from "./generate-oauth-key.mjs"

/** 自動生成するシークレットと、その生成関数 */
const GENERATORS = {
  SCHEDULE_ENC_KEY: async () => randomBytes(32).toString("base64"),
  OAUTH_CLIENT_KEY: generateOauthKey,
}

/**
 * .dev.vars の内容のうち、未設定のシークレットだけを生成した値で埋める。
 *
 * Input:
 * - `content`: .dev.vars の内容
 * - `generators`: キー名 → 値を返す非同期関数
 *
 * Output:
 * - `content`: 更新後の内容
 * - `filled`: 生成したキー名の配列
 *
 * 例:
 * - 入力: "#SCHEDULE_ENC_KEY=\n"（コメントアウト）→ 出力: 行末に "SCHEDULE_ENC_KEY='<値>'" を追記
 * - 入力: "SCHEDULE_ENC_KEY=abc\n" → 出力: 変更なし
 */
export const fillMissingSecrets = async (content, generators) => {
  let next = content
  const filled = []
  for (const [name, generate] of Object.entries(generators)) {
    const active = new RegExp(`^${name}=(.*)$`, "m").exec(next)
    const current = active?.[1].trim().replace(/^(['"])(.*)\1$/, "$2") ?? ""
    if (current !== "") continue
    const line = `${name}='${await generate()}'`
    next = active
      ? next.replace(active[0], () => line)
      : `${next.replace(/\n*$/, "\n")}${line}\n`
    filled.push(name)
  }
  return { content: next, filled }
}

const main = async () => {
  const root = process.cwd()
  const target = path.join(root, ".dev.vars")
  if (!existsSync(target)) {
    copyFileSync(path.join(root, ".dev.vars.template"), target)
    console.log(".dev.vars を .dev.vars.template から作成しました")
  }
  const { content, filled } = await fillMissingSecrets(
    readFileSync(target, "utf8"),
    GENERATORS,
  )
  if (filled.length > 0) {
    writeFileSync(target, content, { mode: 0o600 })
    console.log(`.dev.vars に生成した値を書き込みました: ${filled.join(", ")}`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main()
}
