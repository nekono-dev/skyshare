# Brief: lib-large-files

## Problem

400 行を超えるファイルが 7 件あり、一つのファイルに複数の責務が入っている。変更の影響範囲を読み取りにくく、テストの対象も分かれにくい。

## Current State（2026-11-03 の実測。行数）

- `lib/image/postImageProcessing.ts`（856）
- `lib/settings/shareSettings.ts`（718）
- `lib/schedule/store.ts`（676）
- `lib/timeline/guest/posts.ts`（643。ダミーデータが中心）
- `lib/session/cookies.ts`（443）
- `lib/survey/gate.ts`（415）
- `util/textarea/contentEditableModel.ts`（426。移動先は `util-placement` で決まる）

## Desired Outcome

- 上記 7 件が、責務ごとに分かれたファイルになる。どのファイルも、目安として 400 行以下になる。
- 分割の前後で、外から見た振る舞い（export の名前と戻り値）は変わらない。

## Approach

- 責務の境界で分割する。分割の単位は design で決める（例: 純粋な判断と、外部への入出力を分ける）。
- `guest/posts.ts` のダミーデータは、データだけのファイルとして分ける。判断の関数は含めない。
- 分割の後、外向きの import は `index.ts` で再エクスポートし、呼び出し側の変更を最小にする（ただし `structure.md` の import 規約は守る）。

## Scope

- **In**: 上記 7 件の分割、分割後の import の更新、テストの import の更新。
- **Out**: 振る舞いの変更、責務の再設計、`lib` の層の分類（`lib-layers`）、`util` の移動（`util-placement`）。

## Boundary Candidates

- 7 件それぞれの分割（相互に依存しない）

## Out of Boundary

- 新しい機能の追加、既存の契約の変更。
- 生成物（`src/client/openapi/`）。

## Upstream / Downstream

- **Upstream**: `lib-layers`（移動先の層が決まってから）・`util-placement`（`contentEditableModel.ts` の移動）
- **Downstream**: `structure-checks`（400 行の上限を検査する場合の基準）

## Existing Spec Touchpoints

- **Extends**: `src-composer-split`（部品の分割の方式を参考にする）
- **Adjacent**: `media-attachments`（`postImageProcessing`）・`settings`（`shareSettings`）・`scheduled-posting`（`schedule/store`）・`session-accounts`（`cookies`）・`surveys`（`gate`）・`timeline-browsing`（`guest/posts`）・`post-composition`（`contentEditableModel`）

## Constraints

- 振る舞いは変えない。分割の前後でテストの件数と結果を比べる。
- `npm run test:all` の結果は、着手時の件数を下回らない。
- 分割の 1 件ずつを、別のコミットにする。
