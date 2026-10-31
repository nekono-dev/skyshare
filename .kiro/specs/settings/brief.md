# Brief: settings

## Problem

表示と投稿の既定値は端末に保存され、投稿フォームやタイムラインが読む。保存のキーと既定値が設定画面と食い違うと、利用者の選択が効かない。

## Current State

- `src/pages/settings.astro`・`src/components/settings/`（`Settings/index.tsx`・`SettingsDialog`・`SettingList`）。設定は「表示」「投稿」「クロスポスト」の三グループ。末尾に予約投稿の切替（`components/schedule/ScheduleSetting`。所有は scheduled-posting）を配置する。
- 保存（localStorage。キーは各モジュールの定数）:
  - `src/lib/settings/themeSettings.ts`: テーマ（`data-theme` への反映を含む）
  - `timelineSettings.ts`: 表示件数（`PageSizeSelect`）・タイムラインを表示しない設定
  - `postGateSettings.ts`: 返信・引用の既定値
  - `suggestSettings.ts`: 候補表示の ON/OFF
  - `hashtagHistorySettings.ts`: ハッシュタグ履歴。`accountDid` ごとに分け、DID が未解決のあいだは読み書きしない（`PUBLIC_HASHTAG_HISTORY_MAX` の上限）
  - `shareSettings.ts`・`useShareToggles.ts`: 共有の既定値と連動規則
- 利用者: `components/composer/`（投稿フォーム・候補・返信/引用）、`components/timeline/Timeline/`（表示切替）、共有（`lib/share`・`util/share`）。
- 言語の選択 UI は `components/common/LocaleSelect`（部品）と設定ページが組み合わせる。保存は `lib/i18n/localeSetting.ts`（i18n が所有）。
- 旧共有設定の引き継ぎ（`legacyShareSettings.ts`）は external-sharing が所有する。

## Desired Outcome

- 設定の項目、既定値、保存キー、読み手（どの機能が読むか）が記録されている。
- 連動規則（片方を変えたときの他方）が記録されている。
- アカウントごとに分ける設定（ハッシュタグ履歴）の規則が記録されている。

## Approach

設定の保存と表示を所有する。値の使い方は読み手の spec が所有する。

## Scope

- **In**: 設定ページと一覧、テーマ・表示件数・タイムラインの切替、投稿の既定値、ハッシュタグ履歴、連動規則。
- **Out**: 言語の判定と保存（i18n）、予約の切替（scheduled-posting）、旧共有設定（external-sharing）、投稿フォームの動作（post-composition）。

## Boundary Candidates

- 設定ページと一覧（Settings・SettingList・settings.astro）
- 表示の設定（themeSettings・timelineSettings）
- 投稿の既定値（postGateSettings・suggestSettings・shareSettings・useShareToggles）
- ハッシュタグ履歴（hashtagHistorySettings）

## Out of Boundary

- 言語、予約の切替、旧共有設定、投稿フォームの動作

## Upstream / Downstream

- **Upstream**: session-accounts（履歴のアカウント）、i18n、ui-primitives、platform-runtime。
- **Downstream**: timeline-browsing、post-composition、external-sharing（値を読む）。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: external-sharing（共有の既定値）、post-composition（投稿の既定値）、scheduled-posting（設定ページに配置される）。

## Constraints

- 保存できない環境（プライベートモード等）では既定値にフォールバックする（各モジュールの規則）。
- 既知の不一致: `timelineSettings.ts` の注記によると、ページ送りの方式の選択肢は廃止され、無限スクロールに固定されている。関連の保存のコードが残っていないかは design で確認する。
