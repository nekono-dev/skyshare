/**
 * FormData の項目の種別の型。
 *
 * 責務と処理概要:
 * - FormData の各フィールドを、どう解釈してデコードするかの種別を定める。
 * - 型だけを持ち、値も import も持たない（`src/types` は葉）。
 * - 種別に従う関数は `util/formData.ts` にある。
 */

/**
 * FormData の1フィールドをどう解釈してデコードするかを示す種別。
 *
 * - `text`: 単一の文字列値
 * - `texts`: 同名フィールドを複数指定できる文字列値(繰り返しフィールド)
 * - `file`: 単一のファイル(Blob/File)
 * - `files`: 繰り返しフィールドとしてのファイル配列
 * - `json`: JSON文字列としてエンコードされた値(パースして復元する)。値がオブジェクトや
 *   配列であっても、内容(Blobの有無等)に関わらず常にこの1フィールドに閉じたJSON文字列
 *   として運ばれる（`imagesMeta`・`facets`・`gate`等）。
 * - `{ kind: "items", itemFieldKinds }`: 複数件のプレーンオブジェクト配列を、
 *   `${field}[${index}][${subField}]`というインデックス付きフィールド名から復元する
 *   （例: スレッドの`posts`）。内容に関わらず常にこの形式で運ばれる（`json`との違いは、
 *   要素がBlob/Fileを含みうるため単一のJSON文字列にまとめられない点）。
 */
export type LeafFormDataFieldKind = "text" | "texts" | "file" | "files" | "json"

export type FormDataFieldKind =
    | LeafFormDataFieldKind
    | { kind: "items"; itemFieldKinds: Record<string, FormDataFieldKind> }
