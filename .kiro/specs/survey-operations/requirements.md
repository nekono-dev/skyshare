# Requirements Document

## Project Description (Input)

アンケートの運用（登録・状態確認・期限切れの除去）は、専用の CLI（`npm run survey`）と運用手順（`survey-run` skill・`docs/DEVELOP.md`）に分かれている。結果の公表が加わると、公開の切り替えが要る。さらに、回答の削除は Worker が集計の保存後に行うようになるため、現行の除去の判定（回答の行が残っているか）は意味を失う。運用者が状態を一目で把握し、本番を意図せず操作せず、結果を失わずに操作できる体系に作り直す。

この spec は、コマンドを `add`・`status`・`publish`・`unpublish`・`prune`・`remove` の平坦な体系にそろえ、状態を「アンケートごとに 1 つの段階」で示し、公開の切り替えで結果の保管先の可視フラグを書き換えて再配備を起動し、除去を「集計済みだけ」に置き換える。あわせて、アンケート全体の題・説明が設定の形式から無くなることに合わせて、聞き取りと下書きの形式を直す。詳細な背景・決定事項は `brief.md` を参照する。

## Introduction

運用者は、手元で認証済みの CLI だけを使ってアンケートを操作する。この spec は、その CLI のコマンド体系、状態の表示、公開の切り替えと再配備の起動、設定からの除去の規則、運用の手順書を定める。アンケートの設定は GitHub のリポジトリ変数 `SURVEY_CONFIG` に置かれ、集計結果は結果の保管先（R2）に置かれる。この CLI は、設定と、結果の保管先の可視フラグだけを書き換える。

この文書で使う言葉:

- **段階**: 1 つのアンケートが今どこにいるかを示す名前。`upcoming`（開始前）・`active`（開催中）・`closed`（終了済みで集計待ち）・`empty`（集計済みだが回答が 0 件で結果なし）・`hidden`（集計済みで非公開）・`published`（集計済みで公開中）の 6 つ。
- **集計済み**: 結果の保管先の目録に、そのアンケートの記録（結果あり、または回答 0 件）があること。
- **環境**: `production`（本番）と `develop`（検証用。プレビューも共用）。結果の保管先は環境ごとに別である。`SURVEY_CONFIG` は 1 つで、両方の環境のビルドが読む。
- **可視フラグ**: 結果を公開してよいかを示す印。形式と置き場は `survey-results-aggregation` が定める。この CLI だけが書き換える。
- **再配備**: 結果ページは配備のたびに静的に作り直されるため、公開・非公開の切り替えが画面に出るには再配備が要る。
- **下書き**: 聞き取った内容を `add` に渡すための一時ファイル。

## Boundary Context

- **In scope**: コマンド体系（`add`・`status`・`publish`・`unpublish`・`prune`・`remove`）、段階の定義と表示、環境の指定、公開・非公開の切り替えと再配備の起動、設定からの除去の規則、出力と秘密の扱いの規則、下書きの形式（アンケート全体の題・説明を除く）、`survey-run` skill と `docs/DEVELOP.md` の手順。
- **運用中の設定の作り直し**: 運用中の `SURVEY_CONFIG`（質問の題「UIデザインはどちらが好みですか？」）の作り直しは、この spec のタスク 4.2（運用者の作業）だけが担当する。`roadmap.md` の `surveys` の項目はこれに任せる。
- **Out of scope**: 統計ファイルの形式・集計・回答の削除（`survey-results-aggregation`）、結果ページ・ビルド時の取得（`survey-results-public`）、アンケートの設定の形式そのもの（`surveys`）、設定の静的ファイルの生成（`npm run survey:render`）、結果の保管先の作成、CI への書き込み権限の付与。
- **Adjacent expectations**:
  - `survey-results-aggregation` は、統計ファイルの形式・保管先の構成・「可視フラグが無ければ非表示」の意味を定める。この CLI はその形式に従い、可視フラグだけを書き、結果の本体と目録を書き換えない。
  - `surveys` は、設定の形式からアンケート全体の題・説明を廃止する。この spec の下書き・聞き取りはその後の形式に従う。
  - `survey-results-public` は、再配備のビルドで公開のものだけを読んで表示する。この CLI は公開の切り替えの直後に再配備を起動するが、画面に反映されたことまでは確かめない。
  - `survey-results-aggregation` は、公開時に結果と目録を照合する `resultMatchesIndexEntry(entry, result)` と可視状態を読む `isVisible(visibility)` を公開する。この CLI は公開時の照合に前者を使う。識別子の再利用に備える専用規則や、設定と目録の期間の衝突を防ぐ規則は上流に求めない。
  - 回答の削除は Worker の仕事で、この CLI は回答の保存先（D1）に触れない。

## Requirements

### Requirement 1: コマンド体系と出力の約束

**Objective:** As a 運用者, I want 操作が少数の平坦なコマンドにそろい、結果が決まった形で返ること, so that 手順を覚えやすく、結果を取り違えず、秘密も漏れない

#### Acceptance Criteria

1. The 運用 CLI shall `add`・`status`・`publish`・`unpublish`・`prune`・`remove` の 6 つのコマンドだけを受け付ける。
2. If 未知のコマンド、足りない引数、余分な引数、未知の指定が渡された, then the 運用 CLI shall 何も変更せず、使い方を示す失敗の結果を返す。
3. The 運用 CLI shall `status` 以外のコマンドの結果を、決まった形式の 1 行で返す。
4. The 運用 CLI shall 成功と失敗を終了コードで区別し、失敗の結果の先頭を `error:` とする。
5. The 運用 CLI shall 設定の本文、回答、認証情報、外部のコマンドの標準エラーを、結果にもエラーにも出さない。
6. Where 設定や公開状態を書き換えるコマンド（`add`・`publish`・`unpublish`・`prune`・`remove`）である, the 運用 CLI shall `--dry-run` の指定で、何も書き換えず、実際に行われる内容を同じ形式で返す。
7. Where リポジトリを `--repo owner/repo` で指定した, the 運用 CLI shall そのリポジトリの変数と配備を対象にし、指定が無ければ現在のリポジトリを対象にする。
8. The 運用 CLI shall 運用者の手元で認証済みの外部ツールだけを使い、CI に設定や公開状態の書き込み権限を与える前提を持たない。
9. If 外部ツールの認証が無い、または外部サービスを利用できない, then the 運用 CLI shall 何も変更せず、認証が要るのか利用できないのかを区別できる固定の文言で失敗を返す。

### Requirement 2: 環境の指定

**Objective:** As a 運用者, I want 結果の保管先を操作するコマンドで対象の環境を必ず選ぶこと, so that 本番を意図せず操作しない

#### Acceptance Criteria

1. The 運用 CLI shall `status`・`publish`・`unpublish` に `--env production` または `--env develop` の指定を必須とする。
2. If `--env` が省略された、または `production`・`develop` 以外の値だった, then the 運用 CLI shall 何も読み書きせず、使い方を示す失敗を返す。
3. When `prune` または `remove` が除去の可否を判断する, the 運用 CLI shall `production` と `develop` の両方の目録を読み、`--env` を受け付けない。
4. The 運用 CLI shall `add` を環境ごとに分けない（`--env` を受け付けない）。
5. If `--env` を受け付けないコマンドに `--env` が渡された, then the 運用 CLI shall 使い方を示す失敗を返す。

### Requirement 3: 状態の確認

**Objective:** As a 運用者, I want 設定の状態と結果の保管先の状態を 1 つの表で見て、アンケートごとの段階が分かること, so that 次に何をすべきか一目で判断できる

#### Acceptance Criteria

1. When `status` が実行された, the 運用 CLI shall 設定のアンケートと、指定した環境の目録にあるアンケートを合わせた表を返す。
2. The 表 shall アンケートごとに、識別子、段階、終了日時（日本標準時）、設定に残っているか（設定にあるか、結果の保管先だけにあるか）を 1 行で示す。
3. While 現在の時刻が開始時刻より前である, the 運用 CLI shall そのアンケートの段階を `upcoming` とする。
4. While 現在の時刻が開始時刻以後で終了時刻より前である, the 運用 CLI shall そのアンケートの段階を `active` とする。
5. While 現在の時刻が終了時刻以後で、そのアンケートが集計済みでない, the 運用 CLI shall そのアンケートの段階を `closed` とする。
6. While 現在の時刻が終了時刻以後で、集計済みで、回答が 0 件で結果が無い, the 運用 CLI shall そのアンケートの段階を `empty` とする。
7. While 現在の時刻が終了時刻以後で、集計済みで結果があり、可視フラグが公開でない（無い場合、または形式が不正で読めない場合を含む）, the 運用 CLI shall そのアンケートの段階を `hidden` とする。公開かどうかの判定は `survey-results-aggregation` の `isVisible`（可視フラグが無い、または `visible` が真でなければ非公開）を使う。
8. While 現在の時刻が終了時刻以後で、集計済みで結果があり、可視フラグが公開である, the 運用 CLI shall そのアンケートの段階を `published` とする。
9. The 表 shall 設定から除去済みで結果の保管先にだけ記録があるアンケートも、同じ規則の段階で含める。
10. The 表 shall アンケートの題を持たず、識別子で区別する。
11. The 運用 CLI shall 表の見出しに、設定の変数の大きさ（KB）と上限（48 KB）を示す。
12. If 設定にも指定した環境の目録にもアンケートが無い, then the 運用 CLI shall アンケートが無いことを示す。
13. If 指定した環境の目録が読めない、または形式の検証に通らない, then the 運用 CLI shall 表を返さず、失敗を返す。
14. The 運用 CLI shall `status` で設定も結果の保管先も書き換えない。
15. If 指定した環境の可視フラグがあるのに形式の検証に通らない, then the 運用 CLI shall そのアンケートの段階を `hidden` としたうえで、行の末尾に警告の印として `!invalid-visibility` を付け、一目で分かるようにする（結果ページのビルドは不正な可視フラグで失敗するため、運用者が気づける必要がある。この場合も `status` は失敗せず表を返す）。

### Requirement 4: 公開と非公開の切り替え

**Objective:** As a 運用者, I want 集計済みの結果を自分の操作で公開・非公開にでき、集計前のものは誤って操作できないこと, so that 公表の判断を確実に自分で行える

#### Acceptance Criteria

1. When `publish <識別子> --env <環境>` が実行され、そのアンケートが集計済みで結果がある, the 運用 CLI shall 指定した環境の可視フラグを公開に書き換える。
2. When `unpublish <識別子> --env <環境>` が実行され、そのアンケートが集計済みで結果がある, the 運用 CLI shall 指定した環境の可視フラグを非公開に書き換える。
3. If 対象のアンケートの段階が `upcoming`・`active`・`closed` のいずれかである, then the 運用 CLI shall 何も書き換えず、その段階を示して拒否する。
4. If 対象のアンケートの段階が `empty` である, then the 運用 CLI shall 公開できる結果が無いことを示して拒否する。
5. If 対象の識別子が、設定にも指定した環境の目録にも無い, then the 運用 CLI shall 該当が無いことを示して失敗を返す。
6. If `publish` の対象の結果が読めない、形式の検証に通らない、または目録の記録と一致しない（識別子・開始日時・終了日時が `survey-results-aggregation` の `resultMatchesIndexEntry` で一致しない）, then the 運用 CLI shall 公開に書き換えず、`error: invalid` の失敗を返す。
7. If 対象の結果が読めない、または形式の検証に通らない, then the 運用 CLI shall `unpublish` では可視フラグを非公開に書き換える。
8. When 可視フラグが既に望む状態である, the 運用 CLI shall 書き換えず、変更が無かったことを成功として返す。
9. The 運用 CLI shall 切り替えで、結果の本体と目録を書き換えず、指定した環境以外の可視フラグにも触れない。
10. The 運用 CLI shall 設定にアンケートが残っているかどうかに関わらず、集計済みであれば切り替えられるようにする。
11. If 指定した環境の可視フラグが形式の検証に通らない, then the 運用 CLI shall `publish` と `unpublish` を拒否せず、通常どおり進める（可視フラグを望む状態で上書きする。`unpublish` は不正な可視フラグを直す手段になる）。可視フラグが不正でも、「既に望む状態」とは見なさず書き換える。

### Requirement 5: 再配備の起動

**Objective:** As a 運用者, I want 公開の切り替えに続いて対象環境の再配備が起動されること, so that 切り替えが画面に反映される

#### Acceptance Criteria

1. When 可視フラグの書き換えが成功した, the 運用 CLI shall 対象の環境の配備を、公開しない確認だけの動作ではなく実際に公開する動作で起動する。
2. When `--env develop` で起動する, the 運用 CLI shall `develop` ブランチの配備を起動する。
3. When `--env production` で起動する, the 運用 CLI shall 最新のリリースブランチ（`release/` で始まるブランチのうち、最後に更新されたもの）の配備を起動する。
4. If `--env production` で配備を起動するのに、リリースブランチが 1 つも無い、または一覧を取得できない, then the 運用 CLI shall 可視フラグを書き換えず、配備も起動せず、その理由を示して失敗を返す。
5. If 可視フラグの書き換えの後に配備の起動に失敗した, then the 運用 CLI shall 可視フラグの書き換えが保存済みであることと、同じコマンドの再実行で配備だけを起動し直せることを示して失敗を返す。
6. When 可視フラグが既に望む状態だった, the 運用 CLI shall 配備の起動の再試行ができるよう、配備を起動する。
7. Where `--no-deploy` が指定された, the 運用 CLI shall 可視フラグだけを書き換え、配備を起動せず、起動しなかったことを結果に示す。
8. Where `--dry-run` が指定された, the 運用 CLI shall 配備を起動せず、どのブランチで起動するかを結果に示す。
9. The 運用 CLI shall 配備の起動を運用者の手元の認証で行い、配備が終わったこと・画面に反映されたことまでは確かめない。

### Requirement 6: 設定からの除去（prune）

**Objective:** As a 運用者, I want 集計済みのアンケートだけが設定から自動で外れること, so that 結果を失わずに設定を軽く保てる

#### Acceptance Criteria

1. When `prune` が実行された, the 運用 CLI shall 終了時刻を過ぎたアンケートのうち、`production` と `develop` の両方の目録に記録があるものだけを設定から除去する。
2. The 運用 CLI shall 回答の保存先（D1）の行の有無を、除去の判断に使わない。
3. The 運用 CLI shall 可視フラグが公開でも非公開でも、集計済みであれば除去の対象にする。
4. If 終了時刻を過ぎたアンケートが、いずれかの環境の目録に無い, then the 運用 CLI shall そのアンケートを除去せず、どの環境で集計が済んでいないかを示して残す。
5. If いずれかの環境の目録が読めない、または形式の検証に通らない, then the 運用 CLI shall 何も除去せず、失敗を返す。
6. The 運用 CLI shall 開始前・開催中のアンケートを除去しない。
7. When 除去の結果、設定にアンケートが残らない, the 運用 CLI shall 設定の変数そのものを削除する。
8. If 除去する対象が無い, then the 運用 CLI shall 除去が無かったことを成功として返す。
9. When 除去を行った, the 運用 CLI shall 除去した識別子と、残した識別子（理由つき）を結果に示す。残した理由が「いずれかの環境で未集計」のときは、結果に手順書の該当の項（集計されていない環境がある場合の手順）への案内を添える。

### Requirement 7: 運用者による設定からの除去（remove）

**Objective:** As a 運用者, I want 取り下げたいアンケートを明示的に設定から消せ、結果が失われるときは止められること, so that 開始前の誤登録を直せ、集計前の消去で結果を失わない

#### Acceptance Criteria

1. When `remove <識別子>` が実行され、そのアンケートが開始前である, the 運用 CLI shall そのアンケートを設定から除去する。
2. If 対象のアンケートが開催中である, then the 運用 CLI shall 結果を失うことを示して拒否し、設定を変更しない。
3. When 対象のアンケートが終了済みである, the 運用 CLI shall 両方の環境の目録に記録があるときに限り、設定から除去する。
4. If 終了済みの対象が、いずれかの環境の目録に無い, then the 運用 CLI shall 結果を失うことを示して拒否し、設定を変更しない。
5. If 対象の識別子が設定に無い, then the 運用 CLI shall 該当が無いことを示して失敗を返す。
6. The 運用 CLI shall 拒否を覆す強制の指定を持たない。
7. When 除去の結果、設定にアンケートが残らない, the 運用 CLI shall 設定の変数そのものを削除する。
8. If 終了済みの対象の環境の目録が読めない、または形式の検証に通らない, then the 運用 CLI shall 設定を変更せず、失敗を返す。

### Requirement 8: 登録と下書きの形式

**Objective:** As a 運用者, I want アンケートを質問ごとの題だけで登録できること, so that アンケート全体の題・説明を考える手間が無く、新しい設定の形式と食い違わない

#### Acceptance Criteria

1. When `add --file <パス>` が実行された, the 運用 CLI shall 下書きを設定の形式で検証し、設定に追加または更新する。
2. The 下書き shall アンケート全体の題と説明を持たず、質問ごとの題と選択肢の文言だけを持つ。
3. If 下書きがアンケート全体の題または説明を持つ, then the 運用 CLI shall 何も書き換えず、不正として失敗を返す。
4. When 新しいアンケートを登録する, the 運用 CLI shall 開始日時を登録時に補う。
5. When 既存の識別子を指定して更新する, the 運用 CLI shall 元の開始日時を保つ。
6. If 検証に通らない、または変数の容量の上限を超える, then the 運用 CLI shall 何も書き換えず、失敗を返す。
7. If 登録の結果が現在の設定と同じである, then the 運用 CLI shall 書き換えず、変更が無かったことを成功として返す。
8. The 運用 CLI shall 下書きと設定の本文を結果に出さない。
9. When 新規アンケートを登録する, the 運用 CLI shall UUID v4 の識別子を発行し、`idSchema` で検証する。月ごとの連番と、内容の一致による既存識別子の選択は行わない。
10. If 下書きに `id` が無い, then the 運用 CLI shall 新規登録として扱い、`id` がある場合は設定内にあるアンケートの更新だけを認める。
11. If 下書きの `id` の形式が不正である, then the 運用 CLI shall `error: invalid` を返し、何も変更しない。If 下書きに指定された `id` が設定に無い, then the 運用 CLI shall `error: not-found` を返し、何も変更しない。
12. When 新規登録を行う, the 運用 CLI shall 設定にあるすべてのアンケートの識別子が本番・develop 両方の目録にある場合だけ登録を認める。開始前のアンケートも対象とし、結果あり・回答 0 件のどちらも集計済みとする。設定に残る集計済みの過去のアンケートは新規登録を妨げない。
13. When `add` を実行する, the 運用 CLI shall dry-run を含め本番・develop 両方の目録を読む。目録が存在しないキーは空として扱い、取得失敗または形式不正の場合は何も変更せず失敗する。新規登録と更新を区別し、12 の制限は新規登録だけに適用する。
14. If 新規登録を未集計のアンケートが妨げる, then the 運用 CLI shall 次の固定の 1 行を返す。`error: refused: 未集計のアンケートがあります。集計を待つか、開始前なら remove、開催中なら締切を前倒しして両環境へ配備し、集計を待ってください。`
15. The 下書き shall 実在する日付 `YYYY-MM-DD` の `closesAt` だけを受け付け、運用 CLI はその日の日本時間 0 時に変換して設定へ保存する。
16. If 新規登録の締切が登録時刻より後でない、更新の締切が元の開始日時より後でない、更新によって終了済みのアンケートを再開する、またはいずれかの環境で集計済みのアンケートの締切を変える, then the 運用 CLI shall 変更を拒否する。集計済みかどうかは目録に識別子があるかだけで判断し、期間の一致は条件にしない。
17. When 開催中のアンケートを更新する, the 運用 CLI shall 下書きに書かれた締切の日付の日本時間 0 時を指定締切として使い、指定締切が現在の締切より前かつ元の開始日時より後の場合に限り変更を受け付ける。指定締切が現在の締切以後または元の開始日時以下なら拒否する。「元の開始日時より後で最も早い日本時間 0 時」は skill が提案する運用者への目安であり、CLI の受理条件ではない。その最も早い 0 時が現在の締切以後なら、`error: refused: 前倒しできません。自然な終了と集計を待ってください。` の固定の 1 行を返す。
18. When 新規識別子を発行する, the 運用 CLI shall 下書きの検証と登録可否の確認が通った後にだけ発行する。

### Requirement 9: 運用手順書

**Objective:** As a 運用者, I want 手順書が新しい体系と食い違わないこと, so that 手順どおりに操作すれば安全に運用できる

#### Acceptance Criteria

1. The `survey-run` skill shall 新しいコマンド体系（6 つのコマンド、環境の指定、再配備の起動）に沿った手順を示す。
2. The `survey-run` skill shall 聞き取りと確認表から、アンケート全体の題と説明を外し、質問ごとの題だけにする。
3. The `survey-run` skill shall 既存の運用の規則（日本語のみの入力、確認前に登録しない、下書きは一時ファイルで成功・失敗のどちらでも削除する）を保ち、`status` は表全体を報告し、それ以外は固定の 1 行だけを報告する。
4. The `survey-run` skill shall 状態確認の説明で 6 つの段階の意味と、公開・非公開の切り替えに再配備が要ることを示す。
5. The `survey-run` skill shall 開催中のアンケートを取り下げるとき、同じ識別子の `add` で締切を前倒しし、設定を本番・develop の両方へ配備し、日次集計を待ち、両環境の `status --env` で `empty`・`hidden`・`published` のいずれかを確認してから `remove` または `prune` する手順を示す。設定を更新しただけでは、配備済みの受付は止まらないことも示す。
6. The `docs/DEVELOP.md` shall main への取り込み前の除去の手順を、新しい `prune` の規則（両環境で集計済みのものだけを除去する）に合わせ、終了の翌日以降（日次の枠が 1 回以上動いた後）に除去し、Worker の日次の記録に削除の失敗が出ていないか確かめることを補助の案内として示す（除去の後に残った回答は集計側の日次の枠が削除するため、安全性の前提ではない）。
7. The `docs/DEVELOP.md` shall アンケートの設定の項で、新しいコマンド体系と結果の保管先の関係を示す。
8. The 手順書 shall 設定の変数や公開状態を、専用の CLI 以外で直接書き換えないことを示す。
9. The `survey-run` skill and `docs/DEVELOP.md` shall `prune`・`remove` が、`develop` の目録に記録が無い（`develop` で一度も集計されていない）ために残した・拒否したときの手順として、「`gh workflow run deploy.yaml --ref develop -f dry_run=false` で `develop` を再配備し、翌日の日次の枠を待つ」を示す。
10. The `survey-run` skill shall すでに集計済みのアンケートの終了日時を延ばさず、続けたいときは新しい識別子で登録することを示す。
11. The `docs/DEVELOP.md` shall この spec が直す項を、「3.x アンケート」「5.x の main への取り込み前の手順」「6.x の `SURVEY_CONFIG` の行」に限る。
12. `survey-run` skill は、状態確認の節とコマンド出力・失敗時の扱いの節の両方で、`status` は表全体を報告し、それ以外は固定の 1 行だけを報告する。
13. `survey-run` skill と `docs/DEVELOP.md` は、新規識別子が UUID として自動発行され、締切の日付が日本時間 0 時を表し、開始前のアンケートも次の登録を止めることを説明する。
14. `survey-run` skill と `docs/DEVELOP.md` は、新規登録の固定拒否文と次の手順を示す。記録が無い環境には現在の設定を配備して日次集計を待ち、目録の取得失敗は認証・接続・形式の問題を解消してから再実行する。
15. `survey-run` skill と `docs/DEVELOP.md` は、開催中の取り下げについて、締切の前倒し、両環境への配備、日次集計の待機、両環境の目録確認、`remove` または `prune` の順を案内する。
16. `survey-run` skill と `docs/DEVELOP.md` は、`status`・`publish`・`unpublish` が `--env` 必須で、`prune`・`remove` は指定なしで両環境を確認することを示す。

17. The `docs/DEVELOP.md` shall 集計が繰り返し失敗した場合の R2 復旧手順として、結果本体と目録を運用者が直接確認・修正する手順を示し、develop 用バケットが先に作成されている前提を明記する。

### Requirement 10: 保持期限と回答行への依存の廃止

**Objective:** As a 運用者, I want CLI が廃止された保持期限と回答行の確認に依存しないこと, so that 集計への置き換え後も CLI が正しく動く

#### Acceptance Criteria

1. The 運用 CLI shall 段階の判定に、回答の保持期限（終了の 1 か月後）を使わない。
2. The 運用 CLI shall 回答の保存先（D1）への問い合わせを一切行わない。
3. The 運用 CLI shall 段階の判定を、現在の時刻、設定の期間、結果の保管先の状態だけから決める。
4. The 運用 CLI shall `survey-results-aggregation` が定める統計ファイルの形式の検証と判定（`isVisible`・`resultMatchesIndexEntry`）を、読むときに使い、独自に形式や判定を定義しない。
