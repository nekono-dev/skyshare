# Design Document

## Overview

**Purpose**: 骨格（ページの枠）の `Baselayout.astro` を `src/layout/` から `src/components/layout/` へ移し、骨格の置き場を一つにする。
**Users**: 保守する開発者が、骨格の場所を一か所で把握できるようになる。
**Impact**: `src/layout/` を廃止し、骨格を `src/components/layout/Baselayout/index.astro` に置く。`src/pages/` の 13 ファイルの import と、`components/layout/README.md` の参照を更新する。出力する HTML と振る舞いは変えない。

### Goals

- 骨格のファイルが `src/components/layout/` 配下だけにある
- `src/layout/` が存在しない
- 移動の前後で `npm run build` の HTML が全ページで一致する
- `npm run test:all` が終了コード 0 で、件数が着手時を下回らない

### Non-Goals

- 骨格の中身（表示・スクリプト・props・翻訳キー）の変更
- `components/layout/` 内の部品（Sidebar・FooterNav・Metadatas・AnalyticsTag・nav・NavIcon・StandaloneFooter）の再編
- `pages/` と `src/` 直下の配置の変更
- `structure-checks` の検査の追加（本 spec は検査を追加しない）

## Boundary Commitments

### This Spec Owns

- 骨格 `Baselayout` の配置（`src/components/layout/Baselayout/index.astro`）
- 骨格を読み込む import の参照（`src/pages/` の 13 ファイル）
- 骨格の配置を説明する文書（`components/layout/README.md` の参照、`structure.md` の骨格の記述、`roadmap.md` の探査の根拠の骨格の行）

### Out of Boundary

- 骨格の中身（HTML 出力・翻訳・ミドルウェア連携・`ClientRouter`）
- `components/layout/` 内の部品の配置と中身
- `pages/` の画面の構成（骨格の import 以外の変更）と `src/` 直下のファイル
- `componentLayout` などの検査ロジック（既存のまま使い、変えない）

### Allowed Dependencies

- `Baselayout` は `@/components/layout/Metadatas/index.astro`・`@/lib/i18n/translate`・`@/vars`・`@/components/schedule/AuthorizationReturn`・`@/styles/ui.module.css`・`astro:transitions` に依存する（移動の前後で変えない）
- `src/pages/` の各画面は `Baselayout` を import する（依存の向きは変えない）

### Revalidation Triggers

- 骨格の置き場（パス）の変更（`structure-checks` の検査と、`pages/` の import に影響する）
- 骨格の props・slot の変更（全画面に影響する）
- `components/layout/` の部品フォルダの規約の変更

## Architecture

### Existing Architecture Analysis

- 骨格は `src/layout/` に 1 件だけあり、`components/layout/` の部品（`Metadatas`・`Sidebar`・`FooterNav` など）を使う。
- `components/` は 1 部品 1 フォルダの規約を持ち、`tests/unit/scripts/componentLayout.test.ts` が部品フォルダの外のソースを検査する。
- `Baselayout` は `@/` の絶対 import だけを使い、相対 import を持たない。このため移動してもパスの解決は変わらない。

### Architecture Pattern & Boundary Map

移動だけを行うため、新しいパターンは導入しない。骨格は `components/layout/` の部品フォルダの一つになる。

- Selected pattern: 部品フォルダ（1 部品 1 フォルダ）。`index.astro` を部品の入口にする。
- Domain boundaries: 骨格は `components/layout/` の基盤として、`pages/` から import される。
- Existing patterns preserved: 部品の規約、`@/` の絶対 import、`index.astro` を入口とする部品フォルダ
- Steering compliance: `structure.md` の部品の規約と `componentLayout` の検査に適合する（直置きは不適合）

### Technology Stack

| Layer    | Choice / Version | Role in Feature            | Notes            |
| -------- | ---------------- | -------------------------- | ---------------- |
| Frontend | Astro（既存）    | 骨格の `.astro` の配置変更 | 新しい依存はない |
| Tooling  | git（既存）      | `git mv` による移動        | 履歴を残す       |

## File Structure Plan

### Directory Structure

```
src/
├── layout/                                  # 移動の後に削除する（空にする）
└── components/
    └── layout/
        ├── README.md                        # 骨格の参照先を更新する
        ├── Baselayout/
        │   └── index.astro                  # 移動した骨格（中身は変えない）
        ├── AnalyticsTag/ ...                # 既存（変更なし）
        ├── FooterNav/ ...                   # 既存（変更なし）
        ├── Metadatas/ ...                   # 既存（変更なし）
        ├── nav/ ...                         # 既存（変更なし）
        ├── NavIcon/ ...                     # 既存（変更なし）
        ├── Sidebar/ ...                     # 既存（変更なし）
        └── StandaloneFooter/ ...            # 既存（変更なし）
```

### Modified Files

- `src/layout/Baselayout.astro` → `src/components/layout/Baselayout/index.astro` — `git mv` で移動する。中身は変えない。
- `src/pages/*.astro`・`src/pages/entries/*.astro`・`src/pages/entries/[slug].astro`・`src/pages/posts/[dbIndex]/[slug].astro`（13 ファイル） — import を `@/layout/Baselayout.astro` から `@/components/layout/Baselayout/index.astro` へ変更する。
- `src/components/layout/README.md` — 12 行目の `src/layout/Baselayout.astro` を新しい参照先へ変更する。
- `.kiro/steering/structure.md` — 骨格（`layout`）の記述に、置き場が `components/layout/Baselayout/` であることを一文で示す。この一文は、部品の節の「画面全体で共有する部品は `common`（UI 部品）、`layout`（骨格）」の文の直後に一箇所だけ書く（骨格の記述の唯一の場所。structure-checks 5.1 はこの一文を参照し、重複して書かない）。`structure.md` の編集は lib-layers の完了の後に行う（同じ文書を lib-layers が改訂するため）。
- `.kiro/steering/roadmap.md` — 「探査の根拠」の骨格の行（`src/layout/Baselayout.astro` と `src/components/layout/`）を、移動の後の配置に合わせる。Phase 5 の見出しと Phase 1 の項目は変えない。

## Requirements Traceability

| Requirement | Summary                                                    | Components                      | Interfaces                                   | Flows          |
| ----------- | ---------------------------------------------------------- | ------------------------------- | -------------------------------------------- | -------------- |
| 1.1         | 骨格が `components/layout/` 配下だけにある                 | `Baselayout/index.astro`        | ファイルの配置                               | 移動           |
| 1.2         | `src/layout/` が存在しない                                 | 移動の後の削除                  | ディレクトリの配置                           | 移動           |
| 1.3         | 移動が履歴を保つ                                           | `git mv`                        | Git の履歴                                   | 移動           |
| 1.4         | 画面が新しい置き場から骨格を import する                   | `src/pages/*`（13 件）          | `@/components/layout/Baselayout/index.astro` | 画面の描画     |
| 1.5         | 旧パスの参照を残さない                                     | 全文検索                        | 参照の一覧                                   | 移動の後の確認 |
| 2.1         | 移動の前後で HTML が一致する                               | `npm run build` の出力          | `dist/` の比較                               | 検証           |
| 2.2         | 画面の構成が変わらない                                     | 骨格の中身（変更なし）          | —                                            | 検証           |
| 2.3         | 骨格の中身を変えない                                       | `Baselayout/index.astro` の差分 | —                                            | 検証           |
| 3.1         | `structure.md` が骨格の置き場を `components/layout` と示す | `structure.md`                  | 文書                                         | 文書の更新     |
| 3.2         | `roadmap.md` の骨格の記述が移動の結果と整合する            | `roadmap.md` の探査の根拠       | 文書                                         | 文書の更新     |
| 3.3         | `README.md` が新しい参照先を示す                           | `components/layout/README.md`   | 文書                                         | 文書の更新     |
| 3.4         | 旧パスを現行の配置として書かない                           | 文書の全文検索                  | —                                            | 文書の確認     |
| 4.1         | `npm run test:all` が終了コード 0 で終わる                 | テストの全体                    | —                                            | 検証           |
| 4.2         | テスト件数が着手時を下回らない                             | テストの全体                    | 件数の記録                                   | 検証           |
| 4.3         | 旧パスを import するテストを新パスへ更新する               | テスト（該当なし）              | —                                            | 検証           |

## Components and Interfaces

本 spec で新しく境界を持つ部品はない。変更は既存の骨格の配置だけである。

| Component  | Domain/Layer | Intent                                         | Req Coverage            | Key Dependencies                           | Contracts                           |
| ---------- | ------------ | ---------------------------------------------- | ----------------------- | ------------------------------------------ | ----------------------------------- |
| Baselayout | UI（基盤）   | 全画面の HTML 骨格を提供する（中身は変えない） | 1.1, 1.2, 1.3, 2.2, 2.3 | Metadatas (P0), Sidebar・FooterNav（間接） | 既存の props と slot をそのまま維持 |

### Baselayout（移動）

**Implementation Notes**

- Integration: 中身（props・slot・スクリプト・import）を変えない。`import` は `@/` の絶対パスのままで解決先が変わらない。
- Validation: 移動の前後で `npm run build` の HTML を比較する（要件 2.1）。
- Risks: 部品フォルダの形（`index.astro`）にすることで、`componentLayout` の検査に適合させる。

## Testing Strategy

検査の対象は配置と出力であり、振る舞いの新しいテストは追加しない。

- **出力の一致（要件 2.1）**: 移動の前に `npm run build` を実行し、`dist/` の HTML を退避する。移動の後に再度 build し、全ページの HTML を比較して差分が無いことを確かめる。
- **部品規約（要件 1.1・1.2）**: `tests/unit/scripts/componentLayout.test.ts` が移動の後も通ることを確かめる（直置きでないことの検査）。
- **参照の一掃（要件 1.5・3.4）**: `grep` で `src/layout`・`@/layout` を `.kiro/specs/` を除いて検索し、0 件であることを確かめる。
- **全体の検証（要件 4.1・4.2）**: 着手の前に `npm run test:all` の件数を記録し、移動の後に終了コード 0 と、件数が記録以上であることを確かめる。
- **import の検査（要件 4.3）**: 旧パスを import するテストは存在しない（`Baselayout` の render テストなし）ため、更新は不要。`npm run test:imports` が通ることを確かめる。

## Migration Strategy

1. 着手前に `npm run test:all` の件数を記録し、`npm run build` の HTML を退避する。
2. `git mv` で骨格を移動し、`src/layout/` を削除する。
3. `src/pages/` の 13 件と `components/layout/README.md` を更新する。
4. `structure.md`・`roadmap.md` の骨格の記述を更新する。
5. 検証（出力の一致・`componentLayout`・旧パスの全文検索・`test:all`）を行う。

ロールバック: 検証で差分が出た場合は `git mv` を戻し、import を旧パスへ戻す。
