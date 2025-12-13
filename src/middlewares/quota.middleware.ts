import type { Context } from 'elysia';
import { getQuotaLimit } from '../lib/encryption';
import { errorResponse } from '../lib/response';

export function quotaMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    const user = (c as any).get?.('user');

    if (!user) {
      return errorResponse({ message: 'User not authenticated', status: 401 });
    }

    const form = await c.request.formData();
    const file = form.get('file') as any;

    if (!file) {
      return errorResponse({ message: 'No file provided', status: 400 });
    }

    const fileSize = BigInt(file.size);
    const quotaLimit = getQuotaLimit(user.tier as 'FREE' | 'PRO' | 'PREMIUM');
    const newTotalUsage = BigInt(user.storageUsed) + fileSize;

    if (newTotalUsage > quotaLimit) {
      return errorResponse({ message: 'Storage quota exceeded', status: 403 });
    }

    (c as any).set?.('uploadFile', file);
    (c as any).set?.('fileSize', fileSize);

    await next();
  };
}
