-- Create table to store visitor emails
CREATE TABLE public.visitor_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visitor_emails ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert their email (public form)
CREATE POLICY "Anyone can submit their email"
ON public.visitor_emails
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_visitor_emails_created_at ON public.visitor_emails(created_at DESC);