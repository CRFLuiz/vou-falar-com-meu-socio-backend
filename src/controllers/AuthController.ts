import { Request, Response } from 'express';
import User from '../models/User';

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
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
    return res.status(500).json({ message: 'Internal server error' });
  }
};
