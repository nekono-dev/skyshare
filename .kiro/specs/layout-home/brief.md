# Brief: layout-home

## Problem

骨格（ページの枠）の置き場が二つある。`src/layout/Baselayout.astro` と `src/components/layout/` で、読む人がどちらを見ればよいか迷う。

## Current State

- `src/layout/` には `Baselayout.astro` の 1 件だけがある。
- `src/components/layout/` には骨格の部品（Sidebar・FooterNav・StandaloneFooter・nav・Metadatas・AnalyticsTag など）が 15 件ある。
- `structure.md` は `components/layout` を「画面全体の骨格」と定めている。

## Desired Outcome

- 骨格のファイルが `components/layout/` だけにある。`src/layout/` は消える。
- `structure.md` の記述と、領域の一覧が実装と一致する。

## Approach（決定済み 2026-11-03）

`Baselayout.astro` を `components/layout/` へ移し、`pages/` の import を更新する。移動は `git mv` で行い、履歴を残す。

## Scope

- **In**: `Baselayout.astro` の移動、参照（`pages/` の import・render テスト・steering）の更新。
- **Out**: 骨格の中身（表示・HTML 出力）。部品の規約（`components/` の規則は変えない）。

## Boundary Candidates

- 骨格の配置（`src/layout/` の廃止）

## Out of Boundary

- `pages/` と `src/` 直下（P-A で現状維持）。
- `components/layout/` 内の部品の再編（別の spec で扱わない。必要が出たら記録する）。

## Upstream / Downstream

- **Upstream**: なし
- **Downstream**: `structure-checks`（骨格の一本化を検査する）

## Existing Spec Touchpoints

- **Extends**: `src-folder-layout`（部品フォルダの規約）
- **Adjacent**: `platform-runtime`（ミドルウェア・ビルド時のサイト設定）

## Constraints

- 出力する HTML は変えない（`npm run build` の出力を比較して確かめる）。
- `npm run test:all` の結果は、着手時の件数を下回らない。
