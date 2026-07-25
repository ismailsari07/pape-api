import fetch from "node-fetch";

const BASE_URL = "https://awqatsalah.diyanet.gov.tr";

const MAX_ATTEMPTS = 3;
const PER_ATTEMPT_TIMEOUT_MS = 8000;
const BASE_BACKOFF_MS = 400;
const BACKOFF_FACTOR = 3; // 400ms -> 1200ms
const JITTER_RATIO = 0.25;
const BODY_SNIPPET_LIMIT = 200;
const RETRY_AFTER_CAP_MS = 5000;
// A retry is only worth scheduling if there is room left for the attempt itself.
const MIN_ATTEMPT_BUDGET_MS = 1500;

// Connection-level failures that are worth retrying: the request never got a
// complete response, so replaying it is safe.
export const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ECONNABORTED",
  "NETWORK_ERROR",
]);

export class UpstreamError extends Error {
  constructor(
    message,
    {
      label,
      status = null,
      bodySnippet = null,
      code = null,
      attempts = 1,
      retryable = false,
      retryAfterMs = null,
    } = {},
  ) {
    super(message);
    this.name = "UpstreamError";
    this.label = label;
    this.status = status;
    this.bodySnippet = bodySnippet;
    this.code = code;
    this.attempts = attempts;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Request-scoped deadline. Its signal is combined with each attempt's own
 * timeout so an in-flight request is actually aborted when the overall budget
 * runs out, rather than being abandoned while it keeps running.
 */
export function createDeadline(totalMs) {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), totalMs);
  timer.unref?.();

  return {
    signal: controller.signal,
    get remainingMs() {
      return Math.max(0, totalMs - (Date.now() - startedAt));
    },
    get expired() {
      return controller.signal.aborted;
    },
    clear() {
      clearTimeout(timer);
    },
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function snippet(text) {
  if (!text) return null;
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > BODY_SNIPPET_LIMIT
    ? `${collapsed.slice(0, BODY_SNIPPET_LIMIT)}…`
    : collapsed;
}

// 429 and transient 5xx are retryable; 501/505 mean "never going to work".
function isRetryableStatus(status) {
  if (status === 429) return true;
  return status >= 500 && status !== 501 && status !== 505;
}

function parseRetryAfter(headerValue) {
  if (!headerValue) return null;

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());

  return null;
}

function extractCode(error) {
  const direct = error?.code ?? error?.errno ?? error?.cause?.code;
  if (typeof direct === "string" && direct) return direct;

  // node-fetch folds the syscall error into the message ("reason: read ECONNRESET").
  for (const code of NETWORK_ERROR_CODES) {
    if (typeof error?.message === "string" && error.message.includes(code)) {
      return code;
    }
  }
  return null;
}

function backoffFor(attempt) {
  const base = BASE_BACKOFF_MS * BACKOFF_FACTOR ** (attempt - 1);
  const jitter = base * JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(base + jitter));
}

function buildSignal(deadline) {
  const perAttempt = AbortSignal.timeout(PER_ATTEMPT_TIMEOUT_MS);
  return deadline ? AbortSignal.any([perAttempt, deadline.signal]) : perAttempt;
}

function normalizeError(error, label, attempt, deadline) {
  if (error instanceof UpstreamError) {
    error.attempts = attempt;
    return error;
  }

  // Check the deadline first: it aborts the same signal a per-attempt timeout
  // would, but it is terminal rather than retryable.
  if (deadline?.expired) {
    return new UpstreamError(`${label} aborted: request deadline exceeded`, {
      label,
      code: "DEADLINE_EXCEEDED",
      attempts: attempt,
      retryable: false,
    });
  }

  const code = extractCode(error);

  if (
    error?.name === "AbortError" ||
    error?.name === "TimeoutError" ||
    code === "ABORT_ERR"
  ) {
    return new UpstreamError(
      `${label} timed out after ${PER_ATTEMPT_TIMEOUT_MS}ms`,
      { label, code: "ETIMEDOUT", attempts: attempt, retryable: true },
    );
  }

  if (code && NETWORK_ERROR_CODES.has(code)) {
    return new UpstreamError(`${label} failed: ${error.message}`, {
      label,
      code,
      attempts: attempt,
      retryable: true,
    });
  }

  // node-fetch reports connection-level problems as FetchError/type "system"
  // even when the syscall code is one we do not recognise.
  if (error?.name === "FetchError" && error?.type === "system") {
    return new UpstreamError(`${label} failed: ${error.message}`, {
      label,
      code: code ?? "NETWORK_ERROR",
      attempts: attempt,
      retryable: true,
    });
  }

  // Anything else is most likely a bug on our side - do not retry it.
  return new UpstreamError(`${label} failed: ${error?.message ?? error}`, {
    label,
    code: "INTERNAL_ERROR",
    attempts: attempt,
    retryable: false,
  });
}

/**
 * Single entry point for every Diyanet call: bounded per attempt, retried on
 * transient failures, and loud in the logs either way.
 *
 * node-fetch v3 dropped the `timeout` option, and Node's http client has no
 * default socket timeout, so without the AbortSignal below a stalled
 * connection would hang indefinitely.
 */
async function fetchJson(url, options = {}, label = url, deadline = null) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        ...options,
        signal: buildSignal(deadline),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => null);
        throw new UpstreamError(
          `${label} returned HTTP ${response.status} ${response.statusText}`,
          {
            label,
            status: response.status,
            bodySnippet: snippet(body),
            code: "UPSTREAM_HTTP_ERROR",
            attempts: attempt,
            retryable: isRetryableStatus(response.status),
            retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
          },
        );
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // Previously this surfaced as a bare SyntaxError, or worse, as a
        // downstream "cannot read properties of undefined".
        throw new UpstreamError(`${label} returned a non-JSON body`, {
          label,
          status: response.status,
          bodySnippet: snippet(text),
          code: "INVALID_JSON",
          attempts: attempt,
          retryable: false,
        });
      }

      if (attempt > 1) {
        console.warn(
          `[upstream] ${label} succeeded on attempt ${attempt}/${MAX_ATTEMPTS} ` +
            `after ${attempt - 1} failure(s) (${Date.now() - startedAt}ms)`,
        );
      }
      return data;
    } catch (error) {
      const normalized = normalizeError(error, label, attempt, deadline);
      lastError = normalized;

      const reason = normalized.status
        ? `HTTP ${normalized.status}`
        : (normalized.code ?? "unknown error");
      console.error(
        `[upstream] ${label} attempt ${attempt}/${MAX_ATTEMPTS} failed — ` +
          `${reason} after ${Date.now() - startedAt}ms: ${normalized.message}`,
      );

      if (!normalized.retryable || attempt === MAX_ATTEMPTS) throw normalized;

      const delay = Math.min(
        normalized.retryAfterMs ?? backoffFor(attempt),
        RETRY_AFTER_CAP_MS,
      );

      // Never sleep into a deadline we cannot beat.
      if (deadline && delay + MIN_ATTEMPT_BUDGET_MS > deadline.remainingMs) {
        console.error(
          `[upstream] ${label} giving up after attempt ${attempt}/${MAX_ATTEMPTS}: ` +
            `${deadline.remainingMs}ms left is not enough for a retry`,
        );
        throw normalized;
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

// Canada Id: 52
// Ontario Id: 640
// Toronto Id: 9118

export async function login(deadline = null) {
  const email = process.env.DIYANET_EMAIL;
  const password = process.env.DIYANET_PASSWORD;

  if (!email || !password) {
    throw new UpstreamError(
      "Missing DIYANET_EMAIL and/or DIYANET_PASSWORD environment variables.",
      { label: "Auth/Login", code: "MISSING_CREDENTIALS", attempts: 0 },
    );
  }

  const data = await fetchJson(
    `${BASE_URL}/Auth/Login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    "Auth/Login",
    deadline,
  );

  return data.data?.accessToken;
}

/**
 * Holds the bearer token for one request and guarantees at most one re-login.
 *
 * The four data calls run concurrently, so an expired token makes all of them
 * return 401 at the same moment. The cached promise means they share a single
 * re-login instead of hammering /Auth/Login four times over.
 */
export function createSession(token, deadline = null) {
  let currentToken = token;
  let reloginPromise = null;

  return {
    get token() {
      return currentToken;
    },
    reloginOnce() {
      // Deliberately never cleared: one re-login per request, and a failed
      // re-login is reported to every waiter rather than retried per call.
      if (!reloginPromise) {
        reloginPromise = (async () => {
          console.warn("[upstream] got 401 — re-authenticating once");
          const freshToken = await login(deadline);
          if (!freshToken) {
            throw new UpstreamError(
              "Re-login succeeded but returned no access token.",
              { label: "Auth/Login", code: "LOGIN_NO_TOKEN" },
            );
          }
          currentToken = freshToken;
          return freshToken;
        })();
      }
      return reloginPromise;
    },
  };
}

async function fetchAuthenticated(url, label, session, deadline) {
  const get = (token, attemptLabel) =>
    fetchJson(
      url,
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      attemptLabel,
      deadline,
    );

  try {
    return await get(session.token, label);
  } catch (error) {
    if (!(error instanceof UpstreamError) || error.status !== 401) throw error;

    // One re-login, one retry. A second 401 is a hard failure.
    const freshToken = await session.reloginOnce();
    console.warn(`[upstream] ${label} retrying once with a refreshed token`);
    return await get(freshToken, `${label} (post-relogin)`);
  }
}

export function getStates(session, deadline = null) {
  return fetchAuthenticated(
    `${BASE_URL}/api/PrayerTime/Daily/9118`,
    "PrayerTime/Daily",
    session,
    deadline,
  );
}

export function getWeeklyPrayerTimes(session, deadline = null) {
  return fetchAuthenticated(
    `${BASE_URL}/api/PrayerTime/Weekly/9118`,
    "PrayerTime/Weekly",
    session,
    deadline,
  );
}

// Eid Prayer Time
export function getEidPrayerTime(cityId, session, deadline = null) {
  return fetchAuthenticated(
    `${BASE_URL}/api/PrayerTime/Eid/${cityId}`,
    "PrayerTime/Eid",
    session,
    deadline,
  );
}

// Ramadan Prayer Times
export function getRamadanPrayerTimes(cityId, session, deadline = null) {
  return fetchAuthenticated(
    `${BASE_URL}/api/PrayerTime/Ramadan/${cityId}`,
    "PrayerTime/Ramadan",
    session,
    deadline,
  );
}
