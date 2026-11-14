/**
 * 配信用アンケート設定と保管先の宣言を判定し、公開用の値に変換する。
 *
 * - 設定と D1・R2 の宣言が揃う場合だけ、ビルド定数を有効にする。
 * - `astro.config.mjs`（Node）から使うため、環境値・ファイル存在の判定結果・読み込み済みの Wrangler 設定を引数で受け取る。
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
 * 生成済みの設定にアンケートの保存先が宣言されているかを判定する。
 *
 * Input: `wrangler`: 生成済みの Wrangler 設定
 * Output: `DB` と `SURVEY_RESULTS` の両方が宣言されていれば true
 * 例: `{ d1_databases: [{ binding: "DB" }], r2_buckets: [{ binding: "SURVEY_RESULTS" }] }` → true
 */
export const declaresSurveyBindings = (wrangler: unknown): boolean => {
    if (typeof wrangler !== "object" || wrangler === null) return false
    const config = wrangler as Record<string, unknown>
    const hasBinding = (value: unknown, binding: string): boolean =>
        Array.isArray(value) &&
        value.some(
            entry =>
                typeof entry === "object" &&
                entry !== null &&
                "binding" in entry &&
                entry.binding === binding,
        )
    return (
        hasBinding(config.d1_databases, "DB") &&
        hasBinding(config.r2_buckets, "SURVEY_RESULTS")
    )
}

/**
 * ビルド定数 `PUBLIC_SURVEY_CONFIG_PRESENT` の値（文字列）を決める。
 *
 * Input: `isSurveyConfigPresentAtBuild` の 2 引数と、生成済みの Wrangler 設定
 * Output: 設定があり、かつ `DB` と `SURVEY_RESULTS` の宣言が揃うときだけ "true"。それ以外は "false"
 * 例: `({ SURVEY_CONFIG: "{}" }, false, { d1_databases: [{ binding: "DB" }], r2_buckets: [{ binding: "SURVEY_RESULTS" }] })` → "true"
 */
export const surveyConfigPresentFlag = (
    env: Env,
    fileExists: boolean,
    wrangler: unknown,
): "true" | "false" =>
    isSurveyConfigPresentAtBuild(env, fileExists) &&
    declaresSurveyBindings(wrangler)
        ? "true"
        : "false"
