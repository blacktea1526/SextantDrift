import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeModuleDrift } from '../../src/index.js';
import type {
  CreateOrderRequest,
  CreateOrderResult,
  InventoryPort,
  OrderPorts,
  OrderRecord,
  OrderStorePort,
  PaymentPort,
} from '../fixtures/design-intent-order/src/ports/order-ports.js';
import { OrderService as CorrectOrderService } from '../fixtures/design-intent-order/src/services/correct-order.service.js';
import { OrderService as RefactoredOrderService } from '../fixtures/design-intent-order/src/services/refactored-order.service.js';
import { OrderService as FunctionalOrderService } from '../fixtures/design-intent-order/src/services/refactored-functional-order.service.js';
import { OrderService as InventoryAfterPaymentService } from '../fixtures/design-intent-order/src/services/bug-inventory-after-payment.service.js';
import { OrderService as MissingAwaitReserveService } from '../fixtures/design-intent-order/src/services/bug-missing-await-reserve.service.js';
import { OrderService as MissingAwaitPersistService } from '../fixtures/design-intent-order/src/services/bug-missing-await-persist.service.js';
import { OrderService as PaysAfterPersistFailureService } from '../fixtures/design-intent-order/src/services/bug-pays-after-persist-failure.service.js';
import { OrderService as PaymentFailureNoCompensationService } from '../fixtures/design-intent-order/src/services/bug-payment-failure-no-compensation.service.js';
import { OrderService as MissingAwaitReleaseService } from '../fixtures/design-intent-order/src/services/bug-missing-await-release.service.js';
import { OrderService as DuplicatePaymentsService } from '../fixtures/design-intent-order/src/services/bug-duplicate-payments.service.js';
import { OrderService as ReturnPaidNotSavedService } from '../fixtures/design-intent-order/src/services/bug-return-paid-not-saved.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureDir = path.resolve(__dirname, '../fixtures/design-intent-order');

const request: CreateOrderRequest = {
  idempotencyKey: 'idem-ord-1',
  sku: 'sku-1',
  quantity: 2,
  amountCents: 9900,
};

type OrderServiceCtor = new (ports: OrderPorts) => {
  createOrder(request: CreateOrderRequest): Promise<CreateOrderResult>;
};

interface Variant {
  name: string;
  serviceFile: string;
  Service: OrderServiceCtor;
  expectedFailures?: string[];
}

const passingVariants: Variant[] = [
  { name: 'correct', serviceFile: 'src/services/correct-order.service.ts', Service: CorrectOrderService },
  { name: 'refactored', serviceFile: 'src/services/refactored-order.service.ts', Service: RefactoredOrderService },
  {
    name: 'refactored-functional',
    serviceFile: 'src/services/refactored-functional-order.service.ts',
    Service: FunctionalOrderService,
  },
];

const defectiveVariants: Variant[] = [
  {
    name: 'inventory-after-payment',
    serviceFile: 'src/services/bug-inventory-after-payment.service.ts',
    Service: InventoryAfterPaymentService,
    expectedFailures: ['ORD-01', 'ORD-02'],
  },
  {
    name: 'missing-await-persist',
    serviceFile: 'src/services/bug-missing-await-persist.service.ts',
    Service: MissingAwaitPersistService,
    expectedFailures: ['ORD-02'],
  },
  {
    name: 'missing-await-reserve',
    serviceFile: 'src/services/bug-missing-await-reserve.service.ts',
    Service: MissingAwaitReserveService,
    expectedFailures: ['ORD-02'],
  },
  {
    name: 'pays-after-persist-failure',
    serviceFile: 'src/services/bug-pays-after-persist-failure.service.ts',
    Service: PaysAfterPersistFailureService,
    expectedFailures: ['ORD-02'],
  },
  {
    name: 'payment-failure-no-compensation',
    serviceFile: 'src/services/bug-payment-failure-no-compensation.service.ts',
    Service: PaymentFailureNoCompensationService,
    expectedFailures: ['ORD-03'],
  },
  {
    name: 'missing-await-release',
    serviceFile: 'src/services/bug-missing-await-release.service.ts',
    Service: MissingAwaitReleaseService,
    expectedFailures: ['ORD-03'],
  },
  {
    name: 'duplicate-payments',
    serviceFile: 'src/services/bug-duplicate-payments.service.ts',
    Service: DuplicatePaymentsService,
    expectedFailures: ['ORD-04'],
  },
  {
    name: 'return-paid-not-saved',
    serviceFile: 'src/services/bug-return-paid-not-saved.service.ts',
    Service: ReturnPaidNotSavedService,
    expectedFailures: ['ORD-05'],
  },
];

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForMicrotaskCondition(condition: () => boolean): Promise<boolean> {
  for (let attempt = 0; attempt < 10 && !condition(); attempt += 1) {
    await flushMicrotasks();
  }
  return condition();
}

async function observeEntryBeforeEarlySignal(
  entry: Promise<void>,
  earlySignal: () => boolean,
  label: string
): Promise<'entered' | 'early'> {
  let entered = false;
  void entry.then(() => {
    entered = true;
  });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await flushMicrotasks();
    if (entered) return 'entered';
    if (earlySignal()) return 'early';
  }

  throw new Error(`Harness error: ${label} was not entered and no early signal was observed`);
}

class FakeInventory implements InventoryPort {
  hasStockCalls = 0;
  reserveCalls = 0;
  releaseCalls = 0;
  stock = 10;
  reserveGate?: Promise<void>;
  reserveEntered?: () => void;
  rejectReserve = false;
  releaseGate?: Promise<void>;
  releaseEntered?: () => void;

  async hasStock(_sku: string, quantity: number): Promise<boolean> {
    this.hasStockCalls += 1;
    return this.stock >= quantity;
  }

  async reserve(_sku: string, quantity: number): Promise<void> {
    this.reserveCalls += 1;
    this.reserveEntered?.();
    if (this.reserveGate) await this.reserveGate;
    if (this.rejectReserve) throw new Error('reserve failed');
    this.stock -= quantity;
  }

  async release(_sku: string, quantity: number): Promise<void> {
    this.releaseCalls += 1;
    this.releaseEntered?.();
    if (this.releaseGate) await this.releaseGate;
    this.stock += quantity;
  }
}

class FakeStore implements OrderStorePort {
  private nextOrder = 1;
  readonly byId = new Map<string, OrderRecord>();
  readonly byKey = new Map<string, string>();
  createPendingCalls = 0;
  markPaidCalls = 0;
  markPaymentFailedCalls = 0;
  createPendingGate?: Promise<OrderRecord>;
  createPendingEntered?: () => void;
  failCreatePending = false;

  async findByIdempotencyKey(idempotencyKey: string): Promise<OrderRecord | undefined> {
    const id = this.byKey.get(idempotencyKey);
    return id ? this.byId.get(id) : undefined;
  }

  async createPending(newOrder: CreateOrderRequest): Promise<OrderRecord> {
    this.createPendingCalls += 1;
    this.createPendingEntered?.();
    if (this.createPendingGate) {
      return this.remember(await this.createPendingGate);
    }
    if (this.failCreatePending) throw new Error('persist failed');

    const record: OrderRecord = {
      id: `order-${this.nextOrder++}`,
      idempotencyKey: newOrder.idempotencyKey,
      sku: newOrder.sku,
      quantity: newOrder.quantity,
      amountCents: newOrder.amountCents,
      status: 'pending_payment',
    };
    return this.remember(record);
  }

  private remember(record: OrderRecord): OrderRecord {
    this.byId.set(record.id, record);
    this.byKey.set(record.idempotencyKey, record.id);
    return record;
  }

  async markPaid(orderId: string): Promise<OrderRecord> {
    this.markPaidCalls += 1;
    return this.updateStatus(orderId, 'paid');
  }

  async markPaymentFailed(orderId: string): Promise<OrderRecord> {
    this.markPaymentFailedCalls += 1;
    return this.updateStatus(orderId, 'payment_failed');
  }

  private updateStatus(orderId: string, status: OrderRecord['status']): OrderRecord {
    const record = this.byId.get(orderId);
    if (!record) throw new Error(`unknown order ${orderId}`);
    const updated = { ...record, status };
    this.byId.set(orderId, updated);
    this.byKey.set(updated.idempotencyKey, updated.id);
    return updated;
  }
}

class FakePayment implements PaymentPort {
  calls: Array<{ orderId: string; amountCents: number; idempotencyKey: string }> = [];
  shouldReject = false;
  chargeGate?: Promise<void>;

  async charge(orderId: string, amountCents: number, idempotencyKey: string): Promise<void> {
    this.calls.push({ orderId, amountCents, idempotencyKey });
    if (this.chargeGate) await this.chargeGate;
    if (this.shouldReject) throw new Error('payment failed');
  }
}

function makePorts(overrides?: {
  inventory?: Partial<FakeInventory>;
  store?: Partial<FakeStore>;
  payment?: Partial<FakePayment>;
}) {
  const inventory = Object.assign(new FakeInventory(), overrides?.inventory);
  const store = Object.assign(new FakeStore(), overrides?.store);
  const payment = Object.assign(new FakePayment(), overrides?.payment);
  return {
    inventory,
    store,
    payment,
    ports: { inventory, store, payment },
  };
}

function fail(requirementId: string, message: string): string {
  return `${requirementId}: ${message}`;
}

async function runAcceptance(Service: OrderServiceCtor): Promise<string[]> {
  const failures: string[] = [];

  await checkInsufficientStock(Service, failures);
  await checkNoPaymentBeforeReserveOrPersist(Service, failures);
  await checkNoPaymentWhenPersistFails(Service, failures);
  await checkPaymentFailureCompensates(Service, failures);
  await checkIdempotency(Service, failures);
  await checkPaidStateIsStored(Service, failures);

  return failures;
}

async function checkInsufficientStock(Service: OrderServiceCtor, failures: string[]): Promise<void> {
  const { ports, inventory, store, payment } = makePorts({ inventory: { stock: 0 } });
  const result = await new Service(ports).createOrder(request).catch((error: unknown) => error);

  if (!(typeof result === 'object' && result !== null && 'status' in result && result.status === 'insufficient_stock')) {
    failures.push(fail('ORD-01', 'insufficient stock must return insufficient_stock'));
  }
  if (inventory.reserveCalls !== 0) failures.push(fail('ORD-01', 'insufficient stock must not reserve inventory'));
  if (payment.calls.length !== 0) failures.push(fail('ORD-01', 'insufficient stock must not charge payment'));
  if (store.createPendingCalls !== 0) failures.push(fail('ORD-01', 'insufficient stock must not create an order'));
}

async function checkNoPaymentBeforeReserveOrPersist(Service: OrderServiceCtor, failures: string[]): Promise<void> {
  const blockedReserve = deferred();
  const reserveEntered = deferred();
  const reservePorts = makePorts({
    inventory: {
      reserveGate: blockedReserve.promise,
      reserveEntered: () => reserveEntered.resolve(),
    },
  });
  const reserveRun = new Service(reservePorts.ports).createOrder(request);
  const reserveObservation = await observeEntryBeforeEarlySignal(
    reserveEntered.promise,
    () => reservePorts.payment.calls.length > 0,
    'inventory reserve'
  );

  if (reserveObservation === 'entered') {
    await waitForMicrotaskCondition(() => reservePorts.payment.calls.length > 0);
  }
  if (reservePorts.payment.calls.length !== 0) {
    failures.push(fail('ORD-02', 'payment started before inventory reserve completed'));
  }

  blockedReserve.resolve();
  await reserveRun.catch(() => undefined);

  const blockedPersist = deferred<OrderRecord>();
  const persistEntered = deferred();
  const persistPorts = makePorts({
    store: {
      createPendingGate: blockedPersist.promise,
      createPendingEntered: () => persistEntered.resolve(),
    },
  });
  const persistRun = new Service(persistPorts.ports).createOrder(request);
  const persistObservation = await observeEntryBeforeEarlySignal(
    persistEntered.promise,
    () => persistPorts.payment.calls.length > 0,
    'pending order persistence'
  );

  if (persistObservation === 'entered') {
    await waitForMicrotaskCondition(() => persistPorts.payment.calls.length > 0);
  }
  if (persistPorts.payment.calls.length !== 0) {
    failures.push(fail('ORD-02', 'payment started before pending order persistence completed'));
  }

  blockedPersist.resolve({
    id: 'order-blocked',
    idempotencyKey: request.idempotencyKey,
    sku: request.sku,
    quantity: request.quantity,
    amountCents: request.amountCents,
    status: 'pending_payment',
  });
  await persistRun.catch(() => undefined);
}

async function checkNoPaymentWhenPersistFails(Service: OrderServiceCtor, failures: string[]): Promise<void> {
  const { ports, payment } = makePorts({ inventory: { rejectReserve: true } });
  await new Service(ports).createOrder(request).catch(() => undefined);

  if (payment.calls.length !== 0) {
    failures.push(fail('ORD-02', 'payment must not start after inventory reserve rejects'));
  }

  const persistPorts = makePorts({ store: { failCreatePending: true } });
  await new Service(persistPorts.ports).createOrder(request).catch(() => undefined);

  if (persistPorts.payment.calls.length !== 0) {
    failures.push(fail('ORD-02', 'payment must not start after pending order persistence rejects'));
  }
}

async function checkPaymentFailureCompensates(Service: OrderServiceCtor, failures: string[]): Promise<void> {
  const releaseBlock = deferred();
  const releaseEntered = deferred();
  const { ports, inventory, store } = makePorts({
    inventory: {
      releaseGate: releaseBlock.promise,
      releaseEntered: () => releaseEntered.resolve(),
    },
    payment: { shouldReject: true },
  });
  let settled = false;
  const run = new Service(ports).createOrder(request).finally(() => {
    settled = true;
  });

  const releaseObservation = await observeEntryBeforeEarlySignal(
    releaseEntered.promise,
    () => settled,
    'inventory release'
  );

  if (releaseObservation === 'early') {
    failures.push(fail('ORD-03', 'payment failure must enter inventory release before returning'));
  }
  if (releaseObservation === 'entered') {
    await waitForMicrotaskCondition(() => settled);
  }
  if (settled) {
    failures.push(fail('ORD-03', 'payment failure must not return before inventory release completes'));
  }

  releaseBlock.resolve();
  const result = await run.catch((error: unknown) => error);

  if (!(typeof result === 'object' && result !== null && 'status' in result && result.status === 'payment_failed')) {
    failures.push(fail('ORD-03', 'payment failure must return payment_failed'));
  }
  if (inventory.releaseCalls !== 1) failures.push(fail('ORD-03', 'payment failure must release reserved inventory once'));
  if (inventory.stock !== 10) failures.push(fail('ORD-03', 'inventory must be restored after payment failure'));
  if (store.markPaymentFailedCalls !== 1) failures.push(fail('ORD-03', 'payment failure must store failed status'));

  if (typeof result === 'object' && result !== null && 'orderId' in result) {
    const record = store.byId.get(result.orderId);
    if (record?.status !== 'payment_failed') {
      failures.push(fail('ORD-03', 'payment failure must persist final payment_failed state'));
    }
  }
}

async function checkIdempotency(Service: OrderServiceCtor, failures: string[]): Promise<void> {
  const serialPorts = makePorts();
  const serialService = new Service(serialPorts.ports);
  const first = await serialService.createOrder(request);
  const second = await serialService.createOrder(request);

  if (first.status !== 'paid' || second.status !== 'paid' || first.orderId !== second.orderId) {
    failures.push(fail('ORD-04', 'serial duplicate requests must return the same paid order'));
  }
  if (serialPorts.payment.calls.length !== 1) {
    failures.push(fail('ORD-04', 'serial duplicate requests must charge exactly once'));
  }

  const blockedPayment = deferred();
  const concurrentPorts = makePorts({ payment: { chargeGate: blockedPayment.promise } });
  const concurrentService = new Service(concurrentPorts.ports);
  const firstConcurrent = concurrentService.createOrder(request);
  const secondConcurrent = concurrentService.createOrder(request);
  await waitForMicrotaskCondition(() => concurrentPorts.payment.calls.length > 0);

  if (concurrentPorts.payment.calls.length !== 1) {
    failures.push(fail('ORD-04', 'concurrent duplicate requests must share one payment'));
  }

  blockedPayment.resolve();
  const [firstResult, secondResult] = await Promise.allSettled([firstConcurrent, secondConcurrent]);
  if (firstResult.status !== 'fulfilled' || secondResult.status !== 'fulfilled') {
    failures.push(fail('ORD-04', 'concurrent duplicate requests must both complete successfully'));
    return;
  }
  if (
    firstResult.value.status !== 'paid' ||
    secondResult.value.status !== 'paid' ||
    firstResult.value.orderId !== secondResult.value.orderId
  ) {
    failures.push(fail('ORD-04', 'concurrent duplicate requests must return the same paid order'));
  }
  if (concurrentPorts.payment.calls.length !== 1) {
    failures.push(fail('ORD-04', 'concurrent duplicate requests must still have exactly one payment after completion'));
  }
}

async function checkPaidStateIsStored(Service: OrderServiceCtor, failures: string[]): Promise<void> {
  const { ports, store } = makePorts();
  const result = await new Service(ports).createOrder(request);
  const record = result.status === 'paid' ? store.byId.get(result.orderId) : undefined;

  if (result.status !== 'paid') failures.push(fail('ORD-05', 'successful order must return paid'));
  if (!record) failures.push(fail('ORD-05', 'successful order must be readable from store'));
  if (record && record.status !== 'paid') failures.push(fail('ORD-05', 'successful order must be stored with paid status'));
}

describe('design intent order acceptance prototype', () => {
  it.each(passingVariants)('$name satisfies the five fixed ORD requirements', async ({ Service }) => {
    await expect(runAcceptance(Service)).resolves.toEqual([]);
  });

  it.each(defectiveVariants)('$name is rejected by the fixed behavior harness', async ({ Service, expectedFailures }) => {
    const failures = await runAcceptance(Service);
    for (const expected of expectedFailures ?? []) {
      expect(failures.some((failure) => failure.startsWith(`${expected}:`))).toBe(true);
    }
  });

  it.each([...passingVariants, ...defectiveVariants])('$name keeps the same architecture shape', async ({ serviceFile }) => {
    const report = await analyzeModuleDrift({
      rootDir: fixtureDir,
      files: [serviceFile, 'src/ports/order-ports.ts'],
    });

    expect(report.passed).toBe(true);
    expect(report.exitCode).toBe(0);
    expect(report.violations).toHaveLength(0);
  });
});
