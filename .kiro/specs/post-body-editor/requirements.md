# Requirements Document

## Introduction

投稿の本文を、ハッシュタグ・メンション・URLを入力と同時に色付けしながら、通常の入力欄と同じ操作感で編集できるようにする。

## Boundary Context

- **In scope**:
  - 本文からの色付け対象の検出と、表示用の部品への分割。
  - 編集欄のDOMと本文の文字位置の相互変換。
  - 入力のたびのDOMの差分更新。
- **Out of scope**:
  - 候補の提示。
  - 文字数カウンタの表示。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 色付けの検出

**Objective:** As a 利用者, I want 入力と同時にハッシュタグ・メンション・URL が色付けされてほしい, so that 投稿の見え方を確認しながら書ける

#### Acceptance Criteria

1. When ハッシュタグ（# と全角の ＃）、メンション（@）、URL が入力され、記号やスキームの直後に1文字入力されたとき、the 本文編集欄 shall その時点で色付けする
2. The 本文編集欄 shall 色付けを、行頭・空白・開き括弧の直後から始まるものに限り、メールアドレスや単語中の記号（C# の # など）を対象にしない
3. Where URL にスキームが無い場合, the 本文編集欄 shall 既知のトップレベルドメインで終わるものに限って色付けし、版番号のような数字の並びを対象にしない
4. When 本文を色付けのために分割したとき、the 本文編集欄 shall 分割した部品を連結すると元の本文に一致するようにする
5. When 編集欄へ「#tag」と入力されたとき、the 本文編集欄 shall その範囲を色付けされた要素にする

### Requirement 2: 部品への展開と差分更新

**Objective:** As a 利用者, I want 入力のたびに表示が滑らかに更新されてほしい, so that 入力中のカーソルや選択が乱れない

#### Acceptance Criteria

1. The 本文編集欄 shall 本文を DOM の子ノード1つずつに対応する部品（テキスト・改行・末尾の不可視の目印）に展開する
2. When 本文が改行で終わるとき、the 本文編集欄 shall 末尾に目印を付け、改行以外で終わるときは付けない
3. When 部品の並びが更新されるとき、the 本文編集欄 shall 新旧の並びを比べて共通の先頭区間と末尾区間を求め、先頭区間と末尾区間を重複して数えない

### Requirement 3: 平文との相互変換

**Objective:** As a 利用者, I want 編集欄の位置と本文の文字位置が一致してほしい, so that カーソルやメンションの候補が正しい位置に出る

#### Acceptance Criteria

1. The 本文編集欄 shall 編集欄の改行を、本文では1文字の改行として扱う
2. When 位置を変換するとき、the 本文編集欄 shall 本文の文字位置と DOM 上の位置を相互に変換し、範囲を超える位置は最後の部品の末尾に丸める
3. When 位置が部品の境界にあるとき、the 本文編集欄 shall 直前の部品の末尾として解決する

### Requirement 4: 入力操作

**Objective:** As a 利用者, I want 通常の入力欄と同じように改行できるようにしたい, so that 書いた本文が失われない

#### Acceptance Criteria

1. When 編集欄で Enter が押されたとき、the 本文編集欄 shall 改行を入れ、既に入力した本文を保つ
