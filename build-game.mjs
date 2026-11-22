import fs from 'node:fs';

const css = fs.readFileSync('./src-game/style.css', 'utf8');
const engine = fs.readFileSync('./src-game/engine.js', 'utf8');
const app = fs.readFileSync('./src-game/app.js', 'utf8');
const shell = fs.readFileSync('./src-game/shell.html', 'utf8');

const script = `${engine}\n${app}`;
const html = shell
  .replace('/*__CSS__*/', () => css)
  .replace('/*__SCRIPT__*/', () => script);

fs.writeFileSync('./index.html', html);
console.log('Built index.html', (html.length / 1024).toFixed(1) + ' KB');
