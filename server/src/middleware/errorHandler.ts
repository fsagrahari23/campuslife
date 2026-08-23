import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler middleware.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Unhandled error:', err);

  if (err.message.includes('Invalid state transition')) {
    res.status(409).json({
      error: 'Conflict',
      message: err.message,
    });
    return;
  }

  if (err.message.includes('not found')) {
    res.status(404).json({
      error: 'Not Found',
      message: err.message,
    });
    return;
  }

  if (err.message.includes('already exists') || err.message.includes('duplicate')) {
    res.status(409).json({
      error: 'Conflict',
      message: err.message,
    });
    return;
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
  });
}
