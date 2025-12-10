import prisma from '../../../prisma/prisma';
import { getQuotaLimit, formatBytes } from '../../lib/encryption';
import type { Tier } from '@prisma/client';

/**
 * Get available subscription tiers
 */
export async function getTiers() {
    const tiers = [
        {
            name: 'FREE',
            quota: getQuotaLimit('FREE'),
            quotaFormatted: formatBytes(getQuotaLimit('FREE')),
            price: 0,
            features: [
                '50 MB storage',
                'Basic file management',
                'Secure encryption',
                'WebAuthn login',
            ],
        },
        {
            name: 'PRO',
            quota: getQuotaLimit('PRO'),
            quotaFormatted: formatBytes(getQuotaLimit('PRO')),
            price: 4.99,
            features: [
                '500 MB storage',
                'Advanced file management',
                'Secure encryption',
                'WebAuthn login',
                'Priority support',
            ],
        },
        {
            name: 'PREMIUM',
            quota: getQuotaLimit('PREMIUM'),
            quotaFormatted: formatBytes(getQuotaLimit('PREMIUM')),
            price: 9.99,
            features: [
                '1 GB storage',
                'Advanced file management',
                'Secure encryption',
                'WebAuthn login',
                'Priority support',
                'Extended file retention',
            ],
        },
    ];

    return tiers;
}

/**
 * Upgrade user's subscription tier
 */
export async function upgradeTier(userId: string, newTier: Tier) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        throw new Error('User not found');
    }

    const oldTier = user.tier;

    // Prevent downgrade if it would exceed new quota
    const newQuota = getQuotaLimit(newTier);
    if (user.storageUsed > newQuota) {
        throw new Error(
            `Cannot downgrade: current usage (${formatBytes(user.storageUsed)}) exceeds new tier quota (${formatBytes(newQuota)}). Please delete some files first.`,
        );
    }

    // Update user tier
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { tier: newTier },
    });

    // Record tier change in history
    await prisma.subscriptionHistory.create({
        data: {
            userId,
            fromTier: oldTier,
            toTier: newTier,
        },
    });

    return {
        tier: updatedUser.tier,
        quota: getQuotaLimit(newTier),
        quotaFormatted: formatBytes(getQuotaLimit(newTier)),
        storageUsed: updatedUser.storageUsed,
        storageUsedFormatted: formatBytes(updatedUser.storageUsed),
    };
}

/**
 * Get user's current storage usage and quota
 */
export async function getUsage(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        throw new Error('User not found');
    }

    const quota = getQuotaLimit(user.tier);
    const usagePercentage = Number((user.storageUsed * BigInt(100)) / quota);

    return {
        tier: user.tier,
        storageUsed: user.storageUsed.toString(),
        storageUsedFormatted: formatBytes(user.storageUsed),
        quota: quota.toString(),
        quotaFormatted: formatBytes(quota),
        usagePercentage,
        remaining: (quota - user.storageUsed).toString(),
        remainingFormatted: formatBytes(quota - user.storageUsed),
    };
}

/**
 * Get user's subscription history
 */
export async function getSubscriptionHistory(userId: string) {
    const history = await prisma.subscriptionHistory.findMany({
        where: { userId },
        orderBy: { changedAt: 'desc' },
        take: 10,
    });

    return history;
}
