import imageCompression, { Options } from "browser-image-compression"

export const browserImageCompression = async (
    file: File,
    options: Options = {
        maxSizeMB: 0.925,
        maxWidthOrHeight: 3000,
        fileType: "image/jpeg",
        useWebWorker: true,
        initialQuality: 0.8,
    },
): Promise<File> => {
    try {
        const compressedFile = await imageCompression(file, options)
        return compressedFile
    } catch (err: unknown) {
        return Promise.reject(new Error(`compress failed: ${String(err)}`))
    }
}
export default browserImageCompression
