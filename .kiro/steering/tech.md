# 技術スタック

## アーキテクチャ

Astro（SSR）を Cloudflare Workers で動かす。画面は React のアイランドを併用し、原則 SSG を想定して作る。予約投稿は Cloudflare の D1・R2・Cron で実行する。

## 中核技術

- **言語**: TypeScript（`tsc --noEmit` で型検査）
- **フレームワーク**: Astro 7 + React 19（`@astrojs/cloudflare`）
- **ランタイム**: Cloudflare Workers。Node.js 固有の API は使えない。Node.js は Cloudflare が扱える最新の **22.16.0** に固定する
- **API 契約**: Zod スキーマ → OpenAPI 3.1 → orval クライアント
- **AT Protocol**: `@atproto/api` ほか。lexicon は `lexicons/` で管理し、`goat` で lint する
- **テスト**: vitest（単体・Astro）、Playwright（E2E、ヘッドレスブラウザ）

## 制約（Workers）

- 無料枠の CPU 上限（10ms）を守る。`src/middleware.ts` から静的に辿れる範囲（`lib/session/bskySessionRefresh.ts`・`lib/api/response.ts` など）で `@atproto/*` を静的に import しない。全リクエストで読み込まれ、cold start のたびに約70msの評価コストがかかる。atproto を使う処理は使う時点で動的 import（`await import()`）する。`tests/lib/coldStart.test.ts` が検査する

## 開発標準

### 型・ライブラリ

- `unknown` や外部入力は Zod の `.safeParse()` で検証してから使う
- `map(fn)` などに関数参照を直接渡さず、アロー関数で引数を明示する（暗黙の追加引数による取り違えを防ぐ）

### 品質

- 整形は prettier（`.prettierrc`。TypeScript・Astro は tabWidth 4、他は 2、セミコロンなし）
- `npm test` は codegen → 型検査 → 単体 → Astro → docs 整形 → lexicon lint → E2E の順に実行する

### 開発環境の準備

- テスト・型検査・dev サーバー・E2E の前に、サブモジュール・`npm ci`・`npm run codegen`・`wrangler.jsonc`・`BRW_PLUGIN_DIR` の準備が要る。worktree や新しい clone では毎回必要で、欠けると不可解な失敗になる（例: `wrangler.jsonc` が無いと `punycode` の解決失敗）。手順は `DEVELOP.md` の「テスト・型検査と作業ブランチの worktree の準備」
- `npm run dev` は整形の副作用（`build:pripare` が `format` を実行する）に注意する

### よく使うコマンド

```bash
# 生成: npm run codegen（OpenAPI ドキュメントと orval クライアント）
# 開発: npm run dev
# 型検査: npm run test:type
# 単体: npm run test:unit / npm run test:astro
# E2E: npm run test:e2e
```

## 主要な技術判断

- **コードファーストの API**: 各エンドポイントの Zod スキーマ（`src/lib/api/schema/`）を単一の真実の源とし、バリデーションと OpenAPI 生成の両方に使う。詳細は `api-design.md`
- **ユーザーデータは PDS**: Skyshare はユーザーの投稿・Entry を自前で保管しない
- **cc-sdd による仕様駆動開発**: 仕様は `.kiro/specs/`、プロジェクトの規約は `.kiro/steering/` に置く。進め方は `workflow.md`

---

_規約と判断を書く。依存の一覧は `package.json` が正_
