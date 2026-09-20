import assert from "node:assert/strict";
import test from "node:test";
import {
  canRunFriendshipAction,
  canRunChallengeAction,
  canSendFriendRequest,
  countUnreadMessages,
  countUnreadSocialNotifications,
  getSocialDisplayName,
  getSocialInitials,
  isPresenceOnline,
  normalizeSocialQuery,
  PRESENCE_TIMEOUT_MS,
} from "./socialUtils.ts";

test("normaliza buscas sociais e limita a entrada", () => {
  assert.equal(normalizeSocialQuery("  Ana   Souza  "), "Ana Souza");
  assert.equal(normalizeSocialQuery("a".repeat(100)).length, 80);
});

test("impede amizade consigo mesmo e relações duplicadas", () => {
  assert.equal(canSendFriendRequest("user-a", "user-a"), false);
  assert.equal(canSendFriendRequest("user-a", "user-b", "pending"), false);
  assert.equal(canSendFriendRequest("user-a", "user-b", "accepted"), false);
  assert.equal(canSendFriendRequest("user-a", "user-b", "declined"), true);
});

test("classifica transições válidas de amizade", () => {
  assert.equal(canRunFriendshipAction("pending", "accept"), true);
  assert.equal(canRunFriendshipAction("pending", "remove"), false);
  assert.equal(canRunFriendshipAction("accepted", "remove"), true);
  assert.equal(canRunFriendshipAction("blocked", "block"), false);
});

test("gera nome e iniciais seguras para perfis incompletos", () => {
  assert.equal(getSocialDisplayName(null, "ana.souza"), "ana.souza");
  assert.equal(getSocialInitials("Ana Souza", null), "AS");
  assert.equal(getSocialInitials(null, null), "ES");
});

test("considera presença online apenas dentro da janela de heartbeat", () => {
  const now = Date.now();
  assert.equal(isPresenceOnline(true, new Date(now - PRESENCE_TIMEOUT_MS + 1_000).toISOString(), now), true);
  assert.equal(isPresenceOnline(true, new Date(now - PRESENCE_TIMEOUT_MS - 1_000).toISOString(), now), false);
  assert.equal(isPresenceOnline(false, new Date(now).toISOString(), now), false);
});

test("aceita somente transições válidas de desafio", () => {
  assert.equal(canRunChallengeAction("pending", "accept"), true);
  assert.equal(canRunChallengeAction("pending", "start"), false);
  assert.equal(canRunChallengeAction("accepted", "start"), true);
  assert.equal(canRunChallengeAction("active", "complete"), true);
  assert.equal(canRunChallengeAction("completed", "complete"), false);
});

test("conta mensagens e notificações não lidas apenas do usuário atual", () => {
  assert.equal(countUnreadMessages([
    { recipientId: "user-a", readAt: null },
    { recipientId: "user-a", readAt: "2026-09-20T10:00:00Z" },
    { recipientId: "user-b", readAt: null },
  ], "user-a"), 1);
  assert.equal(countUnreadSocialNotifications([{ readAt: null }, { readAt: "2026-09-20T10:00:00Z" }]), 1);
});
