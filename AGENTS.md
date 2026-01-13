# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages, layouts, and API routes (see `app/api/`).
- `app/components/`: reusable UI components.
- `lib/`: shared utilities and Supabase client/server helpers.
- `content/`: MDX content for blog posts.
- `public/`: static assets (images, icons, fonts).
- `supabase-setup.sql`: database setup notes for local Supabase.

## Build, Test, and Development Commands
- `bun dev`: run the Next.js dev server.
- `bun run build`: create a production build.
- `bun run start`: serve the static `out/` directory (assumes an export step exists).
- Tests are not wired up yet; add a test runner when introducing coverage.

## Coding Style & Naming Conventions
- TypeScript + React + Next.js; Tailwind for styling.
- Formatting is Prettier-driven (see `package.json`): single quotes, no semicolons.
- Prefer PascalCase component names and default exports for route files, e.g. `page.tsx`.
- Keep route segments descriptive and lowercase; use parentheses for grouping (see `app/work/(project)`).

## Testing Guidelines
- No test framework is configured.
- If adding tests, co-locate in a `__tests__/` folder or use `*.test.ts(x)` next to the module.
- Document any new test commands in `package.json`.

## Commit & Pull Request Guidelines
- Commit messages are short and informal, often in Chinese or English; keep them concise and descriptive.
- PRs should include a clear summary and link related issues when applicable.
- For UI changes, include before/after screenshots or a short screen capture.

## Security & Configuration Tips
- Use `.env.local` for secrets (e.g., Supabase/OpenAI keys) and keep them out of git.
- Verify API routes in `app/api/` handle missing env vars gracefully.
