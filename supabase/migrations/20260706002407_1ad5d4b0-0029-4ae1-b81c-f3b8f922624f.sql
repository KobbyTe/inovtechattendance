ALTER TABLE public.session_reviews
  ADD COLUMN IF NOT EXISTS sentiment TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_session_reviews_tags ON public.session_reviews USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_session_reviews_keywords ON public.session_reviews USING GIN (keywords);