# Brief: src-cycles

## Problem

循環 import は、どのモジュールを先に読むべきかを分かりにくくし、変更の影響範囲を広げる。2026-11-01 の実測では、ファイル単位の循環が 2 件（計 18 ファイル）、ディレクトリ単位の双方向が 13 組ある。

## Current State

- **SCC A（16 ファイル・型のみ）**: `lib/i18n/messages/en/*.ts` の 15 ファイルが `import type` で `lib/i18n/translate.ts` の型を参照し、`translate.ts` が `messages/en` を値として参照する。
- **SCC B（2 ファイル）**: `lib/settings/legacyShareSettings.ts` が `shareSettings.ts` の型を参照し、`shareSettings.ts` が `migrateLegacyShareSettings` を値として参照する。
- **ディレクトリ単位**: `lib/atproto` ↔ `lib/entry`（1 対 13 件）、`lib/api` ↔ `lib/atproto`（5 対 4）、`lib/entry` ↔ `lib/timeline`（2 対 3）、`lib/session` ↔ 直下（`env`・`vars`）など。

## Desired Outcome

- ファイル単位の循環が 0 件になる。
- `lib/atproto` と `lib/entry` の依存は一方向になる（`entry` が `atproto` を使う向き）。
- 翻訳の型は、辞書の値を読まずに参照できる位置にある。

## Approach

- i18n: 型を辞書の値と別のファイル（型の定義だけのファイル）に移し、`translate.ts` と辞書の両方がそこを参照する形にする。
- settings: 移行処理（legacy → 新形式）を、型に依存しない別のモジュールへ分ける。
- atproto と entry: 共有されている型と組み立ての規則を、どちらにも属さない位置（または `atproto` 側）に寄せる。design で具体化する。

## Scope

- **In**: 上記の循環（ファイル単位 2 件、ディレクトリ単位の双方向のうち `lib` 内のもの）の解消、型の置き場所の変更、それに伴う import の更新。
- **Out**: 翻訳の文言の変更、設定の保存形式の変更、`lib` の UI 依存（`src-lib-ui-boundary`）、`pages` の責務（`src-pages-thin`）。

## Boundary Candidates

- i18n の型と辞書の分離
- settings の移行処理の分離
- atproto と entry の共有型の所有

## Out of Boundary

- 翻訳の内容・言語の判定（`i18n` spec の振る舞い）
- 設定の読み書きの契約（`settings` spec の振る舞い）
- Bluesky レコードの形（`atproto-records` spec の振る舞い）

## Upstream / Downstream

- **Upstream**: `src-import-rules`（循環の検査で、解消を確かめる）
- **Downstream**: `src-lib-ui-boundary`（`lib/i18n/react.ts` などを動かす前に、循環を解いておく）、`src-composer-split`

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `i18n`（辞書と翻訳の振る舞い）、`settings`（移行処理）、`atproto-records`・`entry-sharing`（レコードと Entry の形）

## Constraints

- 型だけの循環（SCC A）は、実行時の循環はなくても検査では循環として扱う。解消の対象に含める。
- 検証の基準 272 件が全通過すること。
- 既存の振る舞い（翻訳・移行・レコードの形）は変えない。
