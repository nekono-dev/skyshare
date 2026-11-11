/**
 * 投稿を Web Share API で共有するデータと実行状態を管理する。
 * Entry URL がある場合は本文と URL、ない場合は投稿本文と（あれば）画像ファイルを共有する。
 * リンクカード優先設定が有効なら Entry URL と重なる本文の URL を除く。
 * ゲスト表示では画像 URL を直接 fetch し、認証付き画像 API を使わない。
 */
import type { PlainMessageKey } from "@/lib/i18n/translate"
import { useEffect, useRef, useState } from "react"
import { getBskyImage } from "@/client/openapi/client"
import { buildWebShareText, toShareFile } from "@/lib/share/webShareData"
import {
    canShareWithWebApi,
    shareWithWebApi,
} from "@/components/share/IntentShareDialog/webShare"
import type { TimelinePost } from "@/lib/timeline/posts"
import { resolveShareBody } from "@/lib/share/shareBody"
import { readEffectiveLinkCardPriority } from "@/lib/settings/shareSettings"

export type UseWebShareCrosspostResult = {
    isSupported: boolean
    isSharing: boolean
    shareError: PlainMessageKey | null
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
    guestMode = false,
): UseWebShareCrosspostResult => {
    const [isSupported, setIsSupported] = useState(false)
    const [isSharing, setIsSharing] = useState(false)
    const [shareError, setShareError] = useState<PlainMessageKey | null>(null)
    // state の再レンダーより先に連続クリックが届いても、多重共有を始めないよう同期 ref でガードする。
    const isSharingRef = useRef(false)

    // navigator.share はサーバーにないため、SSR は非対応として描画し、マウント後に判定する。
    useEffect(() => {
        setIsSupported(canShareWithWebApi())
    }, [])

    /**
     * skyshare entry の有無に応じた WebShareAPI 共有を実行する。
     *
     * Entry URL があれば本文と URL を共有する。URL がなく画像がある場合は、
     * 同一オリジンの画像 API で取得して添付する（cdn.bsky.app は CORS で直接取得できない）。
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
                    ? {
                          text: buildWebShareText(
                              resolveShareBody({
                                  text: item.text,
                                  facets: item.facets ?? [],
                                  entryUrl,
                                  linkCardUrl: "",
                                  preferSkyshareLinkCard:
                                      readEffectiveLinkCardPriority(),
                              }).text,
                              entryUrl,
                          ),
                      }
                    : item.images.length > 0
                      ? {
                            text: item.text,
                            files: await Promise.all(
                                item.images.map(async (image, index) => {
                                    if (guestMode) {
                                        // デモ画像は data URI で認証不要のため、URL から直接 Blob にする。
                                        const blob = await fetch(
                                            image.url,
                                        ).then(r => r.blob())
                                        return toShareFile(blob, index)
                                    }
                                    const res = await getBskyImage({
                                        cid: image.cid,
                                    })
                                    if (
                                        res.status !== 200 ||
                                        !(res.data instanceof Blob)
                                    ) {
                                        throw new Error(
                                            "Failed to fetch the source image.",
                                        )
                                    }
                                    return toShareFile(res.data, index)
                                }),
                            ),
                        }
                      : { text: item.text }

                if (!canShareWithWebApi(shareData)) {
                    setShareError("post.webShare.unsupported")
                    return
                }

                const result = await shareWithWebApi(shareData)
                if (!result.ok && result.reason !== "aborted") {
                    setShareError("post.webShare.failed")
                }
            } catch (err) {
                console.error("PostCard: failed to share via WebShareAPI", err)
                setShareError("post.webShare.failed")
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
