# Requirements Document

## Introduction

ブラウザ標準の選択欄に依存せず、選択肢の見た目・一覧の表示位置・操作をアプリ内で統一したプルダウンを提供する。

## Boundary Context

- **In scope**:
  - 共通プルダウンの開閉・表示位置・一覧のスクロール・キーボード操作。
  - トリガーと選択肢の表示内容。
- **Out of scope**:
  - 検索付きプルダウンの絞り込み。
  - 複数選択と選択肢のグループ見出し。
  - スマホ幅でのボトムシート表示。
  - 選択肢の非同期取得。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 開閉

**Objective:** As a 利用者, I want プルダウンを開閉して選びたい, so that 選択肢から値を確定できる

#### Acceptance Criteria

1. When トリガーが操作されたとき、the プルダウン shall パネルを開き、開いている間の再操作では閉じる
2. While プルダウンが無効状態のとき、the プルダウン shall パネルを開かない
3. When 選択肢が確定された、またはパネル外が操作された、または Esc キーか Tab キーが押されたとき、the プルダウン shall パネルを閉じる
4. When パネルが閉じたとき、the プルダウン shall パネル外の操作と Tab キーの場合を除いて、フォーカスをトリガーへ戻す
5. When パネル外がクリックされたとき、the プルダウン shall 値を変えずにパネルを閉じる

### Requirement 2: パネルの配置

**Objective:** As a 利用者, I want パネルが常に見える位置に出てほしい, so that 親要素や画面端に邪魔されずに選べる

#### Acceptance Criteria

1. While パネルが開いているとき、the プルダウン shall スクロール・ウィンドウのリサイズ・ソフトウェアキーボードの表示と非表示ではパネルを閉じず、パネルをトリガーに付けて表示する
2. The プルダウン shall パネルをトリガーの直後に右端を揃えて表示し、左へはみ出す場合は左端を揃え、最小幅をトリガーの幅とする
3. When パネルが開閉するとき、the プルダウン shall 他の要素の配置を変えず、パネルを親要素のクリップとモーダルより前面に表示する
4. If トリガーの下の空きがパネルに足りず上の空きの方が広いとき, then the プルダウン shall トリガーの上にパネルを表示し、画面内に収める
5. The プルダウン shall 一覧を最大5行表示して残りをスクロールさせ、開いたときは選択中の項目、キー操作中はアクティブ項目を見える位置に置く

### Requirement 3: キーボード操作

**Objective:** As a 利用者, I want キーボードだけで選びたい, so that マウスなしで操作できる

#### Acceptance Criteria

1. When Enter・Space・上下キーが押されたとき、the プルダウン shall パネルを開く
2. When 上下キーまたは Home・End キーが押されたとき、the プルダウン shall 無効な選択肢を飛ばしてアクティブ項目を移動する
3. When Enter または Space が押されたとき、the プルダウン shall アクティブ項目を確定する
4. When 文字キーが入力されたとき、the プルダウン shall ラベルがその文字列で始まる選択肢へアクティブ項目を移動する
5. While IME の変換中のとき、the プルダウン shall Enter キーと矢印キーをプルダウンの操作として扱わない

### Requirement 4: 表示内容

**Objective:** As a 利用者, I want 選択肢の内容と選択状態が分かるようにしたい, so that 何を選んでいるか確認できる

#### Acceptance Criteria

1. The プルダウン shall 選択肢にラベルに加えて任意の表示内容を持たせ、一覧では選択中の項目とアクティブ項目を他と区別して表示する
2. When 選択肢が確定されたとき、the プルダウン shall トリガーにその選択肢の表示内容を表示する
3. The プルダウン shall トリガーの横幅を固定幅と選択内容に合わせた可変幅から選べるようにし、可変幅では表示内容の文字を見切れさせない
4. If 現在値が選択肢に無いとき, then the プルダウン shall プレースホルダを表示する

### Requirement 5: アクセシビリティとサーバー描画

**Objective:** As a スクリーンリーダーの利用者, I want 状態が伝わってほしい, so that 画面を見なくても操作できる

#### Acceptance Criteria

1. The プルダウン shall スクリーンリーダーに、現在値・開閉状態・選択中の項目・アクティブ項目の4つを伝える
2. When サーバーで描画するとき、the プルダウン shall 例外を出さず、閉じた状態のトリガーのみを出力する
