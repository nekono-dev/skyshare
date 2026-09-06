/**
 * FormData 補助の汎用ユーティリティ群。
 *
 * 責務と処理概要:
 * - FormData の特定フィールドが空文字列の場合に、未指定と同義として扱えるよう除去する。
 * - FormData を、フィールドごとの種別(単一値/複数値/ファイル/JSON文字列)を示すマップに
 *   従ってプレーンオブジェクトへデコードする。デコード後のプレーンオブジェクトを
 *   Zodスキーマで検証することで、「デコード」と「検証」を分離し、multipart/form-data
 *   でも JSON body と同じ形(`request.json()` → `Schema.safeParse(json)`)に揃え、
 *   検証スキーマとOpenAPIドキュメント生成スキーマを単一のものに統一できるようにする。
 * - skyshare固有のドメイン知識を持たない、FormData/string標準の型のみを扱う処理。
 *   「どのフィールドがfile/json扱いか」というドメイン知識自体は呼び出し側
 *   (`src/lib/api/schema/**`)が持つ。
 */

/**
 * FormData の指定フィールドが空文字列であれば削除する。
 *
 * 処理の趣旨:
 * - multipart/form-data では空文字列のフィールドが送られてくることがあり、
 *   OpenAPI の anyOf/min(1) 等のバリデーションを空文字が意図せず壊さないよう、
 *   未指定と同義として扱えるようにする。
 *
 * Input:
 * - `formData`: 対象の FormData（同一インスタンスを破壊的更新）
 * - `fieldName`: 空文字判定・削除対象のフィールド名
 *
 * Output:
 * - 正規化後の FormData（`formData` と同一インスタンス）
 *
 * 例:
 * - 入力: `dropEmptyStringField(formData, "text")`（text="" が設定済み）
 * - 出力: text キーが除去された FormData
 */
export const dropEmptyStringField = (
    formData: FormData,
    fieldName: string,
): FormData => {
    const rawValue = formData.get(fieldName)
    if (typeof rawValue === "string" && rawValue.trim().length === 0) {
        formData.delete(fieldName)
    }
    return formData
}

/**
 * FormData の1フィールドをどう解釈してデコードするかを示す種別。
 *
 * - `text`: 単一の文字列値
 * - `texts`: 同名フィールドを複数指定できる文字列値(繰り返しフィールド)
 * - `file`: 単一のファイル(Blob/File)
 * - `files`: 繰り返しフィールドとしてのファイル配列
 * - `json`: JSON文字列としてエンコードされた値(パースして復元する)
 */
export type FormDataFieldKind = "text" | "texts" | "file" | "files" | "json"

/**
 * FormData を、フィールド種別マップに従ってプレーンオブジェクトへデコードする。
 *
 * 処理の趣旨:
 * - multipart/form-data は本来すべての値が文字列またはBlobでしかないため、
 *   「このフィールドは配列か」「JSON文字列として復元すべきか」をフィールド単位で
 *   明示的に指定し、機械的にプレーンオブジェクトへ変換する。
 * - JSON文字列のパースに失敗した場合は、値をそのまま(文字列のまま)残す。
 *   後続のスキーマ検証が期待する型との不一致として自然に弾くため、ここでは
 *   例外を投げず黙って生の値を残す。
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
 */
export const formDataToObject = (
    formData: FormData,
    fieldKinds: Record<string, FormDataFieldKind>,
): Record<string, unknown> => {
    const result: Record<string, unknown> = {}
    for (const [field, kind] of Object.entries(fieldKinds)) {
        const values = formData.getAll(field)
        if (values.length === 0) {
            continue
        }
        if (kind === "text" || kind === "file") {
            result[field] = values[0]
        } else if (kind === "texts") {
            result[field] = values.filter(
                (value): value is string => typeof value === "string",
            )
        } else if (kind === "files") {
            result[field] = values.filter(
                (value): value is File => value instanceof Blob,
            )
        } else if (kind === "json") {
            const raw = values[0]
            if (typeof raw === "string") {
                try {
                    result[field] = JSON.parse(raw)
                } catch {
                    result[field] = raw
                }
            } else {
                result[field] = raw
            }
        }
    }
    return result
}
