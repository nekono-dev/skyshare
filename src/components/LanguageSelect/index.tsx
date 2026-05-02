import React from "react"
import styles from "./index.module.css"
import ui from "@/styles/ui.module.css"

/**
 * 投稿言語選択コンポーネントで利用する言語定義と選択 UI。
 *
 * 責務と処理概要:
 * - Bluesky 投稿言語コード一覧を定数として提供する。
 * - 重複コードを除外した選択肢を `<select>` で描画する。
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

type Props = {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  className?: string
  id?: string
  name?: string
  ariaLabel?: string
}

/**
 * 投稿言語選択用 `<select>` を描画する。
 *
 * Input:
 * - `value`: 現在選択中の言語コード
 * - `onChange`: 選択変更時に呼ぶコールバック
 * - `disabled`: 入力可否
 * - `className`/`id`/`name`/`ariaLabel`: 表示・属性制御
 *
 * Output:
 * - 言語候補を持つ `<select>` 要素
 *
 * 例:
 * - 入力: `{ value: "ja", onChange: fn }`
 * - 出力: 日本語が選択された言語セレクト
 */
export const Component: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
  className,
  id = "post-language",
  name = "language",
  ariaLabel = "投稿言語",
}) => {
  // Intl を使わない: ラベルはすでに自称（autonym）になっているのでそのまま表示する
  // （以前は動的にIntlで取得していましたが、互換性のため静的ラベルに変更）

  const selectClassName = className
    ? `${ui.baseSelect} ${styles.select} ${className}`
    : `${ui.baseSelect} ${styles.select}`

  return (
    <span className={ui.selectWrapper}>
      <select
        id={id}
        name={name}
        className={selectClassName}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {UNIQUE_BLUESKY_POST_LANGUAGES.map(option => {
          const labelText = option.label
          return (
            <option key={option.code} value={option.code}>
              {labelText}
            </option>
          )
        })}
      </select>
    </span>
  )
}

export default Component
