/** 予約ストアが共有する D1 行の変換と変更件数の取得を行う。 */
import type { ScheduleRow, ScheduleStatus } from "@/lib/schedule/types"

export type DbRow = Record<string, unknown>

export const toScheduleRow = (r: DbRow): ScheduleRow => ({
    id: r.id as string,
    did: r.did as string,
    runAt: Number(r.run_at),
    status: r.status as ScheduleStatus,
    payload: r.payload as string,
    imageKeys: r.image_keys as string,
    progress: r.progress as string,
    attempts: Number(r.attempts),
    lastError: (r.last_error as string | null) ?? null,
    updatedAt: Number(r.updated_at),
    finishedAt: r.finished_at == null ? null : Number(r.finished_at),
})

export const changesOf = (result: { meta?: { changes?: number } }): number =>
    result.meta?.changes ?? 0
