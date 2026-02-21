import { Router } from 'express';
import { assistProfileRequiredFields } from '../controllers/AiController';

const router = Router();

router.post('/profile/help-required', assistProfileRequiredFields);

export default router;
