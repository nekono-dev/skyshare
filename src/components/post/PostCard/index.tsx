/**
 * 1件の Bluesky 投稿を表示するカード。
 *
 * 責務と処理概要:
 * - 投稿の表示部（作者・日時・本文・画像）は `PostBody` に委譲し、ツールバーをその下に配置する。
 * - `skyshareEntry` が付与されている場合は元画像・動画の代わりにその visual を1枚、拡大なしで表示し、
 *   Entry ページへのリンクを出す。Entry を持たない投稿は元画像を拡大可能なサムネイルで表示する。
 * - `skyshareEntry` が無く画像投稿の場合は、既存投稿から skyshare entry を発行するボタンを出す。
 * - Entry の作成・削除に伴う状態遷移自体は `useSkyshareEntryStatus` に委譲し、
 *   このコンポーネントはその結果（`display`）を描画するだけに徹する。
 */

import { useT } from "@/lib/i18n/react"
import { useState } from "react"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import type { TimelinePost } from "@/lib/entry/posts"
import {
  useSkyshareEntryStatus,
  type SkyshareEntryDisplayState,
} from "./useSkyshareEntryStatus"
import { useWebShareCrosspost } from "./useWebShareCrosspost"
import { parseAtUri, skyshareEntryPath } from "@/lib/entry/url"
import Loading from "@/components/common/Loading"
import PostCardEntryActions from "@/components/post/PostCardEntryActions"
import SkyshareShareDialog from "@/components/post/SkyshareShareDialog"
import EntryDeleteConfirmDialog from "@/components/entry/EntryDeleteConfirmDialog"
import blueskyIcon from "@/images/bluesky.svg"
import shareIcon from "@/images/share.svg"
import PostBody from "@/components/post/PostBody"
import { TARGET_WIDTH, TARGET_HEIGHT } from "@/lib/image/postImageProcessing"
import type { SourceImage } from "@/lib/entry/entry"

type PostCardProps = {
  item: TimelinePost
  /**
   * Bluesky投稿ごと削除された直後に呼び出されるコールバック。呼び出し元
   * （`ThreadCard`）は、Timelineのページング対象アイテムがスレッドグループ単位
   * であるため（`specs/timeline/design.md §4`）、常にそのスレッドグループ全体を
   * 一覧から除去する。
   */
  onPostDeleted?: () => void
  /**
   * ログイン不要のゲスト用デモ表示。Bluesky投稿への実際の書き込みを伴う操作
   * （Entry作成・元投稿へのリンク）のみ無効化する。Entry削除は有効で、削除範囲の判定・
   * 削除の実行はアプリ内で模擬する（`specs/entry/frontend/design.md §3.4.4`）。クロスポスト（Xへの
   * 共有intentポップアップ）とWebShare共有はatproto認証を必要としないため
   * 通常通り操作でき、「Entryを開く」もサンプルEntryページへ遷移できる。
   */
  guestMode?: boolean
  /**
   * 事後entry作成ボタンの表示制御（`specs/timeline/design.md §5`）。
   * - `undefined`（既定）: 単独投稿と同じ、投稿自身の適格性のみで判定する。
   * - `true`: スレッドのルート投稿として明示的にボタンを表示する
   *   （`entryVisualSourcePost`がある場合はそちらの画像を使う）。
   * - `false`: スレッドの中間投稿として、投稿自身が画像を持っていてもボタンを
   *   抑制する（ボタンは常にルート投稿のカードにのみ表示するため）。
   */
  postCreateEntryButton?: boolean
  /**
   * 事後entry作成のVisual（カバー画像）を`item`の代わりに取得する投稿
   * （`resolveEntryVisualSourcePost`、`specs/timeline/design.md §5`）。
   * `ThreadCard`がスレッドのルート投稿向けに、ルート自身が画像を持たない場合の
   * 代わりの画像取得元（ルートに最も近い画像付き投稿）を渡す。未指定時は`item`
   * 自身が対象になる。
   */
  entryVisualSourcePost?: TimelinePost
  /**
   * 作成するentryの`source`にする投稿（`specs/timeline/design.md §5`）。
   * `ThreadCard`がルート投稿のカードに、スレッドのルート投稿を渡す。
   * 未指定時は`item`自身が`source`になる。
   */
  entrySourcePost?: TimelinePost
  /**
   * trueの場合、スレッドの中間投稿（ルート以外）として扱い、Entry作成対象外でも
   * カードをグレーアウトしない。中間投稿はスレッドの一部として表示されるため、
   * 単独投稿のように「対象外」であることを視覚的に強調しない。
   */
  threadReply?: boolean
}

/**
 * 投稿カードを描画する。
 *
 * Input:
 * - `item`: 正規化済みの投稿一覧データ
 *
 * Output:
 * - 1件の投稿カード JSX
 *
 * 例:
 * - 入力: `item.text = "hello"`
 * - 出力: 投稿本文と作者情報を持つカード
 */
const Component = ({
  item,
  onPostDeleted,
  guestMode = false,
  postCreateEntryButton,
  entryVisualSourcePost,
  entrySourcePost,
  threadReply = false,
}: PostCardProps) => {
  const { t } = useT()
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  const {
    display,
    createError,
    deleteError,
    isDeleteDialogOpen,
    isResolvingDeleteScope,
    deleteScope,
    createEntryFromPost,
    requestDeleteEntry,
    cancelDeleteEntry,
    confirmDeleteEntry,
  } = useSkyshareEntryStatus(item, {
    onCreated: () => setShareDialogOpen(true),
    onPostDeleted,
    visualSourcePost: entryVisualSourcePost,
    sourcePost: entrySourcePost,
    guestMode,
  })

  const activeEntry =
    display.kind === "entry" || display.kind === "deleting"
      ? display.entry
      : null
  const entryWebUrl = activeEntry?.webUrl

  const {
    isSupported: isWebShareSupported,
    isSharing: isWebSharing,
    shareError,
    shareViaWebApi,
  } = useWebShareCrosspost(item, entryWebUrl ?? null, guestMode)

  // ページ内リンクは entry 自身の AT URI から直接パスを組み立てる（常に相対パス）。
  // X共有（SkyshareShareDialog）は外部サービスへの絶対URLが必要なため、
  // そちらは本番ドメイン固定で生成された entryWebUrl をそのまま渡す。
  // ゲストモードのダミーEntryはPDS上に実レコードを持たないため、AT URIから
  // 算出するパスの代わりに、実際に閲覧できるサンプルEntryページのパス
  // （`activeEntry.webUrl`、`@/lib/entry/guestDummyPosts`で用意）をそのまま使う。
  // このページは `entries/[slug].astro` と同様ログイン不要の公開ページのため、
  // `?guest`は引き継がない。
  const parsedEntryUri = activeEntry ? parseAtUri(activeEntry.uri) : undefined
  const entryPath = guestMode
    ? activeEntry?.webUrl
    : parsedEntryUri
      ? skyshareEntryPath(parsedEntryUri.repo, parsedEntryUri.rkey)
      : undefined
  // Entry を持つ投稿（スレッドのルート投稿・単独投稿）は元画像の代わりに visual を1枚、
  // 拡大なしで表示する。Entry を持たない投稿は元画像を拡大可能なサムネイルで表示する。
  // visual は OGP 仕様（1200x630）で生成されるため、その比率を指定して全体を表示する（クロップしない）。
  const entryVisualImages: SourceImage[] | undefined = activeEntry?.visualUrl
    ? [
        {
          url: activeEntry.visualUrl,
          alt: "",
          cid: activeEntry.visualUrl,
          aspectRatio: { width: TARGET_WIDTH, height: TARGET_HEIGHT },
        },
      ]
    : undefined
  // Entry の visual がある場合は動画投稿でもそれを表示し、動画のサムネイル・利用不可表示は出さない。
  // Entry が無い動画投稿・利用不可の動画は、動画のサムネイル（または利用不可表示）を出す。
  const showEntryVisual = entryVisualImages !== undefined
  const video = showEntryVisual ? undefined : item.video
  const unsupportedVideo = showEntryVisual ? undefined : item.unsupportedVideo
  const hasVideoDisplay = !!video || !!unsupportedVideo
  const galleryImages = hasVideoDisplay
    ? []
    : (entryVisualImages ?? item.images)
  const imagesInteractive = entryVisualImages === undefined
  // Entry も無く作成対象にも該当しない投稿（画像を持たない投稿）はカード全体をグレーアウトする。
  // ただしスレッドの中間投稿（`threadReply`）はグレーアウトしない。
  // この判定は投稿自身の適格性のみに基づくため、postCreateEntryButtonによる
  // ボタン抑制（下記actionsDisplay）とは独立して評価する。
  const isSkyshareIneligible = display.kind === "ineligible" && !threadReply

  // postCreateEntryButton===false（スレッド内で事後entry作成の対象に選ばれなかった
  // 画像投稿）の場合のみ、ボタン表示用のdisplayを「作成対象外」に差し替える。
  // display自体（isSkyshareIneligible等）は変更しない。
  const actionsDisplay: SkyshareEntryDisplayState =
    postCreateEntryButton === false && display.kind === "creatable"
      ? { kind: "ineligible" }
      : display

  return (
    <article
      className={`${ui["base-card"]} ${styles.card} ${isSkyshareIneligible ? ui["card-muted"] : ""}`}
    >
      <PostBody
        author={item.author}
        createdAt={item.indexedAt}
        text={item.text}
        images={galleryImages}
        video={video}
        unsupportedVideo={unsupportedVideo}
        videoInteractive={false}
        unsupportedVideoLinkUrl={item.url}
        imagesInteractive={imagesInteractive}
      />

      <footer
        className={`${styles.footer} ${ui["toolbar"]} ${ui["toolbar-align"]}`}
      >
        <div className={styles["footer-actions"]}>
          <a
            className={`${ui["base-button"]} ${ui["nontext-button"]} ${ui["md-button"]} ${ui["white-button"]}`}
            href={guestMode ? undefined : item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("post.card.openBluesky")}
            aria-disabled={guestMode}
            title={
              guestMode
                ? t("post.guestUnavailable")
                : t("post.card.openBluesky")
            }
            onClick={e => {
              if (guestMode) e.preventDefault()
            }}
          >
            <img src={blueskyIcon.src} width={20} height={20} alt="" />
          </a>

          {isWebShareSupported ? (
            <button
              type="button"
              className={`${ui["base-button"]} ${ui["nontext-button"]} ${ui["md-button"]} ${ui["white-button"]}`}
              disabled={isWebSharing}
              onClick={shareViaWebApi}
              aria-label={t("post.card.webShare")}
              title={t("post.card.webShare")}
            >
              <img src={shareIcon.src} width={20} height={20} alt="" />
            </button>
          ) : null}

          <PostCardEntryActions
            display={actionsDisplay}
            createError={createError}
            deleteError={deleteError}
            onCreate={createEntryFromPost}
            onRequestDelete={requestDeleteEntry}
            onCrosspost={() => setShareDialogOpen(true)}
            disabled={guestMode || isResolvingDeleteScope}
            deleteDisabled={isResolvingDeleteScope}
          />

          {shareError ? (
            <span className={styles["share-error"]}>{t(shareError)}</span>
          ) : null}
        </div>

        {entryPath ? (
          <div className={styles["entry-link-box"]}>
            <a
              className={styles["entry-link"]}
              href={entryPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("post.card.openEntry")}
            </a>
          </div>
        ) : null}
      </footer>

      {display.kind === "creating" ? (
        <Loading overlay message={t("post.card.creatingEntry")} />
      ) : null}

      {display.kind === "deleting" ? (
        <Loading overlay message={t("post.card.deletingEntry")} />
      ) : null}

      {isResolvingDeleteScope ? (
        <Loading overlay message={t("post.card.checkingDeletion")} />
      ) : null}

      {isWebSharing && !entryWebUrl && item.images.length > 0 ? (
        <Loading overlay message={t("post.card.loadingImages")} />
      ) : null}

      <SkyshareShareDialog
        open={shareDialogOpen}
        postText={item.text}
        entryUrl={entryWebUrl ?? null}
        onClose={() => setShareDialogOpen(false)}
      />

      <EntryDeleteConfirmDialog
        open={isDeleteDialogOpen}
        isDeleting={display.kind === "deleting"}
        deleteScope={deleteScope}
        onDeleteLink={() => confirmDeleteEntry(false)}
        onDeletePost={() => confirmDeleteEntry(true)}
        onCancel={cancelDeleteEntry}
      />
    </article>
  )
}

export default Component
