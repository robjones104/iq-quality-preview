import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const expectedPassword = process.env.PREVIEW_PASSWORD;
  const secret = process.env.TOKEN_SECRET;

  if (expectedPassword && password !== expectedPassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  if (secret) {
    response.cookies.set('iq-auth', secret, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }
  return response;
}
