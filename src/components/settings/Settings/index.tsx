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
import { getSession } from "@/client/openapi/client"
import InlineIcon from "@/components/common/InlineIcon"
import LocaleSelect from "@/components/common/LocaleSelect"
import ThemeModeSelect from "@/components/common/ThemeModeSelect"
import PostGateDialog from "@/components/post/PostGateDialog"
import SettingList, {
  type SettingListItem,
} from "@/components/settings/SettingList"
import type { PostGateValue } from "@/lib/atproto/gate"
import { useT } from "@/lib/i18n/react"
import { renderSlots } from "@/lib/i18n/rich"
import {
  readPostGateDefaultSetting,
  readSyncGateDefaultAfterPostSetting,
  writePostGateDefaultSetting,
  writeSyncGateDefaultAfterPostSetting,
} from "@/lib/settings/postGateSettings"
import {
  readPinnedFormDisabledSetting,
  writePinnedFormDisabledSetting,
} from "@/lib/settings/shareSettings"
import {
  readHashtagSuggestEnabledSetting,
  readMentionSuggestEnabledSetting,
  writeHashtagSuggestEnabledSetting,
  writeMentionSuggestEnabledSetting,
} from "@/lib/settings/suggestSettings"
import {
  applyThemeMode,
  readThemeModeSetting,
  type ThemeMode,
  writeThemeModeSetting,
} from "@/lib/settings/themeSettings"
import type { MessageKey } from "@/lib/i18n/translate"
import { useShareToggles } from "@/lib/settings/useShareToggles"
import { isValidMastodonInstanceDomain } from "@/util/share/intent"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * 設定ページを描画する。
 *
 * Output:
 * - 「投稿フォーム」「クロスポスト」の2グループに分けた設定一覧
 *
 * 例:
 * - 出力: 投稿フォーム設定3件・クロスポスト設定4件、計7件のトグル付き設定一覧
 */
export const Settings = () => {
  const { t, raw } = useT()
  const shareToggles = useShareToggles()
  const [pinnedFormDisabled, setPinnedFormDisabled] = useState(() =>
    readPinnedFormDisabledSetting(false),
  )
  const [themeMode, setThemeMode] = useState(() =>
    readThemeModeSetting("system"),
  )
  const [hashtagSuggestEnabled, setHashtagSuggestEnabled] = useState(() =>
    readHashtagSuggestEnabledSetting(true),
  )
  const [mentionSuggestEnabled, setMentionSuggestEnabled] = useState(() =>
    readMentionSuggestEnabledSetting(true),
  )
  const [defaultGate, setDefaultGate] = useState<PostGateValue>(() =>
    readPostGateDefaultSetting(),
  )
  const [syncGateDefaultAfterPost, setSyncGateDefaultAfterPost] = useState(() =>
    readSyncGateDefaultAfterPostSetting(false),
  )
  const [gateDialogOpen, setGateDialogOpen] = useState(false)
  // 「返信・引用のデフォルト設定」ダイアログの「リストから選択」がBlueskyリストを
  // 取得する際に必要なdid。Settingsページ自体はアカウント非依存のため保持しておらず、
  // Timeline（src/components/post/Timeline/index.tsx）と同じgetSessionパターンで
  // マウント時に解決する。未解決の間はnullのままとし、ダイアログ側でリスト取得を待たせる。
  const [accountDid, setAccountDid] = useState<string | null>(null)

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

  /**
   * 表示テーマ設定を変更する。
   *
   * Input:
   * - `next`: 変更後のテーマ設定
   */
  const onThemeModeChange = (next: ThemeMode) => {
    setThemeMode(next)
    writeThemeModeSetting(next)
    applyThemeMode(next)
  }

  /**
   * 「ハッシュタグ候補を表示」設定を変更する。
   *
   * Input:
   * - `next`: 変更後の値
   */
  const onHashtagSuggestEnabledChange = (next: boolean) => {
    setHashtagSuggestEnabled(next)
    writeHashtagSuggestEnabledSetting(next)
  }

  /**
   * 「メンション候補を表示」設定を変更する。
   *
   * Input:
   * - `next`: 変更後の値
   */
  const onMentionSuggestEnabledChange = (next: boolean) => {
    setMentionSuggestEnabled(next)
    writeMentionSuggestEnabledSetting(next)
  }

  /**
   * 「返信・引用オプションを保存する」の設定を変更する。
   *
   * Input:
   * - `next`: 変更後の値
   */
  const onSyncGateDefaultAfterPostChange = (next: boolean) => {
    setSyncGateDefaultAfterPost(next)
    writeSyncGateDefaultAfterPostSetting(next)
  }

  // reload実体は毎レンダーで作り直されるため ref 経由で最新版を参照し、
  // イベントリスナーの登録・解除自体は初回マウント時の一度だけに保つ
  // （Overlay.tsx の onCloseRef と同じパターン）。
  const reloadRef = useRef<() => void>(() => {})
  reloadRef.current = () => {
    shareToggles.reload()
    setPinnedFormDisabled(readPinnedFormDisabledSetting(false))
    setThemeMode(readThemeModeSetting("system"))
    setHashtagSuggestEnabled(readHashtagSuggestEnabledSetting(true))
    setMentionSuggestEnabled(readMentionSuggestEnabledSetting(true))
    setDefaultGate(readPostGateDefaultSetting())
    setSyncGateDefaultAfterPost(readSyncGateDefaultAfterPostSetting(false))
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

  // 「返信・引用のデフォルト設定」ダイアログのリスト選択用にdidを解決する。
  useEffect(() => {
    let cancelled = false

    const loadAccountDid = async () => {
      try {
        const res = await getSession()
        if (res.status !== 200 || cancelled) return

        const activeAccount = res.data.accounts.find(
          account => account.isActive,
        )
        if (!cancelled && activeAccount) setAccountDid(activeAccount.did)
      } catch (err) {
        console.warn("Settings: failed to resolve account did", err)
      }
    }

    void loadAccountDid()
    return () => {
      cancelled = true
    }
  }, [])

  // 文中にアイコンを差し込む文言のスロット（日本語と英語で位置が異なるため文言側で指定する）。
  const slots = {
    share: <InlineIcon name="share" />,
    popup: <InlineIcon name="popup" />,
    taittsuu: <InlineIcon name="taittsuu" />,
    mastodon: <InlineIcon name="mastodon" />,
  }
  const rich = (key: MessageKey) => renderSlots(raw(key), slots)

  const postFormItems: SettingListItem[] = [
    {
      key: "pinnedFormDisabled",
      label: t("settings.pinnedFormDisabled.label"),
      description: t("settings.pinnedFormDisabled.description"),
      checked: pinnedFormDisabled,
      onCheckedChange: onPinnedFormDisabledChange,
    },
    {
      key: "popupIntentInsteadOfWebshare",
      label: rich("settings.popupIntent.label"),
      description: rich("settings.popupIntent.description"),
      checked: shareToggles.popupIntentInsteadOfWebshare,
      onCheckedChange: shareToggles.onPopupIntentInsteadOfWebshareChange,
    },
    {
      key: "manualImageAttach",
      label: t("settings.manualImageAttach.label"),
      description: rich("settings.manualImageAttach.description"),
      checked: shareToggles.manualImageAttach,
      onCheckedChange: shareToggles.onManualImageAttachChange,
    },
    {
      key: "hashtagSuggestEnabled",
      label: t("settings.hashtagSuggest.label"),
      description: t("settings.hashtagSuggest.description"),
      checked: hashtagSuggestEnabled,
      onCheckedChange: onHashtagSuggestEnabledChange,
    },
    {
      key: "mentionSuggestEnabled",
      label: t("settings.mentionSuggest.label"),
      description: t("settings.mentionSuggest.description"),
      checked: mentionSuggestEnabled,
      onCheckedChange: onMentionSuggestEnabledChange,
    },
  ]

  const crosspostItems: SettingListItem[] = [
    {
      key: "showXWhenCrosspost",
      label: t("settings.showX.label"),
      description: t("settings.showX.description"),
      checked: shareToggles.showXWhenCrosspost,
      onCheckedChange: shareToggles.onShowXWhenCrosspostChange,
    },
    {
      key: "noAutoPopupAfterPost",
      label: t("settings.noAutoPopup.label"),
      description: t("settings.noAutoPopup.description"),
      checked: shareToggles.noAutoPopupAfterPost,
      onCheckedChange: shareToggles.onNoAutoPopupAfterPostChange,
    },
    {
      key: "crosspostToTaittsuu",
      label: rich("settings.taittsuu.label"),
      description: rich("settings.taittsuu.description"),
      checked: shareToggles.crosspostToTaittsuu,
      onCheckedChange: shareToggles.onCrosspostToTaittsuuChange,
    },
    {
      key: "crosspostToMastodon",
      label: rich("settings.mastodon.label"),
      description: rich("settings.mastodon.description"),
      checked: shareToggles.crosspostToMastodon,
      onCheckedChange: shareToggles.onCrosspostToMastodonChange,
      textInput: true,
      textInputValue: shareToggles.mastodonInstanceDomain,
      onTextInputChange: shareToggles.onMastodonInstanceDomainChange,
      textInputPlaceholder: "mastodon.social",
      textInputValidate: isValidMastodonInstanceDomain,
      textInputErrorMessage: t("settings.mastodon.domainError"),
    },
  ]

  const displayItems: SettingListItem[] = [
    {
      key: "themeMode",
      label: t("settings.theme.label"),
      renderControl: ({ id, ariaLabel, disabled }) => (
        <ThemeModeSelect
          id={id}
          value={themeMode}
          disabled={disabled}
          ariaLabel={ariaLabel}
          onChange={onThemeModeChange}
        />
      ),
    },
    {
      key: "uiLocale",
      label: t("settings.locale.label"),
      renderControl: ({ id, ariaLabel, disabled }) => (
        <LocaleSelect id={id} disabled={disabled} ariaLabel={ariaLabel} />
      ),
    },
  ]

  return (
    <div className={`${styles.groups}`}>
      <section className={`${ui["base-card"]} ${ui["base-padding"]}`}>
        <h2 className={ui.subject}>{t("settings.display.title")}</h2>
        <SettingList items={displayItems} />
      </section>

      <section className={`${ui["base-card"]} ${ui["base-padding"]}`}>
        <h2 className={ui.subject}>{t("settings.postForm.title")}</h2>
        <SettingList items={postFormItems} />
      </section>
      <section className={`${ui["base-card"]} ${ui["base-padding"]}`}>
        <h2 className={ui.subject}>{t("settings.gate.title")}</h2>
        <p className={styles["gate-description"]}>
          {t("settings.gate.description")}
        </p>
        <div className={`${ui["right"]}`}>
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]}`}
            onClick={() => setGateDialogOpen(true)}
          >
            {t("settings.gate.editButton")}
          </button>
        </div>

        <SettingList
          items={[
            {
              key: "syncGateDefaultAfterPost",
              label: t("settings.syncGate.label"),
              description: t("settings.syncGate.description"),
              checked: syncGateDefaultAfterPost,
              onCheckedChange: onSyncGateDefaultAfterPostChange,
            },
          ]}
        />
      </section>

      <PostGateDialog
        open={gateDialogOpen}
        onClose={() => setGateDialogOpen(false)}
        value={defaultGate}
        accountDid={accountDid}
        onChange={next => {
          setDefaultGate(next)
          writePostGateDefaultSetting(next)
          setGateDialogOpen(false)
        }}
      />

      <section className={`${ui["base-card"]} ${ui["base-padding"]}`}>
        <h2 className={ui.subject}>{t("settings.crosspost.title")}</h2>
        <SettingList items={crosspostItems} />
      </section>
    </div>
  )
}

export default Settings
