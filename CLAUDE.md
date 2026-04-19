# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GrandChase Discord bot (Node.js/TypeScript) that answers game-related questions using OpenAI LLM with function-calling (web search, wiki, knowledge lookup). Uses SQLite via Prisma ORM. Deployed to Railway via GitHub.

## Commands

```bash
npm run dev              # Start with hot-reload (tsx watch)
npm run build            # Compile TypeScript (tsc)
npm start                # Run compiled output (dist/main.js)
npm test                 # Run all tests (jest, serial with maxWorkers=1)
npm test -- --testPathPattern="ask-question"  # Run a single test file
npm run test:coverage    # Tests with coverage report (80% line threshold)
npm run lint             # ESLint (typescript-eslint)
npm run format           # Prettier
npm run db:migrate       # prisma migrate deploy
npm run db:generate      # prisma generate (also runs on postinstall)
```

## Architecture

DDD layered architecture with strict dependency direction: `presentation -> application -> domain <- infrastructure`.

### Layers

- **domain/** — Entities (`Session`, `User`, `ThrottleEntry`, `KnowledgeEntry`, `Message`) and repository interfaces. Pure domain logic, no framework dependencies.
- **application/** — Use cases orchestrate domain logic. Each use case lives in its own directory with DTO, implementation, and spec file. Ports define abstractions for LLM and web search.
- **infrastructure/** — Prisma repository implementations, OpenAI LLM service, Brave Search service, and LLM function registry (tool-calling functions the LLM can invoke).
- **presentation/** — Discord slash command definitions and handler. `CommandHandler` maps Discord interactions to use cases. `EventHandler` wires Discord.js client events.
- **bootstrap/** — App wiring: env validation (Zod schema), logger (pino), Prisma client, OpenAI client, Discord client. Manual dependency injection in `main.ts`.

### Key Patterns

- **Composition root in `main.ts`** — All dependencies are wired manually (no DI container).
- **Use case composition** — Specialized use cases (`GetEquipmentAdvice`, `GetFarmingStrategy`, `GetDamageTips`) delegate to `AskQuestionUseCase` with game-specific system prompts defined in `application/constants/game-prompts.ts`.
- **Function registry** — `FunctionRegistry` manages OpenAI tool-calling functions. Functions are registered at boot and passed to the LLM service.
- **Throttle policy** — Domain-level rate limiting via `ThrottlePolicy` (pure logic, tested without DB).
- **Session management** — Users have conversation sessions scoped to Discord channels with automatic inactivity-based session rotation.
- **Slash commands auto-register** per guild on bot startup and guild join.
- **Discord 2000-char limit** — Long LLM responses are split into chunks before sending.

## Testing

- Tests use a **real SQLite database** (`prisma/test.db`), not mocks. Global setup runs `prisma migrate deploy` against the test DB.
- `src/test/use-case-factory.ts` provides helper factories for instantiating use cases with real repositories.
- `FakeLlmService` is the only fake — used instead of hitting OpenAI.
- `src/test/db-helpers.ts` has utilities for cleaning DB state between tests.
- Test files are co-located with their source: `*.spec.ts` next to the implementation.

## Environment Variables

Required: `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `OPENAI_API_KEY`, `DATABASE_URL`
Optional: `SEARCH_API_KEY`, `OPENAI_MODEL` (default: gpt-4o-mini), `OPENAI_MAX_TOKENS` (default: 1024), throttle/session config. Full schema in `src/bootstrap/env.ts`.

## Language

The bot responds in Portuguese (pt-BR). User-facing messages and game prompts are in Portuguese.
