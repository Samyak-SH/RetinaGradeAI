import User from '../models/User.js';
import { signToken } from '../utils/token.js';

export async function signup(req, res) {
  const { name, email, password, hospital } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'password must be at least 8 characters' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ message: 'an account with that email already exists' });

  const user = new User({ name, email, hospital: hospital || '' });
  await user.setPassword(password);
  await user.save();

  res.status(201).json({ token: signToken(user), user: user.toSafeJSON() });
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'email and password are required' });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !(await user.verifyPassword(password))) {
    return res.status(401).json({ message: 'invalid email or password' });
  }

  res.json({ token: signToken(user), user: user.toSafeJSON() });
}

export async function me(req, res) {
  res.json({ user: req.user.toSafeJSON() });
}
