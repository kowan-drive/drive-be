import type { Context } from 'elysia';
import { errorResponse } from '../lib/response';

export async function notFoundHandler(c: Context) {
  return errorResponse({ message: 'Route not found', status: 404 });
}
