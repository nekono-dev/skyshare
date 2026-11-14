/**
 * D1 のマイグレーションの運用規則。release 以外のブランチは、初期状態の 0001 だけを持つ。
 * develop と main は始めの状態から構築する。0002 以降は release/** だけに積む。
 */
import path from "node:path"

/** 初期状態の唯一のマイグレーション。 */
export const INITIAL_FILE = "0001_initial.sql"

/** 初期状態に保つ（release でも持ち込ませない）ベースブランチ。 */
const INITIAL_BASES = ["main", "develop"]

/** release/** のブランチか。 */
export const isReleaseBranch = branch => /^release\//.test(branch ?? "")

/**
 * 初期状態（0001 だけ）を求めるか。
 *
 * Input: ブランチ名と、PR のベースのブランチ名（無ければ未指定）
 * Output: release 以外、または main・develop 向けのとき true
 * 例: `{ branch: "release/v2", baseBranch: "main" }` → true
 */
export const isInitialOnlyRequired = ({ branch, baseBranch }) =>
  !isReleaseBranch(branch) || INITIAL_BASES.includes(baseBranch ?? "")

/**
 * ファイル名の一覧から、規則に反するものを返す。Wrangler は SQL をすべて適用するため、名前の形によらず見る。
 *
 * Input: マイグレーションの置き場の直下のファイル名
 * Output: 反するファイル名（空なら適合）。初期状態の SQL が無いときは、その旨を返す
 * 例: `["0001_initial.sql", "2_extra.sql"]` → `["2_extra.sql"]`
 */
export const findMigrationViolations = names => {
  const sql = names.filter(name => name.endsWith(".sql"))
  const others = sql.filter(name => name !== INITIAL_FILE)
  if (others.length > 0) return others
  if (!sql.includes(INITIAL_FILE)) return [`${INITIAL_FILE} が無い`]
  return []
}

/**
 * パスが、初期状態以外のマイグレーション（初期状態の SQL 以外の SQL）か。
 *
 * Input: ファイルのパス（絶対・相対のどちらでも）
 * Output: マイグレーションの置き場の直下の SQL で、初期状態の SQL 以外なら true
 */
export const isLaterMigrationPath = filePath => {
  const normalized = filePath.split(path.sep).join("/")
  const match = /(?:^|\/)migrations\/([^/]+\.sql)$/.exec(normalized)
  return match !== null && match[1] !== INITIAL_FILE
}

/** 反したときに利用者へ示す説明。 */
export const ruleMessage =
  "D1 のマイグレーションは、release/** 以外のブランチでは 0001_initial.sql だけ（ほかの SQL を置かない）にする（develop・main は始めの状態から構築する）。0002 以降は release/** にだけ積める。構造の変更は 0001 を直接編集し、develop の D1 は作り直す。"
