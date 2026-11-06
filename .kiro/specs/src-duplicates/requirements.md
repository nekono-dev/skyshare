# 要件書

## 概要

同じ概念の実装が複数の場所にあり、どれが正しいかを読む人が判断できない。この spec は、重複している実装を 1 箇所に寄せ、他はそれを使うようにする。利用者に見える振る舞い（文字数の表示、共有の結果、応答の形とヘッダー、環境変数の読み取り）は変えない。

2026-11-01 の確認（brief の実測を、現在のコードで照合した結果）:

- **X の文字数の計量**: `util/textCount.ts` の `countWeightedTweetLength` と、`util/share/intentLength.ts` の `xIntentMeasure` は、どちらも `twitter-text` の `weightedLength` を使う。前者は 2 で割って切り上げ、後者はそのまま返す。割る処理は、呼び出し側（`lib/share/counterReserve.ts`）でも行われる。
- **JSON 応答の組み立て 4 関数**: `lib/schedule/scheduleResponse.ts` の `jsonResponse`（`cache-control: no-store` を付与）、`pages/v2/entry.ts` の `json200`、`pages/v2/bsky/session/authorization/completion.ts` の `respond`、`util/http.ts` の `errorResponseFromStatus`。ヘッダーがそれぞれ異なる。
- **2 桁のゼロ埋め**: `lib/schedule/runAtInput.ts` の `pad` と、`lib/video/formatVideoDuration.ts`（秒と分の表示）。
- **共有の関係するモジュール**: 投稿先・本文・intent・設定が、複数のフォルダに分かれている。役割が違うため、重複ではなく分担である。`lib/settings/legacyShareSettings.ts` は、旧設定の移行用の一時的なモジュールで、利用者の移行の後に削除する前提である。
- **環境変数を読むモジュール**: `env.ts`・`util/clientEnvironment.ts`・`lib/site/buildEnv.ts`・`lib/site/siteEnv.ts`・`lib/{feedback,oauth,schedule,survey}/env.ts` の 8 件。

用語:

- **重複**: 同じ値を同じ規則で求める実装が、2 箇所以上にあること。
- **応答の形**: 状態コード、本文、ヘッダー。

<!-- Optional when scope could be misread or the feature touches adjacent systems/specs -->

## 境界の文脈

- **対象内**: 上の重複の統合（X の計量、JSON 応答の組み立て、ゼロ埋め）。旧共有設定の移行モジュールの削除（とその呼び出し、テスト）。環境変数を読むモジュールの重複の解消。
- **対象外**: 文字数の上限そのもの（`post-composition`）。応答の形と状態コード、ヘッダーの値（`api-contract`）。共有の文面と intent の振る舞い（`external-sharing`）。環境変数の名前と値（`platform-runtime`・`ops-config-secrets`）。共有の責務の所有者の決定（design で決める）。
- **隣接する期待**: 旧共有設定の移行モジュールを削除すると、旧キー（移行前の保存値）を持つ利用者は、移行されずに既定値の表示になる。この影響は、利用者の承認のもとで受け入れる。

## 要件

### 1. 文字数の計量の一本化

**目的:** 利用者として、投稿と共有の文字数の表示が、今までどおりであってほしい。投稿の上限を越えるかどうかの判断が変わらないようにするため。

#### 受入基準

1. When 利用者が投稿の本文を入力したとき, the 投稿フォーム shall 移動の前と同じ X の文字数（半角換算の 2 で割った切り上げ）を表示する。
2. When 利用者が共有の本文を組み立てたとき, the 共有 shall 移動の前と同じ長さで本文を切り詰める（intent の文字数の計量を変えない）。
3. The 実装 shall X の重み付けの長さを求める規則を 1 箇所に持ち、投稿の表示と共有の切り詰めは、その規則を使う。

### 2. JSON 応答の組み立ての一本化

**目的:** 利用者として、API の応答の形とヘッダーが、今までどおりであってほしい。キャッシュの扱いが変わらないようにするため。

#### 受入基準

1. When API が JSON の応答を返すとき, the API shall 移動の前と同じ状態コード、本文、ヘッダー（`cache-control` を含む）を返す。
2. The 実装 shall JSON 応答の組み立てを 1 つの関数で行い、ヘッダーの値は呼び出し側が引数で渡す。
3. If エラーの応答を返すとき, the API shall 移動の前と同じ状態コードと本文を返す。

### 3. 2 桁のゼロ埋めの一本化

**目的:** 開発者として、時刻と長さの 2 桁表示の規則が 1 箇所にあってほしい。表示の違いを読まずに済むようにするため。

#### 受入基準

1. The 実装 shall 2 桁のゼロ埋めを 1 つの関数で行う。
2. When 0 から 99 までの値が表示されるとき, the 表示 shall 移動の前と同じ文字列（例: `5` は `05`）を示す。

### 4. 旧共有設定の移行モジュールの削除

**目的:** 開発者として、用済みの移行の経路を読まずに済むようにしたい。旧設定の処理が残らないようにするため。

#### 受入基準

1. When 旧共有設定の移行モジュールを削除したとき, the 実装 shall そのモジュール、テスト、呼び出し（`shareSettings` の 1 行）を取り除く。
2. The 共有設定 shall 移行の対象外になる利用者（旧キーのみを持つ利用者）に、既定値を示す。
3. When 利用者が移行の済んだ設定を持つとき, the 共有設定 shall 移動の前と同じ値を示す。

### 5. 環境変数の読み取りの一本化

**目的:** 開発者として、同じ環境変数を読む場所が 1 つであってほしい。値の食い違いを防ぐため。

#### 受入基準

1. The 実装 shall 同じ環境変数を読むモジュールを 2 つ以上持たない。
2. When 環境変数が読まれるとき, the 実装 shall 移動の前と同じ値を返す。

### 6. 既存の検証と振る舞いの不変

**目的:** 開発者として、重複の統合が安全に行われたと確かめたい。テストの件数と検査の結果が後退しないようにするため。

#### 受入基準

1. The 変更 shall 既存のテストの期待値を変えず、変更は import パス・統合後の関数名・削除したモジュールのテストだけにする。
2. The 変更 shall `npm run test:all` が終了コード 0 で通過し、件数が基準（unit 297・component 13・route 200・render 2・e2e 7）を下回らない。unit の基準は、旧共有設定の移行を削除したことに伴い 257 から 297 に改めた（利用者の承認）。
3. The 変更 shall 利用者に見える画面と操作（e2e 7 件）の振る舞いを変えない。
