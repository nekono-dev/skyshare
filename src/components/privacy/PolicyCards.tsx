/**
 * プライバシーポリシー本体コンポーネント。
 *
 * 責務と処理概要:
 * - `buildPrivacyPolicy` が表示言語で組み立てた節を、設定ページと同じカード（base-card/base-padding）で縦に並べる。
 * - 節の本文は段落・箇条書き・表のいずれかで描画する。文言は持たず、辞書から得た値だけを表示する。
 */
import {
  buildPrivacyPolicy,
  type PolicyBlock,
} from "@/lib/privacy/policySections"
import { useT } from "@/lib/i18n/react"
import ui from "@/styles/ui.module.css"
import styles from "./PolicyCards.module.css"

/** 節の本文1ブロックを、種別に応じた要素で描画する。 */
const Block = ({ block }: { block: PolicyBlock }) => {
  if (block.kind === "text") return <p className={ui.text}>{block.text}</p>
  if (block.kind === "list")
    return (
      <ul className={styles.list}>
        {block.items.map(item => (
          <li key={item} className={ui.text}>
            {item}
          </li>
        ))}
      </ul>
    )
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {block.head.map(h => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map(row => (
            <tr key={row[0]}>
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={cell} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={cell}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
