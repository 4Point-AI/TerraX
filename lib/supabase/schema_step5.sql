ALTER TABLE public.files
ADD COLUMN IF NOT EXISTS parsed_summary JSONB;