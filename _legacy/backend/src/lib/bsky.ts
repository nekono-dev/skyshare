import { AtpAgent, AppBskyFeedDefs, AppBskyFeedPost } from '@atproto/api';

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

export { getThreadPost };
