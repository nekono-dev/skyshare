# Requirements Document

## Introduction

アプリを日本語と英語のどちらでも利用できるよう、表示言語を自動で決定し、利用者がいつでも切り替えられるようにする。

## Boundary Context

- **In scope**:
  - 表示言語の自動判定と、利用者による選択・保持。
  - 表示中の画面の文言と言語属性の切り替え。
  - サーバーで描画するページの初回の表示言語。
- **Out of scope**:
  - 文言の辞書と翻訳の規則。
  - 投稿に付与する投稿言語。
  - 言語ごとに異なるURLの提供。
  - 旧版フロントエンドの表示言語。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 表示言語の決定

**Objective:** As a 利用者, I want 自分の言語で自動的に表示してほしい, so that 設定なしに読める

#### Acceptance Criteria

1. While 言語設定が保存されているとき、the 表示言語 shall その言語で表示し、ブラウザの言語設定と異なっても保存済みを優先する
2. While 言語設定が未保存のとき、the 表示言語 shall ブラウザの言語設定を優先順に照合し、最初に一致した対応言語で表示する
3. If ブラウザの言語設定が空のとき, then the 表示言語 shall 日本語で表示する
4. If ブラウザの言語設定はあるが対応言語に一致しないとき, then the 表示言語 shall 英語で表示する

### Requirement 2: 言語設定の選択と保持

**Objective:** As a 利用者, I want 表示言語を自分で選びたい, so that 好みの言語で使える

#### Acceptance Criteria

1. The 言語設定 shall システム設定に従う・日本語・English から選べるようにし、ブラウザ内にのみ保持してサーバーへ送信しない
2. When システム設定に従うが選ばれたとき、the 言語設定 shall 保存値を削除する
3. When 日本語または English が選ばれたとき、the 言語設定 shall その値を保存する
4. The 設定画面とログイン画面 shall 表示言語の選択欄を置く
5. When ページ遷移または再読み込みが行われたとき、the 言語設定 shall 選んだ表示言語を維持する

### Requirement 3: 切り替え

**Objective:** As a 利用者, I want 言語を切り替えても作業が失われないでほしい, so that 入力の途中でも言語を変えられる

#### Acceptance Criteria

1. When 表示言語が選ばれたとき、the 表示言語 shall ページを再読み込みせずに表示中の全文言を選んだ言語へ切り替える
2. When 表示言語が切り替わったとき、the 表示言語 shall 入力中のフォーム内容・開いているダイアログ・スクロール位置を失わない
3. When 表示言語が決まったとき、the 表示言語 shall HTML の言語属性を表示言語と一致させる
4. When 別のタブで言語設定が変更されたとき、the 表示言語 shall 開いている他のタブの表示言語も追従させる

### Requirement 4: サーバーでの描画

**Objective:** As a 閲覧者, I want サーバー描画のページも自分の言語で見たい, so that 初回の表示から読める

#### Acceptance Criteria

1. When サーバーで描画するページが要求されたとき、the 表示言語 shall 初回 HTML をリクエストの受け入れ言語で描画し、保存済みの言語設定と異なる場合は初期描画後に切り替える
2. While 受け入れ言語が異なる2件以上のリクエストを並行して処理するとき、the 表示言語 shall それぞれの言語で描画し、言語を混ぜない
3. The 静的生成するページ shall ビルド出力を利用者の言語設定によらず1種類にする（受け入れ言語が英語のリクエストでも言語属性は日本語で出力する）
4. The 表示言語の処理 shall 追加する実行時の依存パッケージを0件にする
