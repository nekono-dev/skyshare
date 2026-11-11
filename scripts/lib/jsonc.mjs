/**
 * `scripts/config/render-wrangler.mjs`・`scripts/lib/wrangler.mjs`・`hack/survey-cli/remote.ts` が使う、JSONC 文字列を JSON として解析する。
 *
 * - 文字列の中の `//` や `,` を壊さずに、コメントと末尾のカンマを取り除く。
 */

/** JSONC の文字列を、コメントと末尾のカンマを除いて JSON として読む */
export const parseJsonc = text => {
  let out = ""
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      out += ch
      if (ch === "\\") {
        out += text[++i] ?? ""
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      out += ch
    } else if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++
      out += "\n"
    } else if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2)
      i = end < 0 ? text.length : end + 1
    } else if (ch === ",") {
      // 直後が } や ] なら末尾のカンマなので捨てる
      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) j++
      if (text[j] !== "}" && text[j] !== "]") out += ch
    } else {
      out += ch
    }
  }
  return JSON.parse(out)
}
