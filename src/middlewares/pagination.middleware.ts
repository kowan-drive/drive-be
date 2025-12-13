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

export const paginationMiddleware = () => {
  return async (c: any, next: () => Promise<void>) => {
    const url = new URL(c.request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;
    const search = url.searchParams.get('search') || '';

    (c as any).set?.('pagination', { page, limit, skip, search });

    await next();
  };
};
