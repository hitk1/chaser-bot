import { ILlmService, LlmMessage } from '../../ports/llm.port';
import { KnowledgeEntry } from '../../../domain/knowledge/knowledge-entry.entity';
import { IKnowledgeRepository } from '../../../domain/knowledge/knowledge.repository';
import { KNOWLEDGE_SANITIZATION_PROMPT } from '../../constants/game-prompts';
import { AddKnowledgeInput, AddKnowledgeOutput } from './add-knowledge.dto';
import { createLogger } from '../../../bootstrap/logger';

const logger = createLogger('add-knowledge');

interface SanitizationResult {
  sanitizedContent: string;
  tags: string[];
}

function parseSanitizationResponse(llmResponse: string): SanitizationResult {
  const stripped = llmResponse
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  const jsonStart = stripped.indexOf('{');
  const jsonEnd = stripped.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('LLM did not return a valid JSON sanitization response');
  }

  return JSON.parse(stripped.slice(jsonStart, jsonEnd + 1)) as SanitizationResult;
}

export class AddKnowledgeUseCase {
  constructor(
    private readonly knowledgeRepository: IKnowledgeRepository,
    private readonly llmService: ILlmService,
  ) {}

  async execute(input: AddKnowledgeInput): Promise<AddKnowledgeOutput> {
    const { rawContent, addedByUserId } = input;

    logger.info(
      { addedByUserId, rawContentLength: rawContent.length },
      '[ADD-KNOWLEDGE][USE-CASE] Adding knowledge entry',
    );

    const sanitizationPrompt = KNOWLEDGE_SANITIZATION_PROMPT.replace('{rawContent}', rawContent);
    const sanitizationMessage: LlmMessage = { role: 'user', content: sanitizationPrompt };

    const llmResponse = await this.llmService.chat([sanitizationMessage]);
    const { sanitizedContent, tags } = parseSanitizationResponse(llmResponse);

    const knowledgeEntry = await this.knowledgeRepository.create({
      source: 'user',
      rawContent,
      sanitizedContent,
      tags,
      addedByUserId,
    });

    logger.info(
      { entryId: knowledgeEntry.id, tagCount: knowledgeEntry.tags.length },
      '[ADD-KNOWLEDGE][USE-CASE] Knowledge entry saved',
    );
    return knowledgeEntry;
  }
}
