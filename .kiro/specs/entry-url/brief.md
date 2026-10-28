# Brief: entry-url

## Problem

Bluesky の投稿ページ・画像、Skyshare の entry ページの URL を画面や API ごとに組み立てると、形式がばらつき、共有済みのリンクとの互換が崩れる。また、クライアントから渡された AT URI をそのまま信用すると、他人のレコードや想定外の種別のレコードを扱ってしまう。

## Current State

URL の生成と AT URI の分解・所有者の検証が、1 つのモジュールにまとまっている。entry・投稿・画像・API の各機能がここを経由して URL を作り、AT URI を検証している。

## Desired Outcome

投稿・画像・entry の URL が常に同じ形式で生成され、AT URI は形式が正しく、かつ期待する種別・所有者のものだけが分解結果として得られる。形式不正や他人の URI は「得られない」ことで区別できる。

## Approach

副作用を持たない純粋な関数群として提供する。サイト内リンクには相対パス、外部へ渡す絶対 URL が必要なときだけサイトの URL を前置した形を使う。AT URI の失敗は例外でなく「結果なし」で返す。

## Scope

- **In**: 投稿・画像の URL の生成、entry のパスと絶対 URL の生成、AT URI の分解と所有者の検証、blob 参照の識別子の取り出しと画像 URL への変換。
- **Out**: entry の NSID の導出、URL の短縮。

## Boundary Candidates

- URL の生成、AT URI の分解と検証、blob 参照の画像 URL 化

## Out of Boundary

- entry の NSID の導出、URL の短縮、ルーティングの定義、entry の組み立て

## Upstream / Downstream

- **Upstream**: サイトの URL（`site-config` が定めるビルド時の公開 URL）
- **Downstream**: entry・投稿の表示、共有、削除、投稿の API、`entry-api`（所有権の検証）

## Existing Spec Touchpoints

- **Extends**: なし
- **Adjacent**: `site-config`、`entry-api`

## Constraints

URL の形式（パス・クエリ）は共有されたリンクとの互換のため変えない。AT URI の検証は、クライアントの入力を信用しない前提で厳密に行う。
