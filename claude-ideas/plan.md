# chaser-bot — Implementation Plan

## Context

Build a Discord bot from scratch for a GrandChase MMORPG game knowledge base. The bot will serve < 10 active users in a private Discord server, responding to slash commands using an OpenAI LLM with function-calling support. The repository is currently empty — only the spec doc (`chaser.md`) exists. Stack: Node.js + TypeScript, discord.js, OpenAI API, Prisma + SQLite, Pino logging, Jest tests. Deploy on Railway via GitHub.

---

## Project Structure (DDD + SOLID)

```
chaser-bot/
├── .env.example
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── jest.config.ts
├── tsconfig.json
├── tsconfig.build.json
├── package.json
├── railway.json
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── src/
│   ├── main.ts
│   ├── bootstrap/
│   │   ├── env.ts                  # zod env schema → typed Config export
│   │   ├── logger.ts               # Pino factory (pino-pretty in dev, NDJSON in prod)
│   │   ├── discord-client.ts
│   │   ├── openai-client.ts
│   │   └── prisma-client.ts        # PrismaClient singleton w/ graceful shutdown
│   │
│   ├── domain/
│   │   ├── user/
│   │   │   ├── user.entity.ts
│   │   │   └── user.repository.ts  # IUserRepository interface
│   │   ├── session/
│   │   │   ├── session.entity.ts   # Aggregate root w/ addMessage(), isExpired(), isActive(), toPromptMessages()
│   │   │   ├── message.entity.ts
│   │   │   └── session.repository.ts  # findActive(), findAllByUser(), delete()
│   │   ├── throttle/
│   │   │   ├── throttle.entity.ts
│   │   │   ├── throttle.policy.ts  # Pure function: evaluate(timestamps, max) → { allowed }
│   │   │   └── throttle.repository.ts
│   │   └── knowledge/
│   │       ├── knowledge-entry.entity.ts  # source, rawContent, sanitizedContent, tags
│   │       └── knowledge.repository.ts    # IKnowledgeRepository interface
│   │
│   ├── application/
│   │   ├── ports/
│   │   │   ├── llm.port.ts         # ILlmService interface (owned by app layer)
│   │   │   └── web-search.port.ts
│   │   └── use-cases/
│   │       ├── ask-question/
│   │       │   ├── ask-question.use-case.ts
│   │       │   ├── ask-question.dto.ts
│   │       │   └── ask-question.use-case.spec.ts
│   │       ├── get-equipment-advice/
│   │       ├── get-farming-strategy/
│   │       ├── get-damage-tips/
│   │       ├── check-throttle/
│   │       ├── add-knowledge/                        # sanitize + store KnowledgeEntry
│   │       │   ├── add-knowledge.use-case.ts
│   │       │   ├── add-knowledge.dto.ts
│   │       │   └── add-knowledge.use-case.spec.ts
│   │       ├── list-sessions/                        # list user's sessions
│   │       ├── switch-session/                       # resume an existing session
│   │       ├── delete-session/                       # delete a specific session
│   │       └── resolve-active-session/               # get-or-create session respecting TTL
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── prisma-user.repository.ts
│   │   │   ├── prisma-session.repository.ts
│   │   │   ├── prisma-throttle.repository.ts
│   │   │   └── prisma-knowledge.repository.ts
│   │   ├── llm/
│   │   │   ├── openai-llm.service.ts
│   │   │   ├── function-registry.ts
│   │   │   └── functions/
│   │   │       ├── web-search.function.ts
│   │   │       ├── grandchase-wiki.function.ts
│   │   │       └── knowledge-lookup.function.ts  # searches KnowledgeEntry records by tags/keywords
│   │   └── search/
│   │       └── brave-search.service.ts
│   │
│   ├── presentation/
│   │   └── discord/
│   │       ├── command-handler.ts
│   │       ├── event-handler.ts    # "ready" + "interactionCreate" Discord events
│   │       └── commands/
│   │           ├── ask.command.ts
│   │           ├── equipment.command.ts
│   │           ├── farming.command.ts
│   │           ├── damage.command.ts
│   │           ├── session.command.ts        # /session list | switch | delete subcommands
│   │           ├── add-knowledge.command.ts  # /add-knowledge content: string
│   │           └── help.command.ts
│   │
│   └── test/
│       ├── global-setup.ts         # prisma migrate deploy on :memory: SQLite
│       ├── global-teardown.ts
│       └── fakes/
│           └── fake-llm.service.ts # Real ILlmService impl, deterministic — no jest.fn()
│
└── scripts/
    └── deploy-commands.ts          # Idempotent slash command registration via Discord REST
```

---

## Dependencies

```json
{
  "dependencies": {
    "discord.js": "^14.x",
    "openai": "^4.x",
    "@prisma/client": "^5.x",
    "pino": "^9.x",
    "pino-pretty": "^11.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "prisma": "^5.x",
    "typescript": "^5.x",
    "@types/node": "^20.x",
    "tsx": "^4.x",
    "jest": "^29.x",
    "ts-jest": "^29.x",
    "@types/jest": "^29.x",
    "eslint": "^9.x",
    "@typescript-eslint/eslint-plugin": "^8.x",
    "@typescript-eslint/parser": "^8.x",
    "prettier": "^3.x"
  },
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/main.js",
    "deploy:commands": "tsx scripts/deploy-commands.ts",
    "db:migrate": "prisma migrate deploy",
    "db:generate": "prisma generate",
    "test": "jest",
    "test:coverage": "jest --coverage"
  }
}
```

---

## Prisma Schema

```prisma
model User {
  id             String          @id @default(cuid())
  discordUserId  String          @unique
  createdAt      DateTime        @default(now())
  sessions       Session[]
  rateLimitEntry RateLimitEntry?
}

model Session {
  id          String    @id @default(cuid())
  userId      String
  channelId   String
  title       String?   // auto-generated from first user message (truncated), shown in /session list
  createdAt   DateTime  @default(now())
  lastActiveAt DateTime @default(now())  // updated on every interaction; drives TTL check
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages    Message[]
  @@index([userId, channelId])
  @@index([userId, lastActiveAt])
}

model Message {
  id        String   @id @default(cuid())
  sessionId String
  role      String   // "user" | "assistant" | "tool" | "system"
  content   String
  toolName  String?
  createdAt DateTime @default(now())
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@index([sessionId])
}

model RateLimitEntry {
  id                 String   @id @default(cuid())
  userId             String   @unique
  requestTimestamps  String   // JSON array of ISO timestamps (rolling window)
  updatedAt          DateTime @updatedAt
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model KnowledgeEntry {
  id               String   @id @default(cuid())
  source           String   // "user" | "web" | "wiki"
  rawContent       String   // original text before sanitization
  sanitizedContent String   // cleaned text used for LLM context
  tags             String   // JSON array of keyword tags (e.g. ["mage", "equipment", "cards"])
  addedByUserId    String?  // Discord userId who added this entry (null if auto-fetched)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

`requestTimestamps` is stored as a JSON string — rolling window logic lives purely in `ThrottlePolicy`, a plain TypeScript class. Avoids a join table and is fine for < 10 users.

---

## Slash Commands

| Command                      | Options                                   | Use Case                     | Description                                       |
|------------------------------|-------------------------------------------|------------------------------|---------------------------------------------------|
| `/ask`                       | `question: string`                        | `AskQuestionUseCase`         | General GrandChase question                       |
| `/equipment`                 | `character: string`, `slot: string`       | `GetEquipmentAdviceUseCase`  | Best card for a slot                              |
| `/farming`                   | `target: string`                          | `GetFarmingStrategyUseCase`  | Best place to farm an item                        |
| `/damage`                    | `character: string`                       | `GetDamageTipsUseCase`       | Maximize damage output for a character            |
| `/add-knowledge`             | `content: string`                         | `AddKnowledgeUseCase`        | Sanitize and store useful game knowledge          |
| `/session list`              | —                                         | `ListSessionsUseCase`        | Show user's recent sessions with titles           |
| `/session switch`            | `session_id: string`                      | `SwitchSessionUseCase`       | Resume a previous session                         |
| `/session delete`            | `session_id: string`                      | `DeleteSessionUseCase`       | Delete a specific session                         |
| `/help`                      | —                                         | static                       | List all commands                                 |

All LLM-backed commands must call `interaction.deferReply()` immediately — extends the 3s Discord timeout to 15 minutes.

---

## LLM Function-Calling Flow

Inside `OpenAiLlmService.chat()`:
1. Build messages array from session history + new user message
2. Build tools array from `FunctionRegistry.getDefinitions()`
3. Call `openai.chat.completions.create({ model, messages, tools, tool_choice: "auto" })`
4. If `finish_reason === "tool_calls"`: dispatch via `FunctionRegistry.execute(name, args)`, append tool result message, loop (max 3 iterations)
5. Return final `message.content`

**Registered functions:**
- `web_search({ query })` — calls Brave Search API, returns top 3 snippets
- `knowledge_lookup({ keywords })` — searches `KnowledgeEntry` records by tag/keyword match, returns sanitized content as context
- `grandchase_wiki({ topic })` — fetches structured data from GrandChase fandom wiki

---

## Environment Variables (.env.example)

```bash
# Discord
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=1024

# Search (enables web_search function)
SEARCH_API_KEY=
SEARCH_PROVIDER=brave

# Database
DATABASE_URL=file:./data/chaser.db

# Throttling
THROTTLE_MAX_REQUESTS=5
THROTTLE_WINDOW_SECONDS=60
THROTTLE_WARNING_MESSAGE="Hey {username}, calm down! Wait a bit before sending more requests."

# Session (inactivity-based TTL — a new interaction after this window opens a new session)
SESSION_INACTIVITY_MINUTES=10

# App
NODE_ENV=development
LOG_LEVEL=info
AUTO_REGISTER_COMMANDS=true
```

All parsed at boot via `zod` in `src/bootstrap/env.ts`. Missing required vars → process exits with a clear error before Discord/Prisma initialize.

---

## Testing Strategy (Minimal Mocking)

**a) Domain unit tests** — `ThrottlePolicy`, `Session` entity methods are pure TypeScript. No infrastructure needed.

**b) Use-case integration tests** — Real `PrismaClient` on an in-memory SQLite (`file::memory:?cache=shared`). `globalSetup` runs `prisma migrate deploy`. Each test truncates tables in `beforeEach`. No repository mocks.

**c) LLM tests** — Use `FakeLlmService` (a real class implementing `ILlmService` with deterministic responses) — NOT `jest.fn()` spies. This honors the "avoid mocks" preference while keeping tests fast and free. Real OpenAI calls live in a separate integration config, run in CI with real credentials only.

**d) Command handler tests** — Construct real use cases backed by in-memory SQLite + `FakeLlmService`. Call `CommandHandler.handle(fakeInteraction)` directly. No Discord bot connection needed.

```typescript
// jest.config.ts
{
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts", "!src/bootstrap/**"],
  coverageThreshold: { global: { lines: 80 } },
  globalSetup: "./src/test/global-setup.ts",
  globalTeardown: "./src/test/global-teardown.ts"
}
```

---

## Implementation Phases

### Phase 1 — Foundation
`package.json`, `tsconfig.json`, linting, `.gitignore`, `.env.example`, `bootstrap/env.ts` (zod), `bootstrap/logger.ts` (Pino), Prisma schema + first migration, `prisma-client.ts`, `main.ts` bootstrap skeleton.

**Checkpoint:** `npm run dev` starts, logs structured output, connects to SQLite.

### Phase 2 — Domain Layer
All entities and value objects (`User`, `Session`, `Message`, `RateLimitEntry`, `KnowledgeEntry`), repository interfaces, `ThrottlePolicy`. Unit tests for `ThrottlePolicy` and `Session` (including `isActive()` with inactivity TTL logic).

**Checkpoint:** `npm test` passes, pure domain logic covered.

### Phase 3 — Infrastructure Layer
All 4 Prisma repository implementations, `FakeLlmService`, `globalSetup` for in-memory SQLite, integration tests for each repository.

**Checkpoint:** All repository tests pass against real SQLite.

### Phase 4 — LLM Integration
`FunctionRegistry`, `web-search.function.ts`, `grandchase-wiki.function.ts`, `OpenAiLlmService`, `BraveSearchService`.

**Checkpoint:** Manual test script calls `OpenAiLlmService.chat()` and triggers a function call.

### Phase 5 — Application Use Cases
All use cases + their `.spec.ts` files using real SQLite + `FakeLlmService`: `AskQuestion`, `CheckThrottle`, `AddKnowledge`, `ResolveActiveSession`, `ListSessions`, `SwitchSession`, `DeleteSession`, `GetEquipmentAdvice`, `GetFarmingStrategy`, `GetDamageTips`.

**Checkpoint:** `npm run test:coverage` ≥ 80% on use cases.

### Phase 6 — Discord Presentation Layer ← ACTIVE

#### Context
Phases 1–5 are complete (108 tests passing). `main.ts` connects to SQLite but has no Discord wiring. The presentation layer needs to bridge Discord interactions to the existing use cases.

#### Files to create

```
src/presentation/discord/
├── command-handler.ts          ← dispatches all commands; receives use cases via constructor
├── command-handler.spec.ts     ← tests with FakeDiscordInteraction (real DB + FakeLlmService)
├── event-handler.ts            ← registers 'ready' + 'interactionCreate' on discord Client
└── commands/
    ├── ask.command.ts          ← SlashCommandBuilder definition only
    ├── equipment.command.ts
    ├── farming.command.ts
    ├── damage.command.ts
    ├── add-knowledge.command.ts
    ├── session.command.ts      ← subcommands: list | switch | delete
    └── help.command.ts

scripts/
└── deploy-commands.ts          ← idempotent REST PUT to Discord guild
```

#### Files to update
- `src/main.ts` — wire all repos, use cases, LLM service, command handler, event handler, login

---

#### Command definitions (SlashCommandBuilder, no handler logic)

| File | Command | Options |
|---|---|---|
| `ask.command.ts` | `/ask` | `question: string (required)` |
| `equipment.command.ts` | `/equipment` | `character: string (required)`, `slot: string (required)` |
| `farming.command.ts` | `/farming` | `target: string (required)` |
| `damage.command.ts` | `/damage` | `character: string (required)` |
| `add-knowledge.command.ts` | `/add-knowledge` | `content: string (required)` |
| `session.command.ts` | `/session` | subcommands: `list`, `switch (session_id)`, `delete (session_id)` |
| `help.command.ts` | `/help` | none |

---

#### CommandHandler design

```typescript
interface CommandConfig {
  throttle: ThrottleConfig;           // from config.*
  sessionInactivityMinutes: number;   // from config.SESSION_INACTIVITY_MINUTES
}

interface UseCases {
  askQuestion: AskQuestionUseCase;
  getEquipmentAdvice: GetEquipmentAdviceUseCase;
  getFarmingStrategy: GetFarmingStrategyUseCase;
  getDamageTips: GetDamageTipsUseCase;
  addKnowledge: AddKnowledgeUseCase;
  listSessions: ListSessionsUseCase;
  switchSession: SwitchSessionUseCase;
  deleteSession: DeleteSessionUseCase;
}

export class CommandHandler {
  constructor(useCases, commandConfig, logger) {}
  async handle(interaction: ChatInputCommandInteraction): Promise<void>
}
```

Per-command handler flow (private methods):
1. `await interaction.deferReply()` — always first, avoids 3-second Discord timeout
2. Extract options: `interaction.options.getString(...)`, `interaction.user.id`, etc.
3. Call use case
4. `await interaction.editReply(formattedText)`
5. On any error: log + `await interaction.editReply('Ocorreu um erro inesperado. Tente novamente.')`

Response formatting:
- LLM commands: plain answer text (Discord renders markdown natively)
- Throttle blocked: `warningMessage` string from use case
- `/session list`: bullet list `• \`{id}\` — {title} — {relativeTime}`
- `/session switch`: `✅ Sessão "{title}" ativada.`
- `/session delete`: `🗑️ Sessão deletada com sucesso.`
- `/help`: embed-style text listing all commands with descriptions

---

#### EventHandler design

```typescript
export class EventHandler {
  constructor(client: Client, commandHandler: CommandHandler, logger: Logger) {}
  register(): void   // attaches 'ready' and 'interactionCreate' listeners
}
```
- `ready`: logs `Bot online: {user.tag}`
- `interactionCreate`: guard `interaction.isChatInputCommand()`, then `commandHandler.handle(interaction)`

---

#### deploy-commands.ts (script)

```typescript
import { REST, Routes } from 'discord.js';
// imports all definitions from command files
const body = [ask, equipment, farming, damage, addKnowledge, session, help].map(c => c.toJSON());
const rest = new REST().setToken(config.DISCORD_BOT_TOKEN);
await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
```

---

#### Updated main.ts wiring order
1. Parse config + create logger
2. Connect Prisma
3. Create repos (PrismaUserRepository, PrismaSessionRepository, PrismaThrottleRepository, PrismaKnowledgeRepository)
4. Build FunctionRegistry with web_search, knowledge_lookup, grandchase_wiki functions
5. Create OpenAiLlmService (only if SEARCH_API_KEY present, otherwise no web_search)
6. Create use cases (CheckThrottle → ResolveActiveSession → AskQuestion → specialized ones)
7. Create CommandHandler + EventHandler
8. If AUTO_REGISTER_COMMANDS: run deploy-commands logic inline
9. `discordClient.login(config.DISCORD_BOT_TOKEN)`

---

#### CommandHandler tests (command-handler.spec.ts)

Uses `FakeDiscordInteraction` class (real interface, not jest.fn()):
```typescript
class FakeDiscordInteraction {
  commandName: string;
  user = { id: 'discord-test-user', username: 'Tester' };
  channelId = 'channel-test';
  private _reply = '';
  private _deferred = false;
  private options: Record<string, string | null> = {};

  isChatInputCommand() { return true; }
  async deferReply() { this._deferred = true; }
  async editReply(content: string) { this._reply = content; }
  getReply() { return this._reply; }
  isDeferred() { return this._deferred; }
  // sets getString options for the interaction
  withOptions(opts: Record<string, string>) { ... }
}
```

Key tests:
- `/ask` → LLM answer appears in `editReply`
- `/ask` throttled → warning message in `editReply`
- `/equipment` → answer includes handler logic
- `/farming` → answer from use case
- `/damage` → answer from use case
- `/add-knowledge` → confirms entry saved
- `/session list` → lists sessions (or "nenhuma sessão encontrada")
- `/session delete` → confirmation message
- `/session delete` with unknown ID → error message
- `/session switch` → confirmation message
- `/help` → lists commands
- `deferReply()` is always called before `editReply()`

---

#### Checkpoint
- `npm run deploy:commands` registers all 7 slash commands in the guild
- `npm test` still passes (108+ tests)
- `npm run dev` → bot comes online, `/help` responds, `/ask question:...` calls use case pipeline

### Phase 7 — CI/CD & Polish
`railway.json`, GitHub Actions (lint → test → build on PR), initial `GameContext` seed data for GrandChase knowledge (equipment cards, class guides), final coverage check.

**`railway.json` deploy command:**
```
npm run db:migrate && npm run deploy:commands && npm start
```

---

## Key Architectural Decisions

- **`KnowledgeEntry` table (not static seeds)**: Context is primarily generated at runtime via function-calling (web search, wiki). `KnowledgeEntry` stores only user-curated knowledge added via `/add-knowledge`. The LLM calls `knowledge_lookup` as a tool, so it pulls relevant entries on demand — no pre-loading.
- **`/add-knowledge` sanitization flow**: `AddKnowledgeUseCase` sends the raw input to the LLM with a sanitization prompt (strip noise, extract key facts, generate tags). The LLM returns structured `{ sanitizedContent, tags }`, which is then stored. The source tag (`"user"`) records who contributed it.
- **Session TTL is inactivity-based, not wall-clock**: `Session.lastActiveAt` is updated on every interaction. `ResolveActiveSessionUseCase` checks `now - lastActiveAt > SESSION_INACTIVITY_MINUTES` — if stale, a new session is created automatically. No cron needed.
- **Session titles for UX**: The first user message of a session is truncated (≤ 40 chars) and stored as `title`. This lets `/session list` show meaningful names like "qual o melhor set para mago?" instead of a raw ID.
- **`requestTimestamps` as JSON string**: Keeps throttle state atomic (one row per user); business rule lives in pure `ThrottlePolicy`. Fine for < 10 users.
- **`FakeLlmService` over mocks**: Implements `ILlmService` with real in-memory logic, no `jest.fn()` coupling. Honors the "avoid mocks" preference.
- **`interaction.deferReply()` always first**: Prevents the 3-second Discord timeout while LLM responds.

---

## Verification

1. `npm run dev` — bot comes online, logs show structured Pino output
2. `npm test` — all use cases green, coverage ≥ 80%
3. `/ask question:qual o melhor set para mago?` — bot defers, calls OpenAI, returns answer
4. Send 6 requests in 60s — bot warns with throttle message on the 6th
5. `/add-knowledge content:Mago usa carta X no slot Y` — bot confirms entry saved with auto-generated tags
6. `/session list` — bot shows recent sessions with titles and IDs
7. `/session delete session_id:abc` — bot confirms deletion
8. Wait 10+ min → send `/ask` → bot opens a new session automatically (inactivity TTL triggered)
9. Push to `main` → Railway deploys automatically
