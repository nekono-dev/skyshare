---
name: remote-preview
description: 新機能の実装・要望追加・要件追加などの開発依頼を受けて作業ブランチ（dev/XXXX）を作るとき、および、ユーザーが製造したコードの挙動を確認したい（プレビューを見たい、動作確認したい、実機で見たい、など）と言ったときに使う。開発ブランチの命名規則 dev/XXXX と、リモートプレビューURL（skyshare-preview-domain-proxy 経由の nekono.dev ドメイン）の案内ルールを定める。
---

# リモートプレビュー（dev/XXXX ブランチ）

`dev/XXXX` ブランチへ push すると、GitHub Actions（`.github/workflows/preview.yaml`）が `wrangler versions upload --preview-alias dev-XXXX` を実行し、本番へは公開せずにプレビュー用 Version をアップロードする。同じブランチへ再 push しても alias が新しい Version を指すため、**URL は変わらず内容だけ最新になる**。URL は `skyshare-preview-domain-proxy`（別リポジトリ・別 Worker）が `*.skyshare.nekono.dev` で受けて workers.dev へ中継する。

## 1. 開発ブランチの作成（新機能・要望追加・要件追加の依頼時）

ユーザーから新機能の実装、要望・要件の追加などを依頼されたら、**作業を始める前に**、次のスクリプトで作業ブランチを作成する。`git checkout -b` や `git worktree add` を直接使ってはならない（命名規則の検証を通すため）。

```sh
.claude/skills/remote-preview/scripts/create-dev-branch.sh < XXXX > [--base < 分岐元 > ] [--branch-only]
```

- 既定ではブランチ `dev/XXXX` と作業用 worktree（`.claude/worktrees/XXXX`）を作る。分岐元は既定で `origin/develop`
- `--branch-only` を付けると worktree を作らず、ブランチだけ作る（現在のブランチは切り替わらない）
- worktree を作った場合は、スクリプトが表示する `git submodule update --init && npm ci` を実行してから作業する
- 作成後の作業・commit・push は、その `dev/XXXX` ブランチ（worktree）上で行う

### 命名規則

`dev/XXXX` の `XXXX` は次をすべて満たすこと。**この規則に合わないブランチは preview.yaml の対象外**となり、プレビューURLは発行されない（スクリプトも作成を拒否する）。

- 小文字英数字とハイフン（`-`）のみ。大文字・アンダースコア・スラッシュ・ドット・日本語などは使わない
- 先頭・末尾のハイフン、連続するハイフンは不可
- 50文字以内

例: `dev/thread-post`（良い） / `dev/Thread_Post`・`dev/fix.ogp`・`feature/foo`（規則違反）

`XXXX` はユーザーの依頼内容から機能を表す短い英語名を自分で決めてよい。決められない曖昧さがある場合のみ確認する。

## 2. プレビューURLの案内（動作確認を求められたとき）

ユーザーが、自分（Claude）が製造したコードの挙動を確認したいという要望を示したときは、プレビューURLを案内する。依頼文の中だけでなく、作業の途中・完了報告の場面で出た要望も対象とする。

- 例: 「動作確認したい」「実機で見たい」「プレビューを見せて」「挙動を確認したい」「触ってみたい」
- 手順: 変更を commit して `dev/XXXX` へ push 済みであることを確認する（未 push なら push の可否をユーザーに確認する）。そのうえで次のスクリプトで URL を得て案内する

```sh
.claude/skills/remote-preview/scripts/preview-url.sh [ブランチ名] # 省略時は現在のブランチ
```

### 案内するURLの規則（必須）

- 案内するのは、**`skyshare-preview-domain-proxy` 経由で疎通できる nekono.dev ドメインのURL**、すなわち `https://dev-XXXX.skyshare.nekono.dev` のみ
- **`*.workers.dev` のURL や version-id 形式のURLを案内してはならない**（ジョブ Summary や wrangler の出力に出てきても、ユーザーには案内しない）
- push 直後は GitHub Actions のビルド・アップロードが完了するまで反映されない。ジョブの完了状況（`gh run list --workflow preview.yaml` など）を確認し、未完了ならその旨を伝える
- ブランチが命名規則に合わず URL が発行されない場合は、その旨を伝え、規則に合うブランチへ移す（`create-dev-branch.sh` で作り直して cherry-pick など）ことを提案する

## 3. 注意点（案内時にユーザーへ補足してよい）

- プレビューは本番 Worker と同じバインディング・Secrets を使う。レガシーバックエンドなど外部への書き込みは本番データに届く
- 同一ブランチへの連続 push では古い実行が中断され、最新の push だけが反映される
- プレビューを行うには Worker が一度デプロイ済みで、`wrangler.jsonc` の `preview_urls` が `true` であること

## 関連ファイル

- `.github/workflows/preview.yaml` — push で Version をアップロードする CI
- `../skyshare-preview-domain-proxy/` — `*.skyshare.nekono.dev` を workers.dev へ中継する別 Worker（デプロイは別途 `npm run deploy`）
