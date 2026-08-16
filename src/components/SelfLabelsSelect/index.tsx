/**
 * 投稿コンテンツへの自己ラベル選択コンポーネント。
 *
 * 責務と処理概要:
 * - Bluesky の `com.atproto.label.defs#selfLabels` 仕様に基づくラベル値を定数として提供する。
 * - ユーザーが任意のラベルを単一選択（またはラベルなし）できる `<select>` を描画する。
 * - 選択値を親コンポーネントにコールバックで通知する。
 */

import React from "react"
import type { CreateEntryBodySelfLabels } from "../../client/openapi/model/createEntryBodySelfLabels"
import { CreateEntryBodySelfLabels as SelfLabelValues } from "../../client/openapi/model/createEntryBodySelfLabels"
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
  label: string
  value: CreateEntryBodySelfLabels
}

export const SELF_LABEL_OPTIONS: SelfLabelOption[] = [
  { label: "きわどい(sexual)", value: SelfLabelValues.sexual },
  { label: "ヌード(nudity)", value: SelfLabelValues.nudity },
  { label: "成人向け(porn)", value: SelfLabelValues.porn },
  { label: "ネタバレ(spoiler)", value: SelfLabelValues.spoiler },
  { label: "警告(warn)", value: SelfLabelValues["!warn"] },
]

type Props = {
  /** 現在選択中のラベル値。未選択時は undefined */
  value: CreateEntryBodySelfLabels | undefined
  /** 選択変更時に呼ぶコールバック。未選択時は undefined を渡す */
  onChange: (value: CreateEntryBodySelfLabels | undefined) => void
  disabled?: boolean
  className?: string
  id?: string
  name?: string
  ariaLabel?: string
}

/**
 * 投稿への自己ラベル選択用 `<select>` を描画する。
 *
 * Input:
 * - `value`: 現在選択中のラベル値（未選択時は undefined）
 * - `onChange`: 選択変更時のコールバック
 * - `disabled`: 入力可否
 * - `className`/`id`/`name`/`ariaLabel`: 表示・属性制御
 *
 * Output:
 * - ラベル候補を持つ `<select>` 要素（未選択肢を含む）
 *
 * 例:
 * - 入力: `{ value: undefined, onChange: fn }`
 * - 出力: 「ラベルなし」が選択されたセレクト
 */
export const Component: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
  className,
  id = "self-label",
  name = "selfLabels",
  ariaLabel = "コンテンツラベル",
}) => {
  const selectClassName = className
    ? `${ui["base-select"]} ${styles.select} ${className}`
    : `${ui["base-select"]} ${styles.select}`

  /**
   * select の onChange ハンドラ。
   *
   * 処理の趣旨:
   * - 空文字列（未選択）の場合は undefined、それ以外はラベル値として親へ通知する。
   */
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value
    if (selected === "") {
      onChange(undefined)
    } else {
      onChange(selected as CreateEntryBodySelfLabels)
    }
  }

  return (
    <span>
      <svg
        className={`${styles.icon} ${value !== undefined ? styles["icon-active"] : styles["icon-inactive"]}`}
      >
        <use xlinkHref={pic.src + "#warn"} height="100%" width="100%" />
      </svg>
      <span className={ui["select-wrapper"]}>
        <select
          id={id}
          name={name}
          className={selectClassName}
          value={value ?? ""}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel}
        >
          <option value="">ラベルなし</option>
          {SELF_LABEL_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </span>
  )
}

export default Component
