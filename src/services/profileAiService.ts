type AssistProfileFieldsInput = {
  name: string;
  professionalTitle: string;
  professionalDescription: string;
  language?: string;
};

type AssistProfileFieldsOutput = {
  professionalTitle: string;
  professionalDescription: string;
  changedProfessionalTitle: boolean;
  changedProfessionalDescription: boolean;
};

type ProfileGraphMode = 'missing_title' | 'missing_description' | 'improve_both';

type ProfileGraphState = {
  name: string;
  professionalTitle: string;
  professionalDescription: string;
  language: string;
  mode: ProfileGraphMode;
  nextProfessionalTitle: string;
  nextProfessionalDescription: string;
};

const normalizeLanguage = (raw: string) => {
  const candidate = raw.trim().toLowerCase();
  const normalized = candidate.includes('-') ? candidate.split('-')[0] : candidate;
  if (normalized === 'pt' || normalized === 'en' || normalized === 'es') return normalized;
  return 'en';
};

const getLanguageLabel = (language: string) => {
  if (language === 'pt') return 'Portuguese (Brazil)';
  if (language === 'es') return 'Spanish';
  return 'English';
};

const toProfileGraphMode = (professionalTitle: string, professionalDescription: string): ProfileGraphMode => {
  const hasTitle = professionalTitle.trim().length > 0;
  const hasDescription = professionalDescription.trim().length > 0;

  if (!hasTitle && hasDescription) return 'missing_title';
  if (hasTitle && !hasDescription) return 'missing_description';
  return 'improve_both';
};

const clampText = (value: string, maxLength: number) => {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength).trim();
};

const normalizeTitle = (value: string) => clampText(value, 120);
const normalizeDescription = (value: string) => clampText(value, 1200);

const stripSeniorityFromTitle = (title: string) => {
  const cleaned = title
    .replace(/\b(jr\.?|junior|júnior|pleno|sr\.?|senior|sênior)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*[-–—|·•]\s*/g, ' ')
    .trim();

  return cleaned || title.trim();
};

const parseFirstJsonObject = (raw: string): Record<string, unknown> | null => {
  const trimmed = raw.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = trimmed.slice(start, end + 1);
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getString = (obj: Record<string, unknown>, key: string) => (typeof obj[key] === 'string' ? (obj[key] as string) : '');

const buildChatModel = async () => {
  const { ChatOpenAI } = await import('@langchain/openai');

  const baseUrl = (process.env.LITELLM_BASE_URL || 'http://litellm:4000').replace(/\/$/, '');
  const apiKey = process.env.LITELLM_MASTER_KEY || 'sk-litellm-dev';
  const model = process.env.PROFILE_AI_MODEL || 'openrouter/openai/gpt-4o-mini';

  return new ChatOpenAI({
    model,
    apiKey,
    temperature: 0.2,
    configuration: {
      baseURL: `${baseUrl}/v1`,
    },
  });
};

const generateOrImproveDescription = async (state: ProfileGraphState) => {
  const { SystemMessage, HumanMessage } = await import('@langchain/core/messages');
  const model = await buildChatModel();
  const languageLabel = getLanguageLabel(state.language);

  const instruction = [
    'You help a user complete their professional profile.',
    `Write the output content in ${languageLabel}.`,
    'Return ONLY a valid JSON object.',
    'Output shape: {"professional_description": string}.',
    'The professional_description must be professional, concise, and clearly describe the user and their expertise.',
    'Write the professional_description in FIRST PERSON, as if the user is speaking about themselves.',
    'Do NOT refer to the user in third person (no "he/she/they", no name-based third-person sentences).',
    'No Markdown, no extra keys.',
  ].join('\n');

  const input = [
    `Name: ${state.name}`,
    state.professionalTitle.trim().length > 0 ? `Professional title: ${state.professionalTitle}` : 'Professional title: (missing)',
    state.professionalDescription.trim().length > 0
      ? `Professional description: ${state.professionalDescription}`
      : 'Professional description: (missing)',
    state.mode === 'missing_title'
      ? 'Task: Evaluate the existing professional_description. Improve it only if it is not professional or not clear.'
      : state.mode === 'missing_description'
        ? 'Task: Create a good professional_description based on the professional_title.'
        : 'Task: Improve the professional_description if needed to be more professional, clear, and consistent with the title.',
  ].join('\n');

  const response = await model.invoke([new SystemMessage(instruction), new HumanMessage(input)]);
  const parsed = parseFirstJsonObject(response.content as string);
  const next = parsed ? getString(parsed, 'professional_description') : '';
  const normalized = normalizeDescription(next || state.professionalDescription);

  return {
    nextProfessionalDescription: normalized || state.professionalDescription,
  };
};

const generateOrImproveTitle = async (state: ProfileGraphState) => {
  const { SystemMessage, HumanMessage } = await import('@langchain/core/messages');
  const model = await buildChatModel();
  const languageLabel = getLanguageLabel(state.language);

  const instruction = [
    'You help a user complete their professional profile.',
    `Write the output content in ${languageLabel}.`,
    'Return ONLY a valid JSON object.',
    'Output shape: {"professional_title": string}.',
    'The professional_title must be a short, professional title that matches the description.',
    'The professional_title must NOT contain seniority/level words (junior, pleno, senior, jr, sr).',
    'No Markdown, no extra keys.',
  ].join('\n');

  const input = [
    `Name: ${state.name}`,
    state.professionalTitle.trim().length > 0 ? `Professional title: ${state.professionalTitle}` : 'Professional title: (missing)',
    `Professional description: ${state.nextProfessionalDescription || state.professionalDescription}`,
    state.mode === 'missing_title'
      ? 'Task: Create a professional_title based on the professional_description.'
      : state.mode === 'missing_description'
        ? 'Task: Evaluate the professional_title. Improve it if it does not match the description or is not professional.'
        : 'Task: Improve the professional_title if needed to match the improved description and stay professional.',
  ].join('\n');

  const response = await model.invoke([new SystemMessage(instruction), new HumanMessage(input)]);
  const parsed = parseFirstJsonObject(response.content as string);
  const next = parsed ? getString(parsed, 'professional_title') : '';
  const normalized = stripSeniorityFromTitle(normalizeTitle(next || state.professionalTitle));

  return {
    nextProfessionalTitle: normalized || state.professionalTitle,
  };
};

const buildGraph = async () => {
  const { Annotation, StateGraph, START, END } = await import('@langchain/langgraph');

  const StateAnnotation = Annotation.Root({
    name: Annotation<string>,
    professionalTitle: Annotation<string>,
    professionalDescription: Annotation<string>,
    language: Annotation<string>,
    mode: Annotation<ProfileGraphMode>,
    nextProfessionalTitle: Annotation<string>,
    nextProfessionalDescription: Annotation<string>,
  });

  const graph = new StateGraph(StateAnnotation)
    .addNode('descriptionNode', async (s: typeof StateAnnotation.State) => {
      const state: ProfileGraphState = {
        name: s.name,
        professionalTitle: s.professionalTitle,
        professionalDescription: s.professionalDescription,
        language: s.language,
        mode: s.mode,
        nextProfessionalTitle: s.nextProfessionalTitle,
        nextProfessionalDescription: s.nextProfessionalDescription,
      };

      const update = await generateOrImproveDescription(state);
      return {
        nextProfessionalDescription: update.nextProfessionalDescription,
      };
    })
    .addNode('titleNode', async (s: typeof StateAnnotation.State) => {
      const state: ProfileGraphState = {
        name: s.name,
        professionalTitle: s.professionalTitle,
        professionalDescription: s.professionalDescription,
        language: s.language,
        mode: s.mode,
        nextProfessionalTitle: s.nextProfessionalTitle,
        nextProfessionalDescription: s.nextProfessionalDescription,
      };

      const update = await generateOrImproveTitle(state);
      return {
        nextProfessionalTitle: update.nextProfessionalTitle,
      };
    })
    .addEdge(START, 'descriptionNode')
    .addEdge('descriptionNode', 'titleNode')
    .addEdge('titleNode', END)
    .compile();

  return { graph, StateAnnotation };
};

let compiledGraphPromise: Promise<{ graph: { invoke: (input: ProfileGraphState) => Promise<ProfileGraphState> }; StateAnnotation: unknown }> | null =
  null;

const getCompiledGraph = () => {
  if (!compiledGraphPromise) {
    compiledGraphPromise = buildGraph();
  }
  return compiledGraphPromise;
};

export const assistProfileFields = async (input: AssistProfileFieldsInput): Promise<AssistProfileFieldsOutput> => {
  const mode = toProfileGraphMode(input.professionalTitle, input.professionalDescription);
  const language = normalizeLanguage(input.language || '');

  const seedState: ProfileGraphState = {
    name: input.name,
    professionalTitle: input.professionalTitle,
    professionalDescription: input.professionalDescription,
    language,
    mode,
    nextProfessionalTitle: input.professionalTitle,
    nextProfessionalDescription: input.professionalDescription,
  };

  const { graph } = await getCompiledGraph();
  const finalState = await graph.invoke(seedState);

  const professionalTitle = stripSeniorityFromTitle(normalizeTitle(finalState.nextProfessionalTitle || finalState.professionalTitle));
  const professionalDescription = normalizeDescription(finalState.nextProfessionalDescription || finalState.professionalDescription);

  return {
    professionalTitle,
    professionalDescription,
    changedProfessionalTitle: professionalTitle.trim() !== input.professionalTitle.trim(),
    changedProfessionalDescription: professionalDescription.trim() !== input.professionalDescription.trim(),
  };
};
