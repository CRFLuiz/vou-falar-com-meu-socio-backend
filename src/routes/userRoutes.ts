import { Router } from 'express';
import { getUserById, updateUserProfileById } from '../controllers/UserController';

const router = Router();

router.get('/:id', getUserById);
router.patch('/:id/profile', updateUserProfileById);

export default router;

