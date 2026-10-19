/**
 * 予約に添付する画像の一時保管（R2）。
 *
 * 責務と処理概要:
 * - 予約ごとに画像を `schedules/{did}/{id}/{番号}` へ保管し、キーの配列を返す。
 * - 合計バイト数が上限を超えるときは、何も書き込まずに例外を投げる。
 * - 途中で書き込みに失敗したときは、書き込み済みの画像を削除してから例外を投げる。
 */
import type { R2Bucket } from "./cfTypes"
import { MAX_IMAGE_BYTES_PER_SCHEDULE } from "./types"

export const putImages = async (
    bucket: R2Bucket,
    did: string,
    id: string,
    images: { bytes: ArrayBuffer; mime: string }[],
): Promise<string[]> => {
    const total = images.reduce((sum, img) => sum + img.bytes.byteLength, 0)
    if (total > MAX_IMAGE_BYTES_PER_SCHEDULE) {
        throw new Error("画像の合計が上限を超えています")
    }
    const keys: string[] = []
    try {
        for (const [i, img] of images.entries()) {
            const key = `schedules/${did}/${id}/${i}`
            await bucket.put(key, img.bytes, {
                httpMetadata: { contentType: img.mime },
            })
            keys.push(key)
        }
    } catch (err) {
        await removeImages(bucket, keys).catch(() => {})
        throw err
    }
    return keys
}

export const removeImages = async (
    bucket: R2Bucket,
    keys: string[],
): Promise<void> => {
    if (keys.length === 0) return
    await bucket.delete(keys)
}
