/**
 * 動画アップロード用サービス認証トークンの取得（`POST /v2/bsky/video/upload-token`）。
 */
import { createBskyVideoUploadToken } from "@/client/openapi/client"
import { VideoUploadError } from "@/lib/video/videoErrors"

export type VideoUploadToken = {
    token: string
    did: string
    /** UNIX 秒 */
    expiresAt: number
}

/**
 * トークンを取得する。対応PDS以外（400）は `unsupportedPds`、それ以外の失敗は
 * `unknown`、通信失敗は `network` として `VideoUploadError` を投げる。
 * トークンはログに出力しない。
 */
export const fetchVideoUploadToken = async (): Promise<VideoUploadToken> => {
    let res
    try {
        res = await createBskyVideoUploadToken()
    } catch {
        throw new VideoUploadError("network")
    }
    if (res.status === 200) return res.data
    if (res.status === 400) throw new VideoUploadError("unsupportedPds")
    throw new VideoUploadError("unknown")
}
