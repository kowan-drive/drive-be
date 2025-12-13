import { z } from 'zod';

export const upgradeTierSchema = z.object({
  tier: z.enum(['FREE', 'PRO', 'PREMIUM']),
});
