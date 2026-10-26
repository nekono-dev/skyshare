# Requirements Document

## Introduction

1つのダイアログやカードの中で、複数の表示を切り替えるタブの見た目と操作を共通にし、どの画面でも同じ操作で切り替えられるようにする。

## Boundary Context

- **In scope**:
  - タブの並び・選択中の表示・無効の表示。
  - マウスとキーボードによるタブの切り替え。
  - タブとタブの中身の、支援技術への関連付け。
- **Out of scope**:
  - タブの中身の描画と、中身のデータの取得。
  - 選択中のタブの保存と、ページの再読み込み後の復元。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: タブの表示と選択

**Objective:** As a 利用者, I want 切り替え可能な表示を見分けて選びたい, so that 現在の表示が分かり、目的の表示へ移れる

#### Acceptance Criteria

1. The タブ shall 横一列に並べ、選択中のタブを太字と下線で、無効なタブを淡い文字色で表示する
2. When タブが押されたとき、the タブ shall そのタブを選択し、無効なタブは押しても選択しない
3. While 画面幅が640ピクセル未満のとき、the タブ shall 各タブの高さを44ピクセル以上にする

### Requirement 2: キーボード操作

**Objective:** As a キーボードの利用者, I want 矢印キーなどでタブを切り替えたい, so that マウスなしで操作できる

#### Acceptance Criteria

1. When フォーカスのあるタブで左右の矢印キーが押されたとき、the タブ shall 無効なタブを飛ばして隣のタブを選択し、端では反対の端へ移る
2. When Home キーまたは End キーが押されたとき、the タブ shall 先頭または末尾の、無効でないタブを選択する
3. While キーボードの Tab キーで移動するとき、the タブ shall タブの並びのうち選択中のタブだけにフォーカスを止める

### Requirement 3: 支援技術への関連付け

**Objective:** As a 支援技術の利用者, I want タブとその中身の関係が伝わってほしい, so that 画面を見なくても操作できる

#### Acceptance Criteria

1. The タブ shall タブの並びをタブリスト、各タブをタブ、各中身をタブパネルとして支援技術に伝え、タブと中身を識別子で対応させ、選択中のタブだけに選択状態の属性を持たせる
