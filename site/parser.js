/* Analyse déterministe d'une annale corrigée au format du tutorat :
   « Question N – énoncé : ABD », items « A. … », corrections « A VRAI … ».
   Aucun texte n'est inventé : tout provient des lignes du document. */
(function (root) {
  'use strict';
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const RX_Q = /^\s*(?:Question|QUESTION|Q)\s*(?:n\s*°\s*)?(\d{1,3})\s*(?:[-–—:.)]|\s)\s*(.*)$/;
  const RX_ITEM = /^\s*([A-G])\s*(?:[.)]|\s[-–—])\s*(.*)$/;
  const RX_COR = /^\s*([A-G])\s*[:\-–—.]?\s*(VRAI|FAUX|Vrai|Faux|vrai|faux)\b\s*[:\-–—.!]?\s*(.*)$/;
  const RX_COR_BARE = /^\s*(VRAI|FAUX)\b\s*[:\-–—.!]?\s*(.*)$/;
  const RX_NOISE = [
    /Page\s+\d+\s+sur\s+\d+/i, /^\s*\d+\s+sur\s+\d+\s*$/i, /^\s*\d{1,3}\s*$/, /^\s*Tutorat\b/i,
    /^\s*UE\s?4\s*[-–—]\s*(CC|CT|ET|CCI)/i, /Annales Classées Corrigées\s+Page/i
  ];

  function clean(s) { return s.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim(); }
  function join(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (/[-‐]$/.test(a) && /^[a-zà-ÿ]/.test(b) && !/\s-$/.test(a)) return a + b; // césure
    return a + ' ' + b;
  }
  function isNoise(l) { return RX_NOISE.some(r => r.test(l)); }

  function quickTable(lines) {
    const map = {};
    for (const l of lines) {
      const m = l.match(/^\s*(\d{1,3})\s+([A-G]{1,7}|Annulée|ANNULÉE|annulée)\s*$/);
      if (m) map[+m[1]] = m[2];
    }
    return map;
  }

  function guessType(stem) {
    return /(une seule (proposition|réponse|affirmation)|réponse unique|\bcochez l['’]|\bla proposition (exacte|juste|correcte)\b|quelle est la (proposition|réponse) (exacte|juste|correcte))/i.test(stem) ? 'QRU' : 'QRM';
  }

  function parse(text, opts) {
    opts = opts || {};
    const raw = String(text).replace(/\r/g, '').split('\n').map(clean);
    const lines = raw.filter(l => l && !isNoise(l));
    const firstQ = lines.findIndex(l => RX_Q.test(l));
    const quick = quickTable(firstQ > 0 ? lines.slice(0, firstQ) : []);
    const blocks = [];
    let cur = null;
    for (let i = Math.max(firstQ, 0); i < lines.length; i++) {
      const l = lines[i];
      const mq = l.match(RX_Q);
      if (mq && (!cur || cur.phase !== 'stem' || cur.stem.length > 0) && plausibleQ(+mq[1], blocks, cur)) {
        cur = { num: +mq[1], stem: mq[2] ? [mq[2]] : [], items: [], cors: [], general: [], phase: 'stem' };
        // « Question 2 – Titre : ACD » : les lettres de réponse terminent la ligne de titre
        const tl = (mq[2] || '').match(/^(.*\S)\s*:\s*([A-G]{1,7}|Ø|∅)\s*$/) || (mq[2] || '').match(/^()([A-G]{1,7})\s*$/);
        if (tl && (/^[ØA-G∅]+$/.test(tl[2])) && (tl[2].length === 1 || new Set(tl[2]).size === tl[2].length)) { cur.letters = /[Ø∅]/.test(tl[2]) ? '' : tl[2]; cur.stem = tl[1] ? [tl[1] + ' :'] : []; }
        blocks.push(cur);
        continue;
      }
      if (!cur) continue;
      const mc = l.match(RX_COR);
      if (mc && (cur.items.length >= 2 || cur.phase === 'cor' || (mc[1] === 'A' && cur.phase === 'stem' && cur.stem.length >= 3))) { cur.phase = 'cor'; cur.cors.push({ letter: mc[1], verdict: mc[2].toUpperCase(), text: mc[3] || '' }); continue; }
      const mb = l.match(RX_COR_BARE);
      if (mb && cur.items.length >= 2 && cur.cors.length < cur.items.length) { cur.phase = 'cor'; cur.cors.push({ letter: LETTERS[cur.cors.length], verdict: mb[1], text: mb[2] || '' }); continue; }
      const mi = l.match(RX_ITEM);
      if (mi && cur.phase !== 'cor') {
        const expected = LETTERS[cur.items.length];
        if (mi[1] === expected) { cur.phase = 'items'; cur.items.push({ letter: mi[1], text: mi[2] }); continue; }
      }
      if (cur.phase === 'stem') cur.stem.push(l);
      else if (cur.phase === 'items') { const it = cur.items[cur.items.length - 1]; it.text = join(it.text, l); }
      else {
        const last = cur.cors[cur.cors.length - 1];
        if (cur.cors.length >= cur.items.length && cur.items.length) cur.general.push(l);
        else last.text = join(last.text, l);
      }
    }
    // Items sans lettre (listes automatiques) : les N dernières lignes de l'énoncé avant « A VRAI/FAUX ».
    blocks.forEach(b => {
      if (b.items.length === 0 && b.cors.length >= 2 && b.stem.length > b.cors.length) {
        const n = b.cors.length;
        b.items = b.stem.splice(b.stem.length - n, n).map((t, k) => ({ letter: LETTERS[k], text: t }));
        b.guessedItems = true;
      }
    });
    // Trop d'items par rapport aux corrections : une consigne (« … ? », « … : ») ou une image vide a été prise pour un item.
    blocks.forEach(b => {
      const n = new Set(b.cors.map(c => c.letter)).size;
      if (n < 2) return;
      let changed = false;
      while (b.items.length > n) {
        const k = b.items.findIndex(it => !it.text.trim());
        if (k >= 0) { b.items.splice(k, 1); changed = true; continue; }
        if (/[:?]\s*$/.test(b.items[0].text)) { b.stem.push(b.items.shift().text); changed = true; continue; }
        break;
      }
      if (changed) b.items.forEach((it, k) => { it.letter = LETTERS[k]; });
    });
    const questions = blocks.filter(b => b.items.length >= 2).map(b => {
      let stem = b.stem.reduce(join, '');
      let letters = b.letters != null ? b.letters : null;
      const tail = stem.match(/^(.*?[:?.)])\s*([A-G]{1,7})\s*$/) || stem.match(/^(.*\S)\s+([A-G]{1,7})\s*$/);
      if (letters === null && tail && /^[A-G]+$/.test(tail[2]) && new Set(tail[2]).size === tail[2].length) { stem = tail[1].trim(); letters = tail[2]; }
      if (letters === null) {
        // titre sur plusieurs lignes : « … associées : CD Indiquez … »
        const mid = stem.match(/^(.{5,300}?:)\s*([A-G]{1,7})\s+(?=[A-ZÀ-ÝÉ«])/);
        if (mid && new Set(mid[2]).size === mid[2].length && (mid[2].length > 1 || mid[2] === quick[b.num])) { letters = mid[2]; stem = mid[1] + ' ' + stem.slice(mid[0].length); }
      }
      const corrections = {};
      b.cors.forEach(c => { if (!corrections[c.letter]) corrections[c.letter] = { verdict: c.verdict, text: c.text.trim() }; });
      const fromCor = b.items.map(it => it.letter).filter(L => corrections[L] && corrections[L].verdict === 'VRAI');
      const q = quick[b.num];
      let annul = false, answer, notes = '';
      if (q && /annul/i.test(q)) { annul = true; answer = []; }
      // Les lettres écrites avec la question priment : le tableau de correction rapide est souvent décalé à l'extraction du PDF.
      else answer = (letters != null && letters !== '' ? letters : (q || letters || fromCor.join(''))).split('').filter(x => /[A-G]/.test(x));
      if (letters === '' && !q) answer = [];
      const ref = letters ? letters : q && !/annul/i.test(q) ? q : letters;
      if (ref && b.cors.length === b.items.length && ref !== fromCor.join('')) notes = `Les lettres de la correction (${ref}) ne correspondent pas aux VRAI/FAUX détaillés (${fromCor.join('') || 'aucun VRAI'}).`;
      if (letters && q && !/annul/i.test(q) && q !== letters) notes = (notes ? notes + ' ' : '') + `Le tableau de correction rapide indique ${q} (les lettres de la question, ${letters}, ont été retenues).`;
      if (!b.cors.length) notes = (notes ? notes + ' ' : '') + 'Pas de correction détaillée trouvée.';
      if (b.guessedItems) notes = (notes ? notes + ' ' : '') + 'Items sans lettre dans le document : découpage à vérifier.';
      return {
        num: b.num, type: guessType(stem), context: '', stem,
        items: b.items.map(it => ({ letter: it.letter, text: it.text.trim() })),
        answer, corrections, general: b.general.join('\n'), figures: [], correctionFigures: [],
        status: annul ? 'annulée' : 'ok', notes
      };
    });
    return { questions, quick, warnings: blocks.filter(b => b.items.length < 2).map(b => `Question ${b.num} : items introuvables`) };
  }
  function plausibleQ(n, blocks, cur) {
    if (!blocks.length) return true;
    const last = blocks[blocks.length - 1].num;
    return n > last && n <= last + 15;
  }

  /* Reconstitue des lignes à partir des fragments de texte pdf.js (getTextContent). */
  function linesFromPdfItems(items) {
    const rows = [];
    for (const it of items) {
      if (!it.str && !it.hasEOL) continue;
      const y = Math.round(it.transform[5]), x = it.transform[4];
      let r = rows.find(r => Math.abs(r.y - y) <= 2);
      if (!r) { r = { y, parts: [] }; rows.push(r); }
      r.parts.push({ x, s: it.str, w: it.width || 0 });
    }
    rows.sort((a, b) => b.y - a.y);
    return rows.map(r => {
      r.parts.sort((a, b) => a.x - b.x);
      let out = '', end = null;
      for (const p of r.parts) {
        if (end !== null && p.x - end > 1.5 && !/\s$/.test(out) && !/^\s/.test(p.s)) out += ' ';
        out += p.s; end = p.x + p.w;
      }
      return out;
    });
  }

  const api = { parse, linesFromPdfItems, guessType };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AnnaleParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
