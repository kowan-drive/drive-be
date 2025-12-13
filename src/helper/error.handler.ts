import type { Context } from 'elysia';
import { AppError } from '../common/error';
import { errorResponse } from '../lib/response';

export const errorHandler = async (error: unknown, c: Context) => {
  if (error instanceof AppError) {
    return error.toResponse();
  }

  console.error('Unhandled error in handler:', error);

  return errorResponse({ message: 'Internal Server Error', status: 500 });
};
