# API Contract Specification & Alignment Reference

SextantDrift features a zero-overhead API contract alignment engine that verifies route controllers in source code against human-readable Markdown contract specifications (`api-contract.md`, `docs/api-contract.md`, or `.sextant/contract.md`).

This eliminates API drift, phantom shadow routes, and undocumented endpoints between frontend, backend, and API documentation without needing heavy OpenAPI/Swagger toolchains.

---

## 1. Supported Contract Formats

SextantDrift supports two standard Markdown contract formats:

### Format A: Heading & List Format (Recommended for Detailed APIs)

Each endpoint is defined under a Level 3 heading (`### METHOD /path`):

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

#### Tags:
- `- [desc] <text>`: Endpoint summary and behavior notes.
- `- [param] <name>: <type> (required|optional)`: Request path parameter, query parameter, or body field.
- `- [status] <code> (<description>)`: Permitted HTTP status codes.

---

### Format B: Markdown Table Format (Ideal for Compact Route Inventories)

Endpoints can also be declared using standard Markdown tables:

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

## 2. AST Route Extraction Mechanics

SextantDrift statically analyzes source files using the TypeScript compiler AST to extract declared routes across common web frameworks:

1. **Express & Fastify Route Handlers**:
   - `router.get('/path', handler)`
   - `app.post('/path', handler)`
   - `fastify.delete('/path', handler)`
2. **NestJS Controllers**:
   - `@Controller('api/v1/orders')`
   - `@Get(':id')`, `@Post()`, `@Delete(':id')` (automatically prefixed with controller route).
3. **Next.js App Router (Route Handlers)**:
   - `app/api/v1/orders/route.ts` exporting `export async function GET(req: Request)` or `export async function POST(req: Request)`.
4. **Koa & Custom Routers**:
   - Standard chained router declarations (`router.register('path', ...)`).

---

## 3. Contract Drift Violations & Self-Healing

When `npx sextant-drift check --contract api-contract.md` runs, it detects the following drift conditions:

### 1. `[CONTRACT_SHADOW_ENDPOINT]` (Undocumented Route)
- **Problem**: A controller in code exposes a route that is not declared in `api-contract.md`.
- **Risk**: Security vulnerability, unauthorized backdoor route, or forgotten test mock.
- **Action**: `REMOVE_ROUTE` (Delete the route from code, or document it in the contract).

### 2. `[CONTRACT_MISSING_ENDPOINT]` (Unimplemented Route)
- **Problem**: An endpoint defined in `api-contract.md` has no corresponding route controller in the codebase.
- **Risk**: Broken contract for frontend clients; incomplete feature implementation.
- **Action**: `IMPLEMENT_ROUTE` (Implement the route handler matching the exact method and path).

### 3. `[CONTRACT_LINT_ERROR]` (Contract Syntax Defect)
- **Problem**: Markdown syntax error in the contract (e.g. invalid HTTP verb like `PST /orders`, missing path slashes, or malformed table columns).
- **Action**: `FIX_SPEC` (Correct the method name or path syntax in the contract document).

---

## 4. Contract Alignment Command Usage

```bash
# Explicit path to contract
npx sextant-drift check . --contract docs/api-contract.md

# Auto-detects api-contract.md, contract.md, or .sextant/contract.md if present
npx sextant-drift check .

# Generate AI Fix Manifest including contract fixes
npx sextant-drift check . --contract docs/api-contract.md --fix-manifest
```
