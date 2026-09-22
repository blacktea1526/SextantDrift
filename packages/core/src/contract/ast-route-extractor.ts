import ts from 'typescript';
import { HttpMethod, ActualEndpoint } from './types.js';
import { normalizeHttpPath } from './markdown-parser.js';

const ROUTE_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch']);

const NEST_EXCEPTION_STATUS_MAP: Record<string, number> = {
  BadRequestException: 400,
  UnauthorizedException: 401,
  ForbiddenException: 403,
  NotFoundException: 404,
  MethodNotAllowedException: 405,
  NotAcceptableException: 406,
  ConflictException: 409,
  GoneException: 410,
  PayloadTooLargeException: 413,
  UnsupportedMediaTypeException: 415,
  UnprocessableEntityException: 422,
  InternalServerErrorException: 500,
  NotImplementedException: 501,
  BadGatewayException: 502,
  ServiceUnavailableException: 503,
  GatewayTimeoutException: 504,
};

function getStringLiteralValue(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function joinPaths(prefix: string, sub: string): string {
  const normPrefix = normalizeHttpPath(prefix);
  const normSub = normalizeHttpPath(sub);
  if (normPrefix === '/' && normSub === '/') return '/';
  if (normPrefix === '/') return normSub;
  if (normSub === '/') return normPrefix;
  return `${normPrefix}${normSub}`;
}

/**
 * Extracts parameter names destructured or referenced within a function body or parameters.
 */
function extractParamsFromNode(fnNode: ts.FunctionLikeDeclaration): string[] {
  const params = new Set<string>();

  // 1. Inspect function parameters & decorators
  for (const param of fnNode.parameters) {
    if (ts.isObjectBindingPattern(param.name)) {
      for (const element of param.name.elements) {
        if (ts.isIdentifier(element.name)) {
          params.add(element.name.text);
        }
      }
    } else if (ts.isIdentifier(param.name)) {
      // If type has a type literal, inspect its properties: body: { amount: number }
      if (param.type && ts.isTypeLiteralNode(param.type)) {
        for (const member of param.type.members) {
          if (member.name && ts.isIdentifier(member.name)) {
            params.add(member.name.text);
          }
        }
      }
    }

    // NestJS parameter decorators: @Param('id') id, @Query('page') page
    if (param.modifiers) {
      for (const mod of param.modifiers) {
        if (ts.isDecorator(mod) && ts.isCallExpression(mod.expression)) {
          const decoratorName = mod.expression.expression.getText();
          if (['Param', 'Query', 'Body', 'Headers'].includes(decoratorName)) {
            const firstArg = mod.expression.arguments[0];
            if (firstArg) {
              const val = getStringLiteralValue(firstArg);
              if (val) params.add(val);
            }
          }
        }
      }
    }
  }

  // 2. Inspect statements inside body for destructuring: const { a, b } = req.body
  if (fnNode.body) {
    function walkBody(n: ts.Node) {
      // Do not enter nested separate functions
      if (
        n !== fnNode &&
        (ts.isFunctionDeclaration(n) ||
          ts.isFunctionExpression(n) ||
          ts.isArrowFunction(n) ||
          ts.isMethodDeclaration(n))
      ) {
        return;
      }

      if (ts.isVariableDeclaration(n) && ts.isObjectBindingPattern(n.name)) {
        for (const element of n.name.elements) {
          if (ts.isIdentifier(element.name)) {
            params.add(element.name.text);
          }
        }
      }

      ts.forEachChild(n, walkBody);
    }

    walkBody(fnNode.body);
  }

  return Array.from(params);
}

/**
 * Extracts HTTP status codes from a function body (res.status, res.sendStatus, throw new ...Exception)
 */
function extractStatusesFromNode(fnNode: ts.FunctionLikeDeclaration): (number | string)[] {
  const statuses = new Set<number | string>();

  if (!fnNode.body) {
    return [];
  }

  function walk(n: ts.Node) {
    if (
      n !== fnNode &&
      (ts.isFunctionDeclaration(n) ||
        ts.isFunctionExpression(n) ||
        ts.isArrowFunction(n) ||
        ts.isMethodDeclaration(n))
    ) {
      return;
    }

    // res.status(409) or res.sendStatus(404)
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const propName = n.expression.name.text;
      if (propName === 'status' || propName === 'sendStatus') {
        const firstArg = n.arguments[0];
        if (firstArg && ts.isNumericLiteral(firstArg)) {
          statuses.add(parseInt(firstArg.text, 10));
        }
      }
    }

    // throw new ConflictException(...) or throw new HttpException(..., 409)
    if (ts.isThrowStatement(n) && n.expression && ts.isNewExpression(n.expression)) {
      const callExpr = n.expression;
      const exceptionName = callExpr.expression.getText();
      if (NEST_EXCEPTION_STATUS_MAP[exceptionName]) {
        statuses.add(NEST_EXCEPTION_STATUS_MAP[exceptionName]);
      } else if (exceptionName === 'HttpException' && callExpr.arguments && callExpr.arguments.length >= 2) {
        const secondArg = callExpr.arguments[1];
        if (ts.isNumericLiteral(secondArg)) {
          statuses.add(parseInt(secondArg.text, 10));
        }
      }
    }

    ts.forEachChild(n, walk);
  }

  walk(fnNode.body);

  // Default implicit status fallback if 200 or 201 not explicitly called
  if (!statuses.has(200) && !statuses.has(201) && !statuses.has(204)) {
    // If no explicit 2xx set, check if method returns JSON or value
    statuses.add(200);
  }

  return Array.from(statuses);
}

/**
 * Extracts actual route endpoints, parameters, and status codes from a TypeScript SourceFile.
 */
export function extractEndpointsFromSource(
  sourceFile: ts.SourceFile,
  relPath: string
): ActualEndpoint[] {
  const endpoints: ActualEndpoint[] = [];
  const lines = sourceFile.text.split('\n');

  function getLineSnippet(lineNumber: number): string {
    return lines[lineNumber - 1] ? lines[lineNumber - 1].trim() : '';
  }

  function visit(node: ts.Node) {
    // 1. Express / Fastify / Router: router.post('/path', handler) or app.get('/path', handler)
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const propName = node.expression.name.text.toLowerCase();
      if (ROUTE_METHODS.has(propName) && node.arguments.length >= 2) {
        const firstArg = node.arguments[0];
        const routePathRaw = getStringLiteralValue(firstArg);
        if (routePathRaw) {
          const method = propName.toUpperCase() as HttpMethod;
          const routePath = normalizeHttpPath(routePathRaw);
          const pos = node.getStart(sourceFile);
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
          const lineNumber = line + 1;
          const columnNumber = character + 1;

          // Handler function is usually the last argument
          const handlerArg = node.arguments[node.arguments.length - 1];
          let extractedParams: string[] = [];
          let extractedStatuses: (number | string)[] = [];

          if (
            ts.isFunctionExpression(handlerArg) ||
            ts.isArrowFunction(handlerArg) ||
            ts.isFunctionDeclaration(handlerArg)
          ) {
            extractedParams = extractParamsFromNode(handlerArg);
            extractedStatuses = extractStatusesFromNode(handlerArg);
          }

          endpoints.push({
            id: `${method} ${routePath}`,
            method,
            path: routePath,
            sourceFile: relPath,
            line: lineNumber,
            column: columnNumber,
            snippet: getLineSnippet(lineNumber),
            extractedParams,
            extractedStatuses,
          });
        }
      }
    }

    // 2. NestJS Controller classes: @Controller('prefix')
    if (ts.isClassDeclaration(node) && node.modifiers) {
      let controllerPrefix = '';
      for (const mod of node.modifiers) {
        if (ts.isDecorator(mod) && ts.isCallExpression(mod.expression)) {
          if (mod.expression.expression.getText() === 'Controller') {
            const firstArg = mod.expression.arguments[0];
            if (firstArg) {
              const val = getStringLiteralValue(firstArg);
              if (val) controllerPrefix = val;
            }
          }
        }
      }

      // Scan methods in class
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.modifiers) {
          for (const mod of member.modifiers) {
            if (ts.isDecorator(mod) && ts.isCallExpression(mod.expression)) {
              const decName = mod.expression.expression.getText().toLowerCase();
              if (ROUTE_METHODS.has(decName)) {
                const method = decName.toUpperCase() as HttpMethod;
                let subPath = '';
                const firstArg = mod.expression.arguments[0];
                if (firstArg) {
                  const val = getStringLiteralValue(firstArg);
                  if (val) subPath = val;
                }

                const fullPath = joinPaths(controllerPrefix, subPath);
                const pos = member.getStart(sourceFile);
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
                const lineNumber = line + 1;
                const columnNumber = character + 1;

                const extractedParams = extractParamsFromNode(member);
                const extractedStatuses = extractStatusesFromNode(member);

                endpoints.push({
                  id: `${method} ${fullPath}`,
                  method,
                  path: fullPath,
                  sourceFile: relPath,
                  line: lineNumber,
                  column: columnNumber,
                  snippet: getLineSnippet(lineNumber),
                  extractedParams,
                  extractedStatuses,
                });
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return endpoints;
}
