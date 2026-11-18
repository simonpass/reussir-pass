#!/usr/bin/env node
/* Demandes personnalisées envoyées depuis le site (rubrique « Mes demandes »).
   Les demandes arrivent dans le formulaire Netlify « demande » du site medecine-facile (id 217e40f1-…).
   Utilisation (depuis la racine du dépôt) :
     node tools/demandes.js list          télécharge les demandes en attente dans .demandes/<id>/ (non versionné)
     node tools/demandes.js done <id>     supprime la demande sur Netlify et le dossier local, une fois le résultat publié
   Le résultat se publie dans site/demandes/<id>.json (voir REPRISE.md, « Traiter les demandes »). */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const SITE = '217e40f1-6bde-4f65-8ad8-1c67db02ba9f';
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, '.demandes');

function token() {
  if (process.env.NETLIFY_AUTH_TOKEN) return process.env.NETLIFY_AUTH_TOKEN;
  const base = process.env.APPDATA || path.join(os.homedir(), '.config');
  for (const f of [path.join(base, 'netlify', 'Config', 'config.json'), path.join(os.homedir(), '.netlify', 'config.json')]) {
    try { const c = JSON.parse(fs.readFileSync(f, 'utf8')); const u = c.users && c.users[c.userId]; if (u && u.auth && u.auth.token) return u.auth.token; } catch (e) {}
  }
  throw new Error('Jeton Netlify introuvable : lancez « npx netlify-cli login ».');
}
async function api(p, opt = {}) {
  const r = await fetch('https://api.netlify.com/api/v1' + p, Object.assign({}, opt, { headers: { Authorization: 'Bearer ' + token() } }));
  if (!r.ok) throw new Error(`Netlify ${r.status} sur ${p}`);
  return r.status === 204 ? null : r.json();
}
async function formId() {
  const forms = await api(`/sites/${SITE}/forms`);
  const f = forms.find(x => x.name === 'demande'); if (!f) throw new Error('Formulaire « demande » introuvable.');
  return f.id;
}
async function submissions() { return api(`/forms/${await formId()}/submissions?per_page=100`); }

async function list() {
  const subs = await submissions();
  const published = new Set(fs.existsSync(path.join(ROOT, 'site', 'demandes')) ? fs.readdirSync(path.join(ROOT, 'site', 'demandes')).map(f => f.replace(/\.json$/, '')) : []);
  fs.mkdirSync(DIR, { recursive: true });
  let n = 0;
  for (const s of subs) {
    const d = s.data || {}; if (!d.id || d.piege) continue;
    const dir = path.join(DIR, d.id); fs.mkdirSync(dir, { recursive: true });
    const meta = { id: d.id, submission: s.id, recue: s.created_at, type: d.type, ue: d.ue, titre: d.titre, nom: d.nom, fichier: d.fichier, consigne: d.consigne, publiee: published.has(d.id) };
    fs.writeFileSync(path.join(dir, 'demande.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(dir, 'texte.txt'), d.texte || '');
    const img = d.image && (d.image.url || d.image);
    if (img && typeof img === 'string' && img.startsWith('http')) {
      const r = await fetch(img); if (r.ok) fs.writeFileSync(path.join(dir, 'image.jpg'), Buffer.from(await r.arrayBuffer()));
    }
    n++;
    console.log(`${meta.publiee ? '[déjà publiée] ' : ''}${d.id}  ${d.type}  ${d.ue || '-'}  ${d.fichier || ''}  (${(d.texte || '').length} car.${img ? ', photo' : ''})\n    « ${d.consigne} »`);
  }
  console.log(n ? `\n${n} demande(s) dans ${DIR}` : 'Aucune demande en attente.');
}
async function done(id) {
  if (!id) throw new Error('Usage : node tools/demandes.js done <id>');
  if (!fs.existsSync(path.join(ROOT, 'site', 'demandes', id + '.json'))) throw new Error('Le résultat site/demandes/' + id + '.json n’existe pas encore.');
  const s = (await submissions()).filter(x => x.data && x.data.id === id);
  for (const x of s) await api(`/submissions/${x.id}`, { method: 'DELETE' });
  fs.rmSync(path.join(DIR, id), { recursive: true, force: true });
  console.log(`Demande ${id} close (${s.length} envoi(s) supprimé(s) sur Netlify).`);
}
const [cmd, arg] = process.argv.slice(2);
(cmd === 'list' ? list() : cmd === 'done' ? done(arg) : Promise.reject(new Error('Commandes : list | done <id>'))).catch(e => { console.error(e.message || e); process.exit(1); });
