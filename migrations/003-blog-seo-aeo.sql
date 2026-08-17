-- 003-blog-seo-aeo.sql
-- Campos SEO/GEO/AEO en blog_posts

-- author_id sin DEFAULT (SQLite no permite REFERENCES + DEFAULT no-NULL)
ALTER TABLE blog_posts ADD COLUMN author_id INTEGER REFERENCES authors(id);

ALTER TABLE blog_posts ADD COLUMN faq_items TEXT DEFAULT '[]';
ALTER TABLE blog_posts ADD COLUMN word_count INTEGER DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN primary_answer TEXT;
ALTER TABLE blog_posts ADD COLUMN speakable_selectors TEXT DEFAULT '["h1",".post-excerpt"]';

CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id);

-- Migrar posts existentes al autor org por defecto
UPDATE blog_posts SET author_id = 1 WHERE author_id IS NULL;
