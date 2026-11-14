/**
 * アンケート機能の実行時有効状態を判定する。
 */
/**
 * D1 と結果バケットがそろっている場合だけアンケート機能を有効にする。
 *
 * Input: 実行環境のバインディング
 * Output: 両方のバインディングがあるとき true
 * 例: isSurveyFeatureEnabled({ DB, SURVEY_RESULTS }) → true
 */
export const isSurveyFeatureEnabled = (env: {
    DB?: unknown
    SURVEY_RESULTS?: unknown
}): boolean => Boolean(env.DB && env.SURVEY_RESULTS)
