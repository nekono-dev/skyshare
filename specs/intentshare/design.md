# 他SNSへの共有（intentshare）設計

## 1. 構成

| 責務                           | ファイル                                                  | 備考                                                                   |
| ------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| 重み付き字数での省略（汎用）   | `src/util/share/truncateText.ts`                          | twitter-textのみに依存。skyshareのドメイン型に非依存のため`util`に置く |
| intent本文の組み立て・省略適用 | `src/util/share/intent.ts`                                | `buildIntentText`の`truncateLimit`、`resolveTruncateLimit`             |
| 設定の永続化                   | `src/lib/settings/shareSettings.ts`                       | `AutoPopupTarget`、`truncateIntentText`、Mastodonドメインの解決        |
| 旧設定の引き継ぎ（一時機能）   | `src/lib/settings/legacyShareSettings.ts`                 | 削除前提。呼び出し元は`readAutoPopupTargetSetting`の1か所のみ          |
| 共有設定のstate・永続化フック  | `src/lib/settings/useShareToggles.ts`                     | トグル間の連動は持たない                                               |
| 投稿直後の共有処理             | `src/components/post/ThreadComposer/shareDispatch.ts`     | 分岐の判断のみ（Reactのstateに触れない）                               |
| 自動ポップアップ先プルダウン   | `src/components/common/AutoPopupTargetSelect/`            | 投稿フォームと設定ページで共用                                         |
| 投稿先選択ダイアログ           | `src/components/post/IntentShareDialog/`                  | PostCardとThreadComposer／PostLauncherから利用                         |
| 投稿フォーム                   | `src/components/post/ThreadComposer/index.tsx`            | プルダウン・トグル・ダイアログ起動                                     |
| 投稿フォーム起動ボタン         | `src/components/post/PostLauncher/index.tsx`              | Overlayの外でダイアログを描画                                          |
| 設定ページ                     | `src/components/settings/Settings/index.tsx`              | プルダウン・トグル・Mastodonドメイン入力                               |
| i18n                           | `src/lib/i18n/messages/{ja,en}/{post,settings}.ts`        | 文言                                                                   |
| 仕様（コンポーネント局所）     | `src/components/post/ThreadComposer/spec.submitButton.md` | 共有系設定の挙動                                                       |

## 2. 設定値

### 2.1 `shareSettings.ts`

```ts
export const AUTO_POPUP_TARGETS = ["ask", "x", "taittsuu", "mastodon"] as const
export type AutoPopupTarget = (typeof AUTO_POPUP_TARGETS)[number]
export const DEFAULT_AUTO_POPUP_TARGET: AutoPopupTarget = "x"
export const DEFAULT_MASTODON_INSTANCE_DOMAIN = "mastodon.social"

// 保存キー: autoPopupTarget / popupIntentInsteadOfWebshare / manualImageAttach /
//           truncateIntentText / mastodonInstanceDomain
export const readAutoPopupTargetSetting = (defaultValue: AutoPopupTarget): AutoPopupTarget
export const writeAutoPopupTargetSetting = (value: AutoPopupTarget): void
export const readTruncateIntentTextSetting = (defaultValue: boolean): boolean
export const writeTruncateIntentTextSetting = (value: boolean): void

/** 空白のみなら既定ドメイン、妥当な形式ならそのドメイン、不正な形式なら null を返す。 */
export const resolveMastodonInstanceDomain = (rawDomain: string): string | null
```

- 読み取りは、`window`が無い・localStorageが例外を投げる・保存値が`AUTO_POPUP_TARGETS`に無い場合に`defaultValue`を返す。書き込みの失敗は握りつぶす。
- `readAutoPopupTargetSetting`の先頭で`migrateLegacyShareSettings()`を呼ぶ。この1行が引き継ぎ機能との唯一の接点である。
- 旧設定の読み書き関数（自動ポップアップOFF・タイッツー/Mastodonクロスポスト・X投稿ボタン表示）は削除する。

### 2.2 `legacyShareSettings.ts`（一時機能）

```ts
/** 旧設定の保存キー（このモジュールだけが知る） */
const LEGACY_KEYS = {
    noAutoPopupAfterPost: "noAutoPopupAfterPost",
    crosspostToTaittsuu: "crosspostToTaittsuu",
    crosspostToMastodon: "crosspostToMastodon",
    showCrosspostXButton: "showCrosspostXButton",
} as const

export type LegacyShareSettings = {
    crosspostToTaittsuu: boolean
    crosspostToMastodon: boolean
    showCrosspostXButton: boolean
}

/** 要件R29の規則で選択値を決める純粋関数。「自動ポップアップをOFFにする」は判定に使わない。 */
export const deriveAutoPopupTarget = (legacy: LegacyShareSettings): AutoPopupTarget => {
    const enabledCount = [legacy.crosspostToTaittsuu, legacy.crosspostToMastodon, legacy.showCrosspostXButton]
        .filter(enabled => enabled).length
    if (enabledCount >= 2) return "ask"
    if (legacy.crosspostToTaittsuu) return "taittsuu"
    if (legacy.crosspostToMastodon) return "mastodon"
    return "x"   // X投稿ボタンのみON、またはすべてOFF
}

/**
 * 旧設定を新しい選択値へ引き継ぐ。
 * 1. `window`が無ければ何もしない。
 * 2. 旧キーがいずれも保存されていなければ何もしない。
 * 3. 新キー`autoPopupTarget`が未保存の場合のみ、`deriveAutoPopupTarget`の結果を保存する。
 * 4. 保存に成功した場合（または新キーが既に保存済みの場合）、旧キー4つを削除する。
 *    保存に失敗した場合は旧キーを残し、次回に再試行する。
 * 5. localStorageの例外はすべて握りつぶす。
 */
export const migrateLegacyShareSettings = (): void
```

- 旧キーの値は`"true"`のみをONとみなす。
- 引き継ぎ機能を削除する手順: `legacyShareSettings.ts`とそのテストを削除し、`readAutoPopupTargetSetting`の呼び出し1行を消す。

### 2.3 `useShareToggles.ts`

```ts
export type UseShareTogglesResult = {
  popupIntentInsteadOfWebshare: boolean
  autoPopupTarget: AutoPopupTarget
  manualImageAttach: boolean
  truncateIntentText: boolean // manualImageAttachがtrueの間は常にfalse
  mastodonInstanceDomain: string
  onPopupIntentInsteadOfWebshareChange: (next: boolean) => void
  onAutoPopupTargetChange: (next: AutoPopupTarget) => void
  onManualImageAttachChange: (next: boolean) => void
  onTruncateIntentTextChange: (next: boolean) => void
  onMastodonInstanceDomainChange: (next: string) => void
  reload: () => void
}
```

- 初期値は固定（`false` / `DEFAULT_AUTO_POPUP_TARGET` / 空文字）とし、マウント後の`reload()`でlocalStorageの実値を反映する（SSRと初回描画を一致させる）。
- トグル間の連動ルールは持たない。各ハンドラは、stateの更新とlocalStorageへの書き込みだけを行う。
- `onManualImageAttachChange(true)`は`truncateIntentText`をfalseにし、保存値もfalseへ更新する。
- `onTruncateIntentTextChange(next)`は`manualImageAttach`がtrueなら何もしない。
- `reload()`は、`manualImageAttach`がtrueで`truncateIntentText`の保存値がtrueの場合、保存値をfalseへ補正し、stateもfalseにする。
- `onMastodonInstanceDomainChange(next)`は、入力中の表示は常に更新するが、保存は`isValidMastodonInstanceDomain(next)`の場合のみ行い、空文字なら保存値を削除する。

## 3. 字数省略

### 3.1 `truncateText.ts`

```ts
export const INTENT_WEIGHTED_LIMIT = 280 // 全角140字相当（全角=2、半角=1、改行=1、URL=23）
export const weightedLength = (text: string): number
export type TruncateResult = { text: string; truncated: boolean }
export const truncateBodyWithSuffix = (params: {
    body: string
    suffix: string
    limit: number
}): TruncateResult
```

`truncateBodyWithSuffix`のアルゴリズム:

1. `full`を、`suffix`が空なら`body`、そうでなければ`body === "" ? suffix : body + "\n" + suffix`とする。`weightedLength(full) <= limit`なら`{ text: full, truncated: false }`。
2. `body`を書記素（`Intl.Segmenter`、非対応環境では`Array.from`）に分割する。
3. 書記素数`count`を`length - 1`から1まで減らしながら`head = graphemes.slice(0, count).join("").trimEnd()`、`candidate`（`suffix`が空なら`head + "..."`、そうでなければ`head + "..." + "\n" + suffix`）を作り、`weightedLength(candidate) <= limit`となる最初のものを`{ text: candidate, truncated: true }`として返す。線形降順とするのは、切り取り位置でURL判定が変わり重みが単調でなくなる場合があるため。
4. 1件も収まらなければ`{ text: full, truncated: false }`。

### 3.2 `intent.ts`

```ts
export type BuildIntentTextOptions = { truncateLimit?: number }
export const buildIntentText = (text, skyshareUri, linkCardUrl?, options = {}): string
export const resolveTruncateLimit = (target: IntentTarget, truncateEnabled: boolean): number | undefined =>
    truncateEnabled && (target === "x" || target === "taittsuu") ? INTENT_WEIGHTED_LIMIT - INTENT_TRAILING_MARGIN : undefined
```

- `INTENT_TRAILING_MARGIN`は1。X等のintent先が共有文の末尾へ空白を1文字付け足し、上限ちょうどでは溢れて投稿できなくなるため、`resolveTruncateLimit`は上限から1を引いた279を返す。
- `suffix`は、skyshareUriと、本文に含まれていないリンクカードURL（スキームを除いた形で比較）を改行区切りで連結したもの。
- `options.truncateLimit !== undefined`の場合のみ`truncateBodyWithSuffix({ body: normalizedText, suffix, limit })`の結果を返す。それ以外は、`suffix`を本文の後に改行を挟んで連結した文字列（本文が空なら`suffix`のみ）を返す。

### 3.3 宛先別の字数換算（R18）

```ts
// src/util/share/intentLength.ts（汎用。ドメイン知識なし）
export type IntentMeasure = (text: string) => number // 半角単位（上限280と同じ尺度）
export const xIntentMeasure: IntentMeasure       // twitter-textのweightedLength
export const taittsuuIntentMeasure: IntentMeasure // 全角2・半角1・改行1の単純加算（URL特別扱いなし）
export const resolveIntentMeasure = (target: "x" | "taittsuu"): IntentMeasure
```

- `truncateBodyWithSuffix`は`measure`を引数に取る（省略時は`xIntentMeasure`）。
- `buildIntentText`の`options`に`measure`を追加する。`resolveTruncateLimit`の戻り値は変えない。
- `shareDispatch`は宛先に応じた`resolveIntentMeasure`を`buildIntentText`へ渡す。
- 末尾文字列の組み立ては`buildIntentSuffix(body, skyshareUri, linkCardUrl)`として`intent.ts`から公開し、`buildIntentText`とカウンタ補正で共用する（リンクカードURLの「本文に含まれるか」の判定を1か所に保つ）。

## 3.4 文字数カウンタの上限補正（R33〜R37）

```ts
// src/lib/entry/estimateEntryUrl.ts
export const estimateSkyshareEntryUrl = (did: string | null | undefined): string
// skyshareEntryUrlgen(did ?? 既定DID, 疑似rkey) を返す。疑似rkeyの長さは TID.nextStr().length から実行時に導出する。

// src/lib/share/counterReserve.ts
export type CounterTarget = "x" | "taittsuu"
export const resolveCounterTargets = (autoPopupTarget, popupIntentInsteadOfWebshare): CounterTarget[]
export const resolveCounterReserve = (params: {
    target: CounterTarget
    body: string
    entryUrl: string | null   // 予測URL。entryが作られない場合はnull
    linkCardUrl: string       // 無ければ空文字
}): number // カウンタ単位（ceil(measure("\n" + suffix) / 2)）。末尾文字列が無ければ0
```

- `ThreadSegmentForm`の`textCounters`は、`counterTargets`・`reserve`を受けて生成する関数に変える。X・タイッツーは`maxAssumed`と`warnAt`を`140 - reserve`にし、Blueskyは変えない。補正を受けるのは先頭セグメントのみ（共有文に使うのは先頭セグメントだけ）。
- `ThreadComposer`は`autoPopupTarget`・`popupIntentInsteadOfWebshare`・`manualImageAttach`・`accountDid`を`ThreadSegmentForm`へ渡す。

## 4. 投稿直後の共有（`runShareDispatch`）

### 4.1 入出力

```ts
export type ShareDispatchParams = {
  text: string
  skyshareUri: string
  linkCardUrl: string
  imageEntry: ImageEntry | null
  manualImageAttach: boolean
  truncateIntentText: boolean
  popupIntentInsteadOfWebshare: boolean
  autoPopupTarget: AutoPopupTarget
  mastodonInstanceDomain: string // 保存値そのまま（未設定は空文字）
  popupWindow: Window | null // 事前に開いたポップアップ
  guestMode?: boolean
}

export type ShareDispatchResult = {
  status: MessageFormatter
  statusColor: string
  /** 呼び出し側で投稿先選択ダイアログを開く */
  openShareDialog: boolean
  /** 呼び出し側で popupIntentInsteadOfWebshare をONにする */
  forcedPopupIntentInsteadOfWebshareOn: boolean
  /** 非nullなら呼び出し側で autoPopupTarget をこの値へ変更する */
  forcedAutoPopupTarget: AutoPopupTarget | null
}
```

### 4.2 処理フロー

```
effectiveSkyshareUri = manualImageAttach ? "" : skyshareUri
webShareText = buildIntentText(text, effectiveSkyshareUri, linkCardUrl)       // 省略しない
buildTextFor(t) = buildIntentText(text, effectiveSkyshareUri, linkCardUrl,
                      { truncateLimit: resolveTruncateLimit(t, truncateIntentText) })
domain = resolveMastodonInstanceDomain(mastodonInstanceDomain)                // 不正ならnull

if popupIntentInsteadOfWebshare:
    if autoPopupTarget == "ask" or (autoPopupTarget == "mastodon" and domain == null):
        popupWindow?.close()
        return { openShareDialog: true, forcedPopup...: false, forcedAutoPopupTarget: null,
                 status: post.share.chooseTarget }
    opened = openIntentPopupFor(autoPopupTarget, buildTextFor(autoPopupTarget),
                 { instanceDomain: domain ?? undefined, preOpenedWindow: popupWindow })
    if opened:  return { openShareDialog: false, ..., status: post.share.popupOpened }
    return { openShareDialog: true, forcedAutoPopupTarget: "ask", status: post.share.popupBlocked }

popupWindow?.close()
if canShareWithWebApi(webShareData(text: webShareText)):
    result = shareWithWebApi(...)
    ok      → { openShareDialog: false, status: post.share.webShareDone }
    aborted → { openShareDialog: false, status: post.share.webShareCancelled }
    (failed は下へ)
opened = openIntentPopupFor("x", buildTextFor("x"))
opened  → { openShareDialog: false, forcedPopupIntentInsteadOfWebshareOn: true,
            forcedAutoPopupTarget: "x", status: post.share.fallbackOpened }
!opened → { openShareDialog: true,  forcedPopupIntentInsteadOfWebshareOn: true,
            forcedAutoPopupTarget: "ask", status: post.share.fallbackBlocked }
```

## 5. プルダウン（`AutoPopupTargetSelect`）

```ts
type Props = {
  value: AutoPopupTarget
  onChange: (next: AutoPopupTarget) => void
  disabled?: boolean
  id?: string
  ariaLabel?: string
  className?: string
}
```

- `ThemeModeSelect`と同じ形式の共通`Dropdown`のラッパー。選択肢の`value`は`AUTO_POPUP_TARGETS`、`label`は`t("post.autoPopupTarget.<value>")`、`content`は「X」「タイッツー」「Mastodon」で対応する`InlineIcon`（`x`は`src/images/twitter.svg`の塗りを`#444`にしたもの）をラベルの前に付ける。`triggerContent`は`content`を使う。
- `Dropdown`の`autoWidth`を指定し、トリガーの横幅を選択中の内容に合わせる。ラッパーのCSSでは`min-width: 0; max-width: none`とし、文字の大きさはトグルのラベルと同じ`--font-size-sm`にする。
- `onChange`に渡す値は`AUTO_POPUP_TARGETS`に含まれることを確認してからキャストする。

## 6. 投稿先選択ダイアログ（`IntentShareDialog`）

```ts
export type IntentShareRequest = {
  postText: string
  entryUrl: string | null
  linkCardUrl: string
}
type Props = {
  request: IntentShareRequest | null // nullなら非表示
  /** 投稿先を選択してもダイアログを閉じない（投稿ボタンから開いた場合）。既定 false */
  keepOpenOnSelect?: boolean
  onClose: () => void
}
```

- 選択肢は「X に投稿」「タイッツーに投稿」「Mastodonに投稿」「閉じる」。`entryUrl`がnullでもボタンは有効とする。
- クリック時、`readTruncateIntentTextSetting(false)`を都度読み、`buildIntentText(postText, entryUrl ?? "", linkCardUrl, { truncateLimit: resolveTruncateLimit(target, truncate) })`で共有文を組み立てて`openIntentPopupFor`を呼ぶ。`keepOpenOnSelect`が偽のときだけ、続けて`onClose()`を呼ぶ。
- Mastodonの投稿先は`resolveMastodonInstanceDomain(readMastodonInstanceDomainSetting(""))`で解決し、nullなら「Mastodonに投稿」ボタンを`disabled`にする。
- 「閉じる」ボタン・背景クリック・Escキーはいずれも`onClose()`を呼ぶ（背景クリックとEscは`ChoiceDialog`の`onClose`が担う）。
- PostCard（タイムライン）は`keepOpenOnSelect`を指定しない。ThreadComposerとPostLauncherは`keepOpenOnSelect`を指定する。

## 7. ThreadComposer / PostLauncher

- `ThreadComposer`の追加state: `shareRequest: IntentShareRequest | null`。末尾で`<IntentShareDialog request={shareRequest} keepOpenOnSelect onClose={() => setShareRequest(null)} />`を描画する。
- 追加prop: `onShareRequest?: (request: IntentShareRequest) => void`。`PostLauncher`は投稿成功で`Overlay`を閉じ、ThreadComposerごとアンマウントされるため、`PostLauncher`が`onShareRequest`（自身のstate更新）を渡し、`Overlay`の外で`IntentShareDialog`（`keepOpenOnSelect`付き）を描画する。`onShareRequest`未指定（Timeline・PostPageの固定表示フォーム）の場合は、ThreadComposer自身のstateで描画する。
- 事前ポップアップ（`preOpenPopupWindow`）は、`popupIntentInsteadOfWebshare && autoPopupTarget !== "ask" && !(autoPopupTarget === "mastodon" && resolveMastodonInstanceDomain(domain) === null)`の場合のみ開く。
- 投稿成功後、`runShareDispatch`の結果に応じて次を行う。
  - `forcedPopupIntentInsteadOfWebshareOn`がtrueなら`onPopupIntentInsteadOfWebshareChange(true)`。
  - `forcedAutoPopupTarget`が非nullなら`onAutoPopupTargetChange(forcedAutoPopupTarget)`。
  - `openShareDialog`がtrueなら、`rootSegment.text` / `skyshareUri || null` / `rootSegment.ogpResult?.sourceUrl ?? ""`から`IntentShareRequest`を作り、`onShareRequest`があればそれを、無ければ`setShareRequest`を呼ぶ。
  - `resetInputFields`を常に実行する。
- 主トグル領域は「WebShareの代わりにポップアップを開く」「画像を自分で添付」の順に並べる。
- 詳細オプション（折りたたみ）の中身は、先頭から「自動ポップアップするSNS」の行（`popupIntentInsteadOfWebshare`がtrueのときだけ）、「長文を省略して共有」、「返信・引用オプションを保存する」、「投稿フォームを固定表示しない」の順に並べる。「長文を省略して共有」は`disabled={isSubmitting || manualImageAttach}`とする。
- 「自動ポップアップするSNS」の行は`<label>`と`AutoPopupTargetSelect`を横に並べ、ラベルの色を`--color-muted`、文字の大きさを`--font-size-sm`（`ToggleSwitch`のラベルと同じ）にする。
- 折りたたみの初期開閉は、「投稿フォームを固定表示しない」・`truncateIntentText`のいずれかがtrueのときに開く。`autoPopupTarget`の値と`popupIntentInsteadOfWebshare`は初期開閉の判定に使わない。
- 手動投稿ボタンと、旧トグル（自動ポップアップOFF・クロスポスト）の表示は設けない。

## 8. 設定ページ（`Settings`）

投稿フォーム設定の`SettingList`を次の順に並べる。

1. 投稿フォームを固定表示しない
2. WebShareの代わりにポップアップを開く
3. 自動ポップアップするSNS（`shareToggles.popupIntentInsteadOfWebshare`がtrueのときだけ追加。`renderControl`で`AutoPopupTargetSelect`を描画）
4. 画像を自分で添付する
5. 長文を省略して共有する（`disabled: shareToggles.manualImageAttach`）
6. ハッシュタグ候補を表示
7. メンション候補を表示

「クロスポスト」セクションは廃止し、Mastodonのインスタンスドメイン入力行を投稿フォーム設定の末尾に置く。`renderControl: () => null`でトグルを描画せず、`textInput: true`・`textInputValidate: isValidMastodonInstanceDomain`・`textInputErrorMessage`・`textInputPlaceholder: "mastodon.social"`を指定する。

## 9. i18n

| キー                                                     | ja                                                                                                                    | en                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `post.autoPopupTarget.label`                             | 自動ポップアップするSNS                                                                                               | Auto-popup destination                        |
| `post.autoPopupTarget.ask`                               | 投稿時に選択する                                                                                                      | Choose when posting                           |
| `post.autoPopupTarget.x`                                 | X                                                                                                                     | X                                             |
| `post.autoPopupTarget.taittsuu`                          | タイッツー                                                                                                            | Taittsuu                                      |
| `post.autoPopupTarget.mastodon`                          | Mastodon                                                                                                              | Mastodon                                      |
| `post.composer.truncateIntentText`                       | 長文を省略して共有（X・タイッツー）                                                                                   | Truncate long text when sharing (X, Taittsuu) |
| `settings.autoPopupTarget.description`                   | 投稿後に投稿画面を自動で開くSNSを選びます。「投稿時に選択する」の場合は、投稿後に投稿先を選ぶダイアログを表示します。 | （同趣旨）                                    |
| `settings.truncateIntentText.label` / `.description`     | 長文を省略して共有する / X・タイッツーへ共有する際に…                                                                 | （同趣旨）                                    |
| `settings.mastodon.instance.label` / `.description`      | Mastodonのインスタンス / 未設定の場合は mastodon.social を使います。                                                  | （同趣旨）                                    |
| `settings.mastodon.domainError`                          | ドメインの形式が正しくありません。…                                                                                   | （同趣旨）                                    |
| `post.shareDialog.aria`                                  | 共有先を選択                                                                                                          | Choose where to share                         |
| `post.share.chooseTarget`                                | `{result}。共有先を選択してください。`                                                                                | （同趣旨）                                    |
| `post.share.popupBlocked` / `post.share.fallbackBlocked` | 投稿画面を開けなかった旨と、投稿先選択ダイアログを開いた旨                                                            | （同趣旨）                                    |

自動ポップアップOFF・クロスポスト・X投稿ボタンに関する文言は削除する。ja/enのキー集合は一致させる。

## 10. テスト設計（条件網羅 C2）

- `tests/util/share/truncateText.test.ts`: 収まる／収まらない／suffix空／URLだけで上限近い／全角・絵文字・改行／末尾空白／本文内URL。
- `tests/util/share/intent.test.ts`: `truncateLimit`の有無 × skyshareUriの有無 × リンクカードURLの有無、`resolveTruncateLimit`の宛先別結果。
- `tests/lib/settings/legacyShareSettings.test.ts`: `deriveAutoPopupTarget`の全規則（各1つだけON、2つ以上ON、すべてOFF）と、「自動ポップアップをOFFにする」のみONの場合、`migrateLegacyShareSettings`の「旧キー無し」「新キー未保存」「新キー保存済み」「保存失敗」「`window`無し」。
- `tests/lib/settings/shareSettings.test.ts`: `readAutoPopupTargetSetting`（既定・不正値・保存値・引き継ぎ経由）、`resolveMastodonInstanceDomain`（空白・妥当・不正）。
- `tests/components/post/ThreadComposer/shareDispatch.test.ts`: 4.2の全分岐（ask、各SNS、Mastodon不正ドメイン、ブロック、WebShare成功・キャンセル・非対応・失敗、フォールバックの成否、省略の有無・宛先別・URLなし）。
