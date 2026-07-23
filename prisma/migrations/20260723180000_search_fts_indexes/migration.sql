-- GIN indexes for workspace search (to_tsvector / plainto_tsquery)

CREATE INDEX IF NOT EXISTS projects_fts_idx ON projects
  USING GIN (
    to_tsvector(
      'simple',
      coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(slug, '')
    )
  );

CREATE INDEX IF NOT EXISTS tasks_fts_idx ON tasks
  USING GIN (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(description, '')
    )
  );

CREATE INDEX IF NOT EXISTS comments_fts_idx ON comments
  USING GIN (
    to_tsvector('simple', coalesce(body, ''))
  );
