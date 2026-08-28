const jwt = require("jsonwebtoken");

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// Express middleware — requires a valid auth cookie
function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please log in again." });
  }
}

module.exports = { signToken, verifyToken, requireAuth };
