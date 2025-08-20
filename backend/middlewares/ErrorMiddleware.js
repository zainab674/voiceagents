import ErrorHandler from "#utils/ErrorHandlerUtil.js";


export const errorMiddleware = (err, req, res, next) => {
    if (err instanceof ErrorHandler) {
        err.statusCode = err.statusCode;
        err.message = err.message;
    }

    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Internal Server Error";

    res.status(err.statusCode).json({
        success: false,
        message: err.message,
    });
};


