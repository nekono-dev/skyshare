/**
 * 投稿先選択ダイアログ（X / タイッツー / Mastodon への intent 共有）。
 *
 * 責務と処理概要:
 * - 投稿本文・skyshare entry URL・リンクカードURLから、選択された投稿先ごとに
 *   intent テキストを組み立てる。
 * - X・タイッツー向けは、「長文を省略して共有」設定がONなら本文を省略する
 *   （Mastodon向けは省略しない）。設定はクリック時に localStorage から読む。
 * - skyshare entry を持たない投稿（画像を自分で添付・画像以外の投稿）でも開ける。
 *   その場合は URL を付けない。省略は設定に従う（「画像を自分で添付」ON時は設定自体がOFF）。
 * - 投稿先を選択すると intent ポップアップを開く。`keepOpenOnSelect` が偽の場合のみ、
 *   続けてダイアログを閉じる（投稿ボタンから開いた場合は、続けて別の投稿先を選べるよう
 *   閉じない）。「閉じる」・背景クリック・Escキーでは常に閉じる。
 * - Mastodonの投稿先インスタンスドメインは localStorage の保存値（未設定時は既定値）を使う。
 *   保存値が不正な形式の場合は、Mastodon項目を選択できなくする。
 */
import { useT } from "@/lib/i18n/react"
import ChoiceDialog from "@/components/common/ChoiceDialog"
import {
  readMastodonInstanceDomainSetting,
  readTruncateIntentTextSetting,
  resolveMastodonInstanceDomain,
} from "@/lib/settings/shareSettings"
import {
  buildIntentText,
  openIntentPopupFor,
  resolveTruncateLimit,
  type IntentTarget,
} from "@/util/share/intent"

export type IntentShareRequest = {
  /** intent テキストの元になる投稿本文 */
  postText: string
  /** 発行済み skyshare entry の URL（無ければ `null`） */
  entryUrl: string | null
  /** 投稿に添付されたリンクカードの元URL（無ければ空文字） */
  linkCardUrl: string
}

type Props = {
  /** 表示する共有対象。`null` の場合はダイアログを閉じる */
  request: IntentShareRequest | null
  /** true の場合、投稿先を選択してもダイアログを閉じない（既定 false） */
  keepOpenOnSelect?: boolean
  onClose: () => void
}

/**
 * 投稿先選択ダイアログを描画する。
 *
 * Input:
 * - `request`: 共有対象（本文・entry URL・リンクカードURL）。`null` なら非表示
 * - `keepOpenOnSelect`: true なら投稿先を選択してもダイアログを閉じない
 * - `onClose`: 「閉じる」選択時、背景クリック・Escキー押下時、および（`keepOpenOnSelect` が
 *   偽の場合）投稿先の選択後のコールバック
 *
 * Output:
 * - `request=null` の場合は何も描画しない
 * - それ以外は「X に投稿」「タイッツーに投稿」「Mastodonに投稿」「閉じる」の4択ダイアログ
 *
 * 例:
 * - 入力: `{ request: { postText: "hello", entryUrl: "https://...", linkCardUrl: "" } }`
 * - 出力: 投稿先選択ダイアログ
 */
const Component = ({ request, keepOpenOnSelect = false, onClose }: Props) => {
  const { t } = useT()
  // 保存値が不正な形式の場合のみ null になり、Mastodon項目を選択できなくする。
  const mastodonDomain = resolveMastodonInstanceDomain(
    readMastodonInstanceDomainSetting(""),
  )

  /**
   * 選択された投稿先の intent ポップアップを開く。
   *
   * 処理の趣旨:
   * - 省略設定はダイアログ表示後に変更され得るため、クリックの都度読み直す。
   *
   * Input:
   * - `target`: 共有先SNS
   * - `instanceDomain`: `target` が "mastodon" の場合の投稿先インスタンスドメイン
   */
  const share = (target: IntentTarget, instanceDomain?: string) => {
    if (!request) return
    const text = buildIntentText(
      request.postText,
      request.entryUrl ?? "",
      request.linkCardUrl,
      {
        truncateLimit: resolveTruncateLimit(
          target,
          readTruncateIntentTextSetting(false),
        ),
      },
    )
    openIntentPopupFor(target, text, { instanceDomain })
    if (!keepOpenOnSelect) {
      onClose()
    }
  }

  return (
    <ChoiceDialog
      open={request !== null}
      onClose={onClose}
      ariaLabel={t("post.shareDialog.aria")}
      buttons={[
        {
          key: "post-x",
          label: t("post.shareDialog.x"),
          variant: "black",
          onClick: () => share("x"),
        },
        {
          key: "post-taittsuu",
          label: t("post.shareDialog.taittsuu"),
          variant: "taittsuu",
          onClick: () => share("taittsuu"),
        },
        {
          key: "post-mastodon",
          label: t("post.shareDialog.mastodon"),
          variant: "mastodon",
          disabled: mastodonDomain === null,
          onClick: () => {
            if (mastodonDomain !== null) {
              share("mastodon", mastodonDomain)
            }
          },
        },
        {
          key: "close",
          label: t("common.close"),
          variant: "gray",
          onClick: onClose,
        },
      ]}
    />
  )
}

export default Component
