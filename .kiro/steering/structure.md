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

- 領域は「領域の一覧」の節の表のとおり（`session`・`oauth`・`schedule`・`survey`・`entry`・`timeline`・`atproto`・`settings`・`i18n`・`platform`・`feedback`・`share` など）。
- `platform/` は複数の領域が使う Cloudflare の型（D1・R2・Cron）と宣言。特定の機能に属さない共有の型はここに置く。
- `timeline/` はスレッドのまとめと一覧の整形、下書きの一覧（`draftList.ts`、旧 `draft/` を統合）。`entry/` は Entry のレコードと作成・更新・削除に限る。例外として、旧 pageDB の投稿の取得と削除（`legacyPagedb.ts`、旧 `legacy/` を統合）を持つ。
- `atproto/` は Bluesky の仕様に従うレコードの組み立てと読み取り。
- `api/schema/` は endpoint の入出力スキーマで、`src/pages/` の経路と同じ階層にする（`api/schema/v2/feedback/post.ts`）。

### 部品（`src/components/<領域>/<Name>/`）

**Location**: `src/components/<領域>/<Name>/`
**Purpose**: 1 部品 1 フォルダ。`index.tsx`（または `index.astro`）を置く。スタイルを持つ部品だけ `index.module.css` を置く（スタイルのない部品にファイルを増やさない。2026-11-04 の決定）。
**Example**: `src/components/common/Checkbox/index.tsx` と `index.module.css`

- 領域は機能の単位で分ける: `composer`（投稿フォーム・下書き・予約の入力）、`timeline`（タイムラインと投稿の表示）、`share`（他 SNS への共有）、`entry`（Entry の一覧・操作）、`account`・`settings`・`feedback`・`schedule`・`image`・`help`・`privacy`。アンケート（`survey`）と動画（`video`）の部品は、利用する親の子に置く（下の「利用元の内側に置く」）。
- 画面全体で共有する部品は `common`（UI 部品）、`layout`（骨格）。骨格は `components/layout/Baselayout/` に置く（`layout/` の部品フォルダの一つ）。`src/layout/` を置かない（骨格は `components/layout/` の一箇所だけに置く）。`common/` には汎用の部品だけを置く（呼び出し側の文言と状態を受け取り、業務を持たない。例: `ChoiceQuestion`・`FloatingBox`・`NavigationBar`・`ThemeModeSelect`・`Loading`）。一つの業務に固有の部品（例: 投稿言語の一覧を持つ `LanguageSelect`）は、`common/` に置かず、その業務の親の子にする。`common/` の部品は、役割で分類フォルダに分ける。`dialog/`（重ねて表示する）・`select/`（選ぶ）・`input/`（値を入力・切り替える）・`list/`（一覧）・`media/`（画像・人の表示）・`section/`（開閉・切り替えるまとまり）。分類フォルダは部品フォルダを持たず、部品を直接置かない。根には `Loading`・`InlineIcon`（複数の分類から使われる基盤）だけを置く。
- 翻訳の入口（表示言語のフック `useTranslation.ts`・リッチな文言の描画 `renderSlots.tsx`）は `i18n`。判断は `lib/i18n` に残し、React の入口だけを `components/i18n` に置く。
- 部品フォルダの外に置いてよいのは、翻訳の入口（上の `i18n`）と、`layout/nav/` の共有の処理（`navItems.ts`・`sync*.ts`。Sidebar と FooterNav が共有するため、どちらの子にもできない）だけである。それ以外の `.ts`・`.tsx`・`.astro` は部品フォルダの中に置く（`tests/unit/scripts/componentLayout.test.ts` が検査する）。

- フォルダ名とコンポーネント名は PascalCase。
- 部品の判断は同じフォルダの `camelCase.ts` に置く（例: `ThreadComposer/rules/segments.ts`）。フックは `useX.ts`。
- 判断の層（`rules/`）は部品を import しない。部品が使う型は `rules/` に置き、部品がそれを参照する（例: `ThreadComposer/rules/entries.ts`）。`rules/` の判断は純粋な関数に限る（例外: `common/dialog/Overlay/rules/scrollLock.ts` は `body` のスクロールロックのため DOM を使う。利用者の決定により `rules/` に置いた）。ブラウザの関数（`window.open`・`navigator.share`）を使う判断は、それを引数で受け取る（例: `ThreadComposer/rules/shareDispatch.ts` の `runShareDispatch`）。
- 部品の判断やフックが多いときは、部品フォルダの直下に子フォルダ `rules/`（判断）と `hooks/`（フック）を作り、そこにまとめてよい。直下には配線（`index.tsx` と `index.module.css`）と子フォルダだけを置く。
- 子フォルダの名前は小文字にする（部品フォルダの PascalCase と区別するため）。部品の子フォルダ（`ComposerOptions/` など）は、従来どおり PascalCase のままにする。
- **利用元の内側に置く**: 部品 P の利用元（P を import しているファイル）がすべて部品 H の中にあるとき、P は H の子フォルダ（`H/P/`）に置く（例: `composer/ThreadComposer/ImagePicker/`、`timeline/Timeline/ThreadCard/PostCard/`）。利用元が一つでも H の外（`pages/`・他の領域）にあるときは、領域の直下に置く。子の子も同じ規則で置く。`common/`・`layout/` の部品には、この規則を当てはめない（基盤）。部品フォルダの内側にあるブラウザ側の `.ts`（`openIntentPopup.ts`・`webShare.ts`）は、利用元が一つの部品に限らないとき「共通（`src/util/`・`src/styles/`）」の節の規則 (3)（共通に import できる部品フォルダ）に従い、この「利用元の内側」の規則より優先する。

### 共通（`src/util/`・`src/styles/`）

- `util/` は、利用元が二つ以上の領域のときだけ `util` に置く（領域に依存せず、DOM も使わない汎用の関数）。利用元が一つになった関数は利用元の領域へ移し、`util/` へ戻さない。`util/share/` のような下位フォルダは置かない。
- 置き場の判断は四つの規則による: (1) 型は `src/types/`（「型（`src/types/`）」の節）、(2) 業務の判断は `lib/<領域>/`（例外: 利用元が一つの部品だけの純粋な判定は、その部品の内側に置く。例: `components/feedback/FeedbackForm/userAgent.ts`）、(3) ブラウザや DOM を操作する処理（`window`・`document`・`navigator`・`Image`・`Node`）は、それを使う `components/` の部品の内側（純粋な部分は `lib/` へ分ける。利用元が複数の部品領域にまたがるときは、それらが共通に import できる部品フォルダの内側）、(4) 領域に依存せず DOM も使わない汎用の関数は `util/`。
- 例外: `util/waitForImageLoad.ts` は DOM の `Image` を使うが、利用元が二つの部品領域のため `util/` に残す。
- `styles/` は CSS Modules。`tokens.css` が値、`ui.module.css` と `*.ui.module.css` が共通のクラス。

### 型（`src/types/`）

- 複数の領域が参照する型の置き場。`lib` が `util` または `components` で定義された型を使うときは、その型を `src/types/` へ移し、`lib` と `components` の両方がそこから import する（`lib` が `util` の型を使う場合も含む）。
- `lib` で定義され `components` だけが使う型は `lib` に残す（`components` は `lib` を import してよい）。
- `src/types/` は葉である。`src/types/` のファイルは `src/types/` の外（`lib`・`components`・`util`・`pages`）と、外部パッケージ（DOM の型を含む）を import しない。外部の型が要る場合は、その型を import せず、型の持ち主の層に残す。
- `src/types/` の文は型だけにする（`export type`・`export interface`・`import type` のみ）。値の宣言（`const`・`let`・`function`・`class`・`enum`）・`export default`・`export *`・値の import は置かない。
- Cloudflare の型と宣言は、既存の規則どおり `lib/platform/` に置く（この節の対象外）。
- 葉と型だけの規則（`typesLeaf`・`typesOnly`）は、`npm run test:imports` が検査する。

### 生成物

- `src/client/openapi/`: `orval` が生成する。手で編集しない。
- `public/`: 静的ファイル。アンケートの設定は生成物として `public/surveys/` に出ることがある。

## 領域の一覧

`src/lib/` の領域（業務の判断。`lib/<領域>` の形で書く）は、基盤と業務の二つの層に分ける。依存は業務 → 基盤の一方向だけにする（規則 `libLayer`。対応表は `scripts/architecture/libLayers.ts` にあり、下の表と一致させる）。

### 層の表

| 層   | 領域               | 役割                                                                                                                                                                                                                                                                                               |
| ---- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 基盤 | `lib/api`          | API の契約。`api/schema/`（endpoint の入出力スキーマ）と `api/contract/`（業務から下ろした入力の制約と送信内容の型。`contract/feedbackLimits`・`contract/feedbackSubmission`・`contract/surveyPath`）。`lib/api` は業務（`feedback`・`survey`）を参照しない。業務の側が `api/contract/` を参照する |
| 基盤 | `lib/atproto`      | Bluesky の仕様に従うレコードの組み立てと読み取り                                                                                                                                                                                                                                                   |
| 基盤 | `lib/codegen`      | 生成物（`src/client/openapi/`）が import する fetch と form-data の処理。生成物の import 経路を保つため移動しない（下の「残す領域」）                                                                                                                                                              |
| 基盤 | `lib/i18n`         | 表示言語の判断と辞書                                                                                                                                                                                                                                                                               |
| 基盤 | `lib/image`        | 画像の上限・処理・ギャラリーの配置                                                                                                                                                                                                                                                                 |
| 基盤 | `lib/oauth`        | OAuth のクライアント・トークン・DPoP の判断                                                                                                                                                                                                                                                        |
| 基盤 | `lib/platform`     | Cloudflare の型と宣言（D1・R2・Cron）、Bluesky・公開の endpoint                                                                                                                                                                                                                                    |
| 基盤 | `lib/session`      | 利用者のセッションの保持と更新（Cookie・OAuth・セッションの更新）。アクティブアカウントの共有キャッシュ（`activeAccountSession.ts`）を持つ。旧 `lib/account` を統合した                                                                                                                            |
| 基盤 | `lib/site`         | ビルド情報・サイト設定・プライバシーポリシーの文面（`policySections.ts`）。旧 `lib/privacy` を統合した                                                                                                                                                                                             |
| 基盤 | `lib/video`        | 動画の判断                                                                                                                                                                                                                                                                                         |
| 業務 | `lib/entry`        | Entry のレコードと作成・更新・削除。旧 pageDB の投稿の取得と削除（`legacyPagedb.ts`）を持つ。旧 `lib/legacy` を統合した                                                                                                                                                                            |
| 業務 | `lib/feedback`     | 不具合の報告と機能の提案                                                                                                                                                                                                                                                                           |
| 業務 | `lib/guestMode.ts` | ゲストモードの判断。`lib` 直下の業務のファイル（ゲストのダミーデータは `lib/timeline/guest/`）                                                                                                                                                                                                     |
| 業務 | `lib/schedule`     | 予約投稿                                                                                                                                                                                                                                                                                           |
| 業務 | `lib/settings`     | 利用者の設定                                                                                                                                                                                                                                                                                       |
| 業務 | `lib/share`        | 他 SNS への共有の本文と文字数の補正。                                                                                                                                                                                                                                                              |
| 業務 | `lib/survey`       | アンケート                                                                                                                                                                                                                                                                                         |
| 業務 | `lib/timeline`     | スレッドのまとめ・一覧の整形・下書きの一覧（`draftList.ts`）。旧 `lib/draft` を統合した                                                                                                                                                                                                            |

### 残す領域

1〜2 ファイルの領域のうち、統合せず残すもの（要件 4.2）:

- `lib/codegen`: 生成物 `src/client/openapi/client.ts`（相対 import の `lib/codegen/fetcher.ts`・`openapiFormData.ts`）と `config/orval.config.ts`（出力先の `src/lib/codegen/`）が、このフォルダを参照する。`lib/codegen` を移すと生成物の import 経路が変わり、`npm run apigen` の差分になるため、基盤として残す。
- `lib/share`: 他 SNS への共有の判断をまとめる領域として残す。`util/share/` の純粋な部分（URL・本文・文字数・切り詰め・File の組み立て）を統合した。ブラウザ側（`window.open`・`navigator.share`）は `lib/share` に置かず、`components/share/IntentShareDialog/` の内側に置く。`lib/share` は `lib/settings` を参照しない（自動ポップアップの型は `lib/share/autoPopupTarget.ts` に置く）。

### `src/components/` の領域

部品の領域（`components/<領域>` の形で書く）:

- `components/account`・`components/common`・`components/composer`・`components/entry`・`components/feedback`・`components/help`・`components/i18n`・`components/image`・`components/layout`・`components/privacy`・`components/schedule`・`components/settings`・`components/share`・`components/timeline`

領域を追加・削除したときは、この一覧を更新する（`tests/unit/scripts/steeringRegions.test.ts` が、実装と一覧の差を報告する）。

## 領域の判断の記録

小さい部品領域（`share`・`feedback`・`privacy`・`help`）を、統合するか残すかの判断の記録。判断は下の統合の条件から導き、判断の時点の利用元を表に残す。判断は配置だけを対象とし、部品の内部は変えない。

### 統合の条件

部品 P を親 H の子フォルダ（`H/P/`）へ統合するのは、P のすべての利用元が H の部品フォルダの内側にあるときだけである（「利用元の内側に置く」の規則の適用）。次のどちらかに当たるときは統合せず、現在の領域の直下に残す。

- 利用元が二つ以上の親にまたがる。
- 利用元に `src/pages/` のファイルを含む（統合先の親の部品フォルダの外にある）。

### 判断の表

| 領域       | 部品                                   | 利用元                                                         | 判断       | 理由                                                                 |
| ---------- | -------------------------------------- | -------------------------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| `share`    | `IntentShareDialog`                    | `composer/ThreadComposer`（3 件）・`timeline/Timeline`（3 件） | 残す       | 利用元が二つの親にまたがる                                           |
| `feedback` | `FeedbackForm`                         | `pages/feedback.astro`                                         | 残す       | 利用元が部品フォルダの外（`pages/`）のみ。統合先の親がない           |
| `privacy`  | `PolicyCards`                          | `pages/privacy.astro`                                          | 残す       | 同上                                                                 |
| `help`     | `Help`（`HelpItem` は内側）            | `pages/help.astro`・`Help/HelpItem`                            | 残す       | 利用元に `pages/` を含む。`HelpItem` は既に `Help` の内側にある      |
| `i18n`     | `useTranslation.ts`・`renderSlots.tsx` | 多数（件数は判断の根拠にしない）                               | 移動しない | 翻訳の入口（多数の部品から import される入口であることを根拠とする） |

判断の時点は 2026-11-04 の取り直し時点（判断の結果は 2026-11-03 の実測から変わらない）。`share` の利用元の件数は、util-placement の完了後の 2026-11-04 の取り直し（`research.md` の記録）に合わせた。`IntentShareDialog` の利用元は 6 ファイル。`composer/ThreadComposer/` の 3 件（`index.tsx`・`ComposerDialogs/index.tsx` は本体を import し、`hooks/useThreadSubmit.ts` は型と `openIntentPopup`・`webShare` のサブパスを import）と、`timeline/Timeline/` の 3 件（`PostLauncher/index.tsx`・`ThreadCard/PostCard/index.tsx` は本体を import し、`ThreadCard/PostCard/useWebShareCrosspost.ts` は `webShare` のサブパスを import）。親の数は二つのままで、判断は変わらない。

### `common/` へ移さない理由

`common/` は、呼び出し側の文言と状態を受け取り、業務を持たない汎用の部品だけを置く（「`src/components/` の領域」の節）。四つの部品はいずれも特定の業務に固有であるため、`common/` へ移さない。

- `IntentShareDialog`: 他 SNS への共有という業務を持つ。
- `FeedbackForm`・`PolicyCards`・`Help`: 特定の画面（不具合の報告・プライバシーポリシー・ヘルプ）の内容を持つ。

利用元が複数の親にまたがることを理由に `common/` へ移すと、業務の部品を `common/` に置くことになるため、しない。`src/pages/` へ移すことも、`pages/` は薄い入口だけを持つ規約に反するため、しない。

### 再検討の条件

判断は、判断の時点の利用元に基づく。次の変化があったときは、実測を取り直して判断を見直し、上の表と判断の時点を更新する（利用元が変わったら再検討し、理由を記録する）。

- 利用元が一つの親の部品フォルダの内側にまとまった（例: `share` の利用元が `composer/ThreadComposer` だけになった）。統合の条件に当てはめ、統合を検討する。
- 利用元に新しい親や `src/pages/` のファイルが加わった、または減った。統合の条件に当てはめ直す。
- 判断の根拠（利用元の一覧）が実測と合わないことが分かった。判断を取り消さず、実測を取り直してから見直す。
- 判断を変えて部品を移動する場合は、移動先に合わせて import とテストの import パスを同じ変更で更新する。

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

- **依存の向き**: `pages` → `lib` → `util`。`lib` が `components` を import しない。`util` は `lib`・`components`・`pages` を import しない。`src/types/` は葉で、他の層と外部パッケージを import しない。
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
_updated_at: 2026-11-04（領域の判断の記録の節を追加（components-small-areas 2.1）。util の分類規則に利用元が一つの純粋な判定の例外を追補。`lib/share` の残す領域の説明と、lib の依存の表を現在の import に合わせて改訂。型（`src/types/`）の検査の記述を現状に合わせた。以前の追補: 領域の一覧と、部品フォルダの外の例外を追補。利用元の内側に置く規則と common の基盤・分類フォルダ（役割）の定義を追補。lib の層の表と依存の節、統合後の領域の説明を改訂）_

## lib の領域の依存の向き

`lib` の領域どうしの依存は、閉路を作らない（A → B と B → A の両方も、長さ 3 以上の閉路も作らない）。共有の型・定数・スキーマは、参照される側（下位）に置き、上位は再エクスポートで参照を保つ。型のみの import も依存として数える。

層の規則: 基盤の領域（層の表の「基盤」）は業務の領域（「業務」）を import しない（規則 `libLayer`）。業務の領域は基盤を import してよい。層の分類は「領域の一覧」の層の表のとおり。

許可された依存（2026-11-01 の実測。型のみの辺を含む）。表に無い領域どうしの依存を加える場合は、この節を先に改訂する（規則の変更は、steering の改訂と同じ変更で行う）。

- `lib/api`（API の契約）→ `lib/atproto`・`lib/image`・`lib/oauth`・`lib/video`・`util`・`src/types`（型 `FormDataFieldKind` のみ）。業務の型と制約は `lib/api/contract/` に下ろしてあるため、`lib/feedback`・`lib/survey` を参照しない。`lib/schedule`・`lib/session` も `lib/api` を参照する（下の一覧を参照）。
- `lib/atproto` → `lib/image`・`lib/video`（`util` を参照しない）
- `lib/entry`（Entry）→ `lib/atproto`・`lib/image`・`lib/video`・`util`・`src/types`（`Outcome` の型）。`lib/timeline` を参照しない。
- `lib/timeline`（タイムライン）→ `lib/entry`・`lib/atproto`・`lib/i18n`（型）
- `lib/oauth` → `lib/atproto`
- `lib/schedule` → `lib/api`・`lib/atproto`・`lib/entry`・`lib/oauth`・`util`・`src/types`（`Outcome` の型。`lib/i18n`・`lib/platform` は型のみ）
- `lib/session` → `lib/api`・`lib/atproto`・`lib/oauth`・`util`
- `lib/settings` → `lib/atproto`・`lib/share`。`lib/share` → `lib/atproto`（`lib/settings`・`util` を参照しない）
- `lib/survey` → `lib/api`（契約 `contract/surveyPath`）・`lib/guestMode.ts`・`lib/platform`（型のみ）・`lib/i18n`（型のみ）・`util`（`util/http`）
- `lib/video` → `lib/image`・`util`（`util/padTwoDigits`）（`lib/i18n` は型のみ）
- `lib/feedback`（不具合の報告・提案）→ `lib/api`（契約 `contract/feedbackLimits`・`contract/feedbackSubmission`）・`lib/site`（ビルド情報）・`src/types`（`ClientEnvironment`・`Outcome` の型）。`util` は参照しない。
- `lib/site`（ビルド情報・サイト設定・プライバシーポリシーの文面。`lib/privacy` を統合した領域）→ `lib/i18n`（型のみ）
- `lib/guestMode.ts`（`lib` 直下の業務のファイル）→ `lib/timeline`（ゲストのダミーデータ・削除範囲の型）・`lib/i18n`（型のみ）

上の一覧のうち、`lib/entry`・`lib/schedule`・`lib/feedback`・`lib/atproto`・`lib/settings`・`lib/share` の行は現在の import と一致する。`lib/atproto` は `util` と `src/types` を参照しない。`lib/feedback` は `util` を参照せず、型（`ClientEnvironment`・`Outcome`）を `src/types` から読む。`lib/share` と `lib/settings` の間に循環はなく、`lib/settings` → `lib/share` の一方向だけである。

`src/` 直下（`env.ts`・`vars.ts`）の扱い: `lib` の領域は `@/env`・`@/vars`（設定）を参照してよい。`src/` 直下の `env.ts`・`middleware.ts`・`worker.ts` は組み立ての層で、`lib` を参照する。閉路の確認（`libRegionPairs` テスト）は `lib` の領域どうしだけを対象にするため、`src/` 直下を経由する閉路は対象外である。

`lib` の領域どうしの閉路は、`tests/unit/scripts/libRegionPairs.test.ts` が確かめる。循環（ファイル単位）は `npm run test:imports` が確かめる。

## 依存規則の検査

`npm run test:imports` が、上の規約を次の規則で検査する（`scripts/architecture/`）。既存の違反は `config/architecture/import-allowlist.json` に、所有 spec 付きで記録する。許容リストに無い違反は失敗になる。

| 規則                | 内容                                                                                                      | 根拠                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| layer               | `lib` → `components`・`pages`、`util` → 上位層の import を禁止する                                        | 依存の向き                                             |
| uiInLib             | `lib` から `react`・`react-*` の import を禁止する                                                        | `lib` は UI に依存しない                               |
| cycle               | 循環 import を禁止する（型だけの import を含む）                                                          | 循環 import は作らない                                 |
| crossRegionRelative | 領域をまたぐ相対 import を禁止する                                                                        | 領域をまたぐ import は `@/`                            |
| relativeDepth       | `../` が 3 段以上の相対 import を禁止する                                                                 | `../` は 3 段未満                                      |
| jsExtension         | 拡張子 `.js` を付けた import を禁止する                                                                   | 拡張子は付けない                                       |
| libLayer            | 基盤の領域から業務の領域への import を禁止する（層の逆流）                                                | `lib` の領域の依存の向き（基盤は業務を import しない） |
| utilShared          | 各 `src/util/` モジュールは、`src/util/` の外の二つ以上の領域から使われること                             | 「共通（`src/util/`・`src/styles/`）」                 |
| typesLeaf           | `src/types/` は `src/types/` の外（`lib`・`components`・`util`・`pages`）と外部パッケージを import しない | 「型（`src/types/`）」                                 |
| typesOnly           | `src/types/` の文は型だけにする（`export type`・`export interface`・`import type` 以外を置かない）        | 「型（`src/types/`）」                                 |

許容リストの各項目は、所有 spec と理由（`reason`）を持つ。理由の無い項目は読み込みエラーにする（`scripts/architecture/allowlist.ts`）。

`utilShared`・`typesLeaf`・`typesOnly` も、上の表の規則として検査する（実装は structure-checks 3.2・3.3・3.5）。

規則の根拠は、この文書の規約だけに限る。規則の追加・変更・緩和は、この文書の改訂と同じ変更で行う。想定の構成（リファクタリングの目標）を理由に規則を変えない。
