# Requirements Document

## Introduction

約180件ある投稿言語から目的の言語を素早く見つけられるよう、国旗付きで絞り込める選択欄を提供する。

## Boundary Context

- **In scope**:
  - 投稿言語の選択欄の選択肢と絞り込みの対象。
  - 言語ごとの国旗の表示。
- **Out of scope**:
  - 国旗画像の導入。国旗は絵文字とし、国旗の絵文字を描画できない環境で2文字の国コード表記になることを許容する。
  - 表示言語の選択。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 絞り込み

**Objective:** As a 利用者, I want 言語名や言語コードで投稿言語を探したい, so that 多くの言語から素早く選べる

#### Acceptance Criteria

1. The 投稿言語の選択欄 shall 検索付きのプルダウンとし、言語名と言語コードのどちらでも絞り込めるようにする（「ko」を入力すると韓国語に絞り込まれる）

### Requirement 2: 国旗の表示

**Objective:** As a 利用者, I want 国旗で言語を見分けたい, so that 一覧から目的の言語を見つけやすい

#### Acceptance Criteria

1. The 投稿言語の選択欄 shall 各言語の選択肢に、その言語を代表する国の国旗を言語名の前に表示する
2. Where 複数の国にまたがる言語の場合, the 投稿言語の選択欄 shall 代表国を1つに固定して国旗を表示する（英語は米国の国旗）
3. Where 人工言語・古典言語・国に対応づけられない言語の場合, the 投稿言語の選択欄 shall 国旗を表示せず、一覧でのラベルの開始位置を他の言語と揃える
4. When 言語が確定されたとき、the 投稿言語の選択欄 shall トリガーの現在値にも国旗を表示し、国旗の無い言語ではトリガーに国旗を表示しない
