import { useT } from "@/lib/i18n/react"
import ui from "@/styles/ui.module.css"

/**
 * 「サムネ調整」ボタン。
 *
 * 責務と処理概要:
 * - 画像（`ImagePicker`）・動画（`VideoPicker`）のどちらの添付に対しても共通で使う、
 *   entry の visual 調整ダイアログを開くためのボタン。ダイアログ自体は持たず、
 *   どの Picker のダイアログを開くかは親（`ThreadSegmentForm`）が決める。
 */

type Props = {
  onClick: () => void
  disabled?: boolean
  /** 置き場所に応じた寸法の調整用（例: `ui["compact-button"]`） */
  className?: string
}

export const ThumbnailAdjustButton = ({
  onClick,
  disabled = false,
  className,
}: Props) => {
  const { t } = useT()
  return (
    <button
      type="button"
      className={`${ui["base-button"]} ${ui["text-button"]} ${ui["blue-button"]} ${className ?? ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {t("image.picker.adjustThumbnail")}
    </button>
  )
}

export default ThumbnailAdjustButton
