import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');

  if (!secret || secret !== process.env.HOTSITE_REVALIDATE_SECRET) {
    return NextResponse.json({ message: 'Invalid or missing secret' }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get('slug');
  if (slug) {
    revalidatePath(`/${slug}`, 'page');
  }

  return NextResponse.json({ revalidated: true, slug });
}
