export default function middleware(request) {
  const authorization = request.headers.get('authorization');

  if (authorization) {
    const authValue = authorization.split(' ')[1];
    const [user, pwd] = atob(authValue).split(':');

    // Zugangsdaten (alternativ über Vercel Environment Variables steuerbar)
    const validUser = process.env.BASIC_AUTH_USER || 'captain';
    const validPassword = process.env.BASIC_AUTH_PASSWORD || 'tischtennis2026';

    if (user === validUser && pwd === validPassword) {
      return; // Zugriff erlauben
    }
  }

  // Öffnet das standardmäßige Browser-Anmeldefenster
  return new Response('Authentifizierung erforderlich', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="TT Captain Geschlossener Testbetrieb"',
    },
  });
}

// Optional: Schützt alle Routen (außer interne Assets)
export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
