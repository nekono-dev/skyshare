# API 設計

## コードファースト

- API はコードファーストで実装する。各エンドポイントの Zod スキーマ（バリデーション兼用）を、URL パスに対応するディレクトリ構成で `src/lib/api/schema/` に定義する。ここが単一の真実の源である
- `src/pages/**` のハンドラは、そのスキーマを直接 import して `.safeParse()` で検証する
- OpenAPI 3.1 ドキュメント（`hack/build-openapi-document.ts`）と orval のクライアント（`src/client/openapi/client.ts` など）は `npm run codegen` で生成する
- 書き方の詳細（multipart + anyOf など）は `openapi/README.md` を参照する

### 守ること

- 1 エンドポイントにつきスキーマは1つ。バリデーション用と OpenAPI 生成用でスキーマを分けない（multipart + anyOf のような複雑なケースでも例外にしない）
- 共通のエラーレスポンス（400/401/404/429/500 など）は `Common.errorResponses(statuses, schema?)` を `operation.responses` にスプレッドする。`ResponseBody400Schema = Common.CommonErrorSchema` のような重複定義を書かない

## パス設計

- パスは操作（動詞）を示さない。操作の意味は HTTP メソッド（GET/POST/PUT/DELETE など）で表す
  - 悪い例: `POST /v2/session/switch`
  - 良い例: `PUT /v2/session`（対象は body で指定し、「上書きする」という意味は PUT に委ねる）
- パスはリソースが何かを明確に特定できるものにする。曖昧・抽象的すぎる語は避ける
  - 悪い例: `GET /v2/timeline`（`timeline` は概念であり抽象度が高い）
  - 良い例: `GET /v2/entries/skyshare`

## 応答

- セッションやトークンを含む応答には、キャッシュを禁止する指定を付ける
- エラー応答は言語を持たない分類で返し、表示用の文言は画面側が表示言語に合わせて取得する

---

_個々のエンドポイントの契約は各 spec の design.md に書く_
