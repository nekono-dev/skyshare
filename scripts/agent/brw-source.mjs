/**
 * BRW の取得元（.branch-release-workflow-source.json）の読み取りと検査。
 * setup-brw.mjs（CI 用の clone）が使う。検査の規則は、ここに 1 つだけ置く。
 */
import { existsSync, readFileSync } from "node:fs"

const REPOSITORY_PATTERN = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/
const BRANCH_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/

/** 取得元の値を検査し、問題があれば理由の文字列を返す（無ければ null）。 */
export const sourceProblem = ({ repository, branch }) => {
  if (typeof repository !== "string" || !REPOSITORY_PATTERN.test(repository)) {
    return "repository: skillの取得元にはGitHubのHTTPS URLを指定してください"
  }
  if (typeof branch !== "string" || !BRANCH_PATTERN.test(branch)) {
    return "branch: skillの取得元にはブランチ名を指定してください"
  }
  return null
}

/** 取得元のファイルを読み、検査する。欠落・不正は、原因が分かる文言で例外にする。 */
export const readBrwSource = sourcePath => {
  if (!existsSync(sourcePath)) {
    throw new Error(
      `取得元のファイルがありません: ${sourcePath}（リポジトリに追跡されているか確認してください）`,
    )
  }
  let source
  try {
    source = JSON.parse(readFileSync(sourcePath, "utf8"))
  } catch {
    throw new Error(`取得元のJSON形式が不正です（${sourcePath}）`)
  }
  const problem = sourceProblem(source)
  if (problem) throw new Error(`${sourcePath}: ${problem}`)
  return { repository: source.repository, branch: source.branch }
}
