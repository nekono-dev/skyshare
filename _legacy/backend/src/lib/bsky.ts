import {
    AtpAgent,
    AppBskyFeedDefs,
    AppBskyFeedPost,
    AppBskyEmbedImages,
} from '@atproto/api';

/**
 * 指定 uri のスレッド投稿を取得してポストオブジェクトを返す。
 * 条件を満たさない場合は Error を投げる。
 */
const getThreadPost = async (agent: AtpAgent, uri: string) => {
    const thread = await agent.getPostThread({
        depth: 0,
        parentHeight: 0,
        uri,
    });

    if (!AppBskyFeedDefs.isThreadViewPost(thread.data.thread)) {
        throw new Error('NotThreadViewPost');
    }

    const post = thread.data.thread.post;

    if (!AppBskyFeedPost.isRecord(post.record)) {
        throw new Error('NotPostRecord');
    }

    return post;
};

/**
 * post オブジェクトから画像埋め込みを抽出して返す。
 * 画像埋め込みでない場合は Error を投げる。
 */
const extractImagesFromPost = (
    post: AppBskyFeedDefs.PostView,
): AppBskyEmbedImages.ViewImage[] => {
    // post は getThreadPost で検証済みであることを前提とする

    if (!AppBskyEmbedImages.isView(post.embed)) {
        throw new Error('NoImageEmbed');
    }

    return post.embed.images;
};

export { getThreadPost, extractImagesFromPost };
