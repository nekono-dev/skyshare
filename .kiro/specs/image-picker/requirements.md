# Requirements Document

## Introduction

投稿フォームの各セグメントに最大10枚の画像を添付し、代表画像の素材になる画像を利用者が区別できるようにする。

## Boundary Context

- **In scope**:
  - 画像の選択と枚数の上限。
  - 添付した画像のプレビュー・取り外し・代替テキストの編集。
  - 投稿に添付する画像の圧縮。
- **Out of scope**:
  - 代表画像の合成と切り抜きの調整。
  - 画像の並べ替えと、下書きへの画像の保存。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 枚数の上限と通知

**Objective:** As a 利用者, I want 添付できる枚数の上限が分かるようにしたい, so that 上限を超える操作で迷わない

#### Acceptance Criteria

1. The 画像選択 shall 各セグメントに画像を10枚まで添付できるようにする
2. If 11枚目以降の画像が選ばれたとき, then the 画像選択 shall 追加せずに上限を超えた旨を通知する
3. The 画像選択 shall 4枚以下の画像の投稿の添付と代表画像の挙動を、10枚への上限の拡大によって1件も変えない

### Requirement 2: プレビューと編集

**Objective:** As a 利用者, I want 添付した画像を確認し直したい, so that 不要な画像を外し、代替テキストを付けられる

#### Acceptance Criteria

1. The 画像選択 shall 添付した全画像のプレビューを表示し、各画像の取り外しと代替テキストの編集をできるようにする
2. The 画像選択 shall 取り外しと代替テキストのボタンを縁取りのある大きさで表示し、マウスを重ねると色を変える
3. When 外から添付済みの画像の組が渡されたとき、the 画像選択 shall 選んだ画像と同じくプレビューを表示し、取り外しと代替テキストの編集をできるようにする

### Requirement 3: 代表画像の素材の区別

**Objective:** As a 利用者, I want どの画像が代表画像の素材になるか分かるようにしたい, so that 見せたい画像を先頭へ置ける

#### Acceptance Criteria

1. When 5枚目以降の画像があるとき、the 画像選択 shall その画像のプレビューに、代表画像の素材の対象外である旨のラベルを付ける
2. When 取り外しにより5枚目以降の画像が先頭4枚に繰り上がったとき、the 画像選択 shall ラベルを外して代表画像の素材に含める

### Requirement 4: 圧縮

**Objective:** As a 利用者, I want 画像を容量の上限に収めて投稿したい, so that アップロードの失敗を避けられる

#### Acceptance Criteria

1. When 投稿に添付する画像がそのまま使える形式と容量のとき、the 画像選択 shall そのまま使う
2. When 投稿に添付する画像がそのまま使えない形式または容量のとき、the 画像選択 shall 1枚あたり2,000,000バイト以内に圧縮する
