/**
 * ヘルプページ本体コンポーネント。
 *
 * 責務と処理概要:
 * - `buildHelpEntries` が表示言語で組み立てた記事リストを `ComponentList` で縦に並べて表示する。
 * - 記事の追加・編集は `helpEntries.tsx` の `buildHelpEntries` と辞書を変更するだけで完結する。
 */
import ComponentList from "@/components/common/list/ComponentList"
import { buildHelpEntries } from "./helpEntries"
import { HelpItem } from "@/components/help/Help/HelpItem"
import { useT } from "@/components/i18n/useTranslation"
import styles from "./index.module.css"

/**
 * ヘルプ記事一覧を描画する。
 *
 * Output:
 * - 記事の件数分のヘルプカード
 */
export const Help = () => {
  const { t } = useT()
  return (
    <ComponentList
      items={buildHelpEntries(t)}
      itemComponent={HelpItem}
      getItemKey={item => item.id}
      className={styles.groups}
    />
  )
}

export default Help
