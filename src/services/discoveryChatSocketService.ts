import type { IncomingMessage, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import Project from '../models/Project';
import redis from '../config/redis';
import { markdownToHtmlService } from './markdownToHtmlService';
import { analyzeDiscoveryChatTurn, generateStage1_Discovery } from './projectAiService';

type SessionMessage = {
  role: 'assistant' | 'user';
  text: string;
};

type ChatSession = {
  messages: SessionMessage[];
};

type LoadedProject =
  | { kind: 'db'; project: Project }
  | { kind: 'redis'; redisKey: string; project: Record<string, unknown> };

const sessionsByProject = new Map<string, ChatSession>();

const getSession = (projectKey: string): ChatSession => {
  const existing = sessionsByProject.get(projectKey);
  if (existing) return existing;
  const created: ChatSession = { messages: [] };
  sessionsByProject.set(projectKey, created);
  return created;
};

const parseUserId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const parseUserIdFromRequest = (req: IncomingMessage): number | null => {
  const header = req.headers['x-user-id'];
  if (Array.isArray(header)) return parseUserId(header[0]);
  return parseUserId(header);
};

const loadProjectForStage = async (id: string, userId: number | null): Promise<LoadedProject | null> => {
  const isNumericId = Number.isFinite(Number(id)) && String(Number(id)) === String(id);
  if (isNumericId) {
    const project = await Project.findByPk(Number(id));
    if (!project) return null;
    if (project.user_id && project.user_id !== userId) return null;
    return { kind: 'db', project };
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
  if (!cachedProject || !redisKey) return null;

  const project = JSON.parse(cachedProject) as Record<string, unknown>;
  const projectUserId = typeof project.user_id === 'number' ? project.user_id : null;
  if (projectUserId && projectUserId !== userId) return null;
  return { kind: 'redis', redisKey, project };
};

const updateRedisProject = async (redisKey: string, project: Record<string, unknown>, update: Record<string, unknown>) => {
  const next = {
    ...project,
    ...update,
    updated_at: new Date().toISOString(),
  };
  await redis.setex(redisKey, 86400, JSON.stringify(next));
  return next;
};

const buildDiscoveryMarkdownReport = (projectDescription: string, discoveryData: Record<string, unknown>): string => {
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
};

const send = (ws: WebSocket, payload: Record<string, unknown>) => {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
};

export const registerDiscoveryChatSocketService = (server: HttpServer) => {
  const wss = new WebSocketServer({ server, path: '/ws/discovery' });
  console.log('[WS][Discovery] Serviço WebSocket registrado em /ws/discovery');

  wss.on('connection', (ws, req) => {
    const headerUserId = parseUserIdFromRequest(req);
    console.log('[WS][Discovery] Nova conexão recebida', { headerUserId });

    send(ws, {
      type: 'connection_ack',
      message: 'Conexão estabelecida com o chat do Structured Discovery.',
    });

    ws.on('message', async (rawMessage) => {
      const raw = String(rawMessage ?? '');
      console.log('[WS][Discovery] Mensagem recebida', raw);

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(raw) as Record<string, unknown>;
      } catch (error) {
        console.error('[WS][Discovery] Erro de parse JSON', error);
        send(ws, { type: 'error', message: 'Formato de mensagem inválido.' });
        return;
      }

      if (payload.type !== 'discovery_chat_user_message') {
        console.log('[WS][Discovery] Tipo de mensagem ignorado', payload.type);
        return;
      }

      const projectId = String(payload.projectId ?? '').trim();
      const userMessage = String(payload.message ?? '').trim();
      const payloadUserId = parseUserId(payload.userId);
      const userId = payloadUserId ?? headerUserId;

      if (!projectId || !userMessage) {
        send(ws, { type: 'error', message: 'projectId e message são obrigatórios.' });
        return;
      }

      try {
        console.log('[WS][Discovery] Carregando projeto para chat', { projectId, userId });
        const loaded = await loadProjectForStage(projectId, userId);
        if (!loaded) {
          send(ws, { type: 'error', message: 'Projeto não encontrado ou acesso negado.' });
          return;
        }

        const sessionKey = `${projectId}:${userId ?? 'anonymous'}`;
        const session = getSession(sessionKey);
        session.messages.push({ role: 'user', text: userMessage });

        const projectName = loaded.kind === 'db' ? loaded.project.name : String(loaded.project.name ?? '');
        const projectDescriptionRaw = loaded.kind === 'db' ? loaded.project.description : loaded.project.description;
        const projectDescription = typeof projectDescriptionRaw === 'string' ? projectDescriptionRaw : '';

        send(ws, { type: 'processing_started' });
        console.log('[WS][Discovery] Acionando análise LLM do turno de chat');

        const decision = await analyzeDiscoveryChatTurn({
          projectName,
          projectDescription,
          conversationHistory: session.messages,
          userMessage,
        });

        console.log('[WS][Discovery] Decisão LLM recebida', decision);

        let nextProject: Project | Record<string, unknown> = loaded.kind === 'db' ? loaded.project : loaded.project;
        const updatedName = decision.updated_project_name ?? projectName;
        const updatedDescription = decision.updated_project_description ?? projectDescription;
        const hasProjectUpdate =
          updatedName !== projectName ||
          updatedDescription !== projectDescription;

        if (hasProjectUpdate) {
          console.log('[WS][Discovery] Atualizando projeto com novo contexto');
          if (loaded.kind === 'db') {
            await loaded.project.update({
              name: updatedName,
              description: updatedDescription,
            });
            nextProject = loaded.project;
          } else {
            nextProject = await updateRedisProject(loaded.redisKey, loaded.project, {
              name: updatedName,
              description: updatedDescription,
            });
          }
          send(ws, { type: 'project_updated', project: nextProject });
        }

        const assistantMessage =
          decision.assistant_message.trim().length > 0
            ? decision.assistant_message
            : decision.intent === 'ready_to_generate'
              ? 'Perfeito, vou iniciar agora a geração do Structured Discovery.'
              : 'Pode me passar mais detalhes para eu atualizar o contexto do projeto?';

        session.messages.push({ role: 'assistant', text: assistantMessage });
        send(ws, {
          type: 'assistant_message',
          message: assistantMessage,
          intent: decision.intent,
          fields_to_clarify: decision.fields_to_clarify,
          ready_reason: decision.ready_reason,
        });

        if (decision.intent === 'ready_to_generate') {
          console.log('[WS][Discovery] Usuário pronto, iniciando geração Structured Discovery');
          send(ws, { type: 'generation_started' });

          const descriptionForGeneration = hasProjectUpdate ? updatedDescription : projectDescription;
          const discoveryData = await generateStage1_Discovery(descriptionForGeneration);
          const discoveryMarkdown = buildDiscoveryMarkdownReport(
            descriptionForGeneration,
            discoveryData as unknown as Record<string, unknown>
          );
          const renderedHtml = markdownToHtmlService.toHtml(discoveryMarkdown);
          const discoveryDataWithHtml = {
            ...(discoveryData as unknown as Record<string, unknown>),
            rendered_html: renderedHtml,
          };

          if (loaded.kind === 'db') {
            await loaded.project.update({ discovery_data: discoveryDataWithHtml });
            nextProject = loaded.project;
          } else {
            nextProject = await updateRedisProject(loaded.redisKey, nextProject as Record<string, unknown>, {
              discovery_data: discoveryDataWithHtml,
            });
          }

          send(ws, {
            type: 'generation_completed',
            project: nextProject,
            discovery_data: discoveryDataWithHtml,
          });
          console.log('[WS][Discovery] Geração Structured Discovery concluída');
        }
      } catch (error) {
        console.error('[WS][Discovery] Erro no processamento da mensagem', error);
        send(ws, { type: 'error', message: 'Falha ao processar mensagem do chat.' });
      } finally {
        send(ws, { type: 'processing_finished' });
      }
    });

    ws.on('close', () => {
      console.log('[WS][Discovery] Conexão encerrada');
    });

    ws.on('error', (error) => {
      console.error('[WS][Discovery] Erro de conexão', error);
    });
  });
};
