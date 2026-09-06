/**
 * 投稿フォームを常時表示するページ用のクライアントコンポーネント。
 *
 * 責務と処理概要:
 * - `GET /v2/bsky/session` でログイン状態とアバターURLを解決する。
 * - 未ログイン（401）の場合はログインページへリダイレクトする。
 * - PostForm をダイアログではなくページ内容として直接マウントする。
 */
import { useEffect, useState } from "react"
import PostForm from "@/components/post/PostForm"
import {
  getActiveAccountInfo,
  getSessionOnce,
} from "@/lib/account/activeAccountSession"
import { isGuestModeRequested } from "@/lib/guestMode"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * 投稿ページ本体を描画する。
 *
 * Output:
 * - アバター解決済みの投稿フォーム
 */
const PostPage = () => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  // ハッシュタグ履歴（hashtagHistorySettings.ts）をアカウント別に分けるための識別子。
  const [accountDid, setAccountDid] = useState<string | null>(null)
  // 未ログイン(401)かつURLに`?guest`が付与されている場合のみ、投稿を無効化した
  // ゲストモードへ切り替える（`@/lib/guestMode`参照）。ログイン済みユーザーには無関係。
  const [guestMode, setGuestMode] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadSession = async () => {
      try {
        const res = await getSessionOnce()

        if (res.status === 401) {
          if (isGuestModeRequested()) {
            if (!cancelled) {
              setGuestMode(true)
            }
            return
          }
          window.location.href = "/login/"
          return
        }

        if (res.status !== 200) return

        const { avatarUrl: activeAvatarUrl, did } = await getActiveAccountInfo()
        if (!cancelled) {
          setAvatarUrl(activeAvatarUrl)
          setAccountDid(did)
        }
      } catch (err) {
        console.error("PostPage: failed to load session", err)
      }
    }

    void loadSession()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      {guestMode && (
        <p
          className={`${ui["base-card"]} ${ui["base-padding"]} ${styles["guest-notice"]}`}
        >
          これはログイン不要のゲスト表示です。Blueskyへの投稿はスキップされますが、
          投稿ボタンを押すとポップアップ・共有シートやX・タイッツー・Mastodonへの
          投稿ボタンはお試しいただけます。
        </p>
      )}
      <PostForm
        variant="page"
        avatarUrl={avatarUrl}
        accountDid={accountDid}
        guestMode={guestMode}
      />
    </>
  )
}

export default PostPage
