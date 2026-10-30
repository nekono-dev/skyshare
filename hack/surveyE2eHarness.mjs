// E2E の実行に検証用のアンケート設定を供給する処理のうち、純粋な部分。
//
// 責務:
// - 自分で dev サーバーを起動するときだけ、検証用の設定を生成する（`run-e2e.mjs` が使う）。
// - 検証用の設定を生成するときの環境変数を組み立てる。元の環境変数は書き換えない（復元に使うため）。
// - 配信用の設定が無いときに、確認を見送る理由を作る（tests/e2e/fixtures.ts が使う）。
//
// 生成そのものは `npm run survey:render`（hack/render-survey-config.ts）に任せる。
import { readFileSync } from "node:fs"
import { constants as osConstants } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/** 検証用の設定の場所（開催中・終了は遠い将来・3 種の質問を含む） */
export const E2E_SURVEY_CONFIG_PATH = path.join(
  ROOT,
  "tests/fixtures/survey/e2e-open.json",
)

/**
 * 検証用の設定を生成するかを決める。
 *
 * Input: `alreadyRunning` 開発サーバーが既に起動しているか
 * Output: 自分で起動する（起動の前に生成する）ときだけ true
 * 例: shouldProvideSurveyConfig(false) → true
 */
export const shouldProvideSurveyConfig = alreadyRunning => !alreadyRunning

/**
 * 検証用の設定を生成するときの環境変数を組み立てる。渡された環境変数は変えない。
 *
 * Input:
 * - `baseEnv`: 元の環境変数
 * - `rawConfig`: 検証用の設定の JSON 文字列
 * Output: `SURVEY_CONFIG` を検証用の設定に置き換えた新しい環境変数
 * 例: envWithE2eSurveyConfig({ A: "1" }, "{...}") → { A: "1", SURVEY_CONFIG: "{...}" }
 */
export const envWithE2eSurveyConfig = (baseEnv, rawConfig) => ({
  ...baseEnv,
  SURVEY_CONFIG: rawConfig,
})

/**
 * 検証用の設定の文字列を読む。
 *
 * Output: `tests/fixtures/survey/e2e-open.json` の内容
 */
export const readE2eSurveyConfig = () =>
  readFileSync(E2E_SURVEY_CONFIG_PATH, "utf8")

/**
 * 配信用の設定が取得できないときの、確認を見送る理由。
 *
 * Input: `available` 配信用の設定（`/surveys/index.json`）が取得できたか
 * Output: 取得できれば undefined。できなければ、生成の手順を示す理由の文言
 * 例: surveyConfigSkipReason(false) → "...npm run survey:render..."
 */
export const surveyConfigSkipReason = available =>
  available
    ? undefined
    : "配信用のアンケート設定（/surveys/index.json）がありません。npm run test:e2e で起動するか、先に npm run survey:render を実行してください"

/**
 * runner の終了コードを決める。
 *
 * Input: `{ status, interruptedBy, cleanupFailed }`
 * - `status`: 子（Playwright）の終了コード。シグナルで終わったときは null
 * - `interruptedBy`: 受けた中断のシグナル名（無ければ undefined）
 * - `cleanupFailed`: 後始末（dev サーバーの停止・元の設定への復元）に失敗したか
 * Output: 中断なら 128 + シグナル番号。後始末に失敗したら 1。通常は子の終了コード（終了コードが無ければ 1）
 * 例: exitCodeFor({ status: null, interruptedBy: "SIGINT" }) → 130
 * @param {{ status?: number | null, interruptedBy?: string, cleanupFailed?: boolean }} [input]
 * @returns {number}
 */
export const exitCodeFor = ({
  status = null,
  interruptedBy,
  cleanupFailed = false,
} = {}) => {
  if (interruptedBy) return 128 + osConstants.signals[interruptedBy]
  if (cleanupFailed) return 1
  if (status === 0) return 0
  return status || 1
}
