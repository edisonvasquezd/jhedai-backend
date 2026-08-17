ALTER TABLE blog_posts ADD COLUMN tags TEXT DEFAULT '[]';
ALTER TABLE blog_posts ADD COLUMN read_time TEXT DEFAULT '5 min';
ALTER TABLE blog_posts ADD COLUMN featured INTEGER DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN featured_image TEXT;
ALTER TABLE blog_posts ADD COLUMN featured_image_alt TEXT;
ALTER TABLE blog_posts ADD COLUMN meta_title TEXT;
ALTER TABLE blog_posts ADD COLUMN meta_description TEXT;
ALTER TABLE blog_posts ADD COLUMN author_avatar TEXT;
