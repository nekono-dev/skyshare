/**
 * 投稿フォームと投稿先選択ダイアログを開くランチャー。
 * 小画面ではフォームの拡張が下方向に進むよう Overlay の上端を固定する。
 */
import { useT } from "@/components/i18n/useTranslation"
import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Overlay from "@/components/common/dialog/Overlay"
import IntentShareDialog, {
  type IntentShareRequest,
} from "@/components/share/IntentShareDialog"
import ThreadComposer, {
  type ThreadComposerHandle,
} from "@/components/composer/ThreadComposer"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"
import pic from "@/images/pen.svg"

/**
 * 投稿ランチャーを描画する。
 *
 * Input:
 * - `avatarUrl`: 投稿フォーム内に表示するアバター URL
 *
 * Output:
 * - ランチャーボタン + 開閉可能な投稿フォームモーダル
 *
 * 例:
 * - 入力: `{ avatarUrl: "https://..." }`
 * - 出力: クリックで ThreadComposer が開く UI
 */
const PostLauncher: React.FC<{
  avatarUrl?: string | null
  accountDid?: string | null
  onPosted?: () => void
  onPinnedFormDisabledChange?: (next: boolean) => void
  guestMode?: boolean
}> = ({
  avatarUrl,
  accountDid,
  onPosted,
  onPinnedFormDisabledChange,
  guestMode = false,
}) => {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  // 投稿成功でフォームが閉じても投稿先を選べるよう、ダイアログを Overlay の外に置く。
  const [shareRequest, setShareRequest] = useState<IntentShareRequest | null>(
    null,
  )
  const postFormRef = useRef<ThreadComposerHandle>(null)
  // Sidebar が用意する領域へ Portal で置き、フローティングボタンと同じ open 状態を共有する。
  const [sidebarActionEl, setSidebarActionEl] = useState<HTMLElement | null>(
    null,
  )
  useEffect(() => {
    setSidebarActionEl(document.getElementById("sidebar-action"))
  }, [])

  // 再マウント後すぐ入力できるよう本文へフォーカスし、背景クリックは未保存確認を通す。
  return (
    <>
      <button
        className={`${ui["base-button"]} ${ui["blue-button"]} ${ui["nontext-button"]} ${ui["lg-button"]} ${styles["launcher-delta"]}`}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        <img src={pic.src} width={24} height={24} />
      </button>

      {sidebarActionEl &&
        createPortal(
          <button
            className={`${ui["base-button"]} ${ui["blue-button"]} ${ui["text-button"]} ${styles["sidebar-action"]}`}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label={t("post.launcher.new")}
          >
            <img
              src={pic.src}
              width={20}
              height={20}
              className={styles["sidebar-action-icon"]}
            />
            <span className={styles["sidebar-action-label"]}>
              {t("post.launcher.new")}
            </span>
          </button>,
          sidebarActionEl,
        )}

      <Overlay
        open={open}
        onClose={() => postFormRef.current?.requestClose()}
        backdropClassName={styles["postform-backdrop"]}
      >
        <ThreadComposer
          ref={postFormRef}
          onClose={() => setOpen(false)}
          onShareRequest={setShareRequest}
          onPosted={() => {
            setOpen(false)
            onPosted?.()
          }}
          avatarUrl={avatarUrl}
          accountDid={accountDid}
          onPinnedFormDisabledChange={onPinnedFormDisabledChange}
          guestMode={guestMode}
          autoFocus
        />
      </Overlay>

      <IntentShareDialog
        request={shareRequest}
        keepOpenOnSelect
        onClose={() => setShareRequest(null)}
      />
    </>
  )
}

export default PostLauncher
