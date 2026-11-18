#!/usr/bin/env node
/* Demandes personnalisées (rubrique « Mes demandes » du site), rangées dans Supabase (table public.demandes).
   Clé de service dans tools/.supabase.json (jamais versionnée) : { "url": "https://xxx.supabase.co", "service": "…" }
   Utilisation (depuis la racine du dépôt) :
     node tools/demandes.js list                     télécharge les demandes en attente dans .demandes/<id>/
     node tools/demandes.js publish <id> <fichier>   enregistre le résultat (JSON) : visible seulement par l'auteur de la demande
     node tools/demandes.js done <id>                efface le texte et la photo envoyés (le résultat reste dans le compte)
   Formats de résultat : voir REPRISE.md, « Traiter les demandes ». */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, '.demandes');

function cfg() {
  const f = path.join(__dirname, '.supabase.json');
  let c; try { c = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error('Fichier ' + f + ' manquant ou illisible.'); }
  if (!c.url || !c.service || /COLLER/.test(c.service)) throw new Error('Clé de service absente dans ' + f + '.');
  return c;
}
async function rest(p, opt = {}) {
  const c = cfg();
  const r = await fetch(c.url + p, Object.assign({}, opt, { headers: Object.assign({ apikey: c.service, Authorization: 'Bearer ' + c.service, 'Content-Type': 'application/json' }, opt.headers || {}) }));
  if (!r.ok) throw new Error(`Supabase ${r.status} sur ${p} : ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}

async function list() {
  const rows = await rest(`/rest/v1/demandes?status=eq.envoy%C3%A9e&select=*,profiles(prenom,nom,email)&order=created_at`);
  fs.mkdirSync(DIR, { recursive: true });
  for (const d of rows) {
    const dir = path.join(DIR, d.id); fs.mkdirSync(dir, { recursive: true });
    const meta = { id: d.id, recue: d.created_at, type: d.type, ue: d.ue, titre: d.titre, fichier: d.fichier, consigne: d.consigne, auteur: d.profiles ? `${d.profiles.prenom} ${d.profiles.nom}` : '' };
    fs.writeFileSync(path.join(dir, 'demande.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(dir, 'texte.txt'), d.texte || '');
    if (d.image_path) {
      const c = cfg(); const r = await fetch(`${c.url}/storage/v1/object/demandes/${d.image_path}`, { headers: { apikey: c.service, Authorization: 'Bearer ' + c.service } });
      if (r.ok) fs.writeFileSync(path.join(dir, 'image.jpg'), Buffer.from(await r.arrayBuffer()));
    }
    console.log(`${d.id}  ${d.type}  ${d.ue || '-'}  ${d.fichier || ''}  (${(d.texte || '').length} car.${d.image_path ? ', photo' : ''})\n    « ${d.consigne} »`);
  }
  console.log(rows.length ? `\n${rows.length} demande(s) dans ${DIR}` : 'Aucune demande en attente.');
}
async function publish(id, file) {
  if (!id || !file) throw new Error('Usage : node tools/demandes.js publish <id> <fichier.json>');
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!result.cards && !result.exam && !result.fiche && !result.message) throw new Error('Résultat vide (cards, exam, fiche ou message attendu).');
  const r = await rest(`/rest/v1/demandes?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ result, status: 'prête', ready_at: new Date().toISOString() }) });
  if (!r || !r.length) throw new Error('Demande introuvable : ' + id);
  console.log(`Résultat publié pour ${id} : la personne le recevra à sa prochaine ouverture du site.`);
}
async function done(id) {
  if (!id) throw new Error('Usage : node tools/demandes.js done <id>');
  const [d] = await rest(`/rest/v1/demandes?id=eq.${encodeURIComponent(id)}&select=status,image_path`);
  if (!d) throw new Error('Demande introuvable : ' + id);
  if (d.status !== 'prête') throw new Error('Publiez d’abord le résultat (publish).');
  if (d.image_path) { const c = cfg(); await fetch(`${c.url}/storage/v1/object/demandes/${d.image_path}`, { method: 'DELETE', headers: { apikey: c.service, Authorization: 'Bearer ' + c.service } }); }
  await rest(`/rest/v1/demandes?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ texte: null, image_path: null }) });
  fs.rmSync(path.join(DIR, id), { recursive: true, force: true });
  console.log(`Demande ${id} close : texte et photo effacés, résultat conservé dans le compte de la personne.`);
}
const [cmd, a, b] = process.argv.slice(2);
({ list, publish, done }[cmd] || (() => Promise.reject(new Error('Commandes : list | publish <id> <fichier> | done <id>'))))(a, b).catch(e => { console.error(e.message || e); process.exit(1); });
