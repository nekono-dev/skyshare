/**
 * 文中にReact要素（アイコン等）を差し込む文言の描画ヘルパー。
 *
 * 責務と処理概要:
 * - 辞書の値に含まれる `{name}` を、`slots[name]` のReact要素へ置き換えて返す。
 * - 要素の位置を文言側で決められるため、日本語と英語で語順が違っても（例:
 *   「{share}の代わりに…」と「Open a popup instead of {share}」）同じコードで描画できる。
 */
import { Fragment, type ReactNode } from "react"

/**
 * `{name}` をスロットの要素へ置き換えた ReactNode を返す。
 *
 * 処理の趣旨:
 * - `slots` に無い名前は、`{name}` の文字列のまま残す。
 *
 * Input:
 * - `template`: `translator.raw(key)` が返す、プレースホルダ未置換の文言
 * - `slots`: プレースホルダ名 → 差し込む要素
 *
 * Output:
 * - テキストと要素が交互に並んだ ReactNode
 *
 * 例:
 * - 入力: `("{share}にクロスポスト", { share: <InlineIcon name="share" /> })`
 * - 出力: アイコン要素 + 「にクロスポスト」
 */
export const renderSlots = (
  template: string,
  slots: Record<string, ReactNode>,
): ReactNode => {
  const parts = template.split(/(\{\w+\})/g)
  return parts.map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1]
    const node = name !== undefined && name in slots ? slots[name] : part
    return <Fragment key={index}>{node}</Fragment>
  })
}
