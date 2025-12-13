import { errorResponse } from '../lib/response';

export class AppError extends Error {
  statusCode: number = 500;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }

  toResponse() {
    return errorResponse({
      message: this.message,
      status: this.statusCode,
    });
  }
}
