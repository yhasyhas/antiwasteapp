// Accessibilité (phase 10) : chaque élément touchable des écrans (Touchable, Pressable, TouchableOpacity, Card avec onPress) a un
// nom pour les lecteurs d'écran : un texte visible parmi ses enfants, ou un accessibilityLabel. Un bouton qui ne
// contient qu'une icône (fermer, retour, favori…) doit avoir un accessibilityLabel.
// Lancement depuis la racine : node scripts/a11y-audit.mjs (code de sortie 1 et liste des éléments sans nom)
import fs from 'node:fs';

const ROOTS = ['app', 'components'];
const TOUCHABLES = ['Touchable', 'Pressable', 'TouchableOpacity', 'TouchableHighlight', 'RoundButton'];

function* tsxFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) yield* tsxFiles(path);
    else if (path.endsWith('.tsx')) yield path;
  }
}

// Élément JSX complet à partir de « <Nom » : balises du même nom imbriquées comptées ; null s'il se ferme seul
function elementAt(source, start, name) {
  let depth = 0;
  let i = start;
  const open = new RegExp(`<${name}(?=[\\s>/])`, 'y');
  const close = `</${name}>`;
  let propsEnd = -1;
  while (i < source.length) {
    open.lastIndex = i;
    if (open.test(source)) {
      // Fin des attributs : premier « > » hors accolades
      let braces = 0;
      let j = i + name.length + 1;
      for (; j < source.length; j++) {
        const ch = source[j];
        if (ch === '{') braces++;
        else if (ch === '}') braces--;
        else if (ch === '>' && braces === 0) break;
      }
      const selfClosing = source[j - 1] === '/';
      if (depth === 0) {
        if (selfClosing) return { props: source.slice(start, j), children: '' };
        propsEnd = j;
      }
      if (!selfClosing) depth++;
      i = j + 1;
      continue;
    }
    if (source.startsWith(close, i)) {
      depth--;
      if (depth === 0) return { props: source.slice(start, propsEnd), children: source.slice(propsEnd + 1, i) };
      i += close.length;
      continue;
    }
    i++;
  }
  return null;
}

// Nom accessible : accessibilityLabel (ou label= pour RoundButton, qui le transmet), ou texte visible (balise Text,
// Button avec label)
const named = (props, children) =>
  /accessibilityLabel=|\slabel=/.test(props) || /<Text[\s>]/.test(children) || /<Button[\s\S]*?label=/.test(children)
  || /accessibilityElementsHidden|importantForAccessibility="no/.test(props);

const missing = [];
for (const root of ROOTS) {
  for (const file of tsxFiles(root)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const name of [...TOUCHABLES, 'Card']) {
      const pattern = new RegExp(`<${name}(?=[\\s>/])`, 'g');
      for (const match of source.matchAll(pattern)) {
        const element = elementAt(source, match.index, name);
        if (!element) continue;
        // Carte simple (sans onPress) : pas touchable
        if (name === 'Card' && !/onPress=/.test(element.props)) continue;
        if (!named(element.props, element.children)) {
          const line = source.slice(0, match.index).split('\n').length;
          missing.push(`${file}:${line} <${name}>`);
        }
      }
    }
  }
}
if (missing.length > 0) {
  console.log(`Éléments touchables sans nom pour les lecteurs d'écran (${missing.length}) :`);
  for (const item of missing) console.log(item);
  process.exit(1);
}
console.log('Accessibilité : tous les éléments touchables ont un nom.');
