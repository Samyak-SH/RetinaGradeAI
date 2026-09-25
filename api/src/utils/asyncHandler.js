/** Express 4 does not forward rejected promises, so wrap every async handler. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
