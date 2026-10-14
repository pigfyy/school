CREATE TABLE state (
  user_id TEXT,
  email TEXT,
  course TEXT,
  week TEXT,
  data TEXT,
  updated_at TEXT,
  PRIMARY KEY (user_id, course, week)
);
