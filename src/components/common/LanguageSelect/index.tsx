import { useT } from "@/lib/i18n/react"
import React from "react"
import Dropdown, { type DropdownOption } from "@/components/common/Dropdown"
import { languageCodeToFlagEmoji } from "@/lib/atproto/languageFlag"
import styles from "./index.module.css"

/**
 * 投稿言語選択コンポーネントで利用する言語定義と選択 UI。
 *
 * 責務と処理概要:
 * - Bluesky 投稿言語コード一覧を定数として提供する。
 * - 重複コードを除外した選択肢を、国旗絵文字付きの絞り込み可能な `Dropdown` で描画する。
 */

export type LanguageOption = {
  label: string
  code: string
}

export const BLUESKY_POST_LANGUAGES: LanguageOption[] = [
  { label: "Afar", code: "aa" },
  { label: "Abkhazian", code: "ab" },
  { label: "Avestan", code: "ae" },
  { label: "Afrikaans", code: "af" },
  { label: "Akan", code: "ak" },
  { label: "አማርኛ", code: "am" },
  { label: "Aragonese", code: "an" },
  { label: "العربية", code: "ar" },
  { label: "অসমীয়া", code: "as" },
  { label: "Avaric", code: "av" },
  { label: "Aymara", code: "ay" },
  { label: "azərbaycan", code: "az" },
  { label: "Bashkir", code: "ba" },
  { label: "беларуская", code: "be" },
  { label: "български", code: "bg" },
  { label: "भोजपुरी", code: "bho" },
  { label: "Bislama", code: "bi" },
  { label: "bamanakan", code: "bm" },
  { label: "বাংলা", code: "bn" },
  { label: "བོད་སྐད་", code: "bo" },
  { label: "brezhoneg", code: "br" },
  { label: "bosanski", code: "bs" },
  { label: "català", code: "ca" },
  { label: "нохчийн", code: "ce" },
  { label: "Chamorro", code: "ch" },
  { label: "Corsican", code: "co" },
  { label: "Cree", code: "cr" },
  { label: "čeština", code: "cs" },
  { label: "Church Slavic", code: "cu" },
  { label: "чӑваш", code: "cv" },
  { label: "Cymraeg", code: "cy" },
  { label: "dansk", code: "da" },
  { label: "Deutsch", code: "de" },
  { label: "Divehi", code: "dv" },
  { label: "རྫོང་ཁ", code: "dz" },
  { label: "eʋegbe", code: "ee" },
  { label: "Ελληνικά", code: "el" },
  { label: "English", code: "en" },
  { label: "Esperanto", code: "eo" },
  { label: "español", code: "es" },
  { label: "eesti", code: "et" },
  { label: "euskara", code: "eu" },
  { label: "فارسی", code: "fa" },
  { label: "Pulaar", code: "ff" },
  { label: "suomi", code: "fi" },
  { label: "Filipino", code: "fil" },
  { label: "Fijian", code: "fj" },
  { label: "føroyskt", code: "fo" },
  { label: "français", code: "fr" },
  { label: "Frysk", code: "fy" },
  { label: "Gaeilge", code: "ga" },
  { label: "Gàidhlig", code: "gd" },
  { label: "galego", code: "gl" },
  { label: "Guarani", code: "gn" },
  { label: "ગુજરાતી", code: "gu" },
  { label: "Gaelg", code: "gv" },
  { label: "Hausa", code: "ha" },
  { label: "עברית", code: "he" },
  { label: "हिन्दी", code: "hi" },
  { label: "Hiri Motu", code: "ho" },
  { label: "hrvatski", code: "hr" },
  { label: "Haitian Creole", code: "ht" },
  { label: "magyar", code: "hu" },
  { label: "հայերեն", code: "hy" },
  { label: "Herero", code: "hz" },
  { label: "interlingua", code: "ia" },
  { label: "Indonesia", code: "id" },
  { label: "Interlingue", code: "ie" },
  { label: "Igbo", code: "ig" },
  { label: "ꆈꌠꉙ", code: "ii" },
  { label: "Inupiaq", code: "ik" },
  { label: "Ido", code: "io" },
  { label: "íslenska", code: "is" },
  { label: "italiano", code: "it" },
  { label: "Inuktitut", code: "iu" },
  { label: "日本語", code: "ja" },
  { label: "Jawa", code: "jv" },
  { label: "ქართული", code: "ka" },
  { label: "Kongo", code: "kg" },
  { label: "Gikuyu", code: "ki" },
  { label: "Kuanyama", code: "kj" },
  { label: "қазақ тілі", code: "kk" },
  { label: "kalaallisut", code: "kl" },
  { label: "ខ្មែរ", code: "km" },
  { label: "ಕನ್ನಡ", code: "kn" },
  { label: "한국어", code: "ko" },
  { label: "Kanuri", code: "kr" },
  { label: "کٲشُر", code: "ks" },
  { label: "kurdî (kurmancî)", code: "ku" },
  { label: "Komi", code: "kv" },
  { label: "kernewek", code: "kw" },
  { label: "кыргызча", code: "ky" },
  { label: "Latin", code: "la" },
  { label: "Lëtzebuergesch", code: "lb" },
  { label: "Luganda", code: "lg" },
  { label: "Limburgish", code: "li" },
  { label: "lingála", code: "ln" },
  { label: "ລາວ", code: "lo" },
  { label: "lietuvių", code: "lt" },
  { label: "Tshiluba", code: "lu" },
  { label: "latviešu", code: "lv" },
  { label: "Malagasy", code: "mg" },
  { label: "Marshallese", code: "mh" },
  { label: "Māori", code: "mi" },
  { label: "македонски", code: "mk" },
  { label: "മലയാളം", code: "ml" },
  { label: "монгол", code: "mn" },
  { label: "मराठी", code: "mr" },
  { label: "Melayu", code: "ms" },
  { label: "Malti", code: "mt" },
  { label: "မြန်မာ", code: "my" },
  { label: "Nauru", code: "na" },
  { label: "Navajo", code: "nv" },
  { label: "South Ndebele", code: "nr" },
  { label: "isiNdebele", code: "nd" },
  { label: "Ndonga", code: "ng" },
  { label: "नेपाली", code: "ne" },
  { label: "norsk nynorsk", code: "nn" },
  { label: "norsk bokmål", code: "nb" },
  { label: "norsk", code: "no" },
  { label: "Nyanja", code: "ny" },
  { label: "occitan", code: "oc" },
  { label: "Ojibwa", code: "oj" },
  { label: "ଓଡ଼ିଆ", code: "or" },
  { label: "Oromoo", code: "om" },
  { label: "ирон", code: "os" },
  { label: "ਪੰਜਾਬੀ", code: "pa" },
  { label: "Pali", code: "pi" },
  { label: "polski", code: "pl" },
  { label: "پښتو", code: "ps" },
  { label: "Português", code: "pt" },
  { label: "Runasimi", code: "qu" },
  { label: "rumantsch", code: "rm" },
  { label: "Ikirundi", code: "rn" },
  { label: "română", code: "ro" },
  { label: "русский", code: "ru" },
  { label: "Ikinyarwanda", code: "rw" },
  { label: "संस्कृत भाषा", code: "sa" },
  { label: "sardu", code: "sc" },
  { label: "سنڌي", code: "sd" },
  { label: "davvisámegiella", code: "se" },
  { label: "Sängö", code: "sg" },
  { label: "සිංහල", code: "si" },
  { label: "slovenčina", code: "sk" },
  { label: "slovenščina", code: "sl" },
  { label: "Samoan", code: "sm" },
  { label: "chiShona", code: "sn" },
  { label: "Soomaali", code: "so" },
  { label: "shqip", code: "sq" },
  { label: "српски", code: "sr" },
  { label: "Swati", code: "ss" },
  { label: "Sesotho", code: "st" },
  { label: "Basa Sunda", code: "su" },
  { label: "Kiswahili", code: "sw" },
  { label: "svenska", code: "sv" },
  { label: "Tahitian", code: "ty" },
  { label: "தமிழ்", code: "ta" },
  { label: "татар", code: "tt" },
  { label: "తెలుగు", code: "te" },
  { label: "тоҷикӣ", code: "tg" },
  { label: "Filipino", code: "fil" },
  { label: "ไทย", code: "th" },
  { label: "ትግርኛ", code: "ti" },
  { label: "türkmen dili", code: "tk" },
  { label: "Setswana", code: "tn" },
  { label: "lea fakatonga", code: "to" },
  { label: "Türkçe", code: "tr" },
  { label: "Tsonga", code: "ts" },
  { label: "татар", code: "tt" },
  { label: "Tahitian", code: "ty" },
  { label: "ئۇيغۇرچە", code: "ug" },
  { label: "українська", code: "uk" },
  { label: "اردو", code: "ur" },
  { label: "o‘zbek", code: "uz" },
  { label: "Venda", code: "ve" },
  { label: "Tiếng Việt", code: "vi" },
  { label: "Volapük", code: "vo" },
  { label: "Walloon", code: "wa" },
  { label: "Wolof", code: "wo" },
  { label: "IsiXhosa", code: "xh" },
  { label: "ייִדיש", code: "yi" },
  { label: "Èdè Yorùbá", code: "yo" },
  { label: "Vahcuengh", code: "za" },
  { label: "中文", code: "zh" },
  { label: "isiZulu", code: "zu" },
]

/**
 * 言語コード重複を除いた表示用一覧。
 *
 * 処理の趣旨:
 * - 元データには同一コードが複数含まれるため、最初に出現した要素だけを残して UI の重複表示を防ぐ。
 */
const UNIQUE_BLUESKY_POST_LANGUAGES: LanguageOption[] =
  BLUESKY_POST_LANGUAGES.filter((option, index, list) => {
    return list.findIndex(item => item.code === option.code) === index
  })

/**
 * 言語1件を `Dropdown` の選択肢へ変換する。
 *
 * 処理の趣旨:
 * - 一覧用は国旗スロットを常に持ち、国旗なしでもラベルの左端を揃える。
 * - トリガー（入力欄）用の `inputText` は国旗がある言語のみ国旗を前置し、空き幅を出さない。
 * - 言語コードでも絞り込めるよう `searchText` に言語コードを指定する。
 */
const toDropdownOption = (language: LanguageOption): DropdownOption => {
  const flag = languageCodeToFlagEmoji(language.code)
  return {
    value: language.code,
    label: language.label,
    searchText: language.code,
    content: (
      <span className={styles["language-option"]}>
        <span className={styles.flag} aria-hidden="true">
          {flag ?? ""}
        </span>
        {language.label}
      </span>
    ),
    // 検索トリガー（入力欄）の現在値表示。国旗がある言語のみ国旗を前置し、空き幅を出さない
    inputText: flag ? `${flag} ${language.label}` : language.label,
  }
}

const LANGUAGE_DROPDOWN_OPTIONS: DropdownOption[] =
  UNIQUE_BLUESKY_POST_LANGUAGES.map(toDropdownOption)

type Props = {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  className?: string
  id?: string
  ariaLabel?: string
  /** true の場合、選択中の言語名に合わせて横幅を可変にする（既定は固定幅） */
  autoWidth?: boolean
}

/**
 * 投稿言語選択用プルダウンを描画する。
 *
 * Input:
 * - `value`: 現在選択中の言語コード
 * - `onChange`: 選択変更時に呼ぶコールバック
 * - `disabled`: 入力可否
 * - `className`/`id`/`ariaLabel`: 表示・属性制御
 * - `autoWidth`: 選択内容に応じて横幅を可変にするか
 *
 * Output:
 * - 言語候補を持つ `Dropdown`（絞り込み入力欄つき）
 *
 * 例:
 * - 入力: `{ value: "ja", onChange: fn }`
 * - 出力: 「🇯🇵 日本語」が選択された言語プルダウン
 */
export const Component: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
  className,
  id = "post-language",
  ariaLabel,
  autoWidth = false,
}) => {
  const { t } = useT()
  // Intl を使わない: ラベルはすでに自称（autonym）になっているのでそのまま表示する
  const widthClassName = autoWidth ? styles["select-auto"] : styles.select
  return (
    <Dropdown
      id={id}
      value={value}
      options={LANGUAGE_DROPDOWN_OPTIONS}
      onChange={onChange}
      disabled={disabled}
      searchable
      autoWidth={autoWidth}
      ariaLabel={ariaLabel ?? t("common.postLanguage")}
      className={className ? `${widthClassName} ${className}` : widthClassName}
    />
  )
}

export default Component
