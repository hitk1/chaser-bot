import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { FakeLlmService } from '../../../test/fakes/fake-llm.service';
import { makeRepositories } from '../../../test/use-case-factory';
import { AddKnowledgeUseCase } from './add-knowledge.use-case';

describe('AddKnowledgeUseCase', () => {
  let llmService: FakeLlmService;
  let addKnowledge: AddKnowledgeUseCase;

  beforeEach(async () => {
    await clearDatabase();
    llmService = new FakeLlmService();
    const { knowledgeRepository } = makeRepositories();
    addKnowledge = new AddKnowledgeUseCase(knowledgeRepository, llmService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stores a knowledge entry with sanitized content and tags from LLM', async () => {
    llmService.queueResponse('{"sanitizedContent":"Mago usa carta X no slot Y","tags":["mage","equipment","card"]}');

    const entry = await addKnowledge.execute({ rawContent: 'mago usa carta X no slot Y e é muito bom' });

    expect(entry.sanitizedContent).toBe('Mago usa carta X no slot Y');
    expect(entry.tags).toEqual(['mage', 'equipment', 'card']);
    expect(entry.source).toBe('user');
    expect(entry.id).toBeDefined();
  });

  it('persists the raw content as-is', async () => {
    const rawContent = 'mago usa carta X no slot Y e é muito bom';
    llmService.queueResponse('{"sanitizedContent":"cleaned","tags":["mage"]}');

    const entry = await addKnowledge.execute({ rawContent });

    expect(entry.rawContent).toBe(rawContent);
  });

  it('stores addedByUserId when provided', async () => {
    llmService.queueResponse('{"sanitizedContent":"dica","tags":["warrior"]}');

    const entry = await addKnowledge.execute({
      rawContent: 'guerreiro é forte',
      addedByUserId: 'user-abc',
    });

    expect(entry.addedByUserId).toBe('user-abc');
  });

  it('parses LLM response wrapped in markdown code blocks', async () => {
    llmService.queueResponse('```json\n{"sanitizedContent":"dica limpa","tags":["archer"]}\n```');

    const entry = await addKnowledge.execute({ rawContent: 'arqueiro usa arco' });

    expect(entry.sanitizedContent).toBe('dica limpa');
    expect(entry.tags).toContain('archer');
  });

  it('entry is searchable by its tags after being stored', async () => {
    llmService.queueResponse('{"sanitizedContent":"Mago usa carta X","tags":["mage","build"]}');
    await addKnowledge.execute({ rawContent: 'mago usa carta X' });

    const { knowledgeRepository } = makeRepositories();
    const results = await knowledgeRepository.searchByTags(['mage']);
    expect(results).toHaveLength(1);
    expect(results[0].sanitizedContent).toBe('Mago usa carta X');
  });
});
