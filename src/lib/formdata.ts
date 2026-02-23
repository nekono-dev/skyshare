/**
 * Utilities for extracting file-like entries from FormData
 * Returns the file as an ArrayBuffer along with basic metadata.
 */
export type FormDataFileResult = {
    buffer: Uint8Array
    mime: string
    filename?: string
    file?: Blob
}

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
