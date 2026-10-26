/**
 * 他SNSへの共有文に使う本文とリンクカードのURLを決めるモジュール（`.kiro/specs/link-card-priority`）。
 *
 * 責務と処理概要:
 * - 「Skyshareのリンクカードを優先表示」がONで、共有文に skyshare entry のURLを含めるときだけ、
 *   本文のURL（link の facet の範囲）を取り除き、リンクカードのURLも補わないようにする。
 *   共有先のSNSでは skyshare entry のURLだけが残り、そのリンクカードが優先して表示される。
 * - それ以外は本文とリンクカードのURLをそのまま返す。
 */
import {
    filterLinkFacets,
    removeFacetRanges,
    type PostFacet,
} from "@/lib/atproto/richTextSegments"

export type ResolveShareBodyParams = {
    /** 投稿本文 */
    text: string
    /** 本文の facets（link 以外が混ざっていてもよい） */
    facets: PostFacet[]
    /** 共有文に含める skyshare entry のURL。含めない場合は `null` か空文字 */
    entryUrl: string | null
    /** 共有文の末尾に補うリンクカードのURL（無ければ空文字） */
    linkCardUrl: string
    /** 「Skyshareのリンクカードを優先表示」の実効値（画像を自分で添付がONなら false） */
    preferSkyshareLinkCard: boolean
}

/**
 * URLを取り除いた後の本文の空白を詰める。
 *
 * 処理の趣旨:
 * - URLの前後に残る行末の空白（全角空白を含む）を除き、3行以上の連続した改行を2行に詰める。
 *
 * Input:
 * - `text`: URLを取り除いた本文
 *
 * Output:
 * - 整形後の本文
 *
 * 例:
 * - 入力: `"見て \n\n\n\nおわり"`
 * - 出力: `"見て\n\nおわり"`
 */
const tidyRemovedText = (text: string): string =>
    text
        .replace(/[ \t　]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()

/**
 * 共有文に使う本文とリンクカードのURLを決める。
 *
 * Input:
 * - `params`: 本文・facets・entry のURL・リンクカードのURL・設定の実効値
 *
 * Output:
 * - `{ text, linkCardUrl }`。URLを取り除いた場合は `linkCardUrl` を空文字にする
 *
 * 例:
 * - 入力: `{ text: "見て https://a.example", facets: [link 5-22], entryUrl: "https://skyshare.example/e", linkCardUrl: "https://a.example", preferSkyshareLinkCard: true }`
 * - 出力: `{ text: "見て", linkCardUrl: "" }`
 */
export const resolveShareBody = ({
    text,
    facets,
    entryUrl,
    linkCardUrl,
    preferSkyshareLinkCard,
}: ResolveShareBodyParams): { text: string; linkCardUrl: string } => {
    const linkFacets = filterLinkFacets(facets)
    if (!preferSkyshareLinkCard || !entryUrl || linkFacets.length === 0) {
        return { text, linkCardUrl }
    }
    return {
        text: tidyRemovedText(removeFacetRanges(text, linkFacets)),
        linkCardUrl: "",
    }
}
