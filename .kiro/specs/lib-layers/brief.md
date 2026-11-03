# Brief: lib-layers

## Problem

`src/lib/` は 21 の領域と直下の 1 ファイル（`guestMode.ts`）がフラットに並び、基盤（認証・API・画像など、他の領域が土台にする物）と業務（予約・Entry・アンケートなど、機能そのもの）の区別がない。依存の向きは `structure.md` の表で規定されているが、どの層が上に来るかは示されていない。そのため、基盤が業務に依存していても表の上では見えない。

## Current State（2026-11-03 の実測）

- 領域: `i18n`(42)・`api`(40)・`schedule`(25)・`atproto`(22)・`entry`(17)・`survey`(15)・`oauth`(11)・`video`(9)・`timeline`(7)・`settings`(7)・`feedback`(7)・`site`(5)・`session`(5)・`platform`(4)・`image`(4)・`share`(2)・`codegen`(2)・`account`(1)・`draft`(1)・`legacy`(1)・`privacy`(1)（括弧内はファイル数）。
- **基盤から業務への依存（衝突）**:
  - `lib/api` → `lib/feedback`（`limits`・`submission`）
  - `lib/api` → `lib/survey`（`definition`・`pathParams`）
  - `lib/session/bskySessionRefresh.ts` → `lib/api`
- **1〜2 ファイルだけの領域**: `account`（session 情報の共有キャッシュ。利用元は多い）・`draft`・`privacy`・`legacy`・`codegen`（API クライアントの生成補助）・`share`（`util/share` と二分している）。

## Desired Outcome

- `lib/` の直下が「基盤」と「業務」の二つの層に分かれ、層の依存の向きが一方向になる（業務 → 基盤。基盤は業務を import しない）。
- 1〜2 ファイルの領域は、意味の近い領域へ統合される。
- `structure.md` の依存表と、`test:imports` の規則が新しい層を反映する。

## Approach（決定済み 2026-11-03: L-B 基盤と業務に二分）

- 基盤の候補: `atproto`・`oauth`・`session`・`i18n`・`platform`・`site`・`image`・`video`・`codegen`。
- 業務の候補: `entry`・`schedule`・`timeline`（guest を含む）・`survey`・`settings`・`feedback`・`draft`・`legacy`・`privacy`・`share`・`guestMode.ts`。
- `account` は `session` へ統合する（session 情報の共有キャッシュ）。
- 衝突の扱いは design で決める。候補は次のとおり。
  - (a) `lib/api` を「入口の契約」として、層の外（最上位）とみなす。`pages/`・`middleware` と同じ扱いにする。
  - (b) 衝突する型（`feedback/limits`・`feedback/submission`・`survey/definition`・`survey/pathParams`）を、基盤の層へ下ろす。
  - `bskySessionRefresh.ts` は、`lib/api` を経由しない形（処理の所在の見直し）を design で検討する。

## Scope

- **In**: 層の分類、1〜2 ファイル領域の統合、`structure.md` の依存表と領域一覧、`test:imports` の規則（層の方向）、移動と import の更新。
- **Out**: 振る舞い、API の入出力、大ファイルの分割（`lib-large-files`）、`util/` の移動（`util-placement`）、`components/` の配置。

## Boundary Candidates

- 層の分類（基盤・業務）
- 小さい領域の統合（`account`・`codegen`・`share` など）
- 依存の向きの規則（`structure.md` と検査）

## Out of Boundary

- `util/` の配置（`util-placement`）
- 大ファイルの分割（`lib-large-files`）
- 検査の追加（`structure-checks` で、この spec の規則を検査へ加える）

## Upstream / Downstream

- **Upstream**: なし
- **Downstream**: `util-placement`（`util/share` の統合先）・`lib-large-files`（移動先の確定）・`structure-checks`

## Existing Spec Touchpoints

- **Extends**: `src-import-rules`（依存の規則）・`src-cycles`（循環の禁止）
- **Adjacent**: `api-contract`（`lib/api` の契約）・`platform-runtime`（`lib/platform` の型）・`session-accounts`（`session`・`oauth`）

## Constraints

- 振る舞いは変えない。`npm run apigen` の出力に差分が出ないことを完了条件にする。
- 循環を作らない（`src-cycles` の規則を守る）。
- `structure.md` の依存表を改訂するときは、同じ変更で行う。
- `npm run test:all` の結果は、着手時の件数を下回らない。
