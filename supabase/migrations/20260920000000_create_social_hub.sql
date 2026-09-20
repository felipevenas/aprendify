-- Hub social: amizades, presença, mensagens, notificações e desafios de foco.
-- Todas as operações de escrita passam por RPCs autenticadas e as tabelas
-- continuam protegidas por RLS para manter a fronteira no banco.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  blocked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT friendships_different_users CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_unique_pair
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX IF NOT EXISTS friendships_requester_status_idx
  ON public.friendships (requester_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS friendships_addressee_status_idx
  ON public.friendships (addressee_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.friend_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT friend_messages_different_users CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS friend_messages_pair_created_idx
  ON public.friend_messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS friend_messages_recipient_unread_idx
  ON public.friend_messages (recipient_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.focus_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (15, 25, 50)),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'active', 'completed', 'expired', 'cancelled')),
  creator_completed_at TIMESTAMPTZ,
  invitee_completed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT focus_challenges_different_users CHECK (creator_id <> invitee_id)
);

CREATE INDEX IF NOT EXISTS focus_challenges_participants_idx
  ON public.focus_challenges (creator_id, invitee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS focus_challenges_status_idx
  ON public.focus_challenges (status, expires_at);

CREATE TABLE IF NOT EXISTS public.social_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('friend_request', 'friend_accepted', 'message', 'challenge_invite', 'challenge_update')),
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_notifications_recipient_idx
  ON public.social_notifications (recipient_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS public.social_rate_limits (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  calls_count INTEGER NOT NULL DEFAULT 0 CHECK (calls_count >= 0),
  PRIMARY KEY (user_id, action)
);

CREATE OR REPLACE FUNCTION public.social_is_friend(_left UUID, _right UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (_left = auth.uid() OR _right = auth.uid())
    AND EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE status = 'accepted'
      AND ((_left = requester_id AND _right = addressee_id)
        OR (_left = addressee_id AND _right = requester_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.consume_social_rate_limit(_action TEXT)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _limit INTEGER;
  _window_seconds INTEGER;
  _row public.social_rate_limits%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501';
  END IF;

  CASE _action
    WHEN 'search' THEN _limit := 30; _window_seconds := 300;
    WHEN 'friend_request' THEN _limit := 20; _window_seconds := 86400;
    WHEN 'message' THEN _limit := 60; _window_seconds := 60;
    WHEN 'challenge' THEN _limit := 20; _window_seconds := 3600;
    ELSE RAISE EXCEPTION 'Ação social inválida' USING ERRCODE = '22023';
  END CASE;

  INSERT INTO public.social_rate_limits (user_id, action)
  VALUES (_user_id, _action)
  ON CONFLICT (user_id, action) DO NOTHING;

  SELECT * INTO _row
  FROM public.social_rate_limits
  WHERE user_id = _user_id AND action = _action
  FOR UPDATE;

  IF _row.window_started_at + make_interval(secs => _window_seconds) <= now() THEN
    UPDATE public.social_rate_limits
    SET window_started_at = now(), calls_count = 0
    WHERE user_id = _user_id AND action = _action;
    _row.calls_count := 0;
  END IF;

  IF _row.calls_count >= _limit THEN
    RETURN FALSE;
  END IF;

  UPDATE public.social_rate_limits
  SET calls_count = calls_count + 1
  WHERE user_id = _user_id AND action = _action;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_search_users(_query TEXT)
RETURNS TABLE (id UUID, username TEXT, full_name TEXT)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized TEXT := lower(trim(COALESCE(_query, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501';
  END IF;
  IF char_length(_normalized) < 2 OR char_length(_normalized) > 80 THEN
    RETURN;
  END IF;
  IF NOT public.consume_social_rate_limit('search') THEN
    RAISE EXCEPTION 'Muitas buscas. Tente novamente em alguns instantes.' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT p.id, p.username, p.full_name
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND (
      (position('@' IN _normalized) > 0 AND lower(p.email) = _normalized)
      OR (position('@' IN _normalized) = 0 AND (
        lower(COALESCE(p.username, '')) LIKE _normalized || '%'
        OR lower(COALESCE(p.full_name, '')) LIKE _normalized || '%'
      ))
    )
  ORDER BY lower(COALESCE(p.full_name, p.username, ''))
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_list_friends()
RETURNS TABLE (
  friendship_id UUID,
  user_id UUID,
  username TEXT,
  full_name TEXT,
  is_online BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END,
    p.username,
    p.full_name,
    COALESCE(p.show_online_status, true)
      AND COALESCE(up.is_online, false)
      AND up.last_seen_at > now() - INTERVAL '90 seconds',
    f.created_at
  FROM public.friendships f
  JOIN public.profiles p
    ON p.id = CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
  LEFT JOIN public.user_presence up ON up.user_id = p.id
  WHERE f.status = 'accepted'
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
  ORDER BY is_online DESC, lower(COALESCE(p.full_name, p.username, ''));
$$;

CREATE OR REPLACE FUNCTION public.social_list_requests(_incoming BOOLEAN DEFAULT TRUE)
RETURNS TABLE (
  friendship_id UUID,
  user_id UUID,
  username TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    CASE WHEN _incoming THEN f.requester_id ELSE f.addressee_id END,
    p.username,
    p.full_name,
    f.created_at
  FROM public.friendships f
  JOIN public.profiles p
    ON p.id = CASE WHEN _incoming THEN f.requester_id ELSE f.addressee_id END
  WHERE f.status = 'pending'
    AND ((_incoming AND f.addressee_id = auth.uid()) OR (NOT _incoming AND f.requester_id = auth.uid()))
  ORDER BY f.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.social_send_friend_request(_target_user_id UUID)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor UUID := auth.uid();
  _friendship public.friendships%ROWTYPE;
  _id UUID;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501'; END IF;
  IF _target_user_id IS NULL OR _target_user_id = _actor THEN
    RAISE EXCEPTION 'Não é possível adicionar este usuário.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.consume_social_rate_limit('friend_request') THEN
    RAISE EXCEPTION 'Limite de solicitações atingido. Tente novamente mais tarde.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO _friendship
  FROM public.friendships
  WHERE (requester_id = _actor AND addressee_id = _target_user_id)
     OR (requester_id = _target_user_id AND addressee_id = _actor)
  FOR UPDATE;

  IF _friendship.status = 'accepted' THEN
    RAISE EXCEPTION 'Vocês já são amigos.' USING ERRCODE = '23505';
  END IF;
  IF _friendship.status = 'pending' THEN
    RAISE EXCEPTION 'Já existe uma solicitação pendente.' USING ERRCODE = '23505';
  END IF;
  IF _friendship.status = 'blocked' THEN
    RAISE EXCEPTION 'Esta conexão não está disponível.' USING ERRCODE = '42501';
  END IF;

  IF _friendship.id IS NULL THEN
    INSERT INTO public.friendships (requester_id, addressee_id)
    VALUES (_actor, _target_user_id)
    RETURNING id INTO _id;
  ELSE
    UPDATE public.friendships
    SET requester_id = _actor, addressee_id = _target_user_id,
        status = 'pending', blocked_by = NULL, responded_at = NULL, updated_at = now()
    WHERE id = _friendship.id
    RETURNING id INTO _id;
  END IF;

  INSERT INTO public.social_notifications (recipient_id, actor_id, notification_type, entity_id, metadata)
  VALUES (_target_user_id, _actor, 'friend_request', _id, jsonb_build_object('friendship_id', _id));
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_respond_friend_request(_friendship_id UUID, _accept BOOLEAN)
RETURNS TEXT
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _friendship public.friendships%ROWTYPE;
  _status TEXT := CASE WHEN _accept THEN 'accepted' ELSE 'declined' END;
BEGIN
  SELECT * INTO _friendship FROM public.friendships
  WHERE id = _friendship_id AND addressee_id = auth.uid() AND status = 'pending'
  FOR UPDATE;
  IF _friendship.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada.' USING ERRCODE = 'P0002'; END IF;

  UPDATE public.friendships SET status = _status, responded_at = now(), updated_at = now()
  WHERE id = _friendship_id;

  IF _accept THEN
    INSERT INTO public.social_notifications (recipient_id, actor_id, notification_type, entity_id, metadata)
    VALUES (_friendship.requester_id, auth.uid(), 'friend_accepted', _friendship_id, jsonb_build_object('friendship_id', _friendship_id));
  END IF;
  RETURN _status;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_cancel_friend_request(_friendship_id UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.friendships
  WHERE id = _friendship_id AND requester_id = auth.uid() AND status = 'pending';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_remove_friend(_friendship_id UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.friendships
  WHERE id = _friendship_id AND status = 'accepted'
    AND (requester_id = auth.uid() OR addressee_id = auth.uid());
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_block_user(_target_user_id UUID)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor UUID := auth.uid();
  _id UUID;
BEGIN
  IF _actor IS NULL OR _target_user_id IS NULL OR _actor = _target_user_id THEN
    RAISE EXCEPTION 'Usuário inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO _id FROM public.friendships
  WHERE (requester_id = _actor AND addressee_id = _target_user_id)
     OR (requester_id = _target_user_id AND addressee_id = _actor)
  FOR UPDATE;

  IF _id IS NULL THEN
    INSERT INTO public.friendships (requester_id, addressee_id, status, blocked_by, responded_at)
    VALUES (_actor, _target_user_id, 'blocked', _actor, now())
    RETURNING id INTO _id;
  ELSE
    UPDATE public.friendships SET status = 'blocked', blocked_by = _actor, responded_at = now(), updated_at = now()
    WHERE id = _id;
  END IF;

  DELETE FROM public.social_notifications
  WHERE (recipient_id = _actor AND actor_id = _target_user_id)
     OR (recipient_id = _target_user_id AND actor_id = _actor);
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_list_messages(_friend_id UUID)
RETURNS TABLE (id UUID, sender_id UUID, recipient_id UUID, body TEXT, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.sender_id, m.recipient_id, m.body, m.read_at, m.created_at
  FROM public.friend_messages m
  WHERE public.social_is_friend(auth.uid(), _friend_id)
    AND ((m.sender_id = auth.uid() AND m.recipient_id = _friend_id)
      OR (m.sender_id = _friend_id AND m.recipient_id = auth.uid()))
  ORDER BY m.created_at ASC
  LIMIT 200;
$$;

CREATE OR REPLACE FUNCTION public.social_send_message(_recipient_id UUID, _body TEXT)
RETURNS public.friend_messages
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _message public.friend_messages;
  _clean_body TEXT := trim(COALESCE(_body, ''));
BEGIN
  IF auth.uid() IS NULL OR char_length(_clean_body) = 0 OR char_length(_clean_body) > 1000 THEN
    RAISE EXCEPTION 'Mensagem inválida.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.social_is_friend(auth.uid(), _recipient_id) THEN
    RAISE EXCEPTION 'A conversa exige uma amizade aceita.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.consume_social_rate_limit('message') THEN
    RAISE EXCEPTION 'Você está enviando mensagens rápido demais.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.friend_messages (sender_id, recipient_id, body)
  VALUES (auth.uid(), _recipient_id, _clean_body)
  RETURNING * INTO _message;

  INSERT INTO public.social_notifications (recipient_id, actor_id, notification_type, entity_id, metadata)
  VALUES (_recipient_id, auth.uid(), 'message', _message.id, jsonb_build_object('friend_id', auth.uid()));
  RETURN _message;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_mark_messages_read(_friend_id UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.friend_messages
    SET read_at = now()
    WHERE recipient_id = auth.uid() AND sender_id = _friend_id AND read_at IS NULL
    RETURNING id
  )
  SELECT count(*)::INTEGER FROM updated;
$$;

CREATE OR REPLACE FUNCTION public.social_set_presence(_is_online BOOLEAN)
RETURNS public.user_presence
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _presence public.user_presence;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.user_presence (user_id, is_online, last_seen_at, updated_at)
  VALUES (auth.uid(), COALESCE(_is_online, true), now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET is_online = COALESCE(_is_online, true), last_seen_at = now(), updated_at = now()
  RETURNING * INTO _presence;
  RETURN _presence;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_create_focus_challenge(_friend_id UUID, _duration_minutes INTEGER)
RETURNS public.focus_challenges
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _challenge public.focus_challenges;
BEGIN
  IF _duration_minutes NOT IN (15, 25, 50) OR NOT public.social_is_friend(auth.uid(), _friend_id) THEN
    RAISE EXCEPTION 'Desafio inválido.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.consume_social_rate_limit('challenge') THEN
    RAISE EXCEPTION 'Limite de desafios atingido. Tente novamente mais tarde.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.focus_challenges (creator_id, invitee_id, duration_minutes)
  VALUES (auth.uid(), _friend_id, _duration_minutes)
  RETURNING * INTO _challenge;

  INSERT INTO public.social_notifications (recipient_id, actor_id, notification_type, entity_id, metadata)
  VALUES (_friend_id, auth.uid(), 'challenge_invite', _challenge.id, jsonb_build_object('challenge_id', _challenge.id));
  RETURN _challenge;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_get_focus_challenge(_challenge_id UUID)
RETURNS TABLE (
  id UUID, creator_id UUID, invitee_id UUID, duration_minutes INTEGER, status TEXT,
  creator_completed_at TIMESTAMPTZ, invitee_completed_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ,
  creator_name TEXT, invitee_name TEXT
)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.focus_challenges
  SET status = 'expired', updated_at = now()
  WHERE id = _challenge_id AND status IN ('pending', 'accepted') AND expires_at <= now();

  RETURN QUERY
  SELECT c.id, c.creator_id, c.invitee_id, c.duration_minutes, c.status,
    c.creator_completed_at, c.invitee_completed_at, c.accepted_at, c.started_at,
    c.completed_at, c.expires_at, c.created_at,
    COALESCE(cp.full_name, cp.username, 'Estudante'),
    COALESCE(ip.full_name, ip.username, 'Estudante')
  FROM public.focus_challenges c
  JOIN public.profiles cp ON cp.id = c.creator_id
  JOIN public.profiles ip ON ip.id = c.invitee_id
  WHERE c.id = _challenge_id AND (c.creator_id = auth.uid() OR c.invitee_id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.social_update_focus_challenge(_challenge_id UUID, _action TEXT)
RETURNS public.focus_challenges
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _challenge public.focus_challenges;
BEGIN
  SELECT * INTO _challenge FROM public.focus_challenges
  WHERE id = _challenge_id AND (creator_id = auth.uid() OR invitee_id = auth.uid())
  FOR UPDATE;
  IF _challenge.id IS NULL THEN RAISE EXCEPTION 'Desafio não encontrado.' USING ERRCODE = 'P0002'; END IF;

  IF _challenge.status IN ('pending', 'accepted') AND _challenge.expires_at <= now() THEN
    UPDATE public.focus_challenges
    SET status = 'expired', updated_at = now()
    WHERE id = _challenge_id;
    RAISE EXCEPTION 'Este desafio expirou.' USING ERRCODE = '22023';
  END IF;

  IF _action = 'accept' AND auth.uid() = _challenge.invitee_id AND _challenge.status = 'pending' THEN
    UPDATE public.focus_challenges SET status = 'accepted', accepted_at = now(), updated_at = now() WHERE id = _challenge_id;
  ELSIF _action = 'decline' AND auth.uid() = _challenge.invitee_id AND _challenge.status = 'pending' THEN
    UPDATE public.focus_challenges SET status = 'declined', updated_at = now() WHERE id = _challenge_id;
  ELSIF _action = 'cancel' AND auth.uid() = _challenge.creator_id AND _challenge.status IN ('pending', 'accepted') THEN
    UPDATE public.focus_challenges SET status = 'cancelled', updated_at = now() WHERE id = _challenge_id;
  ELSIF _action = 'start' AND _challenge.status = 'accepted' THEN
    UPDATE public.focus_challenges SET status = 'active', started_at = COALESCE(started_at, now()), updated_at = now() WHERE id = _challenge_id;
  ELSIF _action = 'complete' AND _challenge.status IN ('accepted', 'active') THEN
    UPDATE public.focus_challenges
    SET status = CASE
      WHEN (auth.uid() = creator_id AND invitee_completed_at IS NOT NULL)
        OR (auth.uid() = invitee_id AND creator_completed_at IS NOT NULL)
      THEN 'completed' ELSE 'active' END,
      creator_completed_at = CASE WHEN auth.uid() = creator_id THEN now() ELSE creator_completed_at END,
      invitee_completed_at = CASE WHEN auth.uid() = invitee_id THEN now() ELSE invitee_completed_at END,
      completed_at = CASE
        WHEN (auth.uid() = creator_id AND invitee_completed_at IS NOT NULL)
          OR (auth.uid() = invitee_id AND creator_completed_at IS NOT NULL)
        THEN now() ELSE completed_at END,
      updated_at = now()
    WHERE id = _challenge_id;
  ELSE
    RAISE EXCEPTION 'Transição de desafio inválida.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _challenge FROM public.focus_challenges WHERE id = _challenge_id;
  INSERT INTO public.social_notifications (recipient_id, actor_id, notification_type, entity_id, metadata)
  VALUES (
    CASE WHEN _challenge.creator_id = auth.uid() THEN _challenge.invitee_id ELSE _challenge.creator_id END,
    auth.uid(), 'challenge_update', _challenge.id, jsonb_build_object('challenge_id', _challenge.id, 'status', _challenge.status)
  );
  RETURN _challenge;
END;
$$;

CREATE OR REPLACE FUNCTION public.social_list_notifications()
RETURNS TABLE (
  id UUID, actor_id UUID, actor_name TEXT, notification_type TEXT, entity_id UUID,
  metadata JSONB, read_at TIMESTAMPTZ, created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.id, n.actor_id, COALESCE(p.full_name, p.username, 'Estudante'),
    n.notification_type, n.entity_id, n.metadata, n.read_at, n.created_at
  FROM public.social_notifications n
  LEFT JOIN public.profiles p ON p.id = n.actor_id
  WHERE n.recipient_id = auth.uid()
  ORDER BY n.created_at DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.social_mark_notification_read(_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.social_notifications
  SET read_at = COALESCE(read_at, now())
  WHERE id = _notification_id AND recipient_id = auth.uid()
  RETURNING TRUE;
$$;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.friendships, public.friend_messages, public.user_presence,
  public.focus_challenges, public.social_notifications, public.social_rate_limits
  FROM anon, authenticated;
GRANT SELECT ON public.friendships, public.friend_messages, public.user_presence,
  public.focus_challenges, public.social_notifications TO authenticated;

CREATE POLICY "Social participants can view friendships"
  ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Friends can view messages"
  ON public.friend_messages FOR SELECT TO authenticated
  USING (
    (auth.uid() = sender_id OR auth.uid() = recipient_id)
    AND public.social_is_friend(sender_id, recipient_id)
  );

CREATE POLICY "Friends can view presence"
  ON public.user_presence FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (public.social_is_friend(auth.uid(), user_id)
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.show_online_status = true))
  );

CREATE POLICY "Challenge participants can view challenges"
  ON public.focus_challenges FOR SELECT TO authenticated
  USING (auth.uid() = creator_id OR auth.uid() = invitee_id);

CREATE POLICY "Recipients can view social notifications"
  ON public.social_notifications FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "Recipients can update social notifications"
  ON public.social_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE OR REPLACE FUNCTION public.social_touch_updated_at()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friendships_updated_at ON public.friendships;
CREATE TRIGGER friendships_updated_at BEFORE UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();
DROP TRIGGER IF EXISTS user_presence_updated_at ON public.user_presence;
CREATE TRIGGER user_presence_updated_at BEFORE UPDATE ON public.user_presence
FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();
DROP TRIGGER IF EXISTS focus_challenges_updated_at ON public.focus_challenges;
CREATE TRIGGER focus_challenges_updated_at BEFORE UPDATE ON public.focus_challenges
FOR EACH ROW EXECUTE FUNCTION public.social_touch_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'friendships') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'friend_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_presence') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'focus_challenges') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.focus_challenges;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'social_notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_notifications;
  END IF;
END;
$$;

ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER TABLE public.friend_messages REPLICA IDENTITY FULL;
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;
ALTER TABLE public.focus_challenges REPLICA IDENTITY FULL;
ALTER TABLE public.social_notifications REPLICA IDENTITY FULL;

REVOKE ALL ON FUNCTION public.social_is_friend(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_social_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_search_users(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_list_friends() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_list_requests(BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_send_friend_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_respond_friend_request(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_cancel_friend_request(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_remove_friend(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_block_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_list_messages(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_send_message(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_mark_messages_read(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_set_presence(BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_create_focus_challenge(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_get_focus_challenge(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_update_focus_challenge(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_list_notifications() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.social_mark_notification_read(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.social_search_users(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_is_friend(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_list_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_list_requests(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_send_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_respond_friend_request(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_cancel_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_remove_friend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_block_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_list_messages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_send_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_mark_messages_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_set_presence(BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_create_focus_challenge(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_get_focus_challenge(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_update_focus_challenge(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_list_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_mark_notification_read(UUID) TO authenticated;
