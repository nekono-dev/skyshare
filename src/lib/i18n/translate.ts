/**
 * 翻訳関数（`t`/`tn`）と辞書まわりの型。
 *
 * 責務と処理概要:
 * - 日本語辞書を基準に `MessageKey` と、各文言のプレースホルダ名から導出した
 *   パラメータ型 `MessageParams` を提供する。存在しないキー・不足したパラメータは型エラーになる。
 * - `createTranslator(locale)` は呼び出しごとに新しいオブジェクトを返すだけで、
 *   モジュールレベルの可変状態を持たない（Cloudflare Workers でリクエスト間の状態混在を避ける）。
 * - 複数形は `base_one`/`base_other` の規約で、`Intl.PluralRules` が選んだカテゴリのキーを引く。
 */
import type { Locale } from "./locale"
import { en } from "./messages/en"
import { ja } from "./messages/ja"

type JaMessages = typeof ja

export type MessageKey = keyof JaMessages

/** 辞書1件の形（辞書ファイルの `satisfies` 用）。 */
export type MessageEntries = Record<string, string>

/** 文字列テンプレートから `{name}` のプレースホルダ名を取り出す。 */
type ParamNames<S extends string> = S extends `${string}{${infer P}}${infer R}`
    ? P | ParamNames<R>
    : never

type ParamValues = string | number

/** キー `K` の文言が要求するパラメータ型。プレースホルダが無ければ `undefined`。 */
export type MessageParams<K extends MessageKey> = [
    ParamNames<JaMessages[K]>,
] extends [never]
    ? undefined
    : { [P in ParamNames<JaMessages[K]>]: ParamValues }

type ParamsArg<K extends MessageKey> = [ParamNames<JaMessages[K]>] extends [
    never,
]
    ? []
    : [params: MessageParams<K>]

/**
 * プレースホルダを持たないキーの型。キーを変数・定数配列で持ち回して `t(key)` へ渡す場合は、
 * `MessageKey` ではなくこの型で持つ（`MessageKey` の合併型のままだとパラメータ必須と判定される）。
 */
export type PlainMessageKey = {
    [K in MessageKey]: [ParamNames<JaMessages[K]>] extends [never] ? K : never
}[MessageKey]

/** `_other` で終わるキーから `_other` を除いた、複数形文言の基底名。 */
export type PluralBase = {
    [K in MessageKey]: K extends `${infer B}_other` ? B : never
}[MessageKey]

/** 複数形文言 `B` が `count` 以外に要求するパラメータ。 */
type PluralExtraParams<B extends PluralBase> = [
    Exclude<ParamNames<JaMessages[`${B}_other`]>, "count">,
] extends [never]
    ? []
    : [
          params: {
              [
                  P in Exclude<ParamNames<JaMessages[`${B}_other`]>, "count">
              ]: ParamValues
          },
      ]

/** 英語辞書の型。日本語と同一キー集合に加え、複数形の `_one` を必須とする。 */
export type EnglishMessages = Record<MessageKey, string> &
    Record<`${PluralBase}_one`, string>

const dictionaries: Record<Locale, Record<string, string>> = { ja, en }

const intlLocale = (locale: Locale): string =>
    locale === "ja" ? "ja-JP" : "en-US"

/**
 * テンプレート内の `{name}` を `params[name]` で置換する。
 *
 * 処理の趣旨:
 * - `params` に無い名前のプレースホルダはそのまま残す（欠落を画面上で気づけるようにする）。
 *
 * Input:
 * - `template`: 辞書の値
 * - `params`: 置換値。省略可
 *
 * Output:
 * - 置換後の文字列
 *
 * 例:
 * - 入力: `("{count}件", { count: 3 })` → 出力: `"3件"`
 */
export const interpolate = (
    template: string,
    params?: Record<string, ParamValues>,
): string => {
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
        return name in params ? String(params[name]) : match
    })
}

/**
 * 指定言語の翻訳関数 `t`/`tn` を作る。
 *
 * Input:
 * - `locale`: 表示言語
 *
 * Output:
 * - `t(key, params?)`: 通常の文言取得
 * - `tn(base, count, params?)`: 件数に応じた単数・複数の文言取得（`count` も置換される）
 * - `raw(key)`: プレースホルダ未置換の辞書値（`renderSlots` 用）
 * - `locale`: 作成時の言語
 *
 * 失敗時の方針:
 * - 辞書に無いキーは、キー文字列をそのまま返す（型検査をすり抜けた場合の保険）。
 *
 * 例:
 * - 入力: `createTranslator("en").tn("common.itemCount", 1)` → 出力: `"1 item"`
 * - 入力: `createTranslator("ja").tn("common.itemCount", 5)` → 出力: `"5件"`
 */
export const createTranslator = (locale: Locale) => {
    const dict = dictionaries[locale]
    const plural = new Intl.PluralRules(intlLocale(locale))

    const t = <K extends MessageKey>(key: K, ...args: ParamsArg<K>): string => {
        const params = args[0] as Record<string, ParamValues> | undefined
        return interpolate(dict[key] ?? key, params)
    }

    const tn = <B extends PluralBase>(
        base: B,
        count: number,
        ...args: PluralExtraParams<B>
    ): string => {
        const extra = args[0] as Record<string, ParamValues> | undefined
        const category = plural.select(count)
        const template =
            dict[`${base}_${category}`] ?? dict[`${base}_other`] ?? base
        return interpolate(template, { ...extra, count })
    }

    // プレースホルダを置換せず、辞書の値をそのまま返す。文中にReact要素を差し込む文言
    // （`renderSlots`）の入力に使う。スロット名の過不足は型では検査されない。
    const raw = (key: MessageKey): string => dict[key] ?? key

    return { t, tn, raw, locale }
}

export type Translator = ReturnType<typeof createTranslator>

/**
 * 言語が決まってから文言を組み立てる関数。
 * 処理結果のメッセージを state に保持する際、文字列ではなくこの関数を保持し、
 * 描画時に現在の翻訳関数で評価する（表示後の言語切り替えに追従させるため）。
 *
 * 例:
 * - `const status: MessageFormatter = tr => tr.t("post.composer.draftApplied")`
 */
export type MessageFormatter = (translator: Translator) => string

/**
 * 表示言語が決まってから評価する、state 保持用のメッセージ。
 * 関数をそのまま `useState` に渡すと更新関数として実行されてしまうため、
 * オブジェクトで包んで保持する。
 */
export type DeferredMessage = { format: MessageFormatter }

/**
 * プレースホルダを持たない文言キーから、保持用メッセージを作る。
 *
 * Input:
 * - `key`: 文言キー
 *
 * Output:
 * - 描画時に現在の表示言語で `key` を翻訳する `DeferredMessage`
 *
 * 例:
 * - 入力: `"post.composer.draftApplied"` → 出力: `{ format }`（日本語なら「下書きを反映しました。」）
 */
export const deferMessage = (key: PlainMessageKey): DeferredMessage => ({
    format: translator => translator.t(key),
})
