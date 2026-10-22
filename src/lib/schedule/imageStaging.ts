/**
 * 予約に添付する画像の一時保管（R2）。
 *
 * 責務と処理概要:
 * - 予約ごとに画像を `schedules/{did}/{id}/{世代}/{番号}` へ保管し、キーの配列を返す。
 *   置き換えでは新しい画像を書いてから古い画像を消すため、世代で新旧のキーを分ける。
 * - 合計バイト数が上限を超えるときは、何も書き込まずに例外を投げる。
 * - 途中で書き込みに失敗したときは、書き込み済みの画像を削除してから例外を投げる。
 * - 保管した画像を、所有アカウントのキーに限って番号で読み出す。
 */
import type { R2Bucket } from "./cfTypes"
import { MAX_IMAGE_BYTES_PER_SCHEDULE } from "./types"

/**
 * 保管の世代を作る。保存のたびに異なる値になるよう、現在時刻の36進数を使う。
 *
 * Output: `"lx3k9a2b"` のような英数字の文字列
 */
export const newImageGeneration = (): string => Date.now().toString(36)

/**
 * 画像をまとめて保管し、番号順のキーを返す。
 *
 * Input:
 * - `bucket`: 画像のバケット
 * - `did` `id`: 予約の所有アカウントと識別子
 * - `generation`: 保管の世代（`newImageGeneration()` の値）
 * - `images`: 画像のバイト列と MIME の配列
 *
 * Output: R2 のキーの配列（`images` と同じ順）。上限超過・書き込み失敗は例外を投げる
 *
 * Example: `await putImages(r2, "did:plc:a", "s1", "g1", [{ bytes, mime: "image/png" }])`
 *   → `["schedules/did:plc:a/s1/g1/0"]`
 */
export const putImages = async (
    bucket: R2Bucket,
    did: string,
    id: string,
    generation: string,
    images: { bytes: ArrayBuffer; mime: string }[],
): Promise<string[]> => {
    const total = images.reduce((sum, img) => sum + img.bytes.byteLength, 0)
    if (total > MAX_IMAGE_BYTES_PER_SCHEDULE) {
        throw new Error("total image size exceeds the limit")
    }
    const keys: string[] = []
    try {
        for (const [i, img] of images.entries()) {
            const key = `schedules/${did}/${id}/${generation}/${i}`
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

/**
 * 画像を削除する。キーが空なら何もしない。
 *
 * Input: `bucket`、削除するキーの配列
 * Output: なし（R2 の失敗は例外として呼び出し側へ伝える）
 * Example: `await removeImages(r2, row.imageKeys)`
 */
export const removeImages = async (
    bucket: R2Bucket,
    keys: string[],
): Promise<void> => {
    if (keys.length === 0) return
    await bucket.delete(keys)
}

/**
 * 予約の画像を番号で読み出す。
 *
 * Input:
 * - `did`: 要求したアカウント。キーが `schedules/{did}/` で始まるときだけ読む
 * - `keys`: 予約の行の画像のキーの配列
 * - `index`: 画像の番号
 *
 * Output: バイト列と MIME。範囲外の番号・別アカウントのキー・存在しない画像は null
 *
 * Example: `await getImage(r2, did, ["schedules/did/s1/g1/0"], 0)` → `{ bytes, mime: "image/png" }`
 */
export const getImage = async (
    bucket: R2Bucket,
    did: string,
    keys: string[],
    index: number,
): Promise<{ bytes: ArrayBuffer; mime: string } | null> => {
    const key = Number.isInteger(index) ? keys[index] : undefined
    if (typeof key !== "string" || !key.startsWith(`schedules/${did}/`)) {
        return null
    }
    const object = await bucket.get(key)
    if (!object) return null
    return {
        bytes: await object.arrayBuffer(),
        mime: object.httpMetadata?.contentType || "application/octet-stream",
    }
}
