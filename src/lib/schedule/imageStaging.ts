/**
 * 予約に添付する画像を R2 に一時保管し、実行時に読み出せるようにする。
 *
 * - 置き換えでは新世代の画像を保存してから置換前の画像を削除し、失敗時は途中まで保存した画像を消す。
 * - 容量上限を超える入力は書き込まずに失敗する。
 * - 読み出しは予約の所有アカウントのキーに限る。
 */
import type { R2Bucket } from "@/lib/platform/cfTypes"
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
