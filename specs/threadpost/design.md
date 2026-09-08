# スレッド投稿機能 設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

## 1. 本書の構成

- 第2節・第3節: バックエンド設計。**実装済み**であり、そのまま維持する部分。次セッション以降でフロントエンドを設計する際の「前提として使える既存API」として参照すること。
- 第4節: フロントエンド設計。**白紙**。これから設計・実装する。

## 2. バックエンド設計: 投稿作成API（`POST /v2/entry`） 【実装済み】

`POST /v2/bsky/record`（skyshare entryを伴わない投稿専用エンドポイント）は廃止され、`POST /v2/entry`に統合された。テキストのみ投稿・OGPリンク投稿・画像投稿（skyshare entryあり/なし）・スレッド投稿のすべてを、この1エンドポイントが扱う。

### 2.1 リクエスト/レスポンス形状

`src/lib/api/schema/v2/entry/post.ts`:

```ts
RequestBodySchema = z.union([
  // 既存投稿からentryを発行（from-post、新規投稿は作らない、スレッド概念なし）
  z.object({ uri: z.string(), ogImage: imageField }).strict(),
  // 新規投稿（1件、またはスレッドとして複数件）
  z
    .object({
      posts: z.array(EntryPostItemSchema).min(1).max(100),
      reply: Common.CommonReplyRefSchema.optional(),
    })
    .strict(),
])
```

- `posts`は下書きAPI（`v2/bsky/drafts`）と同じ「配列＝スレッド」のモデルを踏襲する。1件ならテキストのみ/OGPリンク/画像付きの単発投稿、複数件ならBlueskyのスレッド（reply chain）として原子的に作成する。
- `EntryPostItemSchema`の各要素は、旧`v2/bsky/record`が持っていた3分岐（テキストのみ/OGPリンク付き/画像付き）をそのまま引き継ぎ、`createEntry: z.boolean().optional()`を追加する。`createEntry: true`かつ`images`+`ogImage`が揃っている場合のみ、その投稿にskyshare entryを紐づける（`images`または`ogImage`が欠けている状態で`createEntry: true`を指定すると400を返す）。
- `reply`（スレッド接続用のStrongRef）は`posts`と同階層の**トップレベルフィールド**として1つだけ持つ。用途は「別々の複数リクエストにまたがって同じスレッドを継ぎ足す」こと（例: 今日1〜2件目を投稿し、後日3件目を追加する場合、前回レスポンスの`uri`/`cid`をこの`reply`として渡す）。同一リクエスト内の`posts[1..]`のreply chainはサーバが内部で自動的に組み立てるため、要素ごとに`reply`を持たせる意味が無く、配列の外に出している。
- レスポンスは、from-post・新規投稿のいずれも同じ形に統一されている:
  ```ts
  { posts: [{ url, uri, cid, skyshareEntry?: {...} }, ...] }
  ```
  `skyshareEntry`は、その投稿でskyshare entryが実際に作成された場合のみ存在し、作成されなかった場合は`undefined`（レスポンスJSONにキー自体が含まれない）。

### 2.2 原子的な作成（`com.atproto.repo.applyWrites`）

投稿本体（`app.bsky.feed.post`）・返信/引用設定（threadgate/postgate）・skyshare entry（`dev.nekono.skyshare.entry`）を、1回の`com.atproto.repo.applyWrites`呼び出しで原子的に（全件成功か全件失敗か）作成する（`src/lib/entry/createBskyThread.ts`）。公式Blueskyクライアントと同様の設計であり、次の問題を解消する。

- 投稿は成功したがthreadgate/postgateの作成だけ失敗する中間状態（旧実装の`gateWarning`）。特にthreadgateは、投稿直後からthreadgateが実際に作られるまでの間、意図しない相手からの返信を受け付けてしまう競合窓（race window）を生んでいた。
- スレッド（複数投稿）を作るために、クライアントが前回レスポンスの`uri`/`cid`を使って1件ずつ順にAPIを呼ぶ必要があったこと。

実現方法:

1. 各投稿の`rkey`を`TID.nextStr()`（`@atproto/common-web`）でサーバ側が事前生成し、`at://{did}/app.bsky.feed.post/{rkey}`というURIを`applyWrites`呼び出し前に確定させる。
2. 投稿レコードの値（`buildBskyPostRecord`、`src/lib/atproto/post.ts`）を1件ずつ順に組み立てながら、`cidForLex`（`@atproto/lex-cbor`）で直前の投稿のCIDを事前計算し、次の投稿の`reply.parent`（および`reply.root`）へ埋め込む。
   - レコードCIDは「レコード値をDAG-CBORエンコードしたバイト列のSHA-256」という純粋関数であり、PDSの実行結果を待たずにクライアント（この場合はskyshareサーバ）側で事前計算できる。`@atproto/lex-cbor`はこの計算を行う公式実装（PDS自身が使うのと同じエンコーダ）であり、依存関係（`@atproto/lex-data`、CBORエンコーダは`cborg`）はいずれもNode固有APIに依存しないpure JS実装（`multiformats`のsha256実装含む）で、Cloudflare Workers上でも動作する。
3. 各投稿にgate設定があれば、`buildThreadgateRecord`/`buildPostgateRecord`（`src/lib/atproto/gate.ts`）で`post`フィールド（URI文字列のみ、StrongRef不要）を持つレコードを組み立て、`writes`に追加する。
4. `createEntry: true`の投稿があれば、entry用の`rkey`も別途`TID`で採番し、`buildSkyshareEntryRecord`（`src/lib/entry/skyshareRecord.ts`）で、その投稿の事前計算済み`uri`/`cid`を`source`として使うレコードを組み立て、`writes`に追加する。
5. 組み立てた全レコードを1回の`agent.com.atproto.repo.applyWrites({ repo: did, writes: [...] })`で送信する。戻り値は、事前計算した値ではなく**PDSからの応答**（`results`）を信頼して組み立てる。

`applyWrites`の呼び出しが失敗した場合、リクエスト全体を500として返す（部分成功状態は存在しない）。

### 2.3 reply（スレッド化）の所有権検証（セキュリティ）

`src/lib/atproto/post.ts`の`isReplyRefOwnedBySelf(reply, did)`が、トップレベルの`reply.root`/`reply.parent`のuriが、呼び出しユーザー自身の`app.bsky.feed.post`レコードを指しているかを`parseOwnedAtUri`で検証する（他人の投稿への不正なreply chain構築の防止。**この`reply`機能は自分の既存投稿へスレッドを継ぎ足すためのものであり、他人の投稿への汎用リプライ機能ではない**、というスコープを維持している）。falseの場合は400を返す。同一リクエスト内で自動組み立てされる2件目以降のreply chainは、この検証の対象外（常に自分がこのリクエストで作成する投稿同士のため、所有権は自明）。

### 2.4 影響ファイル一覧（実装済み）

- `src/lib/api/schema/v2/entry/post.ts`（統合後のリクエスト/レスポンススキーマ）
- `src/lib/atproto/post.ts`（`buildBskyPostRecord`、`isReplyRefOwnedBySelf`）
- `src/lib/atproto/gate.ts`（`buildThreadgateRecord`/`buildPostgateRecord`、純粋なレコードビルダーとして維持）
- `src/lib/entry/skyshareRecord.ts`（`buildSkyshareEntryRecord`、`toCreatedSkyshareEntry`、`updateSkyshareEntry`）
- `src/lib/entry/createBskyThread.ts`（新規。`applyWrites`による原子的作成のオーケストレーション）
- `src/lib/entry/fromPost.ts`（from-post分岐、ロジックはほぼ維持）
- `src/pages/v2/entry.ts`（統合後のハンドラ。`src/pages/v2/bsky/record.ts`は削除）
- `src/util/formData.ts`（`formDataIndexedArrayToObjects`。`posts[i][...]`形式のインデックス付きFormDataデコード）
- `src/lib/codegen/openapiFormData.ts`（`customFormData`。オブジェクト配列のインデックス付きFormDataエンコード）
- `package.json`（`@atproto/common-web`・`@atproto/lex-cbor`を依存追加）
- `src/components/post/PostForm/submitEntry.ts` ・ `src/components/post/PostCard/useSkyshareEntryStatus.ts`（新エンドポイント形状への追従。スレッドUI自体はまだ無い）
- `_legacy/frontend/src/lib/v2BackendAPI/createV2Entry.ts` ・ `_legacy/frontend/src/components/Client/bsky/buttons/PostButton.tsx`（レガシーフロントエンドの追従。`createV2BskyRecord.ts`は削除）
- 上記に対応する `tests/**` 一式

## 3. バックエンド設計: スレッド下書き対応 【実装済み】

### 3.1 データ構造の変更

下書き本体を「1件のtext」から「`posts`配列」へ変更（`app.bsky.draft#draft.posts`にそのまま対応）。

```ts
// src/lib/api/schema/v2/bsky/drafts/post.ts
export const DraftPostSchema = z
  .object({ text: z.string(), labels: z.array(z.string()).optional() })
  .strict()

export const RequestBodySchema = z
  .object({ posts: z.array(DraftPostSchema).min(1).max(100) })
  .strict()
```

`posts`が1件ならテキストのみの下書き、複数件ならスレッド（reply chain予定）の下書きを表す。画像等の埋め込みはデバイスローカル参照のため下書きでは扱わない（既存方針を踏襲）。

### 3.2 検証ロジック

`src/lib/atproto/draft.ts` に、下書き作成・更新共通の`posts`配列検証（`parseDraftPostsInput`、1〜100件）、及び一覧取得時の`posts`検証（`parseDraft`）を実装済み。

### 3.3 フロントエンド側データアダプタ

`src/lib/entry/draftList.ts`（Reactに依存しない純粋なデータ変換関数）を、新しい`posts`配列形式に合わせて更新済み。

```ts
export type DraftListPost = { text: string; labels?: string[] }
export type DraftListItem = {
  id: string
  posts: DraftListPost[]
  updatedAt: string
}
```

この変換関数自体はUIコンポーネントではなくAPIレスポンスの整形のみを行うため、フロントエンドのアーキテクチャ（第4節）をどう設計しても再利用できる想定で維持している。

### 3.4 影響ファイル一覧（実装済み）

- `src/lib/api/schema/v2/bsky/drafts/post.ts` / `put.ts` / `get.ts`（`posts`配列への変更）
- `src/lib/atproto/draft.ts`（`posts`配列の検証ロジック）
- `src/lib/entry/draftList.ts`（`posts`配列に対応したデータアダプタ）
- `src/pages/v2/bsky/drafts.ts`（ハンドラの`posts`対応）
- `tests/lib/atproto/draft.test.ts` / `tests/pages/v2/bsky/drafts.test.ts`（`posts`配列の分岐網羅テスト）

## 4. フロントエンド設計 【白紙・次セッションで検討】

具体的な設計は次セッションで行う。着手前提として、バックエンド（第2節・第3節）は以下を提供済みであることを踏まえること。

- `POST /v2/entry`は、`posts`配列に1件だけ入れて呼ぶことも、複数件（スレッド）を1回で送ることもできる。**FE側の送信方式（セグメントごとに個別リクエストを送るか、スレッド全体を1回のリクエストにまとめて送るか）は、このAPIの制約からは決まらない**。どちらの方式でも実装可能なので、FEのUI/UX要件（見栄え、投稿順序の見せ方等）から独立して決定してよい。
- 複数リクエストにまたがってスレッドを継ぎ足したい場合（例: 下書きから1件ずつ投稿する、途中でセッションが切れた等）は、トップレベルの`reply`に前回レスポンスの`uri`/`cid`を渡せばよい。
- 画像付きセグメントでskyshare entryを作りたい場合は、その`posts[i]`に`createEntry: true`を指定する（`images`+`ogImage`が必須）。

### 4.1 次セッションでの検討課題（本書では結論を出さない）

- スレッドの各セグメントを、`PostForm`本体を汚染せずに表現する方法（例: セグメントごとに独立した`PostForm`インスタンスを配列で描画する、`PostForm`とは別に軽量な「投稿1件分の入力状態」コンポーネントを新設する、等）。
- 見栄え（各セグメントの視覚的な並べ方）の要件を要件定義段階で先に固める。
- スレッド投稿とクリエイターモード（EditorToolbox）の関係性（独立機能とするか、クリエイターモードの一部とするか）。
- 第3節のスレッド下書き（`posts`配列）とフロントエンドの状態管理をどう対応付けるか。
- スレッド全体を1リクエストにまとめて送る場合と、セグメントごとに個別リクエストを送る場合とで、投稿途中の失敗時のUX（どこまで投稿済みかの表示、リトライ方法）がどう変わるかを整理する。

## 5. 影響範囲まとめ（現時点）

**実装済み（維持）**: 第2.4節・第3.4節に記載の全ファイル。

**未着手**: フロントエンドの要件確定・アーキテクチャ設計・実装一式（次セッション）。
