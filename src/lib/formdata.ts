/**
 * FormData からファイル相当エントリを抽出するユーティリティ。
 *
 * 責務と処理概要:
 * - 指定キーを優先して `arrayBuffer()` を持つ値を探索する。
 * - 見つからない場合は FormData 全体を走査し、最初に見つかったファイル相当値を返す。
 * - 呼び出し側が扱いやすいように `Uint8Array` と MIME 情報へ正規化する。
 */
export type FormDataFileResult = {
    buffer: Uint8Array
    mime: string
    filename?: string
    file?: Blob
}

/**
 * FormData からファイル相当の値を抽出して正規化する。
 *
 * 想定する入力形状(最小要件):
 * - `formData` は `FormData` インスタンス
 * - ファイル相当値は `arrayBuffer()` を持つオブジェクト（`File`/`Blob` 想定）
 *
 * 処理の趣旨:
 * - まず `preferredName` の値を優先利用し、未該当時のみ全値走査へフォールバックする。
 * - 外部入力は不定形のため、`arrayBuffer` の存在確認で最小要件を満たすか判定する。
 *
 * Input:
 * - `formData`: multipart/form-data の値集合
 * - `preferredName`: 優先探索するフィールド名（既定: `image`）
 *
 * Output:
 * - 成功時: `buffer`/`mime`/`filename`/`file` を含むオブジェクト
 * - 失敗時: `undefined`
 *
 * 例:
 * - 入力: `formData` に `image: File("a.jpg")` が含まれる
 * - 出力: `{ buffer: Uint8Array(...), mime: "image/jpeg", filename: "a.jpg", file: Blob }`
 */
export const getFormDataFile = async (
    formData: FormData,
    preferredName: string = "image",
): Promise<FormDataFileResult | undefined> => {
    let fileEntry: any = null

    const v = formData.get(preferredName)
    if (v && typeof (v as any).arrayBuffer === "function") {
        fileEntry = v
    }

    if (!fileEntry) {
        // preferredName が無いケースを許容し、最初に見つかるファイル相当値へフォールバックする。
        for (const entry of formData.values()) {
            if (entry && typeof (entry as any).arrayBuffer === "function") {
                fileEntry = entry
                break
            }
        }
    }

    if (!fileEntry) return

    const ab = await (fileEntry as any).arrayBuffer()
    const mime = (fileEntry as any).type || "application/octet-stream"
    const filename = (fileEntry as any).name

    return {
        buffer: new Uint8Array(ab),
        mime,
        filename,
        file: fileEntry as Blob,
    }
}

export default getFormDataFile
