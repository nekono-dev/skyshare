# Brief: src-duplicates

## Problem

同じ概念の実装が複数の場所にあり、どれが正しいかを読む人が判断できない。2026-11-01 の実測では、X の文字数換算、応答の組み立て、ゼロ埋め、共有の責務、`env` 系モジュールが重複している。片方を直しても、もう片方が残る危険がある。

## Current State

- **X の文字数換算が 2 種類**: `util/textCount.ts:25` の `countWeightedTweetLength`（weightedLength を 2 で割って切り上げ）と、`util/share/intentLength.ts:31` の `xIntentMeasure`（weightedLength をそのまま返す）。どちらも `twitter-text` を使う。さらに `util/textCount.ts` は `util/share/intentLength.ts` を import している。
- **応答の組み立てが 4 箇所**: `lib/schedule/scheduleResponse.ts:18` の `jsonResponse`（`cache-control: no-store` を付与）、`lib/api/response.ts:34` の `errorResponseFromStatus`、`pages/v2/entry.ts:81` の `json200`、`pages/v2/bsky/session/authorization/completion.ts:52` の `respond`。
- **2 桁ゼロ埋め が 2 箇所**: `lib/schedule/runAtInput.ts:13` の `pad`、`lib/video/formatVideoDuration.ts:16`（`padStart(2, "0")`）。
- **共有の責務が 5 フォルダ**: `util/share/intent.ts`（`buildIntentUrl`）、`lib/share/shareBody.ts`（`resolveShareBody`）、`lib/settings/shareSettings.ts`・`legacyShareSettings.ts`・`useShareToggles.ts`、`components/composer/ThreadComposer/shareDispatch.ts`（`runShareDispatch`）、`components/share/useWebShareCrosspost.ts`。
- **`env` 系モジュールが 8 件**: `env.ts`（直下）、`util/clientEnvironment.ts`、`lib/site/buildEnv.ts`、`lib/site/siteEnv.ts`、`lib/{feedback,oauth,schedule,survey}/env.ts`。

## Desired Outcome

- 同じ概念の実装は 1 箇所だけにあり、他はそれを使う。
- 文字数換算は、用途（投稿の制限・共有の文字数）ごとに 1 つの名前で呼ばれる。
- `env` 系モジュールは、役割（ビルド時・実行時・領域ごと）が名前から分かる。

## Approach

- 文字数換算: 2 つの計算の結果が同じ用途のものかを確かめ、用途ごとに 1 関数に統合する。用途が違うなら、名前で区別して両方残す。design で判断する。
- 応答の組み立て: 1 つの関数に寄せ、`pages` と `lib` の両方がそれを使う。
- ゼロ埋め: 共通の関数に寄せる（`util/` に置く）。
- 共有の責務: 所有を 1 つに決め（design で決める）、他はそれを呼ぶ。
- `env` 系: 役割を名前で分け、重複する読み取りを 1 箇所にまとめる。

## Scope

- **In**: 上記の重複の統合、`util/` の依存の向き（`util/textCount.ts` → `util/share/` の参照）の整理、`env` 系の役割の整理。
- **Out**: 文字数の上限そのもの、応答の形と状態コード、共有の文面（`external-sharing` の振る舞い）、環境変数の値。

## Boundary Candidates

- 文字数換算（`textCount`・`intentLength`）
- 応答の組み立て（4 箇所）
- 共有の責務（5 フォルダ）
- `env` 系（8 件）

## Out of Boundary

- 共有の仕様（`external-sharing` の振る舞い）
- 投稿の制限の仕様（`post-composition` の振る舞い）
- 環境変数の名前と値（`platform-runtime`・`ops-config-secrets`）

## Upstream / Downstream

- **Upstream**: `src-pages-thin`（`json200` の移動の後に応答を統合する）、`src-lib-ui-boundary`（フックの移動先）
- **Downstream**: `src-folder-layout`（共有の責務の配置が決まってから、フォルダを整える）

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `external-sharing`（共有の文字数と intent）、`post-composition`（投稿の文字数）、`scheduled-posting`（`runAtInput` の時刻）、`media-attachments`（動画の長さの表示）、`platform-runtime`（`env` の読み取り）、`api-contract`（応答の形）

## Constraints

- 文字数換算の結果（投稿の上限・共有の文字数）は変えない。unit テストで境界値を守る。
- 応答の形と状態コードは変えない。route テストで守る。
- 検証の基準 272 件が全通過すること。

## 追記（2026-11-03: share の統合先）

- 共有の責務（上の「5 フォルダ」）の統合先は、`lib/share/` に決まった（`util-placement` の決定）。`util/share/` は残さない。
- 純粋な文字数・URL・本文の組み立ては `lib/share/` に置く。`window.open`・`navigator.share` などのブラウザ副作用は、呼び出し側の部品（`components/share/IntentShareDialog/`）で組み立てる。
- 既存の内容は上の記録のとおり残す。この追記は、統合先の結論だけを補う。
