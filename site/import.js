/* Import de nouveaux documents : PDF, Word, texte, photos, ou sauvegarde .json.
   1) analyse automatique (parser.js) : le texte des questions vient tel quel du document ;
   2) en secours, transcription par Claude avec consigne « mot pour mot », puis contrôle :
      chaque item est recherché dans le texte du document. */
(function () {
  'use strict';
  const IDB_NAME = 'ue4-imports', STORE = 'exams';
  let U;                       // window.UE4 (fourni par index.html)
  let state = null;            // import en cours
  let sampleFn = null, downloads = null;

  /* ---------- stockage local (IndexedDB, repli localStorage) ---------- */
  function idb() {
    return new Promise((res, rej) => {
      try {
        const r = indexedDB.open(IDB_NAME, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  }
  async function loadAll() {
    try {
      const db = await idb();
      return await new Promise((res, rej) => { const t = db.transaction(STORE).objectStore(STORE).getAll(); t.onsuccess = () => res(t.result || []); t.onerror = () => rej(t.error); });
    } catch (e) {
      try { return JSON.parse(localStorage.getItem('ue4:imports') || '[]'); } catch (e2) { return []; }
    }
  }
  async function putExam(exam) {
    try {
      const db = await idb();
      await new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(exam); t.oncomplete = res; t.onerror = () => rej(t.error); });
    } catch (e) {
      const all = U.getImports().filter(x => x.id !== exam.id).concat([exam]);
      try { localStorage.setItem('ue4:imports', JSON.stringify(all)); } catch (e2) { throw new Error('Stockage plein ou indisponible sur cet appareil.'); }
    }
  }
  async function delExam(id) {
    try {
      const db = await idb();
      await new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(id); t.oncomplete = res; t.onerror = () => rej(t.error); });
    } catch (e) {
      try { localStorage.setItem('ue4:imports', JSON.stringify(U.getImports().filter(x => x.id !== id))); } catch (e2) {}
    }
  }
  async function refresh() { const list = await loadAll(); list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); U.setImports(list); }

  /* ---------- extraction ---------- */
  const LIBS = {
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    mammoth: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
  };
  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    return (loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res;
      s.onerror = () => { delete loaded[src]; rej(new Error('Impossible de charger le lecteur de documents (connexion internet ?)')); };
      document.head.appendChild(s);
    }));
  }
  async function readPdf(file, progress) {
    await loadScript(LIBS.pdf);
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfWorker;
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const lines = [], pageTexts = [];
    for (let p = 1; p <= doc.numPages; p++) {
      progress(`Lecture de la page ${p} sur ${doc.numPages}…`);
      const tc = await (await doc.getPage(p)).getTextContent();
      const pl = window.AnnaleParser.linesFromPdfItems(tc.items);
      pageTexts.push(norm(pl.join(' ')));
      lines.push(...pl, '');
    }
    const cache = {};
    const renderPage = async (i) => {
      if (cache[i]) return cache[i];
      const page = await doc.getPage(i + 1);
      const vp = page.getViewport({ scale: 1.6 });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      return (cache[i] = c.toDataURL('image/jpeg', 0.82));
    };
    return { text: lines.join('\n'), pageCount: doc.numPages, renderPage, pageTexts };
  }
  const staticPages = (arr) => ({ pageCount: arr.length, renderPage: async i => arr[i] });
  async function readDocx(file, progress) {
    await loadScript(LIBS.mammoth);
    progress('Lecture du document Word…');
    const buf = await file.arrayBuffer();
    const pages = [];
    const out = await window.mammoth.convertToHtml({ arrayBuffer: buf }, {
      convertImage: window.mammoth.images.imgElement(img => img.read('base64').then(b64 => { const src = `data:${img.contentType};base64,${b64}`; pages.push(src); return { src }; }))
    });
    // Les listes numérotées de Word (items A, B, C…) deviennent des lignes « A. texte ».
    const dom = new DOMParser().parseFromString(out.value, 'text/html');
    const lines = [];
    const walk = (el) => {
      for (const n of el.children) {
        const tag = n.tagName;
        if (tag === 'OL' || tag === 'UL') {
          [...n.children].filter(li => li.tagName === 'LI').forEach((li, k) => {
            const sub = li.querySelector('ol,ul'); if (sub) sub.remove();
            lines.push(`${String.fromCharCode(65 + k)}. ${li.textContent.trim()}`);
            if (sub) walk({ children: [sub] });
          });
        } else if (tag === 'TABLE') {
          n.querySelectorAll('tr').forEach(tr => lines.push([...tr.children].map(td => td.textContent.trim()).join('\t')));
        } else lines.push(n.textContent.trim());
      }
    };
    walk(dom.body);
    return Object.assign({ text: lines.join('\n') }, staticPages(pages));
  }
  function readAsDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); }); }
  async function shrink(dataUrl, maxW) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
    const k = Math.min(1, maxW / img.naturalWidth);
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  }
  const dataUrlToBlob = async (u) => (await fetch(u)).blob();

  /* ---------- Claude ---------- */
  const PROMPT = `Tu reçois une annale corrigée de QCM de médecine (PASS, UE4) : soit son texte extrait, soit des photos de ses pages.
Ta seule tâche : la TRANSCRIRE en JSON, MOT POUR MOT.
Règles absolues :
- Ne crée aucune question, aucun item, aucune correction. N'invente rien. Ne reformule rien, ne résume rien, ne corrige pas les fautes.
- Recolle seulement les lignes coupées par la mise en page et retire en-têtes/pieds de page.
- "answer" = lettres justes données par le document (correction rapide, lettres après l'énoncé ou VRAI/FAUX). Si le document ne donne pas la réponse : "answer": [] et "notes": "Pas de correction dans le document".
- "corrections" = pour chaque item, le verdict (VRAI/FAUX) et le texte d'explication qui suit, tels quels ("" s'il n'y a rien).
- "type" = "QRU" seulement si l'énoncé demande explicitement une seule réponse, sinon "QRM".
- Une figure/structure chimique/tableau-image ne se transcrit pas : écris dans "notes" « Figure dans le document (page N) ».
Réponds UNIQUEMENT avec ce JSON :
{"title":"titre du document","questions":[{"num":1,"type":"QRM","context":"","stem":"énoncé","items":[{"letter":"A","text":"…"}],"answer":["A","C"],"corrections":{"A":{"verdict":"VRAI","text":"…"}},"general":"","notes":""}]}`;

  async function claudeText(text, progress, signal) {
    const chunks = splitChunks(text, 60000);
    const all = []; let title = '';
    for (let i = 0; i < chunks.length; i++) {
      progress(`Transcription par Claude${chunks.length > 1 ? ` (partie ${i + 1} sur ${chunks.length})` : ''}… cela peut prendre une à deux minutes.`);
      const r = await sampleFn.json(`${PROMPT}\n\n--- TEXTE DU DOCUMENT${chunks.length > 1 ? ` (partie ${i + 1}/${chunks.length})` : ''} ---\n${chunks[i]}`, { signal, modelTier: 'default' });
      if (r && Array.isArray(r.questions)) { all.push(...r.questions); title = title || r.title || ''; }
    }
    return { title, questions: all };
  }
  async function claudeImages(n, progress, signal) {
    const lim = await sampleFn.limits().catch(() => null);
    if (!lim || !lim.images) throw { code: 'images_unavailable' };
    const per = Math.max(1, Math.min(lim.images.maxCount || 5, 6));
    const all = []; let title = '';
    for (let i = 0; i < n; i += per) {
      const idx = []; for (let k = i; k < Math.min(n, i + per); k++) idx.push(k);
      const batch = { length: idx.length };
      progress(`Préparation des pages ${i + 1} à ${i + batch.length}…`);
      const blobs = [];
      for (const k of idx) blobs.push(await dataUrlToBlob(await state.renderPage(k)));
      progress(`Transcription par Claude des pages ${i + 1} à ${i + batch.length} sur ${n}…`);
      const r = await sampleFn.json(`${PROMPT}\n\nLes images jointes sont les pages ${i + 1} à ${i + batch.length} du document (dans l'ordre). Une question peut commencer sur une page précédente : transcris seulement ce qui est visible.`, { signal, images: blobs, modelTier: 'default' });
      if (r && Array.isArray(r.questions)) { all.push(...r.questions); title = title || r.title || ''; }
    }
    return { title, questions: all };
  }
  function splitChunks(text, max) {
    if (text.length <= max) return [text];
    const out = []; let cur = '';
    for (const part of text.split(/(?=\n\s*Question\s*\d)/)) {
      if ((cur + part).length > max && cur) { out.push(cur); cur = ''; }
      cur += part;
    }
    if (cur) out.push(cur);
    return out;
  }
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
  function verifyAgainst(text, qs) {
    const hay = norm(text);
    if (hay.length < 200) return qs;
    qs.forEach(q => {
      const miss = (q.items || []).filter(it => { const n = norm(it.text); return n.length > 12 && !hay.includes(n.slice(0, 40)); }).map(it => it.letter);
      if (miss.length) q.notes = ((q.notes ? q.notes + ' ' : '') + `Vérification : item(s) ${miss.join(', ')} non retrouvé(s) mot pour mot dans le document.`).trim();
    });
    return qs;
  }
  function sanitize(qs) {
    const L = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    return (qs || []).filter(q => q && (q.stem || (q.items && q.items.length))).map((q, i) => {
      const items = (q.items || []).map((it, k) => ({ letter: String(it.letter || L[k]).trim().toUpperCase().slice(0, 1), text: String(it.text || '') }));
      const corrections = {};
      Object.entries(q.corrections || {}).forEach(([k, v]) => { if (v) corrections[String(k).toUpperCase()] = { verdict: String(v.verdict || '').toUpperCase(), text: String(v.text || '') }; });
      return {
        num: q.num != null ? q.num : i + 1, type: q.type === 'QRU' ? 'QRU' : 'QRM', context: String(q.context || ''), stem: String(q.stem || ''),
        items, answer: [...new Set((q.answer || []).map(x => String(x).toUpperCase()))].filter(x => items.some(it => it.letter === x)).sort(),
        corrections, general: String(q.general || ''), figures: q.figures || [], correctionFigures: q.correctionFigures || [],
        status: q.status === 'annulée' ? 'annulée' : 'ok', notes: String(q.notes || ''),
        bdq: Array.isArray(q.bdq) && q.bdq.length === 2 ? q.bdq.map(String) : undefined
      };
    });
  }

  /* ---------- interface ---------- */
  function open() {
    U.setTitle('Importer un document');
    state = { file: null, text: '', pageCount: 0, renderPage: null, pageTexts: null, questions: [], title: '', method: '', busy: false, ue: U.currentUe(), category: 'Mes documents', year: '' };
    renderPick();
  }
  function renderPick(msg) {
    const { esc } = U;
    U.app.innerHTML = `<div class="home wrap imp">
      <div class="hero"><h2>Importer un document</h2>
        <p>Ajoutez une annale corrigée : elle devient une épreuve interactive, avec sa correction. Les questions sont reprises telles qu’elles sont écrites dans le document.</p></div>
      <label class="drop" for="impFile" id="drop">
        <span class="t">Choisir un fichier</span>
        <span class="m">PDF, Word (.docx), texte (.txt), photos de pages (JPEG, PNG) ou une sauvegarde (.json)</span>
        <input type="file" id="impFile" accept=".pdf,.docx,.txt,.json,image/*,application/pdf" multiple>
      </label>
      <div class="impstat" id="impStat" ${msg ? '' : 'hidden'}>${msg ? esc(msg) : ''}</div>
      <div class="note-src">Conseil : les documents du tutorat (« Question 1 – … », items « A. … », puis « A VRAI … ») sont lus automatiquement, sans IA. Pour les autres formats ou les photos, Claude peut faire la transcription.</div>
    </div>`;
    const inp = U.$('#impFile');
    inp.onchange = () => { if (inp.files.length) handleFiles([...inp.files]); };
    const drop = U.$('#drop');
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]); });
  }
  function status(t, kind) {
    const el = U.$('#impStat'); if (!el) return;
    el.hidden = false; el.className = 'impstat' + (kind ? ' ' + kind : ''); el.textContent = t;
  }
  async function handleFiles(files) {
    const f = files[0];
    const name = f.name || 'Document';
    try {
      if (/\.json$/i.test(name)) return await restoreJson(f);
      state.file = f;
      state.title = name.replace(/\.[^.]+$/, '').replace(/[_]+[0-9a-f]{20,}$/i, '').replace(/[_-]+/g, ' ').trim();
      if (/\.pdf$/i.test(name) || f.type === 'application/pdf') Object.assign(state, await readPdf(f, status));
      else if (/\.docx$/i.test(name)) Object.assign(state, await readDocx(f, status));
      else if (/^image\//.test(f.type)) {
        status('Préparation des photos…');
        state.text = '';
        Object.assign(state, staticPages(await Promise.all(files.filter(x => /^image\//.test(x.type)).map(async x => shrink(await readAsDataURL(x), 1800)))));
      } else state.text = await f.text();
      autoParse();
    } catch (e) {
      status((e && e.message) || 'Lecture impossible de ce fichier.', 'err');
    }
  }
  function autoParse() {
    const res = state.text ? window.AnnaleParser.parse(state.text) : { questions: [], warnings: [] };
    state.questions = res.questions;
    state.method = res.questions.length ? 'auto' : '';
    state.warnings = res.warnings || [];
    renderReview();
  }
  async function runClaude() {
    const box = U.$('#aiBox');
    if (!sampleFn) { status('La transcription par Claude n’est pas disponible ici. Ouvrez la page depuis claude.ai, connecté à votre compte.', 'err'); return; }
    const ctl = new AbortController();
    state.ctl = ctl;
    box.innerHTML = `<div class="impstat">Claude réfléchit…</div><button class="btn ghost" id="aiStop">Arrêter</button>`;
    U.$('#aiStop').onclick = () => ctl.abort();
    const prog = t => { const s = box.querySelector('.impstat'); if (s) s.textContent = t; };
    try {
      const useImages = state.text.replace(/\s/g, '').length < 400 && state.pageCount;
      const r = useImages ? await claudeImages(state.pageCount, prog, ctl.signal) : await claudeText(state.text, prog, ctl.signal);
      let qs = sanitize(r.questions);
      if (!useImages) qs = verifyAgainst(state.text, qs);
      if (!qs.length) throw { code: 'empty' };
      state.questions = qs; state.method = 'claude';
      if (r.title && (!state.title || state.title.length < 4)) state.title = r.title;
      renderReview();
    } catch (e) {
      const c = e && e.code;
      const msg = c === 'cancelled' ? 'Transcription arrêtée.' :
        c === 'not_granted' || c === 'sampling_disabled' ? 'L’accès à Claude a été refusé pour cette page.' :
        c === 'rate_limited' ? 'Trop de demandes pour le moment : réessayez dans quelques minutes.' :
        c === 'images_unavailable' ? 'L’envoi de photos à Claude n’est pas disponible ici.' :
        c === 'prompt_too_large' ? 'Document trop long : découpez-le en plusieurs fichiers.' :
        c === 'invalid_json' || c === 'empty' ? 'Claude n’a pas renvoyé de questions exploitables. Réessayez, ou importez un fichier plus court.' :
        'La transcription a échoué. Réessayez.';
      box.innerHTML = `<div class="impstat err">${U.esc(msg)}</div><button class="btn blue" id="aiGo">Réessayer avec Claude</button>`;
      U.$('#aiGo').onclick = runClaude;
    }
  }

  const CATS = ['Mes documents', 'Contrôle continu', 'Épreuve terminale', 'Rattrapage', 'Annales classées'];
  function classify(force) { state.questions.forEach(q => { if (force || !q.bdq) q.bdq = U.suggestBdq(state.ue, q) || undefined; }); }
  function bdqSelect(attr, cur, withAuto) {
    const { esc } = U; const mats = U.bdqMatieres(state.ue);
    if (!mats.length) return '';
    const v = cur ? cur.join('|') : '';
    return `<select ${attr}>${withAuto ? '<option value="">— choisir —</option>' : '<option value="">Sans matière</option>'}${mats.map(m => `<optgroup label="${esc(m.nom)}">${m.chapitres.map(c => { const k = m.nom + '|' + c; return `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(m.nom)} · ${esc(c)}</option>`; }).join('')}</optgroup>`).join('')}</select>`;
  }
  function renderReview() {
    const { esc } = U;
    const qs = state.questions;
    if (qs.length && !state.classified) { classify(false); state.classified = true; }
    const scorable = qs.filter(q => q.items.length && q.answer.length).length;
    const methodTxt = state.method === 'auto' ? 'Lecture automatique (texte repris tel quel du document).' : state.method === 'claude' ? 'Transcription par Claude : vérifiez les questions signalées.' : '';
    U.app.innerHTML = `<div class="home wrap imp">
      <div class="hero"><h2>${qs.length ? `${qs.length} question${qs.length > 1 ? 's' : ''} trouvée${qs.length > 1 ? 's' : ''}` : 'Aucune question reconnue automatiquement'}</h2>
        <p>${esc(state.file ? state.file.name : '')}${methodTxt ? ' · ' + esc(methodTxt) : ''}</p></div>
      ${qs.length ? `<div class="impform">
        <label for="impTitle">Nom de l’épreuve</label>
        <input id="impTitle" type="text" value="${esc(state.title)}" autocomplete="off">
        <div class="impgrid">
          <div><label for="impUe">UE</label><select id="impUe">${U.ues().map(u => `<option ${u === state.ue ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></div>
          <div><label for="impCat">Ranger dans</label><select id="impCat">${CATS.map(c => `<option ${c === state.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
          <div><label for="impYear">Année</label><input id="impYear" type="text" inputmode="numeric" placeholder="ex. 2024-2025" value="${esc(state.year)}" autocomplete="off"></div>
        </div>
        ${U.bdqMatieres(state.ue).length ? `<label for="impAll">Matière et chapitre (BDQCM)</label>
        <div class="searchrow">${bdqSelect('id="impAll"', null, true)}<button class="btn ghost sm" id="impAllGo">Tout ranger ici</button><button class="btn ghost sm" id="impAuto">Rangement automatique</button></div>
        <span class="note-src">Chaque question est rangée automatiquement dans le chapitre le plus proche ; vous pouvez corriger question par question ci-dessous.</span>` : ''}
        <div class="actions"><button class="btn orange" id="impSave">Enregistrer l’épreuve (${scorable} notée${scorable > 1 ? 's' : ''})</button><button class="btn ghost" id="impBack">Choisir un autre fichier</button></div>
      </div>` : `<div class="actions"><button class="btn ghost" id="impBack">Choisir un autre fichier</button></div>`}
      <div class="panel aibox" id="aiBox">
        ${state.method === 'auto' ? `<span class="note-src">Le résultat ne vous convient pas ?</span> <button class="btn ghost" id="aiGo">Faire transcrire par Claude</button>` :
          `<span class="note-src">${state.pageCount && !state.text ? 'Des photos ne peuvent pas être lues automatiquement.' : 'Le format du document n’a pas été reconnu.'} Claude peut le transcrire mot pour mot (cela utilise votre compte Claude).</span> <button class="btn blue" id="aiGo">Faire transcrire par Claude</button>`}
      </div>
      ${(state.warnings || []).length ? `<div class="impstat warn">${esc(state.warnings.join(' · '))}</div>` : ''}
      <div class="revlist">${qs.map((q, i) => reviewCard(q, i)).join('')}</div>
    </div>`;
    const go = U.$('#aiGo'); if (go) go.onclick = runClaude;
    U.$('#impBack').onclick = () => open();
    const t = U.$('#impTitle'); if (t) t.oninput = () => { state.title = t.value; };
    const iu = U.$('#impUe'); if (iu) iu.onchange = () => { state.ue = iu.value; classify(true); renderReview(); };
    const ic = U.$('#impCat'); if (ic) ic.onchange = () => { state.category = ic.value; };
    const iy = U.$('#impYear'); if (iy) iy.oninput = () => { state.year = iy.value; };
    const ia = U.$('#impAllGo'); if (ia) ia.onclick = () => { const v = U.$('#impAll').value; if (!v) return; qs.forEach(q => { q.bdq = v.split('|'); }); renderReview(); };
    const iau = U.$('#impAuto'); if (iau) iau.onclick = () => { classify(true); renderReview(); U.toast('Questions rangées automatiquement'); };
    U.app.querySelectorAll('[data-bdqsel]').forEach(sel => sel.onchange = () => { const q = qs[+sel.dataset.bdqsel]; q.bdq = sel.value ? sel.value.split('|') : undefined; });
    const sv = U.$('#impSave'); if (sv) sv.onclick = save;
    U.app.querySelectorAll('[data-ans]').forEach(b => b.onclick = () => {
      const [i, L] = b.dataset.ans.split(':'); const q = qs[+i];
      q.answer = q.answer.includes(L) ? q.answer.filter(x => x !== L) : [...q.answer, L].sort();
      if (q.type === 'QRU' && q.answer.length > 1) q.type = 'QRM';
      b.classList.toggle('on', q.answer.includes(L));
    });
    U.app.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { const q = qs[+b.dataset.type]; q.type = q.type === 'QRU' ? 'QRM' : 'QRU'; b.textContent = q.type; });
    U.app.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { qs.splice(+b.dataset.rm, 1); renderReview(); });
    U.app.querySelectorAll('[data-fig]').forEach(b => b.onclick = () => { const [i, kind] = b.dataset.fig.split(':'); figurePicker(+i, kind); });
    U.app.querySelectorAll('[data-unfig]').forEach(b => b.onclick = () => { const [i, kind, k] = b.dataset.unfig.split(':'); qs[+i][kind].splice(+k, 1); renderReview(); });
  }
  function reviewCard(q, i) {
    const { esc } = U;
    const nCor = Object.keys(q.corrections).length;
    const figs = (kind) => (q[kind] || []).map((f, k) => `<span class="thumb"><img src="${esc(f.src)}" alt=""><button data-unfig="${i}:${kind}:${k}" aria-label="Retirer la figure">×</button></span>`).join('');
    return `<article class="rev">
      <div class="revh"><b>Question ${esc(q.num)}</b><button class="chip" data-type="${i}" title="Type de question">${q.type}</button><span class="note-src">${q.items.length} items · ${nCor} corrections</span><button class="linkbtn" data-rm="${i}">Retirer</button></div>
      ${q.context ? `<div class="ctx">${esc(q.context)}</div>` : ''}
      <div class="stem">${esc(q.stem)}</div>
      <ol class="revitems">${q.items.map(it => `<li><b>${esc(it.letter)}.</b> ${esc(it.text)}</li>`).join('')}</ol>
      ${q.items.length ? `<div class="ansrow"><span>Réponses justes :</span>${q.items.map(it => `<button class="chip ${q.answer.includes(it.letter) ? 'on' : ''}" data-ans="${i}:${esc(it.letter)}">${esc(it.letter)}</button>`).join('')}</div>` : ''}
      ${q.notes ? `<div class="notes">${esc(q.notes)}</div>` : ''}
      ${U.bdqMatieres(state.ue).length ? `<div class="ansrow"><span>Rangée dans :</span>${bdqSelect(`data-bdqsel="${i}"`, q.bdq, false)}</div>` : ''}
      ${state.pageCount ? `<div class="figrow">${figs('figures')}${figs('correctionFigures')}<button class="btn ghost sm" data-fig="${i}:figures">＋ Figure de l’énoncé</button><button class="btn ghost sm" data-fig="${i}:correctionFigures">＋ Figure de la correction</button></div>` : ''}
    </article>`;
  }

  /* recadrage d'une figure depuis une page du document (doigt, stylet ou souris) */
  function figurePicker(qi, kind) {
    let pi = 0, sel = null;
    const q = state.questions[qi];
    if (state.pageTexts) {
      const probe = norm(kind === 'figures' ? q.stem : (Object.values(q.corrections)[0] || {}).text || q.stem).slice(0, 40);
      const found = probe.length > 8 ? state.pageTexts.findIndex(t => t.includes(probe)) : -1;
      if (found >= 0) pi = found;
    }
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="dialog picker" role="dialog" aria-modal="true">
      <div class="pickh"><h3>Encadrez la figure</h3><span class="note-src" id="pgLbl"></span>
        <button class="btn ghost sm" id="pgPrev">‹ Page</button><button class="btn ghost sm" id="pgNext">Page ›</button>
        <button class="btn ghost sm" id="pgZoom">Agrandir</button><button class="btn ghost sm" id="pgMode" hidden>Mode : sélection</button></div>
      <div class="pickarea" id="pickArea"><img id="pickImg" alt="Page du document"><div class="selbox" id="selBox" hidden></div></div>
      <div class="row"><span class="note-src" style="flex:1">Faites glisser pour sélectionner une zone. Sans sélection, toute la page est ajoutée.</span><button class="btn ghost" data-x>Annuler</button><button class="btn orange" data-ok>Ajouter</button></div></div>`;
    document.body.appendChild(m);
    const img = m.querySelector('#pickImg'), area = m.querySelector('#pickArea'), box = m.querySelector('#selBox');
    const lbl = m.querySelector('#pgLbl');
    const show = async () => {
      const want = pi; sel = null; box.hidden = true;
      lbl.textContent = `Page ${pi + 1} sur ${state.pageCount} · chargement…`;
      const src = await state.renderPage(pi);
      if (want !== pi) return;
      img.src = src; lbl.textContent = `Page ${pi + 1} sur ${state.pageCount}`;
    };
    m.querySelector('#pgPrev').onclick = () => { if (pi > 0) { pi--; show(); } };
    m.querySelector('#pgNext').onclick = () => { if (pi < state.pageCount - 1) { pi++; show(); } };
    let start = null, scrollMode = false;
    const zb = m.querySelector('#pgZoom'), mb = m.querySelector('#pgMode');
    zb.onclick = () => {
      const z = area.classList.toggle('zoomed');
      zb.textContent = z ? 'Réduire' : 'Agrandir'; mb.hidden = !z;
      if (!z) { scrollMode = false; area.classList.remove('scrolling'); mb.textContent = 'Mode : sélection'; }
      sel = null; box.hidden = true;
    };
    mb.onclick = () => { scrollMode = !scrollMode; area.classList.toggle('scrolling', scrollMode); mb.textContent = scrollMode ? 'Mode : défilement' : 'Mode : sélection'; };
    const pos = e => { const r = img.getBoundingClientRect(); return { x: Math.min(Math.max(e.clientX - r.left, 0), r.width), y: Math.min(Math.max(e.clientY - r.top, 0), r.height), w: r.width, h: r.height }; };
    area.addEventListener('pointerdown', e => { if (scrollMode) return; if (e.target !== img && e.target !== box) return; e.preventDefault(); area.setPointerCapture(e.pointerId); start = pos(e); sel = null; });
    area.addEventListener('pointermove', e => {
      if (!start) return; const p = pos(e);
      sel = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y), W: p.w, H: p.h };
      const off = img.offsetLeft, offT = img.offsetTop;
      Object.assign(box.style, { left: off + sel.x + 'px', top: offT + sel.y + 'px', width: sel.w + 'px', height: sel.h + 'px' }); box.hidden = false;
    });
    area.addEventListener('pointerup', () => { start = null; if (sel && (sel.w < 12 || sel.h < 12)) { sel = null; box.hidden = true; } });
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelector('[data-ok]').onclick = async () => {
      if (!img.complete || !img.naturalWidth) return;
      let src = img.src;
      if (sel) {
        const k = img.naturalWidth / sel.W;
        const c = document.createElement('canvas'); c.width = Math.round(sel.w * k); c.height = Math.round(sel.h * k);
        c.getContext('2d').drawImage(img, sel.x * k, sel.y * k, c.width, c.height, 0, 0, c.width, c.height);
        src = c.toDataURL('image/jpeg', 0.85);
      } else src = await shrink(src, 1400);
      state.questions[qi][kind].push({ src });
      m.remove(); renderReview();
    };
    show();
  }

  async function save() {
    const qs = state.questions;
    if (!qs.length) return;
    const id = 'imp-' + Date.now().toString(36);
    const exam = { id, ue: state.ue, title: (state.title || 'Document importé').trim(), category: state.category || 'Mes documents', year: (state.year || '').trim(), source: state.file ? state.file.name : '', intro: '', imported: true, method: state.method, createdAt: Date.now(), questions: qs };
    try { await putExam(exam); } catch (e) { U.toast((e && e.message) || 'Enregistrement impossible'); return; }
    await refresh();
    U.toast('Épreuve enregistrée');
    U.home();
  }
  async function remove(id) { await delExam(id); await refresh(); U.home(); }

  async function exportAll() {
    const data = JSON.stringify({ format: 'ue4-imports', version: 1, exams: U.getImports() });
    const name = `mes-annales-ue4-${new Date().toISOString().slice(0, 10)}.json`;
    if (downloads) {
      try { await downloads.save({ filename: name, data }); return; } catch (e) { if (e && e.code === 'cancelled') return; }
    }
    try {
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { U.toast('Sauvegarde indisponible ici'); }
  }
  function progressData() {
    const st = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('ue4:') && k !== 'ue4:imports') st[k] = localStorage.getItem(k); } } catch (e) {}
    return { format: 'pass-progression', version: 1, date: new Date().toISOString(), store: st, exams: U.getImports() };
  }
  async function saveFile(name, data) {
    if (downloads) { try { await downloads.save({ filename: name, data }); return; } catch (e) { if (e && e.code === 'cancelled') return; } }
    try { const url = URL.createObjectURL(new Blob([data], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
    catch (e) { U.toast('Sauvegarde indisponible ici'); }
  }
  async function exportProgress() { await saveFile(`ma-progression-pass-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(progressData())); }
  // fusion : pour les résultats par question, on garde le plus récent ; pour le reste, la sauvegarde ne remplace que ce qui manque
  async function applyProgress(obj, overwrite) {
    const st = obj.store || {};
    for (const [k, v] of Object.entries(st)) {
      try {
        if (k === 'ue4:qres' || k === 'ue4:fc') {
          const cur = JSON.parse(localStorage.getItem(k) || '{}'), inc = JSON.parse(v || '{}');
          for (const [q, r] of Object.entries(inc)) if (!cur[q] || (r.t || r.due || 0) > (cur[q].t || cur[q].due || 0)) cur[q] = r;
          localStorage.setItem(k, JSON.stringify(cur));
        } else if (overwrite || localStorage.getItem(k) == null) localStorage.setItem(k, v);
      } catch (e) {}
    }
    let n = 0; for (const e of (obj.exams || [])) { if (e && Array.isArray(e.questions)) { await putExam(Object.assign({}, e, { questions: sanitize(e.questions) })); n++; } }
    await refresh(); return n;
  }
  async function restoreJson(f) {
    let obj;
    try { obj = JSON.parse(await f.text()); } catch (e) { status('Fichier .json illisible.', 'err'); return; }
    if (obj && obj.format === 'pass-progression') { await applyProgress(obj, true); U.toast('Progression restaurée'); location.reload(); return; }
    const exams = Array.isArray(obj) ? obj : obj.exams ? obj.exams : obj.questions ? [obj] : [];
    let n = 0;
    for (const e of exams) {
      if (!e || !Array.isArray(e.questions)) continue;
      const ex = Object.assign({}, e, { id: e.id && String(e.id).startsWith('imp-') ? e.id : 'imp-' + Date.now().toString(36) + n, category: e.category || 'Mes documents', imported: true, createdAt: e.createdAt || Date.now(), questions: sanitize(e.questions) });
      await putExam(ex); n++;
    }
    await refresh();
    if (n) { U.toast(`${n} épreuve${n > 1 ? 's' : ''} restaurée${n > 1 ? 's' : ''}`); U.home(); }
    else status('Aucune épreuve trouvée dans ce fichier.', 'err');
  }

  async function init() {
    U = window.UE4;
    await refresh();
    if (!U.getImports().length) {} else U.home();
    try {
      if (window.claude && window.claude.use) {
        window.claude.use('sample').then(s => { sampleFn = s; }).catch(() => {});
        window.claude.use('downloads').then(d => { downloads = d; }).catch(() => {});
      }
    } catch (e) {}
  }
  window.UE4Import = { exportProgress, applyProgress, progressData, init, open, remove, exportAll };
})();
