# プレビュー運用 要件定義書

## 1. 目的

作業ブランチの push でプレビューを配信する運用を、宣言ファイルの provider 指定で切り替えられるようにする。プレビューURLの算出、宣言と CI 設定の整合検査、workflow 雛形の生成、provider 固有の後始末を機械的に行い、リポジトリ固有の値をスキルに持たない。

## 2. スコープ

### 2.1 対象

- ブランチ名からのプレビューURLの算出。
- provider の切り替え。
- 宣言と workflow・provider 設定の整合検査。
- preview 用 workflow 雛形の生成。
- provider 固有の後始末コマンドの提示と実行。
- Cloudflare の wrangler 設定の workers.dev 関連キーの、独自ドメインの有効状況に応じた設定。

### 2.2 対象外

- workflow が本番向けかどうかの意味の判定。
- リポジトリ外の設定の検査。

## 3. 前提

- 前提: branch-guard — 宣言ファイルの読み込みと作業ブランチの判定を使う。

## 4. 機能要件

- FR-1: 作業ブランチ名の斜線をハイフンに置き換えた alias から、宣言のURL雛形に従ってプレビューURLを算出する。
- FR-2: provider の指定により、検査・雛形・後始末の挙動を切り替える。
- FR-3: 宣言の作業ブランチと保護ブランチに含まれないのに push で動く CI の指定を警告する。
- FR-4: Cloudflare の provider では、プレビューの有効化設定・wrangler のバージョン・workflow の有無を検査する。
- FR-5: provider の workflow 雛形を出力し、既存のファイルは上書きしない。
- FR-6: 後始末のコマンドは既定で表示だけを行い、実行を明示したときだけ実行する。
- FR-7: Cloudflare の provider では、有効な独自ドメインの有無に応じて、wrangler 設定の workers.dev 関連キーを設定できる。
- FR-8: Cloudflare の検査では、独自ドメインの有効状況と食い違う workers.dev 関連キーを警告する。

## 5. 非機能要件

- なし

## 6. 受け入れ条件

- AC-1 (FR-1): ブランチ dev/foo-bar とURL雛形から、斜線をハイフンにした alias を含むURLが得られる。
- AC-2 (FR-2): provider を none にした宣言では、URLが算出されず後始末も提示されない。
- AC-3 (FR-3): 宣言にない release 系ブランチを push 対象とする workflow が、警告として報告される。
- AC-4 (FR-4): 有効化設定のない wrangler 設定に対し、Cloudflare の検査が誤りを報告する。
- AC-5 (FR-5): preview 用の workflow ファイルが既にあるリポジトリで雛形の書き込みを指示すると、上書きされずに終了コード 1 で終わる。
- AC-6 (FR-6): 後始末を実行指定なしで指示すると、コマンドが表示されるだけで実行されない。
- AC-7 (FR-7): 有効な独自ドメインのある設定に書き込みを指示すると、workers.dev 関連キーが無効になる。
- AC-8 (FR-8): 有効な独自ドメインがあるのに workers.dev が有効な設定に対し、Cloudflare の検査が警告を報告する。
