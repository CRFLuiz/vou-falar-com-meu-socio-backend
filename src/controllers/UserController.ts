import { Request, Response } from 'express';
import User from '../models/User';

const toUserSafeJson = (user: User) => {
  const { password_hash, ...userWithoutPassword } = user.toJSON();
  return userWithoutPassword;
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user: toUserSafeJson(user) });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateUserProfileById = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const id = Number(rawId);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const rawBody: unknown = req.body;
    const name =
      rawBody && typeof rawBody === 'object' && 'name' in rawBody && typeof (rawBody as { name?: unknown }).name === 'string'
        ? (rawBody as { name: string }).name.trim()
        : '';
    const professionalTitle =
      rawBody &&
      typeof rawBody === 'object' &&
      'professional_title' in rawBody &&
      typeof (rawBody as { professional_title?: unknown }).professional_title === 'string'
        ? (rawBody as { professional_title: string }).professional_title.trim()
        : '';
    const professionalDescription =
      rawBody &&
      typeof rawBody === 'object' &&
      'professional_description' in rawBody &&
      typeof (rawBody as { professional_description?: unknown }).professional_description === 'string'
        ? (rawBody as { professional_description: string }).professional_description.trim()
        : '';

    if (!name || !professionalTitle || !professionalDescription) {
      return res.status(400).json({
        message: 'Name, professional_title and professional_description are required',
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = name;
    user.professional_title = professionalTitle;
    user.professional_description = professionalDescription;
    await user.save();

    return res.status(200).json({ user: toUserSafeJson(user) });
  } catch (error) {
    console.error('Update user profile error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

