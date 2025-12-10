import { z } from 'zod';

// Get Tiers Schema
export const getTiersSchema = z.object({
    // No params needed
});

// Upgrade Tier Schema
export const upgradeTierSchema = z.object({
    tier: z.enum(['FREE', 'PRO', 'PREMIUM']),
});

// Get Usage Schema
export const getUsageSchema = z.object({
    // No params needed
});
