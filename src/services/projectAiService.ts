import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import * as dotenv from 'dotenv';

dotenv.config();

const buildChatModel = async () => {
  const baseUrl = (process.env.LITELLM_BASE_URL || 'http://litellm:4000').replace(/\/$/, '');
  const apiKey = process.env.LITELLM_API_KEY || process.env.LITELLM_MASTER_KEY || 'sk-litellm-dev';
  // Use 'oss 120b' model as requested, defaulting to the specific openrouter model ID
  const model = process.env.PROJECT_AI_MODEL || 'openrouter/openai/gpt-oss-120b';

  // Ensure OPENAI_API_KEY is set for the underlying OpenAI client
  process.env.OPENAI_API_KEY = apiKey;

  return new ChatOpenAI({
    modelName: model,
    apiKey: apiKey, // Use apiKey which is the standard property
    temperature: 0.1, // Lower temperature for extraction
    configuration: {
      baseURL: `${baseUrl}/v1`,
      apiKey: apiKey, // Explicitly pass to client config
    },
  });
};

const callAi = async (systemPrompt: string, userContent: string): Promise<any> => {
  try {
    const chatModel = await buildChatModel();
    const response = await chatModel.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userContent),
    ]);

    const content = response.content as string;
    
    // Attempt to parse JSON
    try {
      // Find JSON object in response (in case of extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', content);
      throw new Error('Failed to parse AI response.');
    }
  } catch (error) {
    console.error('Error in AI processing:', error);
    throw new Error('AI processing failed.');
  }
};

// --- Interfaces ---

export interface ExtractedProjectInfo {
  name: string;
  description: string;
  budget?: string;
  deadline?: string;
  technologies: string[];
  client_info?: {
    location?: string;
    rating?: string;
    member_since?: string;
    verification_status?: string;
  };
  category?: string;
  subcategory?: string;
  bid_count?: string;
  competitors_info?: string;
}

// Stage 1: Structured Discovery
export interface DiscoveryData {
  business: {
    objective: string;
    initiative_type: string;
    deadline: string;
    criticality: string;
    explicit: boolean;
  };
  functional_scope: {
    build_items: string[];
    integrations: string[];
    migration_required: boolean;
  };
  non_functional: {
    performance: any;
    availability: any;
    security: any;
    compliance: any;
  };
  as_is: any;
  constraints: any;
  inferred_signals: any[];
  missing_information: any[];
  confidence_score: number;
  estimation_risk: string;
}

// Stage 2: Completeness & Risk Scanner
export interface RiskAnalysisData {
  estimation_status: 'ALLOWED' | 'BLOCKED';
  risk_classification: string;
  completeness_score: number;
  uncertainty_level: string;
  critical_gaps: string[];
  ambiguities: string[];
  generated_questions: string[];
  risk_summary: string;
  confidence_to_proceed: number;
}

// Stage 3: Architecture Generator
export interface ArchitectureData {
  selected_pattern: string;
  availability_strategy: any;
  deployment_strategy: string;
  environments: string[];
  observability_stack: any;
  security: any;
  disaster_recovery: any;
  overall_architecture_complexity: number;
  decision_log: string[];
}

// Stage 4: Engineering Breakdown
export interface EngineeringData {
  total_tasks: number;
  infra_tasks: number;
  cicd_tasks: number;
  security_tasks: number;
  observability_tasks: number;
  dr_tasks: number;
  raw_complexity_score: number;
  adjusted_complexity_score: number;
  recommended_team_profile: any;
  tasks: any[];
}

// Stage 5: Risk Intelligence
export interface RiskIntelData {
  risk_matrix: any[];
  overall_project_risk_score: number;
  overall_risk_level: string;
  risk_effort_multiplier: number;
  recommended_contingency_percentage: number;
}

// Stage 6: Estimation
export interface EstimationData {
  total_hours: number;
  confidence_range: string;
  risk_level: string;
  effort_distribution: any;
  recommended_team: any;
}

// Stage 7: Documents
export interface DocumentsData {
  documents: {
    id: string;
    type: string;
    format: string;
    content?: string;
    url?: string;
    audience?: string;
  }[];
}

// --- Methods ---

export const extractProjectInfo = async (scrapedText: string): Promise<ExtractedProjectInfo> => {
    const systemPrompt = `
      You are an expert project analyst. Your task is to extract project details from raw text scraped from a freelancer platform AND/OR user provided notes.
      The input may contain [SOURCE URL] content and [USER NOTES]. Prioritize User Notes if they contradict or refine the scraped content.
      
      CRITICAL: The 'description' field must contain the FULL, DETAILED content of the project requirements found in the text. DO NOT SUMMARIZE the description. Include all technical details, business rules, constraints, and context found. It should be a comprehensive text block.

      Extract: 
      - Project Name/Title
      - Description (FULL TEXT, NO SUMMARIZATION)
      - Budget
      - Deadline/Duration
      - Required Technologies (array)
      - Client Information (Location, Rating, Member Since, Verification Status)
      - Category & Subcategory
      - Number of Bids/Proposals (Competitors)
      - Any other relevant competitor info (avg bid, etc)

      Return ONLY a valid JSON object with keys: name, description, budget, deadline, technologies, client_info (object), category, subcategory, bid_count, competitors_info.
      If specific fields like budget/deadline are missing, use null.
    `;
    return callAi(systemPrompt, scrapedText);
};

export const generateStage1_Discovery = async (projectDescription: string): Promise<DiscoveryData> => {
  const systemPrompt = `
    You are a Senior Cloud Solution Architect.
    Your task is to analyze the project description and extract structured information.
    
    Classify findings into:
    - Business Drivers
    - Functional Scope
    - Non-Functional Requirements
    - Current State (AS-IS)
    - Constraints
    - Inferred Signals (implicit risks, maturity indicators)
    
    Calculate a confidence score (0-100) and estimation risk (low/medium/high).
    
    Return structured JSON matching this interface:
    {
      "business": { "objective": "", "initiative_type": "", "deadline": "", "criticality": "", "explicit": boolean },
      "functional_scope": { "build_items": [], "integrations": [], "migration_required": boolean },
      "non_functional": { "performance": {}, "availability": {}, "security": {}, "compliance": {} },
      "as_is": {},
      "constraints": {},
      "inferred_signals": [],
      "missing_information": [],
      "confidence_score": number,
      "estimation_risk": string
    }
  `;
  return callAi(systemPrompt, projectDescription);
};

export const generateStage2_RiskScanner = async (discoveryData: DiscoveryData): Promise<RiskAnalysisData> => {
  const systemPrompt = `
    You are an expert Risk Analyst.
    Evaluate the structured discovery data to determine if the project is complete enough to architect and safe to estimate.
    
    Determine:
    - Estimation Status (ALLOWED/BLOCKED)
    - Risk Classification
    - Completeness Score
    - Critical Gaps & Ambiguities
    - Generate clarification questions
    
    Return structured JSON matching this interface:
    {
      "estimation_status": "ALLOWED" | "BLOCKED",
      "risk_classification": string,
      "completeness_score": number,
      "uncertainty_level": string,
      "critical_gaps": [],
      "ambiguities": [],
      "generated_questions": [],
      "risk_summary": string,
      "confidence_to_proceed": number
    }
  `;
  return callAi(systemPrompt, JSON.stringify(discoveryData));
};

export const generateStage3_Architecture = async (discoveryData: DiscoveryData, riskData: RiskAnalysisData): Promise<ArchitectureData> => {
  const systemPrompt = `
    You are a Principal Software Architect.
    Transform the Structured Discovery and Risk Analysis into a Target Architecture.
    
    Decide on:
    - Pattern (Microservices, Monolith, Serverless, etc.)
    - Availability & Deployment Strategy
    - Environments & Observability
    - Security & DR
    
    Return structured JSON matching this interface:
    {
      "selected_pattern": string,
      "availability_strategy": {},
      "deployment_strategy": string,
      "environments": [],
      "observability_stack": {},
      "security": {},
      "disaster_recovery": {},
      "overall_architecture_complexity": number,
      "decision_log": []
    }
  `;
  return callAi(systemPrompt, JSON.stringify({ discoveryData, riskData }));
};

export const generateStage4_Engineering = async (architectureData: ArchitectureData): Promise<EngineeringData> => {
  const systemPrompt = `
    You are an Engineering Manager.
    Convert the Architecture Design into a detailed Engineering Work Breakdown Structure (WBS).
    
    List tasks, classify complexity, and recommend team profile.
    
    Return structured JSON matching this interface:
    {
      "total_tasks": number,
      "infra_tasks": number,
      "cicd_tasks": number,
      "security_tasks": number,
      "observability_tasks": number,
      "dr_tasks": number,
      "raw_complexity_score": number,
      "adjusted_complexity_score": number,
      "recommended_team_profile": {},
      "tasks": [{ "id": string, "name": string, "complexity": number, "domain": string }]
    }
  `;
  return callAi(systemPrompt, JSON.stringify(architectureData));
};

export const generateStage5_RiskIntel = async (discoveryData: DiscoveryData, architectureData: ArchitectureData, engineeringData: EngineeringData): Promise<RiskIntelData> => {
  const systemPrompt = `
    You are a Risk Intelligence Specialist.
    Analyze previous data to generate a Formal Risk Matrix.
    
    Calculate:
    - Risk Matrix (What can go wrong, probability, impact, mitigation)
    - Overall Risk Score & Level
    - Risk Effort Multiplier & Contingency
    
    Return structured JSON matching this interface:
    {
      "risk_matrix": [{ "risk_id": string, "category": string, "description": string, "probability": number, "impact": number, "risk_score": number, "classification": string, "mitigation": string }],
      "overall_project_risk_score": number,
      "overall_risk_level": string,
      "risk_effort_multiplier": number,
      "recommended_contingency_percentage": number
    }
  `;
  return callAi(systemPrompt, JSON.stringify({ discoveryData, architectureData, engineeringData }));
};

export const generateStage6_Estimation = async (engineeringData: EngineeringData, riskIntelData: RiskIntelData): Promise<EstimationData> => {
  const systemPrompt = `
    You are a Technical Project Manager.
    Calculate hours, cost factors, and team distribution based on Engineering Breakdown and Risk Intelligence.
    
    Return structured JSON matching this interface:
    {
      "total_hours": number,
      "confidence_range": string,
      "risk_level": string,
      "effort_distribution": { "infra": number, "cicd": number, "security": number, "observability": number, "dr": number },
      "recommended_team": {}
    }
  `;
  return callAi(systemPrompt, JSON.stringify({ engineeringData, riskIntelData }));
};

export const generateStage7_Documents = async (projectData: any): Promise<DocumentsData> => {
  const systemPrompt = `
    You are a Technical Writer.
    Transform all project intelligence into executive-grade artifacts.
    
    Generate content for:
    - Technical Proposal (Executive Summary, Architecture, Roadmap)
    
    Return structured JSON matching this interface:
    {
      "documents": [
        { "id": string, "type": "technical_proposal", "format": "markdown", "content": string, "audience": "CTO" }
      ]
    }
  `;
  return callAi(systemPrompt, JSON.stringify(projectData));
};
