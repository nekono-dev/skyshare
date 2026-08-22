/**
 * アカウント切り替え画面のオーケストレーター。
 *
 * 責務と処理概要:
 * - `AccountSwitcher`（一覧・切り替え・ログアウト）と `LoginForm`（ログイン）を束ね、
 *   「どのアカウントの再ログインが必要か」を親で一元管理する。
 * - `AccountSwitcher` はセッション切れを検知しても `/login` へは遷移しない。代わりに
 *   `onReauthRequired` でこのコンポーネントへ通知し、このコンポーネントが下部の
 *   `LoginForm` を再ログイン用に差し替える（handle 事前入力・見出し切り替え）。
 * - 通常のログイン（別アカウント追加）と再ログインは同じ `LoginForm` を使い回す。
 *   `POST /v2/bsky/session` は同一 did への再ログインをプール退避せず上書きし、
 *   別 did なら現在のアクティブをプールへ退避するため、追加ログインと再ログインの
 *   両方でそのまま正しい結果になる。
 */
import { useState } from "react"
import AccountSwitcher, {
  type AccountItem,
} from "@/components/account/AccountSwitcher"
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
  const [reauthTarget, setReauthTarget] = useState<AccountItem | null>(null)

  return (
    <>
      <AccountSwitcher onReauthRequired={setReauthTarget} />

      <h2 className={ui.subject} style={{ marginTop: "2rem" }}>
        {reauthTarget
          ? `@${reauthTarget.handle} に再ログイン`
          : "別のアカウントを追加"}
      </h2>
      {reauthTarget ? (
        <p className={ui.text}>
          セッションが切れています。パスワードを再入力してください。{" "}
          <button
            type="button"
            className={`${ui["base-button"]} ${ui["text-button"]} ${ui["gray-button"]}`}
            onClick={() => setReauthTarget(null)}
          >
            キャンセル
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
