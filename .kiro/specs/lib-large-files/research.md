# Research & Design Decisions

## Summary

- **Feature**: `lib-large-files`
- **Discovery Scope**: Extension（既存の 7 ファイルの分割。振る舞いは変えない。ライト探査）
- **Key Findings**:
  - 7 件のうち 6 件は、単一の責務の中に「純粋な判断」と「外部（DOM・localStorage・D1・Cookie・Canvas）への入出力」が混在している。または、独立した複数の節（予約・認証情報・認可の状態など）が一つのファイルにある。
  - `lib/timeline/guest/posts.ts` の `buildGuestPosts` 単体で約 445 行あり、データだけの分割では 400 行以下にならない。データを投稿の種類ごとに二つに分ける必要がある。
  - 外向きの import パスを保つには、原ファイルを同名フォルダに置き換えて `index.ts` で再エクスポートする方式が、全 7 件で一貫して使える。
  - 2 件のテストに、分割の影響を受けるパス（`vi.mock("@/lib/session/cookies.js")` の `.js` 付きパスと `vi.mock("@/lib/schedule/store")`）がある。`cookies.js` のパスは、フォルダ化により解決されなくなるため、テストの import 更新の対象になる。
  - `util/textarea/contentEditableModel.ts` は `util-placement` により `components/composer/ThreadComposer/rules/contentEditableModel.ts` へ移る。`shareSettings.ts` の `@/util/share/intent` も `util-placement` により `@/lib/share/intent` へ変わる。本仕様は、その移動後のパスを前提にする。

## Research Log

### 既存の分割の方式（`src-composer-split`）

- **Context**: 本仕様の要件 2・3 が参考にする分割の方式を確かめる。
- **Sources Consulted**: `.kiro/steering/structure.md`（import 規約）。brief が参照する `src-composer-split` は、本探査では読んでいない（分割の方式は本仕様の design で独立に決める）。
- **Findings**: `structure.md` は「同じ部品フォルダの内部だけ相対 import（`./`）」「領域をまたぐ import は `@/`」「`../` は 3 段未満」を定める。`test:imports` は `crossRegionRelative`・`relativeDepth` でこれを検査する。
- **Implications**: 新しいフォルダの内部（兄弟ファイル）は `./`、フォルダの外（同じ領域の別ファイルを含む）は `@/` で書く。

### 原ファイルの置き換え方式の比較

- **Context**: 外向きの import を変えずに分割する方法を決める。
- **Alternatives Considered**:
  1. 原ファイルを残し、兄弟ファイルを追加して原ファイルから再エクスポートする（ファイルのまま）
  2. 原ファイルを削除し、同名フォルダの `index.ts` で再エクスポートする（フォルダ化）
- **Selected Approach**: 2（フォルダ化）。要件 3.3 の `index.ts` の再エクスポートに従う。
- **Rationale**: 1 は、原ファイルと同名のフォルダを将来作ると解決が曖昧になる。2 は `@/lib/x/y` の解決先が一つに決まり、分割後も「入口は `index.ts`」の規則が全件で揃う。
- **Trade-offs**: `vi.mock` の文字列が `.js` 付きのものは解決されなくなる。その 1 件（`tests/route/pages/bskySessionCompletion.test.ts`）は、同じ変更でパスを直す。
- **Follow-up**: 実装の各段階で `test:type`・`test:imports` と、対象のテストを実行し、mock が効いていることを確かめる。

### guest/posts.ts のデータの分割

- **Context**: `buildGuestPosts` が単体で約 445 行あり、データだけのファイルを 400 行以下にできない。
- **Selected Approach**: 投稿の種類で二つに分ける。単独の投稿（`guest1`〜`guest-rich-text`）と、スレッドの投稿と不明な投稿（`guest-thread-*`・`guest-unknown`）。順序は現状のまま連結する。
- **Rationale**: 配列の順序が変わると `buildGuestThreads` の参照結果は変わらないが、表示の順序が変わるおそれがあるため、連結の順序を現状に合わせる。
- **Follow-up**: 分割後に `buildGuestPosts(t)` の戻り値を、分割前の結果と比べる（テストの追加はしない。既存テストで確かめる）。

### 純粋な判断と入出力の分け方

- **Context**: 要件 2.1 の「責務の分離」の具体的な境界を、7 件それぞれで決める。
- **Findings**:
  - `session/cookies.ts`: codec（base64・Cookie の解析）・モデル（セッションの型と検証）・プールの判断（`admitSession`）・Set-Cookie の組み立てと Request の解析。
  - `survey/gate.ts`: 状態の遷移（`gateReducer`・`planGateEntry`・`resolveSubmitOutcome`）は純粋。判定・送信・端末の記録は入出力。
  - `util/textarea/contentEditableModel.ts`: 平文モデル（`TextPart`・`partsToPlainText`・`resolvePartOffset`）は純粋。DOM の走査・選択・キャレット・測定は DOM 依存。
  - `image/postImageProcessing.ts`: 切り抜きの幾何（`getSlotDefs`・`computeCropAroundCenter`）は純粋。Canvas の描画と圧縮は入出力。
  - `settings/shareSettings.ts`: 設定の種類ごとに localStorage の読み書きが並ぶ。種類（自動ポップアップ・インスタンスドメイン・チェックの設定・行数）で分ける。
  - `schedule/store.ts`: 予約の CRUD・実行の遷移・認証情報・認可の状態。D1 への問い合わせは全件が入出力のため、責務（節）で分ける。
- **Implications**: 純粋な部分と入出力を分けると、テストの対象が責務ごとに分かれる（brief の目的に合う）。

## Architecture Pattern Evaluation

| Option                            | Description                                                              | Strengths                             | Risks / Limitations                                         | Notes                                 |
| --------------------------------- | ------------------------------------------------------------------------ | ------------------------------------- | ----------------------------------------------------------- | ------------------------------------- |
| 同名フォルダ + `index.ts`（採用） | 原ファイルを削除し、フォルダ内に分割した兄弟ファイルと `index.ts` を置く | 入口が一つに決まる。全 7 件で同じ規則 | `.js` 付きの mock パスが解決されない                        | `cookies.js` のテストを同じ変更で直す |
| 原ファイルを入口に残す            | 原ファイルは再エクスポートだけにし、兄弟を同じフォルダに置く             | 原ファイルのパスが変わらない          | 原ファイル名と同名のフォルダを作れず、規則が 7 件で揃わない | 不採用                                |
| 呼び出し側を直接書き換える        | 兄弟ファイルを直接 import させる                                         | 入口が無い                            | 呼び出し側の変更が多く、要件 3.3 に反する                   | 不採用                                |

## Design Decisions

### Decision: 分割の単位は責務（節）で決め、ファイル行数は目安として確かめる

- **Context**: 要件 1.1（400 行以下）と要件 2.1（責務の分離）を同時に満たす。
- **Alternatives Considered**: 行数だけで機械的に分ける／責務だけで分ける。
- **Selected Approach**: 責務で分け、各ファイルの行数が 400 行を超えないことを確かめる。
- **Rationale**: 行数だけで分けると、関連する関数が別のファイルに離れる。
- **Trade-offs**: 分割後に一部のファイルが 300 行台になる。
- **Follow-up**: 実装の各段階で `wc -l` を確かめる。

## Risks & Mitigations

- 循環 import の発生 — 分割後のファイル間の依存を、一方向（モデル → 判断 → 入出力 → 入口）に限る。`test:imports` の `cycle` 規則で確かめる。
- テストの mock が効かなくなる — `vi.mock` の文字列を、フォルダ化後の `index.ts` の解決先に合わせる。テストの件数と結果を、分割の前後で比べる。
- 上流（`util-placement`）の移動が未完了 — 本仕様の `contentEditableModel` と `shareSettings` の分割は、移動の完了後に着手する。

## References

- `.kiro/steering/structure.md` — import 規約・依存規則・`index.ts` の扱い
- `.kiro/specs/util-placement/design.md` — 移動の対応表（`contentEditableModel.ts`・`util/share/intent.ts`）
- `.kiro/specs/lib-layers/design.md` — 領域の層（`session`・`settings`・`schedule`・`survey`・`timeline`・`image` の層）
