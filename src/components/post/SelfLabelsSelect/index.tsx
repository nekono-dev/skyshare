/**
 * 投稿コンテンツへの自己ラベル選択コンポーネント。
 *
 * 責務と処理概要:
 * - Bluesky の `com.atproto.label.defs#selfLabels` 仕様に基づくラベル値を定数として提供する。
 * - ユーザーが任意のラベルを単一選択（またはラベルなし）できる `Dropdown` を描画する。
 * - 選択値を親コンポーネントにコールバックで通知する。
 */

import { useT } from "@/lib/i18n/react"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import React from "react"
import type { CreateEntryBodySelfLabels } from "@/client/openapi/model/createEntryBodySelfLabels"
import { CreateEntryBodySelfLabels as SelfLabelValues } from "@/client/openapi/model/createEntryBodySelfLabels"
import Dropdown from "@/components/common/Dropdown"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"
import pic from "@/images/warn.svg"

/**
 * 選択肢の表示ラベルと値の対応。
 *
 * 処理の趣旨:
 * - Bluesky 公式ラベル値に対して日本語説明を対応付ける。
 */
type SelfLabelOption = {
  labelKey: PlainMessageKey
  value: CreateEntryBodySelfLabels
}

export const SELF_LABEL_OPTIONS: SelfLabelOption[] = [
  { labelKey: "post.selfLabel.sexual", value: SelfLabelValues.sexual },
  { labelKey: "post.selfLabel.nudity", value: SelfLabelValues.nudity },
  { labelKey: "post.selfLabel.porn", value: SelfLabelValues.porn },
  { labelKey: "post.selfLabel.spoiler", value: SelfLabelValues.spoiler },
  { labelKey: "post.selfLabel.warn", value: SelfLabelValues["!warn"] },
]

type Props = {
  /** 現在選択中のラベル値。未選択時は undefined */
  value: CreateEntryBodySelfLabels | undefined
  /** 選択変更時に呼ぶコールバック。未選択時は undefined を渡す */
  onChange: (value: CreateEntryBodySelfLabels | undefined) => void
  disabled?: boolean
  className?: string
  id?: string
  ariaLabel?: string
  /** true の場合、選択中のラベル名に合わせて横幅を可変にする（既定は固定幅） */
  autoWidth?: boolean
}

/**
 * 投稿への自己ラベル選択用プルダウンを描画する。
 *
 * Input:
 * - `value`: 現在選択中のラベル値（未選択時は undefined）
 * - `onChange`: 選択変更時のコールバック
 * - `disabled`: 入力可否
 * - `className`/`id`/`ariaLabel`: 表示・属性制御
 * - `autoWidth`: 選択内容に応じて横幅を可変にするか
 *
 * Output:
 * - ラベル候補を持つ `Dropdown`（「ラベルなし」を含む）
 *
 * 例:
 * - 入力: `{ value: undefined, onChange: fn }`
 * - 出力: 「ラベルなし」が選択されたプルダウン
 */
export const Component: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
  className,
  id = "self-label",
  ariaLabel,
  autoWidth = false,
}) => {
  const { t } = useT()
  const options = [
    { value: "", label: t("post.selfLabel.none") },
    ...SELF_LABEL_OPTIONS.map(option => ({
      value: option.value,
      label: t(option.labelKey),
    })),
  ]
  const widthClassName = autoWidth ? styles["select-auto"] : styles.select

  /**
   * Dropdown の onChange ハンドラ。
   *
   * 処理の趣旨:
   * - 空文字列（ラベルなし）の場合は undefined、それ以外はラベル値として親へ通知する。
   */
  const handleChange = (selected: string) => {
    if (selected === "") {
      onChange(undefined)
    } else {
      onChange(selected as CreateEntryBodySelfLabels)
    }
  }

  return (
    <span className={`${ui["block-wrapper"]}`}>
      <svg
        className={`${styles.icon} ${value !== undefined ? styles["icon-active"] : styles["icon-inactive"]}`}
      >
        <use xlinkHref={pic.src + "#warn"} height="100%" width="100%" />
      </svg>
      <Dropdown
        id={id}
        value={value ?? ""}
        options={options}
        onChange={handleChange}
        disabled={disabled}
        autoWidth={autoWidth}
        ariaLabel={ariaLabel ?? t("post.selfLabel.aria")}
        className={
          className ? `${widthClassName} ${className}` : widthClassName
        }
      />
    </span>
  )
}

export default Component
