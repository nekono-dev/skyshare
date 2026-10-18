# spec-driven-development

仕様駆動開発（`specs/<component>/` の 3 点セット、`docs/architecture.md`、PoC）を、検証スクリプトで機械的に判定する Claude Code スキル。使い方は [SKILL.md](SKILL.md)、手順は [references/workflow.md](references/workflow.md) を参照する。

## 導入

```sh
git clone git@github.com.nekono:nekono-dev/spec-driven-development.git ~/.claude/skills/spec-driven-development
cd ~/.claude/skills/spec-driven-development/scripts && npm ci --ignore-scripts
```

要件: Node.js 22.12 以上。

## 更新

スキルは使い始めるときに `git pull --ff-only` で自身を更新する（[SKILL.md](SKILL.md) の「開始時のスキル更新」）。手動で行う場合は、スキルのディレクトリで `git pull --ff-only` を実行する。

## 開発

```sh
cd scripts
npm ci --ignore-scripts
node selftest.mjs && node selftest-lib.mjs && node selftest-docs.mjs
node check-all.mjs --rules # references/rules.md を再生成する
```

このリポジトリには、特定のアプリケーション固有の仕様や例を含めない。
