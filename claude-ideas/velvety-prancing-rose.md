# Plano: Refatoração de Comandos + Respostas em Thread

## Context

O bot precisa de uma refatoração para aumentar precisão e usabilidade:
- Reduzir a lista de comandos a apenas `/ask` (renomeado de `/web`) e `/wiki`
- O `/ask` deve sempre fazer busca web antes de responder, tornando-se a interação padrão
- Respostas do `/ask` devem incluir seção "Links Relacionados" com as fontes
- Usuários devem poder continuar conversas respondendo mensagens do bot (reply do Discord), sem precisar de novo slash command
- Cada `/ask` cria uma nova sessão; cada reply continua a sessão existente

---

## Arquivo de progresso

Durante a execução, registrar cada etapa concluída em:
`/Users/luispaulomartinsdegini/development/projects/chaser-bot/claude-ideas/refactor-progress.md`

---

## Arquivos críticos

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | Add `discordMessageId String? @unique` ao model `Message` |
| `src/domain/session/message.entity.ts` | Add `discordMessageId?: string` |
| `src/domain/session/session.repository.ts` | Add `findByDiscordMessageId` e `linkDiscordMessageToSession` |
| `src/infrastructure/database/prisma-session.repository.ts` | Implementar 2 novos métodos |
| `src/application/use-cases/ask-question/ask-question.dto.ts` | Add `forceNewSession?` e `existingSessionId?` |
| `src/application/use-cases/resolve-active-session/resolve-active-session.use-case.ts` | Suportar `forceNewSession` e `existingSessionId` |
| `src/application/use-cases/ask-question/ask-question.use-case.ts` | Pass-through novos campos |
| `src/application/use-cases/search-web/search-web.use-case.ts` | Add `forceNewSession: true` + seção links |
| `src/application/use-cases/handle-reply/handle-reply.use-case.ts` | **NOVO** |
| `src/presentation/discord/commands/ask.command.ts` | Reescrever para registrar `/ask` (ex-`/web`) |
| `src/presentation/discord/command-handler.ts` | Remover comandos desativados; renomear `handleWeb` → `handleAsk`; capturar Discord message ID |
| `src/presentation/discord/event-handler.ts` | Add `messageCreate` listener; injetar `commandConfig` |
| `src/bootstrap/discord-client.ts` | Add `GuildMessages` + `MessageContent` intents |
| `src/main.ts` | Remover use cases desativados do DI; registrar `HandleReplyUseCase`; injetar `sessionRepository` no `CommandHandler` |

---

## Steps de Implementação

### Step 1 — Schema + Domínio

**1.1** `prisma/schema.prisma`: adicionar ao model `Message`:
```
discordMessageId  String?  @unique
```

**1.2** Rodar `npx prisma migrate dev --name add_discord_message_id_to_message`

**1.3** `src/domain/session/message.entity.ts`: add `discordMessageId?: string`

**1.4** `src/domain/session/session.repository.ts`: adicionar 2 métodos na interface:
```typescript
findByDiscordMessageId(discordMessageId: string): Promise<Session | null>;
linkDiscordMessageToSession(sessionId: string, discordMessageId: string): Promise<void>;
```

Também atualizar assinatura de `appendMessage` para aceitar `discordMessageId?` opcional no final.

---

### Step 2 — Infraestrutura (Prisma Repository)

**2.1** `src/infrastructure/database/prisma-session.repository.ts`:

- `findByDiscordMessageId`: busca via `message.findUnique({ where: { discordMessageId } })` incluindo session + messages
- `linkDiscordMessageToSession`: encontra o `message` assistente mais recente sem `discordMessageId` na session e faz `update`
- Atualizar `appendMessage` para aceitar e persistir `discordMessageId?`
- Atualizar mapper `toMessage` para incluir o campo

---

### Step 3 — Use Cases: Session Resolution

**3.1** `src/application/use-cases/ask-question/ask-question.dto.ts`:
```typescript
export interface AskQuestionInput {
  // campos existentes...
  forceNewSession?: boolean;
  existingSessionId?: string;
}
```

**3.2** `src/application/use-cases/resolve-active-session/resolve-active-session.use-case.ts`:

Adicionar campos ao input e lógica:
- Se `existingSessionId` → `findById(existingSessionId)` (lança erro se não encontrar)
- Se `forceNewSession` → sempre `create()` (ignora inatividade)
- Senão → comportamento atual (inactivity check)

**3.3** `src/application/use-cases/ask-question/ask-question.use-case.ts`:

Passar `forceNewSession` e `existingSessionId` para `resolveActiveSession.execute()`.

---

### Step 4 — Use Case: SearchWeb + Links Relacionados

**4.1** `src/application/use-cases/search-web/search-web.use-case.ts`:

- Passar `forceNewSession: true` ao chamar `askQuestion.execute()`
- Após receber `output`, se `results.length > 0` e sem `warningMessage`, append:
```
\n\n## Links Relacionados\n[1] [Título](url)\n[2] [Título](url)\n...
```
- **NÃO** modificar `SearchWikiUseCase` — `/wiki` mantém comportamento atual de sessão

---

### Step 5 — Use Case: HandleReply (NOVO)

**5.1** Criar `src/application/use-cases/handle-reply/handle-reply.use-case.ts`:

```typescript
// Input
export interface HandleReplyInput {
  discordUserId: string;
  username: string;
  channelId: string;
  question: string;
  repliedToMessageId: string;
  throttle: ThrottleConfig;
  sessionInactivityMinutes: number;
}
// Output = AskQuestionOutput
```

Lógica:
1. `sessionRepository.findByDiscordMessageId(repliedToMessageId)`
2. Se não encontrado → retorna `{ answer: 'Não encontrei a conversa original. Use /ask para iniciar uma nova.', sessionId: '' }`
3. Se encontrado → `askQuestion.execute({ ..., existingSessionId: session.id, systemPrompt: BASE_GRANDCHASE_SYSTEM_PROMPT })`

---

### Step 6 — Presentation: CommandHandler

**6.1** `src/presentation/discord/command-handler.ts`:

**Interface `UseCases` (nova):**
```typescript
export interface UseCases {
  searchWiki: SearchWikiUseCase;
  searchWeb: SearchWebUseCase;
  handleReply: HandleReplyUseCase;
  sessionRepository: ISessionRepository; // para linkDiscordMessageToSession pós-envio
}
```

**Remover** imports e métodos: `askQuestion`, `getEquipmentAdvice`, `getFarmingStrategy`, `getDamageTips`, `addKnowledge`, `listSessions`, `switchSession`, `deleteSession`

**Renomear** `handleWeb` → `handleAsk`. No corpo, após `searchWeb.execute()`:
```typescript
// Capturar o Discord message ID da primeira mensagem enviada
const sentMsg = await interaction.editReply(output.warningMessage ?? firstChunk);
if (!output.warningMessage && output.sessionId) {
  await this.useCases.sessionRepository.linkDiscordMessageToSession(
    output.sessionId,
    sentMsg.id,
  );
}
```

**Adicionar** `public async handleReply(input: HandleReplyInput): Promise<string>` que chama `this.useCases.handleReply.execute(input)` e retorna `output.warningMessage ?? output.answer`.

**Handlers map**: manter apenas `ask` e `wiki`.

**Remover** `HELP_TEXT`, `handleHelp`, `handleAsk` (antigo), `handleEquipment`, `handleFarming`, `handleDamage`, `handleAddKnowledge`, `handleSession`, `formatRelativeTime`.

---

### Step 7 — Presentation: EventHandler + Discord Client

**7.1** `src/bootstrap/discord-client.ts` (ou onde o Client é criado):

Adicionar intents:
```typescript
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
```
> **Requisito de deploy:** Habilitar "Message Content Intent" no Discord Developer Portal.

**7.2** `src/presentation/discord/event-handler.ts`:

- Injetar `commandConfig: CommandConfig` no constructor
- Adicionar listener `messageCreate`:
```typescript
this.client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.reference?.messageId) return;

  const repliedTo = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
  if (!repliedTo || repliedTo.author.id !== this.client.user?.id) return;

  const answer = await this.commandHandler.handleReply({
    discordUserId: message.author.id,
    username: message.author.username,
    channelId: message.channelId,
    question: message.content,
    repliedToMessageId: message.reference.messageId,
    throttle: this.commandConfig.throttle,
    sessionInactivityMinutes: this.commandConfig.sessionInactivityMinutes,
  });

  const chunks = splitIntoChunks(answer, MAX_MESSAGE_LENGTH);
  const sentMsg = await message.reply(chunks[0]);
  // Continuar a cadeia de reply linkando o novo message ID
  if (sentMsg) {
    await this.commandHandler.linkLastReplyToSession(output.sessionId, sentMsg.id);
  }
  for (const chunk of chunks.slice(1)) {
    await message.channel.send(chunk);
  }
});
```

Exportar `splitIntoChunks` do `command-handler.ts` ou duplicar (é pequeno).

---

### Step 8 — Commands: ask.command.ts

**8.1** `src/presentation/discord/commands/ask.command.ts`:

Reescrever para registrar comando `/ask` com a descrição do ex-`/web`:
```
Busca informações atualizadas da comunidade GrandChase e responde sua pergunta
```
O `web.command.ts` é mantido no disco mas não exportado/registrado.

---

### Step 9 — DI em main.ts

**9.1** `src/main.ts`:

- Remover instanciações: `getEquipmentAdvice`, `getFarmingStrategy`, `getDamageTips`, `addKnowledge`, `listSessions`, `switchSession`, `deleteSession`, `askQuestion` (direto)
- Adicionar: `const handleReply = new HandleReplyUseCase(sessionRepository, askQuestion, logger)`
- Atualizar `CommandHandler` constructor: passar `{ searchWiki, searchWeb, handleReply, sessionRepository }` 
- Atualizar `EventHandler` constructor: passar `commandConfig`
- `commandBodies`: apenas `[askCommand, wikiCommand]`

---

### Step 10 — Testes

**10.1** Atualizar `command-handler.spec.ts`:
- Slimmar `UseCases` fake para apenas os 3 (+sessionRepository)
- `FakeDiscordInteraction.editReply()` deve retornar `{ id: 'fake-msg-id' }` (Discord.js retorna `Message`)
- Remover tests de comandos desativados
- Adicionar: test de `/ask` verifica "Links Relacionados" no reply quando resultados existem
- Renomear tests de `/web` → `/ask`

**10.2** `search-web.use-case.spec.ts`:
- Cada `execute()` deve criar uma nova sessão (múltiplas calls → múltiplas sessions)
- Com resultados: answer contém `## Links Relacionados`
- Sem resultados ou throttled: sem a seção de links

**10.3** `resolve-active-session.use-case.spec.ts`:
- `forceNewSession: true` sempre cria nova sessão mesmo com ativa existente
- `existingSessionId` retorna sessão específica

**10.4** Criar `handle-reply.use-case.spec.ts`:
- `discordMessageId` sem match → retorna mensagem de "conversa não encontrada"
- `discordMessageId` com match → continua conversa com histórico correto

**10.5** Adicionar testes de `findByDiscordMessageId` e `linkDiscordMessageToSession` no repo spec

---

## Verificação End-to-End

1. `npm run build` — sem erros TypeScript
2. `npm test` — todos os testes passam (incluindo novos)
3. Deploy local com `npm run dev`:
   - `/ask pergunta` → responde com links no final
   - `/wiki pergunta` → responde sem links (comportamento atual)
   - Responder a uma mensagem do bot → bot continua a conversa
   - `/equipment`, `/farming`, etc → "comando não encontrado" (não mais registrado no Discord)

---

## Notas Importantes

- **`/wiki` não muda** em nada o comportamento de sessão — `SearchWikiUseCase` não recebe `forceNewSession`
- **Sessões agora são 1-por-/ask**: cada `/ask` gera uma conversa separada (thread)
- **Usuário pode ter N sessões ativas simultâneas** respondendo N mensagens diferentes do bot
- **Deployar** exige habilitar "Message Content Intent" no Discord Developer Portal
