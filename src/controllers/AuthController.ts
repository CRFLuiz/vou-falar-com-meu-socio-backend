import { Request, Response } from 'express';
import User from '../models/User';

const isValidEmail = (email: string) => {
  const trimmed = email.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

const isSequelizeValidationError = (error: unknown) =>
  Boolean(error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'SequelizeValidationError');

const isEmailValidationError = (error: unknown) => {
  if (!isSequelizeValidationError(error)) return false;
  const errors = (error as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return false;

  return errors.some((err) => {
    if (!err || typeof err !== 'object') return false;
    const validatorKey = 'validatorKey' in err ? (err as { validatorKey?: unknown }).validatorKey : undefined;
    const path = 'path' in err ? (err as { path?: unknown }).path : undefined;
    return validatorKey === 'isEmail' || path === 'email';
  });
};

export const signup = async (req: Request, res: Response) => {
  try {
    const rawBody: unknown = req.body;
    const email =
      rawBody && typeof rawBody === 'object' && 'email' in rawBody && typeof (rawBody as { email?: unknown }).email === 'string'
        ? (rawBody as { email: string }).email.trim()
        : '';
    const password =
      rawBody && typeof rawBody === 'object' && 'password' in rawBody && typeof (rawBody as { password?: unknown }).password === 'string'
        ? (rawBody as { password: string }).password
        : '';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    // Password hashing is handled in the User model hook
    const newUser = await User.create({
      email,
      password_hash: password, // The hook will hash this
    });

    const { password_hash, ...userWithoutPassword } = newUser.toJSON();

    return res.status(201).json({
      message: 'User created successfully',
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (isEmailValidationError(error)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    if (isSequelizeValidationError(error)) {
      return res.status(400).json({ message: 'Invalid input' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const rawBody: unknown = req.body;
    const email =
      rawBody && typeof rawBody === 'object' && 'email' in rawBody && typeof (rawBody as { email?: unknown }).email === 'string'
        ? (rawBody as { email: string }).email.trim()
        : '';
    const password =
      rawBody && typeof rawBody === 'object' && 'password' in rawBody && typeof (rawBody as { password?: unknown }).password === 'string'
        ? (rawBody as { password: string }).password
        : '';

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const { password_hash, ...userWithoutPassword } = user.toJSON();

    return res.status(200).json({
      message: 'Login successful',
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    if (isEmailValidationError(error)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    if (isSequelizeValidationError(error)) {
      return res.status(400).json({ message: 'Invalid input' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
};
