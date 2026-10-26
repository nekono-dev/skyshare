# Requirements Document

## Introduction

プルダウンとメンション・ハッシュタグの候補一覧で、選択肢の1行の見た目と操作を共通にする。

## Boundary Context

- **In scope**:
  - 選択肢の1行の見た目・ハイライト・確定の操作。
  - 候補一覧での選択肢行の利用。
- **Out of scope**:
  - プルダウンの開閉と配置。
  - 候補一覧の表示位置と候補の取得。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 共通の選択肢行

**Objective:** As a 利用者, I want プルダウンと候補一覧で同じ見た目と挙動で選びたい, so that 画面ごとに操作を覚え直さなくてよい

#### Acceptance Criteria

1. The プルダウンとメンション・ハッシュタグの候補一覧 shall 同じ選択肢行の見た目とハイライトの挙動を使う
2. When 選択肢行がマウスボタンの押下で操作されたとき、the 選択肢行 shall 確定し、入力欄とトリガーのフォーカスを維持する
3. While 選択肢行が無効のとき、the 選択肢行 shall ホバーでハイライトせず、押下しても確定しない

### Requirement 2: 選択状態の表現

**Objective:** As a 利用者, I want 選択中や無効の項目が見分けられるようにしたい, so that 何が選べるか判断できる

#### Acceptance Criteria

1. The 選択肢行 shall 候補一覧ではアクティブ項目を、プルダウンでは選択中の項目を、支援技術に選択状態として伝える
2. The 選択肢行 shall 選択中の項目を太字と左端の強調線で、無効な項目を淡い文字色で表示する
