# Brief: i18n

## Problem

表示言語は、サーバー描画（Accept-Language）、クライアント描画（localStorage の利用者設定）、React の部品の三経路で決まる。経路ごとの決定規則が揃っていないと、画面ごとに言語がずれる。

## Current State

- `src/lib/i18n/locale.ts`: 対応言語と判定の純粋関数。`DEFAULT_LOCALE` は `ja`。外部入力（localStorage・Accept-Language・navigator.languages）から決める。
- `src/lib/i18n/middleware.ts`: SSR のページに `locals.locale` を入れる。利用者の設定はサーバーに送られないため Accept-Language だけで決める。SSG のページは既定言語。
- `src/lib/i18n/localeSetting.ts`: 「システムに従う／日本語／English」を localStorage に保存する。`system` は値を消す。
- `src/lib/i18n/messages/{ja,en}/*.ts`: 名前空間ごとの辞書（account・entry・feedback・post・schedule・settings・survey・privacy・error・common ほか）。
- `translate.ts`・`react.ts`・`applyDom.ts`・`rich.tsx`・`store.ts`・`format.ts`: 利用側の API。`errorMessage.ts` は API のエラーを文言キーへ変換する。

## Desired Outcome

- 表示言語の決定規則（SSR・クライアント・保存された設定の差の扱い）が記録されている。
- 辞書の名前空間と、ja・en の対応が記録されている。
- API エラーから文言への変換規則が記録されている。

## Approach

決定規則と辞書の構造を所有する。言語の選択 UI は `settings` が所有する。

## Scope

- **In**: 判定、保存、辞書の構造、文言の適用（DOM・React・SSR）、エラー文言の変換。
- **Out**: 選択 UI（settings）、個々の画面の文言の内容、翻訳の品質。

## Boundary Candidates

- 判定と決定（locale.ts・middleware.ts）
- 保存（localeSetting.ts）
- 辞書と適用（messages/・translate.ts・applyDom.ts・react.ts・rich.tsx）
- エラー文言（errorMessage.ts）

## Out of Boundary

- 選択 UI（settings）、各機能の文言（各機能の spec）

## Upstream / Downstream

- **Upstream**: なし。
- **Downstream**: 全画面 spec。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: settings（選択 UI）、platform-runtime（ミドルウェアの合成）。

## Constraints

- サーバーは localStorage を読まない。
- 辞書は ja と en の両方を持つ。
- 既知の不一致: なし（確認済みの範囲）。
