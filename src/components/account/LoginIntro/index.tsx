/**
 * ログインページ下部の、旧UIへの案内・ゲスト表示・v2の変更点を説明するカード。
 *
 * 責務と処理概要:
 * - リンクや強調を文中に含む文言を、辞書のスロット（`renderSlots`）で組み立てて表示する。
 * - 表示言語の切り替えに React の再描画で追従する（Astro の静的DOMではなく island にしている理由）。
 */
import { useT } from "@/lib/i18n/react"
import { renderSlots } from "@/lib/i18n/rich"
import type { PlainMessageKey } from "@/lib/i18n/translate"
import ui from "@/styles/ui.module.css"

/**
 * ログインページの案内カードを描画する。
 *
 * Output:
 * - 旧UIリンク・ゲスト表示リンク・v2の変更点を含むカード
 */
export const Component = () => {
  const { t, raw } = useT()
  const item = `${ui["list-item"]} ${ui["text-muted"]}`
  const bold = (key: PlainMessageKey) => <b>{t(key)}</b>

  return (
    <div
      className={`${ui["base-card"]} ${ui["base-padding"]}`}
      style={{ marginTop: "0.5rem" }}
    >
      <div
        style={{ margin: "0.5rem 0", fontWeight: 600 }}
        className={ui["subject"]}
      >
        {renderSlots(raw("page.login.oldUi"), {
          link: <a href="/legacy/">Skyshare v1.6.3</a>,
        })}
      </div>
      <div className={ui["text"]}>
        {renderSlots(raw("page.login.guest"), {
          link: <a href="/?guest=1">{t("page.login.guestLink")}</a>,
        })}
      </div>
      <div style={{ marginTop: "1rem" }}>{t("page.login.v2Notice")}</div>

      <h3>{t("page.login.persist.title")}</h3>
      <ul className={ui.list}>
        <li className={item}>{t("page.login.persist.item1")}</li>
        <li className={item}>
          {renderSlots(raw("page.login.persist.item2"), {
            bold: bold("page.login.persist.item2Bold"),
          })}
        </li>
      </ul>
      <h3>{t("page.login.thumb.title")}</h3>
      <ul className={ui.list}>
        <li className={item}>{t("page.login.thumb.item1")}</li>
        <li className={item}>
          {renderSlots(raw("page.login.thumb.item2"), {
            bold: bold("page.login.thumb.item2Bold"),
          })}
        </li>
        <li className={item}>{t("page.login.thumb.item3")}</li>
      </ul>
      <h3>{t("page.login.other.title")}</h3>
      <ul className={ui.list}>
        <li className={item}>{t("page.login.other.item1")}</li>
        <li className={item}>
          {renderSlots(raw("page.login.other.item2"), {
            hashtag: (
              <a href="https://bsky.app/intent/compose?text=%23Skyshare%20">
                #Skyshare
              </a>
            ),
          })}
        </li>
      </ul>
    </div>
  )
}

export default Component
