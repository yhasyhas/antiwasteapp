#!/usr/bin/env node
/**
 * Exporte le projet dans un seul fichier Markdown :
 *   - contexte (PROJECT_CONTEXT.md)
 *   - infos git (branche, commits, fichiers modifiés)
 *   - arborescence des fichiers
 *   - contenu des fichiers importants
 *
 * Usage :
 *   node scripts/export-project.mjs              -> export/project-export-AAAA-MM-JJ.md
 *   node scripts/export-project.mjs --with-diff  -> ajoute le diff complet des changements non commités
 *   node scripts/export-project.mjs --out chemin/fichier.md
 *
 * Aucune dépendance. Les secrets (.env*), node_modules, lockfiles et binaires sont exclus.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const withDiff = args.includes('--with-diff');
const outIdx = args.indexOf('--out');
const today = new Date().toISOString().slice(0, 10);
const outFile = path.resolve(
  ROOT,
  outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : `export/project-export-${today}.md`
);

// Dossiers jamais parcourus
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.expo', 'dist', 'web-build', 'export', '.temp', 'ios', 'android',
]);
// Fichiers jamais inclus (secrets, lockfiles, fichiers générés)
const IGNORED_FILES = [/^\.env/, /^package-lock\.json$/, /^yarn\.lock$/, /^pnpm-lock\.yaml$/, /\.tsbuildinfo$/];
// Extensions dont on exporte le contenu
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.sql', '.md', '.toml', '.yml', '.yaml',
]);
// Fichiers sans extension reconnue mais utiles
const TEXT_NAMES = new Set(['.gitignore', '.prettierrc']);
const MAX_FILE_BYTES = 200 * 1024;

const LANG = {
  '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.jsx': 'jsx', '.mjs': 'js', '.cjs': 'js',
  '.json': 'json', '.sql': 'sql', '.md': 'markdown', '.toml': 'toml', '.yml': 'yaml', '.yaml': 'yaml',
};

const isIgnoredFile = (name) => IGNORED_FILES.some((re) => re.test(name));
const isTextFile = (name) => TEXT_EXT.has(path.extname(name).toLowerCase()) || TEXT_NAMES.has(name);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// Parcourt le projet ; renvoie les lignes de l'arbre et la liste des fichiers texte
function walk(dir, prefix = '', tree = [], files = []) {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => (e.isDirectory() ? !IGNORED_DIRS.has(e.name) : !isIgnoredFile(e.name)))
    .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));

  entries.forEach((entry, i) => {
    const last = i === entries.length - 1;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      tree.push(`${prefix}${last ? '└── ' : '├── '}${entry.name}/`);
      walk(full, prefix + (last ? '    ' : '│   '), tree, files);
    } else {
      const size = fs.statSync(full).size;
      tree.push(`${prefix}${last ? '└── ' : '├── '}${entry.name}  (${formatSize(size)})`);
      if (isTextFile(entry.name)) files.push({ full, size });
    }
  });
  return { tree, files };
}

function formatSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

// Bloc de code dont la clôture est plus longue que toute suite de ` du contenu
function codeBlock(content, lang = '') {
  const longest = Math.max(2, ...(content.match(/`+/g) || []).map((m) => m.length));
  const fence = '`'.repeat(longest + 1);
  return `${fence}${lang}\n${content.replace(/\s+$/, '')}\n${fence}`;
}

const { tree, files } = walk(ROOT);
const out = [];

out.push(`# Export du projet : ${path.basename(ROOT)}`);
out.push(`\nGénéré le ${new Date().toLocaleString('fr-FR')} par \`scripts/export-project.mjs\`.\n`);

// 1. Contexte
const contextPath = path.join(ROOT, 'PROJECT_CONTEXT.md');
if (fs.existsSync(contextPath)) {
  out.push('---\n\n# Partie 1 : contexte\n');
  out.push(fs.readFileSync(contextPath, 'utf8').replace(/^# /gm, '## ').trim());
}

// 2. Git
const branch = git('rev-parse --abbrev-ref HEAD');
if (branch) {
  out.push('\n---\n\n# Partie 2 : état git\n');
  out.push(`- Branche : \`${branch}\``);
  out.push('\n### Derniers commits\n');
  out.push(codeBlock(git('log --oneline -n 20') || '(aucun)'));
  out.push('\n### Changements non commités\n');
  out.push(codeBlock(git('status --short') || '(aucun)'));
  const stat = git('diff --stat');
  if (stat) out.push('\n' + codeBlock(stat));
  if (withDiff) {
    const diff = git('diff');
    if (diff) out.push('\n### Diff complet\n\n' + codeBlock(diff, 'diff'));
  }
}

// 3. Arborescence
out.push('\n---\n\n# Partie 3 : arborescence\n');
out.push(codeBlock(`${path.basename(ROOT)}/\n${tree.join('\n')}`));
out.push(`\n_Exclus : ${[...IGNORED_DIRS].join(', ')}, .env*, lockfiles._`);

// 4. Contenu des fichiers
out.push('\n---\n\n# Partie 4 : contenu des fichiers\n');
let totalLines = 0;
for (const { full, size } of files) {
  const name = rel(full);
  if (name === 'PROJECT_CONTEXT.md') continue; // déjà en partie 1
  out.push(`\n## \`${name}\`\n`);
  if (size > MAX_FILE_BYTES) {
    out.push(`_Fichier trop gros (${formatSize(size)}), contenu omis._`);
    continue;
  }
  const content = fs.readFileSync(full, 'utf8');
  totalLines += content.split('\n').length;
  out.push(codeBlock(content, LANG[path.extname(full).toLowerCase()] || ''));
}

out.push(`\n---\n\n_${files.length} fichiers texte, ~${totalLines} lignes exportées._\n`);

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, out.join('\n'), 'utf8');
console.log(`Export écrit : ${rel(outFile)} (${formatSize(fs.statSync(outFile).size)}, ${files.length} fichiers)`);
