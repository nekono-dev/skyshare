-- 予約投稿の認証情報から再許可状態の列を削除する。
-- 旧実装が残した「再度の許可が必要である印」の行（認可の情報が空）は、列を消すと有効な登録に見えるため、先に削除する。
DELETE FROM schedule_credentials WHERE reauth_required = 1;
ALTER TABLE schedule_credentials DROP COLUMN reauth_required;
