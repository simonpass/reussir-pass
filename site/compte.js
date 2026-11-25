/* Comptes (Supabase) : inscription prénom / nom / e-mail / mot de passe, connexion, progression synchronisée
   entre appareils, demandes personnalisées privées. Sans configuration (config.js vide), rien ne change. */
(function () {
  'use strict';
  const CFG = window.SUPA || {};
  const ON = !!(CFG.url && CFG.anon);
  const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.0/dist/umd/supabase.min.js';
  let sb = null, user = null, profile = null, ready = null, pushT = null, syncing = false;
  const U = () => window.UE4, I = () => window.UE4Import;

  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIB; s.onload = res; s.onerror = () => rej(new Error('Connexion impossible (internet ?)')); document.head.appendChild(s); });
  }
  function init() {
    if (!ON) return Promise.resolve(null);
    if (ready) return ready;
    ready = loadLib().then(async () => {
      sb = window.supabase.createClient(CFG.url, CFG.anon, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pass-compte' } });
      const { data } = await sb.auth.getSession();
      await setUser(data.session ? data.session.user : null, false);
      sb.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_OUT') setUser(null); else if (ev === 'PASSWORD_RECOVERY') { recovery = true; open(); } });
      return user;
    }).catch(e => { console.warn(e); return null; });
    return ready;
  }
  let recovery = false;
  async function setUser(u, announce = true) {
    user = u; profile = null;
    if (u) {
      const { data } = await sb.from('profiles').select('prenom, nom, email').eq('id', u.id).maybeSingle();
      profile = data || { prenom: (u.user_metadata || {}).prenom || '', nom: (u.user_metadata || {}).nom || '', email: u.email };
      await pull();
    }
    document.dispatchEvent(new CustomEvent('compte', { detail: { user, profile } }));
    if (announce && u) U().toast(`Connecté : ${profile.prenom || u.email}`);
  }

  /* ---------- progression ---------- */
  const hasLocal = () => { try { return !!(localStorage.getItem('ue4:qres') || localStorage.getItem('ue4:hist') || localStorage.getItem('ue4:plan')); } catch (e) { return false; } };
  async function pull() {
    if (!user || syncing) return; syncing = true;
    try {
      const { data, error } = await sb.from('progress').select('data, updated_at').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (data && data.data && data.data.store) {
        const fresh = !hasLocal();
        await I().applyProgress(data.data, fresh);     // appareil neuf : on reprend tout ; sinon fusion (le plus récent gagne par question)
        if (window.UE4 && !document.querySelector('.q, .fcwrap, .hcoupe')) U().home();
      }
      await push(true);
    } catch (e) { console.warn('sync', e); }
    syncing = false;
  }
  async function push(now) {
    if (!user) return;
    clearTimeout(pushT);
    if (!now) { pushT = setTimeout(() => push(true), 4000); return; }
    try { await sb.from('progress').upsert({ user_id: user.id, data: I().progressData(), updated_at: new Date().toISOString() }); }
    catch (e) { console.warn('push', e); }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && user) push(true); });

  /* ---------- demandes ---------- */
  async function sendDemande(o) {
    await init(); if (!user) throw new Error('Connectez-vous pour envoyer une demande.');
    let image_path = null;
    if (o.image) {
      image_path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from('demandes').upload(image_path, o.image, { contentType: 'image/jpeg' });
      if (error) throw new Error('Envoi de la photo impossible.');
    }
    const { data, error } = await sb.from('demandes').insert({ type: o.type, ue: o.ue || null, titre: o.titre, fichier: o.fichier, consigne: o.consigne, texte: o.texte || null, image_path }).select('id, created_at').single();
    if (error) throw new Error('Envoi impossible : ' + error.message);
    return data;
  }
  async function listDemandes() {
    await init(); if (!user) return [];
    const { data, error } = await sb.from('demandes').select('id, type, ue, titre, fichier, consigne, status, result, created_at, ready_at').order('created_at');
    if (error) throw error; return data || [];
  }
  async function deleteDemande(id) { await init(); if (user) await sb.from('demandes').delete().eq('id', id); }

  /* ---------- écran « Mon compte » ---------- */
  function open() {
    const { app, esc, $ } = U();
    U().setTitle(user ? 'Mon compte' : 'Compte');
    const field = (n, l, t = 'text', extra = '') => `<label>${l}<input name="${n}" type="${t}" ${extra}></label>`;
    if (!ON) { app.innerHTML = `<div class="home wrap"><div class="hero"><h2>Comptes</h2><p>Les comptes ne sont pas encore activés.</p></div></div>`; return; }
    if (recovery && user) {
      app.innerHTML = `<div class="home wrap acc"><div class="hero"><h2>Nouveau mot de passe</h2></div>
        <form class="plan-form" id="accNew">${field('pw', 'Nouveau mot de passe (8 caractères minimum)', 'password', 'minlength="8" required autocomplete="new-password"')}
        <div class="hgrade"><button class="btn orange" type="submit">Enregistrer</button><span class="note-src" id="accMsg"></span></div></form></div>`;
      $('#accNew').onsubmit = async e => { e.preventDefault(); const { error } = await sb.auth.updateUser({ password: e.target.pw.value }); if (error) $('#accMsg').textContent = msg(error); else { recovery = false; U().toast('Mot de passe modifié.'); open(); } };
      return;
    }
    if (user) {
      app.innerHTML = `<div class="home wrap acc">
        <div class="hero"><span class="eyebrow">Mon compte</span><h2>${esc(profile.prenom)} <em>${esc(profile.nom)}</em></h2><p>${esc(profile.email || user.email)}</p></div>
        <section class="group"><h3>Progression</h3><p class="note-src">Vos résultats, flashcards, planning, coupes et demandes sont enregistrés dans votre compte : connectez-vous sur un autre appareil pour les retrouver.</p>
          <div class="hgrade"><button class="btn blue" id="accSync">Synchroniser maintenant</button></div></section>
        <section class="group"><h3>Mes informations</h3>
          <form class="plan-form" id="accEdit"><div class="row">${field('prenom', 'Prénom', 'text', `value="${esc(profile.prenom)}" required maxlength="40" autocomplete="given-name"`)}${field('nom', 'Nom', 'text', `value="${esc(profile.nom)}" required maxlength="60" autocomplete="family-name"`)}</div>
          <div class="hgrade"><button class="btn" type="submit">Enregistrer</button><span class="note-src" id="accMsg"></span></div></form></section>
        <div class="hgrade"><button class="btn" id="accOut">Se déconnecter</button></div>
      </div>`;
      $('#accSync').onclick = async () => { await pull(); U().toast('Progression synchronisée.'); };
      $('#accEdit').onsubmit = async e => { e.preventDefault(); const f = e.target, p = { prenom: f.prenom.value.trim(), nom: f.nom.value.trim() }; const { error } = await sb.from('profiles').update(p).eq('id', user.id); if (error) $('#accMsg').textContent = msg(error); else { Object.assign(profile, p); U().toast('Enregistré.'); open(); } };
      $('#accOut').onclick = async () => { await push(true); await sb.auth.signOut(); user = null; U().toast('Déconnecté. Votre progression reste aussi sur cet appareil.'); open(); };
      return;
    }
    const mode = open.mode || 'login';
    app.innerHTML = `<div class="home wrap acc">
      <div class="hero"><span class="eyebrow">Compte</span><h2>${mode === 'signup' ? 'Créer un <em>compte</em>' : mode === 'reset' ? 'Mot de passe <em>oublié</em>' : 'Se <em>connecter</em>'}</h2>
        <p>${mode === 'signup' ? 'Un compte garde votre progression en sécurité et la retrouve sur tous vos appareils. Il permet aussi d’envoyer des demandes personnalisées.' : mode === 'reset' ? 'Indiquez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.' : 'Retrouvez votre progression sur tous vos appareils.'}</p></div>
      <form class="plan-form" id="accForm">
        ${mode === 'signup' ? `<div class="row">${field('prenom', 'Prénom', 'text', 'required maxlength="40" autocomplete="given-name"')}${field('nom', 'Nom', 'text', 'required maxlength="60" autocomplete="family-name"')}</div>` : ''}
        ${field('email', 'Adresse e-mail', 'email', 'required autocomplete="email"')}
        ${mode !== 'reset' ? field('pw', mode === 'signup' ? 'Mot de passe (8 caractères minimum)' : 'Mot de passe', 'password', `required ${mode === 'signup' ? 'minlength="8" autocomplete="new-password"' : 'autocomplete="current-password"'}`) : ''}
        <div class="hgrade"><button class="btn orange" type="submit">${mode === 'signup' ? 'Créer mon compte' : mode === 'reset' ? 'Envoyer le lien' : 'Se connecter'}</button><span class="note-src" id="accMsg"></span></div>
      </form>
      <div class="acc-alt">${mode !== 'login' ? '<button class="linkbtn" data-m="login">J’ai déjà un compte : me connecter</button>' : '<button class="linkbtn" data-m="signup">Pas encore de compte ? En créer un</button><button class="linkbtn" data-m="reset">Mot de passe oublié</button>'}</div>
    </div>`;
    app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { open.mode = b.dataset.m; open(); });
    $('#accForm').onsubmit = async e => {
      e.preventDefault(); const f = e.target, say = t => { $('#accMsg').textContent = t; }, btn = f.querySelector('[type=submit]');
      btn.disabled = true; say('…');
      try {
        await init();
        const email = f.email.value.trim();
        if (mode === 'signup') {
          const { data, error } = await sb.auth.signUp({ email, password: f.pw.value, options: { data: { prenom: f.prenom.value.trim(), nom: f.nom.value.trim() }, emailRedirectTo: location.origin + '/' } });
          if (error) throw error;
          if (data.session) { await setUser(data.session.user); open.mode = 'login'; U().home(); }
          else { say(''); U().toast('Compte créé : confirmez votre adresse avec le lien reçu par e-mail, puis connectez-vous.'); open.mode = 'login'; open(); }
        } else if (mode === 'reset') {
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
          if (error) throw error; say('Lien envoyé (pensez à regarder les indésirables).');
        } else {
          const { data, error } = await sb.auth.signInWithPassword({ email, password: f.pw.value });
          if (error) throw error; await setUser(data.user); U().home();
        }
      } catch (err) { say(msg(err)); }
      btn.disabled = false;
    };
  }
  function msg(e) {
    const m = (e && e.message) || String(e);
    if (/Invalid login/i.test(m)) return 'Adresse e-mail ou mot de passe incorrect.';
    if (/Email not confirmed/i.test(m)) return 'Adresse pas encore confirmée : cliquez sur le lien reçu par e-mail.';
    if (/already registered/i.test(m)) return 'Un compte existe déjà avec cette adresse : connectez-vous.';
    if (/Password should be/i.test(m)) return 'Mot de passe trop court (8 caractères minimum).';
    if (/rate limit/i.test(m)) return 'Trop de tentatives : réessayez dans quelques minutes.';
    return m;
  }

  /* ---------- corrections de réponses : propositions (perso) → tickets → décisions (pour tous) ---------- */
  async function pushFix(qkey, answer, original) { await init(); if (!user) return; try { await sb.from('corrections').upsert({ user_id: user.id, qkey, answer, original, created_at: new Date().toISOString() }); } catch (e) { console.warn(e); } }
  async function delFix(qkey) { await init(); if (!user) return; try { await sb.from('corrections').delete().eq('user_id', user.id).eq('qkey', qkey); } catch (e) {} }
  async function loadDecisions() { await init(); if (!sb) return null; const { data, error } = await sb.from('corrections_validees').select('qkey, statut, answer, original'); return error ? null : data; }
  let admin = null;
  async function isAdmin() { await init(); if (!user) return false; if (admin !== null) return admin; const { data } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle(); return (admin = !!data); }
  async function allFixes() { await init(); const { data, error } = await sb.from('corrections').select('user_id, qkey, answer, original, created_at'); if (error) throw error; return data || []; }
  async function decide(qkey, statut, answer, original) { await init(); const { error } = await sb.from('corrections_validees').upsert({ qkey, statut, answer, original, decided_at: new Date().toISOString() }); if (error) throw error; }
  async function undecide(qkey) { await init(); const { error } = await sb.from('corrections_validees').delete().eq('qkey', qkey); if (error) throw error; }
  document.addEventListener('compte', () => { admin = null; });

  window.Compte = {
    on: ON, init, open, signup() { open.mode = 'signup'; open(); }, login() { open.mode = 'login'; open(); }, push, pull, sendDemande, listDemandes, deleteDemande, pushFix, delFix, loadDecisions, isAdmin, allFixes, decide, undecide,
    get user() { return user; }, get profile() { return profile; },
    label() { return user ? (profile && profile.prenom ? profile.prenom + ' ' + (profile.nom || '') : user.email) : 'Se connecter'; }
  };
  // démarrage : index.html appelle Compte.init() une fois les imports chargés
})();
