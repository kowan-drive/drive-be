type responseProps = {
  data?: any;
  message?: string;
  status?: number;
  pagination?: any;
};

export const successResponse = ({ data, message, status, pagination }: responseProps) => {
  return {
    status: status || 200,
    data,
    pagination: pagination || {},
    message: message || 'Operation Success',
    success: true,
    timestamp: new Date().toISOString(),
  };
};

export const errorResponse = ({ message, status }: responseProps) => {
  return {
    status: status || 500,
    message: message || 'Internal Server Error',
    success: false,
    timestamp: new Date().toISOString(),
  };
};
