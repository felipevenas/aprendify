-- Repertorios privados por usuario, com ownership enforced no banco.
CREATE TABLE public.repertorios_socioculturais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 180),
  category TEXT NOT NULL CHECK (char_length(trim(category)) BETWEEN 1 AND 80),
  summary TEXT NOT NULL CHECK (char_length(trim(summary)) BETWEEN 1 AND 1200),
  purpose TEXT NOT NULL CHECK (char_length(trim(purpose)) BETWEEN 1 AND 1200),
  application_example TEXT NOT NULL CHECK (char_length(trim(application_example)) BETWEEN 1 AND 2400),
  themes TEXT[] NOT NULL DEFAULT '{}'::TEXT[]
    CHECK (
      cardinality(themes) <= 12 AND array_position(themes, NULL) IS NULL
      AND octet_length(array_to_json(themes)::TEXT) <= 6000
    ),
  niches TEXT[] NOT NULL DEFAULT '{}'::TEXT[]
    CHECK (
      cardinality(niches) <= 12 AND array_position(niches, NULL) IS NULL
      AND octet_length(array_to_json(niches)::TEXT) <= 6000
    ),
  source_title TEXT CHECK (source_title IS NULL OR char_length(source_title) <= 180),
  source_author TEXT CHECK (source_author IS NULL OR char_length(source_author) <= 120),
  source_year TEXT CHECK (source_year IS NULL OR char_length(source_year) <= 40),
  source_url TEXT CHECK (
    source_url IS NULL OR (char_length(source_url) <= 500 AND source_url ~* '^https?://')
  ),
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'ai')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX repertorios_socioculturais_owner_created_idx
  ON public.repertorios_socioculturais (user_id, created_at DESC, id DESC);

ALTER TABLE public.repertorios_socioculturais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own repertorios"
  ON public.repertorios_socioculturais FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own repertorios"
  ON public.repertorios_socioculturais FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own repertorios"
  ON public.repertorios_socioculturais FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own repertorios"
  ON public.repertorios_socioculturais FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_repertorios_socioculturais_updated_at
  BEFORE UPDATE ON public.repertorios_socioculturais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
