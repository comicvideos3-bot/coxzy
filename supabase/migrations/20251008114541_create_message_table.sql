/*
  # Create message table for AI chat system

  1. New Tables
    - `message`
      - `id` (uuid, primary key) - Unique identifier for each message
      - `sender` (text) - Who sent the message (user/ai)
      - `message_text` (text) - The actual message content
      - `status` (text) - Status of the message (pending/answered)
      - `created_at` (timestamptz) - When the message was created
      - `updated_at` (timestamptz) - When the message was last updated
      
  2. Security
    - Enable RLS on `message` table
    - Add policy for public access (since this is a demo with client-side code)
    
  3. Important Notes
    - This table will store both user questions and AI responses
    - The status field helps track which messages need AI responses
*/

CREATE TABLE IF NOT EXISTS message (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender text NOT NULL DEFAULT 'user',
  message_text text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE message ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON message
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert access"
  ON message
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update access"
  ON message
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_message_status ON message(status);
CREATE INDEX IF NOT EXISTS idx_message_created_at ON message(created_at);