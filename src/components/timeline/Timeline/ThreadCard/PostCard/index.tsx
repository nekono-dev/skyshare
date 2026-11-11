/**
 * Bluesky 投稿と Entry の visual、共有・Entry 操作をカードに表示する。
 * Entry visual は OGP 比率（1200×630）で全体を表示し、拡大操作の対象にしない。
 */

import { useT } from "@/components/i18n/useTranslation"
import { useState } from "react"
import ui from "@/styles/ui.module.css"
import styles from "./index.module.css"
import type { TimelinePost } from "@/lib/timeline/posts"
import {
  useSkyshareEntryStatus,
  type SkyshareEntryDisplayState,
} from "@/components/timeline/Timeline/ThreadCard/PostCard/PostCardEntryActions/useSkyshareEntryStatus"
import { useWebShareCrosspost } from "./useWebShareCrosspost"
import { skyshareEntryPath } from "@/lib/entry/url"
import { parseAtUri } from "@/lib/atproto/atUri"
import Loading from "@/components/common/Loading"
import PostCardEntryActions from "@/components/timeline/Timeline/ThreadCard/PostCard/PostCardEntryActions"
import IntentShareDialog from "@/components/share/IntentShareDialog"
import EntryDeleteConfirmDialog from "@/components/entry/EntryDeleteConfirmDialog"
import blueskyIcon from "@/images/bluesky.svg"
import shareIcon from "@/images/share.svg"
import PostBody from "@/components/timeline/PostBody"
import { TARGET_WIDTH, TARGET_HEIGHT } from "@/lib/image/postImageProcessing"
import type { SourceImage } from "@/lib/entry/entry"
import { resolveShareBody } from "@/lib/share/shareBody"
import { readEffectiveLinkCardPriority } from "@/lib/settings/shareSettings"

type PostCardProps = {
  item: TimelinePost
  /**
   * Bluesky 投稿の削除成功後に呼び出す。呼び出し元はページング単位のスレッド全体を一覧から除く。
   */
  onPostDeleted?: () => void
  /**
   * ログイン不要のデモ表示。Entry 作成は無効だが、削除はアプリ内で模擬し、通信しない。
   * X 共有と Web Share は atproto 認証を使わず、Entry リンクはサンプルページを開く。
   */
  guestMode?: boolean
  /**
   * 事後 Entry 作成ボタンの表示制御。
   * - `undefined`（既定）: 単独投稿と同じ、投稿自身の適格性のみで判定する。
   * - `true`: スレッドのルート投稿として明示的にボタンを表示する
   *   （`entryVisualSourcePost`がある場合はそちらの画像を使う）。
   * - `false`: スレッドのルート投稿のうち、ルート自身にも代わりの画像取得元にも
   *   画像が無い場合に、ボタンを抑制する。
   */
  postCreateEntryButton?: boolean
  /**
   * 下部ツールバーを表示しないか。操作はスレッドの起点に集約するため、ThreadCard が返信カードに指定する。
   */
  hideToolbar?: boolean
  /**
   * 事後 Entry の visual（カバー画像）を item の代わりに取得する投稿。
   * `ThreadCard`がスレッドのルート投稿向けに、ルート自身が画像を持たない場合の
   * 代わりの画像取得元（ルートに最も近い画像付き投稿）を渡す。未指定時は`item`
   * 自身が対象になる。
   */
  entryVisualSourcePost?: TimelinePost
  /**
   * 作成する Entry の source にする投稿。
   * `ThreadCard`がルート投稿のカードに、スレッドのルート投稿を渡す。
   * 未指定時は`item`自身が`source`になる。
   */
  entrySourcePost?: TimelinePost
  /**
   * カードの中身のコントラストを下げるか。
   * - `undefined`（既定）: 投稿自身がEntryを持たず作成対象にも該当しない（`display.kind === "ineligible"`）ときに下げる。
   * - `true`/`false`: 呼び出し側の判定に従う。`ThreadCard`がスレッドの返信のカードに、
   *   グループ全体が作成対象外か（どの投稿も画像・動画・entryを持たないか）を渡す。
   */
  muted?: boolean
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
  hideToolbar = false,
  entryVisualSourcePost,
  entrySourcePost,
  muted,
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

  // ページ内リンクは相対パスにし、X 共有には本番ドメインの絶対 URL を渡す。
  // ゲスト用 Entry に実 AT URI はないため、閲覧可能なサンプルページ URL を使う。
  const parsedEntryUri = activeEntry ? parseAtUri(activeEntry.uri) : undefined
  const entryPath = guestMode
    ? activeEntry?.webUrl
    : parsedEntryUri
      ? skyshareEntryPath(parsedEntryUri.repo, parsedEntryUri.rkey)
      : undefined
  // visual は OGP 比率（1200×630）で生成されるため、全体を表示してクロップしない。
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
  // Entry visual があれば動画のサムネイルや利用不可表示より優先する。
  const showEntryVisual = entryVisualImages !== undefined
  const video = showEntryVisual ? undefined : item.video
  const unsupportedVideo = showEntryVisual ? undefined : item.unsupportedVideo
  const hasVideoDisplay = !!video || !!unsupportedVideo
  const galleryImages = hasVideoDisplay
    ? []
    : (entryVisualImages ?? item.images)
  const imagesInteractive = entryVisualImages === undefined
  // カードのグレーアウト判定は、作成ボタンだけを抑制する postCreateEntryButton と独立している。
  const isSkyshareIneligible = muted ?? display.kind === "ineligible"

  // false は操作ボタンだけを隠し、カード自体の適格性表示は変えない。
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
        facets={item.facets}
        images={galleryImages}
        video={video}
        unsupportedVideo={unsupportedVideo}
        videoInteractive={false}
        unsupportedVideoLinkUrl={item.url}
        imagesInteractive={imagesInteractive}
      />

      {hideToolbar ? null : (
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
      )}

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

      <IntentShareDialog
        request={
          shareDialogOpen
            ? {
                // 設定変更を反映するため、ダイアログを開くたびに保存値を読み直す。
                postText: resolveShareBody({
                  text: item.text,
                  facets: item.facets ?? [],
                  entryUrl: entryWebUrl ?? null,
                  linkCardUrl: "",
                  preferSkyshareLinkCard: readEffectiveLinkCardPriority(),
                }).text,
                entryUrl: entryWebUrl ?? null,
                linkCardUrl: "",
              }
            : null
        }
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
