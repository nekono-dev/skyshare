# 多言語対応（日本語・英語） 設計書

対応する要件: [`requirements.md`](./requirements.md)

## 1. 全体方針

- 外部ライブラリは使わず、型付き辞書と薄い翻訳関数で実装する（NFR-1）。呼び出し形 `t(key, params)`・辞書値の `{param}` 形式・複数形キー規約は、将来 i18next へ移行しやすい形に揃える。
- 表示言語の設定は localStorage で保持する（表示テーマ設定と同方式）。サーバーへは送らず、URLも変えない。サーバー描画ページの初回HTMLはAccept-Languageで決め、保存済み設定との差は初期描画後に切り替える。
- 翻訳エンジンは状態を持たない純粋関数とする。言語状態を持つのはクライアント側のストアのみで、サーバー側はリクエストごとに `Astro.locals.locale` として受け渡す（NFR-2）。
- SSGページ（`prerender = true`）はビルド時に日本語で出力し、クライアントで言語を確定して書き換える（NFR-3, NFR-4）。

## 2. ディレクトリ構成

AGENTS.md の lib/util 判定に従い、全てドメイン文言を含むため `src/lib/i18n/` に置く（ドメイン非依存の補助は `src/util/` へ置く）。

```
src/lib/i18n/
  locale.ts          Locale型・判定(resolveLocale)・Accept-Language解析
  localeSetting.ts   localStorageの読み書き（キー`uiLocale`）
  translate.ts       createTranslator(locale) → { t, tn }。型: MessageKey / MessageParams<K>
  format.ts          formatDateTime / formatNumber（locale追従）
  store.ts           クライアント側のロケールストア（useSyncExternalStore用）
  react.ts           useLocale / useT / useFormat フック
  applyDom.ts        data-i18n属性付きDOMの書き換え、document.lang/title更新
  messages/
    ja/index.ts      ドメイン別ファイルを結合して `ja` を export
    ja/{common,nav,account,post,entry,image,settings,help,error,guest}.ts
    en/index.ts      `en` を export（ja と同一キー集合を型で強制）
    en/{...}.ts
src/components/common/LocaleSelect/   表示言語選択（ThemeModeSelect と同型の Dropdown ラッパー）
```

## 3. ロケールの型と判定（`locale.ts`）

```ts
export const LOCALES = ["ja", "en"] as const
export type Locale = (typeof LOCALES)[number]
export type LocaleSetting = Locale | "system"
export const DEFAULT_LOCALE: Locale = "ja"

// 値がLocaleかの判定。localStorageなど外部入力を絞り込む
export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale)

// "en-US,en;q=0.9,ja;q=0.8" → q降順で最初に一致する言語。主言語タグ("en-US"→"en")で照合
export const pickLocaleFromLanguages = (langs: readonly string[]): Locale | undefined

// Accept-Language ヘッダ文字列 → 言語配列(q降順、q=0除外)
export const parseAcceptLanguage = (header: string | null): string[]

// 優先順位: 保存済み設定 → ブラウザ言語 → フォールバック
// フォールバック: ブラウザ言語が空なら DEFAULT_LOCALE(ja)、あるが非対応のみなら UNSUPPORTED_LANGUAGE_LOCALE(en)
export const resolveLocale = (storedValue: string | null | undefined, languages: readonly string[]): Locale => {
  if (isLocale(storedValue)) return storedValue
  if (languages.length === 0) return DEFAULT_LOCALE
  return pickLocaleFromLanguages(languages) ?? UNSUPPORTED_LANGUAGE_LOCALE
}
```

「システム設定に従う」は localStorage のキーを削除した状態で表す（`system` は保存しない）。`LocaleSetting` の現在値は「保存値が有効な Locale ならそれ、なければ `system`」。

## 4. 言語設定の保存（`localeSetting.ts`）

`themeSettings.ts` と同じ方針で、localStorage の例外・SSR（`window` なし）を握りつぶして既定値へフォールバックする。

- キー `uiLocale`、値 `"ja"`|`"en"`。
- `readLocaleSetting(): LocaleSetting`: `window` なし・取得失敗・不正値なら `"system"` を返す。
- `writeLocaleSetting(setting: LocaleSetting)`: `"system"` なら `removeItem`、それ以外は `setItem`。失敗時は何もしない（現在の言語は維持され、永続化されないだけ）。
- サーバーは言語設定を読まない。

## 5. 翻訳エンジン（`translate.ts`）

### 5.1 辞書の型

```ts
// messages/ja/index.ts
export const ja = { ...common, ...nav, ... } as const        // キーはドメイン接頭辞付きのドット区切り: "post.threadExpand_other"
export type MessageKey = keyof typeof ja
// messages/en/index.ts
export const en: Record<MessageKey, string> & PluralOneKeys = { ... } // jaにないキー/不足キーはコンパイルエラー（FR-16）
```

- 値は文字列テンプレート。置換は `{name}` 形式。
- 複数形: 複数形を持つ文言は `base_other` を ja に、`base_one` と `base_other` を en に持つ。`PluralBase = Extract<MessageKey, `${string}_other`> extends `${infer B}_other` ? B : never`、`PluralOneKeys = Record<`${PluralBase}_one`, string>`（型で en の `_one` を強制）。

### 5.2 パラメータの型

```ts
type ParamNames<S extends string> = S extends `${string}{${infer P}}${infer R}`
  ? P | ParamNames<R>
  : never
export type MessageParams<K extends MessageKey> =
  ParamNames<(typeof ja)[K]> extends never
    ? undefined
    : Record<ParamNames<(typeof ja)[K]>, string | number>
```

`t("post.draftThreadCount_other", {count: 3})` のように、不足・余剰パラメータは型エラーになる（FR-17）。

### 5.3 関数

```ts
export const createTranslator = (locale: Locale) => {
  const dict = locale === "ja" ? ja : en
  const plural = new Intl.PluralRules(locale === "ja" ? "ja-JP" : "en-US")
  // 通常: dict[key] の {param} を置換。未知キーは key をそのまま返す（実行時の保険。型検査で通常は到達しない）
  const t = <K extends MessageKey>(key: K, ...args: ParamsArg<K>) => interpolate(dict[key], args[0])
  // 複数形: `${base}_${plural.select(count)}` を探し、無ければ `${base}_other`。count は params にも自動で含める
  const tn = (base: PluralBase, count: number, params?: Record<string, string | number>) => ...
  return { t, tn, locale }
}
export type Translator = ReturnType<typeof createTranslator>
```

- `raw(key)`: プレースホルダを置換しない辞書値を返す。`renderSlots`（後述）の入力に使う。
- `PlainMessageKey`: プレースホルダを持たないキーの型。キーを変数や定数配列で持ち回す場合は `MessageKey` ではなくこの型を使う（`MessageKey` の合併型は `t(key)` でパラメータ必須と判定されるため）。
- `MessageFormatter = (translator: Translator) => string`: 言語が決まってから文言を組み立てる関数。パラメータ付きの文言や複数の文を連結する処理結果（共有ディスパッチのステータス等）を、表示後の言語切り替えに追従させたい場合に state へ保持する。
- `DeferredMessage = { format: MessageFormatter }`、`deferMessage(key)`: `MessageFormatter` をオブジェクトで包んだ保持用の型と、プレースホルダの無いキーからそれを作る関数。関数を直接 `useState` に渡すと更新関数として実行されてしまうため、オブジェクトで包む。

### 5.4 文中にReact要素を差し込む文言（`rich.tsx`）

アイコンなどを文中に置く文言（日本語と英語で位置が異なる）は、辞書の値に `{name}` スロットを書き、`renderSlots(raw(key), { name: <Element /> })` で描画する。スロット名の過不足は型検査されないため、辞書整合テスト（§14）の対象に含める。

`createTranslator` は呼び出しごとに新規オブジェクトを返すだけで、モジュールレベルの可変状態を持たない。`interpolate` は `{name}` を `params[name]` で置換し、`{`/`}` を含まない文字列はそのまま返す。

## 6. 日時・数値（`format.ts`）

```ts
const intlLocale = (l: Locale) => (l === "ja" ? "ja-JP" : "en-US")
export const formatDateTime = (value: string | number | Date, locale: Locale, options?: Intl.DateTimeFormatOptions): string
export const formatNumber = (value: number, locale: Locale): string
```

既存の `toLocaleString("ja-JP", {...})`（6箇所）は `formatDateTime(value, locale, {同じoptions})` へ置換し、日本語の出力が変わらないようにする（NFR-5）。`textCount.ts` の `Intl.Segmenter("ja-JP")` は文字数計数のための固定値であり、表示言語とは無関係なため変更しない。

## 7. サーバー側（SSR）

### 7.1 ミドルウェア

`src/middleware.ts` は現在 `refreshBskySession` の再エクスポートのみ。`sequence` で合成する:

```ts
export const onRequest = sequence(localeMiddleware, refreshBskySession)
// localeMiddleware (lib/i18n/middleware.ts)
//  context.locals.locale = resolveLocale(undefined, parseAcceptLanguage(accept-language))
//  prerender ページではヘッダを読まない（Astroが読み出しを警告するため、`context.isPrerendered` なら DEFAULT_LOCALE を設定）
```

`src/env.d.ts`（`App.Locals`）に `locale: Locale` を追加する。

### 7.2 Baselayout / Metadatas

- `Baselayout.astro`: `<html lang={Astro.locals.locale}>`。SSGページでは常に `ja`。
- 静的ページは `pageTitleKey: MessageKey` を渡す。`createTranslator(locale).t(key, { service: serviceName })` で `<title>` を作り、`<title data-i18n-title={key}>` を付けてクライアントで差し替える（タイトル文言は `{service}` を含みうる）。Entry名など動的なタイトルのページ（`entries/[slug]`・`entries/sample`・`posts/**`）は従来どおり文字列 `pageTitle` を渡し、再翻訳の対象にしない。
- `Metadatas.astro` の description / OGP 文言（`serviceDescription`）は元から英語固定のため翻訳対象外。OGP の見出しは `pageHeading`（Entry名・ハンドル）で、ユーザー生成コンテンツのため翻訳しない。

### 7.3 `.astro` コンポーネントの文言

`Sidebar`・`FooterNav`・`navItems.ts` は `label`/`ariaLabel` を `MessageKey` で持つ。描画時に `t()` した値をテキストとして出し、同時に `data-i18n="key"`（textContent用）・`data-i18n-aria-label="key"`（属性用）を付与する。クライアントで言語が変わった際に `applyDom.ts` が差し替える。

## 8. クライアント側

### 8.1 ストア（`store.ts`）

```ts
let current: Locale = DEFAULT_LOCALE // モジュール状態。クライアント専用（サーバーでは読まれない）
const listeners = new Set<() => void>()
export const getLocale = () => current
export const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const initLocaleFromBrowser = () =>
  setCurrent(
    resolveLocale(
      readLocaleSetting() === "system" ? undefined : readLocaleSetting(),
      navigator.languages,
    ),
  )
export const setLocaleSetting = (s: LocaleSetting) => {
  writeLocaleSetting(s)
  setCurrent(s === "system" ? resolveLocale(undefined, navigator.languages) : s)
}
// setCurrent: 値が変わるときのみ current更新 → document.documentElement.lang更新 → applyDom() → listeners通知
```

Astro の各 island は別々の React ルートだが、モジュール状態は同一バンドル内で共有されるため、1つのストアで全 island が同期する（FR-6）。別タブでの言語設定の変更は `storage` イベント（`key === "uiLocale"` または `null`）で受け取り、`syncLocaleFromBrowser()` で追従する。

### 8.2 React フック（`react.ts`）

```ts
export const useLocale = () =>
  useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE)
export const useT = () => {
  const l = useLocale()
  return useMemo(() => createTranslator(l), [l])
}
```

- `getServerSnapshot` が `DEFAULT_LOCALE` を返すため、SSR・水和時は日本語で描画され、水和後に `getSnapshot`（ブラウザ判定済みの値）へ再描画される。hydration mismatch は発生しない。
- 再描画で React の state・DOM は保持されるため、入力中フォームやダイアログは維持される（FR-7）。コンポーネントの `key` を言語で変えて再マウントしてはならない。
- `useFormat()` は `{ formatDateTime, formatNumber }` を現在の言語に束縛して返す。

### 8.3 初期化とページ遷移（`Baselayout.astro` のスクリプト）

- 初回ペイント前（`is:inline`、ダークモードのスクリプトと同様）: localStorage の `uiLocale` を読み、有効値があれば `document.documentElement.lang` に設定する（`is:inline` は import 不可のため、読み取りは数行を複製する）。
- バンドルスクリプト（`astro:page-load` 毎に）: `initLocaleFromBrowser()` を呼ぶ。
- `astro:before-swap`: ダークモードの `data-theme` 同様、現在の `lang` を遷移先ドキュメントへコピーする（ClientRouter が `<html>` 属性を置き換えるため）。

### 8.4 DOM 書き換え（`applyDom.ts`）

```ts
export const applyDomTranslations = (locale: Locale) => {
  const { t } = createTranslator(locale)
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n as MessageKey))
  document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach(el => el.setAttribute("aria-label", t(...)))
  const title = document.querySelector<HTMLElement>("title[data-i18n-title]")
  if (title) document.title = t(title.dataset.i18nTitle as MessageKey)
}
```

React が管理する DOM には `data-i18n` を付けない（React が再描画するため）。対象は `.astro` が出力する静的部分のみ。

## 9. 文言の移行規約

- キー命名: `<ドメイン>.<要素><用途>`（例 `nav.entries`、`post.submitButton`、`entry.deleteConfirmTitle`）。ドメインは辞書ファイル名と一致させる。
- 複数形が必要な文言は `base_one`/`base_other`、呼び出しは `tn("post.threadExpand", n)`。日本語は `_other` のみ定義する。
- React コンポーネントは `const { t } = useT()` を使う。`.astro` は `createTranslator(Astro.locals.locale)`。React 外の純粋関数（`lib/**` でUI文言を返すもの）は translator を引数で受け取る（`buildGuestDummyPosts(t)` 等）。
- `console.error` 等の開発者向けログ、コード内コメント、`aria` 以外の識別子は翻訳しない。
- `window.confirm`・`alert` も `t()` を通す。

### 状態として保持するメッセージ

表示後に言語を切り替えても追従させたい文言（エラー表示・処理結果のステータス・取得状況）は、翻訳済みの文字列を state に保持せず、次のいずれかを保持して描画時に評価する。

- プレースホルダの無い文言: `PlainMessageKey`（描画時に `t(key)`）。
- パラメータ付き・連結文言: `DeferredMessage`（描画時に `message.format(translator)`）。
- 取得コールバック（依存配列に `t` を入れると言語切り替えで再取得が走り、一覧・スクロール位置が失われる）の中でエラー文言を作る場合は、最新の翻訳関数を `useRef` で参照し、コールバックの依存に含めない。

### ゲスト表示のダミーデータ

`lib/entry/guestDummyPosts.ts` は固定の定数ではなく、翻訳関数を受けて組み立てる `getGuestDummyData(translator)`（言語ごとに初回のみ組み立ててキャッシュする。内容が言語のみに依存する固定データのため Workers のリクエスト間で状態は混ざらない）と、`resolveGuestDeleteScope(sourceUri, translator)` を提供する。文言は `guest.*` の辞書に置く。ダミーデータは取得時点の言語で作られるため、ゲスト表示中は言語が変わったら再取得して差し替える（`reloadKey` に言語を含める）。`entries/sample.astro` は SSG でビルド時に固定される日本語のデモデータであり、翻訳対象外とする（§13 の許可一覧）。

### ログインページの案内

リンクや強調を文中に含む長文は、`.astro` の静的DOMではなく React の island（`LoginIntro`）として `renderSlots` で描画し、言語切り替えに React の再描画で追従させる。`Loading` は、Astro のページから island に翻訳済み文字列を渡せないため、文言キーを受ける `messageKey` を持つ。

## 10. ヘルプ記事

`HelpEntry` の `title`/`description` を `MessageKey` 参照に変更し、`content` 内の文字列も `t()` で出す。JSX の構造（リスト・画像）はコードに残し、文言のみ辞書へ移す。`helpEntries` は定数配列から、translator を受けて配列を返す関数（`buildHelpEntries(t)`）にする。

## 11. APIエラー

APIはエラー文言を返さない。全エンドポイントが `errorResponseFromStatus(status)` による標準形 `{ error: "<英語の固定文字列>" }` に統一され、利用者向け文言はクライアントが HTTP ステータスから表示言語で決める。

- `src/pages/v2/bsky/session.ts` のみが持つローカル関数 `errorResponse(status, message)` と、日本語メッセージの返却（アカウント数上限）を廃止する。上限到達は `errorResponseFromStatus(409)`（状態の競合）に置き換える。他の箇所は変更しない。
- `POST /v2/bsky/session` のOpenAPIスキーマ（`lib/api/schema/v2/bsky/session/post.ts`）の `responses` に、`Common.errorResponses` で `409` を追加し、`npm run codegen` でクライアントを再生成する。409が「アカウント数が上限に達している」ことを示す旨は、スキーマ側のコメントに開発者向けに記す。
- クライアントは `lib/i18n/` の `errorMessageKeyFromStatus(status, context)` で文言キーを引く。`context` はAPI呼び出しの種別（例 `"login"`）で、同じステータスでも画面ごとに文言が異なる場合のみ分岐に使う。

```ts
// 汎用: 400→error.badRequest / 401→error.unauthorized / 403→error.forbidden / 404→error.notFound
//       409→error.conflict / 429→error.rateLimited / それ以外→error.generic
// 個別: context==="login" && status===409 → error.accountLimitReached
export const errorMessageKeyFromStatus = (status: number, context?: ErrorContext): MessageKey
```

- `LoginForm` は、`res.status` から `errorMessageKeyFromStatus(res.status, "login")` で文言キーを選び、キーを state に保持して描画時に `t()` する。`Timeline`・`EntryList`・`OgpFetchButton` のように、一覧や取得処理ごとに失敗の文言が決まっている箇所は、サーバーの `error` 文字列を表示せず、その処理に固有の文言キー（`post.timeline.loadFailed` 等）を表示する。サーバーの `error` は表示に使わない。
- `POST /v2/entry` は従来から `APP_BSKY_POST_FAILED` 等のエラーコードを `error` に返す。`submitThread` はこれを文言キー（`post.submit.*`、未知のコードは `post.submit.failed`）へ変換して返し、画面が `t()` で表示する。
- ステータスを持たない失敗（ネットワーク例外等）は `error.network`（接続できない旨）を表示する（FR-15）。

## 12. 言語設定UI

- `SettingList` の行のコントロールは、`ThemeModeSelect` 固定をやめ、行ごとの描画関数 `renderControl({ id, ariaLabel, disabled })` で差し替える形にする（省略時はトグル）。
- `LocaleSelect`: `Dropdown` のラッパーで、設定の読み書きまで行う自己完結の部品。設定画面とログイン画面の双方に同じ部品を置く（呼び出し側に状態を持たせない）。選択肢は `system`（ラベルは `t("settings.locale.system")`）、`ja`（「日本語」）、`en`（「English」）。言語の自称は翻訳しない。
  - SSR・水和時は `system` で描画し、マウント後および表示言語（`useLocale()`）の変化時に `readLocaleSetting()` で設定値へ揃える。別タブでの変更も `storage` イベント経由の表示言語の変化で揃う。
  - 変更時は内部の値を更新し、`setLocaleSetting(value)` で保存と全文言への反映を行う。
- ログイン画面（`login.astro`）では、フォームの上に右寄せで `LocaleSelect` を置く。
- `Settings` の表示設定グループに「表示言語」を追加する（既存の表示テーマの隣）。

## 13. ハードコード検出（FR-18）

`tests/lib/i18n/noHardcodedText.test.ts`: TypeScript Compiler API（`typescript` は devDependency 済み）で `src/**/*.{ts,tsx}` を解析し、次を検出する。

- 文字列リテラル・テンプレートリテラル・JSXText に、ひらがな・カタカナ・漢字を含むもの。
- 走査から除外するパス: `src/client/**`（自動生成）、`src/lib/i18n/messages/**`（辞書）、`src/lib/api/schema/**`（OpenAPIの description 等、開発者向け記述）。
- 日本語の例外（許可一覧は同テスト内の定数、理由付き）: `LanguageSelect` と `languageFlag.ts` の言語自称、`LocaleSelect` の「日本語」、`entries/sample.astro`（SSG で固定されるデモデータ）。
- コメントは対象外。`.astro` は同様の正規表現で走査する（フロントマターと本文のコメントを除去した上で、日本語を含む行を検出）。

英語の直書き文言は機械的に判別できないため、JSXText・`placeholder`/`aria-label`/`title`/`alt`/`label` 属性の文字列リテラルが英字を含む場合に検出する（`className` 等の識別子属性は対象外）。許可一覧は同様に明示する（サービス名・固有名称・入力例など）。

## 14. テスト設計

- 単体（vitest）: `parseAcceptLanguage`/`pickLocaleFromLanguages`/`resolveLocale`（優先順・q値・地域タグ・不正値）、`interpolate`/`t`/`tn`（en の 0/1/2、ja の `_other` のみ）、辞書キー整合（ja と en の同一キー集合、`_one` の存在）、`formatDateTime` の ja 出力が移行前の `toLocaleString("ja-JP")` と一致すること、localStorage の読み書き（不正値・例外時のフォールバック）。
- 型テスト: `tsc --noEmit` で、不足キー・余剰パラメータがエラーになる検証用サンプルを `tests/lib/i18n/types.check.ts` に置く。
- E2E（Playwright）: `playwright.config.ts` の既定を `locale: "ja-JP"` に固定し、既存E2Eが日本語環境で動くようにする。英語環境は `test.use({ locale: "en-US" })` で別 spec（`tests/e2e/i18n.spec.ts`）に切り出す。
