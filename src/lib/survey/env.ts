/**
 * ログイン時アンケート API が使う Worker バインディングを取得する。
 *
 * - `cloudflare:workers` は動的 import で取得する。
 */
import type { D1Database, SurveyResultsBucket } from "@/lib/platform/cfTypes"

/** アンケートの API が使うバインディング */
export type SurveyEnv = {
    DB: D1Database
    SURVEY_RESULTS?: SurveyResultsBucket
    ASSETS: { fetch(input: Request | string): Promise<Response> }
    /** 回答者の一方向の値を求める秘密の鍵。未設定のことがある */
    SURVEY_HASH_KEY?: string
}

/**
 * バインディングを取得する。
 *
 * Output: D1・ASSETS・鍵を持つ環境
 * 例: const { DB } = await getSurveyEnv()
 */
export const getSurveyEnv = async (): Promise<SurveyEnv> => {
    const { env } = await import("cloudflare:workers")
    return env as unknown as SurveyEnv
}
