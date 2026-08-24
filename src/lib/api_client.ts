export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: { page: number; per_page: number; total: number };
  error?: { code: string; correlation_id: string; details?: unknown };
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function api_client<T>(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !envelope.success) {
    throw new ApiClientError(envelope.message, response.status, envelope.error?.code ?? 'request_failed', envelope.error?.details);
  }
  return envelope;
}
