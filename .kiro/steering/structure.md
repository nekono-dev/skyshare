# プロジェクト構成

## 構成の方針

`src/` を責務ごとに分ける。ページは薄く保ち、ドメインの処理は `lib/`、汎用の処理は `util/`、画面の部品は `components/` に置く。

## ディレクトリのパターン

### ページ・API ハンドラ

**場所**: `src/pages/`
**目的**: 画面と API のエンドポイント。`src/pages/v2/**` の API ハンドラは、`src/lib/api/schema/` のスキーマを直接 import して `.safeParse()` で検証する

### API スキーマ

**場所**: `src/lib/api/schema/`
**目的**: エンドポイントごとの Zod スキーマ。URL パスに対応するディレクトリ構成にする（例: `v2/bsky/session/_did/delete.ts`）

### ドメインの処理

**場所**: `src/lib/<責務>/`
**目的**: セッション・Entry・atproto 連携・画像仕様・設定・コード生成の契約など、skyshare のドメイン知識に依存する処理。責務ごとにサブディレクトリへ分ける（`session/`・`entry/`・`atproto/`・`image/`・`settings/`・`api/`・`codegen/`・`legacy/` など）

### 汎用ヘルパー

**場所**: `src/util/`
**目的**: ドメイン知識ゼロで他プロジェクトへ持ち出せる処理（次の判定基準を満たすもの）

### コンポーネント

**場所**: `src/components/<カテゴリ>/<コンポーネント名>/`
**目的**: コンポーネントごとにディレクトリを作り、`index.tsx` と `index.module.css` だけで構成する（サブディレクトリは作らない）。CSS が不要なものは `Metadatas.astro` のように直下に置いてよい。カテゴリは `common`・`image`・`post`・`entry`・`account`・`settings`・`layout` など（依存関係は `src/components/README.md`）

### 共通 UI スタイル

**場所**: `src/styles/ui.module.css` と、その `@import` 先
**目的**: `@layer ui` に入れる共通スタイル。詳細は `coding-conventions.md`

### 生成物

**場所**: `src/client/**`、`openapi/generated.json`
**目的**: `npm run codegen` で生成する。gitignore 済みで、編集しない

### テスト

**場所**: `tests/`（`src/` の構造に対応）、E2E は `tests/e2e/`
**目的**: vitest と Playwright。リグレッション防止のため恒久的に残す

### 仕様と規約

**場所**: `.kiro/specs/<機能名>/`、`.kiro/steering/`
**目的**: cc-sdd の仕様（requirements・design・tasks と `spec.json`）と、プロジェクトの規約
**補足**: `.kiro/settings/` は cc-sdd の導入物で、gitignore 済み（編集しても保持されない）

## lib と util の振り分け（ポータビリティテスト）

新規ファイルは、まず次の3点で `util` へ置けるかを判定する。

- skyshare のドメイン型や `@/lib/*`・`@/client/*` を一切 import しない
- 入出力がプリミティブ値（string・number・boolean・DOM・Blob・FormData など）だけで完結する
- 全く別のアプリへ貼り付けても意味が通じる

当てはまらなければ `lib` へ置く。既存のサブディレクトリに合致する責務があればそこへ、なければ新しい責務ディレクトリを作る。

## 命名

- CSS モジュールのクラス: ケバブケース
- TypeScript の変数・関数・メソッド: キャメルケース
- TypeScript の型・インターフェース: パスカルケース
- import のパスエイリアス: `@/` は `src/` を指す

## 依存の規則

- `src/middleware.ts` から静的に辿れる範囲で `@atproto/*` を静的 import しない（`tech.md` の Workers 制約）
- `_legacy/` は v1 の資産。明示の指示がない限り対象にしない

---

_ファイルの一覧ではなくパターンを書く。パターンに従う新規ファイルで更新が要らないこと_
