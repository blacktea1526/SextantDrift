# Architecture Remediation & Refactoring Patterns

This reference provides proven refactoring patterns to eliminate architecture violations reported by SextantDrift without breaking functional behavior.

---

## Pattern 1: Resolving `[CRITICAL_BYPASS]` (Layer Bypass)

### Problem
A Controller directly imports a Repository, bypassing the Service/Domain layer:

```typescript
// ❌ src/controllers/user.controller.ts
import { UserRepo } from '../repos/user.repo.js'; // Bypass Presentation -> Infra!

export class UserController {
  async handleGetUser(id: string) {
    return UserRepo.findById(id);
  }
}
```

### Solution
Route the call through the Domain Service layer:

```typescript
// ✅ src/controllers/user.controller.ts
import { UserService } from '../services/user.service.js';

export class UserController {
  async handleGetUser(id: string) {
    return UserService.getUserProfile(id);
  }
}

// ✅ src/services/user.service.ts
import { UserRepo } from '../repos/user.repo.js';

export class UserService {
  static async getUserProfile(id: string) {
    return UserRepo.findById(id);
  }
}
```

---

## Pattern 2: Resolving `[CRITICAL_INVERSION]` (Dependency Inversion)

### Problem
A lower layer (Domain Service) directly imports an upper layer (Controller/CLI/Transport):

```typescript
// ❌ src/services/order.service.ts
import { OrderResponseDto } from '../controllers/dto.js'; // Inversion! Domain -> Controller
```

### Solution
Extract shared data transfer objects and contracts into a lower `contracts` or `types` layer:

```typescript
// ✅ src/contracts/order.types.ts
export interface OrderResponseDto {
  orderId: string;
  amount: number;
}

// ✅ src/services/order.service.ts
import type { OrderResponseDto } from '../contracts/order.types.js';

// ✅ src/controllers/user.controller.ts
import type { OrderResponseDto } from '../contracts/order.types.js';
```

---

## Pattern 3: Resolving `[CRITICAL_CYCLE]` (Circular Dependency)

### Problem
`ServiceA` imports `ServiceB`, and `ServiceB` imports `ServiceA`:

```typescript
// ❌ src/services/service-a.ts
import { helperB } from './service-b.js';
export function helperA() { return helperB() + 1; }

// ❌ src/services/service-b.ts
import { helperA } from './service-a.js';
export function helperB() { return helperA() * 2; }
```

### Solution
Extract common dependencies into a shared leaf module, or decouple via callback/parameter injection:

```typescript
// ✅ src/services/common-math.ts
export function baseCompute() { return 42; }

// ✅ src/services/service-a.ts
import { baseCompute } from './common-math.js';
export function helperA() { return baseCompute() + 1; }

// ✅ src/services/service-b.ts
import { baseCompute } from './common-math.js';
export function helperB() { return baseCompute() * 2; }
```

---

## Pattern 4: Resolving `[INVARIANT_BROKEN]` (Precedence Invariant)

### Problem
External call is executed before mandatory persistence/authorization:

```typescript
// ❌ src/controllers/checkout.controller.ts
async function checkout(orderData: Order) {
  // Violation: external payment charged before user order is persisted to DB!
  await PaymentGateway.charge(orderData.amount);
  await db.save(orderData);
}
```

### Solution
Reorder steps to ensure state is safely stored before executing irreversible network actions:

```typescript
// ✅ src/controllers/checkout.controller.ts
async function checkout(orderData: Order) {
  // Persist pending order first
  const order = await db.save({ ...orderData, status: 'PENDING' });
  // Then execute external payment
  await PaymentGateway.charge(order.id, order.amount);
  // Update order state
  await db.update(order.id, { status: 'PAID' });
}
```
