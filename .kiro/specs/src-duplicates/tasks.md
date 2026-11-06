# Implementation Plan

- [x] 1. 変更の前に、移すものの振る舞いを特性化テストで固定する
- [x] 1.1 (P) X の文字数の換算（投稿の表示・タイッツー・共有の予約の文字数）を、現行の値で固定する
  - 日本語・英語・URL を含む本文と、空の本文の換算の値が、テストで固定されている
  - 計量が例外になる入力でも、換算の値が固定されている
  - 現行のコードで、このテストが全件通過する
  - _Boundary: X の計量_
  - _Requirements: 1.1, 1.2_

- [x] 1.2 (P) JSON 応答の 4 つの形（状態・本文・ヘッダー）を、現行の値で固定する
  - `scheduleResponse` 由来の `jsonResponse`（`no-store`・`set-cookie` の配列）と、`errorResponseFromStatus`（`no-store`）の、ヘッダーと本文が単体テストで固定されている
  - 入口の投稿の応答（`json200`）に、`content-type` と `cache-control` が無いことを、既存の route テストに 1 件追加して固定する
  - 認証の完了の応答（`respond`）の route テストを新規に追加し、状態・本文（ありとなし）・`cache-control: no-store`・`set-cookie` を固定する（現行に route テストが無いため）
  - 現行のコードで、このテストが全件通過する
  - _Boundary: JSON 応答_
  - _Requirements: 2.1, 2.3_

- [x] 1.3 (P) 2 桁のゼロ埋めと、旧共有設定の既定値（移行の対象外）を、現行の値で固定する
  - `0`・`5`・`59` の 2 桁表示と、動画の長さの表示の既存の期待値が、テストで固定されている
  - 旧キーのみを持つ保存値は、現行の移行の結果（移行された値）を示し、新しいキーの値は変わらないことが、テストで固定されている（削除の後は既定値になる。これは 6.1 で確かめる）
  - 現行のコードで、このテストが全件通過する
  - _Boundary: ゼロ埋め, 旧共有設定_
  - _Requirements: 3.2, 4.2, 4.3_

- [x] 1.4 (P) 環境の値（バージョンと本番のドメイン）の現行の値を固定する
  - バージョンの表示（未設定の場合を含む）と、ドメインを使う URL の組み立てが、テストで固定されている
  - 現行のコードで、このテストが全件通過する
  - _Boundary: 環境の読み取り_
  - _Requirements: 5.2_

- [x] 1.5 現行の基準値を記録する
  - 変更の前に `npm run test:all` が全件通過し、件数（type・lexicon・imports・unit・component・route・render・e2e）が記録されている
  - 記録した件数は tasks.md の Implementation Notes に書かれている
  - _Depends: 1.1, 1.2, 1.3, 1.4_
  - _Requirements: 6.2_

- [x] 2. X の文字数の計量を 1 箇所にまとめる
- [x] 2.1 「計量を 2 で割って切り上げる」規則を 1 つの関数にし、3 箇所の呼び出しを移す
  - 共通の関数が、計量の関数を受けて、2 で割って切り上げた値を返す
  - 投稿の文字数（X）・タイッツー・共有の予約の文字数が、移す前と同じ値を示す（1.1 の特性化テストが通過する）
  - 「2 で割って切り上げる」の式が、共通の関数の 1 箇所だけにある
  - `npm run test:type` が通過する
  - _Boundary: X の計量_
  - _Depends: 1.5_
  - _Requirements: 1.1, 1.2, 1.3, 6.1_

- [x] 3. 2 桁のゼロ埋めを 1 つの関数にまとめる
- [x] 3.1 2 桁のゼロ埋めの関数を追加し、3 箇所の呼び出しを移す
  - 時刻の入力の表示と、動画の長さの表示（秒と分）が、移す前と同じ文字列を示す（1.3 の特性化テストが通過する）
  - 2 桁のゼロ埋めの式が、新しい関数の 1 箇所だけにある
  - `npm run test:type` が通過する
  - _Boundary: ゼロ埋め_
  - _Depends: 2.1_
  - _Requirements: 3.1, 3.2, 6.1_

- [x] 4. JSON 応答の組み立てを 1 関数にまとめる
- [x] 4.1 JSON 応答の関数を、ヘッダーを引数で受ける形で追加し、エラー応答の組み立てを移す
  - 関数は、状態（既定 200）・本文（なしも可）・ヘッダー（呼び出し側の指定が優先）を受けて、応答を返す
  - エラー応答の状態と本文と、`no-store` のヘッダーが、移す前と同じ（1.2 の特性化テストが通過する）
  - _Boundary: JSON 応答_
  - _Depends: 3.1_
  - _Requirements: 2.2, 2.3, 6.1_

- [x] 4.2 既存の 3 つの組み立て（スケジュール、入口の投稿、認証の完了）を、新しい関数に移す
  - 各エンドポイントの状態・本文・ヘッダー（`no-store`・`set-cookie`・`Content-Type`）が、移す前と同じ（1.2 の特性化テストと route テストが通過する）
  - 旧来の組み立ての関数（スケジュールの応答・入口の `json200`・認証の `respond`）が、どこからも使われていない
  - _Boundary: JSON 応答_
  - _Depends: 4.1_
  - _Requirements: 2.1, 2.2, 6.1_

- [x] 5. 環境の読み取りを `src/vars.ts` の 1 箇所にする
- [x] 5.1 バージョンとドメインを `src/vars.ts` で読み、他の箇所はそこから得る
  - バージョンの表示と、ドメインを使う URL の組み立てが、移す前と同じ値を示す（1.4 の特性化テストが通過する）
  - 同じ変数を読む `import.meta.env` の直接の参照が、`src/vars.ts` の 1 箇所だけにある
  - `lib` が `src/vars.ts` を import しても、循環が生じない
  - _Boundary: 環境の読み取り_
  - _Depends: 4.2_
  - _Requirements: 5.1, 5.2, 6.1_

- [x] 6. 旧共有設定の移行モジュールを削除する
- [x] 6.1 旧共有設定の移行モジュールとそのテストを削除し、呼び出しと注釈を消す
  - 移行モジュールとテストが、リポジトリから消えている
  - 設定の読み取りは、移行の呼び出しなしで、新しいキーの値を変えず、旧キーのみの保存値は既定値を示す（1.3 の新しいキーの部分が通過し、旧キーの部分は意図した変化として既定値を示す）
  - 移行の言及（注釈）が、設定のモジュールに残っていない
  - _Boundary: 旧共有設定_
  - _Depends: 5.1_
  - _Requirements: 4.1, 4.2, 4.3, 6.1_

- [x] 7. 検査と全体の検証
- [x] 7.1 (P) 規則の所在を grep で確かめる
  - 2 で割る式、`new Response(JSON.stringify(` の直接の組み立て、2 桁の `padStart`、`import.meta.env.PUBLIC_VERSION`・`import.meta.env.SITE` の参照が、それぞれ定義の 1 箇所だけにある
  - _Boundary: 規則の検査_
  - _Depends: 6.1_
  - _Requirements: 1.3, 2.2, 3.1, 5.1_

- [x] 7.2 `npm run test:imports` が違反 0 件で通過し、許容リストの項目が増えていない
  - 循環・層の規則に違反がなく、許容は 70 件のまま
  - _Depends: 6.1_
  - _Requirements: 6.1_

- [x] 7.3 `npm run test:all` が終了コード 0 で通過し、件数が 1.5 の基準以上である（unit は利用者の承認により 297 に改めた基準以上）
  - 既存のテストの期待値は変わっていない（差分は import パス・統合後の関数名・削除したモジュールのテストだけ）
  - e2e 7 件（thread-posting・schedule を含む）が、移す前と同じ結果で通過する
  - _Depends: 7.1, 7.2_
  - _Requirements: 6.1, 6.2, 6.3_

## Implementation Notes

- 1.1〜1.4 は、移すものの現行の値を固定する。移行の後も、同じテストの期待値を使う。
- 基準（1.5, 2026-11-01, 変更の前）: `npm run test:all` 終了コード 0。unit 309（47 ファイル）・component 13（5）・route 207（22）・render 2・e2e 7。type・lexicon・imports も通過。
- 実施の結果（7.3）: `npm run test:all` 終了コード 0。unit 297（基準 309 から 12 減）・component 13・route 211（基準 207 から 4 増）・render 2・e2e 7。unit の 12 件は、6.1 で削除した旧共有設定の移行のテスト（`it.each` 8 行と `it` 4 件）であり、削除の意図どおり。7.3 の「件数が基準以上」は、unit だけ文言どおりには満たさない。利用者の決定により、unit の基準を 297 に改めて完了とした。
- 設計との差（実装で確かめた事実）: `respond` は `pages/v2/bsky/session/authorization/completion.ts` の関数（`schedules/.../completion.ts` には無い）。`jsonResponse` は `util/http.ts` の 1 関数で、本文 `undefined` で本文なし。設計に無かった直接の組み立て（feedback・bsky の session・drafts・jwks・survey の `noStoreJson`）も移した（7.1 の「1 箇所だけ」の検査に合わせるため）。survey の `noStoreJson` は削除した。
- `respond` の「本文なし」は、route からは到達できない（`respond` の呼び出しは常に本文を持つ）。その経路は固定していない。
- 1.2 の route: `respond` に当たる関数は `pages/v2/bsky/session/authorization/completion.ts`。route テストは `tests/route/pages/bskySessionCompletion.test.ts`（新規）。予約の認可の完了（`schedules/.../completion.ts`）は `tests/route/pages/scheduleCompletion.test.ts`（新規）。`json200` は `entryApi.test.ts` の成功経路 1 件で固定した。
- 2.1・3.1・4.1・4.2・5.1 は、同じ呼び出し元（応答と設定の読み取り）に触れるため、直列に行う（`(P)` を付けない）。
- 7.1 は、移行の後の検査であり、他の検査と対象が異なるため並行にできる（`(P)`）。
