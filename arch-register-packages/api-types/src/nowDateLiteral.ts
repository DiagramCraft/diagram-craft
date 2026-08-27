import { z } from 'zod';

export const nowDateLiteralSchema = z.object({
  $now: z.literal(true),
  offsetDays: z.number().int().finite().optional()
});

export type NowDateLiteral = z.infer<typeof nowDateLiteralSchema>;

export const isNowDateLiteral = (value: unknown): value is NowDateLiteral =>
  nowDateLiteralSchema.safeParse(value).success;
