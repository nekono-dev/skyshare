# 調査ログ

## 概要

- **機能**: `src-folder-layout`
- **調査の範囲**: 拡張（既存のコードの構造の整理）。外部の依存は追加しない。
- **主な発見**:
  - 部品フォルダ外のソースファイルは 13 件（brief の 10 件に、`src-lib-ui-boundary` で動いた 3 件を加えた）。うち 9 件は部品の所有が 1 つに決まり移動できる。残りの 4 件（`layout/nav/` の `navItems.ts` と `sync*.ts`）は Sidebar と FooterNav が共有するため、例外とした。
  - `PaginationModeSelect` を消すと、ページングの分岐だけが使う部品（`PageSizeSelect`・`useCursorPaginationController`）と設定（`readPageSizeSetting`・`writePageSizeSetting`）と型（`PaginationMode`）も到達しなくなる。要件 3.3 にこれらを含めた。
  - `guestDummyPosts.ts` の利用者は、`Timeline`・`EntryList`（`getGuestDummyData`）と `EntryCard`・`useSkyshareEntryStatus`（`resolveGuestDeleteScope`）。`PostCard` は import しておらず、コメントで参照しているだけである。

## 調査ログ

### 部品フォルダ外のファイルの利用者

- **文脈**: 移動先を決めるため、各ファイルの import 先を調べた。
- **確認したこと**: `grep` で `src/`・`tests/`・`e2e/`・`config/` を検索した。
- **結果**:
  - `help/helpEntries.tsx` → `Help`（値）・`HelpItem`（型）。
  - `privacy/PolicyCards.tsx` → `pages/privacy.astro` のみ。
  - `share/useWebShareCrosspost.ts` → `PostCard` のみ。
  - `image/croppedImageStyle.ts` → `ImagePicker` のみ。
  - `schedule/useScheduleAvailability.ts` → `ScheduleSetting`・`AuthorizationReturn`・`ThreadComposer`。
  - `settings/useShareToggles.ts` → `Settings`・`ThreadComposer`・`ComposerOptions`（型）・`useThreadSubmit`（型）。
  - `layout/AnalyticsTag.astro` → `Metadatas`・`tests/render/components/AnalyticsTag.test.ts`。
  - `layout/Metadatas.astro` → `src/layout/Baselayout.astro`。
  - `layout/nav/NavIcon.astro` → `Sidebar`・`FooterNav`。
  - `layout/nav/navItems.ts`・`sync*.ts` → `Sidebar`・`FooterNav`（両方）。
- **示唆**: 1 つの部品だけが使うものは、その部品の子ファイルにする。2 つ以上が使い、どちらの子にもできないものは例外にする。

### 例外の扱い（`layout/nav/`）

- **文脈**: 要件 1.3 は、部品の子として整理すると役割がわかりにくくなる場合だけ例外を認める。
- **代替案**:
  1. `layout/nav/` を残す（例外）。
  2. `Sidebar` の子にする。`FooterNav` が兄弟の子を参照する形になる。
  3. 新しい部品（`layout/Navigation/`）を作る。描画を持たない部品は、この規則に合わない。
- **選択**: 1。理由は、役割（共有の処理）が例外として明確であり、新しい部品を作る変更を増やさないため。

### ページングの分岐の削除の範囲

- **文脈**: 要件 3.3 の「分岐と固定値」だけでは、分岐が使う部品と設定が残る。
- **確認したこと**:
  - `Timeline`・`EntryList` の `pagedController` は、`enabled: false` で常に呼ばれている（`paginationMode` が `"infinite"` のため）。
  - `pageSize` の状態は、`pagedController` と `PageSizeSelect` にだけ使われる。
  - `useCursorPaginationController` の利用者は `Timeline`・`EntryList` だけ（`ComponentList` は定義のみ）。
  - テスト・e2e・config に、これらの部品・設定の参照はない。
- **選択**: 分岐と、その分岐だけが使う部品・設定・型を削除する。`NavigationBar` は `DraftListPanel` が使うため残す。
- **Follow-up**: 削除の後に、`timelinePageSize` の保存値は読まれなくなる（利用者に見える変化はない）。

### ゲストのダミーデータの分割

- **文脈**: `guestDummyPosts.ts`（791 行）の中身は、ダミーの画像（`placeholderImage`）、パスの定数、投稿・スレッド、Entry（動画を含む）、削除範囲の表、言語ごとのキャッシュ、判断（`resolveGuestDeleteScope`）。
- **代替案**:
  1. 1 ファイルのまま判断だけ移す。データと判断の分離は一部だけになる。
  2. データを種類ごとに分け、`lib/timeline/guest/` に置く（採用）。
- **選択**: 2。分割後の `index.ts` は公開の入口（キャッシュと `getGuestDummyData`）に限る。
- **Follow-up**: 分割の後、`lib/timeline/guest/` と `lib/guestMode.ts` の依存の向きを検査（閉路の確認）。

### 構造の検査の方式

- **文脈**: 要件 1.4・5.3 は、違反と差を報告することを求める。
- **代替案**: lint のルール（ESLint の独自規則）、または単体テスト。
- **選択**: 単体テスト（`tests/unit/scripts/`）。既存の `composerSplit.test.ts` と同じ方式で、`npm run test:unit` に含まれる。理由は、新しい依存（lint の設定）を増やさないため。

## 設計の判断

### 判断: 移動先の部品（所有者）

- **文脈**: 1 つのファイルを、どの部品の子にするか。
- **選択**: 状態・責務を持つ部品（上の「移動の判断」の表）。
- **根拠**: 所有者が明確なほど、部品フォルダの中で役割が読み取れる。
- **トレードオフ**: `ThreadComposer` などの兄弟の部品から、子ファイルを import する箇所が増える。型のみ import のものは、`structure.md` の依存の規則に従う。

## リスクと対策

- 移動で import が壊れる — 各移動の後に `npm run test:imports` と `npm run test:unit` を通す。
- ゲストのデータの分割で内容が変わる — 移動の後に `git diff -M` で内容を比べ、変更がないことを確かめる。
- `libRegionPairs` の閉路の検査が、新しい領域（`account` 等）で失敗する — 失敗した場合は、`structure.md` の依存の一覧を実装に合わせて補う。

## 参考

- `.kiro/steering/structure.md` — 部品フォルダの規則、`lib` の領域の依存の向き。
- `.kiro/specs/src-composer-layout/`・`src-duplicates/` — 直前に完了した構造の整理（同じ検査の方式）。
