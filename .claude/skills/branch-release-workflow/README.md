# branch-release-workflow

本番向けブランチでの直接作業を防ぎ、作業ブランチ（`dev/XXXX` など）で作業させる Claude Code スキル。作業ブランチの push でプレビュー、本番向けブランチの push で本番デプロイする運用の整備と案内も行う。使い方は [SKILL.md](SKILL.md) を参照する。

運用はリポジトリ内の宣言ファイル `.claude/branch-release-workflow.json`（記入例は `templates/config.example.json`）で決まり、スキルにはリポジトリ固有の値を持たない。

## 導入

```sh
git clone git@github.com.nekono:nekono-dev/branch-release-workflow.git <リポジトリ>/.claude/skills/branch-release-workflow
```

リポジトリへコミットして同梱してもよい（クラウドセッションでも追加の準備なしに動く。更新は手元の clone で行い、更新分をコミットする）。要件: Node.js 22 以上と git。外部パッケージは使わず、PATH やグローバルへも何も導入しない。フックの有効化は [SKILL.md](SKILL.md) の「導入」を参照する。

## 更新

スキルは使い始めるときに `git pull --ff-only` で自身を更新する（`node scripts/brw.mjs self-update`。[SKILL.md](SKILL.md) の「開始時のスキル更新」）。手動で行う場合は、スキルのディレクトリで `git pull --ff-only` を実行する。

## 開発

```sh
node tests/selftest.mjs
```

仕様は `specs/` にある（仕様駆動開発。検証は spec-driven-development スキルの `check-all.mjs --root specs`）。このリポジトリには、特定のアプリケーション固有の値や例を含めない。
