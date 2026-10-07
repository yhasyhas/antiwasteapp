// Lien de réinitialisation du mot de passe. Lancement : deno test --no-config --allow-env supabase/functions/ lib/
import { assertEquals } from 'jsr:@std/assert@1';
import { parseRecoveryLink } from './recoveryLink.ts';

Deno.test('lien de réinitialisation : jetons, erreur, lien sans jeton', () => {
  assertEquals(
    parseRecoveryLink('myapp://auth/reset#access_token=abc.def&expires_in=3600&refresh_token=r123&token_type=bearer&type=recovery'),
    { kind: 'session', accessToken: 'abc.def', refreshToken: 'r123' },
  );
  assertEquals(
    parseRecoveryLink('myapp://auth/reset#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'),
    { kind: 'error', code: 'otp_expired' },
  );
  assertEquals(parseRecoveryLink('http://localhost:8082/auth/reset?error=server_error'), { kind: 'error', code: 'server_error' });
  assertEquals(parseRecoveryLink('myapp://auth/reset'), { kind: 'none' });
  assertEquals(parseRecoveryLink(null), { kind: 'none' });
  // Autre type de lien (inscription) : pas une réinitialisation
  assertEquals(parseRecoveryLink('myapp://auth/reset#access_token=a&refresh_token=b&type=signup'), { kind: 'none' });
});
