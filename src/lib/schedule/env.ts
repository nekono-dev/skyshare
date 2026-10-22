/**
 * 予約投稿が使う Worker のバインディング（D1・R2・暗号鍵）を取得する。
 *
 * テストではこのモジュールを差し替えて、フェイクのバインディングを返す。
 */
import type { ScheduleEnv } from "./cfTypes"

export const getScheduleEnv = async (): Promise<ScheduleEnv> => {
    const { env } = await import("cloudflare:workers")
    return env as unknown as ScheduleEnv
}
