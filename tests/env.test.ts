import assert from 'node:assert';
import test from 'node:test';
import { z } from 'zod';

const testEnvSchema = z.object({
  ALLOWED_USERS: z
    .string()
    .min(1, 'ALLOWED_USERS is required')
    .transform((val, ctx) => {
      const parts = val
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p) => {
          const num = Number(p);
          if (isNaN(num) || num <= 0 || !Number.isSafeInteger(num)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid Telegram User ID: "${p}". Must be a positive integer.`,
            });
            return z.NEVER;
          }
          return num;
        });

      if (parts.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `ALLOWED_USERS must contain EXACTLY TWO comma-separated Telegram User IDs. Found: ${parts.length}`,
        });
        return z.NEVER;
      }
      return parts as [number, number];
    }),
});

test('Env Validation - ALLOWED_USERS strictly enforces exactly two valid IDs', () => {
  // Valid two user IDs
  const valid = testEnvSchema.safeParse({ ALLOWED_USERS: '123456789,987654321' });
  assert.strictEqual(valid.success, true);
  if (valid.success) {
    assert.deepStrictEqual(valid.data.ALLOWED_USERS, [123456789, 987654321]);
  }

  // Only one user ID -> must fail
  const single = testEnvSchema.safeParse({ ALLOWED_USERS: '123456789' });
  assert.strictEqual(single.success, false);

  // Three user IDs -> must fail
  const three = testEnvSchema.safeParse({ ALLOWED_USERS: '111,222,333' });
  assert.strictEqual(three.success, false);

  // Non-numeric user ID -> must fail
  const invalid = testEnvSchema.safeParse({ ALLOWED_USERS: '111,abc' });
  assert.strictEqual(invalid.success, false);

  // Negative ID -> must fail
  const negative = testEnvSchema.safeParse({ ALLOWED_USERS: '111,-222' });
  assert.strictEqual(negative.success, false);
});
