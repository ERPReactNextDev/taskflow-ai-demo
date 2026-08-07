-- ============================================================
-- MIGRATION: Change chat table user_id columns from uuid to text
-- Reason: The app uses a custom users table with numeric IDs
-- and ReferenceID strings — NOT Supabase auth.users UUIDs.
-- This migration drops FK constraints and changes column types.
-- ============================================================

-- 1. Drop existing FK constraints referencing auth.users
ALTER TABLE public.conversations         DROP CONSTRAINT IF EXISTS conversations_created_by_fkey;
ALTER TABLE public.conversation_participants DROP CONSTRAINT IF EXISTS conversation_participants_user_id_fkey;
ALTER TABLE public.messages              DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.message_mentions      DROP CONSTRAINT IF EXISTS message_mentions_mentioned_user_id_fkey;
ALTER TABLE public.message_reactions     DROP CONSTRAINT IF EXISTS message_reactions_user_id_fkey;
ALTER TABLE public.pinned_messages       DROP CONSTRAINT IF EXISTS pinned_messages_pinned_by_fkey;

-- 2. Change column types from uuid to text
ALTER TABLE public.conversations         ALTER COLUMN created_by TYPE text USING created_by::text;
ALTER TABLE public.conversation_participants ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.messages              ALTER COLUMN sender_id TYPE text USING sender_id::text;
ALTER TABLE public.message_mentions      ALTER COLUMN mentioned_user_id TYPE text USING mentioned_user_id::text;
ALTER TABLE public.message_reactions     ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.pinned_messages       ALTER COLUMN pinned_by TYPE text USING pinned_by::text;

-- 3. Fix RLS policies that referenced auth.uid() (uuid) — now compare as text
-- Drop old policies
DROP POLICY IF EXISTS conv_select  ON public.conversations;
DROP POLICY IF EXISTS conv_insert  ON public.conversations;
DROP POLICY IF EXISTS conv_update  ON public.conversations;
DROP POLICY IF EXISTS part_select  ON public.conversation_participants;
DROP POLICY IF EXISTS part_insert  ON public.conversation_participants;
DROP POLICY IF EXISTS part_update  ON public.conversation_participants;
DROP POLICY IF EXISTS msg_select   ON public.messages;
DROP POLICY IF EXISTS msg_insert   ON public.messages;
DROP POLICY IF EXISTS msg_update   ON public.messages;
DROP POLICY IF EXISTS msg_delete   ON public.messages;
DROP POLICY IF EXISTS mention_select ON public.message_mentions;
DROP POLICY IF EXISTS mention_update ON public.message_mentions;
DROP POLICY IF EXISTS react_all    ON public.message_reactions;
DROP POLICY IF EXISTS pin_all      ON public.pinned_messages;

-- 4. Re-create RLS policies using text comparison
--    auth.uid()::text converts the Supabase auth UUID to text for comparison.
--    However, since the app uses custom auth (not Supabase auth), we use
--    service role for all writes — so keep policies permissive at service role
--    and use user_id text matching for reads.

-- CONVERSATIONS: allow if user is a participant (user_id stored as text)
CREATE POLICY conv_select ON public.conversations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()::text
  )
);
CREATE POLICY conv_insert ON public.conversations FOR INSERT WITH CHECK (
  conversations.created_by = auth.uid()::text
);
CREATE POLICY conv_update ON public.conversations FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()::text
      AND cp.role = 'admin'
  )
);

-- CONVERSATION PARTICIPANTS
CREATE POLICY part_select ON public.conversation_participants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp2
    WHERE cp2.conversation_id = conversation_participants.conversation_id
      AND cp2.user_id = auth.uid()::text
  )
);
CREATE POLICY part_insert ON public.conversation_participants FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_participants.conversation_id
      AND (
        c.conversation_type = 'direct'
        OR EXISTS (
          SELECT 1 FROM public.conversation_participants cp_admin
          WHERE cp_admin.conversation_id = c.id
            AND cp_admin.user_id = auth.uid()::text
            AND cp_admin.role = 'admin'
        )
      )
  )
);
CREATE POLICY part_update ON public.conversation_participants FOR UPDATE USING (
  conversation_participants.user_id = auth.uid()::text
);

-- MESSAGES
CREATE POLICY msg_select ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()::text
  )
);
CREATE POLICY msg_insert ON public.messages FOR INSERT WITH CHECK (
  messages.sender_id = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()::text
  )
);
CREATE POLICY msg_update ON public.messages FOR UPDATE USING (
  messages.sender_id = auth.uid()::text
);
CREATE POLICY msg_delete ON public.messages FOR UPDATE USING (
  messages.sender_id = auth.uid()::text
  AND messages.is_deleted = true
);

-- MENTIONS / REACTIONS / PINS
CREATE POLICY mention_select ON public.message_mentions FOR SELECT USING (
  message_mentions.mentioned_user_id = auth.uid()::text
);
CREATE POLICY mention_update ON public.message_mentions FOR UPDATE USING (
  message_mentions.mentioned_user_id = auth.uid()::text
);

CREATE POLICY react_all ON public.message_reactions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    JOIN public.messages m ON m.conversation_id = cp.conversation_id
    WHERE m.id = message_reactions.message_id
      AND cp.user_id = auth.uid()::text
  )
);

CREATE POLICY pin_all ON public.pinned_messages FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = pinned_messages.conversation_id
      AND cp.user_id = auth.uid()::text
  )
);

-- 5. Also fix last_read_message_id FK if it exists (messages.id is still uuid — keep as is)
-- The message ids remain uuid (uuid_generate_v4) — that's fine.

-- ============================================================
-- DONE: All user_id columns are now text.
-- Store the numeric user ID (e.g. "83") or ReferenceID as text.
-- ============================================================
