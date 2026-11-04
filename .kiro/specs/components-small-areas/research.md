# Research & Design Decisions

---

**Purpose**: `components/share`・`feedback`・`privacy`・`help` の部品の利用元を実測し、統合するか残すかの判断を記録する。
---

## Summary

- **Feature**: `components-small-areas`
- **Discovery Scope**: Extension（既存の `src/components/` の配置に対する軽量な探査）
- **Key Findings**:
  - 四つの領域の部品は、すべて利用元が一つの親の部品フォルダにまとまっていない。統合先を作れるものはない。
  - `feedback`・`privacy`・`help` の利用元は `src/pages/*.astro`（部品フォルダの外）であり、`structure.md` の規則により領域の直下に残すのが正しい。
  - `share`（`IntentShareDialog`）の利用元は `composer/ThreadComposer` と `timeline/Timeline` の二つの親にまたがるため、統合しない（`structure.md` の規則と brief の制約に従う）。
  - `components/i18n` は移動しない（brief と roadmap の決定）。
  - 既存の検査（`componentLayout.test.ts`・`steeringRegions.test.ts`・`importRules.test.ts`）は、現状の配置を通す。判断を「残す」にしても検査の変更は不要。

## Research Log

### 利用元の実測（2026-11-03、`src/`・`tests/`・`scripts/`・`e2e/` を `components/<領域>/` の文字列で検索）

- **Context**: brief の「統合するか残すかを利用元の実測で決める」の根拠を得る。
- **Sources Consulted**: `grep -rn` による import の検索（`@/components/share/`・`@/components/feedback/`・`@/components/privacy/`・`@/components/help/`）。
- **Findings**:
  - `components/share/IntentShareDialog`（1 件）の利用元:
    - `composer/ThreadComposer/index.tsx`
    - `composer/ThreadComposer/ComposerDialogs/index.tsx`
    - `composer/ThreadComposer/hooks/useThreadSubmit.ts`（型のみ）
    - `timeline/Timeline/PostLauncher/index.tsx`
    - `timeline/Timeline/ThreadCard/PostCard/index.tsx`
  - `components/feedback/FeedbackForm`（2 件）の利用元: `src/pages/feedback.astro` のみ。
  - `components/privacy/PolicyCards`（2 件）の利用元: `src/pages/privacy.astro` のみ。
  - `components/help/Help`（4 件: `index.tsx`・`helpEntries.tsx`・`HelpItem/index.tsx`・`index.module.css`）の利用元: `src/pages/help.astro`（外）と、`Help/HelpItem/index.tsx`（内。`Help/helpEntries` を型のみ import）。`Help/index.tsx` が `HelpItem` を import する。
  - `components/i18n`（2 件）の利用元: 多数の部品から import される。2026-11-03 の観測では、`@/components/i18n/` または相対で `i18n/useTranslation`・`i18n/renderSlots` を import する行が 72 行、ファイルが 65 ファイル（`src`・`tests`）。この数は観測の参考であり、判断の根拠にしない（数え方で変わるため）。判断には件数を使わず、「多数の部品から import される入口」であることだけを根拠にする。
- **Implications**: 統合先となる親の部品フォルダは、`share` では一意に定まらず、`feedback`・`privacy`・`help` では存在しない（利用元が `pages/`）。よって四つとも「残す」になる。

### util-placement 完了後の利用元の取り直し（2026-11-04、task 1.1）

- **Context**: util-placement の完了後（コミット `12b25d9` 時点）に、四つの領域の利用元を検索し直し、上の実測（2026-11-03）と比べる。
- **Sources Consulted**: `grep -rn` と `grep -rln` を `src/`・`tests/`・`scripts/`・`config/` に対して実行した（検索式と件数は次のとおり）。`e2e/` はリポジトリに存在しないため検索していない（`ls -d e2e` で該当なし）。
- **Findings**:
  - `components/share/` を参照する import は、値の import と型の import を合わせて 6 ファイル（上の実測では 5 ファイル）。差分は次の二点である。
    - `timeline/Timeline/ThreadCard/PostCard/useWebShareCrosspost.ts` が `components/share/IntentShareDialog/webShare` を値として import している（上の実測には無かった。実測の検索が `IntentShareDialog` の本体の import を対象にし、サブパスの import を拾わなかったため）。
    - `composer/ThreadComposer/hooks/useThreadSubmit.ts` は「型のみ」と記録したが、実際には `IntentShareDialog/openIntentPopup`（`openIntentPopup`・`preOpenPopupWindow`）と `IntentShareDialog/webShare`（`canShareWithWebApi`・`shareWithWebApi`）を値として import している。型の import は `IntentShareDialog` の本体の 1 件だけである。
  - 利用元の親は二つのまま（`composer/ThreadComposer/` と `timeline/Timeline/`）。`pages/` からの利用は増えていない。`share` の利用元が単一の親にまとまった事実はない。
  - `components/feedback/FeedbackForm`・`components/privacy/PolicyCards`・`components/help/Help` の利用元は、上の実測と同じである（`pages/feedback.astro`・`pages/privacy.astro`・`pages/help.astro` のみ。`help` の内部は `Help/index.tsx`・`Help/HelpItem/index.tsx`・`Help/helpEntries` の組み合わせで変わらない）。
  - `composer/ThreadComposer/rules/shareDispatch.ts`・`pages/jump.astro`・`lib/share/intent.ts`・`lib/share/webShareData.ts` の該当行（`grep -rln "components/share"` の 10 ファイルのうち 4 ファイル）は、いずれも import ではなくコメント（`components/share/...` のパスの言及）である。利用元の数には含めない。
  - `privacy` の部品が参照する文面は、util-placement の統合により `lib/privacy` から `lib/site/policySections`へ移った。部品の配置には影響しない。
  - `lib/share` を含む行のあるファイルは `src/`・`tests/` を合わせて 23 ファイル（`grep -rln "lib/share" src tests` の件数。`components/share`・`composer`・`timeline`・`settings`・`common/select`・`lib/settings`・テストを含む）。`lib/feedback` を含む行のあるファイルは 11 ファイル（`grep -rln "lib/feedback" src tests` の件数。`components/feedback/FeedbackForm`・`pages/v2/feedback.ts`・テストを含む）。これらの件数は参考であり、判断の根拠にしない。`lib` 側は残す判断の対象外である。
  - 検索コマンドと件数（`2026-11-04` 時点）:
    - `grep -rln "components/share" src tests scripts config` → 10 ファイル（コメントを含む）。値・型の import に限ると `grep -rln 'from "@/components/share/' src tests scripts config` → 6 ファイル。
    - `grep -rln "components/feedback" src tests scripts config` → 1 ファイル（`src/pages/feedback.astro`）。
    - `grep -rln "components/privacy" src tests scripts config` → 1 ファイル（`src/pages/privacy.astro`）。
    - `grep -rln "components/help" src tests scripts config` → 3 ファイル（`src/pages/help.astro`・`Help/index.tsx`・`Help/HelpItem/index.tsx`）。
    - 相対 import（`../share/`・`./feedback/` など）による参照は 0 件。
- **Implications**: 利用元の差分（`useWebShareCrosspost.ts` の追加と `useThreadSubmit.ts` の値 import）は、利用元の親が二つのまま変わらないため、判断「残す」を変えない。統合の候補の検討（下の節）の結論も変わらない。`composer` と `timeline` の両方が `share` を使う事実は、再検討の条件（利用元が一方の親だけになること）に該当しない。

### 統合の候補の検討

- **Context**: 「統合する」の候補がないかを確かめる。
- **Alternatives**:
  1. `share` を `composer/ThreadComposer/` の子にする → `timeline` からの利用が `components/composer` の外になるため、規則（利用元がすべて H の内側）に反する。
  2. `share` を `timeline/Timeline/` の子にする → 同じ理由で `composer` からの利用が外になるため不可。
  3. `share` を `components/common/dialog/` へ移す → 業務（外部 SNS への共有）の部品であり、`common/` は汎用の部品だけを置くため不可（`structure.md`）。
  4. `feedback`・`privacy`・`help` を `src/pages/` の下へ移す → `pages/` は薄い入口だけを持つ規約（`pagesThin` の検査が対象とする）に反するため不可。
  5. 三つの領域（`feedback`・`privacy`・`help`）を一つの「静的な案内」領域にまとめる → 領域どうしの利用元と意味が異なり、規則にない新しい領域を作ることになる。`structure.md` の領域一覧の改訂も要る。利用者に見える振る舞いは変わらないが、判断の基準（利用元の内側）を満たさないため不可。
- **Implications**: 統合の候補はいずれも既存の規則に反する。残す判断を採る。

## Architecture Pattern Evaluation

| Option           | Description                                                              | Strengths                                    | Risks / Limitations                     | Notes              |
| ---------------- | ------------------------------------------------------------------------ | -------------------------------------------- | --------------------------------------- | ------------------ |
| 残す（採用）     | 四つの領域の部品を現在の位置に据え置き、理由を `structure.md` に記録する | 移動なし、振る舞い・import・テストに影響なし | 領域の数が減らない                      | 規則どおり         |
| 親の子へ統合     | 利用元の内側へ移す                                                       | 領域が減る                                   | 利用元が単一の親にない                  | 本件では成立しない |
| `common/` へ移す | 汎用の部品として扱う                                                     | 領域が減る                                   | 業務の部品を `common/` に置くことになる | 規約違反           |
| `pages/` へ移す  | 入口に置く                                                               | 利用元と近い                                 | `pages/` は薄く保つ規約に反する         | 却下               |

## Design Decisions

### Decision: 四つの小さい部品領域はすべて現在の位置に残す

- **Context**: Requirements 1〜3。統合の条件（利用元がすべて一つの親の部品フォルダの内側にある）を四つの領域に当てはめる。
- **Alternatives Considered**:
  1. 統合できるものだけを統合する → 統合先が一つもないため、移動が空になる。
  2. 規則を緩め、複数の親にまたがる部品を `common/` へ移す → `common/` の規約を変えることになり、Out of Scope。
- **Selected Approach**: 判断の表（領域・利用元・判断・理由）を `structure.md` に追記する。部品は移動しない。
- **Rationale**: 規則を変えずに判断でき、振る舞い・import・テストへの影響がない。
- **Trade-offs**: 小さい領域の数は残る。ただし各領域が残る理由は記録され、再検討の条件（利用元の変化）も明示される。
- **Follow-up**: 利用元が一つの親にまとまった場合（例: 将来 `share` の利用元が一方だけになる）は、判断を見直す（Requirement 1.4）。

### Decision: `components/i18n` は移動せず、件数に依存しない根拠を記録する

- **Context**: Requirement 4。brief と roadmap で移動しないと決まっている。
- **Selected Approach**: `structure.md` の既存の記述（翻訳の入口）を維持する。件数は「多数」と書き、固定の件数を根拠にしない。
- **Rationale**: 件数の数え方（行数かファイル数か）で判断が揺れないようにする。

## Risks & Mitigations

- 判断の記録が `structure.md` の規約として読まれ、将来の部品の配置の規則と混ざる → 判断の表を「領域の判断の記録」として独立した節にし、規則の節とは分ける。
- 利用元の実測が判断後に変わる（新しい import が追加される） → Requirement 1.4 の再検討の条件を記録する。`structure-checks`（Downstream）でも領域の配置を検査できる。
- `util-placement` の完了前に実測すると、`util/` から移る import の行が変わる → Adjacent expectation として、`util-placement` の完了後に実測を取り直す（tasks で前提確認を入れる）。

## Implementation Notes

### 配置の不変の確認（task 3.1、2026-11-04）

部品を移動していないことを、既存の検査と git の記録で確かめた。新しいテストは追加していない（既存の検査で足りる部分を重ねないため）。

| 要件 | 確認の内容 | 確かめた手段と結果 |
| ---- | ---------- | ------------------ |
| 4.2・5.1 | `components/i18n` の import パスが変わらない | `componentLayout.test.ts` の例外の一覧（`i18n/useTranslation.ts`・`i18n/renderSlots.tsx`）が実在することの検査が通過。`npm run test:type`（`tsc --noEmit`）が終了コード 0 で、`@/components/i18n/...` の import がすべて解決する（`src/`・`tests/`・`scripts/` で 72 行） |
| 5.2・5.3 | 部品の移動が無いため、import とテストの同時更新は発生しない | `git diff --name-status 091eed4^ HEAD -- src config scripts` が空（この仕様の作業の範囲は 2.1 以降） |
| 5.5 | 部品フォルダの規約（1 部品 1 フォルダ・`index.tsx`/`index.astro` と `index.module.css` の配置）が変わらない | `git ls-tree` で `src/components` の `index.tsx`/`index.astro` が 93 件、`index.module.css` が 77 件で、着手時（`091eed4^`）と完了時（`HEAD`）が一致。規約の静的な検査は既存になく、件数は記録として残す（`index.module.css` を持たない部品フォルダは 16 件で、着手時から変わらない） |
| 6.1 | `components/common/` の分類を変えない | `git diff --name-status 091eed4^ HEAD -- src/components/common` が空 |
| 完了の条件 | 変更ファイルが `structure.md` のみ | `git diff --name-status 091eed4^ HEAD` の結果は 3 件: `.kiro/specs/components-small-areas/tasks.md`（進捗）・`.kiro/steering/structure.md`（2.1 の記録）・`tests/unit/scripts/structureDecisions.test.ts`（2.3 の検査）。`src/` と `config/`・`scripts/` は含まない |

既存の検査の通過:

- `npm run test:unit`: 51 ファイル・356 件が通過（基準の 356 件と一致。増減なし）
- `npm run test:imports`: 終了コード 0（違反 0 件・許容 0 件・stale 0 件）
- `npm run test:type`: 終了コード 0

## References

- `.kiro/steering/structure.md` — 部品フォルダの規則（利用元の内側に置く・`common/` の基盤）
- `.kiro/specs/components-small-areas/brief.md` — 本仕様の決定と制約
- `.kiro/specs/util-placement/design.md` — `util/` から部品フォルダへ移る import（`IntentShareDialog` の `util/share/intent` を含む）
- `tests/unit/scripts/componentLayout.test.ts` — 部品フォルダの外のファイルの例外の検査
- `tests/unit/scripts/steeringRegions.test.ts` — `structure.md` の領域一覧と実装の一致の検査
