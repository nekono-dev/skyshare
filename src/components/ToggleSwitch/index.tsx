/**
 * ToggleSwitch コンポーネント。
 *
 * 責務と処理概要:
 * - boolean 値を持つ設定項目を ON/OFF で切り替えるトグルスイッチ UI を提供する。
 * - Controlled コンポーネントとして設計しており、状態管理は常に呼び出し元が担う。
 * - オプションで「変更前判定コールバック」（onBeforeCheckedChange）を受け取り、
 *   コールバックが false を返した場合は変更を抑止する。
 *   これにより、「Web Share API が使用不可なら ON にできない」などの条件付き挙動を実現する。
 * - Cloudflare Workers 環境で動作するため Node.js 固有 API は一切使用しない。
 */
import React, { useId } from "react"
import styles from "./index.module.css"

type Props = {
  /** 現在のトグル状態 */
  checked: boolean
  /** 値が変化した後に呼ばれるコールバック。確定後の値を受け取る。 */
  onCheckedChange: (next: boolean) => void
  /**
   * 変更前判定コールバック（任意）。
   * - 提案された次の値を受け取り、最終確定値を返す。
   * - 元の提案値と異なる値を返すと変更が抑止される。
   * - 例: checked=true を拒否したい場合は () => false を返す。
   */
  onBeforeCheckedChange?: (next: boolean) => boolean
  /** スイッチに付随するラベル内容 */
  label: React.ReactNode
  /** true の場合、スイッチを操作不能にする */
  disabled?: boolean
  /** 入力要素の id（省略時は自動生成） */
  id?: string
  /** aria-label（labelと共に指定すると aria-label が優先される） */
  "aria-label"?: string
  /** 追加の className（コンテナ要素へ適用） */
  className?: string
}

/**
 * ToggleSwitch の変更処理。
 *
 * 処理の趣旨:
 * - ユーザーのクリック/キーボード操作で提案された次の値を onBeforeCheckedChange で評価し、
 *   最終確定値と提案値が一致するときのみ onCheckedChange を呼び出す。
 *
 * Input:
 * - `proposed`: ユーザーが意図した次の状態（true=ON, false=OFF）
 * - `onBeforeCheckedChange`: 省略可能な変更前フック
 * - `onCheckedChange`: 確定値を親へ通知するコールバック
 *
 * Output:
 * - なし（副作用として onCheckedChange が呼ばれる場合がある）
 *
 * 例:
 * - 入力: proposed=true, onBeforeCheckedChange = () => false
 * - 出力: onCheckedChange は呼ばれない（変更抑止）
 */
const resolveCheckedChange = (
  proposed: boolean,
  onBeforeCheckedChange: ((next: boolean) => boolean) | undefined,
  onCheckedChange: (next: boolean) => void,
) => {
  // onBeforeCheckedChange 未指定の場合は提案値をそのまま確定値とする
  const resolved =
    onBeforeCheckedChange !== undefined
      ? onBeforeCheckedChange(proposed)
      : proposed

  // 提案値と確定値が一致する場合のみ変更を反映する
  if (proposed === resolved) {
    onCheckedChange(resolved)
  }
}

/**
 * トグルスイッチ UI を描画する。
 *
 * Input:
 * - `checked`: 現在の ON/OFF 値
 * - `onCheckedChange`: 確定後の値を受け取るコールバック
 * - `onBeforeCheckedChange`: 任意。変更前判定を行い最終値を返す
 * - `label`: ラベルとして表示するコンテンツ
 * - `disabled`: true で操作不能化
 * - `id`: 入力要素の id（省略時は自動生成）
 * - `aria-label`: アクセシビリティ用ラベル
 * - `className`: コンテナへの追加クラス
 *
 * Output:
 * - トグルスイッチ（label + 非表示 input + 表示用スイッチ）のマークアップ
 *
 * 例:
 * - 入力: `{ checked: false, onCheckedChange: setOpenXPopup, label: "Xをポップアップで開く" }`
 * - 出力: OFF 状態のスライドスイッチ + ラベルを含む要素
 */
export const ToggleSwitch = ({
  checked,
  onCheckedChange,
  onBeforeCheckedChange,
  label,
  disabled = false,
  id,
  "aria-label": ariaLabel,
  className,
}: Props) => {
  const generatedId = useId()
  const inputId = id ?? generatedId

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    resolveCheckedChange(
      e.currentTarget.checked,
      onBeforeCheckedChange,
      onCheckedChange,
    )
  }

  return (
    <span className={`${styles.wrapper}${className ? ` ${className}` : ""}`}>
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-checked={checked}
      />
      <label className={styles.label} htmlFor={inputId}>
        <span className={styles.track} aria-hidden>
          <span className={styles.knob} />
        </span>
        <span className={styles.labelText}>{label}</span>
      </label>
    </span>
  )
}

export default ToggleSwitch
