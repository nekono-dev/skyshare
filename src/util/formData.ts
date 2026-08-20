/**
 * FormData 補助の汎用ユーティリティ群。
 *
 * 責務と処理概要:
 * - FormData の特定フィールドが空文字列の場合に、未指定と同義として扱えるよう除去する。
 * - skyshare固有のドメイン知識を持たない、FormData/string標準の型のみを扱う処理。
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
