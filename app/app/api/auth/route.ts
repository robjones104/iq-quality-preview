import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { password } = await request.json();

  if (!password || password !== process.env.PREVIEW_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect access code' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('iq-auth', process.env.TOKEN_SECRET!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
