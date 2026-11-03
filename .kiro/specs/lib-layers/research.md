# Research & Design Decisions

---

**Purpose**: `lib-layers` の設計判断の根拠（import の実測、衝突の解き方の比較、移動先の決定）を残す。
---

## Summary

- **Feature**: `lib-layers`
- **Discovery Scope**: Extension（既存の `src/lib/` の構成の組み替え。新しい外部依存なし）
- **Key Findings**:
  - 基盤から業務への import は、実測で `lib/api` → `lib/feedback`（2 ファイル: `typeCompat.ts`・`schema/v2/feedback/post.ts`）と `lib/api` → `lib/survey`（2 ファイル: `schema/v2/surveys/[surveyId]/path.ts`・`answers/post.ts`）。brief の 4 つの型・定数は実在する。brief に無い参照元として `typeCompat.ts`（`feedback/submission` の型）がある。
  - `lib/session/bskySessionRefresh.ts` → `lib/api/response` は、`lib/api` を基盤とすれば基盤どうしの依存で、層の違反ではない。
  - `src/client/openapi/client.ts`（生成物）が `lib/codegen/fetcher.ts` と `openapiFormData.ts` を相対 import している。`lib/codegen` を動かすと `npm run apigen` の出力が変わるため、`lib/codegen` は移動しない。
  - `lib/api` は `lib/schedule`（`stageSchedule.ts`・`validateSchedule.ts`）からも import されている。`lib/api` を入口側（最上位）とみなすと、業務から入口への依存が複数残るため、基盤とみなす（後述の決定 1）。

## Research Log

### 実測: `src/lib/` 領域どうしの import 辺

- **Context**: brief の「衝突」の一覧が実装と一致するかを確かめる。
- **Sources Consulted**: `src/lib/**/*.ts(x)` の `from "@/lib/<領域>"` と `import("@/lib/...")`（2026-11-03 時点の作業ツリー）。
- **Findings**:
  - `api → atproto・image・oauth・video・util・codegen`（基盤どうし）、`api → feedback`（`submission`・`limits`）、`api → survey`（`definition`・`pathParams`）。
  - `schedule → api`（`stageSchedule.ts`・`validateSchedule.ts` が `api/schema/v2/schedules/post` の型と値を使う）。
  - `session → api`（`bskySessionRefresh.ts` の `resolveXrpcStatus` のみ）。
  - `survey → guestMode`（`lib` 直下の 1 ファイル）。`guestMode → timeline`。`timeline → entry`。業務どうしの辺は閉路を作らない。
  - 基盤の領域（`atproto`・`oauth`・`image`・`video`・`i18n`・`site`・`platform`・`session`・`codegen`）から業務への辺は、`api` の 2 系統と `session → api` 以外にない。
- **Implications**: 衝突の本体は `lib/api` が業務の型と値を参照している点。`lib/api` の層の決め方で、解き方が決まる。

### 比較: `lib/api` の層の決め方（決定 1）

- **Context**: `lib/api` を基盤とみなすか、入口（最上位）とみなすか。brief の (a) と (b)。
- **Alternatives Considered**:
  1. (a) `lib/api` を入口とみなし、`pages/`・`middleware` と同じ外側に置く。
  2. (b) `lib/api` を基盤とし、業務の型・値（`feedback/limits`・`feedback/submission`・`survey/definition` の識別子・`survey/pathParams`）を、基盤の側（`lib/api/contract/`）へ下ろす。
- **Selected Approach**: (b)。
- **Rationale**: (a) では、`lib/schedule` の 2 ファイルが `lib/api` の型を使っているため、業務 → 入口の依存が残る。さらに `session → api` も基盤から入口への依存になる。層は三つになり、`structure.md` の「業務 → 基盤」の一方向の規則を外側の層の規則で書き直すことになる。(b) は、移す物が 4 つのファイル（定数・型・スキーマ 1 組）に限られ、`lib/api` が依存するのは基盤だけになる。
- **Trade-offs**: `lib/api/contract/` の中に、入力の制約値（件名の文字数上限など）が入る。API と画面が同じ値を使う目的は変わらないが、`api` 領域の責務が「契約（入出力の形と制約）」まで広がる。
- **Follow-up**: `lib/api/contract/feedbackLimits.ts` が、画面のバンドルに入っても重い依存を持たないことを確かめる（現状の `feedback/limits.ts` と同じ内容のため、依存は増えない）。

### 比較: `bskySessionRefresh.ts` → `lib/api/response`（決定 2）

- **Context**: brief は「`lib/api` を経由しない形（処理の所在の見直し）」を検討する。
- **Alternatives Considered**:
  1. `resolveXrpcStatus` を `lib/atproto` へ移し、`session` が `lib/api` を参照しないようにする。
  2. 現状の依存を残す（基盤どうしの依存として許可する）。
- **Selected Approach**: 2。
- **Rationale**: 決定 1 で `lib/api` は基盤になるため、この辺は層の違反ではない。`resolveXrpcStatus` は `pages/` の 4 ファイルでも使われ、移すと `lib/api/response` を参照する経路が増える。振る舞いを変えないことを優先する（要件 5.1）。
- **Trade-offs**: `session` → `api` の辺が残る。`api` が `session` を参照しない限り閉路にはならない（確認済み）。

### 比較: 1〜2 ファイル領域の扱い（決定 3）

- **Context**: `account`・`draft`・`privacy`・`legacy`・`codegen`・`share` の統合先。
- **Findings と決定**:

| 領域      | ファイル                            | 利用元                                                          | 決定               | 理由                                                                                             |
| --------- | ----------------------------------- | --------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| `account` | `activeAccountSession.ts`           | 11 件（components）                                             | `session` へ統合   | brief の決定。session 情報の共有キャッシュ                                                       |
| `draft`   | `draftList.ts`                      | 2 件（composer）                                                | `timeline` へ統合  | 一覧の整形（`timeline/` の責務）。`lib` の依存を持たない                                         |
| `privacy` | `policySections.ts`                 | 1 件（components/privacy）                                      | `site` へ統合      | `siteConfig`（運用者情報）から文面を組み立てる。依存は `i18n`・`site`                            |
| `legacy`  | `pagedb.ts`                         | 3 件（pages 2・test 1）                                         | `entry` へ統合     | 旧 pageDB の公開ページの取得と削除。Entry（公開ページ）と同じ利用者向けの表示                    |
| `codegen` | `fetcher.ts`・`openapiFormData.ts`  | 生成物 `src/client/openapi/client.ts`・`config/orval.config.ts` | 残す（理由を記録） | 生成物の import 経路と orval の設定に現れる。移すと `apigen` の出力が変わる（要件 5.2 に反する） |
| `share`   | `shareBody.ts`・`counterReserve.ts` | 多数（components）                                              | 残す（理由を記録） | `util-placement` が `util/share` を `lib/share` へ統合する。統合後は 2 ファイルを超える          |

- **Implications**: `codegen` は基盤のまま独立する。`share` は業務のまま残す（`share → settings`・`share → atproto` は業務 → 基盤・業務のみ）。

### 規則の表現（決定 4）

- **Context**: `test:imports` で層の方向を検査する方法。
- **Alternatives Considered**:
  1. `structure.md` の表を読み込んで検査する（規約の正を一つにする）。
  2. 層の対応表を `scripts/architecture/` のコードに持ち、`structure.md` の表と一致することを別のテストで確かめる。
- **Selected Approach**: 2。
- **Rationale**: 既存の検査（`regions.ts`・`rules.ts`）は、文字列の規則を TypeScript の定数で持つ構成になっている。Markdown の表を解析する仕組みを新しく入れるより、既存の構成に合わせる。`steeringRegions.test.ts` と同じ考え方で、規約と実装の差はテストで検出する。
- **Follow-up**: 対応表の更新と `structure.md` の更新は同じ変更で行う（`structure.md` の「規則の変更は同じ変更で」）。

## Architecture Pattern Evaluation

| Option                   | Description                                      | Strengths                                        | Risks / Limitations                                               | Notes |
| ------------------------ | ------------------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------- | ----- |
| 二層（基盤・業務）       | `lib/` を基盤と業務に分け、業務 → 基盤だけを許す | 規則が一つで済む。既存の依存の多くがそのまま従う | `lib/api` の位置の決め方が必要                                    | 採用  |
| 三層（基盤・業務・入口） | `lib/api` を入口とみなす                         | `api` の依存を自由にできる                       | 業務 → 入口の辺（`schedule`）と基盤 → 入口の辺（`session`）が残る | 却下  |

## Design Decisions

（上記「Research Log」の決定 1〜4 を参照。`design.md` の Boundary Commitments と File Structure Plan に反映する。）

## Risks & Mitigations

- 移動に伴う import の書き漏れ — `npm run test:type` と `npm run test:imports`（解決できない import を失敗にする）で検出する。
- 生成物の差分 — `npm run apigen` を実行し、`src/client/openapi/` と OpenAPI 文書に差分が無いことを確かめる。
- 検査の基準の崩れ — 着手前に `npm run test:all` の件数を記録し、各段階で下回らないことを確かめる。
- `survey/definition` の識別子を `api/contract` へ移すと、`scripts/survey/render-survey-config.ts`（Node）の読み込みが変わる — zod の指定子（`zod`）を変えず、同じ依存で読めることを `test:unit` の fixture テストで確かめる。

## References

- `.kiro/steering/structure.md` — 依存の向きと依存規則の検査（本仕様の改訂対象）
- `scripts/architecture/rules.ts`・`scripts/architecture/regions.ts` — 検査の規則と領域の判定
- `tests/unit/scripts/steeringRegions.test.ts`・`tests/unit/scripts/libRegionPairs.test.ts` — 領域の一覧と閉路の既存の検査
