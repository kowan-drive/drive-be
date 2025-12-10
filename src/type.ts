import { company, USER_ROLE } from '@prisma/client';
import { Pagination } from './middlewares/pagination.middleware';

export type authenticatedRoute = {
  Variables: {
    user: { id: string; email: string; role: USER_ROLE; company?: company };
    pagination?: Pagination;
  };
};
