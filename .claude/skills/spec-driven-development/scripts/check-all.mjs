/**
 * 仕様書チェックの一括実行。
 *
 * 使い方: node check-all.mjs [--root specs] [--json] [--rules] [--no-syntax] [spec名...]
 * 終了コード: 0=指摘なし / 1=指摘あり・依存の未導入 / 2=引数エラー
 *
 * Mermaid の構文検証（G014）には scripts/ 配下への依存の導入が必要。
 *   npm ci --ignore-scripts --prefix <このディレクトリ>
 */
import * as structure from "./check-structure.mjs"
import * as format from "./check-format.mjs"
import * as diagram from "./check-diagram.mjs"
import * as wording from "./check-wording.mjs"
import * as architecture from "./check-architecture.mjs"
import * as poc from "./check-poc.mjs"
import { runCli } from "./lib.mjs"

process.exitCode = await runCli([
  structure,
  format,
  diagram,
  wording,
  architecture,
  poc,
])
