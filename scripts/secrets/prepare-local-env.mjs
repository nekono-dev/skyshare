// ローカル実行（npm run dev）の前に、手作業が要らないよう .dev.vars を整えるスクリプト。
//
// 責務:
// - config/develop.json が無ければ config/develop.example.json から作り、wrangler.jsonc を生成する（非秘密の設定は config/ に置く）
// - .dev.vars が無ければ config/.dev.vars.template から作る（秘密情報だけを置く）
// - 予約投稿・OAuth・アンケートのシークレット（SCHEDULE_ENC_KEY・OAUTH_CLIENT_KEY・SURVEY_HASH_KEY）が未設定なら、ランダムに生成して書き込む
// - 設定済みの値は決して上書きしない（鍵を替えると、保管済みの予約の認証情報が復号できなくなり、アンケートの回答済みの記録とも一致しなくなるため）
//
// 使い方: node scripts/secrets/prepare-local-env.mjs
// 生成した値は .dev.vars（.gitignore 対象）にだけ書き、標準出力には出さない。
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { parseDotenv } from "../lib/dotenv.mjs"
import { RenderError, renderWranglerFile } from "../config/render-wrangler.mjs"
import { GENERATORS } from "./generators.mjs"

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
    // 値の判定は dotenv の解析に任せる（コメントアウトされた行は読まない）。書き換える行は名前で探す
    if ((parseDotenv(next)[name] ?? "") !== "") continue
    const active = new RegExp(`^${name}=.*$`, "m").exec(next)
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
  const config = path.join(root, "config", "develop.json")
  if (!existsSync(config)) {
    copyFileSync(path.join(root, "config", "develop.example.json"), config)
    console.log(
      "config/develop.json を config/develop.example.json から作成しました（運用者の値を編集してください）",
    )
  }
  // wrangler.jsonc は生成物。開発の設定から毎回作り直す（同じプロセスで生成する）
  try {
    renderWranglerFile({ name: "develop" })
  } catch (err) {
    if (!(err instanceof RenderError)) throw err
    console.error(err.message)
    process.exit(1)
  }
  console.log("wrangler.jsonc を config/develop.json から生成しました")
  const target = path.join(root, ".dev.vars")
  if (!existsSync(target)) {
    copyFileSync(path.join(root, "config", ".dev.vars.template"), target)
    console.log(".dev.vars を config/.dev.vars.template から作成しました")
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
