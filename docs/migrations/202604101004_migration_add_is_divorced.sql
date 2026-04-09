-- Migration: Add is_divorced flag to relationships table
-- This allows marking a marriage relationship as a divorce without deleting the record.

ALTER TABLE public.relationships
  ADD COLUMN IF NOT EXISTS is_divorced BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.relationships.is_divorced IS
  'When TRUE on a marriage relationship, indicates the couple is divorced.';
