/**
 * atproto blob アップロードのユーティリティ。
 *
 * 責務と処理概要:
 * - 画像 Blob を atproto の PDS へアップロードし、投稿埋め込み用の blob 参照を返す。
 * - 実際に呼び出すメソッドは `uploadBlob` のみのため、`AtpAgent` 全体ではなく
 *   最小インターフェース型を引数に取る（テストでは軽量なフェイクを渡せる）。
 */

import type { AtpAgent } from "@atproto/api"

type BlobUploadAgent = Pick<AtpAgent, "uploadBlob">

/**
 * 画像 Blob を atproto にアップロードし、投稿埋め込み用 blob 参照を返す。
 *
 * 処理の趣旨:
 * - Blob を Uint8Array へ変換し、MIME タイプを付与して uploadBlob を呼び出す。
 * - 副作用: atproto 外部 API（uploadBlob）を呼び出してアップロードを実行。
 *
 * Input:
 * - `agent`: `uploadBlob` を持つ認証済み AtpAgent（または同等の最小インターフェース）
 * - `blob`: アップロード対象画像データ
 *
 * Output:
 * - atproto の投稿埋め込みで利用可能な blob 参照オブジェクト
 *
 * 失敗時の方針:
 * - uploadBlob が例外を発生させた場合、呼び出し元で catch して 500 を返す。
 *
 * 例:
 * - 入力: `uploadBlob(authenticatedAgent, imageBlobData)`
 * - 出力: `{ $type: 'blob', link: { ... }, mimeType: 'image/jpeg' }`
 */
export const uploadBlob = async (agent: BlobUploadAgent, blob: Blob) => {
    const mime = blob.type || "application/octet-stream"
    const buffer = new Uint8Array(await blob.arrayBuffer())
    const uploadRes = await agent.uploadBlob(buffer, {
        encoding: mime,
    })
    return uploadRes.data.blob
}
