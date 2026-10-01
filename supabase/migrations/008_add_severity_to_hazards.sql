-- Add severity column to hazards table
ALTER TABLE public.hazards
ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'one_lane'
CHECK (severity IN ('passable', 'one_lane', 'impassable'));

-- Update existing rows to have a default severity (though DEFAULT should handle new inserts)
UPDATE public.hazards
SET severity = 'one_lane'
WHERE severity IS NULL;