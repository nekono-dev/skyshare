# Requirements Document

## Introduction

代表画像のために指定した切り抜きの範囲を、原本を加工せずに個別のプレビューへ反映して見せ、切り抜きの調整を画像ごとのスロットで行えるようにする。

## Boundary Context

- **In scope**:
  - 切り抜きの範囲を、プレビューの表示へ反映する計算。
  - 画像ごとの切り抜きスロットの表示と、範囲の通知。
- **Out of scope**:
  - 代表画像の合成と圧縮。
  - 切り抜きダイアログの全体の流れ。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: プレビューへの反映

**Objective:** As a 利用者, I want 指定した切り抜きの範囲をプレビューで確かめたい, so that 原本を変えずに見え方を確認できる

#### Acceptance Criteria

1. If 切り抜きの範囲または元画像の寸法が定まっていないとき, then the プレビュー shall 中央を基準に枠を覆う表示にする
2. When 切り抜きの範囲が定まっているとき、the プレビュー shall その範囲が枠いっぱいに映るように、拡大率と位置を求める

### Requirement 2: 画像ごとのスロット

**Objective:** As a 利用者, I want 画像ごとに切り抜きを調整したい, so that 代表画像に使う各画像の見せ方を決められる

#### Acceptance Criteria

1. When 切り抜きのダイアログが開かれたとき、the 切り抜きのダイアログ shall 切り抜きの対象の画像ごとにスロットを1つずつ表示する（6枚の画像を添付したときは先頭4枚のスロット）
