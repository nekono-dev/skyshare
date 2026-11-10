# 調査ログ: comments-lib

## Summary

- **Feature**: `comments-lib`
- **Discovery Scope**: Extension（既存の `src/lib` のコメントの書き直し。コードの構造は変えない）。Light discovery を実施した。
- **Key Findings**:
  - 対象は `src/lib` の 223 ファイル（`api/schema` を除く）。コメント行は約 8,100 行。許容リストの所有者 `comments-lib` の項目は 193 件（116 ファイル）。
  - 検査（`scripts/architecture/commentRules.ts`）は、行頭がコメントの記号の行だけを見る。また、ファイルと規則の組ごとに最初の 1 件しか報告しない。行末のコメントや、検査の対象外の経緯の記述は、検査では見つからない。
  - 基準（`.kiro/steering/comments.md`）と `tech.md` の先頭ヘッダの記述が食い違う。基準を正本とする。
  - 振る舞いの不変は、コメントを読み飛ばした字句列（トークン列）の比較で確かめられる。

## Research Log

### 検査の判定の仕組み

- **Context**: 許容リストの項目を正しく消すため、検査の判定の細部を確かめる必要があった。
- **Sources Consulted**: `scripts/architecture/commentRules.ts`（`checkSource`・`headerOf`・`FORBIDDEN_PATTERNS`）、`tests/unit/scripts/commentRules.test.ts`、`config/comments/allowlist.json`。
- **Findings**:
  - 先頭ヘッダは、シェバン行・`---`・空行を飛ばした最初の行が `/**` のときだけ見つかる。`//` の行や import が先に来ると `header-missing` になる。
  - ヘッダの行数は `/**` と `*/` を含まない内容の行数。上限は 6 行。箇条書きは `- ` で始まる行の数で、上限は 3 件。目的の行数の下限は見ない。
  - 禁止パターンと日付は、行頭がコメントの記号の行だけに当てる。日付はバッククォートで囲んだ部分を除いて判定する。
  - 報告は `(path, rule)` ごとに最初の 1 件。同じ規則の違反が複数あっても、1 件を直すと報告は消えるが、残りの同種の違反は検査で見つからない。
  - 許容リストは `(path, rule)` の組で照合される。解消済みの項目が残るとテストが失敗する（stale）。許容されていない違反が出るとテストが失敗する（new）。
  - 現在の `commentRules.test.ts` は 20 件すべて通る（ベースライン）。
  - `commentRules.ts` は引数なしでは何も出力しない。読み取りだけの確認には `--emit-allowlist` を使い、その出力を標準出力で見るだけにする（許容リストは書き換えない）。
- **Implications**: 検査が通ったあとも、行末のコメントと、検査の対象外の語（「旧」「移行」「以前は」「かつては」など、comments.md の『書かない』の節）を、grep と読みで確かめる必要がある。

### 基準と `tech.md` の食い違い

- **Context**: `tech.md` の「Code Quality」は、各モジュールの先頭に「責務と処理概要」「実装上の制約」を書くとしている。基準（`comments.md`）は、目的を 1〜2 行で書き、箇条書きは 3 件までと定める。
- **Findings**: 既存の 88 件の `header-too-long` と 62 件の `header-too-many-bullets` は、「責務と処理概要」の書き方から来ていると見られる。
- **Implications**: 基準を正本とする（controller の指示、および検査が基準どおりに作られているため）。`tech.md` の改訂は本 spec の範囲外とし、comment-policy の作業 4.1 で改訂する（未実施）。完了の報告に挙げる。

### e2e の実行位置

- **Context**: brief は各変更の完了条件に e2e を含める。roadmap の Phase 7 は、各 spec が自分の領域の検証（型・imports・unit・component・route・render）を完了条件にし、e2e は最後の統合で実行するとしている。
- **Findings**: 両者は矛盾しない。e2e を最終タスクに置けば、両方を満たす。
- **Implications**: 本 spec の完了条件から e2e を外す。e2e は comments-api-schema が最終統合で 1 回実行し、comments-* の単位の外の整形差分だけを戻す。

### 振る舞い不変の確かめ方

- **Context**: 要件 5.1（コメント以外の行が変わらない）を機械で確かめる方法が必要だった。
- **Alternatives Considered**:
  1. `git diff` を目視する: 223 ファイルの量では見落としが出る。
  2. 正規表現でコメントを消して比べる: 文字列リテラル内の `//` や `/*` で誤る。
  3. TypeScript のスキャナで字句列を比べる（採用）: コメントは trivia として読み飛ばされ、文字列リテラルは字句の中身として比べられる。
- **Selected Approach**: `typescript` の `createScanner`（`skipTrivia: true`）で、旧版（`git show HEAD:<path>`）と新版の字句の種類と字句の文字列を並べて比べる。一時ファイルは作業用のディレクトリ（スクラッチパッド）に置き、リポジトリには追加しない。
- **Follow-up**: `.tsx` の JSX の文字列部分で誤判定が出たら、その箇所を読んで確かめる。

### 生成物への影響

- **Context**: `src/lib/api/contract` などは `src/lib/api/schema` から import される。コメントを変えても生成物（`src/client`）は変わらないはずだが、確かめる必要がある。
- **Findings**: `src/lib/codegen` は生成の補助コード。生成物の内容は、zod スキーマの `summary`・`description` から来る（schema は本 spec の対象外）。
- **Implications**: 最終統合で `npm run codegen` を実行し、`src/client` に差分が出ないことを確かめる。

## Architecture Pattern Evaluation

| Option                     | Description                                                                         | Strengths                                                        | Risks / Limitations                        | Notes                                        |
| -------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| 領域ごとのグループ（採用） | `src/lib` の直下の領域ごとに 7 グループに分け、グループごとに書き直しと検証を閉じる | 差分がレビュー単位に収まる。各グループの完了を検査で確かめられる | グループ間で基準の判断がばらつく恐れがある | 基準を先に確定しているため、判断の差は小さい |
| 1 つの作業にまとめる       | 223 ファイルを 1 回で直す                                                           | 作業の手順が 1 つ                                                | 差分が大きすぎ、検証とレビューが困難       | roadmap で却下済み                           |
| 機械的な一括置換           | 禁止語を一括で消す                                                                  | 速い                                                             | 「最小要件」など正当な用法を誤って消す     | roadmap で却下済み                           |

## Design Decisions

### Decision: グループの分け方

- **Context**: 223 ファイル・約 8,100 コメント行を、レビューできる単位に分ける。
- **Alternatives Considered**:
  1. 許容リストの件数でまとめる: 領域の境界をまたぐため、確認の手順が散る。
  2. 領域（`src/lib` の直下のフォルダ）でまとめる（採用）: 領域の責務の文脈を保ったまま判断できる。
- **Selected Approach**: 7 グループ（G1〜G7）。各グループの規模は、ファイル数 26〜42、コメント行 442〜1,728。
- **Rationale**: 規模の偏りは大きいが、領域の境界と、検証の単位（領域の依存）が揃う。
- **Trade-offs**: `i18n`（42 ファイル）はコメントが少なく、`atproto` を含む G1 はコメントが多い。
- **Follow-up**: グループの完了時に、判断の差（残した・削ったコメントの一覧）を報告に挙げる。

### Decision: 許容リストの削除の方法

- **Context**: `--emit-allowlist` で作り直すと、新しい違反が黙って許容される。
- **Selected Approach**: 各グループの完了時に、そのグループの `comments-lib` の項目だけを、手で `allowlist.json` から削除する。`--emit-allowlist` は読み取りの確認だけに使う。
- **Follow-up**: 削除後の `allowlist.json` の差分は、`comments-lib` の項目だけであることを確かめる。

## Risks & Mitigations

- 検査の対象外の語（行末のコメント、「旧」「移行」「以前は」など）が残る — grep で確かめ、読みで判断する。
- 判別に迷うコメントを削ってしまう — 迷ったら残し、報告に挙げる（要件 4.5）。
- 他の所有者の違反が、テストの失敗として見える — 他の `comments-*` の項目は変えない。失敗の原因が別の所有者なら、本 spec の完了条件から外して報告する。
- 字句の比較で、JSX のテキストの扱いが誤判定される — 該当箇所を読んで確かめる。

## References

- `.kiro/steering/comments.md` — コメントの基準（正本）
- `scripts/architecture/commentRules.ts` — 検査の本体
- `tests/unit/scripts/commentRules.test.ts` — 検査のテスト
- `.kiro/steering/roadmap.md`（Phase 7） — 分割と完了の条件
