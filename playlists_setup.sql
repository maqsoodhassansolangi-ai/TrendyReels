-- ✅ TrendyReels: Playlists Feature — Supabase SQL Setup
-- یہ پوری فائل Supabase Dashboard → SQL Editor میں پیسٹ کر کے "Run" کریں

-- 1) Playlists ٹیبل
create table if not exists playlists (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz default now()
);

-- 2) Playlist <-> Video کا Many-to-Many Join Table
create table if not exists playlist_videos (
  id bigint generated always as identity primary key,
  playlist_id bigint references playlists(id) on delete cascade,
  video_id bigint references videos(id) on delete cascade,
  created_at timestamptz default now(),
  unique(playlist_id, video_id)
);

-- 3) Row Level Security فعال کریں
alter table playlists enable row level security;
alter table playlist_videos enable row level security;

-- 4) Public (سب) صرف پڑھ سکیں
create policy "Public read playlists" on playlists
  for select using (true);
create policy "Public read playlist_videos" on playlist_videos
  for select using (true);

-- 5) صرف لاگ اِن ایڈمن لکھ/تبدیل/ڈیلیٹ کر سکے (categories/videos جیسی ہی پالیسی)
create policy "Admin write playlists" on playlists
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Admin write playlist_videos" on playlist_videos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
