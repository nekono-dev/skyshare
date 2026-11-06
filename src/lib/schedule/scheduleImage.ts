/**
 * 予約の画像の取得（GET /v2/schedules/{id}/images/{index}）の判断。
 *
 * 責務と処理概要:
 * - 予約の行の所有・状態・画像の番号を判定し、画像か失敗の結果を `Outcome` で返す。
 * - 他のアカウントの予約・存在しない予約・待機中でも失敗でもない予約・範囲外の番号は 404、実行中の予約は 409。
 * - バインディングは関数の中で取得する。想定外の例外は捕まえず、呼び出し側へ投げる。
 *
 * 実装上の制約:
 * - `lib/api` を import しない（HTTP の形は持たない）。
 */
import type { Outcome } from "@/types/outcome"
import { getScheduleEnv } from "@/lib/schedule/env"
import { getImage } from "@/lib/schedule/imageStaging"
import { getSchedule, parseKeys } from "@/lib/schedule/store"

/**
 * 予約の画像を番号で取得する。
 *
 * Input:
 * - `did`: 要求したアカウント（予約の所有者）
 * - `id`: 予約の識別子
 * - `index`: 画像の番号
 *
 * Output: 成功は画像のバイト列と MIME。失敗は 404（予約なし・状態が対象外・画像なし）または 409（実行中）
 *
 * Example: `await getScheduleImage({ did, id: "s1", index: 0 })` → `{ ok: true, value: { bytes, mime } }`
 */
export const getScheduleImage = async (input: {
    did: string
    id: string
    index: number
}): Promise<Outcome<{ bytes: ArrayBuffer; mime: string }>> => {
    const env = await getScheduleEnv()
    const row = await getSchedule(env.DB, input.did, input.id)
    if (!row) return { ok: false, status: 404 }
    if (row.status === "running") {
        return { ok: false, status: 409, code: "ScheduleRunning" }
    }
    if (row.status !== "pending" && row.status !== "failed") {
        return { ok: false, status: 404 }
    }

    const image = await getImage(
        env.SCHEDULE_IMAGES,
        input.did,
        parseKeys(row.imageKeys),
        input.index,
    )
    if (!image) return { ok: false, status: 404 }
    return { ok: true, value: { bytes: image.bytes, mime: image.mime } }
}
