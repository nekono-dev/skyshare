# Requirements Document

## Introduction

アプリのドメインに依存しない小さな処理（オブジェクトの判定、スクロールの固定、画像の読み込み待ち）を、複数の機能が共通で使えるようにする。

## Boundary Context

- **In scope**:
  - 値がプレーンなオブジェクトかの判定。
  - 重なって開くダイアログでも壊れないスクロールの固定。
  - 生成直後の画像が読み込めるまでの待機。
- **Out of scope**:
  - ダイアログの描画。
  - 画像の生成。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: オブジェクトの判定

**Objective:** As a 実装者, I want 値がプレーンなオブジェクトかを判定したい, so that 外部入力を安全に扱える

#### Acceptance Criteria

1. When 値がプレーンなオブジェクトのとき、the オブジェクトの判定 shall オブジェクトとして判定する
2. If 値が null、配列、またはプリミティブ値のとき, then the オブジェクトの判定 shall オブジェクトとして判定しない

### Requirement 2: スクロールの固定

**Objective:** As a 利用者, I want ダイアログが重なって開いてもスクロール位置が壊れないでほしい, so that 閉じたあとに元の位置で操作できる

#### Acceptance Criteria

1. When 最初の固定が要求されたとき、the スクロールの固定 shall body を現在の位置に固定する
2. When 最後の解除が要求されたとき、the スクロールの固定 shall 元の位置へ戻す
3. While 入れ子の固定の要求があるとき、the スクロールの固定 shall 要求を数え、最初に保存した位置を使い、外側の解除まで固定を続ける

### Requirement 3: 画像の読み込み待ち

**Objective:** As a 実装者, I want 生成直後の画像が読み込めるまで待ちたい, so that 読み込み前の画像を使わずに済む

#### Acceptance Criteria

1. When 画像が読み込めたとき、the 画像の読み込みの待機 shall 成功を返す
2. If 画像の読み込みに失敗したとき, then the 画像の読み込みの待機 shall 間隔を空けて再試行する
3. If 全体の上限を超えたとき, then the 画像の読み込みの待機 shall 例外を投げずに失敗を返す
4. If URL が空のとき, then the 画像の読み込みの待機 shall 待たずに失敗を返す
