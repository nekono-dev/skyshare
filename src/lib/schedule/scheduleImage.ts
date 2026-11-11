/** 予約画像の取得可否を判定し、画像または失敗結果を返す。 */
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
