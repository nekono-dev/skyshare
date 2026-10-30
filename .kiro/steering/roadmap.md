# Roadmap

## Overview

ログインした利用者の動向を、今後のアップデートの判断材料として把握するため、期間を限った匿名の選択式アンケートを実施できるようにする。質問・選択肢・期間はソフトウェアに組み込まず、運営者が GitHub のリポジトリ変数として登録し、ビルド時に配信用の静的ファイルになる。回答は D1 に保存し、運営者が集計する。施行（聞き取り・翻訳・登録・期限切れの変数の削除）は定型のワークフローにする。

## Approach Decision

- **Chosen**: 設定を変数から静的ファイルへ生成して配信し、回答は D1 の 2 テーブル（回答済みの集合と匿名の回答）に分けて保存する。重複の判定は did のハッシュ、端末側の判定は localStorage で行い、D1 の読み書きを最小にする。
- **Why**: 回答と did を結びつけずに「複数のアカウントで 1 票」を実現でき、通常の利用では D1 に一切アクセスしない。質問をコードに持たないため、フォークの環境に影響しない。
- **Rejected alternatives**:
  - 開発者の PDS への保存: リポジトリが公開され、複製を消せない。認証の維持も無料枠の CPU に重い。
  - Upstash Redis への移行: 無料枠は同等で、新しいベンダー・秘密情報・フォークの導入負荷が増える。TTL の利点は日次の削除（数十行）で代替できる。
  - アンケートごとの DB の作成と削除: バインディングの動的な生成が要り、保守が増える。D1 の `DELETE` のコストはほぼ 0。

## Scope

- **In**: 設定の定義と配信、回答の保存と重複の防止、質問の画面（回答しないは未完了）、施行ワークフロー、プライバシーポリシーの追記。
- **Out**: 自由記述の質問、回答の取り消し・訂正、集計用の画面や API（集計は運営者が SQL で行う）、ゲスト（did なし）への表示。

## Constraints

- `dev/survey` 全体の完了・検証後は、変更を 1 コミットに圧縮して `dev/codex-cc-sdd` へマージする。統合先の Codex・Claude 両方の cc-sdd 導入 hook と設定を維持し、最終的な `develop` への統合時にも整合を確認する（2026-10-28 の利用者指示）。
- 無料枠で運用する（Workers の CPU 10ms、D1 の読み書き）。`@atproto/*` を静的に読み込まない。
- 設定は再デプロイで反映する。公開の静的ファイルのため、秘密情報を含めない。
- 対応言語（現状 ja・en）のすべての文言を必須にし、アンケート機能の画面文言も既存の i18n に乗せる。
- 回答は終了の 1 か月後に、回答済みの集合は終了時に削除する。

## Boundary Strategy

- **Why this split**: 設定の形式（survey-definition）、回答の保存（survey-api）、画面（survey-form・choice-question）、運営の手順（survey-operation）は、変更の理由と担当が別である。設定の形式を上流に置き、残りがそれを読むだけの関係にする。
- **Shared seams to watch**: 設定のスキーマ（4 つの spec が読む）、保持期限の算出（survey-definition が定義し、survey-api が削除に使う）、「回答しない」の扱い（survey-form が送らず、survey-api も拒否する）。

## Existing Spec Updates

- [x] privacy-policy -- 収集する情報・利用目的・保持期間に、匿名のアンケート回答を追記する。回答の取り消しができないこと、did は回答と結びつかないハッシュで重複の判定にだけ使うこと、端末（localStorage）に回答済みの旗とアカウントの識別子を保持することを明記する。Dependencies: survey-api

## Direct Implementation Candidates

- [x] D1 の名前の汎用化（`skyshare-schedule` → `skyshare`） -- 設定値の置き換えと運用操作だけで、仕様の境界を増やさない。`site-config` の記載は同じ変更で更新済み。

## Specs (dependency order)

- [x] choice-question -- 単一選択と複数選択を切り替えられる、選択式の質問の共通 UI 部品。Dependencies: none
- [x] survey-definition -- アンケートの設定の形式・検証・期間と保持期限の判定・多言語の文言・変数からの静的ファイルの生成と CI への組み込み。Dependencies: none
- [x] survey-api -- 回答の保存（D1 の 2 テーブル）・重複の防止・日次の削除。Dependencies: survey-definition
- [x] survey-form -- 起動時の判定・回答必須のダイアログ・端末側の回答済みの記録。Dependencies: survey-definition, survey-api, choice-question
- [x] survey-operation -- 施行ワークフロー（聞き取り・翻訳・登録・期限切れの変数の削除）。Dependencies: survey-definition, survey-api
