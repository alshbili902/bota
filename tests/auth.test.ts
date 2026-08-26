import assert from 'node:assert';
import test from 'node:test';
import { MESSAGES } from '../src/config/constants.js';
import { env } from '../src/config/env.js';
import { authMiddleware, isUserAuthorized } from '../src/middleware/auth.js';
import { BotContext } from '../src/types/bot.js';

test('Authorization - isUserAuthorized function', () => {
  const [user1, user2] = Array.from(env.allowedUserIds);
  assert.strictEqual(isUserAuthorized(user1), true);
  assert.strictEqual(isUserAuthorized(user2), true);
  assert.strictEqual(isUserAuthorized(999999999), false);
  assert.strictEqual(isUserAuthorized(undefined), false);
  assert.strictEqual(isUserAuthorized(0), false);
});

test('Authorization Middleware - permits authorized users', async () => {
  let nextCalled = false;
  const [authorizedId] = Array.from(env.allowedUserIds);

  const mockCtx = {
    from: { id: authorizedId, username: 'authorized_user' },
    chat: { id: authorizedId },
    update: { update_id: 1, message: {} },
    reply: async () => {},
  } as unknown as BotContext;

  const next = async () => {
    nextCalled = true;
  };

  await authMiddleware(mockCtx, next);
  assert.strictEqual(nextCalled, true, 'Authorized user must be allowed through next()');
});

test('Authorization Middleware - blocks unauthorized users completely', async () => {
  let nextCalled = false;
  let replyText = '';

  const mockCtx = {
    from: { id: 999999999, username: 'hacker_user' },
    chat: { id: 999999999 },
    update: { update_id: 2, message: {} },
    reply: async (text: string) => {
      replyText = text;
    },
  } as unknown as BotContext;

  const next = async () => {
    nextCalled = true;
  };

  await authMiddleware(mockCtx, next);

  assert.strictEqual(nextCalled, false, 'Unauthorized user must NOT reach next()');
  assert.strictEqual(replyText, MESSAGES.UNAUTHORIZED);
});

test('Authorization Middleware - blocks unauthorized callback query', async () => {
  let nextCalled = false;
  let answerAlert = false;
  let answerText = '';

  const mockCtx = {
    from: { id: 888888888, username: 'unauthorized_clicker' },
    chat: { id: 888888888 },
    callbackQuery: { data: 'dl:123:best' },
    update: { update_id: 3, callback_query: {} },
    answerCallbackQuery: async (opts?: { text?: string; show_alert?: boolean }) => {
      answerText = opts?.text || '';
      answerAlert = opts?.show_alert || false;
    },
    reply: async () => {},
  } as unknown as BotContext;

  const next = async () => {
    nextCalled = true;
  };

  await authMiddleware(mockCtx, next);

  assert.strictEqual(nextCalled, false, 'Unauthorized callback must NOT proceed');
  assert.strictEqual(answerAlert, true, 'Must show alert for unauthorized callback');
  assert.strictEqual(answerText, MESSAGES.UNAUTHORIZED);
});
