# 共有設定 設計書

## 1. 構成

| パス                                         | 責務                                       |
| -------------------------------------------- | ------------------------------------------ |
| `src/lib/settings/shareSettings.ts`          | 共有設定の読み書きとMastodonドメインの解決 |
| `src/lib/settings/legacyShareSettings.ts`    | 旧共有設定の引き継ぎ（削除前提の一時機能） |
| `src/lib/settings/useShareToggles.ts`        | 共有設定のstateと保存を束ねるフック        |
| `src/components/settings/Settings/index.tsx` | 設定ページの共有設定の行                   |

## 2. 設計項目

### D-1: 設定の読み書き (FR-1, FR-2, FR-5, NFR-1)

```ts
export const AUTO_POPUP_TARGETS = ["ask", "x", "taittsuu", "mastodon"] as const
export type AutoPopupTarget = (typeof AUTO_POPUP_TARGETS)[number]
export const DEFAULT_AUTO_POPUP_TARGET: AutoPopupTarget = "x"
export const DEFAULT_MASTODON_INSTANCE_DOMAIN = "mastodon.social"

// 保存キー: autoPopupTarget / popupIntentInsteadOfWebshare / manualImageAttach /
//           truncateIntentText / mastodonInstanceDomain
export const readAutoPopupTargetSetting = (defaultValue: AutoPopupTarget): AutoPopupTarget
export const writeAutoPopupTargetSetting = (value: AutoPopupTarget): void
// 真偽値の設定は read<Name>Setting(defaultValue) / write<Name>Setting(value) の対で持つ

/** 空白のみなら既定ドメイン、妥当な形式ならそのドメイン、不正な形式なら null */
export const resolveMastodonInstanceDomain = (rawDomain: string): string | null
```

- 読み取りは、`window` が無い・保存領域が例外を投げる・保存値が不正な場合に `defaultValue` を返す。書き込みの例外は握りつぶす。
- ドメイン形式の判定は `isValidMastodonInstanceDomain`（`src/util/share/intent.ts`）を使う。

### D-2: 旧設定の引き継ぎ (FR-6, FR-7)

```ts
export const deriveAutoPopupTarget = (legacy: LegacyShareSettings): AutoPopupTarget => {
  const enabledCount = [legacy.crosspostToTaittsuu, legacy.crosspostToMastodon, legacy.showCrosspostXButton]
    .filter(enabled => enabled).length
  if (enabledCount >= 2) return "ask"
  if (legacy.crosspostToTaittsuu) return "taittsuu"
  if (legacy.crosspostToMastodon) return "mastodon"
  return "x"
}
export const migrateLegacyShareSettings = (): void
```

`migrateLegacyShareSettings` の手順:

1. `window` が無い、または旧キー4つがいずれも未保存なら何もしない。
2. `autoPopupTarget` が未保存の場合のみ、`deriveAutoPopupTarget` の結果を保存する。
3. 保存に成功した場合（または保存済みだった場合）に旧キー4つを削除する。失敗時は旧キーを残し、次回に再試行する。
4. 旧キーの値は `"true"` のみをONとみなす。

呼び出し元は `readAutoPopupTargetSetting` の先頭1か所のみとする。引き継ぎ機能を除去するときは、このモジュールとそのテスト、および呼び出し1行を削除する。

### D-3: 共有設定フック (FR-3, FR-4, NFR-2)

```ts
export type UseShareTogglesResult = {
  popupIntentInsteadOfWebshare: boolean
  autoPopupTarget: AutoPopupTarget
  manualImageAttach: boolean
  truncateIntentText: boolean // manualImageAttach が true の間は常に false
  mastodonInstanceDomain: string
  onPopupIntentInsteadOfWebshareChange: (next: boolean) => void
  onAutoPopupTargetChange: (next: AutoPopupTarget) => void
  onManualImageAttachChange: (next: boolean) => void
  onTruncateIntentTextChange: (next: boolean) => void
  onMastodonInstanceDomainChange: (next: string) => void
  reload: () => void
}
```

- 初期値は固定値とし、マウント後の `reload()` で保存値を反映する。これによりサーバー描画と初回描画を一致させる。
- `onManualImageAttachChange(true)` は `truncateIntentText` を false にし、保存値も false にする。
- `onTruncateIntentTextChange` は `manualImageAttach` が true の間は何もしない。
- `reload()` は、`manualImageAttach` が true で `truncateIntentText` の保存値が true の場合、保存値を false に補正する。
- `onMastodonInstanceDomainChange` は表示を常に更新し、保存は形式が妥当な場合のみ行う。空文字なら保存値を削除する。

### D-4: 設定ページの行 (FR-5, FR-8)

| 順  | 行                                                                            | 表示条件                               |
| --- | ----------------------------------------------------------------------------- | -------------------------------------- |
| 1   | 投稿フォームを固定表示しない                                                  | 常時                                   |
| 2   | WebShareの代わりにポップアップを開く                                          | 常時                                   |
| 3   | 自動ポップアップするSNS（`AutoPopupTargetSelect`）                            | `popupIntentInsteadOfWebshare` が true |
| 4   | 画像を自分で添付する                                                          | 常時                                   |
| 5   | 長文を省略して共有する（`disabled: manualImageAttach`）                       | 常時                                   |
| 6   | ハッシュタグ候補を表示                                                        | 常時                                   |
| 7   | メンション候補を表示                                                          | 常時                                   |
| 8   | Mastodonのインスタンス（`textInput`、検証は `isValidMastodonInstanceDomain`） | 常時                                   |

## 3. エラー処理

| 事象                         | 処理                                     |
| ---------------------------- | ---------------------------------------- |
| 保存領域の読み取り例外       | 既定値を返す                             |
| 保存領域の書き込み例外       | 握りつぶし、表示中のstateは維持する      |
| 引き継ぎ時の保存失敗         | 旧キーを残し、次回の読み取りで再試行する |
| 不正なMastodonドメインの入力 | 入力欄にエラー文言を表示し、保存しない   |
