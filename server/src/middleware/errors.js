export function notFound(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'This page or Drop is unavailable.' } });
}

export function errorHandler(error, _req, res, _next) {
  if (error?.name === 'ZodError') {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Check the submitted details.', details: error.issues }
    });
  }

  if (error?.code === 11000) {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Please retry this request.' } });
  }

  const status = Number.isInteger(error?.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({
    error: {
      code: error?.code || 'INTERNAL_ERROR',
      message: status >= 500 ? 'Something went wrong. Please try again.' : error.message
    }
  });
}

export function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
