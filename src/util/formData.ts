/**
 * FormData 補助の汎用ユーティリティ群。
 *
 * 責務と処理概要:
 * - FormData を、フィールドごとの種別(単一値/複数値/ファイル/JSON文字列/複数件のitems)を
 *   示すマップに従ってプレーンオブジェクトへデコードする。デコード後のプレーンオブジェクトを
 *   Zodスキーマで検証することで、「デコード」と「検証」を分離し、multipart/form-data
 *   でも JSON body と同じ形(`request.json()` → `Schema.safeParse(json)`)に揃え、
 *   検証スキーマとOpenAPIドキュメント生成スキーマを単一のものに統一できるようにする。
 * - 複数件（例: スレッドの各投稿）を1リクエストで送る場合の、インデックス付き
 *   フィールド名(`posts[0][text]`等)からのデコードにも対応する（`items`種別）。
 * - skyshare固有のドメイン知識を持たない、FormData/string標準の型のみを扱う処理。
 *   「どのフィールドがfile/json/items扱いか」というドメイン知識自体は呼び出し側
 *   (`src/lib/api/schema/**`)が持つ。
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
type LeafFormDataFieldKind = "text" | "texts" | "file" | "files" | "json"

export type FormDataFieldKind =
    | LeafFormDataFieldKind
    | { kind: "items"; itemFieldKinds: Record<string, FormDataFieldKind> }

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
 * - `formData`のキーを走査して出現するインデックスの最大値を求め、
 *   `0..maxIndex`の各インデックスについて`itemFieldKinds`と同じ種別判定ロジックで
 *   1件ずつオブジェクトを組み立てる。
 * - インデックスが飛んでいる場合（例: 0と2はあるが1が無い）、該当インデックスは
 *   空オブジェクトとして返す。専用のエラーハンドリングはせず、後続のZodバリデーションに
 *   自然に委ねる。
 * - skyshare固有のドメイン知識（`posts`という名前や、個々のフィールドの意味）は
 *   持たない汎用ユーティリティ。`formDataToObject`が`items`種別のフィールドに対して
 *   内部的に呼び出すほか、単体でも利用できるようエクスポートを維持する。
 *
 * Input:
 * - `formData`: デコード対象のFormData
 * - `arrayField`: 配列フィールド名（例: `"posts"`）
 * - `itemFieldKinds`: 1件分のフィールド名 → 種別 のマップ
 *
 * Output:
 * - プレーンオブジェクトの配列（該当フィールドが1つも無ければ空配列）
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
