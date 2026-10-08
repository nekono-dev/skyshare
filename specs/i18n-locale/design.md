# 表示言語の判定と切り替え 設計書

## 1. 構成

| パス                                           | 責務                               |
| ---------------------------------------------- | ---------------------------------- |
| `src/lib/i18n/locale.ts`                       | 言語の型と判定、受け入れ言語の解析 |
| `src/lib/i18n/localeSetting.ts`                | 言語設定の保存                     |
| `src/lib/i18n/store.ts`                        | クライアントの表示言語ストア       |
| `src/lib/i18n/react.ts`                        | 表示言語のReactフック              |
| `src/lib/i18n/applyDom.ts`                     | 静的DOMの文言・タイトルの書き換え  |
| `src/lib/i18n/middleware.ts`                   | リクエストごとの表示言語の決定     |
| `src/middleware.ts`                            | ミドルウェアの合成                 |
| `src/layout/Baselayout.astro`                  | 言語属性と初期化スクリプト         |
| `src/components/common/LocaleSelect/index.tsx` | 表示言語の選択欄                   |

## 2. 設計項目

### D-1: 言語の判定と保存 (FR-1, FR-2, FR-3, FR-4)

```ts
export const LOCALES = ["ja", "en"] as const
export type Locale = (typeof LOCALES)[number]
export type LocaleSetting = Locale | "system"
export const DEFAULT_LOCALE: Locale = "ja"
// "en-US,en;q=0.9" → q 降順の言語配列。q=0 と * は除外し、解釈できない q は1とする
export const parseAcceptLanguage = (header: string | null): string[]
// 主言語タグ（"en-US" → "en"）で照合し、最初に一致した対応言語
export const pickLocaleFromLanguages = (langs: readonly string[]): Locale | undefined
export const resolveLocale = (stored: string | null | undefined, languages: readonly string[]): Locale => {
  if (isLocale(stored)) return stored
  if (languages.length === 0) return DEFAULT_LOCALE
  return pickLocaleFromLanguages(languages) ?? "en"
}
```

- 保存キーは `uiLocale`、値は `"ja"` か `"en"`。システム設定に従うはキーの削除で表す。
- `readLocaleSetting()` は、`window` が無い・例外・不正値のとき `"system"` を返す。`writeLocaleSetting()` の例外は握りつぶす。

### D-2: クライアントでの切り替え (FR-6, FR-7, FR-8, FR-9, FR-11)

```ts
let current: Locale = DEFAULT_LOCALE
export const getLocale = () => current
export const subscribe = (listener: () => void) => () => void
export const initLocaleFromBrowser = () => void // 保存値とnavigator.languagesから決定
export const setLocaleSetting = (setting: LocaleSetting) => void // 保存して反映
// setCurrent: 値が変わるときだけ current → documentElement.lang → applyDomTranslations → 購読者へ通知
export const useLocale = () => useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE)
export const useT = () => useMemo(() => createTranslator(useLocale()), [locale])
```

- Astroの各islandは同じバンドルのモジュール状態を共有するため、1つのストアで全islandが同期する。
- React は再描画のみで state とDOMを保持する。言語をコンポーネントの `key` に使って再マウントしない。
- `.astro` が出力する静的部分は `data-i18n`（本文）・`data-i18n-aria-label`（属性）・`title[data-i18n-title]` を付け、`applyDomTranslations` が書き換える。Reactが管理するDOMには付けない。
- `Baselayout.astro` は、初回ペイント前のインラインスクリプトで保存値を `lang` に反映し、`astro:page-load` ごとに `initLocaleFromBrowser()` を呼ぶ。`astro:before-swap` で遷移先文書へ `lang` を複製する。
- 他タブの変更は `storage` イベント（`key` が `uiLocale` または `null`）で受け、表示言語を再決定する。

### D-3: サーバーでの判定 (FR-10, NFR-1, NFR-2, NFR-3)

```ts
export const onRequest = sequence(localeMiddleware, refreshBskySession)
// localeMiddleware:
//   context.isPrerendered なら locals.locale = DEFAULT_LOCALE
//   それ以外は locals.locale = resolveLocale(undefined, parseAcceptLanguage(accept-language))
```

- 表示言語はリクエストごとの `Astro.locals.locale` で受け渡し、モジュール状態を持たない。
- `Baselayout.astro` は `<html lang={Astro.locals.locale}>` を出力する。静的生成ページは常に日本語で出力し、クライアントで切り替える。
- 外部の翻訳ライブラリは使わず、型付き辞書と翻訳関数で実装する。

### D-4: 選択欄 (FR-5)

| 項目   | 内容                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| 部品   | `Dropdown` のラッパーで、設定の読み書きまで自身で行う                                                      |
| 選択肢 | `system`（翻訳したラベル）・`ja`（日本語）・`en`（English）。言語の自称は翻訳しない                        |
| 初期値 | サーバー描画とハイドレーション時は `system`。マウント後と表示言語の変化時に `readLocaleSetting()` へ揃える |
| 変更時 | `setLocaleSetting(value)` を呼ぶ                                                                           |
| 配置   | 設定画面の表示設定（表示テーマの隣）、ログイン画面のフォーム上に右寄せ                                     |

## 3. エラー処理

| 事象                           | 処理                                 |
| ------------------------------ | ------------------------------------ |
| 保存領域の読み取り例外・不正値 | システム設定に従うとして扱う         |
| 保存領域の書き込み例外         | 表示言語は切り替え、保存だけを諦める |
