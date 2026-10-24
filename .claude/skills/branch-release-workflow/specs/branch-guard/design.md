# ブランチ運用の強制 設計書

## 1. 構成

| パス                            | 責務                                 |
| ------------------------------- | ------------------------------------ |
| `scripts/lib.mjs`               | 宣言の読み込み・検証とブランチの判定 |
| `scripts/brw.mjs`               | フック・作成・片付け・再開のサブコマンド |
| `templates/config.example.json` | 宣言ファイルの記入例                 |
| `templates/settings.hook.json`  | フックを有効にする設定の案           |

## 2. 関係図・ワークフロー

呼び出しと読み込みの依存方向を示す。

```mermaid
flowchart LR
  brw --> lib
  brw --> ext_git["git"]
  lib --> ext_git
  lib --> example["config.example"]
  brw --> settings_hook["settings.hook"]
```

フックが git コマンドを判定し、結果を返すまでの流れを示す。

```mermaid
sequenceDiagram
  participant ext_claude as Claude Code
  participant brw
  participant lib
  ext_claude->>brw: Bash コマンド
  brw->>lib: 宣言の読み込み
  alt 宣言が不正または無い
    lib-->>brw: 読み込み失敗
    brw-->>ext_claude: ask
  else 宣言が有効
    lib-->>brw: 宣言
    brw->>lib: ブランチの判定
    lib-->>brw: allow か deny
    brw-->>ext_claude: 判定結果
  end
```

## 3. 設計項目

### D-1: 宣言ファイルの読み込みと検証 (FR-1, NFR-2)

宣言は `.claude/branch-release-workflow.json` に置く。

| キー              | 型           | 検証                         |
| ----------------- | ------------ | ---------------------------- |
| workBranches      | 文字列の配列 | 必須。1 件以上               |
| protectedBranches | 文字列の配列 | 必須                         |
| baseBranch        | 文字列       | 省略時は develop             |
| namePattern       | 正規表現     | 正規表現として解釈できること |
| maxNameLength     | 整数         | 省略時は 54                  |

スクリプトの import は Node 標準モジュールと相対パスに限る。

### D-2: ブランチの判定 (FR-2, FR-3, NFR-1)

```json
{
  "protectedBranches に一致": "deny",
  "workBranches に一致": "allow",
  "どちらにも一致しない": "deny",
  "宣言ファイルがない": "ask",
  "宣言が不正": "ask",
  "ブランチを特定できない": "ask"
}
```

保護ブランチの判定を先に行う。glob の `*` は斜線を除く任意の文字列、`**` は斜線を含む任意の文字列に一致する。判定は子プロセスの git を 1 回だけ呼ぶため、1 秒以内に終わる。

### D-3: push の送り先の解釈 (FR-4)

| 引数                            | 判定対象のブランチ       |
| ------------------------------- | ------------------------ |
| 送り先の指定なし                | 現在のブランチ           |
| `HEAD`                          | 現在のブランチ           |
| `<元>:<先>`                     | 先（refs/heads/ は除く） |
| `refs/tags/` で始まる、`--tags` | 判定しない               |
| `--all`、`--mirror`             | 特定できないため ask     |

連結したコマンド（`&&`、`;`、`|`）と `git -C <dir>`、`cd <dir> &&` を解釈し、最も厳しい判定を返す。

### D-4: 作業ブランチの作成 (FR-5)

```json
{
  "接頭辞": "workBranches の最初の 'xxx/*' の xxx/",
  "検証": ["namePattern", "maxNameLength", "保護ブランチでないこと", "未存在"],
  "分岐元": "--base、省略時は baseBranch（origin を優先）",
  "既定の作成物": "ブランチと worktree（.claude/worktrees/<alias>）"
}
```

検証に失敗したときは何も作らず、終了コード 1 で終わる。

### D-5: 片付けと再開 (FR-6, FR-7)

| サブコマンド        | 確認                                                                                   | 操作                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `finish [ブランチ]` | 作業ブランチであること、worktree に変更がないこと、`origin` との差の commit が 0 件 | worktree を消し、ローカルブランチを消す                                              |
| `resume <ブランチ>` | 作業ブランチであること、ローカルブランチがないこと、`origin` から取得できること       | `origin/<ブランチ>` を追跡するローカルブランチと worktree（`.claude/worktrees/<alias>`）を作る |

- 自分の worktree の中から実行できるよう、git の操作は本体の作業ツリー（`git worktree list` の先頭）で行う。
- 確認に失敗したときは何も消さず・作らず、理由を表示して終了コード 1 で終わる。

## 4. エラー処理

| 事象                       | 処理                                      |
| -------------------------- | ----------------------------------------- |
| フックの入力が JSON でない | 何も出力せず、判定しない                  |
| 宣言が不正                 | 不正な箇所を示して ask を返す             |
| 命名規則への違反           | 理由と規則を表示し、終了コード 1 で終わる |
| 片付けの前の未 push の commit | 件数を表示し、何も消さずに終了コード 1 で終わる |
