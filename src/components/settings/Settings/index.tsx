/**
 * 設定ページ本体コンポーネント。
 *
 * 責務と処理概要:
 * - 設定を「表示」「投稿」「クロスポスト」の3グループに分け、`SettingList` で一覧表示する。
 * - 投稿のグループに返信・引用のデフォルト設定の編集ボタンの行を含め、末尾に
 *   予約投稿の有効化のスイッチ（`ScheduleSetting`）を置く。
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
import ScheduleSetting from "@/components/schedule/ScheduleSetting"
import SettingList, {
  type SettingListItem,
} from "@/components/settings/SettingList"
import { DEFAULT_POST_GATE_VALUE, type PostGateValue } from "@/lib/atproto/gate"
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
  readTimelineHiddenSetting,
  writeTimelineHiddenSetting,
} from "@/lib/settings/timelineSettings"
import {
  applyThemeMode,
  readThemeModeSetting,
  type ThemeMode,
  writeThemeModeSetting,
} from "@/lib/settings/themeSettings"
import type { MessageKey } from "@/lib/i18n/translate"
import { useShareToggles } from "@/lib/settings/useShareToggles"
import AutoPopupTargetSelect from "@/components/common/AutoPopupTargetSelect"
import { isValidMastodonInstanceDomain } from "@/util/share/intent"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

/**
 * 設定ページを描画する。
 *
 * Output:
 * - 「表示」「投稿」「クロスポスト」の3グループに分けた設定一覧
 *
 * 例:
 * - 出力: 表示4件・投稿4件（+予約投稿）・クロスポスト5〜6件の設定一覧
 */
export const Settings = () => {
  const { t, raw } = useT()
  const shareToggles = useShareToggles()
  // 各設定の初期 state はサーバー描画と同じ固定の既定値とし、保存値はマウント後の
  // reload（下の useEffect）で反映する。初期化関数で localStorage を読むと、クライアントの
  // 初回描画（ハイドレーション）がサーバー描画と食い違い、React はスイッチの checked 等の
  // 属性を補正しないため、保存値と異なる見た目のまま残る（`useShareToggles` と同じ方針）。
  const [pinnedFormDisabled, setPinnedFormDisabled] = useState(false)
  const [timelineHidden, setTimelineHidden] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>("system")
  const [hashtagSuggestEnabled, setHashtagSuggestEnabled] = useState(true)
  const [mentionSuggestEnabled, setMentionSuggestEnabled] = useState(true)
  const [defaultGate, setDefaultGate] = useState<PostGateValue>(
    DEFAULT_POST_GATE_VALUE,
  )
  const [syncGateDefaultAfterPost, setSyncGateDefaultAfterPost] =
    useState(false)
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
   * 「タイムラインを表示しない」設定を変更する。
   *
   * Input:
   * - `next`: 変更後の値
   */
  const onTimelineHiddenChange = (next: boolean) => {
    setTimelineHidden(next)
    writeTimelineHiddenSetting(next)
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
    setTimelineHidden(readTimelineHiddenSetting(false))
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
    mastodon: <InlineIcon name="mastodon" />,
  }
  const rich = (key: MessageKey) => renderSlots(raw(key), slots)

  // 表示: 画面全体の見た目 → 画面構成の順。固定表示しないはタイムライン非表示中に
  // 操作不能になるため、原因となるタイムラインの行の直後に置く。
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
    {
      key: "timelineHidden",
      label: t("settings.timelineHidden.label"),
      description: t("settings.timelineHidden.description"),
      checked: timelineHidden,
      onCheckedChange: onTimelineHiddenChange,
    },
    {
      key: "pinnedFormDisabled",
      label: t("settings.pinnedFormDisabled.label"),
      description: t("settings.pinnedFormDisabled.description"),
      // タイムライン非表示中は投稿フォームを常に固定表示するため、OFF表示で操作不能にする
      // （保存値は保持し、タイムラインを再表示したときに元の設定へ戻す）。
      checked: pinnedFormDisabled && !timelineHidden,
      disabled: timelineHidden,
      onCheckedChange: onPinnedFormDisabledChange,
    },
  ]

  // 投稿: 本文の入力補助 → 返信・引用の既定値の順（予約投稿はこの後ろに別部品で置く）。
  const postItems: SettingListItem[] = [
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
    {
      key: "postGateDefault",
      label: t("settings.gate.label"),
      description: t("settings.gate.description"),
      // 値はダイアログで編集するため、行のコントロールはダイアログを開くボタンにする。
      // 表示文言は短くし、アクセシブルネームで編集対象を示す。
      renderControl: ({ id, disabled }) => (
        <button
          id={id}
          type="button"
          className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]}`}
          disabled={disabled}
          aria-label={t("settings.gate.editButton")}
          onClick={() => setGateDialogOpen(true)}
        >
          {t("common.edit")}
        </button>
      ),
    },
    {
      key: "syncGateDefaultAfterPost",
      label: t("settings.syncGate.label"),
      description: t("settings.syncGate.description"),
      checked: syncGateDefaultAfterPost,
      onCheckedChange: onSyncGateDefaultAfterPostChange,
    },
  ]

  // クロスポスト: 共有の方法 → 共有する内容 → 共有先ごとの設定の順。
  // リンクカード優先・長文省略は「画像を自分で添付する」がONの間は操作不能になるため、その後ろに置く。
  const crossPostItems: SettingListItem[] = [
    {
      key: "popupIntentInsteadOfWebshare",
      label: rich("settings.popupIntent.label"),
      description: rich("settings.popupIntent.description"),
      checked: shareToggles.popupIntentInsteadOfWebshare,
      onCheckedChange: shareToggles.onPopupIntentInsteadOfWebshareChange,
    },
    // 「WebShareの代わりにポップアップを開く」がONのときだけ、自動ポップアップ先を選べる。
    ...(shareToggles.popupIntentInsteadOfWebshare
      ? [
          {
            key: "autoPopupTarget",
            label: t("post.autoPopupTarget.label"),
            description: t("settings.autoPopupTarget.description"),
            renderControl: ({
              id,
              ariaLabel,
              disabled,
            }: {
              id: string
              ariaLabel?: string
              disabled?: boolean
            }) => (
              <AutoPopupTargetSelect
                id={id}
                value={shareToggles.autoPopupTarget}
                disabled={disabled}
                ariaLabel={ariaLabel}
                onChange={shareToggles.onAutoPopupTargetChange}
              />
            ),
          },
        ]
      : []),
    {
      key: "manualImageAttach",
      label: t("settings.manualImageAttach.label"),
      description: rich("settings.manualImageAttach.description"),
      checked: shareToggles.manualImageAttach,
      onCheckedChange: shareToggles.onManualImageAttachChange,
    },
    {
      key: "preferSkyshareLinkCard",
      label: t("settings.linkCardPriority.label"),
      description: t("settings.linkCardPriority.description"),
      checked: shareToggles.preferSkyshareLinkCard,
      // 画像を自分で添付がONの間は skyshare URL を共有文に含めないため、適用対象が無い
      disabled: shareToggles.manualImageAttach,
      onCheckedChange: shareToggles.onPreferSkyshareLinkCardChange,
    },
    {
      key: "truncateIntentText",
      label: t("settings.truncateIntentText.label"),
      description: t("settings.truncateIntentText.description"),
      checked: shareToggles.truncateIntentText,
      disabled: shareToggles.manualImageAttach,
      onCheckedChange: shareToggles.onTruncateIntentTextChange,
    },
    {
      key: "mastodonInstanceDomain",
      label: rich("settings.mastodon.instance.label"),
      description: t("settings.mastodon.instance.description"),
      // トグルを持たない行のため、コントロール枠は空にして入力欄のみを使う。
      renderControl: () => null,
      textInput: true,
      textInputValue: shareToggles.mastodonInstanceDomain,
      onTextInputChange: shareToggles.onMastodonInstanceDomainChange,
      textInputPlaceholder: "mastodon.social",
      textInputValidate: isValidMastodonInstanceDomain,
      textInputErrorMessage: t("settings.mastodon.domainError"),
    },
  ]

  return (
    <div className={`${styles.groups}`}>
      <section className={`${ui["base-card"]} ${ui["base-padding"]}`}>
        <h2 className={ui.subject}>{t("settings.display.title")}</h2>
        <SettingList items={displayItems} />
      </section>

      <section className={`${ui["base-card"]} ${ui["base-padding"]}`}>
        <h2 className={ui.subject}>{t("settings.post.title")}</h2>
        <SettingList items={postItems} />
        {/* 予約投稿の有効化はサーバーの登録状態に従うため、端末の設定とは別の部品が扱う */}
        <ScheduleSetting />
      </section>

      <section className={`${ui["base-card"]} ${ui["base-padding"]}`}>
        <h2 className={ui.subject}>{t("settings.crossPost.title")}</h2>
        <SettingList items={crossPostItems} />
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
    </div>
  )
}

export default Settings
