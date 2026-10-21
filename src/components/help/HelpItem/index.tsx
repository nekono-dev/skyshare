/**
 * ヘルプ記事1件分の表示コンポーネント。
 *
 * 責務と処理概要:
 * - `HelpEntry` 1件を、設定ページ(`Settings`)と同じカード見た目(base-card/base-padding)で描画する。
 * - `ComponentList` の `itemComponent` として利用される想定。
 */
import type { HelpEntry } from "@/components/help/helpEntries"
import ui from "@/styles/ui.module.css"

/**
 * ヘルプ記事1件をカード形式で描画する。
 *
 * Input:
 * - `item`: 表示対象の `HelpEntry`
 *
 * Output:
 * - タイトル・本文・任意コンテンツを含むカード
 *
 * 例:
 * - 入力: `{ title: "...", description: "...", content: <ul>...</ul> }`
 * - 出力: 見出し・本文・手順リストを含むカードのJSX
 */
export const HelpItem = ({ item }: { item: HelpEntry }) => (
  <section className={`${ui["base-card"]} ${ui["base-padding"]}`}>
    <h2 className={ui.subject}>{item.title}</h2>
    <p className={ui.text}>{item.description}</p>
    {item.content}
  </section>
)

export default HelpItem
