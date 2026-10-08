/**
 * 仕様書チェックの一括実行。
 *
 * 使い方: node check-all.mjs [--root specs] [--json] [--rules] [spec名...]
 * 終了コード: 0=指摘なし / 1=指摘あり / 2=引数エラー
 */
import * as structure from "./check-structure.mjs"
import * as format from "./check-format.mjs"
import * as wording from "./check-wording.mjs"
import { runCli } from "./lib.mjs"

process.exitCode = runCli([structure, format, wording])
