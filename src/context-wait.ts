import {
  PolygresAPIError,
  PolygresAuthError,
  PolygresNotFoundError,
  PolygresPermissionError,
  PolygresRateLimitError,
  PolygresRuntimeError,
  PolygresValidationError,
  canonicalErrorDetails,
  redactValue,
} from './errors';
import { ContextOperation } from './context-models';

export type OperationFetcher = (deadline: number) => Promise<[ContextOperation, string | null]>;

export function contextPollInterval(elapsedStageSeconds: number): number {
  if (elapsedStageSeconds <= 10) return 2.0;
  if (elapsedStageSeconds <= 60) return 5.0;
  if (elapsedStageSeconds <= 300) return 15.0;
  return 30.0;
}

export function parseRetryAfterSeconds(value?: string | null): number | null {
  if (!value) return null;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return asNumber;
  }
  const parsedDate = Date.parse(value);
  if (!Number.isNaN(parsedDate)) {
    const diff = (parsedDate - Date.now()) / 1000;
    return Math.max(diff, 0);
  }
  return null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitForContextOperation(
  operationId: string,
  options: {
    initial?: ContextOperation | null;
    fetch: OperationFetcher;
    timeout: number;
    now?: () => number;
    customSleep?: (ms: number) => Promise<void>;
  }
): Promise<ContextOperation> {
  const timeout = options.timeout;
  if (typeof timeout !== 'number' || timeout <= 0 || !Number.isFinite(timeout)) {
    throw new PolygresValidationError('timeout must be positive');
  }

  const getTime = options.now ?? (() => Date.now() / 1000);
  const doSleep = options.customSleep ?? sleep;

  const started = getTime();
  const deadline = started + timeout;
  let operation: ContextOperation | null = options.initial ?? null;
  let retryAfter: string | null = null;
  let observedStage: string | null = null;
  let stageStarted = started;

  while (true) {
    if (operation === null) {
      try {
        const fetched = await options.fetch(deadline);
        operation = fetched[0];
        retryAfter = fetched[1];
      } catch (exc: any) {
        if (getTime() >= deadline) {
          throw timeoutError(operationId, null);
        }
        throw exc;
      }
    }

    const status = String(operation.status);
    if (status === 'succeeded') {
      return operation;
    }
    if (status === 'failed') {
      throw failedOperationError(operationId, operation);
    }
    if (status === 'cancelled') {
      throw new PolygresAPIError('Context operation was cancelled.', {
        statusCode: 409,
        requestId: getRequestId(operation),
        code: 'CONTEXT_OPERATION_CANCELLED',
        details: {
          operation_id: operationId,
          operation_status: 'cancelled',
        },
      });
    }

    const now = getTime();
    const stage = operation.stage ?? null;
    if (stage !== observedStage) {
      observedStage = stage;
      stageStarted = now;
    }

    let delaySeconds = parseRetryAfterSeconds(retryAfter);
    if (delaySeconds === null) {
      delaySeconds = contextPollInterval(Math.max(now - stageStarted, 0.0));
    }

    const remaining = deadline - now;
    if (remaining <= 0) {
      throw timeoutError(operationId, operation);
    }
    if (delaySeconds >= remaining) {
      await doSleep(remaining * 1000);
      throw timeoutError(operationId, operation);
    }

    await doSleep(delaySeconds * 1000);
    operation = null;
    retryAfter = null;
  }
}

function failedOperationError(operationId: string, operation: ContextOperation): Error {
  const failure = (operation as any).error;
  if (!failure) {
    return new PolygresRuntimeError('Context operation failed.', {
      statusCode: 500,
      requestId: getRequestId(operation),
      code: 'CONTEXT_OPERATION_FAILED',
      details: {
        operation_id: operationId,
        operation_status: 'failed',
      },
    });
  }

  const failureDetails = { ...(failure.details || {}) };
  const canonical =
    canonicalErrorDetails(failure.code, failure.variant, failureDetails) ||
    canonicalErrorDetails('CONTEXT_OPERATION_FAILED', null, {});

  const details = canonical ? { ...canonical.details } : {};
  details.operation_id = operationId;
  details.operation_status = 'failed';

  const statusCode = canonical?.statusCode ?? 500;
  const message = canonical?.message ?? 'Context operation failed.';
  const code = canonical?.code ?? 'CONTEXT_OPERATION_FAILED';
  const kwargs = {
    statusCode,
    requestId: getRequestId(operation),
    code,
    details: redactValue(details),
  };

  if (statusCode === 400) return new PolygresValidationError(message, kwargs);
  if (statusCode === 401) return new PolygresAuthError(message, kwargs);
  if (statusCode === 403) return new PolygresPermissionError(message, kwargs);
  if (statusCode === 404) return new PolygresNotFoundError(message, kwargs);
  if (statusCode === 429) return new PolygresRateLimitError(message, kwargs);
  if ([408, 500, 502, 503, 504].includes(statusCode)) {
    return new PolygresRuntimeError(message, kwargs);
  }
  return new PolygresAPIError(message, kwargs);
}

function timeoutError(operationId: string, operation: ContextOperation | null): PolygresRuntimeError {
  return new PolygresRuntimeError(
    `Timed out waiting for Context operation ${operationId}; it is still running.`,
    {
      statusCode: null,
      requestId: operation ? getRequestId(operation) : null,
      code: 'CONTEXT_OPERATION_TIMEOUT',
      details: { operation_id: operationId },
    }
  );
}

function getRequestId(operation: ContextOperation): string | null {
  const reqId = (operation as any).request_id || (operation as any).requestId;
  return reqId ? String(reqId) : null;
}
