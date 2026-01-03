-- Create game_sessions table to track played games
CREATE TABLE public.game_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    email TEXT,
    player_count INTEGER NOT NULL,
    bot_count INTEGER NOT NULL,
    impostor_count INTEGER NOT NULL,
    difficulty TEXT
);

-- Enable Row Level Security
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read game sessions
CREATE POLICY "Anyone can read game sessions" 
ON public.game_sessions 
FOR SELECT 
USING (true);

-- Allow anyone to insert game sessions
CREATE POLICY "Anyone can insert game sessions" 
ON public.game_sessions 
FOR INSERT 
WITH CHECK (true);