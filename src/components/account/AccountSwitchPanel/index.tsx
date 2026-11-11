/**
 * アカウント切り替えと追加・再ログインの画面を組み立てる。
 *
 * - 同じ DID の再ログインは既存セッションを更新し、別 DID のログインは現在のアカウントをプールへ移す。
 */
import { useT } from "@/components/i18n/useTranslation"
import { useState } from "react"
import AccountSwitcher, {
  type AccountItem,
} from "@/components/account/AccountSwitchPanel/AccountSwitcher"
import LoginForm from "@/components/account/LoginForm"
import ui from "@/styles/ui.module.css"

/**
 * アカウント切り替え画面本体を描画する。
 *
 * Output:
 * - `AccountSwitcher` と、通常/再ログイン兼用の `LoginForm` を含む JSX
 *
 * 例:
 * - 切り替え成功: `LoginForm` を経由せずページ遷移
 * - 切り替え先が失効: 見出しが「@handle に再ログイン」に変わり、`LoginForm` の
 *   handle 欄に対象アカウントの handle が事前入力される
 */
export const Component = () => {
  const { t } = useT()
  const [reauthTarget, setReauthTarget] = useState<AccountItem | null>(null)

  return (
    <>
      <AccountSwitcher onReauthRequired={setReauthTarget} />

      <h2 className={ui.subject} style={{ marginTop: "2rem" }}>
        {reauthTarget
          ? t("account.panel.reauthTitle", { handle: reauthTarget.handle })
          : t("account.panel.addTitle")}
      </h2>
      {reauthTarget ? (
        <p className={ui.text}>
          {t("account.panel.reauthHint")}{" "}
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]}`}
            onClick={() => setReauthTarget(null)}
          >
            {t("common.cancel")}
          </button>
        </p>
      ) : null}
      <LoginForm
        key={reauthTarget?.did ?? "add-account"}
        initialHandle={reauthTarget?.handle}
      />
    </>
  )
}
export default Component
