const DEFAULT_API_BASE_URL = "/api/v1";

type ApiEnvelope<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

type ApiFailure = {
  success: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, options: { status: number; code?: string; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  return typeof configuredBaseUrl === "string" && configuredBaseUrl.trim() ? configuredBaseUrl : DEFAULT_API_BASE_URL;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
    signal?: AbortSignal;
  } = {},
) {
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as ApiEnvelope<T> | ApiFailure) : null;

  if (!response.ok) {
    const failure = payload && "success" in payload && payload.success === false ? payload.error : undefined;

    throw new ApiError(failure?.message ?? "Request failed.", {
      status: response.status,
      code: failure?.code,
      details: failure?.details,
    });
  }

  if (!payload || !("success" in payload) || payload.success !== true) {
    throw new ApiError("Unexpected API response.", {
      status: response.status,
    });
  }

  return payload.data;
}
