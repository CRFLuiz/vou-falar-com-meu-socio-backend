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

class ProjectController {
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
      if (projectInfo.budget) fullDescription += `\n\nBudget: ${projectInfo.budget}`;
      if (projectInfo.deadline) fullDescription += `\nDeadline: ${projectInfo.deadline}`;
      if (projectInfo.technologies && projectInfo.technologies.length > 0) {
        fullDescription += `\nTechnologies: ${projectInfo.technologies.join(', ')}`;
      }

      const project = await Project.create({
        name: projectInfo.name || 'Untitled Project',
        description: fullDescription,
        status: 'pending',
      });

      // 5. Return the created project
      return res.status(201).json(project);

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

      if (!name) {
        return res.status(400).json({ message: 'Project name is required' });
      }

      const project = await Project.create({
        name,
        description,
        status: status || 'pending',
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
      const projects = await Project.findAll({
        order: [['created_at', 'DESC']],
      });
      return res.status(200).json(projects);
    } catch (error) {
      console.error('Get projects error:', error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Internal server error getting projects' 
      });
    }
  }

  async getProjectById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const project = await Project.findByPk(id);

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      return res.status(200).json(project);
    } catch (error) {
      console.error('Get project error:', error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Internal server error getting project' 
      });
    }
  }

  async updateProject(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { 
        name, 
        description, 
        status, 
        discovery_data, 
        risk_analysis_data,
        architecture_data,
        engineering_data,
        risk_intel_data,
        estimation_data,
        documents_data
      } = req.body;

      const project = await Project.findByPk(id);

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      await project.update({
        name,
        description,
        status,
        discovery_data,
        risk_analysis_data,
        architecture_data,
        engineering_data,
        risk_intel_data,
        estimation_data,
        documents_data
      });

      return res.status(200).json(project);
    } catch (error) {
      console.error('Update project error:', error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Internal server error updating project' 
      });
    }
  }

  async deleteProject(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const project = await Project.findByPk(id);

      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      await project.destroy();
      return res.status(204).send();
    } catch (error) {
      console.error('Delete project error:', error);
      return res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Internal server error deleting project' 
      });
    }
  }

  // --- Stage Generation Methods ---

  async generateDiscovery(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const project = await Project.findByPk(id);
      if (!project) return res.status(404).json({ message: 'Project not found' });

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
      const project = await Project.findByPk(id);
      if (!project) return res.status(404).json({ message: 'Project not found' });
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
      const project = await Project.findByPk(id);
      if (!project) return res.status(404).json({ message: 'Project not found' });
      if (!project.discovery_data || !project.risk_analysis_data) return res.status(400).json({ message: 'Discovery and Risk data required' });

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
      const project = await Project.findByPk(id);
      if (!project) return res.status(404).json({ message: 'Project not found' });
      if (!project.architecture_data) return res.status(400).json({ message: 'Architecture data required' });

      const engineeringData = await generateStage4_Engineering(project.architecture_data);
      await project.update({ engineering_data: engineeringData });
      return res.status(200).json(project);
    } catch (error) {
      console.error('Generate Engineering error:', error);
      return res.status(500).json({ message: 'Failed to generate engineering plan' });
    }
  }

  async generateRiskIntel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const project = await Project.findByPk(id);
      if (!project) return res.status(404).json({ message: 'Project not found' });
      if (!project.discovery_data || !project.architecture_data || !project.engineering_data) {
        return res.status(400).json({ message: 'Discovery, Architecture and Engineering data required' });
      }

      const riskIntelData = await generateStage5_RiskIntel(project.discovery_data, project.architecture_data, project.engineering_data);
      await project.update({ risk_intel_data: riskIntelData });
      return res.status(200).json(project);
    } catch (error) {
      console.error('Generate Risk Intel error:', error);
      return res.status(500).json({ message: 'Failed to generate risk intel' });
    }
  }

  async generateEstimation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const project = await Project.findByPk(id);
      if (!project) return res.status(404).json({ message: 'Project not found' });
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
      const project = await Project.findByPk(id);
      if (!project) return res.status(404).json({ message: 'Project not found' });
      
      const documentsData = await generateStage7_Documents(project);
      await project.update({ documents_data: documentsData });
      return res.status(200).json(project);
    } catch (error) {
      console.error('Generate Documents error:', error);
      return res.status(500).json({ message: 'Failed to generate documents' });
    }
  }
}

export default new ProjectController();
