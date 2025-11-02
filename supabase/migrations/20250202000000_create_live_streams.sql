-- Create live_streams table for managing artist livestreams
CREATE TABLE IF NOT EXISTS public.live_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id TEXT NOT NULL,
  channel_name TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  is_live BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  viewer_count INTEGER DEFAULT 0,
  peak_viewer_count INTEGER DEFAULT 0,
  total_tips_received NUMERIC DEFAULT 0,
  recording_url TEXT,
  thumbnail_cid TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_live_streams_artist_id ON public.live_streams(artist_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_is_live ON public.live_streams(is_live);
CREATE INDEX IF NOT EXISTS idx_live_streams_started_at ON public.live_streams(started_at DESC);

-- Create live_stream_viewers table to track who's watching
CREATE TABLE IF NOT EXISTS public.live_stream_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  is_watching BOOLEAN DEFAULT true,
  total_watch_time_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for viewers
CREATE INDEX IF NOT EXISTS idx_live_stream_viewers_stream_id ON public.live_stream_viewers(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_viewers_viewer_id ON public.live_stream_viewers(viewer_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_viewers_is_watching ON public.live_stream_viewers(is_watching);

-- Create live_stream_chat table for live chat messages
CREATE TABLE IF NOT EXISTS public.live_stream_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for chat messages
CREATE INDEX IF NOT EXISTS idx_live_stream_chat_stream_id ON public.live_stream_chat(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_chat_created_at ON public.live_stream_chat(created_at DESC);

-- Create live_stream_tips table for tips during streams
CREATE TABLE IF NOT EXISTS public.live_stream_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  tx_hash TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for tips
CREATE INDEX IF NOT EXISTS idx_live_stream_tips_stream_id ON public.live_stream_tips(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_tips_to_address ON public.live_stream_tips(to_address);

-- Enable RLS
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_stream_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_stream_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_stream_tips ENABLE ROW LEVEL SECURITY;

-- RLS Policies for live_streams
CREATE POLICY "Anyone can view live streams"
  ON public.live_streams
  FOR SELECT
  USING (true);

CREATE POLICY "Artists can insert their own streams"
  ON public.live_streams
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Artists can update their own streams"
  ON public.live_streams
  FOR UPDATE
  USING (true);

CREATE POLICY "Artists can delete their own streams"
  ON public.live_streams
  FOR DELETE
  USING (true);

-- RLS Policies for live_stream_viewers
CREATE POLICY "Anyone can view stream viewers"
  ON public.live_stream_viewers
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert themselves as viewers"
  ON public.live_stream_viewers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own viewer record"
  ON public.live_stream_viewers
  FOR UPDATE
  USING (true);

-- RLS Policies for live_stream_chat
CREATE POLICY "Anyone can view chat messages"
  ON public.live_stream_chat
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can send chat messages"
  ON public.live_stream_chat
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete their own messages"
  ON public.live_stream_chat
  FOR DELETE
  USING (true);

-- RLS Policies for live_stream_tips
CREATE POLICY "Anyone can view tips"
  ON public.live_stream_tips
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert tips"
  ON public.live_stream_tips
  FOR INSERT
  WITH CHECK (true);

-- Function to update viewer count
CREATE OR REPLACE FUNCTION update_live_stream_viewer_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.live_streams
    SET 
      viewer_count = (
        SELECT COUNT(*)
        FROM public.live_stream_viewers
        WHERE stream_id = NEW.stream_id AND is_watching = true
      ),
      peak_viewer_count = GREATEST(
        peak_viewer_count,
        (SELECT COUNT(*) FROM public.live_stream_viewers WHERE stream_id = NEW.stream_id AND is_watching = true)
      ),
      updated_at = NOW()
    WHERE id = NEW.stream_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.live_streams
    SET 
      viewer_count = (
        SELECT COUNT(*)
        FROM public.live_stream_viewers
        WHERE stream_id = OLD.stream_id AND is_watching = true
      ),
      updated_at = NOW()
    WHERE id = OLD.stream_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for viewer count updates
DROP TRIGGER IF EXISTS trigger_update_viewer_count ON public.live_stream_viewers;
CREATE TRIGGER trigger_update_viewer_count
  AFTER INSERT OR UPDATE OR DELETE ON public.live_stream_viewers
  FOR EACH ROW
  EXECUTE FUNCTION update_live_stream_viewer_count();

-- Function to update total tips received
CREATE OR REPLACE FUNCTION update_stream_tips_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.live_streams
  SET 
    total_tips_received = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.live_stream_tips
      WHERE stream_id = NEW.stream_id
    ),
    updated_at = NOW()
  WHERE id = NEW.stream_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for tips total updates
DROP TRIGGER IF EXISTS trigger_update_tips_total ON public.live_stream_tips;
CREATE TRIGGER trigger_update_tips_total
  AFTER INSERT ON public.live_stream_tips
  FOR EACH ROW
  EXECUTE FUNCTION update_stream_tips_total();

