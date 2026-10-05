/**
 * 投稿フォームの文字数カウンタに対する、共有文末尾（URL）分の上限補正を求める。
 *
 * 責務と処理概要:
 * - 共有文の末尾に付く skyshare entry URL・本文に無いリンクカードURL（直前の改行を含む）が
 *   宛先SNSで何文字ぶんに換算されるかを求め、カウンタ単位で返す。
 * - 自動ポップアップ先の設定から、表示すべきカウンタ（X / タイッツー）を決める。
 */
import type { AutoPopupTarget } from "@/lib/settings/shareSettings"
import { buildIntentSuffix } from "@/util/share/intent"
import { resolveIntentMeasure } from "@/util/share/intentLength"

/** 字数カウンタを持つ共有先 */
export type CounterTarget = "x" | "taittsuu"

/**
 * 表示すべき共有先カウンタを決める。
 *
 * 処理の趣旨:
 * - WebShareAPI利用時は共有先を特定できないため、従来どおりXのみとする。
 * - ポップアップ利用時は自動ポップアップ先に従う。Mastodonは字数制限が緩いため無し、
 *   「投稿時に選択する」はXとタイッツーの両方を出す。
 *
 * Input:
 * - `autoPopupTarget`: 自動ポップアップするSNS
 * - `popupIntentInsteadOfWebshare`: WebShareの代わりにポップアップを開く設定
 *
 * Output:
 * - 表示する共有先（表示順）
 *
 * 例:
 * - 入力: `"ask"`, `true`
 * - 出力: `["x", "taittsuu"]`
 */
export const resolveCounterTargets = (
    autoPopupTarget: AutoPopupTarget,
    popupIntentInsteadOfWebshare: boolean,
): CounterTarget[] => {
    if (!popupIntentInsteadOfWebshare) return ["x"]
    switch (autoPopupTarget) {
        case "x":
            return ["x"]
        case "taittsuu":
            return ["taittsuu"]
        case "mastodon":
            return []
        case "ask":
            return ["x", "taittsuu"]
    }
}

/**
 * カウンタの上限から差し引く量（カウンタ単位）を求める。
 *
 * 処理の趣旨:
 * - 実際の共有文と同じ組み立て（`buildIntentSuffix`）・同じ換算（宛先別）で、
 *   「改行 + 末尾文字列」の長さを測り、半角単位÷2（切り上げ）のカウンタ単位へ直す。
 *
 * Input:
 * - `params.target`: 共有先
 * - `params.body`: 本文（リンクカードURLが本文に含まれるかの判定に使う）
 * - `params.entryUrl`: 予測した skyshare entry URL（entry が作られない場合は `null`）
 * - `params.linkCardUrl`: リンクカードの元URL（無ければ空文字）
 *
 * Output:
 * - 差し引く量。末尾文字列が無ければ 0
 *
 * 例:
 * - 入力: `{ target: "x", body: "本文", entryUrl: "https://…", linkCardUrl: "" }`
 * - 出力: `12`（改行1 + URL23 = 24 → 24/2）
 */
export const resolveCounterReserve = (params: {
    target: CounterTarget
    body: string
    entryUrl: string | null
    linkCardUrl: string
}): number => {
    const { target, body, entryUrl, linkCardUrl } = params
    const suffix = buildIntentSuffix(body.trim(), entryUrl ?? "", linkCardUrl)
    if (suffix.length === 0) return 0
    return Math.ceil(resolveIntentMeasure(target)(`\n${suffix}`) / 2)
}
