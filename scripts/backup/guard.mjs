// Hook PreToolUse de Claude Code (.claude/settings.json) : refuse toute commande qui applique des migrations à la base
// (supabase db push, migration up, psql -f supabase/migrations/…) sans sauvegarde vérifiée du jour.
// Reçoit l'appel d'outil en JSON sur l'entrée standard ; ne renvoie rien si la commande est autorisée.
import { appliesMigrations } from './verify.mjs';
import { checkToday } from './check.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const command = String(JSON.parse(input || '{}')?.tool_input?.command ?? '');
if (appliesMigrations(command)) {
  const problems = checkToday();
  if (problems.length > 0) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Une sauvegarde vide ou en échec bloque toute migration : ${problems.join(' ; ')}`,
      },
    }));
  }
}
