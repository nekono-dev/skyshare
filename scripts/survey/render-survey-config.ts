#!/usr/bin/env node
/**
 * 変数 `SURVEY_CONFIG` の値から、配信用のアンケート設定（静的ファイル）を生成する。
 *
 * `SURVEY_CONFIG` を検証し、配信用のアンケート設定を生成する。
 * - 未設定・空白なら、既存の生成物を取り除いて正常終了する。
 * - 入力値やパーサー例外を出力せず、検証理由だけを標準エラーに出す。
 * - 使い方: `npm run survey:render`。実行時は環境変数を読み、第2引数で出力先を指定できる。
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { parseSurveyConfig } from "../../src/lib/survey/definition"

/** 設定として読めない値に対して出す固定の文言（入力の断片を含めない） */
export const UNREADABLE_MESSAGE =
    "SURVEY_CONFIG を JSON として読めませんでした（値は表示しません）"

/** ファイルの操作に失敗したときに出す固定の文言（OS の例外メッセージはパスを含むため使わない） */
export const IO_FAILED_MESSAGE =
    "生成物のファイルを操作できませんでした（書き込み権限や出力先を確認してください）"

/** 生成物の既定の出力先（配信 URL は /surveys/index.json） */
const DEFAULT_OUTPUT_PATH = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../public/surveys/index.json",
)

/**
 * 設定の元の文字列から配信用の設定を生成する。
 *
 * Input:
 * - `raw`: 設定の元の文字列（未設定は undefined）
 * - `outputPath`: 書き出し先のファイルパス
 *
 * Output:
 * - `written`: 検証を通した内容を書き出した
 * - `removed`: 未設定・空白で、既存の生成物を取り除いた
 * - `absent`: 未設定・空白で、取り除くものもなかった
 * - `failed`: 読めない値・検証の失敗。`issues` に「位置: 理由」を入れて返す（ファイルには触れない）
 *
 * 例:
 * - 入力: `(undefined, "/tmp/x/index.json")` → 出力: `{ status: "absent" }`
 */
export const renderSurveyConfig = (
    raw: string | undefined,
    outputPath: string,
): {
    status: "written" | "removed" | "absent" | "failed"
    issues?: string[]
} => {
    if (raw === undefined || raw.trim() === "") {
        try {
            if (!fs.existsSync(outputPath)) return { status: "absent" }
            fs.rmSync(outputPath, { force: true })
            return { status: "removed" }
        } catch {
            return { status: "failed", issues: [IO_FAILED_MESSAGE] }
        }
    }
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        // 例外メッセージは入力の断片を含むため使わない
        return { status: "failed", issues: [UNREADABLE_MESSAGE] }
    }
    const result = parseSurveyConfig(parsed)
    if (!result.ok) return { status: "failed", issues: result.issues }
    try {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true })
        fs.writeFileSync(
            outputPath,
            JSON.stringify(result.config, null, 2) + "\n",
            "utf8",
        )
    } catch {
        return { status: "failed", issues: [IO_FAILED_MESSAGE] }
    }
    return { status: "written" }
}

const __filename = fileURLToPath(import.meta.url)
if (process.argv[1] === __filename) {
    const { status, issues } = renderSurveyConfig(
        process.env.SURVEY_CONFIG,
        process.argv[2] ?? DEFAULT_OUTPUT_PATH,
    )
    if (status === "failed") {
        console.error("survey config: 生成に失敗しました")
        for (const issue of issues ?? []) console.error(`  ${issue}`)
        process.exit(1)
    }
    console.log(`survey config: ${status}`)
}
