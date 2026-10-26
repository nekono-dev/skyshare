# Requirements Document

## Introduction

ブラウザから、自分が投稿した画像のblobを、CORSの制約を受けずに取得できるようにする。

## Boundary Context

- **In scope**:
  - 自分のPDSからの画像blobの取得と、そのまま返す応答。
- **Out of scope**:
  - 画像の加工と圧縮。
  - 他人のリポジトリの画像の取得。
- **Adjacent expectations**:
  - なし

## Requirements

### Requirement 1: 画像 blob の取得

**Objective:** As a 利用者, I want 自分が投稿した画像をブラウザで取得したい, so that CORS の制約を受けずに画像を扱える

#### Acceptance Criteria

1. If ログインしていないとき, then the 画像取得 API shall 未認証として 401 で拒否する
2. If blob の識別子が指定されていない、または空のとき, then the 画像取得 API shall 不正な依頼として 400 で拒否する
3. When blob を取得できたとき、the 画像取得 API shall 元の内容種別を引き継いで返し、内容種別が無いときは汎用のバイナリ種別で返す
4. If blob が見つからないとき, then the 画像取得 API shall 失敗の原因に応じたステータス（見つからない場合は 404）で応答する
