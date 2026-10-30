/**
 * ログイン時アンケートの API が使う Worker のバインディング（D1・静的アセット・鍵）を取得する。
 *
 * 責務と処理概要:
 * - `cloudflare:workers` を動的に import して env を返す（静的 import にしない）。
 * - テストではこのモジュールを差し替えて、フェイクのバインディングを返す。
 * - `@atproto/*` に依存しない。
 */
import type { D1Database } from "@/lib/schedule/cfTypes"

/** アンケートの API が使うバインディング */
export type SurveyEnv = {
    DB: D1Database
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
