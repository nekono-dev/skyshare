/**
 * ビルド後のログインリンクとアンケート結果ページの整合を検査する。
 *
 * - 出力先から HTML を読み、内容は表示しない。
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)))

export const findLinkMismatch = ({ loginHtml, surveysPageExists }) => {
  const hasSurveyLink = loginHtml.includes('href="/surveys/"')

  if (hasSurveyLink && !surveysPageExists) return "link-without-page"
  if (!hasSurveyLink && surveysPageExists) return "page-without-link"
  return undefined
}

const run = () => {
  const loginPath = resolve(ROOT, "dist/client/login/index.html")
  const surveysPath = resolve(ROOT, "dist/client/surveys/index.html")
  const loginHtml = readFileSync(loginPath, "utf8")
  const mismatch = findLinkMismatch({
    loginHtml,
    surveysPageExists: existsSync(surveysPath),
  })

  if (mismatch) {
    process.stderr.write(`Survey results link mismatch: ${mismatch}\n`)
    process.exitCode = 1
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run()
}
