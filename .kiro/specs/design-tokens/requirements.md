# Requirements Document

## Introduction

スマホ幅の画面でフォント・余白・ボタンを一回り大きくし、読みやすく押しやすくする。

## Boundary Context

- **In scope**:
  - 幅639px以下でのフォントサイズ・余白・ボタン寸法・アバター寸法・トグル寸法の各トークン値。
  - コンポーネントに直書きされたフォントサイズ・余白のトークン参照化。
  - 幅639px以下で、ページ末尾がフッターナビゲーションに隠れないための余白。
- **Out of scope**:
  - 幅640px以上の見た目。
  - 色トークン、横幅トークン、ナビゲーションアイコンとフッターナビゲーション自体の寸法。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: スマホ幅のトークンの上書き

**Objective:** As a 利用者, I want スマホ幅で文字やボタンが大きくなってほしい, so that 読みやすく押しやすい

#### Acceptance Criteria

1. While 幅が639px以下のとき、the デザイントークン shall フォントサイズ・余白・ボタン寸法・アバター寸法・トグル寸法のトークンを一段大きな値で上書きする
2. When トークンを参照する UI を表示するとき、the デザイントークン shall 個別の変更なしに上書き後の値で表示させる
3. The コンポーネント shall フォントサイズと余白を直書きせず、トークンを参照する

### Requirement 2: ボタンの操作領域

**Objective:** As a 利用者, I want どのボタンも指で押しやすくしたい, so that 押し間違えない

#### Acceptance Criteria

1. The ボタン shall 高さをボタン寸法トークンから参照し、テキスト・アイコン・バッジのすべてで同じ基準にする
2. While 幅が639px以下のとき、the ボタン shall 操作領域を一辺44px以上にする（プルダウンの開閉ボタンと、画像・動画の領域全体を押す透明なボタンを除く）

### Requirement 3: フッターナビゲーションとの重なりの回避

**Objective:** As a 利用者, I want ページの末尾がフッターに隠れないでほしい, so that 最後の要素まで操作できる

#### Acceptance Criteria

1. While 幅が639px以下のとき、the ページ shall 本文とリスト末尾にフッターナビゲーションの高さと同じ下余白を確保する
2. While 幅が390pxの画面のとき、the ページ shall 横スクロールを発生させない

### Requirement 4: 横幅の限られたツールバー

**Objective:** As a 利用者, I want 狭いツールバーでもボタンが収まってほしい, so that 横にあふれず操作できる

#### Acceptance Criteria

1. While 幅が639px以下のとき、the ツールバー shall テキストボタンの文字を一段小さくし、背景のあるボタンの左右余白を文字と同じ比率で縮め、白系統のボタンの左右余白を詰める
