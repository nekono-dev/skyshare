/**
 * `scripts/secrets/sync-github-variables.mjs` と `scripts/secrets/prepare-local-env.mjs` が使う dotenv 形式の値を解析する。
 */

/**
 * dotenv の内容から、有効な `KEY=value` を取り出す。
 *
 * Input: `content`（ファイルの中身）
 * Output: `{ KEY: value }`。同じ KEY が複数あるときは最後のものを採る（wrangler の読み方と同じ）
 *
 * 例:
 * - 入力: "#A=old\nB='x'\n" → 出力: `{ B: "x" }`
 */
export const parseDotenv = content => {
  const result = {}
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    const pair = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
    if (!pair) continue
    result[pair[1]] = pair[2].trim().replace(/^(['"])(.*)\1$/, "$2")
  }
  return result
}
