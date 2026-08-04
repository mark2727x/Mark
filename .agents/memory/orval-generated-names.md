---
name: Orval generated Zod schema names
description: How Orval v8 names the generated Zod schemas; backend routes must import these exact names.
---

## Rule
When importing Orval-generated Zod schemas in API routes, always check `lib/api-zod/src/generated/api.ts` for the actual export names — do not guess from the OpenAPI schema name.

**Why:** Orval derives export names from operation IDs, not schema names. E.g. `ShiftInput` (the OpenAPI schema) becomes `CreateShiftBody` (from operationId `createShift`). Guessing the wrong name causes esbuild "No matching export" build errors.

**Key mappings (as of current spec):**
- register body → `RegisterBody`
- login body → `LoginBody`
- create shift body → `CreateShiftBody`
- update shift body → `UpdateShiftBody`
- update me body → `UpdateMeBody`
- create rating body → `CreateRatingBody`
- response types follow the same pattern: `CreateShiftResponse`, `ListShiftsResponse`, etc.
