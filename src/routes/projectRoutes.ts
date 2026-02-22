import { Router } from 'express';
import ProjectController from '../controllers/ProjectController';

const router = Router();

// POST /api/projects/import
router.post('/import', (req, res) => ProjectController.importProject(req, res));

// GET /api/projects
router.get('/', (req, res) => ProjectController.getProjects(req, res));

// GET /api/projects/:id
router.get('/:id', (req, res) => ProjectController.getProjectById(req, res));

// POST /api/projects
router.post('/', (req, res) => ProjectController.createProject(req, res));

// PUT /api/projects/:id
router.put('/:id', (req, res) => ProjectController.updateProject(req, res));

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => ProjectController.deleteProject(req, res));

// --- Stage Generation Endpoints ---

// POST /api/projects/:id/stage/discovery
router.post('/:id/stage/discovery', (req, res) => ProjectController.generateDiscovery(req, res));

// POST /api/projects/:id/stage/risk-analysis
router.post('/:id/stage/risk-analysis', (req, res) => ProjectController.generateRiskAnalysis(req, res));

// POST /api/projects/:id/stage/architecture
router.post('/:id/stage/architecture', (req, res) => ProjectController.generateArchitecture(req, res));

// POST /api/projects/:id/stage/engineering
router.post('/:id/stage/engineering', (req, res) => ProjectController.generateEngineering(req, res));

// POST /api/projects/:id/stage/risk-intel
router.post('/:id/stage/risk-intel', (req, res) => ProjectController.generateRiskIntel(req, res));

// POST /api/projects/:id/stage/estimation
router.post('/:id/stage/estimation', (req, res) => ProjectController.generateEstimation(req, res));

// POST /api/projects/:id/stage/documents
router.post('/:id/stage/documents', (req, res) => ProjectController.generateDocuments(req, res));

export default router;
