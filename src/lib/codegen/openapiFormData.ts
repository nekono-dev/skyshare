/**
 * OpenAPI クライアント向けの multipart/form-data 変換ユーティリティ。
 *
 * 責務と処理概要:
 * - Orval が生成する request body を FormData に変換する。
 * - Blob 配列とプリミティブ配列は複数フィールドへ展開する。
 * - object および object 配列はサーバ側 zod-form-data の契約に合わせて JSON 文字列 1 件へ正規化する。
 *
 * 実装上の制約:
 * - Cloudflare Workers 互換のため、Node.js 固有 API は使用しない。
 */

type FormDataPrimitive = string | number | boolean

/**
 * 値が multipart にそのまま展開できるプリミティブかを判定する。
 *
 * Input:
 * - `value`: 判定対象値
 *
 * Output:
 * - `true`: string / number / boolean
 * - `false`: それ以外
 *
 * 例:
 * - 入力: `"ja"`
 * - 出力: `true`
 */
const isPrimitiveValue = (value: unknown): value is FormDataPrimitive => {
    return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    )
}

/**
 * 値が Blob かどうかを判定する。
 *
 * Input:
 * - `value`: 判定対象値
 *
 * Output:
 * - `true`: Blob
 * - `false`: Blob 以外
 *
 * 例:
 * - 入力: `new Blob(["a"])`
 * - 出力: `true`
 */
const isBlobValue = (value: unknown): value is Blob => {
    return value instanceof Blob
}

/**
 * OpenAPI request body を FormData へ変換する。
 *
 * 想定する入力形状:
 * - `body` は OpenAPI クライアントが生成する request body オブジェクト
 * - 値は primitive / Blob / 配列 / plain object のいずれか
 *
 * 処理の趣旨:
 * - Blob はそのまま append する。
 * - Blob 配列と primitive 配列は複数 append する。
 * - object と object 配列はサーバ側 schema に合わせて JSON.stringify した単一フィールドへ正規化する。
 *
 * Input:
 * - `body`: FormData 化する request body
 *
 * Output:
 * - `FormData`
 *
 * 例:
 * - 入力: `{ text: "hello", langs: ["ja"], imagesMeta: [{ width: 1, height: 1 }] }`
 * - 出力: `text=hello`, `langs=ja`, `imagesMeta=[{"width":1,"height":1}]`
 */
export const customFormData = <T extends Record<string, unknown>>(
    body: T,
): FormData => {
    const formData = new FormData()

    for (const [key, rawValue] of Object.entries(body)) {
        if (rawValue === undefined || rawValue === null) {
            continue
        }

        if (isBlobValue(rawValue)) {
            formData.append(key, rawValue)
            continue
        }

        if (Array.isArray(rawValue)) {
            if (rawValue.length === 0) {
                continue
            }

            if (rawValue.every(isBlobValue)) {
                rawValue.forEach(value => {
                    formData.append(key, value)
                })
                continue
            }

            if (rawValue.every(isPrimitiveValue)) {
                rawValue.forEach(value => {
                    formData.append(key, String(value))
                })
                continue
            }

            formData.append(key, JSON.stringify(rawValue))
            continue
        }

        if (isPrimitiveValue(rawValue)) {
            formData.append(key, String(rawValue))
            continue
        }

        formData.append(key, JSON.stringify(rawValue))
    }

    return formData
}

export default customFormData
