/**
 * 辞書のキーと、英語辞書の型。
 *
 * 責務と処理概要:
 * - 日本語辞書を基準に `MessageKey` を定める。プレースホルダ名（`ParamNames`）と複数形の基底名（`PluralBase`）を、文言の型から導く。
 * - 英語辞書の型（`EnglishMessages`）は、日本語と同じキー集合と、複数形の `_one` を必須とする。
 *
 * 実装上の制約:
 * - 日本語辞書の型を `typeof ja` でだけ参照する（値を読まない）。翻訳の実行（`translate.ts`）はここを参照するが、ここは翻訳の実行を参照しない。
 *   これにより、翻訳の実行 → 英語辞書 → ここ → 日本語辞書 の一方向になり、循環しない。
 */
import type { ja } from "./messages/ja"

type JaMessages = typeof ja

export type MessageKey = keyof JaMessages

/** 文字列テンプレートから `{name}` のプレースホルダ名を取り出す。 */
export type ParamNames<S extends string> =
    S extends `${string}{${infer P}}${infer R}` ? P | ParamNames<R> : never

/**
 * プレースホルダを持たない文言キーの型。キーを変数・定数配列で持ち回して `t(key)` へ渡す場合は、
 * `MessageKey` ではなくこの型で持つ（`MessageKey` の合併型のままだとパラメータ必須と判定される）。
 */
export type PlainMessageKey = {
    [K in MessageKey]: [ParamNames<JaMessages[K]>] extends [never] ? K : never
}[MessageKey]

/** `_other` で終わるキーから `_other` を除いた、複数形文言の基底名。 */
export type PluralBase = {
    [K in MessageKey]: K extends `${infer B}_other` ? B : never
}[MessageKey]

/** 英語辞書の型。日本語と同一キー集合に加え、複数形の `_one` を必須とする。 */
export type EnglishMessages = Record<MessageKey, string> &
    Record<`${PluralBase}_one`, string>
