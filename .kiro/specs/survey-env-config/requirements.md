# Requirements Document

## Project Description (Input)

詳細は同じフォルダの `brief.md`（discovery の成果物）を参照する。

- **誰の問題か**: 運用者。アンケートの設定（リポジトリ変数 `SURVEY_CONFIG`）が 1 つで、本番と develop のビルドが同じ値を読むため、develop だけで試験用のアンケートを使って確かめられない（`survey-operations` の 4.2 の実機の確認も止まっている）。
- **現状（2026-11-18）**: `deploy.yaml`・`preview.yaml` はまだリポジトリ変数 `SURVEY_CONFIG` を参照する旧ワークフローである。CLI は `status`・`publish`・`unpublish` だけ `--env` を取り、`add` は環境を指定せず、`prune`・`remove` は両環境の目録を見て共有の設定から除去する。移行の事前作業として `production` 環境を作成し、配備ブランチを `release/**` に制限し、現在の設定を登録済みである。削除前のリポジトリ変数との一致はハッシュで確認した。続いて `develop` 環境を作成し、配備ブランチを `develop`・`dev/**` に制限した。リポジトリ変数を削除し、参照できる組織の同名変数も無いことを確認した後、旧ワークフローで develop を手動再配備し、設定なしで成功した。開発用の結果の保管先には目録が無く、退避した設定の識別子に対応する結果・可視フラグも無いため、削除対象は無かった。残りは新しいワークフローと CLI の取り込み、両環境の状態確認、退避ファイルの削除である。production の設定は最初のリリースから使う。本番にはアンケート機能をまだ配備しておらず、本番の結果バケットは同日に作成済みである。
- **何を変えるか**: GitHub Environments（`production`・`develop`）に環境ごとの `SURVEY_CONFIG` を持たせる。`release/**` は `production`、`develop` ブランチと `dev/**` のプレビューは `develop` の環境を使う。CLI の `add`・`prune`・`remove` も `--env` 必須にし、除去は自分の環境の目録だけで判断する。設定の JSON の作り方（`add --file`）は変えない。現在の設定は `production` の環境へ移す。

## Introduction

運用者は、アンケートの設定を本番（`production`）と検証用（`develop`）で別々に持てるようになる。develop に試験用のアンケートを置いても本番のビルドには載らず、本番のアンケートも develop には載らない。設定の JSON の作り方と、下書きから登録する流れは変わらない。変わるのは、登録・除去の対象の環境を運用者が指定することと、除去の判断が指定した環境の目録だけで完結することである。

この文書で使う言葉:

- **環境**: `production`（本番）と `develop`（検証用。プレビューも共用）。結果の保管先は環境ごとに別である（`survey-operations` の定義を引き継ぐ）。
- **環境の設定**: 環境ごとに独立して持つアンケートの設定。GitHub の Environments の変数 `SURVEY_CONFIG` に置く。
- **共有の設定**: リポジトリまたは組織に置かれ、複数の環境から参照できるアンケートの設定。この spec の後は使わず、存在する場合はビルドを止める。
- **目録**: 結果の保管先にある、集計済みのアンケートの一覧（`survey-results-aggregation` が定める）。
- **集計済み**: 指定した環境の目録に、そのアンケートの記録（結果あり、または回答 0 件）があること。
- **プレビュー**: `dev/**` のブランチごとに発行される確認用の配備。`develop` の環境の設定を使う。

## Boundary Context

- **In scope**:
  - 環境ごとの設定の分離（ビルドがどの環境の設定を読むか）。
  - 運用 CLI（`add`・`status`・`publish`・`unpublish`・`prune`・`remove`）の環境の指定と、除去・登録の判断を指定した環境の目録だけで行うこと。
  - 環境の設定の読み書きと、環境が未作成・設定が未登録のときの扱い。
  - 共有の設定から環境の設定への移行の手順（現在の設定を `production` へ移し、共有の設定を取り除く）。
  - 運用手順書（`survey-run` skill・`docs/DEVELOP.md`）の更新（`survey-run` skill は Claude 用の `.claude/skills/` と Codex 用の `.agents/skills/` の 2 つの複製を同じ内容にする。利用者の決定 2026-11-16）と、`survey-operations` の要件のうち共有の設定を前提にした記述の置き換え。
- **Out of scope**:
  - 設定の JSON の形式・質問の内容（`surveys`）。
  - 統計ファイルの形式・集計・結果ページ（`survey-results-aggregation`・`survey-results-public`）。
  - 結果の保管先（R2）・本番のバケットの作成。
  - CI に設定の書き込み権限を与えること（書き込みは従来どおり運用者の手元の認証済み CLI だけ）。
  - `survey-operations` の 4.2（実機の確認）そのもの。この spec の完了後に、develop の試験用のアンケートで進める。
- **Adjacent expectations**:
  - `survey-operations` は、コマンド体系・段階の定義・公開の切り替え・再配備・出力の規則を定める。この spec はそのうち、環境の指定（要件 2）、除去（6・7）、登録の可否と更新の判断（8.12〜8.14・8.16）、手順書（9.5・9.6・9.8・9.9・9.11・9.14〜9.16）の、共有の設定・両環境の目録・移行時の例外に関わる記述を置き換える。それ以外は引き継ぐ。
  - `survey-results-aggregation` は、目録・結果・可視フラグの形式と、環境ごとの結果の保管先を定める。この spec は形式と既存の書き込み規則を変えず、既存の公開・非公開の切り替えによる書き込みを保つ。移行時に限り、開発用の目録・結果・可視フラグを削除する。
  - 環境の作成と変数の移行は運用者の作業である。この spec は手順を定めるが、実行そのものは運用者（または運用者の許可を得た作業者）が行う。

## Requirements

### Requirement 1: ビルドが読む設定の環境ごとの分離

**Objective:** As a 運用者, I want 本番・develop・プレビューのビルドがそれぞれの環境の設定だけを読むこと, so that develop の試験用のアンケートが本番に載らず、本番の設定も develop に漏れない

#### Acceptance Criteria

1. When `release/` で始まるブランチの配備のビルドが実行される, the 配備の仕組み shall `production` の環境の設定をビルドに渡す。
2. When `develop` ブランチの配備のビルドが実行される, the 配備の仕組み shall `develop` の環境の設定をビルドに渡す。
3. When `dev/` で始まるブランチのプレビューのビルドが実行される, the 配備の仕組み shall `develop` の環境の設定をビルドに渡す。
4. The 配備の仕組み shall ビルドに、対象でない環境の設定も共有の設定も渡さない。
5. While 対象の環境に設定が登録されていない, the ビルド shall アンケートの設定が無い状態（今の「設定が無ければアンケート機能は出ない」動作）で完了する。
6. The 配備の仕組み shall 本番・develop・プレビューの配備の対象ブランチと、配備の可否の判断（`release/**` と `develop` 以外では配備しないこと）を、この変更の前から変えない。
7. The 配備の仕組み shall 検証（verify）と E2E のジョブにアンケートの設定を渡さない（今の規則を保つ）。
8. If 共有の設定が存在する, then the ビルド shall 対象の環境の設定を読む前に失敗し、配備しない。

### Requirement 2: 運用 CLI の環境の指定

**Objective:** As a 運用者, I want すべてのコマンドで対象の環境を必ず選ぶこと, so that 本番と develop を取り違えて設定を書き換えない

#### Acceptance Criteria

1. The 運用 CLI shall `add`・`status`・`publish`・`unpublish`・`prune`・`remove` のすべてに、`--env production` または `--env develop` の指定を必須とする。
2. If `--env` が省略された、または `production`・`develop` 以外の値だった, then the 運用 CLI shall 何も読み書きせず、使い方を示す失敗を返す。
3. The 運用 CLI shall 指定した環境の設定と、指定した環境の目録・可視フラグだけを読み書きの対象にし、指定していない環境の設定・目録・可視フラグには触れない。
4. The 運用 CLI shall `--dry-run`・`--no-deploy`・`--repo` の意味と、結果の 1 行の形式・終了コード・秘密を出さない規則を、`survey-operations` の定めのまま保つ。
5. The 運用 CLI shall アンケートの設定の JSON の作り方（下書きの形式と `add --file`）を変えない。

### Requirement 3: 設定の読み書きと未作成・未登録の扱い

**Objective:** As a 運用者, I want 環境の設定だけが読み書きされ、環境や設定が無いときも安全に扱われること, so that 共有の設定へ誤って書き込んだり、設定が無いのを異常と取り違えたりしない

#### Acceptance Criteria

1. When 運用 CLI が設定を読む, the 運用 CLI shall 指定した環境の設定だけを読み、共有の設定を読まない（環境の設定が無いとき、共有の設定へ代わらない）。
2. When 運用 CLI が設定を書き込む、または削除する, the 運用 CLI shall 指定した環境の設定だけを対象にし、共有の設定には書き込まない。
3. If 指定した環境に設定が登録されていない, then the 運用 CLI shall 設定が空であるものとして扱う（`status` はアンケートが無いことを示し、`add` は新しい設定として登録する）。
4. If 指定した環境が作成されていない状態で設定を書き込もうとした, then the 運用 CLI shall 何も書き換えず、環境が未作成であることを示す固定の文言で失敗を返す。
5. If 指定した環境が作成されていない状態で設定を読もうとした, then the 運用 CLI shall 設定が空であるものとして扱う。
6. When 除去の結果、指定した環境の設定にアンケートが残らない, the 運用 CLI shall その環境の設定そのものを削除する。
7. The 運用 CLI shall 設定の変数の大きさの上限（48 KB。ここでの 1 KB は 1000 バイトで、GitHub の環境の変数の実際の上限 48,000 バイト）を、環境ごとの設定それぞれに適用し、`status` の見出しには指定した環境の設定の大きさを示す。
8. If 環境の設定を読めない、または外部サービスを利用できない, then the 運用 CLI shall `survey-operations` の定めのとおり、何も変更せず、認証が要るのか利用できないのかを区別できる固定の文言で失敗を返す。

### Requirement 4: 登録（add）の判断を指定した環境で完結させる

**Objective:** As a 運用者, I want 登録の可否が、指定した環境の目録だけで決まること, so that develop の試験が本番の登録を止めず、本番の登録も develop の状態に左右されない

#### Acceptance Criteria

1. When 新規アンケートの登録が実行される, the 運用 CLI shall 指定した環境の設定にあるすべてのアンケートの識別子が、指定した環境の目録にある場合だけ登録を認める（開始前のアンケートも対象とし、結果あり・回答 0 件のどちらも集計済みとする）。
2. When `add` が実行される, the 運用 CLI shall `--dry-run` を含め、指定した環境の目録だけを読み、もう一方の環境の目録を読まない。
3. If 指定した環境の目録が存在しない, then the 運用 CLI shall 目録を空として扱う。If 目録の取得に失敗した、または形式が不正である, then the 運用 CLI shall 何も変更せず失敗を返す。
4. If 新規登録を、指定した環境の未集計のアンケートが妨げる, then the 運用 CLI shall 次の固定の 1 行を返す。`error: refused: この環境に未集計のアンケートがあります。集計を待つか、開始前なら remove、開催中なら締切を前倒しして配備し、集計を待ってください。`
5. The 運用 CLI shall 既存のアンケートの更新に対する制限（`survey-operations` の 8.16・8.17 の締切の規則）を、指定した環境の目録の集計済みの判定で適用する。
6. When 同じ内容の下書きを `production` と `develop` に別々に `add` する, the 運用 CLI shall それぞれの環境の設定に独立して登録する（片方への登録が、もう一方の設定・識別子の採番に影響しない）。
7. The 運用 CLI shall 下書きの形式の検証・開始日時の補い・識別子の発行・締切の日付の規則・変更が無いときの結果を、`survey-operations` の定めのまま保つ。

### Requirement 5: 除去（prune・remove）の判断を指定した環境で完結させる

**Objective:** As a 運用者, I want 設定からの除去が、指定した環境の目録だけで決まること, so that 環境ごとの設定を別々に片付けられ、片方の未集計がもう一方の除去を止めない

#### Acceptance Criteria

1. When `prune --env <環境>` が実行される, the 運用 CLI shall 指定した環境の設定のうち、終了時刻を過ぎていて、指定した環境の目録に記録があるものだけを、その環境の設定から除去する。
2. When `prune` が実行される, the 運用 CLI shall もう一方の環境の目録を読まず、その結果をどちらの判断にも使わない。
3. If 終了時刻を過ぎたアンケートが指定した環境の目録に無い, then the 運用 CLI shall そのアンケートを除去せず、その環境で集計が済んでいないことを示して残す。
4. If 指定した環境の目録が読めない、または形式の検証に通らない, then the 運用 CLI shall 何も除去せず、失敗を返す。
5. The 運用 CLI shall 開始前・開催中のアンケートを `prune` で除去しない（`survey-operations` の定めのまま保つ）。
6. When `remove <識別子> --env <環境>` が実行され、そのアンケートが開始前である, the 運用 CLI shall 指定した環境の設定から除去する。
7. When `remove` の対象が終了済みである, the 運用 CLI shall 指定した環境の目録に記録があるときに限り、その環境の設定から除去する。
8. If 終了済みの対象が指定した環境の目録に無い、または対象が開催中である, then the 運用 CLI shall 結果を失うことを示して拒否し、設定を変更しない。
9. If 対象の識別子が指定した環境の設定に無い, then the 運用 CLI shall 該当が無いことを示して失敗を返す。
10. The 運用 CLI shall 拒否を覆す強制の指定を持たない（`survey-operations` の定めのまま保つ）。
11. When 除去を行った, the 運用 CLI shall 除去した識別子と、残した識別子（理由つき）を結果に示す。残した理由が「この環境で未集計」のときは、手順書の該当の項への案内を添える。

### Requirement 6: 既存の設定の移行と共有の設定の取り除き

**Objective:** As a 運用者, I want 現在の設定を本番へ移し、共有の設定を取り除く手順が決まっていること, so that 移行の途中で設定を失わず、develop に本番の設定が漏れない

#### Acceptance Criteria

1. The 運用手順書 shall 移行の順序として、(a) 現在の設定の退避、(b) 本番の環境の作成と配備ブランチの制限、(c) 退避した設定の本番の環境への登録と一致確認、開発用の環境の作成と配備ブランチの制限、(d) 共有の設定の削除、設定なしでの開発用の再配備、開発用の旧データの確認と削除、新しい配備の仕組みと運用 CLI の develop への取り込み、(e) 両環境の状態確認と退避ファイルの削除、を示す。
2. The 運用手順書 shall (d) の共有の設定の削除を、本番への登録と一致確認および開発用の環境の作成の後に置き、設定なしでの開発用の再配備と旧データの確認・削除を経てから新しい配備の仕組みを取り込む順序を示し、本番の設定の喪失と共有の設定によるビルドの停止を避ける理由を説明する。
3. When 移行が終わった, the 運用 CLI shall `status --env production` で移した設定のアンケートを表示し、`status --env develop` でアンケートが無いことを表示する。
4. The 運用手順書 shall 退避した設定の本文を、リポジトリにも結果の出力にも残さないことを示す。
5. The 運用手順書 shall 環境の作成と変数の移行が運用者の作業であること（手元で認証済みの `gh` を使うこと）を示す。
6. If 共有の設定が残っている, then the 運用手順書 shall 環境の設定が無い場合に共有の設定へ代わりうるため、新しい配備の仕組みがビルドを停止することと、共有の設定の削除が必要であることを示す。
7. The 運用手順書 shall 移行時に、develop のアンケートの設定と開発用の結果の保管先にある目録・結果・可視フラグを削除し、本番の設定と結果の保管先に触れずに develop をアンケートが無い状態にする手順を示す。

### Requirement 7: 運用手順書と既存の記述の整合

**Objective:** As a 運用者, I want 手順書と既存 spec の記述が新しい環境の分け方と食い違わないこと, so that 手順どおりに操作すれば、環境を取り違えず安全に運用できる

#### Acceptance Criteria

1. The `survey-run` skill shall 6 つのコマンドすべてが `--env` 必須であること、環境ごとに設定が独立していること、`add` の登録可否と `prune`・`remove` の除去が指定した環境の目録だけで決まることを示す。
2. The `survey-run` skill shall develop の試験用のアンケートの登録・公開・非公開・除去の流れを、本番に影響しない手順として示す。
3. The `docs/DEVELOP.md` shall アンケートの設定の項（3.x）、main への取り込み前の除去の手順（5.x）、CI/CD の設定の変数の項（6.x の `SURVEY_CONFIG` の行）を、環境ごとの設定に合わせる。
4. The `docs/DEVELOP.md` shall 本番の取り込み前の除去を、`prune --env production` で行う手順にし、`develop` の設定の除去は本番の取り込みと独立であることを示す。
5. The `docs/DEVELOP.md` shall 環境の作成・環境の設定の登録・移行の順序（要件 6）を示す。
6. The 運用手順書 shall 設定の変数や公開状態を、専用の CLI 以外で直接書き換えないことを示す（`survey-operations` の定めのまま保つ。移行の手順は例外として明記する）。
7. The `roadmap.md` と `survey-operations` の要件・設計・タスク shall、「設定の変数が両環境で共有される」「`prune`・`remove`・`add` が両環境の目録を確認する」という記述を、この spec で置き換わったものとして追補する（既存の記述は削除せず、置き換えを示す）。
8. The 運用 CLI shall 本番のリリースブランチの選び方・再配備の起動の動作（`survey-operations` の要件 5）を変えない。
