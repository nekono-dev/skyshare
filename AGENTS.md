## Conversation Guidelines

- 常に日本語で会話する
- 技術的な説明も日本語で行う
- コード内のコメントは日本語で記述
- エラーメッセージの解説は日本語で
- README.mdなどのドキュメントも日本語で作成

# 注意事項

- 本システムは Cloudflare Workers 環境で動作するため、Nodejs 固有の API は使用できず、バージョンもCloudflareの扱えるNodejsの最新バージョン: 22.16.0に固定される。
- 無料枠のCPU上限（10ms）を守るため、`src/middleware.ts` から静的に辿れる範囲（`lib/session/bskySessionRefresh.ts`・`lib/api/response.ts` など）で `@atproto/*` を静的にimportしない。全リクエストで読み込まれるため、Workerの起動（cold start）のたびに約70msの評価コストがかかる。atprotoを使う処理は、使う時点で動的import（`await import()`）する。`tests/lib/coldStart.test.ts` が検査する。
- 特に指示がない場合、作業は `(root)/src/` 配下のコードを対象とする。`_legacy`を対象とする作業の場合は明示的に示す。曖昧な場合は確認すること。
- APIはコードファーストで実装すること。各エンドポイントのZodスキーマ（バリデーション用途と兼用、`src/lib/api/schema/` が単一の真実の源）を同ディレクトリ配下にURLパスと対応するディレクトリ構成で定義し、`src/pages/**` のAPIルートハンドラはそのスキーマを直接importして `.safeParse()` で検証する。`hack/build-openapi-document.ts` がこれらのスキーマからOpenAPI 3.1ドキュメントを組み立て、`orval` がそれを入力にフロントエンド用クライアント（`src/client/openapi/client.ts` 等）を生成する。すべて `npm run codegen` で実行できる。
  - 1エンドポイントにつきスキーマは1つ。バリデーション用とOpenAPIドキュメント生成用でスキーマを分けないこと（multipart+anyOfのような複雑なケースでも例外にしない）。
  - 共通のエラーレスポンス（400/401/404/429/500等）は `Common.errorResponses(statuses, schema?)` を `operation.responses` にスプレッドし、`ResponseBody400Schema = Common.CommonErrorSchema` のような重複定義を書かないこと。
  - スキーマの書き方・ディレクトリ構成・multipart+anyOfの扱い方の詳細は `openapi/README.md` を参照すること。
- テスト・型検査（`npm run test:unit` / `npm run test:type`）の前に、CI（`.github/workflows/deploy.yaml`）と同じく次の準備が必要。`lexicons/com/atproto/repo/strongRef.json` は `atproto` サブモジュールへのシンボリックリンクであり、`src/client/` 配下は `npm run codegen` の生成物で git 管理外のため、準備を欠くとテストが失敗する。Claude Code のクラウドセッションでは `.claude/hooks/session-start.sh` が開始時に自動実行する。
  - `git submodule update --init --depth 1 atproto`
  - `npm install`（CI では `npm ci`）
  - `npm run codegen`

# 仕様駆動開発

- 仕様駆動開発は skill `spec-driven-development` に従う。スキルはリポジトリに同梱せず、プラグイン `spec-driven-development@nekono-dev`（https://github.com/nekono-dev/spec-driven-development）として `.claude/settings.json` で有効にしている。
- 仕様書（`specs/`・`docs/architecture*`・`poc/`）の検査は `npm run test:spec`（`spec-lint`）で行う。`spec-lint` はグローバルに導入する（`npm install -g @nekono-dev/spec-lint`。GitHub Packages の認証が必要）。
- 整形はリポジトリ側の prettier（`.prettierrc` のプラグインを使うため）で検査・修正する（`npx prettier --write specs docs`）。`spec-lint` は `--no-format` で実行する。

# ブランチ・プレビューの規則

- ブランチ運用とプレビューは skill `branch-release-workflow` に従う。運用の正本は `.claude/branch-release-workflow.json`（作業ブランチ `dev/*`、`develop`、保護ブランチ `main`）。
- スキルはリポジトリに同梱せず、プラグイン `branch-release-workflow@nekono-dev`（https://github.com/nekono-dev/branch-release-workflow）として `.claude/settings.json` で有効にしている。マーケットプレイス `nekono-dev` は https://github.com/nekono-dev/claude-plugins で、両プラグインを載せている。
- 保護ブランチと宣言外のブランチでの commit・push は、プラグインの PreToolUse フックが拒否する。
- 新機能の実装・要望追加・要件追加の依頼を受けたら、作業前に `brw create <名前>` で作業ブランチを作成すること。`git checkout -b` 等で直接作らない。
- ユーザーが製造したコードの挙動を確認したい旨を示したら、`brw url` が返す `https://XXXX.develop.skyshare.nekono.dev` を案内すること。`*.workers.dev` や version-id 形式のURLは案内しない。
- push したら `brw finish` で作業ブランチの worktree を片付ける。次の作業は、続きなら `brw resume <ブランチ>`、新しい作業なら `brw create <名前>` で、リモートから取得し直して作り直す。
- 詳細はプラグインの `SKILL.md` を参照（`brw` はプラグインの `scripts/brw.mjs`）。

# lib / util の使い分け

- `src/util/` は、ドメイン知識ゼロで他プロジェクトへそのまま持ち出しても成立する汎用ヘルパーの置き場とする。判定基準（ポータビリティテスト）:
  - skyshareのドメイン型や `@/lib/*` `@/client/*` を一切importしない
  - 入出力がプリミティブ値（string/number/boolean/DOM/Blob/FormData等）のみで完結する
  - 全く別のアプリに貼り付けても意味が通じる
- `src/lib/` は、上記に当てはまらない、skyshareのドメイン知識（セッション/エントリ/atproto連携/画像仕様/コード生成契約）に依存する処理の置き場とする。複数ファイルにまたがる場合は責務ごとにサブディレクトリへ分類すること（例: `lib/session/`, `lib/entry/`, `lib/atproto/`, `lib/image/`, `lib/settings/`, `lib/api/`, `lib/codegen/`, `lib/legacy/`）。
- 新規ファイルを追加する際は、まず上記ポータビリティテストで `util` 行きかを判定し、`lib` 行きの場合は既存のサブディレクトリに合致する責務があればそこに配置し、無ければ新しい責務ディレクトリを作成すること。

# API設計原則

- APIのパスは操作（動詞）を示さないこと。操作の意味は HTTP メソッド（GET/POST/PUT/DELETE等）で表現する。
  - 悪い例: `POST /v2/session/switch`（`switch` という操作をパスに埋め込んでいる）
  - 良い例: `PUT /v2/session`（対象は body で指定し、「上書きする」という操作の意味は PUT メソッドに委ねる）
- APIのパスは、リソースが何であるかを明確に特定できるものとすること。曖昧・抽象的すぎる語は避けること。
  - 悪い例: `GET /v2/timeline`（`timeline` は概念であり、抽象度が高い）
  - 良い例: `GET /v2/entries/skyshare`

# パラメータ命名規則

- CSSモジュールについては、命名にはケバブケースを使用すること
- TypeScriptの変数・関数・メソッドについては、命名にはキャメルケースを使用すること
- TypeScriptの型・インターフェースについては、命名にはパスカルケースを使用すること

# コンポーネント制約

- 原則SSG（Static Site Generation）での利用を想定すること。
- コンポーネントは、原則 src/components 直下に、コンポーネントごとにディレクトリを作成すること。
  - コンポーネントを構成する要素はindex.tsxとindex.module.cssとすること。サブディレクトリは作成しないこと。
  - cssモジュールが不要なコンポーネントについてはディレクトリを作成しなくてもよい。 ex: `src/components/Metadatas.astro`

# コーディング規則

- 共通UIスタイル（`src/styles/ui.module.css` とその `@import` 先）は `@layer ui` に入れている。各コンポーネントの `index.module.css` はレイヤー外に書くこと（レイヤー外は常にレイヤー内より優先されるため、`ui["base-card"]` 等と固有クラスを併用して padding 等を上書きしても、本番ビルドのCSS出力順に左右されない）。コンポーネント側で `@layer` を宣言しないこと（例外: 共通UIのクラスに上書きされる前提の既定値を持つ `Overlay` のように、`ui["width-*"]` 等を `className` で受け取るコンポーネントは、既定値を `@layer ui { :where(.xxx) { ... } }` の形で `ui` レイヤー内に詳細度 0 で書く。レイヤー外に書くと ui 側が負け、別レイヤーを作って `@layer a, b;` で順序を宣言する方式はバンドラが宣言を分割して順序が崩れるため使わない）。共通UI側で「`className` で渡される利用側のクラスを上書きする」ことを前提にしたルール（例: 可変幅プルダウンの `width: 0; min-width: 100%`）は、レイヤー外の利用側に負けるため `ui` に置かず、受け側コンポーネントのCSS（`.trigger.trigger-auto` のようにクラスを重ねて詳細度を上げる）に置く。共通UIのCSSファイルを追加する場合は `ui.module.css` で `@import "./xxx.css" layer(ui);` とすること。
- CSSモジュールによるクラス設定は `${xx.yy}` ではなく `${xx["yyy"]}` とすること
- Reactコンポーネンは必ずアロー式で示し、デフォルトエクスポートを行うこと。
  ex:
  ```ts
  export const Component = () => {
    return ...
  }
  export default Component
  ```
- `map(fn)` `filter(fn)` `some(fn)` `find(fn)` `reduce(fn)` のように、組み込みメソッドから複数の引数が暗黙的に渡されるコールバックについては、関数参照を直接渡さないこと。アロー関数を使用し、呼び出す関数に渡す引数を明示すること。
  - 悪い例: `items.map(toShareFile)`
  - 良い例: `items.map((item, index) => toShareFile(item, index))`

# コード理解負債改善規定

- コード負債改善のため、コードの理解を助けるためのコメントを記載すること。
- 自動生成コード以外のコードに適応すること
- ファイル先頭に、そのファイルの責務と処理概要を記載すること。
- 関数・メソッドごとに以下をコメントで明示すること。
  - 何をする処理か（目的）
  - 入力（Input）
  - 出力（Output）
  - 使用例（Example）
- `unknown` や外部入力を扱う処理では、期待する入力形状（最小要件）を明示すること。
- 分岐やループが複雑なブロック（目安: ネスト2段以上、または条件分岐3つ以上）には、
  「何を検証・除外・抽出しているか」の意図コメントを記載すること。

## 推奨ルール

- 失敗時の方針（`undefined` を返す、早期 return する、など）をコメントに含めること。
- 副作用を伴う処理（状態更新、外部I/O、リソース解放など）は理由をコメントで補足すること。
- 実装上の制約（Cloudflare Workers制約、API互換性要件など）を必要に応じて明記すること。

## 禁止ルール

- コードを見れば自明なコメント（例: 代入、単純インクリメントの説明）は記載しないこと。
- 実装と乖離した古いコメントを放置しないこと。
- 日本語コメントを基本とし、同一責務の説明で日英を混在させないこと。

## 関数コメントの最小テンプレート

```ts
/**
 * 機能の要約（1-2行）
 *
 * 想定する入力形状(必要な場合):
 * - xxx
 *
 * 処理の趣旨:
 * - xxx
 *
 * Input:
 * - `arg`: 説明
 *
 * Output:
 * - 戻り値の説明
 *
 * 例:
 * - 入力: ...
 * - 出力: ...
 */
```
