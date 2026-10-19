/**
 * 予約投稿の型と上限値。
 *
 * 責務と処理概要:
 * - 予約の状態・行の形・実行の進捗の形を定義する。
 * - 保管と実行が共有する上限値を定義する。
 */

export const SCHEDULE_STATUSES = [
    "pending",
    "running",
    "posted",
    "failed",
] as const
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number]

/** 1回の取り出しで実行中にする予約の最大件数 */
export const CLAIM_LIMIT = 5
/** 1予約が保管する画像の合計バイト数の上限 */
export const MAX_IMAGE_BYTES_PER_SCHEDULE = 10 * 1000 * 1000

/** 保管する予約1件。`payload` `imageKeys` `progress` は JSON 文字列のまま持つ */
export type ScheduleRow = {
    id: string
    did: string
    runAt: number
    status: ScheduleStatus
    payload: string
    imageKeys: string
    progress: string
    attempts: number
    lastError: string | null
    resultUri: string | null
    updatedAt: number
    finishedAt: number | null
}

/** 新規に保存する予約。状態は常に待機で始まる */
export type NewSchedule = {
    id: string
    did: string
    runAt: number
    payload: string
    imageKeys: string[]
    now: number
}

/** 実行の進捗。中断後に続きから再開するために予約ごとに保持する */
export type Progress = {
    /** 投稿ごとに事前採番した TID */
    rkeys: string[]
    /** 画像の番号 -> アップロード済みの blob */
    blobs: Record<number, unknown>
    /** 作成済みの投稿 */
    created: { uri: string; cid: string }[]
    /** 投稿ごとの制限を作成し終えた投稿の件数 */
    gates: number
    entryDone: boolean
}

export const emptyProgress = (): Progress => ({
    rkeys: [],
    blobs: {},
    created: [],
    gates: 0,
    entryDone: false,
})
