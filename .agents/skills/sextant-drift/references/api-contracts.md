# API Contract Alignment

Verify route handlers in source against Markdown contract specs. Auto-detect probes `api-contract.md`, `docs/api-contract.md`, `contract.md`, `.sextant/contract.md` when `--contract` is omitted; if none exist, contract checks are skipped.

---

## 1. Contract Markdown formats

### Format A: Heading & list (detailed)

Each endpoint under `### METHOD /path`:

```markdown
# Order Management Service API

### POST /api/v1/orders
- [desc] Creates a new order and returns the generated order record
- [param] amount: number (required)
- [param] currency: string (required)
- [param] items: array (required)
- [param] couponCode: string (optional)
- [status] 201 (Created)
- [status] 400 (Bad Request - Invalid order payload)
- [status] 409 (Conflict - Duplicate order idempotency key)

### GET /api/v1/orders/:id
- [desc] Retrieve order status by ID
- [param] id: string (required)
- [status] 200 (OK)
- [status] 404 (Not Found)

### DELETE /api/v1/orders/:id
- [desc] Cancel a pending order
- [param] id: string (required)
- [status] 200 (OK)
- [status] 400 (Bad Request - Order cannot be cancelled)
```

Tags:
- `- [desc] <text>` — summary
- `- [param] <name>: <type> (required|optional)` — path/query/body field
- `- [status] <code> (<description>)` — allowed HTTP status

### Format B: Table (compact inventory)

```markdown
# User Service API Matrix

| Method | Path | Description | Status Codes |
| :--- | :--- | :--- | :--- |
| GET | /api/v1/users | List all active users | 200, 401 |
| POST | /api/v1/users | Register a new user account | 201, 400, 409 |
| GET | /api/v1/users/:id | Fetch user profile by ID | 200, 404 |
| PUT | /api/v1/users/:id | Update user profile fields | 200, 400, 404 |
| DELETE | /api/v1/users/:id | Soft-delete a user account | 204, 404 |
```

---

## 2. Route extraction (what “Actual” means)

Static AST extraction from common frameworks:

1. **Express / Fastify**: `router.get('/path', handler)`, `app.post(...)`, `fastify.delete(...)`
2. **NestJS**: `@Controller('api/v1/orders')` + `@Get(':id')` / `@Post()` / `@Delete(':id')`
3. **Next.js App Router**: `app/api/.../route.ts` exporting `GET` / `POST` / etc.
4. **Koa / custom**: chained `router.register('path', ...)` style declarations

---

## 3. Contract violation types & how to fix

| Type | Action | What to do |
| :--- | :--- | :--- |
| `CONTRACT_SHADOW_ENDPOINT` | `REMOVE_ROUTE` | Route in code, not in contract → delete handler **or** document it in the Markdown contract |
| `CONTRACT_MISSING_ENDPOINT` | `IMPLEMENT_ROUTE` | Route in contract, no handler → implement matching method+path |
| `CONTRACT_MISSING_PARAM` | `ADD_PARAM` | Required `[param]` not accepted in handler/DTO → add/destructure it |
| `CONTRACT_UNHANDLED_STATUS` | `HANDLE_STATUS` | Declared `[status]` never returned → add `res.status(code)` / throw matching exception |
| `CONTRACT_LINT_ERROR` | `FIX_SPEC` | Bad Markdown (invalid verb, path, table) → fix the contract file |

Need before/after TS for `REMOVE_ROUTE` / `IMPLEMENT_ROUTE`, or appendix intents for `ADD_PARAM` / `HANDLE_STATUS` / `FIX_SPEC` → read [`remediation-patterns.md`](./remediation-patterns.md) Pattern 7 (+ appendix).

---

## 4. Commands

```bash
# Explicit contract
npx sextant-drift check . --contract docs/api-contract.md

# Auto-detect if a known contract filename exists
npx sextant-drift check .

# Include contract rows in Fix Manifest
npx sextant-drift check . --contract docs/api-contract.md --fix-manifest
```

Flags: `npx sextant-drift check --help`.
