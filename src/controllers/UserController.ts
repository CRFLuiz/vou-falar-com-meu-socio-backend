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

    const parseNumber = (value: unknown) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const hasRate = Boolean(rawBody && typeof rawBody === 'object' && 'rate' in rawBody);
    const hasHoursPerDay = Boolean(rawBody && typeof rawBody === 'object' && 'hours_per_day' in rawBody);
    const hasDaysPerWeek = Boolean(rawBody && typeof rawBody === 'object' && 'days_per_week' in rawBody);
    const hasLevel = Boolean(rawBody && typeof rawBody === 'object' && 'level' in rawBody);

    const rate = hasRate ? parseNumber((rawBody as { rate?: unknown }).rate) : null;
    const hoursPerDay = hasHoursPerDay ? parseNumber((rawBody as { hours_per_day?: unknown }).hours_per_day) : null;
    const daysPerWeek = hasDaysPerWeek ? parseNumber((rawBody as { days_per_week?: unknown }).days_per_week) : null;

    const rawLevel =
      hasLevel && typeof (rawBody as { level?: unknown }).level === 'string' ? ((rawBody as { level: string }).level ?? '').trim() : '';
    const normalizedLevel = rawLevel.length === 0 ? null : rawLevel.toLowerCase();

    if (hasRate && rate !== null && rate <= 0) {
      return res.status(400).json({ message: 'Invalid rate' });
    }
    if (hasHoursPerDay && hoursPerDay !== null && (hoursPerDay <= 0 || hoursPerDay > 24)) {
      return res.status(400).json({ message: 'Invalid hours_per_day' });
    }
    if (
      hasDaysPerWeek &&
      daysPerWeek !== null &&
      (!Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7)
    ) {
      return res.status(400).json({ message: 'Invalid days_per_week' });
    }
    if (hasLevel && normalizedLevel !== null && normalizedLevel !== 'junior' && normalizedLevel !== 'pleno' && normalizedLevel !== 'senior') {
      return res.status(400).json({ message: 'Invalid level' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = name;
    user.professional_title = professionalTitle;
    user.professional_description = professionalDescription;
    if (hasRate) {
      user.rate = rate === null ? null : rate.toFixed(2);
    }
    if (hasHoursPerDay) {
      user.hours_per_day = hoursPerDay === null ? null : hoursPerDay.toFixed(2);
    }
    if (hasDaysPerWeek) {
      user.days_per_week = daysPerWeek === null ? null : daysPerWeek;
    }
    if (hasLevel) {
      user.level = normalizedLevel;
    }
    await user.save();

    return res.status(200).json({ user: toUserSafeJson(user) });
  } catch (error) {
    console.error('Update user profile error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
