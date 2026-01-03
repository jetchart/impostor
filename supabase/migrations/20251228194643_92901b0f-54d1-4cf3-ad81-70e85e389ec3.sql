-- Add allow_impostor_hint column to game_sessions
ALTER TABLE public.game_sessions 
ADD COLUMN allow_impostor_hint BOOLEAN DEFAULT true;