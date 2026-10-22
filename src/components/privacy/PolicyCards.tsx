/**
 * プライバシーポリシー本体コンポーネント。
 *
 * 責務と処理概要:
 * - `buildPrivacyPolicy` が表示言語で組み立てた節を、設定ページと同じカード（base-card/base-padding）で縦に並べる。
 * - 節の本文は段落か箇条書き（1階層）で描画する。項目名つきの値は「項目名: 値」とし、
 *   リンク先があれば値をリンクにする。文言は持たず、辞書と設定から得た値だけを表示する。
 */
import {
  buildPrivacyPolicy,
  type PolicyBlock,
  type PolicyItem,
} from "@/lib/privacy/policySections"
import { useT } from "@/lib/i18n/react"
import ui from "@/styles/ui.module.css"
import styles from "./PolicyCards.module.css"

/** 箇条書きの1項目を描画する。項目名つきの値は、リンク先があればリンクにする。 */
const Item = ({ item }: { item: PolicyItem }) => {
  if (typeof item === "string") return <>{item}</>
  return (
    <>
      {item.label}:{" "}
      {item.href ? (
        <a href={item.href} target="_blank" rel="noreferrer">
          {item.value}
        </a>
      ) : (
        item.value
      )}
    </>
  )
}

/** 項目の key（文はそのまま、項目名つきの値は項目名） */
const itemKey = (item: PolicyItem) =>
  typeof item === "string" ? item : item.label

/** 節の本文1ブロックを、種別に応じた要素で描画する。 */
const Block = ({ block }: { block: PolicyBlock }) => {
  if (block.kind === "text") return <p className={ui.text}>{block.text}</p>
  return (
    <ul className={ui.list}>
      {block.items.map(item => (
        <li key={itemKey(item)} className={ui["list-item"]}>
          <Item item={item} />
        </li>
      ))}
    </ul>
  )
}

/**
 * プライバシーポリシーの全節をカードとして並べて描画する。
 *
 * Output:
 * - 節の数だけ、見出しと本文を持つカード
 */
export const PolicyCards = () => {
  const { t } = useT()
  return (
    <div className={styles.groups}>
      {buildPrivacyPolicy(t).map(section => (
        <section
          key={section.id}
          id={section.id}
          className={`${ui["base-card"]} ${ui["base-padding"]}`}
        >
          <h2 className={ui.subject}>{section.title}</h2>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}
    </div>
  )
}

export default PolicyCards
