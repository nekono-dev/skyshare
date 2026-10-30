-- ログイン時アンケートの保管先。回答済みの集合と匿名の回答を、共通の値も参照も持たない 2 つの表に分ける。
-- 集合の行から回答は引けず、回答の行から利用者は引けない。

-- 回答済みの利用者の集合。回答への参照も時刻も持たない
CREATE TABLE survey_respondents (
  survey_id TEXT NOT NULL,
  did_hash TEXT NOT NULL,
  PRIMARY KEY (survey_id, did_hash)
) WITHOUT ROWID;

-- 匿名の回答。回答者に関わる値を持たない
CREATE TABLE survey_answers (
  survey_id TEXT NOT NULL,
  id TEXT NOT NULL,
  answers TEXT NOT NULL,
  answered_on TEXT NOT NULL,
  PRIMARY KEY (survey_id, id)
) WITHOUT ROWID;
