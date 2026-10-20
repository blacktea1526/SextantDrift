export interface ExplainViolationArgs {
  violationType: string;
  ruleId?: string;
  message?: string;
  sourceFile?: string;
  line?: number;
}

export interface ExplainViolationResult {
  violationType: string;
  title: string;
  rootCause: string;
  remedy: string;
  refactoringPattern: string;
  codeExample?: {
    antiPattern: string;
    refactored: string;
  };
}

export function explainViolation(args: ExplainViolationArgs): ExplainViolationResult {
  const type = args.violationType.toUpperCase();

  switch (type) {
    case 'LAYER_BYPASS':
      return {
        violationType: 'LAYER_BYPASS',
        title: 'Layer Bypass Violation (跨层旁路调用违规)',
        rootCause: 'An upper layer component directly accesses an infrastructure or storage component, skipping intermediate business logic and domain validation.',
        remedy: 'Route the request through an appropriate domain service instead of accessing repositories or data tier components directly from controllers or UI.',
        refactoringPattern: 'Mediator / Facade Pattern: Inject a Domain Service into the Controller, and let the Domain Service orchestrate repository access.',
        codeExample: {
          antiPattern: '// Controller directly importing repository\nimport { UserRepo } from "../repos/user.repo.js";',
          refactored: '// Controller delegating to domain service\nimport { UserService } from "../services/user.service.js";',
        },
      };

    case 'LAYER_INVERSION':
      return {
        violationType: 'LAYER_INVERSION',
        title: 'Layer Inversion Violation (逆向依赖违规)',
        rootCause: 'A lower architectural layer component is importing or depending on an upper layer component, creating reverse coupling and making lower layers untestable.',
        remedy: 'Apply the Dependency Inversion Principle (DIP). Move shared types or interfaces to a shared contracts tier, or use event emitters/callbacks.',
        refactoringPattern: 'Dependency Inversion Principle (DIP) / Observer Pattern.',
        codeExample: {
          antiPattern: '// Repo importing Controller type\nimport { UserController } from "../controllers/user.controller.js";',
          refactored: '// Repo depending on domain entity or abstract interface\nimport { UserEntity } from "../domain/user.entity.js";',
        },
      };

    case 'CIRCULAR_DEPENDENCY':
    case 'CYCLE':
      return {
        violationType: 'CIRCULAR_DEPENDENCY',
        title: 'Circular Dependency Detected (循环依赖环路)',
        rootCause: 'Two or more modules directly or indirectly depend on each other (A -> B -> C -> A), which causes runtime undefined imports, memory leaks, and tightly coupled code.',
        remedy: 'Break the cycle by extracting the mutually referenced symbols or shared types into a new leaf module, or passing callbacks/interfaces.',
        refactoringPattern: 'Extract Shared Module / Extract Interface to Leaf.',
        codeExample: {
          antiPattern: '// A imports B and B imports A\n// fileA.ts: import { b } from "./fileB.js";\n// fileB.ts: import { a } from "./fileA.js";',
          refactored: '// fileTypes.ts (leaf module)\nexport interface SharedProps { ... }\n// fileA and fileB both import from fileTypes.js without depending on each other',
        },
      };

    case 'INVARIANT_BROKEN':
      return {
        violationType: 'INVARIANT_BROKEN',
        title: 'Semantic Invariant Broken (语义不变量约束被破坏)',
        rootCause: `Rule "${args.ruleId || 'UNKNOWN'}" has been violated. Either a forbidden import was detected in a protected scope, or a required statement execution sequence was not respected.`,
        remedy: 'Inspect the line and column indicated in the violation report. Follow the suggested action provided by the rule invariant.',
        refactoringPattern: 'Sequential ordering: Ensure persistence (db.save/repo.create) occurs before non-transactional network/AI calls.',
      };

    case 'STATE_DEADLOCK':
      return {
        violationType: 'STATE_DEADLOCK',
        title: 'State Machine Deadlock (状态机死锁/黑洞节点)',
        rootCause: 'A non-terminal state in the Mermaid state diagram has incoming transitions but no valid outgoing transitions, trapping the system.',
        remedy: 'Add an outgoing transition to a terminal state, error handler, or fallback state.',
        refactoringPattern: 'Deadlock Recovery / Timeout Fallback.',
      };

    default:
      return {
        violationType: args.violationType,
        title: `Architectural Drift: ${args.violationType}`,
        rootCause: args.message || 'Architectural boundary mismatch between target specification and actual code AST.',
        remedy: 'Align implementation with target specification in sextant.json or update the target architecture diagram if the change was deliberate.',
        refactoringPattern: 'Architecture Alignment.',
      };
  }
}
