import { useEffect, useState } from "react"
import Dropdown from "@/components/common/Dropdown"
import { isLocale, type LocaleSetting } from "@/lib/i18n/locale"
import { readLocaleSetting } from "@/lib/i18n/localeSetting"
import { useLocale, useT } from "@/lib/i18n/react"
import { setLocaleSetting } from "@/lib/i18n/store"
import styles from "./index.module.css"

/**
 * 表示言語（システム設定に従う/日本語/English）を選択するプルダウン。
 *
 * 責務と処理概要:
 * - 設定画面・ログイン画面など、どの画面に置いても単体で動く。現在の設定は localStorage から読み、
 *   変更時は `setLocaleSetting` で保存と全文言への反映を行う（呼び出し側に状態を持たせない）。
 * - SSR・水和時は `system` で描画し、マウント後に保存値へ合わせる（hydration mismatch の回避）。
 *   別タブでの変更など表示言語が変わったときも、設定値を読み直して表示を揃える。
 * - 言語の自称（「日本語」「English」）は翻訳せず、どの表示言語でも同じ表記にする
 *   （表示言語を間違えて切り替えても元に戻せるようにするため）。
 */

export type LocaleSelectProps = {
  disabled?: boolean
  className?: string
  id?: string
  ariaLabel?: string
}

/**
 * 表示言語選択用プルダウンを描画する。
 *
 * Input:
 * - `disabled`/`className`/`id`/`ariaLabel`: 表示・属性制御
 *
 * Output:
 * - 言語候補を持つ `Dropdown`
 *
 * 例:
 * - 入力: `{}`
 * - 出力: 「システム設定に従う」が選択された言語選択プルダウン
 */
export const LocaleSelect = ({
  disabled = false,
  className,
  id = "ui-locale",
  ariaLabel,
}: LocaleSelectProps) => {
  const { t } = useT()
  const locale = useLocale()
  const [value, setValue] = useState<LocaleSetting>("system")

  // 表示言語が変わるたび（初回マウント含む）に、保存済みの設定値へ揃える
  useEffect(() => {
    setValue(readLocaleSetting())
  }, [locale])

  const options = [
    { value: "system", label: t("settings.locale.system") },
    { value: "ja", label: "日本語" },
    { value: "en", label: "English" },
  ]

  const handleChange = (next: string) => {
    if (next === "system" || isLocale(next)) {
      setValue(next)
      setLocaleSetting(next)
    }
  }

  return (
    <Dropdown
      id={id}
      value={value}
      options={options}
      onChange={handleChange}
      disabled={disabled}
      ariaLabel={ariaLabel ?? t("settings.locale.label")}
      className={className ? `${styles.select} ${className}` : styles.select}
    />
  )
}

export default LocaleSelect
