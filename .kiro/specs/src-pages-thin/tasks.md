# Implementation Plan

- [x] 1. 移動の前に特性化テストを用意し、基準値を記録する
- [x] 1.1 (P) 予約の作成と一覧の応答を現行の値で固定する
  - 予約の作成で、ヘッダ・認証・件数の上限・認証情報の未登録の各失敗の状態コードと応答が、テストで固定されている
  - 予約の一覧で、不正なクエリと未認証の失敗、および成功時の応答の形が、テストで固定されている
  - 現行コードで、このテストが全件通過する
  - _Boundary: ScheduleCollection_
  - _Requirements: 2.2, 4.2_

- [x] 1.2 (P) 予約 1 件の取得・置き換え・取り消しの応答を現行の値で固定する
  - 他人の予約と存在しない予約が 404、実行中の予約が 409（ScheduleRunning）で返ることが、テストで固定されている
  - 取得の応答から facets が除かれていることが、テストで固定されている
  - 置き換えと取り消しの成功時の応答の形が、テストで固定されている
  - 現行コードで、このテストが全件通過する
  - _Boundary: ScheduleItem_
  - _Requirements: 2.2, 2.4_

- [x] 1.3 (P) 予約の画像と認証情報の応答を現行の値で固定する
  - 画像の取得で、範囲外の番号が 404、実行中の予約が 409 で返り、成功時の content-type と no-store が固定されている
  - 認証情報の状態の取得で、登録の有無ごとの応答と、ヒント Cookie の値が固定されている
  - 認証情報の無効化で、実行中の予約がある場合の 409 と、成功時の削除件数の応答が固定されている
  - 現行コードで、このテストが全件通過する
  - _Boundary: ScheduleImage, ScheduleCredential_
  - _Requirements: 2.2, 2.3_

- [x] 1.4 (P) エントリ API の失敗系の応答を現行の値で固定する
  - 作成・更新・削除の各操作で、不正なヘッダと未認証の失敗の状態コードが、テストで固定されている
  - 作成で、返信の所有が他人の場合の 400 と、更新・削除で対象がない場合の 404 が、テストで固定されている
  - 現行コードで、このテストが全件通過する（成功系は既存の e2e が守る）
  - _Boundary: EntryPost, EntryEdit, EntryDelete_
  - _Requirements: 1.2_

- [x] 1.5 現行の基準値を記録する
  - 変更の前に `npm run test:all` が全件通過し、件数（type・unit・component・route・render・e2e）が記録されている
  - 記録した件数は tasks.md の Implementation Notes に書かれている
  - _Depends: 1.1, 1.2, 1.3, 1.4_
  - _Requirements: 5.2_

- [x] 2. 判断の結果の共通の型を置く
- [x] 2.1 判断の結果（成功と HTTP の失敗）の型を util に置く
  - 成功と失敗の union（失敗は状態コードとコードを持つ）が、`util` の 1 ファイルで定義されている
  - 型は import を持たず、既存の lib の領域から参照できる
  - `npm run test:type` が通過する
  - _Depends: 1.5_
  - _Boundary: Outcome_
  - _Requirements: 4.2_

- [x] 3. フィードバックの送信の判定を lib へ移す
- [x] 3.1 送信の判定（設定の確認・回数の制限・Issue の登録）を lib の関数にする
  - 設定が無い場合 503、回数の制限を超えた場合 429、登録の失敗の場合 500 が、関数の戻り値として返る
  - 外部トークンの値は、戻り値にもエラーの内容にも含まれない
  - 既存の route テスト（フィードバック 7 件）が、変更なしで全件通過する
  - _Depends: 2.1_
  - _Boundary: SubmitFeedback_
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3.2 フィードバックの入口から、バインディングと判定を取り除く
  - 入口は、ヘッダ・認証・本文の検証のあとに送信の関数を呼び、戻り値を応答に変換するだけになる
  - 入口は、バインディングの取得と外部トークンを直接読まない
  - 既存の route テスト（フィードバック 7 件）が、import パスの変更なしで全件通過する
  - _Depends: 3.1_
  - _Boundary: SubmitFeedback_
  - _Requirements: 3.1, 4.1, 4.2, 5.3_

- [x] 4. 予約の API を lib へ移す
- [x] 4.1 (P) 予約の画像の取得を lib の関数にする
  - 予約の画像の取得の判断（所有・状態・番号）が、戻り値として返る
  - 画像の入口は、判断の結果を応答に変換するだけになり、バインディングを読まない
  - 1.3 の特性化テスト（画像）が、全件通過する
  - _Depends: 1.5, 2.1_
  - _Boundary: ScheduleImage_
  - _Requirements: 2.1, 2.3_

- [x] 4.2 (P) 認証情報の状態と無効化を lib の関数にする
  - 認証情報の状態の応答（本体とヒント Cookie の値）が、関数の戻り値として返る
  - 無効化の判断（実行中の確認・予約の削除・画像の後始末・トークンの取り消し・認証情報の削除）が、関数の中で現行の順序で行われる
  - 認証情報の入口は、バインディングを読まず、Cookie の設定だけを行う
  - 1.3 の特性化テスト（認証情報）が、全件通過する
  - _Depends: 1.5, 2.1_
  - _Boundary: ScheduleCredential_
  - _Requirements: 2.1, 2.2_

- [x] 4.3 (P) 予約の作成と一覧を lib の関数にする
  - 予約の作成の判断（入力・実行時刻・認証情報・件数・画像の保管・保存の失敗時の後始末）が、戻り値として返る
  - 一覧の応答（件数・プレビュー・最後のエラー）が、関数の戻り値として返る
  - 予約の作成と一覧の入口は、バインディングを読まず、保存の関数を直接呼ばない
  - 1.1 の特性化テストが、全件通過する
  - 応答の DTO が api の推論型に代入できることを、型検査で確かめている（ページの型注釈付きの代入で確かめる。Implementation Notes の 4.3 の決定と同じ）
  - _Depends: 1.5, 2.1_
  - _Boundary: ScheduleCollection_
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 4.4 予約 1 件の取得・置き換え・取り消しを lib の関数にする
  - 取得の判断（状態・facets の除去・保管データの読み取りの失敗）が、戻り値として返る
  - 置き換えの判断（所有・状態・画像の保管・置き換えの競合・置き換え前の画像の後始末）が、現行の順序で行われる
  - 取り消しの判断（所有・実行中の確認・削除・画像の後始末）が、現行の順序で行われる
  - 画像の後始末の失敗は、予約の操作の結果を変えない
  - 1.2 の特性化テストが、全件通過する
  - _Depends: 4.3_
  - _Boundary: ScheduleItem_
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 5. エントリの API を lib へ移す
- [x] 5.1 エントリの応答の整形を lib に移す
  - 作成したエントリの応答の形（DTO）が、lib の関数から返る
  - 応答の DTO が、api の推論型に代入できることを、型検査で確かめている（ページの型注釈付きの代入で確かめる。Implementation Notes の 4.3 の決定と同じ）
  - 応答の形は、移動の前と同じである
  - _Depends: 1.5, 2.1_
  - _Boundary: EntryResponse_
  - _Requirements: 1.1_

- [x] 5.2 エントリの削除の判断を lib に移す
  - 削除の対象の解決・順序・Bluesky 投稿の削除の判断が、lib の関数の戻り値として返る
  - 削除の入口は、判断の結果を応答に変換するだけになる
  - 1.4 の特性化テスト（削除）が、全件通過する
  - _Depends: 5.1_
  - _Boundary: EntryDelete_
  - _Requirements: 1.2_

- [x] 5.3 エントリの更新の判断を lib に移す
  - 見出しと本文の更新の判断が、lib の関数の戻り値として返る
  - 更新の入口は、判断の結果を応答に変換するだけになる
  - 1.4 の特性化テスト（更新）が、全件通過する
  - _Depends: 5.2_
  - _Boundary: EntryEdit_
  - _Requirements: 1.1, 1.2_

- [x] 5.4 エントリの作成で、埋め込み・アップロード・createEntry の検証を lib に移す
  - createEntry の検証（visual の必須）、埋め込みの優先順（動画・画像・OGP）、画像と動画のアップロードが、lib の関数の戻り値として返る
  - 検証の失敗は、現行と同じ状態コードの失敗として返る
  - 既存の e2e（entry 1 本）が、全件通過する
  - _Depends: 5.3_
  - _Boundary: EntryMedia_
  - _Requirements: 1.1_

- [x] 5.5 エントリの作成の残りの判断を lib に移し、入口を薄くする
  - from-post の分岐・返信の所有の検証・createBskyThread の呼び出し・応答の組み立てが、lib の関数の戻り値として返る
  - 入口の作成は、フォームの解析・スキーマの検証・認証・結果の応答だけを行う（Entry の整形と判断を含まない）
  - 入口の作成は、移動の前と同じ応答の形と状態コードを返す（1.4 の特性化テストと既存の e2e が通過する）
  - 応答の DTO が api の推論型に代入できることを、型検査で確かめている（ページの型注釈付きの代入で確かめる。Implementation Notes の 4.3 の決定と同じ）
  - _Depends: 5.4_
  - _Boundary: EntryPost_
  - _Requirements: 1.1, 1.2_

- [x] 6. 入口の形を検査し、許容リストを更新して全体を確かめる
- [x] 6.1 対象の API の入口の形を静的に検査するテストを追加する
  - 対象の 6 ファイルで、バインディングの参照（`env.` で始まる参照）がないことを、テストが確かめる
  - 対象の 6 ファイルが、バインディングの取得の関数・保存の関数・画像の保存の関数・`cloudflare:workers` を import しないことを、テストが確かめる
  - 現行のリポジトリで、このテストが全件通過する
  - _Depends: 3.2, 4.4, 5.5_
  - _Requirements: 4.1_

- [x] 6.2 許容リストを更新し、規則の検査を通す
  - `npm run test:imports` が、違反 0 件で通過する
  - 許容リストから、エントリの入口の `.js` の項目が消えている
  - 残る `pages/v2` の項目は、所有の spec（`src-import-style`）のまま残っている
  - _Depends: 6.1_
  - _Requirements: 5.4_

- [x] 6.3 全体の検証で、移動の前と同じ件数が全件通過することを確かめる
  - `npm run test:all` が終了コード 0 で通過する
  - 件数が 1.5 の基準以上である（特性化テストを足した分だけ増える）
  - 利用者に見える画面と API の振る舞い（応答の形・状態コード・Cookie）が、特性化テストと既存テストで変わっていないことが確かめられている
  - _Depends: 6.2_
  - _Requirements: 5.1, 5.2, 5.3_

## Implementation Notes

- 1.5 の基準値（変更の前・2026-11-01・`npm run test:all` 終了コード 0）: type 成功、lexicon 成功、imports 違反 0・許容 78・stale 0、unit 183、component 6、route 197（特性化テストの追加後）、render 2、e2e 7。
- 承認済みの文書修正（機能の検証の指摘・利用者の承認）: design.md の (a) replaceSchedule の失敗に 429（型の上のみ）・500 と 409 の code を追記、(b) editEntry は失敗を返さず例外を投げると明記、(d) EntryPost の resolveXrpcStatus は外側の catch で変換と改める、(e) Impact の lib のファイル数を 11 に合わせる、(f) File Structure Plan に submitFeedback.test.ts と import-allowlist.json、scheduleCleanup.test.ts を追加。実装は変更していない。
- 要件 2.4（画像の後始末の失敗は結果を変えない）は、機能の検証で証拠が無いと指摘されたため、`tests/route/pages/scheduleCleanup.test.ts` で特性化テストを追加した（PUT・DELETE の後始末の失敗、POST の保存失敗時の後始末）。
- 4.3 の応答の代入の検査は、設計の「Validation Hooks」（design の Components Schedule 節）どおり、ページの型注釈付きの代入（`const res: ... = ...`）で行う。`typeCompat.ts`（`lib/api`）に置くと `lib/api ↔ lib/schedule` の閉路になり、`lib/schedule` の `lib/api` 参照も Allowed Dependencies を超えるため、どちらも採らない。design の「`typeCompat.ts` に置く」の記述は、利用者の承認を得て、この決定に合わせて改訂済み（design の line 136 と、4.3・5.5 の本文）。
- `Outcome<T>` は `util` に置く（design の File Structure Plan に追記済み）。`lib/api` は参照しない。
