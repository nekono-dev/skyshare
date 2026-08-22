/**
 * 設定ページ本体コンポーネント。
 *
 * 責務と処理概要:
 * - 投稿フォーム関連のトグル設定を `SettingList` でグループごとに一覧表示する。
 * - 各設定値の state・永続化・連動ルールは `lib/settings/useShareToggles` および
 *   `lib/settings/shareSettings` に委譲し、本体は表示用データの組み立てに専念する。
 * - Astroページ（`src/pages/settings.astro`）からも `SettingsDialog` からも同じ内容を
 *   表示できるよう、ページ固有のレイアウト（Baselayout・Sidebar等）には依存しない。
 * - マウント時に加え、Astroのクライアント側ページ遷移イベント `astro:page-load`
 *   （`src/components/nav/syncActiveState.ts` と同じ仕組み）のたびにも localStorage
 *   から再読み込みする。View Transitions遷移でこのコンポーネントのDOM/Reactインスタンスが
 *   再マウントされずに使い回された場合でも、PostForm等の他画面で行った変更や
 *   localStorageの最新状態を、開かれるたびに確実に反映するため。
 */
import { useEffect, useRef, useState } from "react"
import SettingList, { type SettingListItem } from "@/components/SettingList"
import {
  readPinnedFormDisabledSetting,
  writePinnedFormDisabledSetting,
} from "@/lib/settings/shareSettings"
import { useShareToggles } from "@/lib/settings/useShareToggles"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * 設定ページを描画する。
 *
 * Output:
 * - 「投稿フォーム」「クロスポスト」の2グループに分けた設定一覧
 *
 * 例:
 * - 出力: 投稿フォーム設定3件・クロスポスト設定3件、計6件のトグル付き設定一覧
 */
export const Settings = () => {
  const shareToggles = useShareToggles()
  const [pinnedFormDisabled, setPinnedFormDisabled] = useState(() =>
    readPinnedFormDisabledSetting(false),
  )

  /**
   * 「投稿フォームを固定表示しない」設定を変更する。
   *
   * Input:
   * - `next`: 変更後の値
   */
  const onPinnedFormDisabledChange = (next: boolean) => {
    setPinnedFormDisabled(next)
    writePinnedFormDisabledSetting(next)
  }

  // reload実体は毎レンダーで作り直されるため ref 経由で最新版を参照し、
  // イベントリスナーの登録・解除自体は初回マウント時の一度だけに保つ
  // （Overlay.tsx の onCloseRef と同じパターン）。
  const reloadRef = useRef<() => void>(() => {})
  reloadRef.current = () => {
    shareToggles.reload()
    setPinnedFormDisabled(readPinnedFormDisabledSetting(false))
  }

  useEffect(() => {
    // マウント直後（Astro初回ロード分）にも一度反映する。
    reloadRef.current()

    const handlePageLoad = () => reloadRef.current()
    document.addEventListener("astro:page-load", handlePageLoad)
    return () => {
      document.removeEventListener("astro:page-load", handlePageLoad)
    }
  }, [])

  const postFormItems: SettingListItem[] = [
    {
      key: "pinnedFormDisabled",
      label: "投稿フォームを固定表示しない",
      description:
        "オンにすると、スクロールしても投稿フォームが画面上部に固定表示されなくなります。",
      checked: pinnedFormDisabled,
      onCheckedChange: onPinnedFormDisabledChange,
    },
    {
      key: "popupIntentInsteadOfWebshare",
      label: "共有をポップアップで開く",
      description:
        "オンにすると、投稿後の共有をWeb Share APIの代わりにポップアップウィンドウで行います。",
      checked: shareToggles.popupIntentInsteadOfWebshare,
      onCheckedChange: shareToggles.onPopupIntentInsteadOfWebshareChange,
    },
    {
      key: "manualImageAttach",
      label: "画像を自分で添付する",
      description:
        "オンにすると、SkyshareのURLを発行せず、画像を手動で添付する形式に切り替わります。",
      checked: shareToggles.manualImageAttach,
      onCheckedChange: shareToggles.onManualImageAttachChange,
    },
  ]

  const crosspostItems: SettingListItem[] = [
    {
      key: "crosspostToTaittsuu",
      label: "タイッツーにクロスポスト",
      description: "オンにすると、投稿と同時にタイッツーへも共有します。",
      checked: shareToggles.crosspostToTaittsuu,
      onCheckedChange: shareToggles.onCrosspostToTaittsuuChange,
    },
    {
      key: "showXWhenCrosspost",
      label: "X投稿ボタンを表示",
      description:
        "オンにすると、投稿後にXへ投稿するためのボタンを表示します。",
      checked: shareToggles.showXWhenCrosspost,
      onCheckedChange: shareToggles.onShowXWhenCrosspostChange,
    },
    {
      key: "noAutoPopupAfterPost",
      label: "投稿後の自動ポップアップをOFFにする",
      description:
        "オンにすると、投稿完了時に共有ポップアップが自動的に開かなくなります。",
      checked: shareToggles.noAutoPopupAfterPost,
      onCheckedChange: shareToggles.onNoAutoPopupAfterPostChange,
    },
  ]

  return (
    <div className={styles.groups}>
      <section className={`${ui["base-card"]} ${ui["base-padding"]}`}>
        <h2 className={ui.subject}>投稿フォーム</h2>
        <SettingList items={postFormItems} />
      </section>

      <section className={`${ui["base-card"]} ${ui["base-padding"]}`}>
        <h2 className={ui.subject}>クロスポスト</h2>
        <SettingList items={crosspostItems} />
      </section>
    </div>
  )
}

export default Settings
