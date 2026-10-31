# Project Structure

## Organization Philosophy

責務ごとに三層で分ける。`src/pages/` は入口（画面と API）だけを持ち、業務の判断は `src/lib/` に置く。`src/components/` は React と Astro の部品で、画面に依存しない。純粋な判断（状態遷移・検証・組み立て）は React に依存しない `.ts` に切り出し、テストしやすくする。

## Directory Patterns

### 入口（`src/pages/`）

**Location**: `src/pages/`
**Purpose**: Astro のファイルルーティング。`*.astro` は画面、`*.ts` は API（`APIRoute`）
**Example**: `src/pages/v2/feedback.ts` が `POST` を定義し、判定と組み立ては `src/lib/feedback/` に委ねる

- `src/pages/v2/` は利用者向け API。ディレクトリ名は Bluesky・予約・アンケートなどの領域で分ける。
- `[param]` のディレクトリとファイルは動的パス（`v2/schedules/[id].ts`）。
- 旧サービスの投稿は `src/pages/posts/` と `src/pages/v1/`。

### 業務ロジック（`src/lib/<領域>/`）

**Location**: `src/lib/<領域>/`
**Purpose**: 領域ごとの判断（検証・状態遷移・外部の呼び出し）。画面と API の両方から使う。
**Example**: `src/lib/schedule/` は予約の受付・保管・実行・後片付けを持つ

- 領域は `session`・`oauth`・`schedule`・`survey`・`entry`・`timeline`・`draft`・`atproto`・`settings`・`i18n`・`platform`・`feedback`・`share`・`legacy` など。
- `platform/` は複数の領域が使う Cloudflare の型（D1・R2・Cron）と宣言。特定の機能に属さない共有の型はここに置く。
- `timeline/` はスレッドのまとめと一覧の整形、`draft/` は下書きの一覧。`entry/` は Entry のレコードと作成・更新・削除に限る。
- `atproto/` は Bluesky の仕様に従うレコードの組み立てと読み取り。
- `api/schema/` は endpoint の入出力スキーマで、`src/pages/` の経路と同じ階層にする（`api/schema/v2/feedback/post.ts`）。

### 部品（`src/components/<領域>/<Name>/`）

**Location**: `src/components/<領域>/<Name>/`
**Purpose**: 1 部品 1 フォルダ。`index.tsx`（または `index.astro`）と `index.module.css` を置く。
**Example**: `src/components/common/Checkbox/index.tsx` と `index.module.css`

- 領域は機能の単位で分ける: `composer`（投稿フォーム・下書き・予約の入力）、`timeline`（タイムラインと投稿の表示）、`share`（他 SNS への共有）、`entry`（Entry の一覧・操作）、`account`・`settings`・`feedback`・`schedule`・`image`・`help`・`privacy`。アンケート（`survey`）と動画（`video`）の部品は、利用する親の子に置く（下の「利用元の内側に置く」）。
- 画面全体で共有する部品は `common`（UI 部品）、`layout`（骨格）。`common/` には汎用の部品だけを置く（呼び出し側の文言と状態を受け取り、業務を持たない。例: `ChoiceQuestion`・`FloatingBox`・`NavigationBar`・`ThemeModeSelect`・`Loading`）。一つの業務に固有の部品（例: 投稿言語の一覧を持つ `LanguageSelect`）は、`common/` に置かず、その業務の親の子にする。`common/` の部品は、役割で分類フォルダに分ける。`dialog/`（重ねて表示する）・`select/`（選ぶ）・`input/`（値を入力・切り替える）・`list/`（一覧）・`media/`（画像・人の表示）・`section/`（開閉・切り替えるまとまり）。分類フォルダは部品フォルダを持たず、部品を直接置かない。根には `Loading`・`InlineIcon`（複数の分類から使われる基盤）だけを置く。
- 翻訳の入口（表示言語のフック `useTranslation.ts`・リッチな文言の描画 `renderSlots.tsx`）は `i18n`。判断は `lib/i18n` に残し、React の入口だけを `components/i18n` に置く。
- 部品フォルダの外に置いてよいのは、翻訳の入口（上の `i18n`）と、`layout/nav/` の共有の処理（`navItems.ts`・`sync*.ts`。Sidebar と FooterNav が共有するため、どちらの子にもできない）だけである。それ以外の `.ts`・`.tsx`・`.astro` は部品フォルダの中に置く（`tests/unit/scripts/componentLayout.test.ts` が検査する）。

- フォルダ名とコンポーネント名は PascalCase。
- 部品の判断は同じフォルダの `camelCase.ts` に置く（例: `ThreadComposer/rules/segments.ts`）。フックは `useX.ts`。
- 判断の層（`rules/`）は部品を import しない。部品が使う型は `rules/` に置き、部品がそれを参照する（例: `ThreadComposer/rules/entries.ts`）。
- 部品の判断やフックが多いときは、部品フォルダの直下に子フォルダ `rules/`（判断）と `hooks/`（フック）を作り、そこにまとめてよい。直下には配線（`index.tsx` と `index.module.css`）と子フォルダだけを置く。
- 子フォルダの名前は小文字にする（部品フォルダの PascalCase と区別するため）。部品の子フォルダ（`ComposerOptions/` など）は、従来どおり PascalCase のままにする。
- **利用元の内側に置く**: 部品 P の利用元（P を import しているファイル）がすべて部品 H の中にあるとき、P は H の子フォルダ（`H/P/`）に置く（例: `composer/ThreadComposer/ImagePicker/`、`timeline/Timeline/ThreadCard/PostCard/`）。利用元が一つでも H の外（`pages/`・他の領域）にあるときは、領域の直下に置く。子の子も同じ規則で置く。`common/`・`layout/` の部品には、この規則を当てはめない（基盤）。

### 共通（`src/util/`・`src/styles/`）

- `util/` は領域に依存しない小さな関数。`util/share/` のように下位フォルダで分けることもある。
- `styles/` は CSS Modules。`tokens.css` が値、`ui.module.css` と `*.ui.module.css` が共通のクラス。

### 生成物

- `src/client/openapi/`: `orval` が生成する。手で編集しない。
- `public/`: 静的ファイル。アンケートの設定は生成物として `public/surveys/` に出ることがある。

## 領域の一覧

`src/lib/` の領域（業務の判断。`lib/<領域>` の形で書く）:

- `lib/account`・`lib/api`・`lib/atproto`・`lib/codegen`・`lib/draft`・`lib/entry`・`lib/feedback`・`lib/i18n`・`lib/image`・`lib/legacy`・`lib/oauth`・`lib/platform`・`lib/privacy`・`lib/schedule`・`lib/session`・`lib/settings`・`lib/share`・`lib/site`・`lib/survey`・`lib/timeline`・`lib/video`
- `lib` の直下のファイル: `lib/guestMode.ts`（ゲストモードの判断。ゲストのダミーデータは `lib/timeline/guest/`）

`src/components/` の領域（部品。`components/<領域>` の形で書く）:

- `components/account`・`components/common`・`components/composer`・`components/entry`・`components/feedback`・`components/help`・`components/i18n`・`components/image`・`components/layout`・`components/privacy`・`components/schedule`・`components/settings`・`components/share`・`components/timeline`

領域を追加・削除したときは、この一覧を更新する（`tests/unit/scripts/steeringRegions.test.ts` が、実装と一覧の差を報告する）。

## Naming Conventions

- **Files**: コンポーネントは PascalCase のフォルダ、`lib` と `util` は camelCase（`oauthLogin.ts`、`postImageLimits.ts`）。
- **Routes**: ディレクトリは小文字（`bsky`、`schedules`）。Astro のルーティングに合わせて、複数語も `credential/authorization` のように区切る。
- **Functions**: 純粋関数の名前は動詞で始める（`build...`、`resolve...`、`parse...`、`validate...`）。
- **Types**: 型名は PascalCase。API の型は `RequestBodyType` のように接尾辞で区別する（生成側の命名）。
- **Constants**: 上限値は `SCREAMING_SNAKE`（`MAX_THREAD_POST_COUNT`）。

## Import Organization

```typescript
import { errorResponseFromStatus } from "@/lib/api/response" // 絶対（`@/`）
import styles from "./index.module.css" // 同じフォルダ
```

- `@/` は `src/` を指す。領域をまたぐ import はすべて `@/`。
- 同じ部品フォルダ（同じ領域）の内部だけ相対 import を使う。`../` は 3 段未満にする。
- 拡張子は付けない（`.js` を付けない）。
- これらは `npm run test:imports` が検査する（規則は下の「依存規則の検査」の節）。

## Code Organization Principles

- **依存の向き**: `pages` → `lib` → `util`。`lib` が `components` を import しない。`util` は `lib`・`components`・`pages` を import しない。
- **循環 import は作らない**: 型だけの import を含め、モジュール間の循環を作らない。
- **`lib` は UI に依存しない**: `lib` は `react` と、名前が `react-` で始まるパッケージを import しない。判断は React に依存しない `.ts` に置く。
- **領域をまたぐ import は `@/` に統一する**: 同じ部品フォルダの内部だけ相対 import（`./`）を使う。
- **Workers の制約を守る**: Cron の経路と全リクエストのミドルウェアは重い依存を読み込まない（`tech.md` 参照）。
- **状態の持ち場**: 永続化（D1・R2・Cookie・localStorage）は、それぞれの領域の `store.ts` や設定モジュールだけが触る（例: `lib/schedule/store.ts`、`lib/settings/*`）。
- **ログ**: 識別子とエラーの分類だけを出す。トークン・鍵・本文は出さない。

## 既知の不一致（観察）

- 純粋関数を `src/components/` の中に置く例（`composer/ThreadComposer/rules/` の判断ファイル）と、`src/lib/` に置く例が混在する。新しい共通の判断は `src/lib/` に置く。
- `components/` の中に、機能の所有が別の `.ts` がある（例: `timeline/Timeline/ThreadCard/entryCandidate.ts`）。移動は未着手。
- 命名の接頭辞（`createX`、`buildX`、`resolveX`）の使い分けは、領域ごとにばらつきがある。

---

_Document patterns, not file trees. New files following these patterns shouldn't require updates._
_updated_at: 2026-11-03（領域の一覧と、部品フォルダの外の例外を追補。利用元の内側に置く規則と common の基盤・分類フォルダ（役割）の定義を追補）_

## lib の領域の依存の向き

`lib` の領域どうしの依存は、閉路を作らない（A → B と B → A の両方も、長さ 3 以上の閉路も作らない）。共有の型・定数・スキーマは、参照される側（下位）に置き、上位は再エクスポートで参照を保つ。型のみの import も依存として数える。

許可された依存（2026-11-01 の実測。型のみの辺を含む）。表に無い領域どうしの依存を加える場合は、この節を先に改訂する（規則の変更は、steering の改訂と同じ変更で行う）。

- `lib/api`（API の契約）→ `lib/atproto`・`lib/feedback`・`lib/image`・`lib/oauth`・`lib/survey`・`lib/video`・`util`。`lib/schedule`・`lib/session` も `lib/api` を参照する（下の一覧を参照）。
- `lib/atproto` → `lib/image`・`lib/video`・`util`・`util/emoji`
- `lib/entry`（Entry）→ `lib/atproto`・`lib/image`・`lib/video`・`util`。`lib/timeline` を参照しない。
- `lib/timeline`（タイムライン）→ `lib/entry`・`lib/atproto`・`lib/i18n`（型）
- `lib/oauth` → `lib/atproto`
- `lib/schedule` → `lib/api`・`lib/atproto`・`lib/entry`・`lib/oauth`・`util`（`lib/i18n`・`lib/platform` は型のみ）
- `lib/session` → `lib/api`・`lib/atproto`・`lib/oauth`・`util`
- `lib/settings` → `lib/atproto`・`util/share`。`lib/share` → `lib/atproto`・`lib/settings`（型）・`util/share`
- `lib/survey` → `util`・`lib` 直下のファイル（`lib/api` を参照しない）
- `lib/video` → `lib/image`（`lib/i18n` は型のみ）
- `lib/feedback`（不具合の報告・提案）→ `lib/site`（ビルド情報）・`util`（型のみ）。`lib/api` は参照しない（`lib/api` が `lib/feedback` を参照するため循環になる）
- `lib/privacy` → `lib/site`（`lib/i18n` は型のみ）

`src/` 直下（`env.ts`・`vars.ts`）の扱い: `lib` の領域は `@/env`・`@/vars`（設定）を参照してよい。`src/` 直下の `env.ts`・`middleware.ts`・`worker.ts` は組み立ての層で、`lib` を参照する。閉路の確認（`libRegionPairs` テスト）は `lib` の領域どうしだけを対象にするため、`src/` 直下を経由する閉路は対象外である。

`lib` の領域どうしの閉路は、`tests/unit/scripts/libRegionPairs.test.ts` が確かめる。循環（ファイル単位）は `npm run test:imports` が確かめる。

## 依存規則の検査

`npm run test:imports` が、上の規約を次の規則で検査する（`scripts/architecture/`）。既存の違反は `config/architecture/import-allowlist.json` に、所有 spec 付きで記録する。許容リストに無い違反は失敗になる。

| 規則                | 内容                                                               | 根拠                        |
| ------------------- | ------------------------------------------------------------------ | --------------------------- |
| layer               | `lib` → `components`・`pages`、`util` → 上位層の import を禁止する | 依存の向き                  |
| uiInLib             | `lib` から `react`・`react-*` の import を禁止する                 | `lib` は UI に依存しない    |
| cycle               | 循環 import を禁止する（型だけの import を含む）                   | 循環 import は作らない      |
| crossRegionRelative | 領域をまたぐ相対 import を禁止する                                 | 領域をまたぐ import は `@/` |
| relativeDepth       | `../` が 3 段以上の相対 import を禁止する                          | `../` は 3 段未満           |
| jsExtension         | 拡張子 `.js` を付けた import を禁止する                            | 拡張子は付けない            |

規則の根拠は、この文書の規約だけに限る。規則の追加・変更・緩和は、この文書の改訂と同じ変更で行う。想定の構成（リファクタリングの目標）を理由に規則を変えない。
