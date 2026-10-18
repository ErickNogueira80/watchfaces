// Motor mínimo que roda um mostrador do canvas (.dc.html) fora do claude.ai.
// Suporta o que os mostradores usam: {{caminho}} em texto e atributos, <sc-for>, <sc-if>,
// eventos onClick="{{fn}}" e a classe Component extends DCLogic (props, state, setState, ciclo de vida).
(function () {
  'use strict';

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      const p = typeof patch === 'function' ? patch(this.state, this.props) : patch;
      this.state = Object.assign({}, this.state, p);
      schedule();
    }
    forceUpdate() { schedule(); }
  }

  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const ONLY = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function lookup(scope, path) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^(['"]).*\1$/.test(path)) return path.slice(1, -1);
    let v = scope;
    for (const k of path.split('.')) { if (v == null) return undefined; v = v[k]; }
    return v;
  }
  const str = (v) => (v == null || v === false ? '' : String(v));
  const interp = (s, scope) => s.replace(HOLE, (_, p) => str(lookup(scope, p)));

  // Constrói a árvore nova a partir do modelo
  function build(node, scope, out) {
    if (node.nodeType === 3) { out.push(document.createTextNode(interp(node.data, scope))); return; }
    if (node.nodeType !== 1) return;
    const tag = node.localName;
    if (tag === 'sc-for') {
      const list = lookup(scope, (node.getAttribute('list').match(ONLY) || [])[1]) || [];
      const as = node.getAttribute('as') || 'item';
      list.forEach((item, i) => {
        const s = Object.create(scope); s[as] = item; s.$index = i;
        node.childNodes.forEach((c) => build(c, s, out));
      });
      return;
    }
    if (tag === 'sc-if') {
      if (lookup(scope, (node.getAttribute('value').match(ONLY) || [])[1])) node.childNodes.forEach((c) => build(c, scope, out));
      return;
    }
    const el = node.cloneNode(false);
    el.__h = {};
    for (const a of Array.from(node.attributes)) {
      if (a.name.startsWith('hint-')) { el.removeAttribute(a.name); continue; }
      const only = a.value.match(ONLY);
      if (a.name.startsWith('on') && only) {
        el.removeAttribute(a.name);
        const fn = lookup(scope, only[1]);
        if (typeof fn === 'function') el.__h[a.name.slice(2).toLowerCase()] = fn;
        continue;
      }
      if (a.value.indexOf('{{') >= 0) el.setAttribute(a.name, interp(a.value, scope));
    }
    const kids = [];
    (node.content || node).childNodes.forEach((c) => build(c, scope, kids));
    kids.forEach((k) => el.appendChild(k));
    out.push(el);
  }

  // Liga os eventos de um elemento uma vez; o handler atual fica em el.__h
  function wire(el) {
    if (!el.__h) return;
    el.__w = el.__w || {};
    for (const ev of Object.keys(el.__h)) {
      if (el.__w[ev]) continue;
      el.__w[ev] = true;
      el.addEventListener(ev, (e) => { const f = el.__h && el.__h[ev]; if (f) f(e); });
    }
  }
  function wireTree(n) { if (n.nodeType === 1) { wire(n); n.childNodes.forEach(wireTree); } }

  // Atualiza a árvore atual no lugar, para não reiniciar animações CSS
  function patch(parent, oldN, newN) {
    if (!oldN) { parent.appendChild(newN); wireTree(newN); return; }
    if (oldN.nodeType !== newN.nodeType || (oldN.nodeType === 1 && (oldN.localName !== newN.localName || oldN.namespaceURI !== newN.namespaceURI))) {
      parent.replaceChild(newN, oldN); wireTree(newN); return;
    }
    if (oldN.nodeType === 3) { if (oldN.data !== newN.data) oldN.data = newN.data; return; }
    for (const a of Array.from(oldN.attributes)) if (!newN.hasAttribute(a.name)) oldN.removeAttribute(a.name);
    for (const a of Array.from(newN.attributes)) if (oldN.getAttribute(a.name) !== a.value) oldN.setAttribute(a.name, a.value);
    oldN.__h = newN.__h; wire(oldN);
    const o = Array.from(oldN.childNodes), n = Array.from(newN.childNodes);
    for (let i = 0; i < n.length; i++) patch(oldN, o[i], n[i]);
    for (let i = n.length; i < o.length; i++) oldN.removeChild(o[i]);
  }

  let inst, tpl, root, pending = false;
  function render() {
    pending = false;
    const vals = inst.renderVals() || {};
    const out = [];
    tpl.content.childNodes.forEach((c) => build(c, vals, out));
    const frag = document.createElement('div');
    out.forEach((n) => frag.appendChild(n));
    patch(document.body, root, frag);
    root = root || frag;
  }
  function schedule() { if (!pending && inst) { pending = true; requestAnimationFrame(render); } }

  function start() {
    tpl = document.getElementById('dc-tpl');
    const logic = document.getElementById('dc-logic');
    const spec = JSON.parse(logic.getAttribute('data-props') || '{}');
    const props = {};
    for (const k of Object.keys(spec)) if (k[0] !== '$' && spec[k] && 'default' in spec[k]) props[k] = spec[k].default;
    const Component = new Function('DCLogic', logic.textContent + '\n;return Component;')(DCLogic);
    inst = new Component(props);
    if (!inst.state) inst.state = {};
    root = null;
    pending = true;
    render();
    if (inst.componentDidMount) inst.componentDidMount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
