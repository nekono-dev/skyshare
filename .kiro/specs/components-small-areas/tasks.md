# Implementation Plan

structure.md の編集順: 本仕様の 2.1〜2.3 は、lib-layers 5.3・util-placement 6.1・structure-checks 5.1 の後に行う（いずれも `structure.md` を編集するため）。structure-checks 7.1 は本仕様の後である。

- [ ] 1. 前提と実測の確認
- [x] 1.1 util-placement の完了後に、四つの領域の利用元を取り直す
  - util-placement の成果（`util/` から部品フォルダへ移った import）が反映された状態で、`share`・`feedback`・`privacy`・`help` の利用元を検索する
  - 取り直した利用元と `research.md` の記録を比べ、差分があれば判断への影響を記録する
  - 完了の条件: 利用元の一覧が `research.md` の記録と一致する、または差分が判断を変えないことが記録されている
  - _Requirements: 1.2, 1.3, 1.4_

- [ ] 2. 判断の記録
- [x] 2.1 `structure.md` に領域の判断の記録の節を追加する
  - 四つの領域（`share`・`feedback`・`privacy`・`help`）について、判断（残す）・利用元・理由を表にする
  - 統合の条件（利用元がすべて一つの親の部品フォルダの内側にあること）を規則として書き、利用元が `pages/` や複数の親にまたがる場合は残すと書く
  - 利用元が判断の時点から変わった場合に再検討する条件を書く
  - 完了の条件: `structure.md` の判断の表が `design.md` の判断の結果の表と一致し、`common/` へ移さない理由が書かれている
  - _Depends: lib-layers 5.3, util-placement 6.1, structure-checks 5.1_
  - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 6.3_
- [ ] 2.2 `components/i18n` の残す理由を件数に依存しない形で維持する
  - 翻訳の入口であり、多数の部品から import されることを理由として書く
  - 固定の件数を根拠に書かない
  - 完了の条件: `structure.md` の `components/i18n` の記述が移動しない理由を含み、件数を根拠にしていない
  - _Requirements: 4.1, 4.3_
- [ ] 2.3 領域の一覧と判断の記録の整合を確かめる
  - 領域の一覧（`components/<領域>` の形）は変えず、判断の記録と矛盾しないことを確かめる
  - 完了の条件: 領域の一覧に変更がなく、`steeringRegions` の検査が通る
  - _Requirements: 3.2, 3.3_

- [ ] 3. 配置の不変の確認
- [ ] 3.1 部品を移動せず、import パスと部品フォルダの規約が変わっていないことを確かめる
  - 本仕様の変更は `structure.md` の記録に限られ、四つの領域と `components/i18n` の部品は移動しない
  - `components/i18n` の import パス、部品フォルダの `index.tsx`・`index.module.css` の配置は変わらない
  - 移動が必要になった場合は、移動先に合わせてその部品を import するファイルとテストの import パスを同じ変更で更新し、判断を見直してから進める
  - 完了の条件: 変更ファイルが `structure.md` のみである（移動が発生した場合は、import とテストの更新が同じ変更に含まれる）
  - _Requirements: 4.2, 5.1, 5.2, 5.3, 5.5, 6.1, 6.2_

- [ ] 4. 検証
- [ ] 4.1 `npm run test:all` を実行し、終了コードと件数を確かめる
  - 着手時の `npm run test:all` の件数を記録し、完了時の件数がそれを下回らないことを確かめる
  - `npm run test:imports`・`componentLayout`・`steeringRegions` の各検査が通ることを確かめる
  - 完了の条件: `npm run test:all` が終了コード 0 で完了し、件数が着手時以上である
  - _Requirements: 3.2, 5.4_
