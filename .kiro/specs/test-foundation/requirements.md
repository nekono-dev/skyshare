# Requirements Document

## Project Description (Input)

src/ の現行実装から、テストを作り直すための基盤を整備する。検証層（unit・route（workerd、@cloudflare/vitest-plugin）・component（happy-dom＋@testing-library/react）・render・e2e（Playwright、偽の Bluesky）・live）、tests/ の配置、P0 の分岐カバレッジ 80%、CI（PR）は E2E のみ、push 前は全層（E2E 含む）を .githooks/pre-push で強制（SessionStart で core.hooksPath を設定）。steering/testing.md が方針の正本。spike（route 層の workerd 実行）は成立を確認済み。

## Introduction

本 spec は、利用者（開発者とエージェント）がこのリポジトリのテストを一貫した方針で作り直し、実行できるようにするための**テストの基盤**を定める。対象は、テストの検証層、配置、受入基準との対応、カバレッジの基準、実行の入口、push と CI のゲートである。個々の機能のテストケースは、各機能の spec が定める。

## Boundary Context

- **In scope**: 検証層の定義と実行環境、テストの配置、P0・P1・P2 の優先度の適用、P0 の分岐カバレッジ基準、テストの独立性と再現性の要件、実行の入口、push 前の全層の実行の強制、CI（PR）の必須ゲート、E2E の 6 本の流れの範囲、E2E で Bluesky を偽に置き換える方式、workerd の互換日付の扱い。
- **Out of scope**: 個々の機能のテストケース（各機能 spec）、実 Bluesky に対する live 層（別 spec）、`scripts/`・`_legacy/`・外部サービスの内部のテスト、既存の古い設定やコメントの整理（別の spec）。
- **Adjacent expectations**: 各機能 spec は、本 spec の検証層の定義と優先度に従って自分の受入基準の検証層を選ぶ。本 spec は各機能の受入基準を書き換えない。本番の設定（`wrangler.template.jsonc`・`.github/workflows/e2e.yaml`）の変更は、本 spec の要件を満たす範囲で行う。

## Requirements

### Requirement 1: 検証層と実行環境

**Objective:** 開発者として、振る舞いの種類ごとに決まった検証層と実行環境を使いたい。そうすれば、どの振る舞いをどこで検証するかを判断できる。

#### Acceptance Criteria

1. The test foundation shall 検証層として unit・route・component・render・e2e の五層を定義する。live 層も定義するが、その仕様は別 spec で定める。
2. When 機能の受入基準が純粋な規則を扱うとき, the test foundation shall その基準を unit 層に割り当てる。
3. When 機能の受入基準が API ルートのリクエスト、応答、ステータスコード、Cookie、D1 や R2 への副作用を扱うとき, the test foundation shall その基準を route 層に割り当てる。
4. When 機能の受入基準が対話する React 部品の表示状態やキー操作を扱うとき, the test foundation shall その基準を component 層に割り当てる。
5. When 機能の受入基準が `.astro` ページのサーバー描画の属性を扱うとき, the test foundation shall その基準を render 層に割り当てる。
6. When 機能の受入基準が画面・API・保存を横断する利用者の流れを扱うとき, the test foundation shall その基準を e2e 層に割り当てる。
7. The test foundation shall route 層の API ルートを、D1 と R2 の binding を備えた Workers 実行環境（workerd）で実行し、unit 層と component 層を Node.js で実行する。

### Requirement 2: 優先度と対象範囲

**Objective:** 開発者として、振る舞いの重要度に応じた優先度を持ちたい。そうすれば、限られた検証の労力を失敗時の影響が大きい振る舞いに集中できる。

#### Acceptance Criteria

1. The test foundation shall 次の振る舞いを P0 に分類する: セッション処理（Cookie・トークン更新・書き戻し）、予約投稿の実行（冪等性・失敗の分類・後片付け・暗号化）、アンケートの匿名性（鍵付きハッシュ・保持期限）、投稿の原子的な作成（全件成功か全件失敗か・上限）、Entry の削除の範囲、フィードバック送信（本文の無害化・間隔制限）、OAuth セッションによる旧投稿削除の拒否、表示言語の判定、共有の文字数と URL の規則。
2. The test foundation shall タイムラインのスレッド化、投稿フォームの状態遷移、設定の保存を P1 に分類する。
3. The test foundation shall 静的ページの描画を P2 に分類する。
4. The test foundation shall `scripts/`、`_legacy/`、外部サービスの内部をテスト対象から除外する。
5. If 振る舞いが P0・P1・P2 のいずれにも分類されないとき, the test foundation shall その振る舞いのテストを書く前に、機能の spec で優先度を定めることを求める。

### Requirement 3: 受入基準とテストの対応

**Objective:** 開発者として、各受入基準がどのテストで検証されるかを追えるようにしたい。そうすれば、仕様のうち未検証の箇所が分かる。

#### Acceptance Criteria

1. When 機能の spec が P0 の受入基準を定めるとき, the test foundation shall その基準を検証する少なくとも 1 件のテストを求める。
2. The test foundation shall すべてのテストが機能の受入基準に対応することを求めない。
3. The test foundation shall テストの題名を英語で書くことを求める。
4. The test foundation shall テストの題名に、受入基準の識別子（要件番号・AC/FR/NFR のタグ）を含めないことを求める。受入基準とテストの対応は、design の追跡表で示す。

### Requirement 4: カバレッジの基準

**Objective:** 開発者として、重要な部分の分岐の網羅と、失敗の検証に下限を設けたい。そうすれば、全体の率を追うために不要なテストを増やさずに済み、失敗時の振る舞いの取りこぼしを防げる。

#### Acceptance Criteria

1. The test foundation shall P0 の振る舞いを実装するモジュールに、分岐カバレッジ 80% 以上を求める。
2. The test foundation shall `src/` 全体に対するカバレッジの目標を設定しない。
3. The test foundation shall P1 と P2 のモジュールにカバレッジの要件を設定しない。
4. The test foundation shall P0 の振る舞いを実装するモジュールの失敗の発生点（`throw`、エラー応答、失敗コード）のすべてに、その失敗の種類を検証するテストを求める。
5. The test foundation shall P0 の振る舞いを実装するモジュールの失敗の発生点の一覧を、機能の spec に記録することを求める。
6. The test foundation shall P0 の振る舞いを実装する unit 層のモジュールに変異テストを行い、生き残った変異体の一覧を報告することを求める。変異テストの結果には数値の下限を置かず、ゲートにしない。

### Requirement 5: テストの独立性と再現性

**Objective:** 開発者として、どのテストも毎回同じ結果になるようにしたい。そうすれば、失敗の原因を環境の差と区別できる。

#### Acceptance Criteria

1. The test foundation shall 既定のテストコマンドを、外部ネットワークへの接続なしで実行する。
2. When テストが現在時刻または乱数に依存するとき, the test foundation shall その値をテストから注入することを求める。
3. The test foundation shall テストとフィクスチャに、実際の認証情報、本番の鍵、実アカウントの識別子を含めないことを求める。
4. Where テストが D1 または R2 の binding を使うとき, the test foundation shall 本番と同じスキーマで、他のテストのレコードを含まない状態からテストを始めることを求める。
5. The test foundation shall 各テストが他のテストの実行順序に依存しないことを求める。

### Requirement 6: テストの配置

**Objective:** 開発者として、テストの場所から対象のソースと検証層が分かるようにしたい。そうすれば、対応するテストを探しやすい。

#### Acceptance Criteria

1. The test foundation shall すべてのテストを `tests/` ディレクトリ配下に置く。
2. Where テストが `src/` 配下のモジュールを対象とするとき, the test foundation shall そのテストを、モジュールのパスを映した層のディレクトリに置く。
3. The test foundation shall 共有のフェイクを support ディレクトリに、固定のデータと鍵を fixtures ディレクトリに置く。

### Requirement 7: 実行の入口

**Objective:** 開発者として、層ごとと全体の実行方法を一つずつ決めておきたい。そうすれば、誰でも同じ手順で同じ検証ができる。

#### Acceptance Criteria

1. The test foundation shall E2E を含む全層を実行するコマンドを一つと、層ごとのコマンドを提供する。
2. When 全層のコマンドを実行したとき, the test foundation shall いずれかの層が失敗した場合に全体を失敗として報告する。
3. The test foundation shall 開発者が開発サーバーを手動で起動しなくても、E2E 層をローカルの開発サーバーに対して実行するコマンドを提供する。

### Requirement 8: push 前の全層の強制

**Objective:** 開発者として、push の前に全層のテストが必ず通るようにしたい。そうすれば、壊れた状態が共有されない。

#### Acceptance Criteria

1. When 開発者がこのリポジトリの clone で npm install を実行したとき, the test foundation shall git の hooks パスをリポジトリの hooks ディレクトリに設定する。
2. When このリポジトリでコーディングエージェントのセッションが開始したとき, the test foundation shall git の hooks パスをリポジトリの hooks ディレクトリに設定する。
3. When 開発者がブランチを push したとき, the pre-push hook shall 全層のコマンド（E2E を含む）を実行する。
4. If pre-push hook の実行中にいずれかの層が失敗したとき, then the pre-push hook shall push を中止する。
5. The test foundation shall 人間の開発者とコーディングエージェントの両方で、pre-push hook が同じように動くことを求める。

### Requirement 9: CI の必須ゲート

**Objective:** 開発者として、PR の必須ゲートを E2E に限定したい。そうすれば、CI の時間を抑えつつ、ローカルでは全層を検証できる。

#### Acceptance Criteria

1. When プルリクエストが作成または更新されたとき, the continuous integration shall マージの前に E2E 層の成功を必須にする。
2. The continuous integration shall unit・route・component・render 層の成否を必須にしない。
3. The continuous integration shall live 層を実行しない。

### Requirement 10: E2E の流れと Bluesky の偽装

**Objective:** 開発者として、E2E で利用者の主要な流れを、実際の Bluesky に接続せずに確認したい。そうすれば、画面・API・保存の結線を安定して確かめられる。

#### Acceptance Criteria

1. The e2e layer shall 六つの利用者の流れを扱う: ログイン、スレッド投稿、Entry の作成と閲覧、予約投稿の作成と一覧、アンケートへの回答、フィードバックの送信。
2. The e2e layer shall 予約投稿を実行しない。予約の実行は route 層で検証する。
3. While E2E テストが実行中であるとき, the test foundation shall ブラウザ由来とサーバー由来の両方の Bluesky 向けの通信を、テスト用の偽のサービスへ向け、実際の Bluesky には接続しない。
4. The e2e layer shall 実アカウントを使用しない。
5. If テストの流れが、偽の Bluesky サービスが提供しない応答を必要とするとき, then the test foundation shall そのテストを失敗させ、実サービスへのフォールバックをしない。

### Requirement 11: workerd の互換日付

**Objective:** 開発者として、route 層を実行できる最新の互換日付で動かしたい。そうすれば、テストの実行が止まらない。本番との差は明示しておきたい。

#### Acceptance Criteria

1. The route layer shall テスト用に同梱された workerd が対応する最新の互換日付を使用する。
2. The test foundation shall route 層の互換日付と本番の互換日付の差を文書に記録する。
3. If route 層の互換日付が本番の互換日付と異なるとき, then the test foundation shall route 層の実行時にその差を報告する。

### Requirement 12: Bluesky サービスの接続先の設定

**Objective:** 開発者として、Bluesky のサービスへの接続先を設定で差し替えたい。そうすれば、E2E でサーバー由来の通信も偽のサービスへ向けられる。本番の挙動は変えたくない。

#### Acceptance Criteria

1. The system shall Bluesky のサービスの基底 URL（認可サーバー、PLC ディレクトリ、AppView、および DID から解決する PDS の接続先）を、設定で差し替え可能にする。
2. When 接続先が設定で指定されているとき, the system shall その接続先へ Bluesky 向けのすべての通信を送り、既定の接続先へ送らない。
3. Where 接続先が設定で指定されていないとき, the system shall 本番と同じ既定の接続先を使う。
4. The system shall 接続先の設定の有無以外で、利用者に見える画面と API の振る舞いを変えない。
5. The test foundation shall E2E の実行時に、偽の Bluesky サービスの接続先を設定して dev サーバーを起動する。
