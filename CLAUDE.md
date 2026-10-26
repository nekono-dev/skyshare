## Conversation Guidelines

- 常に日本語で会話する
- 技術的な説明も日本語で行う
- コード内のコメントは日本語で記述
- エラーメッセージの解説は日本語で
- README.mdなどのドキュメントも日本語で作成

# 注意事項

- 特に指示がない場合、作業は `(root)/src/` 配下のコードを対象とする。`_legacy`を対象とする作業の場合は明示的に示す。曖昧な場合は確認すること。
- 本システムは Cloudflare Workers 環境で動作する（Node.js 固有の API は使えない）。無料枠の CPU 上限を守るため、`src/middleware.ts` から静的に辿れる範囲で `@atproto/*` を静的に import しない。詳細は `tech.md`。

# 仕様駆動開発とプロジェクトの規約

仕様駆動開発は [cc-sdd](https://github.com/gotalab/cc-sdd) に従う。仕様は `.kiro/specs/`、プロジェクトの規約（steering）は `.kiro/steering/` にある。`/kiro-*` skill と `.kiro/settings/` はセッション開始時のフック（`.claude/hooks/install-cc-sdd.sh`）が導入する（リポジトリには含めない）。

規約の本文は次のファイルにあり、常に読み込む。

@.kiro/steering/product.md
@.kiro/steering/tech.md
@.kiro/steering/structure.md
@.kiro/steering/api-design.md
@.kiro/steering/coding-conventions.md
@.kiro/steering/workflow.md
