// Gera a galeria (index.html + faces/*.html) a partir dos desenhos do canvas copiados em src/.
// Uso: node site/build.js
const fs = require('fs');
const path = require('path');

const here = __dirname;
const src = path.join(here, 'src');
const outFaces = path.join(here, 'faces');
fs.mkdirSync(outFaces, { recursive: true });

// Mostradores que estão instalados no relógio (projetos nesta pasta)
const NO_RELOGIO = {
  'ProfundidadeDourado.dc.html': 'Profundidade',
  'OusadoInfinito.dc.html': 'Engrenagens',
  'AneisPrata.dc.html': 'Halo',
  'AneisFumaca.dc.html': 'Fumaça',
  'AneisTunel.dc.html': 'Túnel',
  'Treino.dc.html': 'Treino'
};

// Desenhos que ficam só no canvas privado, nunca na galeria pública (ex.: usam arte de terceiros)
const PRIVADOS = ['Terminal.dc.html'];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const canvas = JSON.parse(fs.readFileSync(path.join(src, 'canvas.json'), 'utf8'));

function convert(file) {
  const html = fs.readFileSync(path.join(src, file), 'utf8');
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, file])[1];
  const xdc = html.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1];
  const helmet = (xdc.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
  const body = xdc.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const script = html.match(/<script type="text\/x-dc" data-dc-script data-props='([^']*)'>([\s\S]*?)<\/script>/);
  if (!script) throw new Error('sem script em ' + file);
  const out = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${title}</title>
${helmet.trim()}
<style>html,body{margin:0;background:#161618;overflow:hidden}</style>
</head>
<body>
<template id="dc-tpl">${body}</template>
<script type="text/x-dc" id="dc-logic" data-props='${script[1]}'>${script[2]}</script>
<script src="../dc-mini.js"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(outFaces, file.replace('.dc.html', '.html')), out);
}

// Grupos: cada artboard fica sob o título de grupo (nota "title1") mais próximo acima dele
const titles = Object.values(canvas.notes || {}).filter((n) => n.kind === 'title1').sort((a, b) => a.y - b.y);
const groups = titles.map((t) => ({ title: t.text, y: t.y, items: [] }));
const boards = canvas.order.filter((f) => !PRIVADOS.includes(f)).map((f) => ({ file: f, ...canvas.boards[f] }));
for (const f of PRIVADOS) for (const p of [path.join(src, f), path.join(outFaces, f.replace('.dc.html', '.html'))]) if (fs.existsSync(p)) fs.unlinkSync(p);
for (const b of boards) {
  convert(b.file);
  let g = groups[0];
  for (const t of groups) if (t.y < b.y) g = t;
  g.items.push(b);
}
for (const g of groups) g.items.sort((a, b) => a.y - b.y || a.x - b.x);
// O primeiro título do canvas é o nome do relógio; aqui o grupo vira "Clássicos"
if (groups[0] && /Galaxy Watch/i.test(groups[0].title)) groups[0].title = 'Clássicos';

const card = (b) => {
  const [code, ...rest] = (b.title || b.file).split(' · ');
  const name = rest.join(' · ') || code;
  const watch = NO_RELOGIO[b.file];
  const tags = [watch ? `<span class="tag on">No relógio · ${esc(watch)}</span>` : '', b.is_interactive ? '<span class="tag">Interativo</span>' : ''].join('');
  return `      <figure class="card">
        <div class="frame"><iframe src="faces/${b.file.replace('.dc.html', '.html')}" title="${esc(b.title || b.file)}" loading="lazy" scrolling="no"></iframe></div>
        <figcaption><span class="code">${esc(code)}</span><span class="name">${esc(name.replace(/\s*\(no relógio\)\s*/i, ''))}</span>${tags ? `<span class="tags">${tags}</span>` : ''}</figcaption>
      </figure>`;
};

const index = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mostradores · Galaxy Watch4</title>
<meta name="description" content="Mostradores criados por Erick Nogueira para o Galaxy Watch4, animados e com a hora real.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&amp;family=Barlow+Condensed:wght@500;600&amp;display=swap" rel="stylesheet">
<style>
:root{--bg:#0d0d0f;--surface:#161618;--line:#232327;--text:#ececef;--muted:#8d8d94;--accent:#b6f03c}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--text);font-family:'Barlow Condensed',system-ui,sans-serif}
a{color:var(--text)}
.wrap{max-width:1240px;margin:0 auto;padding:56px 24px 72px}
header h1{font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:clamp(56px,9vw,104px);line-height:.9;letter-spacing:1px;margin:0}
header p{margin:14px 0 0;font-size:20px;color:var(--muted);max-width:640px;line-height:1.35}
section{margin-top:64px}
h2{font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:38px;letter-spacing:1px;margin:0 0 20px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:28px}
.card{margin:0}
.frame{position:relative;width:100%;aspect-ratio:1;overflow:hidden;border-radius:18px;background:var(--surface)}
.frame iframe{position:absolute;left:0;top:0;width:520px;height:520px;border:0;transform-origin:0 0;transform:scale(var(--s,0.5))}
figcaption{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:12px 2px 0}
.code{font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--muted)}
.name{font-size:19px;font-weight:600}
.tags{display:flex;flex-wrap:wrap;gap:6px;width:100%}
.tag{font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:3px 9px;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
.tag.on{border-color:var(--accent);color:var(--accent)}
footer{margin-top:72px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:16px}
@media (max-width:600px){.wrap{padding:36px 16px 56px}section{margin-top:44px}.grid{gap:22px}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Mostradores</h1>
    <p>Criações para o Galaxy Watch4, todas animadas e com a hora real. Os marcados como “no relógio” já estão instalados no pulso.</p>
  </header>
${groups.filter((g) => g.items.length).map((g) => `  <section>
    <h2>${esc(g.title)}</h2>
    <div class="grid">
${g.items.map(card).join('\n')}
    </div>
  </section>`).join('\n')}
  <footer>Erick Nogueira · Galaxy Watch4 (450×450)</footer>
</div>
<script>
// Cada mostrador é desenhado em 520×520 e reduzido para caber no cartão
var ro = new ResizeObserver(function (es) { es.forEach(function (e) { e.target.style.setProperty('--s', e.contentRect.width / 520); }); });
document.querySelectorAll('.frame').forEach(function (f) { ro.observe(f); });
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(here, 'index.html'), index);
console.log(`galeria: ${boards.length} mostradores em ${groups.filter((g) => g.items.length).length} grupos`);
