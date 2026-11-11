/**
 * 投稿フォームの共有方法、投稿後の設定、固定表示のオプションを表示する。
 * 値の保存と画面状態は投稿フォーム本体が管理する。
 */
import { renderSlots } from "@/components/i18n/renderSlots"
import { useT } from "@/components/i18n/useTranslation"
import AutoPopupTargetSelect from "@/components/common/select/AutoPopupTargetSelect"
import Collapsible from "@/components/common/section/Collapsible"
import InlineIcon from "@/components/common/InlineIcon"
import ToggleSwitch from "@/components/common/input/ToggleSwitch"
import type { useShareToggles } from "@/components/settings/Settings/useShareToggles"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"

type Props = {
  entryFormId: string
  isSubmitting: boolean
  shareToggles: ReturnType<typeof useShareToggles>
  syncGateDefaultAfterPost: boolean
  onSyncGateDefaultAfterPostChange: (next: boolean) => void
  effectivePinnedFormDisabled: boolean
  timelineHidden: boolean
  onPinnedFormDisabledChange: (next: boolean) => void
}

/**
 * 投稿フォームの「その他のオプション」（共有の設定・投稿後の設定・固定表示）を描画する。
 * 値の保存と画面の状態は投稿フォームの本体が持ち、この部品は値の表示と操作だけを行う。
 */
const ComposerOptions = ({
  entryFormId,
  isSubmitting,
  shareToggles,
  syncGateDefaultAfterPost,
  onSyncGateDefaultAfterPostChange,
  effectivePinnedFormDisabled,
  timelineHidden,
  onPinnedFormDisabledChange,
}: Props) => {
  const { t, raw } = useT()
  return (
    <div className={ui["base-component"]}>
      {/* 情報量を抑えるため、初期状態は閉じて表示する。 */}
      <Collapsible label={t("post.composer.moreOptions")}>
        <div className={ui["toggle-box"]}>
          <ToggleSwitch
            checked={shareToggles.popupIntentInsteadOfWebshare}
            disabled={isSubmitting}
            label={renderSlots(raw("post.composer.popupInstead"), {
              share: <InlineIcon name="share" />,
              popup: <InlineIcon name="popup" />,
            })}
            onCheckedChange={shareToggles.onPopupIntentInsteadOfWebshareChange}
          />
          {shareToggles.popupIntentInsteadOfWebshare && (
            <div className={styles["auto-popup-target-row"]}>
              <label htmlFor={`${entryFormId}-auto-popup-target`}>
                {t("post.autoPopupTarget.label")}
              </label>
              <AutoPopupTargetSelect
                id={`${entryFormId}-auto-popup-target`}
                ariaLabel={t("post.autoPopupTarget.label")}
                value={shareToggles.autoPopupTarget}
                disabled={isSubmitting}
                onChange={shareToggles.onAutoPopupTargetChange}
              />
            </div>
          )}
          <ToggleSwitch
            checked={shareToggles.truncateIntentText}
            disabled={isSubmitting || shareToggles.manualImageAttach}
            label={t("post.composer.truncateIntentText")}
            onCheckedChange={shareToggles.onTruncateIntentTextChange}
          />
          <ToggleSwitch
            checked={syncGateDefaultAfterPost}
            disabled={isSubmitting}
            label={t("settings.syncGate.label")}
            onCheckedChange={onSyncGateDefaultAfterPostChange}
          />
          <ToggleSwitch
            checked={effectivePinnedFormDisabled}
            disabled={isSubmitting || timelineHidden}
            label={t("settings.pinnedFormDisabled.label")}
            onCheckedChange={onPinnedFormDisabledChange}
          />
        </div>
      </Collapsible>
    </div>
  )
}

export default ComposerOptions
