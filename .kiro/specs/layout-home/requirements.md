# Requirements Document

## Introduction

骨格（ページの枠）の置き場が `src/layout/` と `src/components/layout/` の二つに分かれており、保守する人がどちらを見ればよいか迷う。本 spec は、骨格の `Baselayout.astro` を `src/components/layout/` へ移し、置き場を一つにする。振る舞いと出力は変えない配置の変更である。

## Boundary Context

- **In scope**: `src/layout/Baselayout.astro` の `src/components/layout/` への移動（履歴を残す）、`src/layout/` の廃止、骨格を読み込む `pages/` の import の更新、骨格の配置を説明する steering（`structure.md` の領域一覧・`roadmap.md` の記述）と `components/layout/README.md` の更新。
- **Out of scope**: 骨格の中身（表示・HTML 出力・翻訳・ミドルウェア）、`components/layout/` 内の部品（Sidebar・FooterNav・Metadatas・AnalyticsTag・nav・NavIcon・StandaloneFooter）の再編、`pages/` と `src/` 直下のファイルの配置、`components/` の規約（1 部品 1 フォルダ・利用元の内側・`common/` の分類）の変更。
- **Adjacent expectations**: 検査の追加（骨格の一本化を機械で検査すること）は `structure-checks` が扱う。本 spec は検査を追加せず、`structure-checks` が前提とする配置を作る。

## Requirements

### Requirement 1: 骨格の置き場を一つにする

**Objective:** As a 保守する開発者, I want 骨格のファイルが `src/components/layout/` だけにある状態, so that どこを見ればよいかを迷わない

#### Acceptance Criteria

1. When 移動が完了したとき, the 骨格 shall `src/components/layout/` 配下にだけ存在する
2. When 移動が完了したとき, the `src/layout/` ディレクトリ shall 存在しない
3. The 移動 shall `Baselayout.astro` のファイル履歴（移動前の変更履歴）を失わない状態で行われる
4. When `src/pages/` の各画面が骨格を読み込むとき, the 画面 shall `components/layout/` 配下の骨格の置き場から骨格を import する
5. If `src/` 配下のいずれかのファイルが旧パス `src/layout/`（`@/layout/`）を参照しているとき, then the 変更 shall その参照を新しい置き場へ更新し、旧パスの参照を残さない

### Requirement 2: 出力と振る舞いを変えない

**Objective:** As a 利用者, I want 配置の変更後も画面が今と同じに見えて動くこと, so that 利用者に影響が出ない

#### Acceptance Criteria

1. When `npm run build` を移動の前後で実行したとき, the 生成される HTML shall 全ページで一致する
2. When 骨格を使う画面を表示したとき, the 画面 shall 移動の前と同じ構成（ヘッダー・サイドバー・フッター・`<head>` のメタ情報）で表示される
3. The 移動 shall 骨格の中身（表示文言・スクリプト・props・翻訳キー）を変更しない

### Requirement 3: 文書と実装の整合

**Objective:** As a 保守する開発者, I want steering と README が実装の配置と一致していること, so that 文書を読んだ人が旧い場所を探さない

#### Acceptance Criteria

1. When `structure.md` の領域の一覧を読んだとき, the 文書 shall 骨格が `components/layout` にあることを示し、`src/layout` を骨格の置き場として示さない
2. When `roadmap.md` の骨格に関する記述を読んだとき, the 文書 shall 移動の結果（`src/components/layout/` に一本化済み）と整合する
3. When `src/components/layout/README.md` を読んだとき, the README shall 骨格の参照先を `components/layout/` 配下の新しい置き場として示す
4. The 文書 shall 旧パス `src/layout/Baselayout.astro` を現行の配置として記述しない（履歴を示す場合を除く）

### Requirement 4: 既存の検証を後退させない

**Objective:** As a 開発者, I want 移動の後も既存のテストが通ること, so that 変更が他の機能を壊していないと確認できる

#### Acceptance Criteria

1. When `npm run test:all` を実行したとき, the 検証 shall 終了コード 0 で完了する
2. When `npm run test:all` の結果を集計したとき, the テスト件数 shall 着手時に記録した件数を下回らない
3. If テストが骨格の旧パスを import しているとき, then the テスト shall 新しい置き場の import に更新され、テストの意味は変えない

## Notes（検証の補足）

- 出力の一致（要件 2.1）は、移動の前後の `npm run build` の出力を比較して確かめる。
- 着手時の `npm run test:all` の件数は、実装の着手時に記録して基準にする。
