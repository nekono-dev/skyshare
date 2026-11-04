/**
 * 予約の D1 の行の変換と変更件数（共通）。
 *
 * 責務と処理概要:
 * - D1 の行（snake_case）を ScheduleRow（camelCase）へ変換する（すべての節が使う）。
 * - 文の結果から変更件数を数える。
 */
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
