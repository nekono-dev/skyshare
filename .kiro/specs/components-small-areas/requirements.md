# Requirements Document

## Project Description (Input)

`src/components/` の小さい部品領域（`share` 1 件・`feedback` 2 件・`privacy` 2 件・`help` 4 件）について、利用元の実測に基づいて「統合する」か「残す」かを決め、結果を `structure.md` に記録する。`components/i18n` は多くの部品から import される翻訳の入口のため移動しない。部品の振る舞い・表示は変えない。（詳細は brief.md を参照）

## Introduction

Skyshare の `src/components/` には、部品が 1〜4 件しかない領域が複数ある。本仕様は、そのうち `share`・`feedback`・`privacy`・`help` の四つについて、部品の置き場を利用元の実測に基づいて決め、判断の根拠を記録する。対象は部品の配置と規約の記録であり、利用者に見える振る舞い・表示・API は変えない。

本仕様が扱う「統合」は、部品を、その部品のすべての利用元を含む親の部品フォルダの子フォルダへ移すことを指す。「残す」は、部品を現在の領域の直下に据え置くことを指す。

## Boundary Context

- **In scope**: `components/share`・`components/feedback`・`components/privacy`・`components/help` の各領域について、統合するか残すかの判断、判断に基づく移動（移動する場合のみ）、`structure.md` への判断の記録、移動に伴う import とテストの更新。
- **Out of scope**: `components/i18n`（移動しない）、部品の表示・操作・文言の変更、`components/common/` の分類の再編、`src/lib/` の層の決定、`src/util/` の配置（`util-placement` が扱う）、大きいファイルの分割（`lib-large-files` が扱う）、`components/layout/` の骨格の移動（`layout-home` が扱う）。
- **Adjacent expectations**:
  - `util-placement` が完了していること。利用元の実測は、`util/` から移る import（例: `IntentShareDialog` が参照する `util/share/intent`）が移動した後の状態で行う。
  - `structure-checks` は、本仕様の結果（残す領域と理由、移動した部品の配置）を前提に検査を組み立てる。

## Requirements

### Requirement 1: 小さい部品領域ごとの判断の記録

**Objective:** As a 開発者, I want 小さい部品領域ごとに統合するか残すかが利用元の実測に基づいて記録されていること, so that 部品の置き場を読む人が判断の根拠を追える

#### Acceptance Criteria

1. When 本仕様の作業が完了したとき, the 構成記録 shall `share`・`feedback`・`privacy`・`help` の四つの領域のそれぞれについて、統合するか残すかの判断を一件ずつ記録している
2. When 判断を記録するとき, the 構成記録 shall 各領域の判断の根拠として、その領域の部品の利用元（import しているファイル）の一覧を含める
3. The 構成記録 shall 利用元の一覧を、判断の時点の実測（`src/`・`tests/`・`scripts/` の import の検索結果）に基づいて記録する
4. If 利用元の一覧が判断の時点から変わったとき, then the 構成記録 shall 判断を再検討し、変更の理由を記録する

### Requirement 2: 統合の判断の条件

**Objective:** As a 開発者, I want 統合の判断が一貫した条件で行われること, so that 同じ規則で別の領域を判断できる

#### Acceptance Criteria

1. When ある小さい部品領域の部品のすべての利用元が一つの親の部品フォルダの内側にあるとき, the 判断 shall 部品をその親の子フォルダへ統合する判断にする
2. If 部品の利用元が二つ以上の親の部品フォルダにまたがるとき, then the 判断 shall 部品を統合せず、現在の領域の直下に残す
3. If 部品の利用元が `pages/` など部品フォルダの外にあり、統合先となる親の部品フォルダが存在しないとき, then the 判断 shall 部品を統合せず、現在の領域の直下に残す
4. The 判断 shall `structure.md` の「利用元の内側に置く」規則に従う

### Requirement 3: 残す領域の理由の記録

**Objective:** As a 開発者, I want 残す領域の理由が規約の文書に書かれていること, so that 小さい領域が残っている理由を後から確かめられる

#### Acceptance Criteria

1. When 判断が「残す」になった領域があるとき, the `structure.md` shall その領域について、残す理由（利用元の所在と統合できない条件）を記録する
2. The `structure.md` shall 領域の一覧（`components/<領域>` の形で書く一覧）を、判断の結果と矛盾しない形で保つ
3. When 判断が「統合する」になった領域があるとき, the `structure.md` shall その領域の一覧の記述を、統合後の配置に合わせて更新する

### Requirement 4: 翻訳の入口の扱い

**Objective:** As a 開発者, I want `components/i18n` が本仕様の対象外として据え置かれること, so that 翻訳の入口の import パスが変わらない

#### Acceptance Criteria

1. The 本仕様 shall `components/i18n` の部品（`useTranslation.ts`・`renderSlots.tsx`）を移動しない
2. The 本仕様 shall `components/i18n` の import パスを変更しない
3. Where `components/i18n` を残す理由が `structure.md` に記載されている, the `structure.md` shall その理由（翻訳の入口であり、他の部品から多数 import されること）を維持する

### Requirement 5: 振る舞いと検証の維持

**Objective:** As a 開発者, I want 配置の変更が利用者に見える振る舞いを変えないこと, so that 本仕様の完了は配置だけの変更として確かめられる

#### Acceptance Criteria

1. The 本仕様 shall 部品の表示・操作・文言・API の入出力を変更しない
2. When 部品を移動したとき, the 変更 shall 移動先に合わせて、その部品を import するすべてのファイルの import パスを同じ変更の中で更新する
3. When 部品を移動したとき, the 変更 shall テストの import パスを同じ変更の中で更新し、テストの意味を変えない
4. When 本仕様の作業が完了したとき, the 変更 shall `npm run test:all` が終了コード 0 で完了し、テストの件数が着手時の件数を下回らない
5. The 本仕様 shall 部品フォルダの規約（1 部品 1 フォルダ・`index.tsx` と `index.module.css` の配置）を変更しない

### Requirement 6: 判断の記録に含めない範囲

**Objective:** As a 開発者, I want 本仕様が配置の判断だけを扱うこと, so that 他の仕様の作業と重ならない

#### Acceptance Criteria

1. The 本仕様 shall `components/common/` の分類（`dialog`・`select`・`input`・`list`・`media`・`section`）の再編を行わない
2. The 本仕様 shall 部品の内部の判断（`rules/`・`hooks/`）の中身を変更しない
3. Where 統合の判断が `common/` への移動を必要とするように見える場合, the 本仕様 shall その部品を `common/` へ移さず、判断の理由を記録する
