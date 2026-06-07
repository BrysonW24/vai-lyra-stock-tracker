import { z } from 'zod';

const blankToUndefined = (value: unknown) => (value === '' ? undefined : value);

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(blankToUndefined, z.string().min(1).optional()),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
