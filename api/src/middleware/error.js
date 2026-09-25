export function notFound(req, res) {
  res.status(404).json({ message: `no route for ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, _next) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'internal server error' });
}
