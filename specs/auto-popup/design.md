# 投稿直後の自動共有 設計書

## 1. 構成

| パス                                                    | 責務                                |
| ------------------------------------------------------- | ----------------------------------- |
| `src/components/common/AutoPopupTargetSelect/index.tsx` | 自動ポップアップするSNSのプルダウン |
| `src/components/post/ThreadComposer/shareDispatch.ts`   | 投稿直後の共有の分岐判断            |
| `src/util/share/openIntentPopup.ts`                     | ポップアップの事前オープンと遷移    |
| `src/util/share/webShare.ts`                            | WebShareの呼び出し                  |
| `src/components/post/ThreadComposer/index.tsx`          | 事前オープンと分岐結果の反映        |

## 2. 設計項目

### D-1: プルダウン (FR-1, FR-2)

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

- 共通の `Dropdown` を `autoWidth` 付きで使う。選択肢の `value` は `AUTO_POPUP_TARGETS`、`label` は `t("post.autoPopupTarget.<value>")` とする。
- X・タイッツー・Mastodonの `content` には `InlineIcon` を前置する。Xのアイコンは塗りを `#444` にする。
- `onChange` に渡す値は `isAutoPopupTarget` で検査してから渡す。ラッパーのCSSは `min-width: 0; max-width: none` とする。

### D-2: 共有の分岐 (FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11)

```ts
export type ShareDispatchResult = {
  status: MessageFormatter
  statusColor: string
  openShareDialog: boolean // 呼び出し側で投稿先選択ダイアログを開く
  forcedPopupIntentInsteadOfWebshareOn: boolean
  forcedAutoPopupTarget: AutoPopupTarget | null
}
export const runShareDispatch = async (params: ShareDispatchParams): Promise<ShareDispatchResult>
```

```
effectiveUri = manualImageAttach ? "" : skyshareUri
textFor(t)   = buildIntentText(text, effectiveUri, linkCardUrl,
                 { truncateLimit: resolveTruncateLimit(t, truncateIntentText), measure: 宛先別 })
domain       = resolveMastodonInstanceDomain(mastodonInstanceDomain)

if popupIntentInsteadOfWebshare:
  if target == "ask" or (target == "mastodon" and domain == null):
    popupWindow?.close(); return { openShareDialog: true, status: chooseTarget }
  if openIntentPopupFor(target, textFor(target), { instanceDomain: domain, preOpenedWindow: popupWindow }):
    return { status: popupOpened }
  return { openShareDialog: true, forcedAutoPopupTarget: "ask", status: popupBlocked }

popupWindow?.close()
if canShareWithWebApi(省略しない共有文):
  ok → { status: webShareDone } / aborted → { status: webShareCancelled } / failed → 下へ
if openIntentPopupFor("x", textFor("x")):
  return { forcedPopupIntentInsteadOfWebshareOn: true, forcedAutoPopupTarget: "x", status: fallbackOpened }
return { openShareDialog: true, forcedPopupIntentInsteadOfWebshareOn: true,
         forcedAutoPopupTarget: "ask", status: fallbackBlocked }
```

### D-3: ポップアップの事前オープン (FR-12)

```ts
export const preOpenPopupWindow = (): Window | null // window.open("/jump/", "_blank")
export const openIntentPopup = (url: string, preOpenedWindow?: Window | null): boolean
```

- ブラウザのポップアップブロックを避けるため、`window.open` は投稿ボタンのクリックと同期した呼び出しの中で行う。`ThreadComposer` は、ポップアップを開く設定がONで、選択値が投稿時に選択するでなく、不正なドメインのMastodonでもない場合だけ事前に開く。
- 待機画面として `/jump/` を開き、投稿完了後に `location.href` で共有先へ遷移させる。
- `opener` の切り離しは `setTimeout` で1タスク遅らせる。同期的に切り離すとSafariで遷移が中断されるため。
- `ThreadComposer` は分岐結果の `forced*` を共有設定へ反映し、`openShareDialog` が true なら投稿先選択ダイアログを開く。

## 3. エラー処理

| 事象                               | 処理                                                       |
| ---------------------------------- | ---------------------------------------------------------- |
| ポップアップのブロック             | 投稿先選択ダイアログを開き、選択値を投稿時に選択するにする |
| 事前に開いたウィンドウが閉じられた | ポップアップを開けなかったものとして扱う                   |
| WebShareの失敗                     | Xのポップアップへ切り替える                                |
| 共有URLの組み立て失敗              | ポップアップを開けなかったものとして扱う                   |
