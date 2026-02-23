# 重要な注意点

astro/ は旧フロントエンドディレクトリなので使用しないこと。
フロントエンドは src/ 配下にある。

本システムは Cloudflare Pages / Workers 環境で動作するため、Node.js 固有の API は使用できないことに注意すること。

# ディレクトリ構成

- 目的: 新しいフロントエンド実装（Astro ベース）。
- public/: 静的アセット（画像、マニフェスト等）
- hack/: 自動化スクリプト等を配置
- src/: アプリ本体。主なサブディレクトリを指す。
	- `client/`: 各APIの client。自動生成であるため、配下のファイルを編集しないこと。
		- `atproto/`: lexicons定義からの自動生成であるため編集しないでください。
		- `openapi/`: OpenAPI定義からの自動生成であるため編集しないでください。
	- `lib/`: 共通ユーティリティ・再利用コード。
	- `pages/`: ページルートおよびコンテンツ（Astroページ）。
		- `api/`: フロントエンド用APIエンドポイント。
	- `schema/`: フロントエンド用APIエンドポイントのリクエスト・レスポンススキーマを定義。
- lexicons/: atproto lexicons 定義。
- openapi/: OpenAPI 定義。
- **注意**: 旧フロントエンドは `astro/` に残存しているため、現在の開発・変更は `frontend/` を基準に行ってください。


# Astroサーバサイド実装

`src/pages/api` 配下のファイルは Cloudflare Workers 環境で動作するサーバーサイドコードです。Node.js 固有の API は使用できません。Cloudflare Workers のドキュメントを参照して、使用可能な API を確認してください。

また、このAPIは openapi/ 配下の OpenAPI 定義に基づいてクライアントを生成してください。src/pages/api のサーバ実装はOpenAPIクライアントに合わせて入力と出力を合わせること。

サーバ向けスキーマは `npm run apigen`により `src/client/openapi/schemas`配下に生成される。

# Reactコンポーネント

AstroフロントエンドはReactコンポーネントで作成する。
- コンポーネントは必ずアロー式で示し、デフォルトエクスポートを行うこと。
- コンポーネントは src/components 直下に、コンポーネントごとにディレクトリを作成すること。また、コンポーネントを構成する要素はindex.tsxとindex.module.cssとすること。サブディレクトリは作成しないこと。
内部からAstroサーバサイドにリクエストを送る場合、`src/client/openapi/client`を使うこと
ex:
```ts
export const Component = () => {
	return ...
}
export default Component
```

# CSS規定

- tokens.css では、最低限必要なテーマカラーやサイズ規定を記載している。
- ボタンなど、ユーザの操作にあたるインターフェースについては、ui.module.cssに定義されたスタイルを指定して利用すること。また、コンポーネントは各クラスを組み合わせて使用すること。
- デバッグ時に混乱をきたすため、すべてのプロパティは規定を用い、フォールバックによる直指定は避けること。