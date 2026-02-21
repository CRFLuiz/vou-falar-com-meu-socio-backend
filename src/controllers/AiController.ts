import { Request, Response } from 'express';
import { assistProfileFields } from '../services/profileAiService';

export const assistProfileRequiredFields = async (req: Request, res: Response) => {
  try {
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
    const language =
      rawBody && typeof rawBody === 'object' && 'language' in rawBody && typeof (rawBody as { language?: unknown }).language === 'string'
        ? (rawBody as { language: string }).language.trim()
        : '';

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (!professionalTitle && !professionalDescription) {
      return res.status(400).json({ message: 'At least one of professional_title or professional_description is required' });
    }

    const result = await assistProfileFields({
      name,
      professionalTitle,
      professionalDescription,
      language,
    });

    return res.status(200).json({
      professional_title: result.professionalTitle,
      professional_description: result.professionalDescription,
      changed: {
        professional_title: result.changedProfessionalTitle,
        professional_description: result.changedProfessionalDescription,
      },
    });
  } catch (error) {
    console.error('Profile AI assist error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
