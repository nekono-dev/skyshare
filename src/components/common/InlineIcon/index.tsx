/**
 * InlineIcon コンポーネント。
 *
 * 責務と処理概要:
 * - ラベルや説明文などの文章中に、単語の代わりとしてアイコン画像をインライン表示する。
 * - 周囲のテキストと縦位置が揃うよう、CSS側でベースラインに合わせて配置する。
 * - 表示可能なアイコンの画像アセットは本コンポーネントが一元管理し、呼び出し側は
 *   `InlineIconName` で選択するのみとする（呼び出し側で画像をimportする必要がない）。
 */
import crosspostIcon from "@/images/crosspost.svg"
import hashtagIcon from "@/images/hashtag.svg"
import mastodonIcon from "@/images/mastodon.svg"
import shareIcon from "@/images/share.svg"
import taittsuuIcon from "@/images/taittsuu.png"
import styles from "./index.module.css"

/** InlineIconで表示できるアイコンの種類 */
export type InlineIconName =
  "share" | "popup" | "taittsuu" | "mastodon" | "hashtag"

const icons: Record<InlineIconName, ImageMetadata> = {
  share: shareIcon,
  popup: crosspostIcon,
  taittsuu: taittsuuIcon,
  mastodon: mastodonIcon,
  hashtag: hashtagIcon,
}

type Props = {
  /** 表示するアイコンの種類 */
  name: InlineIconName
  /** 代替テキスト（装飾目的の場合は空文字のまま） */
  alt?: string
}

export const InlineIcon = ({ name, alt = "" }: Props) => (
  <img
    src={icons[name].src}
    width={18}
    height={18}
    alt={alt}
    className={styles.icon}
  />
)

export default InlineIcon
