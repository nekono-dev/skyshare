# Brief: naming-rule

## Problem

`src/lib/` の接頭辞（`create`・`build`・`resolve`）が、非同期（I/O）と純粋の両方で使われており、名前から副作用の有無が分からない。規則がないため、新しい関数でも同じばらつきが増える。

## Current State（2026-11-05 の実測）

- `build`: 23 件中 22 件が純粋（同期）。
- `resolve`: 25 件のうち非同期が 6 件（例: `resolveEntryDeleteScope`）。
- `create`: 23 件のうち非同期（I/O）が 12 件、純粋が 11 件（例: `createImageEmbed` は純粋）。
- 規則は steering に書かれていない（`structure.md` の「既知の不一致」に記録のみ）。

## Desired Outcome

- steering の命名の節に、接頭辞の規則（`build`・`resolve`・`create`・`load`）が書かれている。
- 規則に合わない既存の名前の一覧（改名の対象）が、この spec の記録にある。名前は変えない。

## Approach（利用者の決定 2026-11-05）

- `build`: 同期・純粋な値の組み立て（I/O なし）
- `resolve`: 同期・純粋な決定（判定・選択）
- `create`: 副作用を伴う作成（D1・R2・外部 API への新規作成）。副作用がなければ `build`
- `load`（新設）: 非同期の読み取りを伴う処理

## Scope

- **In**: `structure.md` の命名の節への規則の追記、規則に合わない名前の一覧の作成、規則を検査する方法（既存の検査で足りるかの判断）。
- **Out**: 名前の変更（各領域の spec で行う）、`create`・`build`・`resolve` 以外の接頭辞。

## Boundary Candidates

- 規則の文書（steering）
- 不一致の一覧（改名の対象）

## Out of Boundary

- 関数の改名と import の書き換え（`naming-atproto` 以降）。
- 振る舞いの変更。

## Upstream / Downstream

- **Upstream**: なし
- **Downstream**: `naming-atproto`・`naming-timeline-entry`・`naming-share-image`・`naming-oauth-site-survey`・`naming-settings-misc`

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `structure-checks`（規則の検査を足すかどうかの判断）

## Constraints

- 規則は steering の命名の節に書く（structure.md が正）。
- 規則の変更は、この spec の改訂と同じ変更で行う。
