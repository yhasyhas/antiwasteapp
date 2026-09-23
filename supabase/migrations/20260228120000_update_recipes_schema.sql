/*
  # Update Recipe Schema
  Add meal_type, language, and enhanced ingredient tracking
*/

-- Add new columns to recipes table
ALTER TABLE recipes 
  ADD COLUMN IF NOT EXISTS meal_type text DEFAULT 'lunch',
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS ingredients_from_list jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS missing_ingredients jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_time integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url text;

-- Add new columns to user_preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS default_meal_type text DEFAULT 'lunch',
  ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'fr';

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_recipes_meal_type ON recipes(meal_type);
CREATE INDEX IF NOT EXISTS idx_recipes_language ON recipes(language);