# Brief: api-contract

## Problem

利用者向け API（`src/pages/v2/**`）は多数あり、入力の検証・エラーの形・生成クライアントの作り方が endpoint ごとに決まると、画面と API がずれる。契約の構成を一か所で定める必要がある。

## Current State

- `src/lib/api/schema/`: endpoint ごとの zod スキーマ。ディレクトリは `src/pages/` の経路と対応する（`schema/v2/feedback/post.ts` ↔ `pages/v2/feedback.ts`）。`_surveyId`・`_id` のように動的パスは `_` 付き。
- 命名: `RequestHeaderType`・`RequestBodyType`・`PathParamsType`・`QueryParamsType`・`ResponseBody200Type` などの型を生成する（件数: ResponseBodyN 23、RequestBody 17）。
- `src/lib/api/response.ts`: `errorResponseFromStatus` が標準のエラー応答を作る。atproto の例外を HTTP ステータスへ正規化する。
- `scripts/build-openapi-document.ts` が `openapi/generated.json` を作り、`orval.config.ts` が `src/client/openapi/`（client.ts・model/）を生成する。`openapiFormData.ts` は multipart の変換。
- `src/lib/codegen/fetcher.ts`: 生成クライアントの転送先を差し替える（legacy backend・OGP 抽出サービス）。転送直前に末尾のスラッシュを除く。
- `src/util/http.ts`（`convertHeaderToObj` など）・`src/util/formData.ts`。
- `src/lib/api/schema/**` は生成ツール（`jiti`）から相対 import されるため、`@/` エイリアスの大きなモジュールを読ませない（`threadLimit.ts` と `postVideoLimits.ts` が理由を書いている）。

## Desired Outcome

- schema の構成（経路との対応、命名、共通部品 `common.ts`）が記録されている。
- 標準エラー応答と HTTP ステータスの対応が記録されている。
- 生成の手順と、生成物を手で編集しないことが記録されている。
- 転送の規則（末尾スラッシュ、外部サービスへの差し替え）が記録されている。

## Approach

契約の構成、エラーの形式、生成と転送を所有する。個々の endpoint の業務の仕様は、それぞれの spec が所有する。

## Scope

- **In**: schema の構成、標準エラー応答、OpenAPI 生成、生成クライアント、転送規則、multipart、HTTP ヘルパー。
- **Out**: 個々の endpoint の仕様、生成物 `src/client/openapi/` の手編集、外部サービスの内部。

## Boundary Candidates

- schema と共通部品（schema/common.ts・schema/index.ts）
- エラー応答（response.ts）
- 生成と転送（codegen/・client/・orval.config.ts・scripts/build-openapi-document.ts）
- HTTP ヘルパー（util/http.ts・util/formData.ts）

## Out of Boundary

- 個々の endpoint の業務（各 spec）、外部サービス

## Upstream / Downstream

- **Upstream**: なし（`atproto-records` が schema の共通型を参照する）。
- **Downstream**: 全 API を持つ spec。

## Existing Spec Touchpoints

- **Extends**: なし。
- **Adjacent**: atproto-records（`common.ts` の型を参照する）、各機能 spec（endpoint の所有）。

## Constraints

- 生成物は手で編集しない（再生成で消える）。
- `schema/**` は `@/` 依存の大きいモジュールを import しない。
- 既知の不一致: `src/lib/api/schema/v1/extract/get.ts` に対応する route が無い（`legacy-posts` で扱いを確認する）。
