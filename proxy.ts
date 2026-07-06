import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

const PUBLIC_ROUTES = ['/login', '/demo']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  const sessionCookie = request.cookies.get('session')?.value
  const session = await decrypt(sessionCookie)
  const isAuth = !!session?.userId

  if (!isAuth && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuth && pathname === '/login') {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons).*)',],
}
