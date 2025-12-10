import { MiddlewareHandler } from 'hono';

export type Pagination = {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  count?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
};

export const paginationMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '10', 10);
    const skip = (page - 1) * limit;
    const search = c.req.query('search') || '';

    c.set('pagination', {
      page,
      limit,
      skip,
      search,
    } as Pagination);

    await next();
  };
};
