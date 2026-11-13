/**
 * 結果の保管先がビルド時に読める設定かを判定し、ビルド定数の値に変換する。
 *
 * - `astro.config.mjs` から使うため、Node やブラウザの外部機能に依存しない。
 */

/**
 * 結果の保管先が実バケットへつながる設定かを判定する。
 *
 * Input: `wrangler`: 生成済みの Wrangler 設定
 * Output: `SURVEY_RESULTS` の `r2_buckets` の項目に `remote: true` があれば true
 * 例: `{ r2_buckets: [{ binding: "SURVEY_RESULTS", remote: true }] }` → true
 */
export const declaresReadableSurveyResults = (wrangler: unknown): boolean => {
    if (typeof wrangler !== "object" || wrangler === null) return false

    const buckets = (wrangler as Record<string, unknown>).r2_buckets
    if (!Array.isArray(buckets)) return false

    return buckets.some(
        entry =>
            typeof entry === "object" &&
            entry !== null &&
            "binding" in entry &&
            entry.binding === "SURVEY_RESULTS" &&
            "remote" in entry &&
            entry.remote === true,
    )
}

/**
 * ビルド定数 `PUBLIC_SURVEY_RESULTS_READABLE` の値（文字列）を決める。
 *
 * Input: `wrangler`: 生成済みの Wrangler 設定
 * Output: "true" または "false"
 * 例: 接続の宣言が無い設定 → "false"
 */
export const surveyResultsReadableFlag = (
    wrangler: unknown,
): "true" | "false" =>
    declaresReadableSurveyResults(wrangler) ? "true" : "false"
