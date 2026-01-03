-- Add player_names column to game_sessions
ALTER TABLE public.game_sessions 
ADD COLUMN player_names TEXT;