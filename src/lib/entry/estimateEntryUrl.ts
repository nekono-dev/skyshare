/**
 * 投稿前に Skyshare Entry URL を組み立て、文字数を見積もる。
 *
 * - rkey は TID と同じ長さの疑似値を使い、DID は投稿者の実 DID を使う。
 * - URL のパスとドメインは `skyshareEntryUrlgen` から得る。
 */
import { TID } from "@atproto/common-web"
import { skyshareEntryUrlgen } from "@/lib/entry/url"

/** DID が未取得（ゲスト表示等）の場合に使う、did:plc 形式の見積り用 DID。 */
const FALLBACK_DID = `did:plc:${"a".repeat(24)}`

/**
 * 予測用の疑似 rkey を返す。長さは実際の TID と同一（`TID.nextStr()` から導出）。
 *
 * Output:
 * - TID と同じ長さの文字列
 */
const dummyRkey = (): string => "a".repeat(TID.nextStr().length)

/**
 * 投稿前に、作成される skyshare entry の URL を予測する。
 *
 * Input:
 * - `did`: 投稿者の DID（未取得なら `null` / `undefined`。did:plc 相当の長さで見積もる）
 *
 * Output:
 * - 実際に作られる URL と同じ長さの予測 URL（rkey 部分のみ疑似値）
 *
 * 例:
 * - 入力: `"did:plc:abcdefghijklmnopqrstuvwx"`
 * - 出力: `"https://skyshare.example/entries/did:plc:abcdefghijklmnopqrstuvwx@aaaaaaaaaaaaa/"`
 */
export const estimateSkyshareEntryUrl = (
    did: string | null | undefined,
): string => skyshareEntryUrlgen(did || FALLBACK_DID, dummyRkey())
