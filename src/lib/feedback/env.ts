/**
 * 不具合の報告と機能の提案の受付が使う Worker のバインディング（認証情報・回数の制限）を取得する。
 *
 * テストではこのモジュールを差し替えて、フェイクのバインディングを返す。
 */

export type FeedbackEnv = {
    /** Issues の読み書きだけを許す GitHub の Fine-grained PAT（Worker のシークレット）。未設定なら受付を停止する */
    FEEDBACK_GITHUB_TOKEN?: string
    /** Cloudflare の Rate Limiting のバインディング（期間60秒・上限1件。`wrangler.template.jsonc` で宣言） */
    FEEDBACK_RATE_LIMITER: {
        limit(opts: { key: string }): Promise<{ success: boolean }>
    }
}

/**
 * Worker の実行時の環境から、受付が使う値を取り出す。
 *
 * Output:
 * - `FeedbackEnv`（`cloudflare:workers` の `env` をそのまま型付けしたもの）
 */
export const getFeedbackEnv = async (): Promise<FeedbackEnv> => {
    const { env } = await import("cloudflare:workers")
    return env as unknown as FeedbackEnv
}
