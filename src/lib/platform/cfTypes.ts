/**
 * 予約投稿が使う Cloudflare のバインディングの最小の型。
 *
 * 責務と処理概要:
 * - リポジトリには `wrangler types` の生成物（worker-configuration.d.ts）を置かないため、
 *   予約投稿が実際に呼ぶメソッドだけを構造的に定義する。
 * - テストでは同じ形のフェイクを渡せる。
 */

export type D1Statement = {
    bind: (...args: unknown[]) => D1Statement
    run: () => Promise<{ meta?: { changes?: number } }>
    first: <T = Record<string, unknown>>() => Promise<T | null>
    all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>
}

export type D1Database = {
    prepare: (sql: string) => D1Statement
    /** 複数の文を 1 回の呼び出しで原子的に実行する。どれかが失敗したら全体を取り消す */
    batch: (
        statements: D1Statement[],
    ) => Promise<{ meta?: { changes?: number } }[]>
}

export type R2Bucket = {
    put: (
        key: string,
        value: ArrayBuffer,
        options?: { httpMetadata?: { contentType?: string } },
    ) => Promise<unknown>
    get: (key: string) => Promise<{
        arrayBuffer: () => Promise<ArrayBuffer>
        httpMetadata?: { contentType?: string }
    } | null>
    delete: (keys: string | string[]) => Promise<void>
}

/** 予約投稿が使う Worker のバインディング */
export type ScheduleEnv = {
    DB: D1Database
    SCHEDULE_IMAGES: R2Bucket
    SCHEDULE_ENC_KEY: string
    /** OAuth のクライアントの秘密鍵（P-256 の JWK の JSON）。未設定なら予約投稿を有効にできない */
    OAUTH_CLIENT_KEY?: string
}
