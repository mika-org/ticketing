import { NextRequest } from 'next/server';
import { ApiError, api_error, api_ok } from '@/lib/server/api';
import { process_xendit_webhook } from '@/lib/server/payments';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, any>;
    try {
      body = (await request.json()) as Record<string, any>;
    } catch {
      throw new ApiError(400, 'invalid_json', 'Body webhook tidak valid');
    }
    return api_ok(await process_xendit_webhook(request, body));
  } catch (error) {
    return api_error(error);
  }
}
