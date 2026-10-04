# スレッド投稿機能 設計書

対応する要件定義書: [`requirements.md`](./requirements.md)

## 1. 本書の構成

- 第2節・第3節: バックエンド設計（投稿作成API・スレッド下書き対応）。
- 第4節: フロントエンド設計（コンポーネント構成・起動導線・送信方式・下書き連携・画像付きセグメントの扱い）。

## 2. バックエンド設計: 投稿作成API（`POST /v2/entry`）

`POST /v2/bsky/record`（skyshare entryを伴わない投稿専用エンドポイント）は廃止され、`POST /v2/entry`に統合された。テキストのみ投稿・OGPリンク投稿・画像投稿（skyshare entryあり/なし）・スレッド投稿のすべてを、この1エンドポイントが扱う。

### 2.1 リクエスト/レスポンス形状

`src/lib/api/schema/v2/entry/post.ts`:

```ts
RequestBodySchema = z.union([
  // 既存投稿からentryを発行（from-post、新規投稿は作らない、スレッド概念なし）
  z.object({ uri: z.string(), visual: imageField }).strict(),
  // 新規投稿（1件、またはスレッドとして複数件）
  z
    .object({
      posts: z.array(EntryPostItemSchema).min(1).max(100),
      reply: Common.CommonReplyRefSchema.optional(),
      createEntry: z.boolean().optional(),
      visual: imageField.optional(),
    })
    .strict(),
])
```

- `posts`は下書きAPI（`v2/bsky/drafts`）と同じ「配列＝スレッド」のモデルを踏襲する。1件ならテキストのみ/OGPリンク/画像付きの単発投稿、複数件ならBlueskyのスレッド（reply chain）として原子的に作成する。
- `EntryPostItemSchema`の各要素は、旧`v2/bsky/record`が持っていた3分岐（テキストのみ/OGPリンク付き/画像付き）をそのまま引き継ぐ。`createEntry`・`visual`は`posts[i]`側には持たず、`posts`と同階層のトップレベルフィールドとして1組だけ持つ（[specs/entry/backend/design.md §3.1](../entry/backend/design.md#31-リクエスト形式)）。トップレベル`createEntry: true`は、`posts`のいずれかが画像投稿（`images`を持つ）であり、かつ`visual`が揃っている場合のみ有効（欠けている状態で`createEntry: true`を指定すると400を返す）。
- `reply`（スレッド接続用のStrongRef）は`posts`と同階層の**トップレベルフィールド**として1つだけ持つ。用途は「別々の複数リクエストにまたがって同じスレッドを継ぎ足す」こと（例: 今日1〜2件目を投稿し、後日3件目を追加する場合、前回レスポンスの`uri`/`cid`をこの`reply`として渡す）。同一リクエスト内の`posts[1..]`のreply chainはサーバが内部で自動的に組み立てるため、要素ごとに`reply`を持たせる意味が無く、配列の外に出している。
- レスポンスは、from-post・新規投稿のいずれも同じ形に統一されている:
  ```ts
  { posts: [{ url, uri, cid }, ...], skyshareEntry?: {...} }
  ```
  `skyshareEntry`はレスポンス全体で高々1件のトップレベルフィールドであり、`posts[i]`には存在しない。entryが実際に作成された場合のみ存在し、作成されなかった場合は`undefined`（レスポンスJSONにキー自体が含まれない）。

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

### 2.4 関連ファイル一覧

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

## 3. バックエンド設計: スレッド下書き対応

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

`src/lib/atproto/draft.ts` に、下書き作成・更新共通の`posts`配列検証（`parseDraftPostsInput`、1〜100件）、及び一覧取得時の`posts`検証（`parseDraft`）を持つ。

### 3.3 フロントエンド側データアダプタ

`src/lib/entry/draftList.ts`（Reactに依存しない純粋なデータ変換関数）は、新しい`posts`配列形式に合わせる。

```ts
export type DraftListPost = { text: string; labels?: string[] }
export type DraftListItem = {
  id: string
  posts: DraftListPost[]
  updatedAt: string
}
```

この変換関数自体はUIコンポーネントではなくAPIレスポンスの整形のみを行うため、フロントエンドのアーキテクチャ（第4節）をどう設計しても再利用できる想定で維持している。

### 3.4 関連ファイル一覧

- `src/lib/api/schema/v2/bsky/drafts/post.ts` / `put.ts` / `get.ts`（`posts`配列への変更）
- `src/lib/atproto/draft.ts`（`posts`配列の検証ロジック）
- `src/lib/entry/draftList.ts`（`posts`配列に対応したデータアダプタ）
- `src/pages/v2/bsky/drafts.ts`（ハンドラの`posts`対応）
- `tests/lib/atproto/draft.test.ts` / `tests/pages/v2/bsky/drafts.test.ts`（`posts`配列の分岐網羅テスト）

## 4. フロントエンド設計

要件定義（[requirements.md §5](requirements.md#5-決定事項creator-mode要件定義時のヒアリング結果のうち-スレッド投稿に関わるもの)）で確定した方針（独立機能・1リクエスト送信・スレッド全体を1下書きとして保存・画像処理はセグメント単位で既存パイプラインを再利用）を、以下のコンポーネント構成・処理フローとして実現する。

### 4.1 コンポーネント構成

- 単発投稿専用コンポーネントだった`PostForm`は、`ThreadComposer`へ一般化された（実装時に決定・確定した方針。以前は「`PostForm`本体には変更を加えず、`ThreadComposer`が`PostForm`の入力ロジックを呼び出す形で拡張する」という、`PostForm`と`ThreadComposer`を併存させる方式を想定していたが、呼び出し元（`PostLauncher`/`Timeline`/`PostPage`）がモード判定に応じて2つのコンポーネントを動的に差し替える構造は、マウント/アンマウントに伴う入力状態（画像・OGP取得結果など）の引き継ぎが複雑になるため採らなかった）。`src/components/post/PostForm/`は`src/components/post/ThreadComposer/`へリネームされ、呼び出し元は常にこのコンポーネントをマウントする。単発投稿はセグメント数1件のケースとして同一コンポーネントが扱う。
- `ThreadComposer`（旧`PostForm/index.tsx`）が、セグメント配列（`segments: SegmentState[]`、`src/components/post/ThreadComposer/segments.ts`）と「現在編集中のセグメントのindex（`activeIndex`）」を状態として保持する。共有系トグルの永続化・下書き一覧・投稿成功後のポップアップ/WebShareAPI分岐の呼び出しなど、セグメントに依存しないトップレベルの責務を持つ。
- 各セグメントは新設の軽量コンポーネント（`ThreadSegmentForm`）としてレンダリングする。旧`PostForm`が内部で使っていた入力プリミティブ（`PostBodyEditor`、`ImagePicker`、`OgpFetchButton`、`PostGateDialog`、`SelfLabelsSelect`、`LanguageSelect`、`useSuggest`、`useKeyboardRows`等）は既存のコンポーネント・フックのままセグメント単位で個別にインスタンス化する（各コンポーネント・フックはローカルstate/refに閉じており、複数同時マウントに対応できることを実装時に確認済み。`SelfLabelsSelect`/`LanguageSelect`のみ`id`/`name`のデフォルト値が固定文字列のため、セグメントindexベースの一意な値を明示的に渡す）。
- `activeIndex`と一致しないセグメントは、[requirements.md §6.3](requirements.md#63-fr-thread-fe-フロントエンド-スレッド投稿ui)の要件通り、内容を簡略化した上でグレーアウト表示する（入力補助UIは`activeIndex`のセグメントにのみ表示する）。表示の出し分けは、フル編集UIブロックと簡略表示ブロックの両方を常時マウントしたまま`hidden`属性で切り替える方式とする（実装時に確定。JSXの条件レンダリングで`ImagePicker`等を丸ごとアンマウントする方式は、アンマウント時に内部state（`ImagePicker`の`slots`等）が失われ、非アクティブから再度アクティブに戻した際に添付済み画像のプレビューが消える不具合を起こしたため採らなかった）。非アクティブでも`segment.imageEntry`が存在する場合は、簡略表示側に読み取り専用のサムネイル（`ImageEntry.thumbnailPreview`）を表示する。
- セグメントの削除ルール（requirements.md §6.3の受け入れ条件の具体化、実装時に確定）: 先頭（1件目）セグメントはスレッドの起点のため削除できない。2件目以降は編集中かどうかに関わらずいつでも削除できる。スレッド自体を完全に解消したい場合は、既存同様キャンセルボタンでフォームを閉じる。

### 4.2 起動導線

既存の投稿フォーム（`ThreadComposer`、旧`PostForm`）を拡張する。専用画面・専用モーダルは設けない。「スレッドに追加」導線から`segments`配列に要素を追加し、同一フォーム内に縦に並べて表示する。

### 4.3 送信方式

- スレッド全体を1回の`POST /v2/entry`（`posts`配列）にまとめて送信する。`segments`配列を順に`posts[i]`へマッピングする（`src/components/post/ThreadComposer/submitThread.ts`）。
- 本機能が対象とするのは新規スレッドの作成のみとし、既存投稿への継ぎ足し（トップレベル`reply`の指定）を行うUI導線は設けない。
- 送信結果は「送信中」「成功」「失敗」の3状態のみを扱う。バックエンドが原子的に全件成功/全件失敗を保証するため、セグメントごとの個別進捗表示は行わない。
- クロスポスト（X/タイッツー/Mastodon自動ポップアップ・WebShareAPI、`shareDispatch.ts`）は、先頭（1件目）セグメントのtextと、レスポンスのトップレベル`skyshareEntry`（entry全体で高々1件、[specs/entry/backend/design.md §3.6](../entry/backend/design.md#36-レスポンス200)）のuriのみを対象に1回だけ実行する（実装時に決定。仕様書に記載が無かった事項。2件目以降のセグメントはクロスポスト対象外）。

### 4.4 下書きとの連携

- `ThreadComposer`の`segments`配列を、`POST`/`PUT /v2/bsky/drafts`の`posts`配列（`{text, labels?}[]`）にそのままマッピングして1つの下書きとして保存・復元する。
- 画像は下書きに含まれないため（[3.1節](#31-データ構造の変更)の既存方針）、下書き復元時は各セグメントの`images`/`imagesMeta`は空の状態から始まる。

### 4.5 画像付きセグメントの扱い

各セグメントは独立した`ImagePicker`インスタンスを持ち、画像圧縮・OGP画像合成（`createProcessedImages`/`composeThumbnailBlob`、既存の単発投稿向けパイプライン）をセグメントごとに個別に適用する。スレッド全体をまとめて処理する仕組みは設けない。entryのvisual選択（複数の画像投稿セグメントからどれをentryの代表画像にするか、先頭を自動選択する）は[specs/entry/frontend/design.md §3.1](../entry/frontend/design.md#31-visual選択fr-1対応)が、選択結果をリクエストのトップレベル`createEntry`/`visual`として送信する処理・entryの`source`の自動解決は[同§3.2](../entry/frontend/design.md#32-送信内容の決定fr-2-fr-3対応)・[specs/entry/backend/design.md §7](../entry/backend/design.md#7-sourceの解決ロジック)が定める（`submitThread.ts`が実装対象）。

### 4.6 本書の対象外とする実装詳細

`ThreadSegmentForm`の具体的なprops設計、文言・スタイリングの細部は、実装フェーズ（[tasks.md](tasks.md) Phase 6）で決定する。
