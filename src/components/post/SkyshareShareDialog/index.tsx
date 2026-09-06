/**
 * skyshare entry 発行後に表示する共有ダイアログ。
 *
 * 責務と処理概要:
 * - 発行済みの skyshare entry URL と Bluesky 投稿本文から intent テキストを組み立てる。
 * - 「X に投稿」「タイッツーに投稿」「Mastodonに投稿」選択時は、対象SNSの
 *   intent ポップアップを開いてダイアログを閉じる。
 * - Mastodonの投稿先インスタンスドメインは localStorage の保存値（未設定時は既定値）を使う。
 */
import ChoiceDialog from "@/components/common/ChoiceDialog"
import {
  DEFAULT_MASTODON_INSTANCE_DOMAIN,
  readMastodonInstanceDomainSetting,
} from "@/lib/settings/shareSettings"
import { buildIntentText, openIntentPopupFor } from "@/util/share/intent"

type Props = {
  open: boolean
  postText: string
  entryUrl: string | null
  onClose: () => void
}

/**
 * skyshare 共有ダイアログを描画する。
 *
 * Input:
 * - `open`: ダイアログの表示状態
 * - `postText`: intent テキストの元になる投稿本文
 * - `entryUrl`: 発行済み skyshare entry の URL（未発行時は `null`）
 * - `onClose`: 「閉じる」選択時、および背景クリック時のコールバック
 *
 * Output:
 * - `open=false` の場合は何も描画しない
 * - `open=true` の場合、「X に投稿」「タイッツーに投稿」「Mastodonに投稿」「閉じる」の4択ダイアログ
 *
 * 例:
 * - 入力: `{ open: true, postText: "hello", entryUrl: "https://..." }`
 * - 出力: 「skyshareページを作成しました。」ダイアログ
 */
const Component = ({ open, postText, entryUrl, onClose }: Props) => {
  return (
    <ChoiceDialog
      open={open}
      onClose={onClose}
      ariaLabel="skyshareページを共有"
      buttons={[
        {
          key: "post-x",
          label: "X に投稿",
          variant: "black",
          onClick: () => {
            if (!entryUrl) return
            openIntentPopupFor("x", buildIntentText(postText, entryUrl))
            onClose()
          },
        },
        {
          key: "post-taittsuu",
          label: "タイッツーに投稿",
          variant: "taittsuu",
          onClick: () => {
            if (!entryUrl) return
            openIntentPopupFor("taittsuu", buildIntentText(postText, entryUrl))
            onClose()
          },
        },
        {
          key: "post-mastodon",
          label: "Mastodonに投稿",
          variant: "mastodon",
          onClick: () => {
            if (!entryUrl) return
            const instanceDomain = readMastodonInstanceDomainSetting(
              DEFAULT_MASTODON_INSTANCE_DOMAIN,
            )
            openIntentPopupFor(
              "mastodon",
              buildIntentText(postText, entryUrl),
              { instanceDomain },
            )
            onClose()
          },
        },
        {
          key: "close",
          label: "閉じる",
          variant: "gray",
          onClick: onClose,
        },
      ]}
    />
  )
}

export default Component
