# Brief: src-lib-ui-boundary

## Problem

steering は「`src/lib/` は業務の判断を持ち、`src/components/` は React と Astro の部品」と定めている。しかし `lib/` の 6 ファイルが React や react-easy-crop に依存している。そのため `lib` は UI を含むと見なされ、判断だけを読んでテストするという前提が崩れている。

## Current State

2026-11-01 の実測で、`lib/` の UI 依存は次の 6 ファイル。

- `lib/i18n/react.ts`・`lib/i18n/rich.tsx`（i18n の中に React のフック・描画）
- `lib/image/croppedImageStyle.ts`（react と react-easy-crop）
- `lib/image/postImageProcessing.ts`（react-easy-crop）
- `lib/schedule/useScheduleAvailability.ts`（フック）
- `lib/settings/useShareToggles.ts`（フック）

`components/` にもフック相当が 6 件ある（`useSuggest.ts`・`useKeyboardRows.ts`・`useWebShareCrosspost.ts`・`useSkyshareEntryStatus.ts` など）。

## Desired Outcome

- `lib/` は React と react-easy-crop に依存しない（`.ts` の判断、zod などの純粋なモジュールだけ）。
- フックは `components/` 側（利用する部品の近く）にある。
- `lib/i18n` の辞書と翻訳の判断は、React に依存しない形で残る。

## Approach

- フック（`useScheduleAvailability`・`useShareToggles`）は、利用する部品のフォルダへ移す。
- 画像の切り抜きの計算（`croppedImageStyle`・`postImageProcessing`）のうち、React に依存しない計算は `lib/image/` に残し、描画の部分だけを `components/image/` へ移す。design で切り分ける。
- `lib/i18n/react.ts` と `rich.tsx` は、`components/` 側（または i18n の React 専用の入口）へ移す。移動先は design で決める。

## Scope

- **In**: `lib/` の 6 ファイルの移動と分割、それに伴う import の更新、テストの import パスの更新。
- **Out**: 翻訳の文言、切り抜きの計算結果、設定の保存（振る舞いは変えない）、`components/` 内のフックの整理（`src-composer-split` と `src-folder-layout` が扱う）。

## Boundary Candidates

- i18n の React 依存（`react.ts`・`rich.tsx`）
- 画像の計算と描画（`croppedImageStyle`・`postImageProcessing`）
- 設定と予約のフック（`useShareToggles`・`useScheduleAvailability`）

## Out of Boundary

- 翻訳の循環の解消（`src-cycles`。先に行う）
- 画像の処理の仕様（`media-attachments` の振る舞い）
- 設定の仕様（`settings` の振る舞い）

## Upstream / Downstream

- **Upstream**: `src-import-rules`（UI 依存の検査）、`src-cycles`（`lib/i18n` の循環を先に解く）
- **Downstream**: `src-composer-split`（フックの移動先を先に決める）、`src-duplicates`

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `i18n`（翻訳の振る舞い）、`media-attachments`（画像の切り抜き・加工）、`settings`（設定のフック）、`scheduled-posting`（予約の利用可否）、`ui-primitives`（部品の置き場所）

## Constraints

- 振る舞い（表示・計算結果）は変えない。component テスト（6 件）と route テスト（135 件）、e2e（7 件）で守る。
- 検証の基準 272 件が全通過すること。
- 移動のたびに `src-import-rules` の許容リストから該当項目を減らす。
