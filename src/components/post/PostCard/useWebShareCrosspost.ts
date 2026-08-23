/**
 * PostCard 1件分の WebShareAPI クロスポスト実行を担うフック。
 *
 * 責務と処理概要:
 * - WebShareAPI の対応可否を、SSR/hydrationの不整合を避けつつクライアント側で判定する。
 * - skyshare entry の有無に応じて共有データを組み立て、WebShareAPI を実行する。
 *   - entry あり: 本文 + entry URL を text として共有（画像は添付しない）。
 *   - entry なし・画像あり: 元投稿の画像を取り込み files として共有（URLは含めない）。
 *   - entry なし・画像なし: Bluesky投稿本文と同じ内容を text として共有する。
 * - entry の作成・削除状態そのものは `useSkyshareEntryStatus` の責務であり、ここでは扱わない。
 */
import { useEffect, useRef, useState } from "react"
import { getBskyImage } from "@/client/openapi/client"
import {
    buildWebShareText,
    canShareWithWebApi,
    shareWithWebApi,
    toShareFile,
} from "@/util/share/webShare"
import type { TimelinePost } from "@/lib/entry/posts"

export type UseWebShareCrosspostResult = {
    isSupported: boolean
    isSharing: boolean
    shareError: string | null
    shareViaWebApi: () => void
}

/**
 * 1件の投稿に対する WebShareAPI クロスポストの実行状態を管理する。
 *
 * Input:
 * - `item`: 対象投稿（本文・画像・URIの取得元）
 * - `entryUrl`: 発行済み skyshare entry の URL（未発行時は `null`）
 *
 * Output:
 * - `isSupported`: WebShareAPI 対応環境なら `true`（マウント後に判定するため初期値は `false`）
 * - `isSharing`: 共有処理の実行中フラグ
 * - `shareError`: 直近の共有失敗メッセージ
 * - `shareViaWebApi`: 共有ボタンの onClick から呼び出す実行関数
 */
export const useWebShareCrosspost = (
    item: TimelinePost,
    entryUrl: string | null,
): UseWebShareCrosspostResult => {
    const [isSupported, setIsSupported] = useState(false)
    const [isSharing, setIsSharing] = useState(false)
    const [shareError, setShareError] = useState<string | null>(null)
    // 連打時、state 更新の再レンダーが反映される前に多重リクエストが走るのを防ぐため、
    // 同期的に確定する ref で即座にガードする（useSkyshareEntryStatus と同じ方針）。
    const isSharingRef = useRef(false)

    // navigator.share の対応可否はサーバー環境では判定できないため、
    // SSR時点では非表示（false）のまま描画し、マウント後にクライアントで判定し直す。
    useEffect(() => {
        setIsSupported(canShareWithWebApi())
    }, [])

    /**
     * skyshare entry の有無に応じた WebShareAPI 共有を実行する。
     *
     * 処理の趣旨:
     * - entry URLがある場合は本文とURLのみのテキスト共有とし、無い場合のみ
     *   `GET /v2/bsky/images`（cdn.bsky.appのCORS制約を回避する同一オリジンAPI）
     *   経由で元投稿の画像を取得し、ファイル添付として共有する。
     *
     * Output:
     * - なし（成功時は共有シートが開く。失敗時は `shareError` にメッセージを設定する）
     */
    const shareViaWebApi = () => {
        if (isSharingRef.current) {
            return
        }

        isSharingRef.current = true
        setIsSharing(true)
        setShareError(null)

        void (async () => {
            try {
                const shareData: ShareData = entryUrl
                    ? { text: buildWebShareText(item.text, entryUrl) }
                    : item.images.length > 0
                      ? {
                            text: item.text,
                            files: await Promise.all(
                                item.images.map(async (image, index) => {
                                    const res = await getBskyImage({
                                        cid: image.cid,
                                    })
                                    if (
                                        res.status !== 200 ||
                                        !(res.data instanceof Blob)
                                    ) {
                                        throw new Error(
                                            "元画像の取得に失敗しました。",
                                        )
                                    }
                                    return toShareFile(res.data, index)
                                }),
                            ),
                        }
                      : { text: item.text }

                if (!canShareWithWebApi(shareData)) {
                    setShareError(
                        "お使いのブラウザはこの内容の共有に対応していません。",
                    )
                    return
                }

                const result = await shareWithWebApi(shareData)
                if (!result.ok && result.reason !== "aborted") {
                    setShareError("WebShareAPIでの共有に失敗しました。")
                }
            } catch (err) {
                console.error("PostCard: failed to share via WebShareAPI", err)
                setShareError("WebShareAPIでの共有に失敗しました。")
            } finally {
                setIsSharing(false)
                isSharingRef.current = false
            }
        })()
    }

    return {
        isSupported,
        isSharing,
        shareError,
        shareViaWebApi,
    }
}
