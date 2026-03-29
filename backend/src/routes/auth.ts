import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.post('/login', validate([
  { field: 'username', required: true, maxLength: 100 },
  { field: 'password', required: true, maxLength: 200 },
]), asyncHandler(async (req, res) => {
  const { username, password } = req.body as { username: string; password: string };

  if (username !== config.auth.username) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, config.auth.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { username: config.auth.username },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn },
  );

  res.json({ token, expiresIn: config.auth.jwtExpiresIn });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user!.username });
});

export default router;
