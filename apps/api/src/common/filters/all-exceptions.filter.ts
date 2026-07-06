import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

// Response ka standard shape — har error isi format mein jayega.
interface ErrorResponseBody {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
}

// @Catch() bina argument ke = HAR exception pakdo (global catch-all).
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  // Logger errors ko terminal mein record karta hai (debugging ke liye).
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Default: agar kuch pehchana nahi gaya to 500 (server error)
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    // --- Case 1: NestJS ke known HTTP errors ---
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        message = this.extractMessage(obj.message) ?? exception.message;
        error = (obj.error as string) ?? error;
      }
    }
    // --- Case 2: Prisma database errors ---
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaError(exception);
      statusCode = mapped.statusCode;
      message = mapped.message;
      error = mapped.error;
    }
    // --- Case 3: anjaan error — detail chhupao (security) ---
    else if (exception instanceof Error) {
      // Terminal mein poori detail log karo (developer ke liye),
      // lekin user ko sirf generic message do.
      this.logger.error(exception.message, exception.stack);
    }

    const body: ErrorResponseBody = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(statusCode).json(body);
  }

  // Prisma ke error codes ko user-friendly message mein badalta hai.
  private mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    message: string;
    error: string;
  } {
    switch (err.code) {
      // P2002 = unique constraint (jaise email pehle se maujood)
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'A record with this value already exists.',
          error: 'Conflict',
        };
      // P2025 = record not found
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'The requested record was not found.',
          error: 'Not Found',
        };
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'A database error occurred.',
          error: 'Bad Request',
        };
    }
  }

  // message array ya string dono ho sakta hai — handle dono.
  private extractMessage(msg: unknown): string | undefined {
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
    return undefined;
  }
}
