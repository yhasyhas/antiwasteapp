// CORS : seules les origines autorisées (version web de l'app) reçoivent l'en-tête
// Access-Control-Allow-Origin. L'app mobile n'envoie pas d'en-tête Origin : elle n'est pas concernée.
// Le CORS ne protège que des sites tiers ouverts dans un navigateur ; l'authentification
// (_shared/auth.ts) reste la vraie protection.

// Liste séparée par des virgules, réglable par secret ; par défaut, le serveur web d'Expo en local
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:8081,http://127.0.0.1:8081')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeadersFor(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
  const origin = req.headers.get('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// Enveloppe une fonction : répond aux requêtes préliminaires OPTIONS et ajoute les en-têtes CORS
export function withCors(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const cors = corsHeadersFor(req);
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    const response = await handler(req);
    for (const [name, value] of Object.entries(cors)) response.headers.set(name, value);
    return response;
  };
}
