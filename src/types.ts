import { t } from 'elysia';

export const PaginationQuery = t.Object({
  page: t.Number({
    default: 1,
  }),
  limit: t.Number({
    default: 10,
  }),
  skip: t.Number({
    default: 0,
  }),
  search: t.Optional(t.String()),
});

export type PaginationQueryType = typeof PaginationQuery.static;

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
