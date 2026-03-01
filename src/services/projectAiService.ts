import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import * as dotenv from 'dotenv';
import { scrapeUrlTool } from './scraperService';
import { z } from 'zod';

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
      
      You have access to a tool 'scrape_url'. 
      CRITICAL: If you find any URLs in the text that point to client profiles, company pages, or other relevant sources that could provide more context about the client (reputation, location, other projects), YOU MUST USE THE TOOL to scrape them.
      Use the information from these scraped pages to enrich the 'client_info' field.

      CRITICAL: The 'description' field must contain the FULL, DETAILED content of the project requirements found in the text. DO NOT SUMMARIZE the description. Include all technical details, business rules, constraints, and context found. It should be a comprehensive text block.

      Extract: 
      - Project Name/Title
      - Description (FULL TEXT, NO SUMMARIZATION)
      - Budget
      - Deadline/Duration
      - Required Technologies (array)
      - Client Information (Location, Rating, Member Since, Verification Status, etc.)
      - Category & Subcategory
      - Number of Bids/Proposals (Competitors)
      - Any other relevant competitor info (avg bid, etc)

      Return ONLY a valid JSON object with keys: name, description, budget, deadline, technologies, client_info (object), category, subcategory, bid_count, competitors_info.
      If specific fields like budget/deadline are missing, use null.
      
      Ensure the final output is strictly a valid JSON string. Do not include markdown formatting (code blocks) in the final output, just the raw JSON string.
    `;
    
    try {
      const tools = [scrapeUrlTool];
      const chatModel = await buildChatModel();
      
      const agent = createAgent({
        model: chatModel,
        tools,
        systemPrompt: systemPrompt,
      });

      const result = await agent.invoke({
        messages: [{ role: "user", content: scrapedText }],
      }, {
        callbacks: [
          {
            handleToolStart: async (tool, input) => {
              console.log(`[Agent] 🛠️  Starting tool: ${tool.name}`);
              console.log(`[Agent] 📥  Tool input: ${JSON.stringify(input)}`);
            },
            handleToolEnd: async (output) => {
              console.log(`[Agent] ✅  Tool finished.`);
              console.log(`[Agent] 📤  Tool output (truncated): ${output.slice(0, 200)}...`);
            },
            handleAgentAction: async (action) => {
              console.log(`[Agent] 🤖  Agent decided to take action: ${action.tool}`);
            },
            handleChainEnd: async (outputs) => {
                // Optional: Log when the chain finishes
            }
          }
        ]
      });

      const content = result.messages[result.messages.length - 1].content as string;

      // Attempt to parse JSON
      try {
        // Find JSON object in response (in case of extra text)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(content);
      } catch (e) {
        console.error('Failed to parse Agent response as JSON:', content);
        throw new Error('Failed to parse Agent response.');
      }
    } catch (error) {
      console.error('Error in Agent processing:', error);
      // Fallback to simple call if agent fails (e.g. model doesn't support tools)
      console.log('Falling back to simple AI call...');
      return callAi(systemPrompt, scrapedText);
    }
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
        You are a Risk & Compliance Officer.
        Analyze the Discovery Data to identify risks, gaps, and ambiguities.

        Check for:
        - Critical missing information
        - Technical ambiguities
        - Unrealistic constraints
        - Complexity mismatches

        Return structured JSON:
        {
            "estimation_status": "ALLOWED" | "BLOCKED",
            "risk_classification": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            "completeness_score": number (0-100),
            "uncertainty_level": string,
            "critical_gaps": [],
            "ambiguities": [],
            "generated_questions": [],
            "risk_summary": "",
            "confidence_to_proceed": number
        }
    `;
    return callAi(systemPrompt, JSON.stringify(discoveryData));
};

export const generateStage3_Architecture = async (discoveryData: DiscoveryData, riskData: RiskAnalysisData): Promise<ArchitectureData> => {
    const systemPrompt = `
        You are a Principal Software Architect.
        Based on the Discovery Data and Risk Analysis, design the high-level architecture.

        Decide on:
        - Architectural Pattern (Monolith, Microservices, Serverless, Event-Driven)
        - Deployment Strategy
        - Infrastructure Stack
        - Observability & Security

        Return structured JSON:
        {
            "selected_pattern": "",
            "availability_strategy": {},
            "deployment_strategy": "",
            "environments": [],
            "observability_stack": {},
            "security": {},
            "disaster_recovery": {},
            "overall_architecture_complexity": number (1-10),
            "decision_log": []
        }
    `;
    return callAi(systemPrompt, JSON.stringify({ discovery: discoveryData, risks: riskData }));
};

export const generateStage4_Engineering = async (discovery: DiscoveryData, architecture: ArchitectureData): Promise<EngineeringData> => {
     const systemPrompt = `
        You are an Engineering Manager.
        Break down the project into technical tasks based on the Discovery and Architecture.

        Quantify:
        - Total Tasks
        - Task Categories (Infra, CI/CD, Security, etc.)
        - Complexity Score
        - Recommended Team Profile

        Return structured JSON:
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
            "tasks": []
        }
    `;
    return callAi(systemPrompt, JSON.stringify({ discovery, architecture }));
};

export const generateStage5_RiskIntel = async (risks: RiskAnalysisData, engineering: EngineeringData): Promise<RiskIntelData> => {
    const systemPrompt = `
        You are a Project Management Office (PMO) Risk Analyst.
        Correlate the Risk Analysis with the Engineering Breakdown to calculate the final project risk profile.

        Determine:
        - Risk Matrix
        - Effort Multipliers
        - Contingency Reserves

        Return structured JSON:
        {
            "risk_matrix": [],
            "overall_project_risk_score": number,
            "overall_risk_level": string,
            "risk_effort_multiplier": number,
            "recommended_contingency_percentage": number
        }
    `;
    return callAi(systemPrompt, JSON.stringify({ risks, engineering }));
};

export const generateStage6_Estimation = async (engineering: EngineeringData, riskIntel: RiskIntelData): Promise<EstimationData> => {
    const systemPrompt = `
        You are a Senior Technical Estimator.
        Calculate the final effort estimation based on Engineering Tasks and Risk Intelligence.

        Provide:
        - Total Hours
        - Confidence Range (Optimistic - Pessimistic)
        - Effort Distribution
        - Recommended Team Composition

        Return structured JSON:
        {
            "total_hours": number,
            "confidence_range": string,
            "risk_level": string,
            "effort_distribution": {},
            "recommended_team": {}
        }
    `;
    return callAi(systemPrompt, JSON.stringify({ engineering, riskIntel }));
};

export const generateStage7_Documents = async (
    discovery: DiscoveryData, 
    architecture: ArchitectureData, 
    estimation: EstimationData
): Promise<DocumentsData> => {
    const systemPrompt = `
        You are a Technical Writer and Documentation Specialist.
        Generate a list of necessary project documents based on the project scope, architecture, and estimation.

        Return structured JSON:
        {
            "documents": [
                {
                    "id": "unique-id",
                    "type": "proposal | architecture | sow | risk-log",
                    "format": "pdf | markdown | docx",
                    "content": "Short summary of content",
                    "url": "placeholder-url",
                    "audience": "client | technical | management"
                }
            ]
        }
    `;
    return callAi(systemPrompt, JSON.stringify({ discovery, architecture, estimation }));
};
