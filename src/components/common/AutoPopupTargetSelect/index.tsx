import Dropdown, { type DropdownOption } from "@/components/common/Dropdown"
import InlineIcon from "@/components/common/InlineIcon"
import { useT } from "@/lib/i18n/react"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import {
  AUTO_POPUP_TARGETS,
  isAutoPopupTarget,
  type AutoPopupTarget,
} from "@/lib/settings/shareSettings"
import styles from "./index.module.css"

/**
 * 投稿後に自動でポップアップするSNS（投稿時に選択する/X/タイッツー/Mastodon）を選択するプルダウン。
 *
 * 責務と処理概要:
 * - 選択肢一覧から自動ポップアップ先を選ばせるだけの純粋UIコンポーネントで、
 *   永続化や表示条件（PopupIntentInsteadOfWebshare がONのときのみ表示）は呼び出し側が決める。
 * - X・タイッツー・Mastodon は対応する `InlineIcon` を名称の前に併記する。
 * - 横幅は選択中の内容に合わせて可変にする（`Dropdown` の `autoWidth`）。
 */

const OPTION_LABEL_KEYS: Record<AutoPopupTarget, PlainMessageKey> = {
  ask: "post.autoPopupTarget.ask",
  x: "post.autoPopupTarget.x",
  taittsuu: "post.autoPopupTarget.taittsuu",
  mastodon: "post.autoPopupTarget.mastodon",
}

export type AutoPopupTargetSelectProps = {
  value: AutoPopupTarget
  onChange: (next: AutoPopupTarget) => void
  disabled?: boolean
  className?: string
  id?: string
  ariaLabel?: string
}

/**
 * 自動ポップアップ先選択用プルダウンを描画する。
 *
 * Input:
 * - `value`: 現在選択中の自動ポップアップ先
 * - `onChange`: 選択変更時に呼ぶコールバック（`AUTO_POPUP_TARGETS` の値のみ渡す）
 * - `disabled`/`className`/`id`/`ariaLabel`: 表示・属性制御
 *
 * Output:
 * - 自動ポップアップ先の候補を持つ `Dropdown`
 *
 * 例:
 * - 入力: `{ value: "x", onChange: fn }`
 * - 出力: 「X」が選択された自動ポップアップ先プルダウン
 */
export const AutoPopupTargetSelect = ({
  value,
  onChange,
  disabled = false,
  className,
  id = "auto-popup-target",
  ariaLabel,
}: AutoPopupTargetSelectProps) => {
  const { t } = useT()
  const options: DropdownOption[] = AUTO_POPUP_TARGETS.map(target => {
    const label = t(OPTION_LABEL_KEYS[target])
    const iconName = target === "ask" ? null : target
    return {
      value: target,
      label,
      content: iconName ? (
        <span className={styles.option}>
          <InlineIcon name={iconName} />
          {label}
        </span>
      ) : (
        label
      ),
    }
  })
  const handleChange = (next: string) => {
    if (isAutoPopupTarget(next)) {
      onChange(next)
    }
  }

  return (
    <Dropdown
      id={id}
      value={value}
      options={options}
      onChange={handleChange}
      disabled={disabled}
      autoWidth
      ariaLabel={ariaLabel ?? t("post.autoPopupTarget.label")}
      className={className ? `${styles.select} ${className}` : styles.select}
    />
  )
}

export default AutoPopupTargetSelect
