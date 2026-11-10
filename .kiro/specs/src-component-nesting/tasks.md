# Implementation Plan

> 注: 本 spec の変更は、2026-11-03 にワーキングツリーで実装済み（未コミット）。以下のタスクは、実装の検証と完了の確認として扱う。各タスクの完了の条件（Done）を確かめてから、チェックボックスを `[x]` にする。コミットは、ユーザーが指示したときだけ行う。

- [x] 1. 規則を steering に定める
  - [x] 1.1 `structure.md` に、入れ子の規則・common の基盤・分類の規則・領域の一覧を記載する
    - Done: 利用元の内側に置く規則、基盤の定義、役割の分類、領域の一覧が `structure.md` にあり、領域の一覧が `src/components/` の直下の領域と一致する
    - _Boundary: 説明（B1）_
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 8.1, 8.2_

- [x] 2. 移動の計画と書き換えの規則を用意する
  - [x] 2.1 移動の対応表を作る（入れ子 37 件、分類 21 件）
    - Done: 対応表の各組で、移動元が存在し、移動先が存在しない。移動先の親は、子より先に作られる順に並んでいる
    - _Boundary: 入れ子（B2）、分類（B3）_
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 移動に伴う import の指定子を、src-import-style の規則で書き換える
    - Done: 書き換えた指定子が、領域をまたぐか 3 段以上の `../` の場合は `@/` で、同じ領域の 2 段以内の場合は相対で書かれている
    - _Boundary: 書き換え（B5）_
    - _Requirements: 7.5_

- [x] 3. 利用元がすべて親の中にある部品を、親の子フォルダへ移す
  - [x] 3.1 対応表の 37 件を、移動先の親の子フォルダへ移す（`git mv`）
    - Done: 37 件の部品フォルダが移動先にあり、移動元にない。移動先で `composer/ThreadComposer/` の子が 19 件になる
    - _Boundary: 入れ子（B2）_
    - _Depends: 2.1, 2.2_
    - _Requirements: 2.1, 2.2, 3.2, 3.3, 3.4_
  - [x] 3.2 移動した部品のファイル（`index.tsx`・`index.module.css`・判断のファイル）を、移動先にそろえる
    - Done: 各移動先で、部品フォルダのファイルの集合が移動元と一致する
    - _Boundary: 入れ子（B2）_
    - _Requirements: 2.4, 2.5_

- [x] 4. common の部品を、役割の分類フォルダに分ける
  - [x] 4.1 common の 21 件を、役割の分類フォルダへ移す（`dialog`・`select`・`input`・`list`・`media`・`section`）
    - Done: 分類ごとに部品がそろい、根には `Loading` と `InlineIcon` だけがある。分類フォルダに部品のファイルが直接ない。分類をまたぐ依存があっても、循環 import が 0 件である
    - _Boundary: 分類（B3）_
    - _Depends: 2.1, 2.2_
    - _Requirements: 2.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 5. 部品の統合・削除・型の移動を行う
  - [x] 5.1 `Spinner` を `Loading` に統合し、`Spinner` のフォルダを削除する
    - Done: `common/Spinner` がない。`Loading` が同じ寸法と色のスピナーを、自身の CSS で描く
    - _Boundary: 統合（B4）_
    - _Requirements: 5.1, 5.2_
  - [x] 5.2 `settings/SettingsDialog` を削除する
    - Done: `SettingsDialog` のフォルダがなく、設定画面は `Settings` を直接使う（e2e の設定の手順で確かめる）
    - _Boundary: 削除（B4）_
    - _Requirements: 5.3, 5.4_
  - [x] 5.3 `SuggestCandidate` の型を `rules/suggestCandidate.ts` に移し、`SuggestPopover` が hooks を import しないようにする
    - Done: `rules/suggestCandidate.ts` が型を定義し、`hooks/useSuggest.ts` は型を定義せず、`SuggestPopover` は `rules/` から型を import する
    - _Boundary: 型の移動（B4）_
    - _Depends: 3.1_
    - _Requirements: 5.5, 5.6_

- [x] 6. 変更した領域の README を、現在の配置に直す
  - [x] 6.1 `src/components/README.md`・`common`・`entry`・`image`・`settings` の README を直す
    - Done: README に、削除した `SettingsDialog`・統合した `Spinner`・移動前の部品の場所・旧い分類名（`overlay`・`form`・`display`）がない
    - _Boundary: 説明（B1）_
    - _Depends: 4.1, 5.1, 5.2_
    - _Requirements: 8.3, 8.4_

- [x] 7. 変更を検証する
  - [x] 7.1 型検査と import 検査を実行する
    - Done: `npm run test:type` が成功する。`npm run test:imports` が違反 0 件・循環 0 件を報告する。Prettier の検査で、変更したファイルが整形済みである
    - _Boundary: 検証（B6）_
    - _Depends: 3.2, 4.1, 5.3_
    - _Requirements: 7.1, 7.2, 7.5_
  - [x] 7.2 単体・コンポーネント・ルート・描画のテストを実行する
    - Done: `npm run test:unit`・`test:component`・`test:route`・`test:render` が成功する。`componentLayout`（例外の一覧の一致）と `steeringRegions`（領域の一覧）が含まれる
    - _Boundary: 検証（B6）_
    - _Depends: 7.1_
    - _Requirements: 6.2, 7.3, 7.4_
  - [x] 7.3 e2e の 7 件を実行する
    - Done: `npm run test:e2e` の 7 件が成功する（投稿・画像つき Entry・ログイン・予約・アンケート・フィードバック・設定）
    - _Boundary: 検証（B6）_
    - _Depends: 7.2_
    - _Requirements: 6.1_
  - [x] 7.4 生成物に差分が出ないことを確かめる
    - Done: `npm run apigen` の後、`src/client/openapi/` と OpenAPI の内容に、変更による差分がない
    - _Boundary: 検証（B6）_
    - _Depends: 7.3_
    - _Requirements: 6.3, 6.4_

## Implementation Notes

- 本 spec の変更は、2026-11-03 の作業で、ワーキングツリーにすでに実装されている（`git mv` によるステージ済みの移動と、未ステージの編集）。タスクは、その状態の検証と記録である。
- 検証の順序は、型 → import → 単体 → コンポーネント → ルート → 描画 → e2e → 生成物。
- 2026-11-03 検証（レビューは inline。親のコンテキストで各 Done を確認）: 移動 58 件（入れ子 37・分類 21）は、HEAD の直下のファイルと一致。`test:all` が exit 0（単体 302・コンポーネント 13・ルート 212・描画 2・e2e 7）。import 違反 0 件・循環 0 件。OpenAPI は `.cache/openapi-before.json` と一致し、`src/client` に差分なし。変更したファイルは Prettier を通過。
- 未実施: コミット（ユーザーの指示があるまで行わない）。`.kiro/specs/src-lib-ui-boundary/research.md` の変更は、本 spec の範囲外（作業前からの変更）。

### feature 検証（kiro-validate-impl, 2026-11-10）

- 判定は `GO`。全試験（`npm run test:all`）は終了コード 0（unit 700 件通過・2 件スキップ、component 13、route 212、render 2、e2e 10）。タスクは全て `[x]`、`_Blocked:_` は無い。受入基準は全てタスクの `_Requirements` から参照されている（突き合わせで未参照 0 件）。TODO・秘密情報の検出に該当は無い。判断の項目（タスク間の結線・設計との一致・境界）は Codex（`codex_exec`、読み取り専用）の独立した検証を入力にし、指摘は Claude が実物で確かめて採否を決めた。
- 指摘と処置: 重大な指摘は無い。
