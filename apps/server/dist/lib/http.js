import { ZodError } from 'zod';
export class ApiError extends Error {
    status;
    code;
    details;
    constructor(status, message, code, details) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
export const badRequest = (message, details) => new ApiError(400, message, 'BAD_REQUEST', details);
export const unauthorized = (message = 'Sign in required.') => new ApiError(401, message, 'UNAUTHORIZED');
export const forbidden = (message = 'You do not have access to this.') => new ApiError(403, message, 'FORBIDDEN');
export const notFound = (message = 'Not found.') => new ApiError(404, message, 'NOT_FOUND');
export const conflict = (message) => new ApiError(409, message, 'CONFLICT');
/** Wraps an async route so a rejected promise reaches the error middleware. */
export const route = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};
export function parse(schema, input) {
    const result = schema.safeParse(input);
    if (!result.success) {
        throw badRequest('Some fields need another look.', result.error.flatten());
    }
    return result.data;
}
export function errorHandler(error, _req, res, next) {
    if (res.headersSent)
        return next(error);
    if (error instanceof ApiError) {
        return res.status(error.status).json({
            error: error.message,
            code: error.code,
            details: error.details
        });
    }
    if (error instanceof ZodError) {
        return res
            .status(400)
            .json({ error: 'Some fields need another look.', code: 'BAD_REQUEST', details: error.flatten() });
    }
    console.error('[academy] unhandled error', error);
    return res.status(500).json({ error: 'Something broke on our side.', code: 'INTERNAL' });
}
//# sourceMappingURL=http.js.map