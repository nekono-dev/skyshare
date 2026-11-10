# Implementation Plan

- [x] 1. 移動の前に、既存の検証の件数を記録する
- [x] 1.1 変更の前に `npm run test:all` が通ることを確かめ、件数を記録する
  - `npm run test:all` が終了コード 0 で通過し、件数（unit・component・route・render・e2e）が Implementation Notes に書かれている
  - 記録した件数は、以降の段階で下回らないための基準になる
  - _Requirements: 4.2_

- [x] 2. 判断の `.ts` を `rules/` へ移す
- [x] 2.1 判断 4 件を `rules/` に移し、すべての参照（配線・部品・外部・テスト）の import を新しいパスに書き換える
  - 判断 4 件（区切り・提出の組み立て・共有先の振り分け・候補の計算）が、履歴を残す移動で `rules/` に置かれている
  - 配線・フック・部品・外部（`SuggestPopover`・`VideoPicker`）・テスト 4 ファイルの import が、新しいパスを指している（旧パスが残っていない）
  - `npm run test:type` が通過し、判断の単体テストの期待値は変わっていない
  - _Boundary: rules_
  - _Depends: 1.1_
  - _Requirements: 1.3, 4.1_

- [x] 3. フックを `hooks/` へ移す
- [x] 3.1 フック 6 件を `hooks/` に移し、すべての参照の import を新しいパスに書き換える
  - フック 6 件（下書き・予約の状態・予約の編集・送信・候補・キー操作）が、履歴を残す移動で `hooks/` に置かれている
  - 配線・部品の子フォルダ（`ComposerDialogs`）・部品（`ThreadSegmentForm`）・外部（`SuggestPopover`）の import が、新しいパスを指している
  - 移動したフックの内部の判断の import（`../rules/…`）が、新しい位置の判断を指している
  - `npm run test:type` が通過する
  - _Boundary: hooks_
  - _Depends: 2.1_
  - _Requirements: 1.2, 1.4, 4.1_

- [x] 4. 構造の検査と規約を、新しい配置に合わせる
- [x] 4.1 (P) 構造の検査の対象パスを `rules/`・`hooks/` に更新し、直下にフック・判断が残っていないことを検査に加える
  - 構造の検査の判断のファイル（4 件）と、フックを含むファイルのパスが、新しい位置を指している
  - 直下の `.ts` が配線（`index.tsx`）だけであることを確かめる検査が、通過する
  - 直下にフックまたは判断を置いた場合に違反として報告される負例が、検査に含まれる
  - 検査（`tests/unit/scripts/composerSplit.test.ts`）が通過する
  - _Boundary: 構造の検査_
  - _Depends: 3.1_
  - _Requirements: 1.1, 3.3_

- [x] 4.2 (P) steering の部品の規約に、子フォルダ（`hooks/`・`rules/`）の規則と例を加える
  - 部品の判断が多いときは `rules/` に、フックは `hooks/` にまとめてよい、という規則が `structure.md` に書かれている
  - 規約の例（`ThreadComposer/segments.ts`）が、`ThreadComposer/rules/segments.ts` を指している
  - 子フォルダの名前が小文字であることが、規則に明記されている（部品フォルダの PascalCase と区別する）
  - 規則の変更が、この spec の変更と同じ変更として記録されている
  - _Boundary: steering_
  - _Depends: 3.1_
  - _Requirements: 3.1, 3.2_

- [x] 5. 全体の検証で、移動の前と同じ件数が全件通過することを確かめる
- [x] 5.1 旧パスが残っていないことと、検査（imports）が違反 0 件で通過することを確かめる
  - 旧パス（`ThreadComposer/useX`・`ThreadComposer/segments` など）を指す import が、ソース・テストに残っていない
  - `npm run test:imports` が違反 0 件で通過し、許容リストの項目が増えていない（70 件のまま）
  - _Depends: 4.1, 4.2_
  - _Requirements: 4.3_

- [x] 5.2 `npm run test:all` が終了コード 0 で通過し、件数が 1.1 の基準以上であることを確かめる
  - 既存のテストファイルの期待値が変わっていない（差分は import パスと検査の対象パスだけ）
  - e2e の投稿フロー（`thread-posting`・`schedule`）が、移動の前と同じ結果で通過する
  - _Depends: 5.1_
  - _Requirements: 2.1, 2.2, 4.1, 4.2, 4.4_

## Implementation Notes

- 基準（1.1, 2026-11-01, 変更の前）: `npm run test:all` 終了コード 0。unit 257（39 ファイル）・component 13（5）・route 200（21）・render 2・e2e 7。type・lexicon・imports も通過。
- 実施の結果（5.2）: `npm run test:all` 終了コード 0。unit 261（基準 257 から、構造の検査の 4 件を追加）・component 13・route 200・render 2・e2e 7。imports 違反 0・許容 70。
- 2.1 と 3.1 は、同じ配線（`index.tsx`）の import を変えるため、直列に行う（`(P)` を付けない）。
- 4.1 と 4.2 は、対象のファイルが異なるため並行にできる（`(P)`）。

### feature 検証（kiro-validate-impl, 2026-11-10）

- 判定は `GO`。全試験（`npm run test:all`）は終了コード 0（unit 700 件通過・2 件スキップ、component 13、route 212、render 2、e2e 10）。タスクは全て `[x]`、`_Blocked:_` は無い。受入基準は全てタスクの `_Requirements` から参照されている（突き合わせで未参照 0 件）。TODO・秘密情報の検出に該当は無い。判断の項目（タスク間の結線・設計との一致・境界）は Codex（`codex_exec`、読み取り専用）の独立した検証を入力にし、指摘は Claude が実物で確かめて採否を決めた。
- 指摘と処置: 重大な指摘は無い。
