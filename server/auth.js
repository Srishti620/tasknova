const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tasknova_secret_key_2024';

const createToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

module.exports = { createToken, verifyToken };
