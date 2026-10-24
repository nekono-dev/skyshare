-- 成功した予約は履歴に残さない方針に改めたため、旧実装が残した投稿済みの行を削除する
-- （画像は投稿の完了時にすでに削除されている）
DELETE FROM scheduled_posts WHERE status = 'posted';
