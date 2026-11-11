/** 予約投稿の Worker バインディング（D1・R2・暗号鍵）を取得する。 */
import type { ScheduleEnv } from "@/lib/platform/cfTypes"

export const getScheduleEnv = async (): Promise<ScheduleEnv> => {
    const { env } = await import("cloudflare:workers")
    return env as unknown as ScheduleEnv
}
