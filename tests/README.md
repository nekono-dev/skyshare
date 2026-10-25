# テスト設計リファレンス

`tests/` 配下のテストを書く・拡張する際の方針をまとめる。特に `src/pages/**`
（Astro サーバサイドAPI）のテストで確立した方針を中心に記載する。新しいエンドポイントを
追加した際は、このドキュメントと `tests/pages/v2/**` の既存テストを見本にすること。

## カバレッジ方針: 「分岐網羅レベル」とは

100% の行カバレッジを強制するのではなく、**分岐(branch)の網羅**を優先する。具体的には
各ルートについて次を最低1テストずつ駆動する:

- ヘッダー/ボディのスキーマ検証（`.safeParse()`）の成功パスと失敗パス
- 認証チェック（`locals.agent`/`session` の有無）
- ルート内の `if`/`try-catch` で分岐する各ケース（画像枚数不一致、所有者不一致等）
- ルートが呼び出す atproto API 呼び出しの成功パスと失敗パス（アップロード失敗、
  レコード不存在、投稿作成失敗など）
- 外側の `catch` に到達した際の `resolveXrpcStatus` によるステータス正規化
  （少なくとも401/404/429/500いずれかにマップされる代表例を1つ）

`vitest.config.ts` の `coverage.include` に `src/pages/v2/**` を含めてあるため、
`npx vitest run --coverage`（`@vitest/coverage-v8` が必要）でこの方針の達成度を
確認できる。

## モック境界の原則: 「AtpAgentの境界でのみモックする」

ルートテストでは、**`AtpAgent`（atproto通信の実体）の境界でのみモックし、
ルートが呼び出す `src/lib/entry/*` や `src/lib/atproto/*` の中間ロジックは
実コードのまま通す**。

理由: これらの中間ロジック（`createEntryFromExistingPost`, `createSkyshareEntry`,
`applyPostGate`, `createBskyPost`, `uploadBlob` 等）は既に `tests/lib/**` で
単体テスト済みである。ルート層のテストでこれらを再度モックして分岐を検証すると、
「ルートが正しく呼び出しているか」ではなく「中間ロジックの内部分岐」を再検証する
ことになり、責務が重複する。agentの境界でモックすれば、ルート層のテストは
「スキーマ検証」「ルーティング（どの分岐に入るか）」「HTTPステータスへの変換」
という、ルート自身の責務だけを検証できる。

## `locals.agent` 注入パターン

`src/pages/v2/**` のほとんどのルート（`entry.ts`, `entries.ts`,
`entries/skyshare.ts`, `bsky/drafts.ts`, `bsky/images.ts`, `bsky/record.ts`）は
`AtpAgent` を自前生成せず、Astro の `locals.agent`（`bskySessionRefresh` ミドルウェアが
供給）を受け取って呼び出すだけの構造になっている。そのため、テストではミドルウェアを
一切経由させず、ルートの `export`（`GET`/`POST`/`PUT`/`DELETE`）を直接呼び出し、
`{ request, locals }` を `APIContext` にキャストして渡せばよい:

```ts
const callRoute = (
  handler: typeof POST,
  request: Request,
  locals: Partial<App.Locals> = {},
) => handler({ request, locals } as unknown as APIContext)
```

`locals.agent` には、そのテストが駆動したい分岐に必要なメソッドだけを `vi.fn()` で
生やした duck-typed なフェイクオブジェクトを渡す。共有ヘルパー
[`tests/pages/v2/testSupport/fakeAgent.ts`](pages/v2/testSupport/fakeAgent.ts) の
`createFakeAgent(overrides)` が、全ルートが呼びうるメソッド（`uploadBlob`,
`getProfile`, `post`, `getAuthorFeed`, `getPosts`, `app.bsky.draft.*`,
`com.atproto.repo.*`, `com.atproto.identity.resolveHandle`,
`com.atproto.sync.getBlob`）について「常に成功する」既定値を返す。個々のテストは
`overrides` でピンポイントに `mockRejectedValue`/`mockImplementation` へ差し替えて
失敗系の分岐を駆動する（ネストしたメソッドも1階層分マージされるため、変更したい
メソッドだけを指定すればよい）。

このパターンは元々 `tests/lib/entry/fromPost.test.ts` の `makeAgent(overrides)` が
下位層（`src/lib/entry/fromPost.ts`）向けに実践していたものを、ルート層に拡張した形。

## `new AtpAgent(...)` を直接生成するコードのテスト方針

`locals.agent` 経由で受け取らず、ハンドラ自身が `new AtpAgent(...)` を生成している
コード（例: `src/pages/v2/bsky/session.ts` の `fetchProfileMeta`/`POST`/`PUT`、
`src/lib/session/bskySessionRefresh.ts` のミドルウェア本体）は、上記の
`locals` 注入では対応できない。

このようなコードは、生成そのものを `src/lib/atproto/agentFactory.ts` の
`createAtpAgent(service)` のような薄い関数へ切り出し、テストでは
`vi.mock("@/lib/atproto/agentFactory")` でその関数をモックして、呼び出しごとに
フェイクエージェントを返すようにする（[`tests/pages/v2/bsky/session.test.ts`](pages/v2/bsky/session.test.ts)
を参照）。`@atproto/api` パッケージ全体をモックするのではなく、生成箇所だけを
薄くラップした自前モジュールをモックすることで、モックの影響範囲を最小限にしている。

新しいエンドポイントを書く際の判断基準:

- **`locals.agent`/`locals.session` を使うだけ** → 追加の準備は不要。上記の
  `callRoute` + `createFakeAgent` パターンでそのままテストできる。
- **ハンドラ自身が `new AtpAgent(...)` する必要がある**（例: ログイン処理、
  未認証の公開情報取得など、ミドルウェアが供給するセッション以外のエージェントが
  要る場合）→ `agentFactory.ts` に生成関数を追加し、`vi.mock` でその関数を
  モックする方針を踏襲すること。

## ディレクトリ/命名規約

- `tests/pages/v2/**` は `src/pages/v2/**` のディレクトリ構造をそのままミラーする
  （`src/pages/v2/bsky/record.ts` → `tests/pages/v2/bsky/record.test.ts`）。
- `describe`/`it` の説明文は日本語で、「何をしたら何が返るか」を明示する
  （例: 「cookieヘッダーが無い場合は400を返す」）。既存テストの文体に合わせる。
- ルートファイル単位で1テストファイルに対応させる。複数メソッド(GET/POST/PUT/DELETE)
  を持つルートは、メソッドごとに `describe` ブロックを分ける。

## 代表例（新規エンドポイント追加時に参照するファイル）

- 認証必須・multipart・複数の外部呼び出しを含む複雑なルート:
  [`tests/pages/v2/entry.test.ts`](pages/v2/entry.test.ts)
- 単純なGET一覧系ルート（ページング・突き合わせロジックあり）:
  [`tests/pages/v2/entries.test.ts`](pages/v2/entries.test.ts)
- `AtpAgent` を自前生成するルート（`agentFactory` モック）:
  [`tests/pages/v2/bsky/session.test.ts`](pages/v2/bsky/session.test.ts)
- `AtpAgent` を一切使わない（cookieのみ扱う）ルート:
  [`tests/pages/v2/bsky/session/[did].test.ts`](pages/v2/bsky/session/[did].test.ts)
