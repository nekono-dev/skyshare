# Requirements Document

## Introduction

投稿の画像をカード内でサムネイルとして一覧でき、タップで拡大して同じ投稿の画像を切り替えて閲覧できるようにする。

## Boundary Context

- **In scope**:
  - 画像の枚数に応じたサムネイルの配置。
  - 画像の拡大表示と画像の切り替え。
  - タイムラインの投稿カードで表示する画像の選択。
- **Out of scope**:
  - 画像以外のメディアの表示。
  - タイムラインのカード全体の高さと折りたたみ。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: サムネイルの配置

**Objective:** As a 利用者, I want 画像の枚数に合ったサムネイルで見たい, so that カードの中で内容が把握できる

#### Acceptance Criteria

1. When 画像が1枚のとき、the サムネイル shall 縦横比を幅と高さの比0.75〜2の範囲に収めた領域にクロップして表示し、比が不明なら3:2の領域にクロップして表示する
2. When 画像が2〜4枚のとき、the サムネイル shall 2:1の領域に、2枚は横並び、3枚は左1枚と右2枚、4枚は2×2で並べてクロップして表示する
3. When 画像が5枚以上のとき、the サムネイル shall 高さを固定した横スクロールの1行に全画像を元の縦横比で並べる
4. The サムネイル shall 画像の読み込みの前後でカードの高さを変えず、各サムネイルに画像の代替テキストを設定する

### Requirement 2: 拡大表示

**Objective:** As a 利用者, I want 画像を拡大して切り替えながら見たい, so that 細部を確認できる

#### Acceptance Criteria

1. When サムネイルがクリックまたはキー操作されたとき、the 拡大表示 shall その画像を画面全体に重ねて縦横比を保って表示する
2. While 拡大表示中のとき、the 拡大表示 shall 左右のスワイプ・矢印キー・前後ボタンで同じ投稿の画像を切り替え、1枚のときは切り替えの操作を表示しない
3. While 拡大表示中のとき、the 拡大表示 shall 代替テキストと、複数枚のときは現在の位置と全枚数を表示する
4. When 背景のクリック・閉じるボタン・Esc キーが操作されたとき、the 拡大表示 shall 閉じる
5. While 拡大表示中のとき、the 拡大表示 shall 背面のページをスクロールさせない

### Requirement 3: キーボードと支援技術

**Objective:** As a キーボードや支援技術の利用者, I want 同じ操作ができるようにしたい, so that 画像を閲覧できる

#### Acceptance Criteria

1. The サムネイルと拡大表示 shall 前へ・次へ・閉じるの3操作をキーボードだけで操作でき、支援技術向けの名前を持たせる
2. While 拡大表示中のとき、the 拡大表示 shall フォーカスを拡大表示内の要素に留める
3. When 拡大表示が閉じたとき、the 拡大表示 shall フォーカスを開いたサムネイルへ戻す

### Requirement 4: 利用の場面

**Objective:** As a 実装者, I want 部品をタイムラインと単独の画面の両方で使いたい, so that 画面ごとに作り直さずに済む

#### Acceptance Criteria

1. When タイムラインの投稿が entry を持つとき、the 投稿カード shall 代表画像を拡大なしで1枚表示する
2. When タイムラインの投稿が entry を持たないとき、the 投稿カード shall 添付画像をサムネイルと拡大表示で表示する
3. Where 拡大表示を持たない静的な表示が指定された場合, the サムネイル shall 投稿カード以外の画面からも単独で使える
