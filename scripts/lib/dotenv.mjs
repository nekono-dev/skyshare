// .dev.vars（dotenv 形式）を読む。scripts/secrets/sync-github-variables.mjs が秘匿情報の登録元として使う。
//
// 責務: `KEY=value` の行だけを取り出す。`#` で始まる行（コメントアウトされた KEY を含む）と空行は無視し、
// 値の両端の引用符（' か "）は外す。値は画面に出さない前提で、呼び出し側が扱う。

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
