/**
 * ヘルプページに表示するFAQ/案内記事の静的データ。
 *
 * 責務と処理概要:
 * - 記事は外部データソースを持たず、`buildHelpEntries` に直接追記して管理する。
 * - 文言は辞書（`lib/i18n/messages`）にあり、表示言語の翻訳関数を受け取って記事を組み立てる。
 * - `description`/`content` は文字列だけでなくJSX(画像・リスト等)も許容し、
 *   コンポーネントをそのまま埋め込める形にしている。
 */
import type { ReactNode } from "react"
import type { Translator } from "@/lib/i18n/translate"
import ui from "@/styles/ui.module.css"

/**
 * ヘルプ記事1件分のデータ形状。
 *
 * 想定する入力形状:
 * - `id`: 記事を一意に識別するキー(表示順の変更に影響されない固定値)
 * - `title`: カードの見出し
 * - `description`: 見出し直下に表示する本文
 * - `content`: 本文の下に追加で表示する任意コンテンツ(手順リスト・画像等)
 */
export type HelpEntry = {
  id: string
  title: string
  description: ReactNode
  content?: ReactNode
}

/**
 * 表示言語に合わせたヘルプ記事一覧を組み立てる。
 *
 * Input:
 * - `t`: 表示言語の翻訳関数
 *
 * Output:
 * - 表示順に並んだ `HelpEntry` の配列
 *
 * 例:
 * - 入力: `createTranslator("en").t`
 * - 出力: 英語の文言を持つ記事の配列
 */
export const buildHelpEntries = (t: Translator["t"]): HelpEntry[] => [
  {
    id: "android-media-permission",
    title: t("page.help.androidMedia.title"),
    description: t("page.help.androidMedia.description"),
    content: (
      <div className={ui["text-muted"]}>
        {t("page.help.androidMedia.intro")}
        <ul className={ui.list}>
          <li className={`${ui["list-item"]}`}>
            {t("page.help.androidMedia.step1")}
          </li>
          <li className={`${ui["list-item"]}`}>
            {t("page.help.androidMedia.step2")}
          </li>
          <li className={`${ui["list-item"]}`}>
            {t("page.help.androidMedia.step3")}
          </li>
        </ul>
        {t("page.help.androidMedia.outro")}
      </div>
    ),
  },
]
