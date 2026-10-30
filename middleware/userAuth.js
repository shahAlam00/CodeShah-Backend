import jwt from "jsonwebtoken";

export const userAuth = (req, res, next) => {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);



    req.userId = decoded.id;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }
};

/**
 * Optional auth — decodes the JWT if a token is present and sets req.userId,
 * but does NOT block the request when no token (or an invalid token) is sent.
 * Use this on public routes that still want per-user data (e.g. problem list
 * with isSolved flags) without forcing the visitor to log in.
 */
export const optionalAuth = (req, res, next) => {
  try {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.split(" ")[1];

    if (!token) return next();          // not logged in — continue without userId

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
  } catch (error) {
    // invalid / expired token — just continue without userId
  }
  next();
};