/**
 * FormData の値をフィールド種別に従ってプレーンオブジェクトへデコードする。
 *
 * - JSON body と同じスキーマで検証できる形にし、デコードと検証を分離する。同じスキーマを検証と OpenAPI 生成に使える。
 * - JSON の解析失敗は生文字列として残し、後続のスキーマ検証に不正値を判定させる。
 */

import type { FormDataFieldKind, LeafFormDataFieldKind } from "@/types/formData"

/**
 * FormData の指定フィールド1件分の値を、種別に従ってデコードする（内部共通ロジック）。
 * `items`種別はフィールド単体の値ではなく複数キーにまたがる走査が必要なため、
 * ここでは扱わない（`formDataIndexedArrayToObjects`が担う）。
 */
const decodeFormDataField = (
    formData: FormData,
    fieldName: string,
    kind: LeafFormDataFieldKind,
): unknown => {
    const values = formData.getAll(fieldName)
    if (values.length === 0) {
        return undefined
    }
    if (kind === "text" || kind === "file") {
        return values[0]
    } else if (kind === "texts") {
        return values.filter(
            (value): value is string => typeof value === "string",
        )
    } else if (kind === "files") {
        return values.filter((value): value is File => value instanceof Blob)
    } else if (kind === "json") {
        const raw = values[0]
        if (typeof raw === "string") {
            try {
                return JSON.parse(raw)
            } catch {
                return raw
            }
        }
        return raw
    }
    return undefined
}

/**
 * `${arrayField}[${index}][${field}]`というインデックス付きフィールド名から、
 * 複数件のプレーンオブジェクト配列を復元する。
 *
 * 処理の趣旨:
 * - 出現する最大インデックスまで配列を作り、欠けた位置は空オブジェクトとして返す。
 * - 欠けた位置の検証は、後続の Zod スキーマに委ねる。
 *
 * Input:
 * - `formData`: デコード対象の FormData
 * - `arrayField`: 配列フィールド名（例: `"posts"`）
 * - `itemFieldKinds`: 1件分のフィールド名 → 種別 のマップ
 *
 * Output:
 * - プレーンオブジェクトの配列（該当フィールドがなければ空配列）
 *
 * 例:
 * - 入力: `formData`(`posts[0][text]=hello`, `posts[1][text]=world`),
 *   `"posts"`, `{ text: "json" }`
 * - 出力: `[{ text: "hello" }, { text: "world" }]`
 */
export const formDataIndexedArrayToObjects = (
    formData: FormData,
    arrayField: string,
    itemFieldKinds: Record<string, FormDataFieldKind>,
): Record<string, unknown>[] => {
    const escapedArrayField = arrayField.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const keyPattern = new RegExp(`^${escapedArrayField}\\[(\\d+)\\]\\[.+\\]$`)

    let maxIndex = -1
    for (const key of formData.keys()) {
        const match = keyPattern.exec(key)
        if (match) {
            maxIndex = Math.max(maxIndex, Number(match[1]))
        }
    }

    if (maxIndex < 0) {
        return []
    }

    const items: Record<string, unknown>[] = []
    for (let i = 0; i <= maxIndex; i++) {
        const item: Record<string, unknown> = {}
        for (const [field, kind] of Object.entries(itemFieldKinds)) {
            const decoded =
                typeof kind === "object"
                    ? formDataIndexedArrayToObjects(
                          formData,
                          `${arrayField}[${i}][${field}]`,
                          kind.itemFieldKinds,
                      )
                    : decodeFormDataField(
                          formData,
                          `${arrayField}[${i}][${field}]`,
                          kind,
                      )
            const isEmpty =
                decoded === undefined ||
                (Array.isArray(decoded) && decoded.length === 0)
            if (!isEmpty) {
                item[field] = decoded
            }
        }
        items.push(item)
    }
    return items
}

/**
 * FormData を、フィールド種別マップに従ってプレーンオブジェクトへデコードする。
 *
 * 処理の趣旨:
 * - multipart/form-data は本来すべての値が文字列またはBlobでしかないため、
 *   「このフィールドは配列か」「JSON文字列として復元すべきか」「複数件のitemsか」を
 *   フィールド単位で明示的に指定し、機械的にプレーンオブジェクトへ変換する。
 * - JSON文字列のパースに失敗した場合は、値をそのまま(文字列のまま)残す。
 *   後続のスキーマ検証が期待する型との不一致として自然に弾くため、ここでは
 *   例外を投げず黙って生の値を残す。
 * - `items`種別のフィールドは、`formDataIndexedArrayToObjects`へ委譲して
 *   インデックス付きフィールド名から複数件のプレーンオブジェクト配列を復元する。
 *
 * Input:
 * - `formData`: デコード対象のFormData
 * - `fieldKinds`: フィールド名 → 種別 のマップ
 *
 * Output:
 * - プレーンオブジェクト(値が存在しないフィールドはキー自体を含めない)
 *
 * 例:
 * - 入力: `formData`(`text=hello`, `imagesMeta=[{"width":1,"height":1}]`),
 *   `{ text: "text", imagesMeta: "json" }`
 * - 出力: `{ text: "hello", imagesMeta: [{ width: 1, height: 1 }] }`
 * - 入力: `formData`(`posts[0][text]=hello`), `{ posts: { kind: "items", itemFieldKinds: { text: "json" } } }`
 * - 出力: `{ posts: [{ text: "hello" }] }`
 */
export const formDataToObject = (
    formData: FormData,
    fieldKinds: Record<string, FormDataFieldKind>,
): Record<string, unknown> => {
    const result: Record<string, unknown> = {}
    for (const [field, kind] of Object.entries(fieldKinds)) {
        if (typeof kind === "object") {
            const items = formDataIndexedArrayToObjects(
                formData,
                field,
                kind.itemFieldKinds,
            )
            if (items.length > 0) {
                result[field] = items
            }
            continue
        }

        const decoded = decodeFormDataField(formData, field, kind)
        if (decoded !== undefined) {
            result[field] = decoded
        }
    }
    return result
}
