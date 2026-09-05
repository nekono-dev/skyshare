/**
 * ヘルプページ本体コンポーネント。
 *
 * 責務と処理概要:
 * - `helpEntries` の静的リストを `ComponentList` で縦に並べて表示する。
 * - 記事の追加・編集は `helpEntries.tsx` の配列を変更するだけで完結する。
 */
import ComponentList from "@/components/common/ComponentList"
import { helpEntries } from "@/components/help/helpEntries"
import { HelpItem } from "@/components/help/HelpItem"
import styles from "./index.module.css"

/**
 * ヘルプ記事一覧を描画する。
 *
 * Output:
 * - `helpEntries` の件数分のヘルプカード
 */
export const Help = () => (
  <ComponentList
    items={helpEntries}
    itemComponent={HelpItem}
    getItemKey={item => item.id}
    className={styles.groups}
  />
)

export default Help
