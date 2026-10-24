import { useT } from "@/lib/i18n/react"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import { useState } from "react"
import Loading from "@/components/common/Loading"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * legacy pageDB 投稿の削除ボタン。
 *
 * 責務と処理概要:
 * - `/posts/{dbIndex}/{slug}` (legacy pageDB 投稿表示ページ)に配置し、
 *   `/v1/page` 経由で legacy v1 backend の削除 API を実行する。
 * - v2 の session cookie を持つ閲覧者にのみ表示される想定（表示可否は呼び出し元が制御する）。
 *   本人以外の投稿を対象にした場合は legacy backend 側の本人確認で拒否される。
 */

/**
 * 削除の失敗の応答から、表示する文言のキーを決める。
 *
 * 想定する入力形状(最小要件):
 * - 403 の本文 `{ error: "OAuthSessionUnsupported" }`（OAuth のセッションでは旧バックエンドへ送れない）
 *
 * Output: OAuth のセッションでの拒否ならアプリパスワードでのログインを求める文言、それ以外は削除失敗の文言
 *
 * 例: 403 `{ error: "OAuthSessionUnsupported" }` → `"entry.legacy.oauthUnsupported"`
 */
export const deleteFailureKey = async (res: Response): Promise<PlainMessageKey> => {
  if (res.status !== 403) return "entry.legacy.deleteFailed"
  try {
    const body = (await res.json()) as { error?: unknown }
    return body.error === "OAuthSessionUnsupported"
      ? "entry.legacy.oauthUnsupported"
      : "entry.legacy.deleteFailed"
  } catch {
    return "entry.legacy.deleteFailed"
  }
}

type Props = {
  dbIndex: string
  dbKey: string
}

/**
 * 削除ボタンと処理中スピナーを描画する。
 *
 * Input:
 * - `dbIndex`: pageDB のシャード番号、または `"legacy"`
 * - `dbKey`: `${did}@${rkey}` 形式の投稿識別子
 *
 * Output:
 * - ボタン UI（削除成功後はページを再読み込みする）
 */
const Component = ({ dbIndex, dbKey }: Props) => {
  const { t } = useT()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<PlainMessageKey | null>(null)

  const handleDelete = async () => {
    if (isDeleting) return
    if (!window.confirm(t("entry.legacy.confirm"))) return

    setIsDeleting(true)
    setError(null)

    try {
      const res = await fetch("/v1/page/", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbIndex, dbKey }),
      })

      if (res.status !== 200) {
        setError(await deleteFailureKey(res))
        setIsDeleting(false)
        return
      }

      window.location.reload()
    } catch (err) {
      console.error("LegacyPageDeleteButton: failed to delete post", err)
      setError("entry.legacy.deleteFailed")
      setIsDeleting(false)
    }
  }

  return (
    <div className={styles.container}>
      <button
        type="button"
        className={`${ui["base-button"]} ${ui["text-button"]} ${ui["red-button"]}`}
        disabled={isDeleting}
        onClick={() => {
          void handleDelete()
        }}
      >
        {t("post.entryActions.deletePost")}
      </button>

      {error ? <span className={styles.error}>{t(error)}</span> : null}

      {isDeleting ? <Loading overlay message={t("common.deleting")} /> : null}
    </div>
  )
}

export default Component
