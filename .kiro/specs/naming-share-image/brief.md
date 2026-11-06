# Brief: naming-share-image

## Problem

lib/share と lib/image の接頭辞（`create`・`build`・`resolve`）が、規則のない命名のまま使われている。名前から副作用の有無が分からない。

## Current State（2026-11-05 の実測）

- 対象: lib/share と lib/image の `create`・`build`・`resolve` で始まる export（14 件）。
- 規則の内容は `naming-rule` の spec と steering の命名の節に従う。

## Desired Outcome

- 対象の export が規則（`build`・`resolve`・`create`・`load`）に合う名前になっている。
- 改名の前後で export の件数が変わらず、`npm run test:all` が終了コード 0。

## Approach

- 規則に合う名前に改名する。import とテストの参照を書き換える。
- 改名の対象は、同じ領域の内側で完結させる（領域をまたぐ参照は、同じ変更で書き換える）。

## Scope

- **In**: 対象の export の改名、その import とテストの書き換え。
- **Out**: 振る舞いの変更、対象外の接頭辞、対象外の領域。

## Boundary Candidates

- 対象の領域の export とその参照

## Out of Boundary

- 規則そのものの変更（`naming-rule` で扱う）。
- 他の領域の関数。

## Upstream / Downstream

- **Upstream**: naming-timeline-entry
- **Downstream**: 次の領域の spec（Specs の依存順）

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: 対象の領域の既存の spec

## Constraints

- 振る舞いは変えない。改名の前後で `npm run test:all` の件数が変わらない。
- 規則に合わない名前を残す場合は、理由を書く。
