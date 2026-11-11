/** ローカル開発設定と `.dev.vars` を準備し、不足するシークレットを補う。
 * 既存の鍵は保存済みデータの復号・照合に必要なため上書きせず、値は標準出力に出さない。
 * 秘密値は gitignore 対象の `.dev.vars` にだけ保存する。
 * 使い方: node scripts/secrets/prepare-local-env.mjs
 */
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
