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
import { markdownToHtmlService } from '../services/markdownToHtmlService';
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

  private async loadProjectForStage(id: string, userId: number | null) {
    const isNumericId = Number.isFinite(Number(id)) && String(Number(id)) === String(id);

    if (isNumericId) {
      const numericId = Number(id);
      const project = await Project.findByPk(numericId);
      if (!project) {
        return { kind: 'not_found' as const };
      }
      if (project.user_id && project.user_id !== userId) {
        return { kind: 'forbidden' as const };
      }
      return { kind: 'db' as const, project };
    }

    let cachedProject: string | null = null;
    let redisKey: string | null = null;

    if (userId) {
      redisKey = `project:user:${userId}:${id}`;
      cachedProject = await redis.get(redisKey);
    }

    if (!cachedProject) {
      redisKey = `project:public:${id}`;
      cachedProject = await redis.get(redisKey);
    }

    if (!cachedProject) {
      redisKey = `project:${id}`;
      cachedProject = await redis.get(redisKey);
    }

    if (!cachedProject || !redisKey) {
      return { kind: 'not_found' as const };
    }

    const project = JSON.parse(cachedProject) as Record<string, unknown>;
    const projectUserId = typeof project.user_id === 'number' ? project.user_id : null;
    if (projectUserId && projectUserId !== userId) {
      return { kind: 'forbidden' as const };
    }

    return { kind: 'redis' as const, redisKey, project };
  }

  private async updateRedisProject(redisKey: string, project: Record<string, unknown>, update: Record<string, unknown>) {
    const next = {
      ...project,
      ...update,
      updated_at: new Date().toISOString(),
    };
    await redis.setex(redisKey, 86400, JSON.stringify(next));
    return next;
  }

  private stripRenderedHtml<T extends Record<string, unknown>>(data: T): T {
    const { rendered_html: _renderedHtml, ...rest } = data;
    return rest as T;
  }

  private buildDiscoveryMarkdownReport(projectDescription: string, discoveryData: Record<string, unknown>): string {
    const business = (discoveryData.business as Record<string, unknown> | undefined) ?? {};
    const functionalScope = (discoveryData.functional_scope as Record<string, unknown> | undefined) ?? {};
    const nonFunctional = (discoveryData.non_functional as Record<string, unknown> | undefined) ?? {};

    const inferredSignals = Array.isArray(discoveryData.inferred_signals) ? discoveryData.inferred_signals : [];
    const missingInformation = Array.isArray(discoveryData.missing_information) ? discoveryData.missing_information : [];

    const buildItems = Array.isArray(functionalScope.build_items) ? functionalScope.build_items : [];
    const integrations = Array.isArray(functionalScope.integrations) ? functionalScope.integrations : [];

    const jsonBlock = (value: unknown) => `\n\`\`\`json\n${JSON.stringify(value ?? {}, null, 2)}\n\`\`\`\n`;

    const lines: string[] = [];
    lines.push('# Structured Discovery');
    lines.push('');

    if (projectDescription.trim().length > 0) {
      lines.push('## Project Description');
      lines.push('');
      lines.push(projectDescription.trim());
      lines.push('');
    }

    lines.push('## Business Context');
    lines.push('');
    lines.push(`- Objective: ${String(business.objective ?? '')}`);
    lines.push(`- Initiative Type: ${String(business.initiative_type ?? '')}`);
    lines.push(`- Target Deadline: ${String(business.deadline ?? '')}`);
    lines.push(`- Criticality: ${String(business.criticality ?? '')}`);
    lines.push(`- Explicit: ${String(business.explicit ?? '')}`);
    lines.push('');

    lines.push('## Functional Scope');
    lines.push('');
    lines.push('### Build Items');
    lines.push('');
    lines.push(buildItems.length ? buildItems.map((i) => `- ${String(i)}`).join('\n') : '-');
    lines.push('');
    lines.push('### Integrations');
    lines.push('');
    lines.push(integrations.length ? integrations.map((i) => `- ${String(i)}`).join('\n') : '-');
    lines.push('');
    lines.push(`### Migration Required\n\n- ${String(functionalScope.migration_required ?? '')}`);
    lines.push('');

    lines.push('## Non-Functional Requirements');
    lines.push('');
    lines.push('### Performance');
    lines.push(jsonBlock(nonFunctional.performance));
    lines.push('### Availability');
    lines.push(jsonBlock(nonFunctional.availability));
    lines.push('### Security');
    lines.push(jsonBlock(nonFunctional.security));
    lines.push('### Compliance');
    lines.push(jsonBlock(nonFunctional.compliance));

    lines.push('## Current State (AS-IS)');
    lines.push(jsonBlock(discoveryData.as_is));

    lines.push('## Constraints');
    lines.push(jsonBlock(discoveryData.constraints));

    lines.push('## Inferred Signals');
    lines.push('');
    lines.push(inferredSignals.length ? inferredSignals.map((s) => `- ${String(s)}`).join('\n') : '-');
    lines.push('');

    lines.push('## Missing Information');
    lines.push('');
    lines.push(missingInformation.length ? missingInformation.map((m) => `- ${String(m)}`).join('\n') : '-');
    lines.push('');

    lines.push('## Metrics');
    lines.push('');
    lines.push(`- Confidence Score: ${String(discoveryData.confidence_score ?? '')}`);
    lines.push(`- Estimation Risk: ${String(discoveryData.estimation_risk ?? '')}`);
    lines.push('');

    return lines.join('\n');
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
          combinedText += `${scrapedText}\n\n`;
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
        if (projectInfo.client_info.summary) metadata.push(`**Client Summary:** ${projectInfo.client_info.summary}`);
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

      const loaded = await this.loadProjectForStage(id, userId);
      if (loaded.kind === 'not_found') return res.status(404).json({ message: 'Project not found' });
      if (loaded.kind === 'forbidden') return res.status(403).json({ message: 'Access denied' });

      const description =
        loaded.kind === 'db'
          ? loaded.project.description
          : typeof loaded.project.description === 'string'
            ? loaded.project.description
            : '';

      const discoveryData = await generateStage1_Discovery(description);
      const discoveryMarkdown = this.buildDiscoveryMarkdownReport(description, discoveryData as unknown as Record<string, unknown>);
      const renderedHtml = markdownToHtmlService.toHtml(discoveryMarkdown);
      const discoveryDataWithHtml = {
        ...(discoveryData as unknown as Record<string, unknown>),
        rendered_html: renderedHtml,
      };

      if (loaded.kind === 'db') {
        await loaded.project.update({ discovery_data: discoveryDataWithHtml });
        return res.status(200).json(loaded.project);
      }

      const updated = await this.updateRedisProject(loaded.redisKey, loaded.project, { discovery_data: discoveryDataWithHtml });
      return res.status(200).json(updated);
    } catch (error) {
      console.error('Generate Discovery error:', error);
      return res.status(500).json({ message: 'Failed to generate discovery data' });
    }
  }

  async generateRiskAnalysis(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const loaded = await this.loadProjectForStage(id, userId);
      if (loaded.kind === 'not_found') return res.status(404).json({ message: 'Project not found' });
      if (loaded.kind === 'forbidden') return res.status(403).json({ message: 'Access denied' });

      const discoveryDataRaw = loaded.kind === 'db' ? loaded.project.discovery_data : loaded.project.discovery_data;
      const discoveryData = discoveryDataRaw && typeof discoveryDataRaw === 'object'
        ? this.stripRenderedHtml(discoveryDataRaw as Record<string, unknown>)
        : discoveryDataRaw;
      if (!discoveryData) return res.status(400).json({ message: 'Discovery data required' });

      const riskData = await generateStage2_RiskScanner(discoveryData as any);

      if (loaded.kind === 'db') {
        await loaded.project.update({ risk_analysis_data: riskData });
        return res.status(200).json(loaded.project);
      }

      const updated = await this.updateRedisProject(loaded.redisKey, loaded.project, { risk_analysis_data: riskData });
      return res.status(200).json(updated);
    } catch (error) {
      console.error('Generate Risk Analysis error:', error);
      return res.status(500).json({ message: 'Failed to generate risk analysis' });
    }
  }

  async generateArchitecture(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const loaded = await this.loadProjectForStage(id, userId);
      if (loaded.kind === 'not_found') return res.status(404).json({ message: 'Project not found' });
      if (loaded.kind === 'forbidden') return res.status(403).json({ message: 'Access denied' });

      const discoveryDataRaw = loaded.kind === 'db' ? loaded.project.discovery_data : loaded.project.discovery_data;
      const discoveryData = discoveryDataRaw && typeof discoveryDataRaw === 'object'
        ? this.stripRenderedHtml(discoveryDataRaw as Record<string, unknown>)
        : discoveryDataRaw;
      const riskAnalysisData = loaded.kind === 'db' ? loaded.project.risk_analysis_data : loaded.project.risk_analysis_data;
      if (!discoveryData || !riskAnalysisData) {
        return res.status(400).json({ message: 'Discovery and Risk data required' });
      }

      const architectureData = await generateStage3_Architecture(discoveryData as any, riskAnalysisData as any);

      if (loaded.kind === 'db') {
        await loaded.project.update({ architecture_data: architectureData });
        return res.status(200).json(loaded.project);
      }

      const updated = await this.updateRedisProject(loaded.redisKey, loaded.project, { architecture_data: architectureData });
      return res.status(200).json(updated);
    } catch (error) {
      console.error('Generate Architecture error:', error);
      return res.status(500).json({ message: 'Failed to generate architecture' });
    }
  }

  async generateEngineering(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const loaded = await this.loadProjectForStage(id, userId);
      if (loaded.kind === 'not_found') return res.status(404).json({ message: 'Project not found' });
      if (loaded.kind === 'forbidden') return res.status(403).json({ message: 'Access denied' });

      const discoveryDataRaw = loaded.kind === 'db' ? loaded.project.discovery_data : loaded.project.discovery_data;
      const discoveryData = discoveryDataRaw && typeof discoveryDataRaw === 'object'
        ? this.stripRenderedHtml(discoveryDataRaw as Record<string, unknown>)
        : discoveryDataRaw;
      const architectureData = loaded.kind === 'db' ? loaded.project.architecture_data : loaded.project.architecture_data;
      if (!discoveryData || !architectureData) {
        return res.status(400).json({ message: 'Discovery and Architecture data required' });
      }

      const engineeringData = await generateStage4_Engineering(discoveryData as any, architectureData as any);

      if (loaded.kind === 'db') {
        await loaded.project.update({ engineering_data: engineeringData });
        return res.status(200).json(loaded.project);
      }

      const updated = await this.updateRedisProject(loaded.redisKey, loaded.project, { engineering_data: engineeringData });
      return res.status(200).json(updated);
    } catch (error) {
      console.error('Generate Engineering error:', error);
      return res.status(500).json({ message: 'Failed to generate engineering breakdown' });
    }
  }

  async generateRiskIntel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const loaded = await this.loadProjectForStage(id, userId);
      if (loaded.kind === 'not_found') return res.status(404).json({ message: 'Project not found' });
      if (loaded.kind === 'forbidden') return res.status(403).json({ message: 'Access denied' });

      const riskAnalysisData = loaded.kind === 'db' ? loaded.project.risk_analysis_data : loaded.project.risk_analysis_data;
      const engineeringData = loaded.kind === 'db' ? loaded.project.engineering_data : loaded.project.engineering_data;
      if (!riskAnalysisData || !engineeringData) {
        return res.status(400).json({ message: 'Risk Analysis and Engineering data required' });
      }

      const riskIntelData = await generateStage5_RiskIntel(riskAnalysisData as any, engineeringData as any);

      if (loaded.kind === 'db') {
        await loaded.project.update({ risk_intel_data: riskIntelData });
        return res.status(200).json(loaded.project);
      }

      const updated = await this.updateRedisProject(loaded.redisKey, loaded.project, { risk_intel_data: riskIntelData });
      return res.status(200).json(updated);
    } catch (error) {
      console.error('Generate Risk Intel error:', error);
      return res.status(500).json({ message: 'Failed to generate risk intelligence' });
    }
  }

  async generateEstimation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const loaded = await this.loadProjectForStage(id, userId);
      if (loaded.kind === 'not_found') return res.status(404).json({ message: 'Project not found' });
      if (loaded.kind === 'forbidden') return res.status(403).json({ message: 'Access denied' });

      const engineeringData = loaded.kind === 'db' ? loaded.project.engineering_data : loaded.project.engineering_data;
      const riskIntelData = loaded.kind === 'db' ? loaded.project.risk_intel_data : loaded.project.risk_intel_data;
      if (!engineeringData || !riskIntelData) {
        return res.status(400).json({ message: 'Engineering and Risk Intel data required' });
      }

      const estimationData = await generateStage6_Estimation(engineeringData as any, riskIntelData as any);

      if (loaded.kind === 'db') {
        await loaded.project.update({ estimation_data: estimationData });
        return res.status(200).json(loaded.project);
      }

      const updated = await this.updateRedisProject(loaded.redisKey, loaded.project, { estimation_data: estimationData });
      return res.status(200).json(updated);
    } catch (error) {
      console.error('Generate Estimation error:', error);
      return res.status(500).json({ message: 'Failed to generate estimation' });
    }
  }

  async generateDocuments(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const loaded = await this.loadProjectForStage(id, userId);
      if (loaded.kind === 'not_found') return res.status(404).json({ message: 'Project not found' });
      if (loaded.kind === 'forbidden') return res.status(403).json({ message: 'Access denied' });

      const discoveryDataRaw = loaded.kind === 'db' ? loaded.project.discovery_data : loaded.project.discovery_data;
      const discoveryData = discoveryDataRaw && typeof discoveryDataRaw === 'object'
        ? this.stripRenderedHtml(discoveryDataRaw as Record<string, unknown>)
        : discoveryDataRaw;
      const architectureData = loaded.kind === 'db' ? loaded.project.architecture_data : loaded.project.architecture_data;
      const estimationData = loaded.kind === 'db' ? loaded.project.estimation_data : loaded.project.estimation_data;
      if (!discoveryData || !architectureData || !estimationData) {
        return res.status(400).json({ message: 'Discovery, Architecture, and Estimation data required' });
      }

      const documentsData = await generateStage7_Documents(discoveryData as any, architectureData as any, estimationData as any);

      if (loaded.kind === 'db') {
        await loaded.project.update({ documents_data: documentsData });
        return res.status(200).json(loaded.project);
      }

      const updated = await this.updateRedisProject(loaded.redisKey, loaded.project, { documents_data: documentsData });
      return res.status(200).json(updated);
    } catch (error) {
      console.error('Generate Documents error:', error);
      return res.status(500).json({ message: 'Failed to generate documents' });
    }
  }
}

export default new ProjectController();
