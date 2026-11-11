/**
 * 配信用アンケート設定がビルドに含まれるかを判定し、公開用の値に変換する。
 *
 * - 環境変数に値があるか、生成物 `public/surveys/index.json` が存在すれば設定ありとする。
 * - `astro.config.mjs`（Node）から使うため、環境値とファイル存在の判定結果を引数で受け取る。
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
