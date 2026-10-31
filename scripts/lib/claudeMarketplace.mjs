// Claude の marketplace 一覧（`claude plugin marketplace list` の出力）から、名前の登録の有無を判定する。
// scripts/agent/setup-brw.mjs が、同名の登録を外してから clone を登録し直す判断に使う。

/**
 * 一覧の出力に、指定の名前の marketplace があるかを判定する。
 *
 * Input: `listOutput`（一覧の標準出力の文字列）、`name`（marketplace の名前）
 * Output: 登録されていれば true
 *
 * 例: "  ❯ nekono-dev\n    Source: Folder (...)" → `isMarketplaceListed(out, "nekono-dev")` は true
 */
export const isMarketplaceListed = (listOutput, name) =>
  new RegExp(
    `^\\s*❯ ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
    "m",
  ).test(listOutput)
