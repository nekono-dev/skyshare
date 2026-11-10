# 調査と設計の判断

## Summary

- **Feature**: `comments-components-pages`
- **Discovery Scope**: Extension（既存のファイルのコメントだけを変える。新しい部品・API・データは作らない）
- **Key Findings**:
  - 許容リストの所有が `comments-components-pages` の項目は 203 件（144 ファイル）。内訳は `header-missing` 65、`header-too-long` 73、`header-too-many-bullets` 42、`forbidden:spec参照` 20、`forbidden:AC/FR/NFRタグ` 2、`forbidden:要件番号` 1。
  - 検査（`scripts/architecture/commentRules.ts`）は `.ts`・`.tsx`・`.astro`・`.mjs` だけを見る。`.css` と `*.d.ts` は見ない。範囲内の CSS（`src/styles` の 4 ファイル）に、旧 spec 参照（`specs/design-tokens`）が残っている。
  - 検査の対象外で、範囲内にある経緯の語（「以前」「かつて」「旧」「移行」「経緯」）は、検査では判定されない。grep で探し、レビューで判断する（範囲内の ts・tsx・astro で 20 件の該当行）。
  - 許容リストは 1 つの JSON ファイル（`config/comments/allowlist.json`）。グループを並列に作業すると、このファイルの編集が衝突する。作業は直列にする。

## Research Log

### 許容リストと検査の挙動

- **Context**: 作業の単位と完了の判定を決めるため。
- **Sources Consulted**: `scripts/architecture/commentRules.ts`、`tests/unit/scripts/commentRules.test.ts`、`config/comments/allowlist.json`、`.kiro/steering/comments.md`。
- **Findings**:
  - 先頭ヘッダは `/**` で始まるブロックコメントだけを認める。シェバン行・`---`・空行を飛ばした先頭でなければ `header-missing`。`//` の行コメントは認めない。
  - 内容の行数は、区切りの記号と空行を除いて数える。6 行を超えると `header-too-long`。`- ` で始まる行が 3 件を超えると `header-too-many-bullets`。
  - 禁止パターンは、行頭が `//`・`/*`・`*`・`{/*`・`<!--` の行だけに当たる。コードの行の文字列は対象外。
  - 違反は「ファイルと規則の組」で 1 件にまとめられる。許容リストの照合は `path` と `rule` の組で行う。
  - テストは、許容リストに無い違反と、既に直った項目（stale）の両方で失敗する。したがって、ファイルを直したら同じ作業の中でそのファイルの項目を消す必要がある。
- **Implications**: 作業の完了条件は、グループごとに「そのグループのパスの違反が 0 件」かつ「そのグループの項目が許容リストに残っていない」こと。

### 変更がコメントだけであることの確かめ方

- **Context**: 振る舞いを変えないという制約を、差分で確かめられるようにするため。
- **Sources Consulted**: `git diff` の出力形式。
- **Findings**: 変更行（`+` と `-` の行）が、コメントの記号（`//`・`/*`・`*`・`*/`・`{/*`・`<!--`）または空行だけであることを機械で確かめられる。ヘッダの追加も、同じ形になる。
- **Implications**: 作業の各段階で、その段階のパスに対する `git diff` を検査する。コードの行が混じっていれば失敗とする。

### 範囲の境界（CSS と `*.d.ts`）

- **Context**: brief の範囲に `src/styles` と `src/types` が含まれるが、検査は CSS と `*.d.ts` を見ない。
- **Sources Consulted**: `.kiro/steering/comments.md` の「対象」「除外」の節、brief。
- **Findings**: 基準は CSS と `*.d.ts` を対象外にしている。一方、brief は範囲に含めている。
- **Implications**: 決めた前提として、CSS と `*.d.ts` には先頭ヘッダを要求せず、禁止パターンと経緯の語だけを取り除く（grep で確かめる）。これは要件の「境界の文脈」に書いた。

### 作業の単位（グループ）

- **Context**: 作業を、レビューできる大きさに区切るため。
- **Findings**: 対象の許容リストの項目を、ディレクトリの領域で分けると、グループごとのファイル数は 7〜24 件になる。`composer/ThreadComposer` は 33 件のうち、中心部（`index.tsx`・`hooks/`・`rules/`、15 件）と、子の部品（18 件）に分けた。`composer` の子の部品は、部品フォルダの規約（`structure-components.md`）に従う。
- **Implications**: 作業はグループ G1〜G9 と、最後の全体検証 G10 に分ける。

## グループとファイル（許容リストの所有が `comments-components-pages` のもの）

グループの対応は次のとおり。`src/components/` の CSS（`.css`）は、同じディレクトリの作業に含める。

- G1: `src/components/common/**`（19 件）
- G2: `src/components/composer/ThreadComposer/` の直下（`index.tsx`）・`hooks/`・`rules/`（15 件）
- G3: `src/components/composer/` の残り（`PostGateDialog/`・`ThreadComposer/` の子部品。18 件）
- G4: `src/components/timeline/**`（18 件）
- G5: `src/components/account/**`・`entry/**`・`image/**`・`schedule/**`（17 件）
- G6: `src/components/settings/**`・`share/**`・`feedback/**`・`help/**`・`privacy/**`・`i18n/**`・`layout/**`（16 件）
- G7: `src/pages/*.astro`・`src/pages/entries/**`・`src/pages/posts/**`（9 件）
- G8: `src/pages/oauth/**`・`src/pages/v1/**`・`src/pages/v2/**`（24 件）
- G9: `src/env.ts`・`src/vars.ts`・`src/worker.ts`・`src/middleware.ts`・`src/global.d.ts`・`src/types/**`・`src/util/**`・`src/styles/**`（許容リストの 8 件 ＋ 検査の対象外の 4 件の CSS を含む）
- G10: 全体の検証（範囲の全体）

### G1（19 ファイル）

- `src/components/common/Loading/index.tsx`
- `src/components/common/dialog/ConfirmDialog/index.tsx`
- `src/components/common/dialog/FloatingBox/index.tsx`
- `src/components/common/dialog/Overlay/index.tsx`
- `src/components/common/dialog/Overlay/rules/scrollLock.ts`
- `src/components/common/input/Checkbox/index.tsx`
- `src/components/common/input/CountedTextInput/index.tsx`
- `src/components/common/input/RadioButton/index.tsx`
- `src/components/common/input/ToggleSwitch/index.tsx`
- `src/components/common/list/InfiniteScrollSentinel/index.tsx`
- `src/components/common/media/Avatar/index.tsx`
- `src/components/common/media/MediaThumb/index.tsx`
- `src/components/common/section/TabButtons/index.tsx`
- `src/components/common/select/AutoPopupTargetSelect/index.tsx`
- `src/components/common/select/ChoiceQuestion/index.tsx`
- `src/components/common/select/Dropdown/index.tsx`
- `src/components/common/select/ListboxOption/index.tsx`
- `src/components/common/select/LocaleSelect/index.tsx`
- `src/components/common/select/ThemeModeSelect/index.tsx`

### G2（15 ファイル）

- `src/components/composer/ThreadComposer/index.tsx`
- `src/components/composer/ThreadComposer/hooks/useDraftFlow.ts`
- `src/components/composer/ThreadComposer/hooks/useKeyboardRows.ts`
- `src/components/composer/ThreadComposer/hooks/useScheduleEdit.ts`
- `src/components/composer/ThreadComposer/hooks/useScheduleFlow.ts`
- `src/components/composer/ThreadComposer/hooks/useSuggest.ts`
- `src/components/composer/ThreadComposer/hooks/useThreadSubmit.ts`
- `src/components/composer/ThreadComposer/rules/contentEditableModelDom.ts`
- `src/components/composer/ThreadComposer/rules/contentEditableReconcile.ts`
- `src/components/composer/ThreadComposer/rules/facetHighlightSegments.ts`
- `src/components/composer/ThreadComposer/rules/highlightNodeParts.ts`
- `src/components/composer/ThreadComposer/rules/links.ts`
- `src/components/composer/ThreadComposer/rules/segments.ts`
- `src/components/composer/ThreadComposer/rules/shareDispatch.ts`
- `src/components/composer/ThreadComposer/rules/submitThread.ts`

### G3（18 ファイル）

- `src/components/composer/PostGateDialog/index.tsx`
- `src/components/composer/ThreadComposer/ComposerDialogs/index.tsx`
- `src/components/composer/ThreadComposer/ComposerOptions/index.tsx`
- `src/components/composer/ThreadComposer/ImageAltDialog/index.tsx`
- `src/components/composer/ThreadComposer/ImageCropDialog/CropSlot/index.tsx`
- `src/components/composer/ThreadComposer/ImageCropDialog/index.tsx`
- `src/components/composer/ThreadComposer/ImagePicker/croppedImageStyle.ts`
- `src/components/composer/ThreadComposer/ImagePicker/index.tsx`
- `src/components/composer/ThreadComposer/OgpFetchButton/index.tsx`
- `src/components/composer/ThreadComposer/RunAtPicker/index.tsx`
- `src/components/composer/ThreadComposer/ScheduleList/index.tsx`
- `src/components/composer/ThreadComposer/ThreadSegmentForm/LanguageSelect/index.tsx`
- `src/components/composer/ThreadComposer/ThreadSegmentForm/OgpPreview/index.tsx`
- `src/components/composer/ThreadComposer/ThreadSegmentForm/PostBodyEditor/index.tsx`
- `src/components/composer/ThreadComposer/ThreadSegmentForm/SuggestPopover/index.tsx`
- `src/components/composer/ThreadComposer/ThreadSegmentForm/ThumbnailAdjustButton/index.tsx`
- `src/components/composer/ThreadComposer/ThreadSegmentForm/VideoPicker/index.tsx`
- `src/components/composer/ThreadComposer/ThreadSegmentForm/index.tsx`

### G4（18 ファイル）

- `src/components/timeline/PostBody/PostEngagementStats/index.tsx`
- `src/components/timeline/PostBody/PostLinkCard/index.tsx`
- `src/components/timeline/PostBody/PostQuote/index.tsx`
- `src/components/timeline/PostBody/VideoPlayButton/index.tsx`
- `src/components/timeline/PostBody/VideoPlayer/index.tsx`
- `src/components/timeline/PostBody/VideoThumbnail/index.tsx`
- `src/components/timeline/PostBody/VideoUnavailable/index.tsx`
- `src/components/timeline/PostBody/index.tsx`
- `src/components/timeline/PostRichText/index.tsx`
- `src/components/timeline/Timeline/PostLauncher/index.tsx`
- `src/components/timeline/Timeline/SurveyGate/SurveyDialog/index.tsx`
- `src/components/timeline/Timeline/SurveyGate/index.tsx`
- `src/components/timeline/Timeline/ThreadCard/PostCard/PostCardEntryActions/index.tsx`
- `src/components/timeline/Timeline/ThreadCard/PostCard/PostCardEntryActions/useSkyshareEntryStatus.ts`
- `src/components/timeline/Timeline/ThreadCard/PostCard/index.tsx`
- `src/components/timeline/Timeline/ThreadCard/PostCard/useWebShareCrosspost.ts`
- `src/components/timeline/Timeline/ThreadCard/index.tsx`
- `src/components/timeline/Timeline/index.tsx`

### G5（17 ファイル）

- `src/components/account/AccountSwitchPanel/AccountSwitcher/index.tsx`
- `src/components/account/AccountSwitchPanel/index.tsx`
- `src/components/account/LoginForm/index.tsx`
- `src/components/entry/EntryDeleteConfirmDialog/DeletePostListDialog/DeletePostListItem/index.tsx`
- `src/components/entry/EntryDeleteConfirmDialog/DeletePostListDialog/index.tsx`
- `src/components/entry/EntryDeleteConfirmDialog/index.tsx`
- `src/components/entry/EntryDetailView/index.astro`
- `src/components/entry/EntryList/EntryCard/EntryEditForm/index.tsx`
- `src/components/entry/EntryList/EntryCard/index.tsx`
- `src/components/entry/EntryList/index.tsx`
- `src/components/entry/LegacyPageDeleteButton/index.tsx`
- `src/components/image/ImageGallery/ImageLightbox/index.tsx`
- `src/components/image/ImageGallery/index.tsx`
- `src/components/schedule/AuthorizationReturn/index.tsx`
- `src/components/schedule/CredentialDialog/index.tsx`
- `src/components/schedule/ScheduleSetting/index.tsx`
- `src/components/schedule/ScheduleSetting/useScheduleAvailability.ts`

### G6（16 ファイル）

- `src/components/feedback/FeedbackForm/clientEnvironment.ts`
- `src/components/feedback/FeedbackForm/index.tsx`
- `src/components/i18n/useTranslation.ts`
- `src/components/layout/Baselayout/index.astro`
- `src/components/layout/FooterNav/index.astro`
- `src/components/layout/NavIcon/index.astro`
- `src/components/layout/Sidebar/index.astro`
- `src/components/layout/nav/navItems.ts`
- `src/components/layout/nav/syncAccountAvatar.ts`
- `src/components/layout/nav/syncActiveState.ts`
- `src/components/layout/nav/syncGuestModeQuery.ts`
- `src/components/settings/SettingList/index.tsx`
- `src/components/settings/Settings/index.tsx`
- `src/components/settings/Settings/useShareToggles.ts`
- `src/components/share/IntentShareDialog/index.tsx`
- `src/components/share/IntentShareDialog/openIntentPopup.ts`

### G7（9 ファイル）

- `src/pages/accounts.astro`
- `src/pages/entries/[slug].astro`
- `src/pages/entries/index.astro`
- `src/pages/entries/sample.astro`
- `src/pages/feedback.astro`
- `src/pages/help.astro`
- `src/pages/jump.astro`
- `src/pages/posts/[dbIndex]/[slug].astro`
- `src/pages/privacy.astro`

### G8（24 ファイル）

- `src/pages/oauth/callback.ts`
- `src/pages/oauth/client-metadata.json.ts`
- `src/pages/oauth/jwks.json.ts`
- `src/pages/v1/page.ts`
- `src/pages/v2/bsky/drafts.ts`
- `src/pages/v2/bsky/images.ts`
- `src/pages/v2/bsky/session.ts`
- `src/pages/v2/bsky/session/[did].ts`
- `src/pages/v2/bsky/session/authorization.ts`
- `src/pages/v2/bsky/session/authorization/completion.ts`
- `src/pages/v2/bsky/video/upload-token.ts`
- `src/pages/v2/entries.ts`
- `src/pages/v2/entries/skyshare.ts`
- `src/pages/v2/entry.ts`
- `src/pages/v2/feedback.ts`
- `src/pages/v2/schedules.ts`
- `src/pages/v2/schedules/[id].ts`
- `src/pages/v2/schedules/[id]/images/[index].ts`
- `src/pages/v2/schedules/credential.ts`
- `src/pages/v2/schedules/credential/authorization.ts`
- `src/pages/v2/schedules/credential/authorization/completion.ts`
- `src/pages/v2/schedules/limits.ts`
- `src/pages/v2/surveys/[surveyId]/answers.ts`
- `src/pages/v2/surveys/[surveyId]/respondent.ts`

### G9（許容リストの 8 件 ＋ 検査の対象外）

- 許容リストの対象（8 件）: `src/env.ts`・`src/middleware.ts`・`src/util/formData.ts`・`src/util/http.ts`・`src/util/padTwoDigits.ts`・`src/util/waitForImageLoad.ts`・`src/vars.ts`・`src/worker.ts`
- 検査の対象だが、許容リストに項目が無い（違反なし）: `src/types/clientEnvironment.ts`・`src/types/formData.ts`・`src/types/outcome.ts`・`src/util/utf8Bytes.ts`。経緯の語の確認だけを行う。
- 検査の対象外（禁止パターンと経緯の語を grep で確かめる）: `src/global.d.ts`（`.d.ts`）・`src/styles/**`（CSS 6 件。うち 4 件に旧 spec 参照と「旧画面」「以前あった」の記述）
- 注記: `src/styles/ui.module.css` の「旧画面」は、画面の切り替えを指す技術用語で、経緯ではない可能性が高い。判断はレビューで行う。

## Architecture Pattern Evaluation

| Option                       | Description                                                | Strengths                                                | Risks / Limitations                                       | Notes                                      |
| ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------ |
| 領域ごとに直列に作業（採用） | グループごとに書き換え、検査と許容リストの項目の削除を行う | 差分とレビューの単位が小さい。許容リストの衝突が起きない | 作業が長い                                                | 採用                                       |
| 領域ごとに並列に作業         | グループを並列の作業者に渡す                               | 速い                                                     | `allowlist.json` の衝突。同じ JSON への編集を統合する手間 | 却下                                       |
| 全体を一括で置換             | 検査の出力を基に一括で書き換える                           | 単純                                                     | 「最小要件」など正当な用法の誤消去。判別が必要            | 却下（`comments.md` の判別の方針に反する） |

## Design Decisions

### Decision: 作業は直列のグループで行い、各段階で検査と許容リストを同時に更新する

- **Context**: 許容リストは 1 つの JSON で、テストは「未登録の違反」と「解消済みの項目」の両方で失敗する。
- **Alternatives Considered**:
  1. 並列に作業し、最後に許容リストをまとめて直す。
  2. グループごとに直列に作業し、その場で許容リストの項目を消す。
- **Selected Approach**: 2。各グループは、書き換え・グループのパスの検査・そのグループの項目の削除・`git diff` でコメントだけの確認、の順に行う。
- **Rationale**: 各段階でテストが通る状態を保てる。どの段階で何を直したかが、差分から追える。
- **Trade-offs**: 作業は長くなる。
- **Follow-up**: 最後の G10 で、所有が `comments-components-pages` の項目が 0 件であることと、テストの通過を確かめる。

### Decision: CSS と `*.d.ts` は、禁止パターンと経緯の語だけを対象にする

- **Context**: brief の範囲に含まれるが、基準は CSS と `*.d.ts` を対象外にしている。
- **Selected Approach**: 先頭ヘッダは要求しない。禁止パターン（spec 参照・要件番号・AC/FR/NFR・cc-sdd・kiro・バッククォートの外の日付）と経緯の語を取り除く。grep で確かめる。
- **Follow-up**: この前提は、要件の「境界の文脈」に書いた。違う判断をする場合は要件を直す。

## Risks & Mitigations

- 書き換えたコメントが、コードの現在の振る舞いと食い違う — 書いた内容を、対応するコードで確かめる。判別に迷う内容は残し、報告に挙げる。
- 誤ってコードの行を変える — 段階ごとに `git diff` を検査し、コードの行が混じれば差し戻す。
- `eslint-disable` などの機械指示を消す — 機械指示の行は変えない。差分の検査で、指示の行の削除を見つける。
- 範囲の外（`src/lib`・`tests`・`scripts`）に触れる — 作業の対象は範囲のパスに限る。`git diff --name-only` で確かめる。
- E2E が環境の都合で失敗する — 失敗の原因を分けて報告する（コメントの変更とは無関係であることを、同じコミットでの実行結果で示す）。

## References

- `.kiro/steering/comments.md` — コメントの基準（残す・書かない・先頭ヘッダ・検査）
- `scripts/architecture/commentRules.ts` — 検査の本体（禁止パターンと先頭ヘッダの判定）
- `tests/unit/scripts/commentRules.test.ts` — 検査のテスト（許容リストの照合を含む）
- `config/comments/allowlist.json` — 許容リスト
- `.kiro/steering/structure-components.md` — 部品の配置の規約
- `.kiro/steering/testing.md` — 検証の層（unit・component・route・render・e2e）
