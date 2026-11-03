# Design Document

## Overview

**Purpose**: `src/components/` の小さい部品領域（`share`・`feedback`・`privacy`・`help`）について、利用元の実測に基づいて「統合する」か「残す」かを決め、判断の根拠を `structure.md` に記録する。

**Users**: 部品の置き場を読む開発者が、小さい領域が残っている理由と、判断の条件を確かめる。

**Impact**: 実測の結果、四つの領域はいずれも統合先を持たないため、部品の移動は行わない。変更は `structure.md` への判断の記録の追加に限られる。

### Goals

- 四つの領域のそれぞれについて、統合か残すかを利用元の実測に基づいて記録する
- 統合の条件を、既存の規則（`structure.md` の「利用元の内側に置く」）から一貫して導く
- `components/i18n` を移動せず、その理由を維持する
- 振る舞い・API・import・テストの結果を変えない

### Non-Goals

- 部品の表示・操作・文言の変更
- `components/common/` の分類の再編（Phase 4 で決定済み）
- `src/lib/`・`src/util/` の配置（`lib-layers`・`util-placement`）
- 大きいファイルの分割（`lib-large-files`）と骨格の移動（`layout-home`）
- 検査の追加（`structure-checks` が扱う）

## Boundary Commitments

### This Spec Owns

- 四つの小さい部品領域の判断（統合・残す）と、その判断の根拠の記録
- `structure.md` の、残す領域の理由の記述と、統合の判断の条件の記述
- 判断の根拠となる利用元の一覧（判断の時点の実測）

### Out of Boundary

- `components/i18n` の配置と import パス（移動しない）
- 部品の中身（表示・操作・文言・内部の `rules/`・`hooks/`）
- `components/common/` の分類と、`common/` への部品の移動
- `util/` からの移動（`util-placement` の成果を前提にする）
- 検査の仕組み（`componentLayout`・`steeringRegions`・`importRules` の変更）

### Allowed Dependencies

- `util-placement` の完了（`IntentShareDialog` が参照する `util/share/intent` などの import が移動済みであること）
- `structure.md` の「利用元の内側に置く」規則と、「規則の変更は同じ変更で」の規約
- 既存の検査（`tests/unit/scripts/componentLayout.test.ts`・`steeringRegions.test.ts`）

### Revalidation Triggers

- 四つの領域のいずれかの利用元が増減し、統合の条件を満たす、または満たさなくなったとき
- `structure.md` の「利用元の内側に置く」規則、または領域の一覧の記述が変わったとき
- `components/i18n` の位置づけが変わったとき
- `structure-checks` が部品の配置を検査する規則を追加したとき（判断の記録との整合を確かめる）

## Architecture

### Existing Architecture Analysis

- 部品フォルダの規則: 1 部品 1 フォルダ。利用元の内側に置く（利用元がすべて親の部品フォルダの内側にあるときだけ、子フォルダへ置く）。
- 現状の配置:
  - `components/share/IntentShareDialog/`: 利用元が `composer/ThreadComposer`（3 件）と `timeline/Timeline`（2 件）の二つの親にまたがる
  - `components/feedback/FeedbackForm/`・`components/privacy/PolicyCards/`: 利用元が `src/pages/` のみ
  - `components/help/Help/`: 利用元が `src/pages/help.astro` と、内側の `Help/HelpItem/`
- 既存の検査は、部品フォルダの外のファイルと領域の一覧だけを見る。現状の配置はすべて検査を通る。

### Architecture Pattern & Boundary Map

判断は次の一つの規則から導く（構造図は不要）。

```
利用元がすべて一つの親の部品フォルダの内側にある → 親の子フォルダへ統合
それ以外（複数の親にまたがる・`pages/` を含む）   → 現在の領域の直下に残す
```

**Architecture Integration**:

- Selected pattern: 判断の規則を一つにまとめ、四つの領域に機械的に当てはめる
- Domain/feature boundaries: 判断は `structure.md` に記録する。部品の内部は変えない
- Existing patterns preserved: 部品フォルダの規約、利用元の内側に置く規則、`common/` の基盤の定義
- New components rationale: 新しいコンポーネントは作らない
- Steering compliance: `structure.md` の規則の変更は、同じ変更で行う（本仕様は規則を変えず、判断の記録を追加する）

### Technology Stack

該当なし（配置と文書の変更のみ。新しい依存は加えない）。

## File Structure Plan

### Directory Structure

```
src/components/
├── share/IntentShareDialog/     # 残す（利用元: composer/ThreadComposer と timeline/Timeline にまたがる）
├── feedback/FeedbackForm/       # 残す（利用元: pages/feedback.astro）
├── privacy/PolicyCards/         # 残す（利用元: pages/privacy.astro）
├── help/Help/                   # 残す（利用元: pages/help.astro と内側の HelpItem）
└── i18n/                        # 移動しない（翻訳の入口）
```

### Modified Files

- `.kiro/steering/structure.md` — 「領域の判断の記録」の節を追加する。四つの領域それぞれについて、判断（残す）・利用元・理由を書く。`components/i18n` の残す理由（翻訳の入口）を、件数に依存しない形で維持する。領域の一覧（`components/<領域>` の記述）は変えない。

### 移動の有無

- 本仕様の判断では、部品の移動は発生しない。Requirements 5.2・5.3（移動に伴う import とテストの更新）は、判断が変わって移動が発生した場合にだけ適用する。

## Components and Interfaces

### 判断の規則（Placement Decision）

| Field        | Detail                                                           |
| ------------ | ---------------------------------------------------------------- |
| Intent       | 小さい部品領域の部品を、統合するか残すかを利用元の所在から決める |
| Requirements | 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4                           |

**Responsibilities & Constraints**

- 入力: 部品と、その部品を import しているファイルの一覧（`src/`・`tests/`・`scripts/`・`e2e/` の実測）
- 出力: 「統合（親の子フォルダ）」または「残す（現在の領域の直下）」の判断と理由
- 統合の条件: 利用元のすべてが、同じ親の部品フォルダの内側にあること
- 判断の時点: 実測の日付を記録する（2026-11-03）

**Dependencies**

- Inbound: なし（文書上の規則）
- Outbound: `structure.md` の判断の記録（Requirement 3）
- External: なし

**Implementation Notes**

- Integration: 判断の結果は `structure.md` の「領域の判断の記録」節に表で書く
- Validation: 既存の検査（`componentLayout`・`steeringRegions`）が通ること
- Risks: 判断の表が古くなる → Revalidation Triggers の再検討で更新する

### 判断の結果（2026-11-03 の実測）

| 領域       | 部品                                   | 利用元                                                         | 判断       | 理由                                                            |
| ---------- | -------------------------------------- | -------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| `share`    | `IntentShareDialog`                    | `composer/ThreadComposer`（3 件）・`timeline/Timeline`（2 件） | 残す       | 利用元が二つの親にまたがる                                      |
| `feedback` | `FeedbackForm`                         | `pages/feedback.astro`                                         | 残す       | 利用元が部品フォルダの外（`pages/`）のみ。統合先の親がない      |
| `privacy`  | `PolicyCards`                          | `pages/privacy.astro`                                          | 残す       | 同上                                                            |
| `help`     | `Help`（`HelpItem` は内側）            | `pages/help.astro`・`Help/HelpItem`                            | 残す       | 利用元に `pages/` を含む。`HelpItem` は既に `Help` の内側にある |
| `i18n`     | `useTranslation.ts`・`renderSlots.tsx` | 多数（件数は判断の根拠にしない）                               | 移動しない | 翻訳の入口（brief の決定）                                      |

## Requirements Traceability

| Requirement | Summary                                     | Components                            | Interfaces              | Flows |
| ----------- | ------------------------------------------- | ------------------------------------- | ----------------------- | ----- |
| 1.1         | 四つの領域の判断を一件ずつ記録              | 判断の結果の表                        | `structure.md` 判断の節 | —     |
| 1.2         | 利用元の一覧を根拠に含める                  | 判断の結果の表                        | 判断の表の「利用元」列  | —     |
| 1.3         | 実測（src・tests・scripts）に基づく         | Placement Decision                    | 実測の検索              | —     |
| 1.4         | 利用元が変わったら再検討し理由を記録        | Revalidation Triggers                 | 判断の節の更新          | —     |
| 2.1         | 単一の親の内側の利用元は統合                | Placement Decision                    | 統合の条件              | —     |
| 2.2         | 複数の親にまたがる利用元は残す              | Placement Decision                    | 統合の条件              | —     |
| 2.3         | `pages/` を含む利用元は残す                 | Placement Decision                    | 統合の条件              | —     |
| 2.4         | 「利用元の内側に置く」規則に従う            | Placement Decision                    | `structure.md` 規則     | —     |
| 3.1         | 残す領域の理由を `structure.md` に記録      | `structure.md` の判断の節             | 判断の表                | —     |
| 3.2         | 領域の一覧を判断と矛盾させない              | `structure.md` 領域の一覧（変更なし） | `steeringRegions` 検査  | —     |
| 3.3         | 統合の判断の記述を統合後の配置に合わせる    | `structure.md` 判断の節               | 判断の表                | —     |
| 4.1         | `components/i18n` を移動しない              | 判断の結果の表                        | —                       | —     |
| 4.2         | `components/i18n` の import パスを変えない  | —                                     | —                       | —     |
| 4.3         | `components/i18n` の残す理由を維持する      | `structure.md` 判断の節               | —                       | —     |
| 5.1         | 振る舞いを変えない                          | 変更範囲の限定（`structure.md` のみ） | —                       | —     |
| 5.2         | 移動時は import を同じ変更で更新            | 移動が発生した場合の手順              | —                       | —     |
| 5.3         | 移動時はテストの import を同じ変更で更新    | 移動が発生した場合の手順              | —                       | —     |
| 5.4         | `test:all` が終了コード 0・件数を下回らない | 検証                                  | `npm run test:all`      | —     |
| 5.5         | 部品フォルダの規約を変えない                | 変更範囲の限定                        | —                       | —     |
| 6.1         | `common/` の分類を再編しない                | Out of Boundary                       | —                       | —     |
| 6.2         | 部品の内部の判断を変えない                  | Out of Boundary                       | —                       | —     |
| 6.3         | `common/` へ移さず理由を記録                | 判断の表                              | —                       | —     |

## Testing Strategy

既存の検査で、配置の変更がないことを確かめる。新しいテストは追加しない。

- **Unit（静的検査）**: `tests/unit/scripts/componentLayout.test.ts` が、部品フォルダの外のファイルを例外の一覧と照合する（Requirements 2.4・5.5）
- **Unit（静的検査）**: `tests/unit/scripts/steeringRegions.test.ts` が、`structure.md` の領域の一覧と実装の領域の一致を確かめる（Requirement 3.2）
- **Import 検査**: `npm run test:imports` が、依存規則（循環・領域をまたぐ相対 import など）を通す（Requirement 5.1）
- **全体**: `npm run test:all` が終了コード 0 で完了し、件数が着手時の件数を下回らない（Requirement 5.4）
- **手動の確認**: `structure.md` の判断の表が、本仕様の判断の表と一致すること、および `components/i18n` の残す理由が件数に依存しないこと（Requirements 1.1・3.1・4.3）

## Error Handling

判断の対象は配置の記録であり、実行時の処理はない。判断の根拠（利用元の一覧）が実測と合わないときは、判断を取り消さず、実測を取り直して Revalidation Triggers に従って再検討する。

## Supporting References

- 実測の詳細と、統合候補の却下理由は `research.md` を参照する。
