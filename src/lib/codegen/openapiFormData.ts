/**
 * OpenAPI クライアント向けの multipart/form-data 変換ユーティリティ。
 *
 * 責務と処理概要:
 * - Orval が生成する request body を FormData に変換する。
 * - Blob 配列とプリミティブ配列は複数フィールドへ展開する。
 * - `ITEMS_FIELD_NAMES`に列挙されたフィールド（`posts`）は、内容（Blobの有無）に
 *   関わらず常に`key[i][subKey]`というインデックス付きフィールド名へ展開する。
 *   それ以外の object および object 配列（`imagesMeta`/`facets`/`gate`等）は、
 *   内容に関わらず常にサーバ側 `formDataToObject`(`@/util/formData`)の
 *   "json" 種別の契約に合わせて JSON 文字列 1 件へ正規化する。
 *
 * 実装上の制約:
 * - Cloudflare Workers 互換のため、Node.js 固有 API は使用しない。
 */

/**
 * FormData化の際、内容(Blobの有無)に関わらず常にインデックス付きフィールド名
 * (`key[i][subKey]`)へ展開するフィールド名。
 *
 * サーバ側`FormDataFieldKind`の`{kind:"items"}`宣言（現状は
 * `src/lib/api/schema/v2/entry/post.ts`の`RequestBodyFieldKinds.posts`）と対になっている。
 * orvalの`formData`ミューテータはエンドポイント固有のスキーマを受け取れず
 * （生成コードからの呼び出しは常に`customFormData(body)`のみ）、この関数はどの
 * エンドポイントの呼び出しかを知らないため、対象フィールド名をここで明示する。
 * 新しいmultipartエンドポイントで同様の（Blobを含みうる配列）フィールドを追加する場合は
 * ここにも追記すること（`tests/lib/codegen/openapiFormData.test.ts`のクロスチェック
 * テストが、サーバ側宣言とのズレを検出する）。
 */
export const ITEMS_FIELD_NAMES = new Set(["posts"])

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
 * 値が「プレーンオブジェクト」（Blob でも配列でもない object）かどうかを判定する。
 *
 * Input:
 * - `value`: 判定対象値
 *
 * Output:
 * - `true`: プレーンオブジェクト
 * - `false`: それ以外（Blob・配列・primitive等）
 */
const isPlainObjectValue = (
    value: unknown,
): value is Record<string, unknown> => {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        !isBlobValue(value)
    )
}

/**
 * 1フィールド分の値を FormData へ追加する（トップレベル・入れ子共通のコアロジック）。
 *
 * 処理の趣旨:
 * - `ITEMS_FIELD_NAMES`に含まれるフィールド（値がプレーンオブジェクトの配列の場合）は、
 *   内容（Blobの有無）に関わらず常に各要素をさらに`key[i][subKey]`という名前へ
 *   1階層分展開する。サーバ側の`formDataIndexedArrayToObjects`（`@/util/formData`）が
 *   期待する命名規則と対になっている。`imagesMeta`/`facets`等、`ITEMS_FIELD_NAMES`に
 *   含まれない「プレーンオブジェクトの配列」フィールドは、`posts`の入れ子であっても
 *   常に配列全体をJSON.stringifyして1フィールドに積む（サーバ側`"json"`種別の契約と対）。
 * - `text`という名前のフィールドは、トップレベルでも入れ子内でも常に
 *   JSON.stringifyしてから積む（改行のmultipart正規化対策、サーバ側`"json"`種別と対）。
 *
 * Input:
 * - `formData`: 追加先
 * - `key`: フィールド名（入れ子の場合は`posts[0][text]`のような組み立て済みの名前）
 * - `value`: 追加する値
 * - `fieldName`: `key`の末尾に相当する素のフィールド名（`text`特別扱いの判定用。
 *   入れ子の場合は`key`と異なる）
 */
const appendFormDataValue = (
    formData: FormData,
    key: string,
    value: unknown,
    fieldName: string,
): void => {
    if (value === undefined || value === null) {
        return
    }

    if (fieldName === "text" && typeof value === "string") {
        formData.append(key, JSON.stringify(value))
        return
    }

    if (isBlobValue(value)) {
        formData.append(key, value)
        return
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return
        }

        if (value.every(item => isBlobValue(item))) {
            value.forEach(item => {
                formData.append(key, item)
            })
            return
        }

        if (value.every(item => isPrimitiveValue(item))) {
            value.forEach(item => {
                formData.append(key, String(item))
            })
            return
        }

        if (
            ITEMS_FIELD_NAMES.has(fieldName) &&
            value.every(item => isPlainObjectValue(item))
        ) {
            value.forEach((item, index) => {
                for (const [subKey, subValue] of Object.entries(item)) {
                    appendFormDataValue(
                        formData,
                        `${key}[${index}][${subKey}]`,
                        subValue,
                        subKey,
                    )
                }
            })
            return
        }

        formData.append(key, JSON.stringify(value))
        return
    }

    if (isPrimitiveValue(value)) {
        formData.append(key, String(value))
        return
    }

    formData.append(key, JSON.stringify(value))
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
 * - `posts`（`ITEMS_FIELD_NAMES`）は内容に関わらず常にインデックス付きフィールドへ展開し、
 *   それ以外の object と object 配列は内容に関わらず常に JSON.stringify した単一フィールドへ
 *   正規化する。
 * - `text` フィールドは常に JSON.stringify する（サーバ側 `RequestBodyFieldKinds` の
 *   `text: "json"` と対）。multipart/form-data の生文字列パートはブラウザ側で
 *   `\n` が `\r\n` へ正規化されてしまい、`detectFacetsForSubmission`
 *   （`src/lib/atproto/richtext.ts`）が `\n` 前提で計算した facets のバイトオフセットと
 *   実送信テキストがズレて Bluesky 投稿が破綻するため、JSON文字列として
 *   エスケープした状態で運ぶことで生の改行バイトを multipart パートに乗せない。
 *
 * Input:
 * - `body`: FormData 化する request body
 *
 * Output:
 * - `FormData`
 *
 * 例:
 * - 入力: `{ text: "hello", langs: ["ja"], imagesMeta: [{ width: 1, height: 1 }] }`
 * - 出力: `text="hello"`, `langs=ja`, `imagesMeta=[{"width":1,"height":1}]`
 */
export const customFormData = <T extends Record<string, unknown>>(
    body: T,
): FormData => {
    const formData = new FormData()

    for (const [key, rawValue] of Object.entries(body)) {
        appendFormDataValue(formData, key, rawValue, key)
    }

    return formData
}

export default customFormData
