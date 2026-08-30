/**
 * 投稿フォームを常時表示するページ用のクライアントコンポーネント。
 *
 * 責務と処理概要:
 * - `GET /v2/bsky/session` でログイン状態とアバターURLを解決する。
 * - 未ログイン（401）の場合はログインページへリダイレクトする。
 * - PostForm をダイアログではなくページ内容として直接マウントする。
 */
import { useEffect, useState } from "react"
import { getSession } from "@/client/openapi/client"
import PostForm from "@/components/post/PostForm"

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

  useEffect(() => {
    let cancelled = false

    const loadSession = async () => {
      try {
        const res = await getSession()

        if (res.status === 401) {
          window.location.href = "/login/"
          return
        }

        if (res.status !== 200) return

        const activeAccount = res.data.accounts.find(
          account => account.isActive,
        )
        if (!cancelled) {
          setAvatarUrl(activeAccount?.avatarUrl ?? null)
          setAccountDid(activeAccount?.did ?? null)
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
      <PostForm variant="page" avatarUrl={avatarUrl} accountDid={accountDid} />
    </>
  )
}

export default PostPage
