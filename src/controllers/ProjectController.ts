import { Request, Response } from 'express';
import { scrapeProjectUrl } from '../services/scraperService';
import { 
  extractProjectInfo,
  generateStage1_Discovery,
  generateStage2_RiskScanner,
  generateStage3_Architecture,
  generateStage4_Engineering,
  generateStage5_RiskIntel,
  generateStage6_Estimation,
  generateStage7_Documents
} from '../services/projectAiService';
import Project from '../models/Project';
import redis from '../config/redis';
import { randomUUID } from 'crypto';

class ProjectController {
  // Helper to safely extract user ID
  private getUserId(req: Request): number | null {
    const userIdHeader = req.headers['x-user-id'];
    console.log('[DEBUG] Incoming headers:', JSON.stringify(req.headers, null, 2));
    console.log('[DEBUG] x-user-id header:', userIdHeader);
    
    if (!userIdHeader) return null;
    const id = Array.isArray(userIdHeader) ? userIdHeader[0] : userIdHeader;
    const num = Number(id);
    
    if (isNaN(num)) {
      console.warn('[WARN] Invalid user ID header:', userIdHeader);
      return null;
    }
    
    console.log('[DEBUG] Extracted user ID:', num);
    return num;
  }

  async importProject(req: Request, res: Response) {
    try {
      const { url, text } = req.body;

      if (!url && !text) {
        return res.status(400).json({ message: 'URL or Text is required' });
      }

      let combinedText = '';

      // 1. Scrape the URL if provided
      if (url) {
        const scrapedText = await scrapeProjectUrl(url);
        if (scrapedText) {
          combinedText += `[SOURCE URL: ${url}]\n\n${scrapedText}\n\n`;
        }
      }

      // 2. Append provided text
      if (text) {
        combinedText += `[USER NOTES]\n${text}`;
      }

      if (!combinedText.trim()) {
         return res.status(400).json({ message: 'No content could be extracted or provided.' });
      }

      // 3. Extract info using AI
      const projectInfo = await extractProjectInfo(combinedText);
      console.log('Agent Response (Project Info):', JSON.stringify(projectInfo, null, 2));

      // 4. Create the project
      // Append extra info to description if not part of standard fields
      let fullDescription = projectInfo.description || '';
      
      // Add structured metadata to description for visibility
      const metadata: string[] = [];
      if (projectInfo.budget) metadata.push(`**Budget:** ${projectInfo.budget}`);
      if (projectInfo.deadline) metadata.push(`**Deadline:** ${projectInfo.deadline}`);
      if (projectInfo.category) metadata.push(`**Category:** ${projectInfo.category}${projectInfo.subcategory ? ` / ${projectInfo.subcategory}` : ''}`);
      if (projectInfo.bid_count) metadata.push(`**Bids:** ${projectInfo.bid_count}`);
      if (projectInfo.client_info) {
        const clientDetails = [
          projectInfo.client_info.location,
          projectInfo.client_info.rating ? `Rating: ${projectInfo.client_info.rating}` : null,
          projectInfo.client_info.verification_status
        ].filter(Boolean).join(' | ');
        if (clientDetails) metadata.push(`**Client:** ${clientDetails}`);
      }
      if (projectInfo.competitors_info) metadata.push(`**Competitors Info:** ${projectInfo.competitors_info}`);

      if (metadata.length > 0) {
        fullDescription += '\n\n---\n### Extracted Metadata\n' + metadata.join('\n');
      }

      if (projectInfo.technologies && projectInfo.technologies.length > 0) {
        fullDescription += `\n\n**Technologies:** ${projectInfo.technologies.join(', ')}`;
      }

      // 4. Create the project in Redis (Temporary)
      const tempId = randomUUID();
      const userId = this.getUserId(req);
      
      const projectData = {
        id: tempId,
        user_id: userId,
        name: projectInfo.name || 'Untitled Project',
        description: fullDescription,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        discovery_data: null,
        risk_analysis_data: null,
        architecture_data: null,
        engineering_data: null,
        risk_intel_data: null,
        estimation_data: null,
        documents_data: null
      };

      // Determine Redis key based on user presence
      const redisKey = userId 
        ? `project:user:${userId}:${tempId}`
        : `project:public:${tempId}`;

      // Save to Redis with 24h TTL
      await redis.setex(redisKey, 86400, JSON.stringify(projectData));

      // 5. Return the created project
      const response: any = { ...projectData };
      
      // Add debug info if enabled
      if (process.env.DEBUG_AI === 'true') {
        response._debug = {
          source: 'extractProjectInfo',
          extractedData: projectInfo
        };
      }

      return res.status(201).json(response);

    } catch (error) {
      console.error('Project import error:', error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Internal server error during project import' 
      });
    }
  }

  async createProject(req: Request, res: Response) {
    try {
      const { name, description, status } = req.body;
      const userId = this.getUserId(req);

      if (!name) {
        return res.status(400).json({ message: 'Project name is required' });
      }

      const project = await Project.create({
        name,
        description,
        status: status || 'pending',
        user_id: userId || undefined,
      });

      return res.status(201).json(project);
    } catch (error) {
      console.error('Create project error:', error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Internal server error during project creation' 
      });
    }
  }

  async getProjects(req: Request, res: Response) {
    try {
      const userId = this.getUserId(req);
      const projects: any[] = [];

      // 1. Fetch Redis projects
      let redisPattern = 'project:public:*';
      if (userId) {
        redisPattern = `project:user:${userId}:*`;
      }

      const keys = await redis.keys(redisPattern);
      if (keys.length > 0) {
        // Use mget for efficiency
        const redisProjects = await redis.mget(keys);
        redisProjects.forEach(p => {
          if (p) projects.push(JSON.parse(p));
        });
      }

      // 2. Fetch DB projects
      const dbProjects = await Project.findAll({
        where: userId ? { user_id: userId } : { user_id: null },
        order: [['created_at', 'DESC']],
      });

      projects.push(...dbProjects);
      
      // Sort combined results by date
      projects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return res.status(200).json(projects);
    } catch (error) {
      console.error('Get projects error:', error);
      return res.status(500).json({ message: 'Failed to fetch projects' });
    }
  }

  async getProjectById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);

      // Check Redis first if ID is likely a UUID
      if (isNaN(Number(id))) {
        // Try user-specific key first, then public, then legacy
        let cachedProject = null;
        
        if (userId) {
          cachedProject = await redis.get(`project:user:${userId}:${id}`);
        }
        
        if (!cachedProject) {
           cachedProject = await redis.get(`project:public:${id}`);
        }
        
        // Fallback for legacy projects
        if (!cachedProject) {
           cachedProject = await redis.get(`project:${id}`);
        }

        if (cachedProject) {
          return res.status(200).json(JSON.parse(cachedProject));
        }
        return res.status(404).json({ message: 'Project not found' });
      }

      const project = await Project.findByPk(id);

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Verify ownership if user is logged in and project has owner
      if (userId && project.user_id && project.user_id !== userId) {
         return res.status(403).json({ message: 'Access denied' });
      }

      return res.status(200).json(project);
    } catch (error) {
      console.error('Get project error:', error);
      return res.status(500).json({ message: 'Failed to fetch project' });
    }
  }

  async updateProject(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, status } = req.body;
      const userId = this.getUserId(req);

      const project = await Project.findByPk(id);

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      if (project.user_id && project.user_id !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await project.update({
        name,
        description,
        status,
      });

      return res.status(200).json(project);
    } catch (error) {
      console.error('Update project error:', error);
      return res.status(500).json({ message: 'Failed to update project' });
    }
  }

  async deleteProject(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const project = await Project.findByPk(id);

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      if (project.user_id && project.user_id !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await project.destroy();
      return res.status(204).send();
    } catch (error) {
      console.error('Delete project error:', error);
      return res.status(500).json({ message: 'Failed to delete project' });
    }
  }

  // --- Stage Generation Endpoints ---

  async generateDiscovery(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const project = await Project.findByPk(id);
      
      if (!project) return res.status(404).json({ message: 'Project not found' });
      if (project.user_id && project.user_id !== userId) return res.status(403).json({ message: 'Access denied' });
      
      const discoveryData = await generateStage1_Discovery(project.description);
      await project.update({ discovery_data: discoveryData });
      
      return res.status(200).json(project);
    } catch (error) {
      console.error('Generate Discovery error:', error);
      return res.status(500).json({ message: 'Failed to generate discovery data' });
    }
  }

  async generateRiskAnalysis(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const project = await Project.findByPk(id);
      
      if (!project) return res.status(404).json({ message: 'Project not found' });
      if (project.user_id && project.user_id !== userId) return res.status(403).json({ message: 'Access denied' });
      if (!project.discovery_data) return res.status(400).json({ message: 'Discovery data required' });

      const riskData = await generateStage2_RiskScanner(project.discovery_data);
      await project.update({ risk_analysis_data: riskData });
      
      return res.status(200).json(project);
    } catch (error) {
      console.error('Generate Risk Analysis error:', error);
      return res.status(500).json({ message: 'Failed to generate risk analysis' });
    }
  }

  async generateArchitecture(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const project = await Project.findByPk(id);
      
      if (!project) return res.status(404).json({ message: 'Project not found' });
      if (project.user_id && project.user_id !== userId) return res.status(403).json({ message: 'Access denied' });
      if (!project.discovery_data || !project.risk_analysis_data) {
        return res.status(400).json({ message: 'Discovery and Risk data required' });
      }

      const architectureData = await generateStage3_Architecture(project.discovery_data, project.risk_analysis_data);
      await project.update({ architecture_data: architectureData });
      
      return res.status(200).json(project);
    } catch (error) {
      console.error('Generate Architecture error:', error);
      return res.status(500).json({ message: 'Failed to generate architecture' });
    }
  }

  async generateEngineering(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const project = await Project.findByPk(id);
      
      if (!project) return res.status(404).json({ message: 'Project not found' });
      if (project.user_id && project.user_id !== userId) return res.status(403).json({ message: 'Access denied' });
      if (!project.discovery_data || !project.architecture_data) {
        return res.status(400).json({ message: 'Discovery and Architecture data required' });
      }

      const engineeringData = await generateStage4_Engineering(project.discovery_data, project.architecture_data);
      await project.update({ engineering_data: engineeringData });
      
      return res.status(200).json(project);
    } catch (error) {
      console.error('Generate Engineering error:', error);
      return res.status(500).json({ message: 'Failed to generate engineering breakdown' });
    }
  }

  async generateRiskIntel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const project = await Project.findByPk(id);
      
      if (!project) return res.status(404).json({ message: 'Project not found' });
      if (project.user_id && project.user_id !== userId) return res.status(403).json({ message: 'Access denied' });
      if (!project.risk_analysis_data || !project.engineering_data) {
        return res.status(400).json({ message: 'Risk Analysis and Engineering data required' });
      }

      const riskIntelData = await generateStage5_RiskIntel(project.risk_analysis_data, project.engineering_data);
      await project.update({ risk_intel_data: riskIntelData });
      
      return res.status(200).json(project);
    } catch (error) {
      console.error('Generate Risk Intel error:', error);
      return res.status(500).json({ message: 'Failed to generate risk intelligence' });
    }
  }

  async generateEstimation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const project = await Project.findByPk(id);
      
      if (!project) return res.status(404).json({ message: 'Project not found' });
      if (project.user_id && project.user_id !== userId) return res.status(403).json({ message: 'Access denied' });
      if (!project.engineering_data || !project.risk_intel_data) {
        return res.status(400).json({ message: 'Engineering and Risk Intel data required' });
      }

      const estimationData = await generateStage6_Estimation(project.engineering_data, project.risk_intel_data);
      await project.update({ estimation_data: estimationData });
      
      return res.status(200).json(project);
    } catch (error) {
      console.error('Generate Estimation error:', error);
      return res.status(500).json({ message: 'Failed to generate estimation' });
    }
  }

  async generateDocuments(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const project = await Project.findByPk(id);
      
      if (!project) return res.status(404).json({ message: 'Project not found' });
      if (project.user_id && project.user_id !== userId) return res.status(403).json({ message: 'Access denied' });
      if (!project.discovery_data || !project.architecture_data || !project.estimation_data) {
        return res.status(400).json({ message: 'Discovery, Architecture, and Estimation data required' });
      }

      const documentsData = await generateStage7_Documents(project.discovery_data, project.architecture_data, project.estimation_data);
      await project.update({ documents_data: documentsData });
      
      return res.status(200).json(project);
    } catch (error) {
      console.error('Generate Documents error:', error);
      return res.status(500).json({ message: 'Failed to generate documents' });
    }
  }
}

export default new ProjectController();
