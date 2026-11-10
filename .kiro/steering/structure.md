# Project Structure

## Organization Philosophy

責務ごとに三層で分ける。`src/pages/` は入口（画面と API）だけを持ち、業務の判断は `src/lib/` に置く。`src/components/` は React と Astro の部品で、画面に依存しない。純粋な判断（状態遷移・検証・組み立て）は React に依存しない `.ts` に切り出し、テストしやすくする。

## Directory Roles

| 場所                                     | 役割                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| `src/pages/`                             | 入口。`*.astro` は画面、`*.ts` は API（`APIRoute`）                             |
| `src/lib/<領域>/`                        | 業務の判断（検証・状態遷移・外部の呼び出し）。画面と API の両方から使う         |
| `src/components/<領域>/<Name>/`          | 部品。1 部品 1 フォルダ                                                         |
| `src/util/`・`src/styles/`・`src/types/` | 共通の関数・スタイル・型                                                        |
| `src/client/openapi/`                    | 生成物（`orval`）。手で編集しない                                               |
| `public/`                                | 静的ファイル。アンケートの設定は生成物として `public/surveys/` に出ることがある |

## 入口（`src/pages/`）

**Location**: `src/pages/`
**Purpose**: Astro のファイルルーティング。`*.astro` は画面、`*.ts` は API（`APIRoute`）
**Example**: `src/pages/v2/feedback.ts` が `POST` を定義し、判定と組み立ては `src/lib/feedback/` に委ねる

- `src/pages/v2/` は利用者向け API。ディレクトリ名は Bluesky・予約・アンケートなどの領域で分ける。
- `[param]` のディレクトリとファイルは動的パス（`v2/schedules/[id].ts`）。
- 旧サービスの投稿は `src/pages/posts/` と `src/pages/v1/`。

業務の判断（`src/lib/<領域>/`）の規約と領域の一覧は [structure-lib.md](structure-lib.md)。

## Naming Conventions

- **Files**: コンポーネントは PascalCase のフォルダ、`lib` と `util` は camelCase（`oauthLogin.ts`、`postImageLimits.ts`）。
- **Routes**: ディレクトリは小文字（`bsky`、`schedules`）。Astro のルーティングに合わせて、複数語も `credential/authorization` のように区切る。
- **Functions**: 純粋関数の名前は動詞で始める（`build...`、`resolve...`、`parse...`、`validate...`）。接頭辞（`create`・`build`・`resolve`・`load`）の規則は別の spec（roadmap の `naming-rule`）で定める。現状は領域ごとにばらつきがある。
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
- これらは `npm run test:imports` が検査する（規則は [structure-checks.md](structure-checks.md)）。

## Code Organization Principles

- **依存の向き**: `pages` → `lib` → `util`。`lib` が `components` を import しない。`util` は `lib`・`components`・`pages` を import しない。`src/types/` は葉で、他の層と外部パッケージを import しない。
- **循環 import は作らない**: 型だけの import を含め、モジュール間の循環を作らない。
- **`lib` は UI に依存しない**: `lib` は `react` と、名前が `react-` で始まるパッケージを import しない。判断は React に依存しない `.ts` に置く。
- **領域をまたぐ import は `@/` に統一する**: 同じ部品フォルダの内部だけ相対 import（`./`）を使う。
- **Workers の制約を守る**: Cron の経路と全リクエストのミドルウェアは重い依存を読み込まない（`tech.md` 参照）。
- **状態の持ち場**: 永続化（D1・R2・Cookie・localStorage）は、それぞれの領域の `store.ts` や設定モジュールだけが触る（例: `lib/schedule/store.ts`、`lib/settings/*`）。
- **ログ**: 識別子とエラーの分類だけを出す。トークン・鍵・本文は出さない。

## 詳細の文書

| ファイル                                               | 内容                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| [structure-lib.md](structure-lib.md)                   | `src/lib/` の業務の規約、領域の一覧と層（基盤・業務）           |
| [structure-dependencies.md](structure-dependencies.md) | `src/lib/` の領域の依存の向き（許可された依存の一覧）           |
| [structure-components.md](structure-components.md)     | `src/components/` の部品の規約、領域の一覧                      |
| [structure-shared.md](structure-shared.md)             | 共通（`util`・`styles`）と型（`types`）の置き場所               |
| [structure-checks.md](structure-checks.md)             | 依存規則の検査（`npm run test:imports` と単体テストが見る規則） |

小さい部品領域の統合・残すの判断は [structure-components.md](structure-components.md) にある。

---

_Document patterns, not file trees. New files following these patterns shouldn't require updates._
_updated_at: 2026-11-08_
