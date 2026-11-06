// wrangler 設定（JSONC）から Worker の名前を読む。scripts/secrets/sync-github-variables.mjs と scripts/secrets/ensure-worker-secrets.mjs が使う。
//
// 責務: 正規表現ではなく構造で読む。`"name"` は d1_databases などの入れ子にも現れうるため、トップレベルの値だけを取る。

import { parseJsonc } from "./jsonc.mjs"

/**
 * wrangler 設定の文字列から、トップレベルの `name`（Worker の名前）を取り出す。
 *
 * Input: `source`（config/wrangler.template.jsonc・wrangler.jsonc の内容。コメントと末尾のカンマを許す）
 * Output: Worker の名前
 * 失敗: `name` が無い・空のとき Error
 *
 * 例:
 * - 入力: '{ "d1_databases": [{ "name": "x" }], "name": "skyshare" }' → 出力: "skyshare"
 */
export const workerNameFrom = source => {
  const name = parseJsonc(source).name
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error(
      "wrangler の設定に Worker の名前（トップレベルの name）がありません",
    )
  }
  return name
}
