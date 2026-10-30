/**
 * 配信用のアンケート設定がビルドに含まれるかの判定（純粋関数）。
 *
 * 責務と処理概要:
 * - 変数 `SURVEY_CONFIG` が空白でない、または生成物 `public/surveys/index.json` が存在するとき「ある」と判定する。
 * - 判定結果を、ビルド定数 `PUBLIC_SURVEY_CONFIG_PRESENT`（"true" / "false"）に変換する。
 *   画面とサーバーは、この旗が "true" のときだけ設定を取得する（`src/lib/survey/loadConfig.ts`）。
 * - `import.meta.env` と Node 固有の API に依存しない。`astro.config.mjs`（Node）から読み込める
 *   （ファイルの存在の確認自体は `astro.config.mjs` が行い、ここには真偽で渡す）。
 */

type Env = Record<string, string | boolean | undefined>

/**
 * 配信用の設定がビルドに含まれるかを判定する。
 *
 * Input:
 * - `env`: 環境変数（`SURVEY_CONFIG` を読む）
 * - `fileExists`: 生成物 `public/surveys/index.json` が存在するか
 *
 * Output:
 * - 含まれるなら true
 *
 * 例:
 * - 入力: `({ SURVEY_CONFIG: "{}" }, false)` → 出力: true
 * - 入力: `({ SURVEY_CONFIG: "  " }, false)` → 出力: false
 * - 入力: `({}, true)` → 出力: true
 */
export const isSurveyConfigPresentAtBuild = (
    env: Env,
    fileExists: boolean,
): boolean => {
    const value = env.SURVEY_CONFIG
    const hasValue = typeof value === "string" && value.trim() !== ""
    return hasValue || fileExists
}

/**
 * ビルド定数 `PUBLIC_SURVEY_CONFIG_PRESENT` の値（文字列）を決める。
 *
 * Input: `isSurveyConfigPresentAtBuild` と同じ
 * Output: "true" または "false"
 * 例: `({}, false)` → "false"
 */
export const surveyConfigPresentFlag = (
    env: Env,
    fileExists: boolean,
): "true" | "false" =>
    isSurveyConfigPresentAtBuild(env, fileExists) ? "true" : "false"
