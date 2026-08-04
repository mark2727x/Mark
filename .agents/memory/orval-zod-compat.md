---
name: Orval Zod v3/v4 compatibility
description: Orval v8 generates Zod v4 API calls but the workspace resolves `zod` to v3; workarounds needed in the OpenAPI spec.
---

## Rule
Never use `type: integer` or `format: email` in `openapi.yaml`. Use `type: number` and `type: string` (without email format) instead.

**Why:** Orval v8.23 generates `zod.int()` for `type: integer` and `zod.email()` for `format: email`. These are Zod v4 top-level functions. The workspace resolves `import * as zod from 'zod'` to `zod@3.25.76` where these don't exist, causing TypeScript errors.

**How to apply:** Any time the OpenAPI spec is edited, grep for `integer` and `format: email` and replace them before running `pnpm --filter @workspace/api-spec run codegen`. Also watch for `type: ["integer", "null"]` nullable variants — replace with `type: ["number", "null"]`.
