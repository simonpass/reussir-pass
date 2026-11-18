/* Modèles 3D interactifs : les 4 premières semaines du développement embryonnaire (UE5 – Pr Labrune).
   Code couleur du cours : ectoblaste bleu, mésoblaste rouge, entoblaste jaune/orangé.
   three.js r128 chargé à la demande. */
(function () {
  'use strict';
  const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'];
  let loading = null;
  function load() {
    if (window.THREE && THREE.OrbitControls) return Promise.resolve();
    if (loading) return loading;
    loading = LIBS.reduce((p, src) => p.then(() => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Chargement impossible : ' + src)); document.head.appendChild(s); })), Promise.resolve());
    return loading;
  }
  const C = { ecto: 0x3d7bd9, meso: 0xd9453d, ento: 0xe8b33a, troph: 0xd8c3a5, sct: 0xa86fa8, ct: 0xe6d3b3, zp: 0xe9e2c9, endo: 0xf2b8b8, blood: 0xb3122e, cav: 0x9fd3f0, neur: 0x1f4fa8, chorde: 0x7a4bd1, vit: 0xf0c75a };

  /* ---------------- contenu des 4 semaines ---------------- */
  const WEEKS = [
    {
      key: 's1', title: '1re semaine', sub: 'J0 → J6 : segmentation, blastocyste, éclosion',
      stages: [['J0', 'Zygote'], ['J1', '2 blastomères'], ['J2', '4 blastomères'], ['J3', '8 blastomères'], ['J4', 'Morula compactée'], ['J5', 'Blastocyste'], ['J6', 'Éclosion']],
      note: 'Migration : ampoule tubaire les 3 premiers jours, cavité utérine au début du 4e jour. Diamètre de l’œuf constant (150 µm) jusqu’au blastocyste ; expansion à 200-220 µm puis éclosion.',
      build: buildWeek1
    },
    {
      key: 's2', title: '2e semaine', sub: 'J7 → J13 : nidation, disque didermique, premières annexes',
      stages: [['J7', 'Apposition, adhésion'], ['J8', 'SCT et CT'], ['J9', 'Lacunes, lécithocèle I'], ['J11', 'Lacunes de sang, lécithocèle II'], ['J13', 'Cœlome externe, pédicule']],
      note: 'Pendant la 2e semaine il n’existe que l’ectoblaste (épiblaste) et l’endoblaste (hypoblaste) : le mésoblaste intra-embryonnaire n’apparaît qu’à la 3e semaine.',
      build: buildWeek2
    },
    {
      key: 's3', title: '3e semaine', sub: 'J14 → J21 : gastrulation, chorde, plaque neurale, somites',
      stages: [['J15', 'Ligne primitive, nœud de Hensen'], ['J16', 'Ingression, canal chordal, allantoïde'], ['J17', 'Plaque chordale, canal neurentérique'], ['J18', 'Chorde, condensation du mésoblaste, plaque neurale'], ['J19', 'Gouttière neurale, 1re paire de somites'], ['J20', 'Clivage de la lame latérale, cœlome interne'], ['J21', 'Bourrelets neuraux, 7 paires de somites']],
      note: 'Disque vu de dessus, amnios retiré, extrémité céphalique en haut. « Écarter les feuillets » sépare ectoblaste, mésoblaste et entoblaste.',
      build: buildWeek3
    },
    {
      key: 's4', title: '4e semaine', sub: 'J22 → J28 : délimitation, plicatures, tube neural',
      stages: [['J22', 'Fermeture du tube neural, 1er arc, plicatures'], ['J24', 'Neuropore céphalique fermé, 20 paires'], ['J26', 'Neuropore caudal fermé, 3e arc'], ['J28', '4e arc, 25-30 paires, mésonéphros']],
      note: 'Plicatures céphalique, caudale et latérales : le disque plat devient un cylindre ; l’entoblaste forme l’intestin primitif.',
      build: buildWeek4
    }
  ];

  /* ---------------- outils ---------------- */
  function mat(color, o) {
    o = o || {};
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .55, metalness: .05, transparent: o.opacity != null && o.opacity < 1, opacity: o.opacity != null ? o.opacity : 1, side: o.side || THREE.FrontSide, depthWrite: o.opacity == null || o.opacity >= .6 }, o.extra || {}));
  }
  function sphere(r, color, o, seg) { return new THREE.Mesh(new THREE.SphereGeometry(r, seg || 32, Math.round((seg || 32) * .75)), mat(color, o)); }
  function fib(n, r) { const pts = [], g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1 || 1)) * 2, rr = Math.sqrt(1 - y * y), t = g * i; pts.push(new THREE.Vector3(Math.cos(t) * rr * r, y * r, Math.sin(t) * rr * r)); } return pts; }
  function noisySphere(r, amp, color, o, seed) {
    const geo = new THREE.SphereGeometry(r, 48, 36); const p = geo.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 - seed) * Math.sin(v.z * 3.7 + seed * .5); v.multiplyScalar(1 + amp * n); p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals(); return new THREE.Mesh(geo, mat(color, o));
  }
  // une « partie » sélectionnable : nom, texte du cours, objets 3D, visibilité selon l'étape
  function part(reg, id, name, desc, objs, show) { const g = new THREE.Group(); (Array.isArray(objs) ? objs : [objs]).forEach(o => g.add(o)); g.userData = { id, name, desc, show: show || (() => true) }; g.traverse(o => { if (o.isMesh) o.userData.part = id; }); reg.push(g); return g; }

  /* ---------------- semaine 1 ---------------- */
  function buildWeek1(scene, reg) {
    const zp = sphere(1.3, C.zp, { opacity: .2, side: THREE.DoubleSide });
    const zpTop = new THREE.Mesh(new THREE.SphereGeometry(1.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.zp, { opacity: .25, side: THREE.DoubleSide }));
    const zpBot = new THREE.Mesh(new THREE.SphereGeometry(1.3, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(C.zp, { opacity: .25, side: THREE.DoubleSide }));
    const zpWhole = part(reg, 'zp', 'Zone pellucide', 'Enveloppe de l’œuf pendant la segmentation ; le diamètre de l’œuf reste constant (150 µm). Elle est lysée lors de l’éclosion (protéases du trophoblaste).', zp, s => s < 6);
    const zpOpen = part(reg, 'zp2', 'Zone pellucide (lysée)', 'Éclosion du blastocyste : lyse de la zone pellucide par des protéases sécrétées par le trophoblaste ; elle empêchait l’implantation.', [zpTop, zpBot], s => s === 6);
    zpTop.position.set(.9, 1.1, 0); zpTop.rotation.z = -.6; zpBot.position.set(-.9, -1.1, 0); zpBot.rotation.z = -.6;
    scene.add(zpWhole, zpOpen);
    // zygote + pronoyaux
    const zyg = sphere(1.0, 0xf3dfc8, { opacity: .55 });
    const pn1 = sphere(.22, 0x8a5a9e), pn2 = sphere(.2, 0x5a7ab8); pn1.position.set(-.25, .05, 0); pn2.position.set(.25, -.05, 0);
    scene.add(part(reg, 'zyg', 'Zygote (œuf fécondé)', 'J0 : fécondation. La segmentation commence : totale, asymétrique et asynchrone.', [zyg, pn1, pn2], s => s === 0));
    const layouts = { 1: [[-.55, 0, 0], [.55, 0, 0]], 2: [[.45, .45, .45], [-.45, -.45, .45], [-.45, .45, -.45], [.45, -.45, -.45]], 3: [] };
    for (let i = 0; i < 8; i++) layouts[3].push([(i & 1 ? 1 : -1) * .4, (i & 2 ? 1 : -1) * .4, (i & 4 ? 1 : -1) * .4]);
    const descB = { 1: 'J1 : 2 blastomères (30-36 heures après la fécondation).', 2: 'J2 : 4 blastomères.', 3: 'J3 : 8 blastomères. Activation du génome embryonnaire au stade 6-8 blastomères (transition materno-embryonnaire).' };
    [1, 2, 3].forEach(st => { const r = st === 1 ? .55 : st === 2 ? .5 : .42; const ms = layouts[st].map(p => { const m = sphere(r, 0xf0d2b6, {}, 24); m.position.set(...p); return m; }); scene.add(part(reg, 'b' + st, 'Blastomères', descB[st], ms, s => s === st)); });
    // morula compactée (16)
    const mor = fib(16, .62).map(p => { const m = sphere(.36, 0xedc7a6, {}, 20); m.position.copy(p); m.scale.set(1.05, .92, 1.05); return m; });
    scene.add(part(reg, 'mor', 'Morula compactée', 'J4 : 16 blastomères, MORULA. Compaction (16-32 blastomères) : polarité des cellules externes, E-cadhérines, jonctions serrées entre cellules externes, jonctions gap entre cellules externes et internes. Premier stade de lignage cellulaire.', mor, s => s === 4));
    // blastocyste
    const bl = new THREE.Group();
    const tro = fib(70, 1.05).map(p => { const m = sphere(.17, C.troph, {}, 14); m.position.copy(p); m.scale.set(1.3, 1.3, .5); m.lookAt(0, 0, 0); return m; });
    const trophP = part(reg, 'troph', 'Trophoblaste (trophectoderme)', 'J5-6 : environ 2/3 des cellules (gènes CDX2, TEAD4). Il donnera le cytotrophoblaste et le syncytiotrophoblaste.', tro, s => s >= 5);
    const mci = []; for (let i = 0; i < 14; i++) { const m = sphere(.2, C.ecto, {}, 16); m.position.set((Math.random() - .5) * .6, .62 + Math.random() * .25, (Math.random() - .5) * .6); mci.push(m); }
    const mciP = part(reg, 'mci', 'Bouton embryonnaire (MCI)', 'Masse cellulaire interne : environ 1/3 des cellules (gènes OCT4, NANOG, SOX2), au pôle embryonnaire. Elle donnera l’embryon.', mci, s => s >= 5);
    const bc = sphere(.92, C.cav, { opacity: .25 });
    const bcP = part(reg, 'blc', 'Blastocèle', 'Cavitation : cavité remplie de liquide. Pompe Na/K ATPase (latéro-basale), échangeurs Na+/H+ (membrane apicale), aquaporines.', bc, s => s >= 5);
    bl.add(trophP, mciP, bcP); bl.userData.show = s => s >= 5; bl.userData.grow = true; scene.add(bl);
    return { tick(s, t) { bl.visible = s >= 5; const k = (s === 6 ? 1.18 : 1) * (1 + .012 * Math.sin(t * 2)); bl.scale.lerp(new THREE.Vector3(k, k, k), .12); const d = .25 - .07 * (.5 + .5 * Math.sin(t * 1.3)); pn1.position.x = -d; pn2.position.x = d; zyg.scale.setScalar(1 + .015 * Math.sin(t * 2)); } };
  }

  /* ---------------- semaine 2 ---------------- */
  function buildWeek2(scene, reg) {
    // endomètre (muqueuse utérine) : surface en y = 0, l'œuf s'enfonce vers le bas
    const endo = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 6), mat(C.endo, { opacity: .38, side: THREE.DoubleSide })); endo.position.y = -1.6;
    const glands = []; for (let i = 0; i < 7; i++) { const g = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 2.4, 10), mat(0xe39a9a, { opacity: .7 })); g.position.set(-3.8 + i * 1.25 + (i % 2) * .2, -1.3, (i % 3 - 1) * 1.6); g.rotation.z = (i % 2 ? .25 : -.2); glands.push(g); }
    const vess = []; for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(.9 + i * .3, .05, 8, 40, Math.PI * 1.4), mat(C.blood)); t.position.set(-2.5 + i * 2.4, -2.3, 1.2 - i); t.rotation.x = Math.PI / 2; vess.push(t); }
    scene.add(part(reg, 'endo', 'Endomètre (muqueuse utérine)', 'Épithélium unistratifié + chorion riche en glandes utérines (sécrétion de glycogène), artères spiralées et veines. Phase lutéale : la progestérone du corps jaune maintient l’endomètre épais. Transformation déciduale des fibroblastes.', [endo, ...glands, ...vess]));
    const conc = new THREE.Group(); scene.add(conc);
    // disque didermique : épiblaste (bleu) au-dessus de l'hypoblaste (jaune) ; pôle embryonnaire vers l'endomètre (bas)
    const epi = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .12, 40), mat(C.ecto)); epi.position.y = -.06;
    const hyp = new THREE.Mesh(new THREE.CylinderGeometry(.62, .62, .1, 40), mat(C.ento)); hyp.position.y = .05;
    conc.add(part(reg, 'epi', 'Épiblaste', 'Feuillet du disque didermique (en bleu), issu de la MCI à J7 : « pré-gastrulation ». Il borde le plancher de la cavité amniotique.', epi));
    conc.add(part(reg, 'hyp', 'Hypoblaste', 'Feuillet du disque didermique (en jaune), face au blastocèle puis au lécithocèle.', hyp));
    const amn = new THREE.Mesh(new THREE.SphereGeometry(.62, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(C.cav, { opacity: .45, side: THREE.DoubleSide })); amn.position.y = -.12;
    conc.add(part(reg, 'amn', 'Cavité amniotique', 'Apparaît dès J8 entre l’épiblaste et le cytotrophoblaste ; toujours présente à J11 et J13.', amn, s => s >= 1));
    const lec1 = sphere(1.0, C.vit, { opacity: .32, side: THREE.DoubleSide }); lec1.position.y = 1.1;
    conc.add(part(reg, 'lec1', 'Lécithocèle primaire', 'Expansion de l’hypoblaste (cavité encore ouverte à J8), formant à J9 le lécithocèle primaire (LI) bordé par la membrane de Heuser.', lec1, s => s === 1 || s === 2));
    const lec2 = sphere(.62, C.vit, { opacity: .55 }); lec2.position.y = .75;
    conc.add(part(reg, 'lec2', 'Lécithocèle secondaire', 'À J11 le lécithocèle secondaire (LII) remplace le primaire. À J13 : 3 cavités — cavité amniotique, lécithocèle secondaire, cœlome externe.', lec2, s => s >= 3));
    const mag = new THREE.Mesh(new THREE.SphereGeometry(1.32, 20, 14), new THREE.MeshBasicMaterial({ color: 0xc9b07a, wireframe: true, transparent: true, opacity: .35 })); mag.position.y = .35;
    conc.add(part(reg, 'mag', 'Magma réticulé', 'Tissu lâche entre le cytotrophoblaste et le lécithocèle (J8-J9) ; il entre en apoptose à J11 et est remplacé par le cœlome externe.', mag, s => s >= 1 && s <= 3));
    const mesx = new THREE.Mesh(new THREE.SphereGeometry(1.42, 40, 28), mat(C.meso, { opacity: .28, side: THREE.DoubleSide })); mesx.position.y = .35;
    conc.add(part(reg, 'mesx', 'Mésoblaste extra-embryonnaire', 'Lames mésenchymateuses (en rouge) qui tapissent le cytotrophoblaste et le lécithocèle à J11-J13.', mesx, s => s >= 3));
    const coel = sphere(1.25, 0xdff3ff, { opacity: .18, side: THREE.DoubleSide }); coel.position.y = .35;
    conc.add(part(reg, 'coel', 'Cœlome externe (extra-embryonnaire)', 'À J13, cavité creusée dans le mésoblaste extra-embryonnaire autour du lécithocèle secondaire et de l’amnios.', coel, s => s >= 4));
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(.18, .26, .75, 16), mat(C.meso)); ped.position.set(0, -.75, 0);
    conc.add(part(reg, 'ped', 'Pédicule embryonnaire', 'À J13, le mésoblaste extra-embryonnaire relie le disque (côté amnios) au cytotrophoblaste : futur cordon.', ped, s => s >= 4));
    const ct = new THREE.Mesh(new THREE.SphereGeometry(1.5, 48, 32), mat(C.ct, { opacity: .42, side: THREE.DoubleSide })); ct.position.y = .35;
    conc.add(part(reg, 'ct', 'Cytotrophoblaste (CT)', 'Différenciation du trophoblaste au contact de l’épithélium : une seule couche de cellules, activité mitotique élevée. Entoure entièrement l’embryon à J11.', ct, s => s >= 1));
    const tro = new THREE.Mesh(new THREE.SphereGeometry(1.45, 40, 28), mat(C.troph, { opacity: .55, side: THREE.DoubleSide })); tro.position.y = .35;
    conc.add(part(reg, 'tro', 'Trophoblaste', 'J7 : orientation (pôle embryonnaire en face de l’endomètre), éclosion, adhésion via protéoglycanes et cadhérines de l’endomètre. Il se différencie dès J8 en SCT et CT.', tro, s => s === 0));
    const sct = noisySphere(1.85, .09, C.sct, { opacity: .35, side: THREE.DoubleSide }, 1.3); sct.position.y = .35;
    conc.add(part(reg, 'sct', 'Syncytiotrophoblaste (SCT)', 'Cellule plurinucléée (syncytium) à capacité lytique : envahit l’endomètre, prolifération proche de celle des cellules tumorales. Apparition de lacunes à J9.', sct, s => s >= 1));
    const lac = []; fib(26, 1.68).forEach((p, i) => { const m = sphere(.16, 0xf6f0ff, {}, 12); m.position.copy(p).add(new THREE.Vector3(0, .35, 0)); m.userData.blood = true; lac.push(m); });
    const lacP = part(reg, 'lac', 'Lacunes du SCT', 'J9 : lacunes dans le SCT, encore sans sang. Elles se remplissent de sang maternel de J10 à J11, et sont complètement remplies à J13.', lac, s => s >= 2);
    conc.add(lacP);
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .12, 32), mat(0xf7f3c9, { opacity: .85 })); plug.position.y = .02;
    scene.add(part(reg, 'plug', 'Caillot séro-fibrineux', 'J11 : la brèche de l’épithélium de l’endomètre se reconstitue ; le caillot peut provoquer de petits saignements.', plug, s => s >= 3));
    const depth = [1.75, .9, -.2, -1.9, -2.0];
    return { tick(s, t) { conc.position.y += (depth[s] - conc.position.y) * .1; const sc = s === 0 ? .8 : 1; conc.scale.lerp(new THREE.Vector3(sc, sc, sc), .1); lac.forEach((m, i) => { m.material.color.lerp(new THREE.Color(s >= 3 ? C.blood : 0xf6f0ff), .1); const k = s >= 3 ? 1 + .12 * Math.sin(t * 3 + i) : 1; m.scale.setScalar(k); }); } };
  }

  /* ---------------- semaine 3 : gastrulation, post-gastrulation, début de la neurulation ---------------- */
  function buildWeek3(scene, reg, ui) {
    const L = 3.4, W = 2.3; // disque ovale, axe céphalo-caudal = z (céphalique en -z)
    const ovalShape = () => { const s = new THREE.Shape(); s.absellipse(0, 0, W / 2, L / 2, 0, Math.PI * 2); return s; };
    const sheet = (y, color, h, o) => { const g = new THREE.ExtrudeGeometry(ovalShape(), { depth: h, bevelEnabled: false, curveSegments: 48 }); g.rotateX(Math.PI / 2); const m = new THREE.Mesh(g, mat(color, o)); m.position.y = y + h; return m; };
    const add = (id, name, desc, objs, show) => { const g = part(reg, id, name, desc, objs, show); scene.add(g); return g; };
    const ecto = sheet(.18, C.ecto, .1, { opacity: .55 }), ento = sheet(-.12, C.ento, .1), meso = sheet(.03, C.meso, .1);
    const gEcto = add('ecto', 'Ectoblaste', 'Feuillet externe (en bleu), issu de l’épiblaste. Il donnera la plaque neurale (neurectoblaste) puis l’épiderme.', ecto);
    const gEnto = add('ento', 'Entoblaste définitif', 'Feuillet interne (en jaune) : des cellules de l’épiblaste qui migrent par la ligne primitive remplacent l’hypoblaste.', ento);
    const gMeso = add('meso', 'Mésoblaste intra-embryonnaire', 'Troisième feuillet (en rouge) mis en place par la gastrulation à partir de la ligne primitive, entre ectoblaste et entoblaste : disque tridermique.', meso, s => s >= 1 && s <= 2);
    const lp = new THREE.Mesh(new THREE.BoxGeometry(.09, .06, 1.35), mat(0x183c78)); lp.position.set(0, .31, .82);
    const hn = sphere(.13, 0x0e2a5c, {}, 20); hn.position.set(0, .32, .12); hn.scale.y = .6;
    const gLP = add('lp', 'Ligne primitive', 'J14-J15 : épaississement médian de l’épiblaste dans la moitié caudale du disque (sillon primitif). Elle recule ensuite vers le pôle caudal (bourgeon caudal).', lp);
    const gHN = add('hn', 'Nœud de Hensen', 'Extrémité céphalique de la ligne primitive (fossette primitive) ; point de départ du processus chordal.', hn);
    const mp = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .32, 24), mat(0xffffff, { opacity: .9 })); mp.position.set(0, .14, -1.42);
    const mc = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .32, 24), mat(0xffffff, { opacity: .9 })); mc.position.set(0, .14, 1.55);
    add('mpc', 'Membranes pharyngienne et cloacale', 'Zones didermiques : l’ectoblaste et l’entoblaste restent accolés, sans mésoblaste. Membrane pharyngienne en avant, membrane cloacale en arrière.', [mp, mc]);
    // migration des cellules (ingression)
    const mig = []; for (let i = 0; i < 40; i++) { const m = sphere(.045, i % 3 ? C.meso : C.ento, {}, 10); m.userData.ph = Math.random(); m.userData.z = .25 + Math.random() * 1.2; m.userData.sd = i % 2 ? 1 : -1; m.userData.deep = i % 3 === 0; mig.push(m); }
    const gMig = add('mig', 'Cellules en migration (ingression)', 'Les cellules de l’épiblaste s’invaginent par la ligne primitive puis migrent latéralement et vers l’avant : certaines forment le mésoblaste (rouge), d’autres l’entoblaste (jaune).', mig, s => s <= 2); gMig.userData.noBirth = true;
    // axe chordal
    const canal = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.2, 16, 1, true), mat(C.chorde, { opacity: .85, side: THREE.DoubleSide })); canal.rotation.x = Math.PI / 2; canal.position.set(0, .08, -.5);
    add('cc', 'Processus chordal / canal chordal', 'J16 : le prolongement céphalique issu du nœud de Hensen, d’abord plein, se creuse en canal chordal.', canal, s => s === 1);
    const pch = new THREE.Mesh(new THREE.BoxGeometry(.2, .05, 1.2), mat(C.chorde)); pch.position.set(0, -.05, -.5);
    add('pch', 'Plaque chordale', 'J17 : le plancher du canal chordal s’ouvre dans l’entoblaste : plaque chordale intercalée dans l’entoblaste.', pch, s => s === 2);
    const cne = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .5, 12), mat(0x9b7be0)); cne.position.set(0, .05, .12);
    add('cne', 'Canal neurentérique', 'J17 : il fait communiquer transitoirement la cavité amniotique et le lécithocèle secondaire, au niveau du nœud de Hensen.', cne, s => s === 2);
    const chorde = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, 1.25, 16), mat(C.chorde)); chorde.rotation.x = Math.PI / 2; chorde.position.set(0, .09, -.52);
    add('ch', 'Chorde dorsale', 'À partir de J18, la chorde se détache de l’entoblaste : axe médian du disque tridermique. Elle induit la plaque neurale.', chorde, s => s >= 3);
    const ppc = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .08, 20), mat(0x9d6bf0)); ppc.position.set(0, .05, -1.22);
    add('ppc', 'Plaque préchordale', 'En avant de la chorde, sous la membrane pharyngienne (J16-J17).', ppc, s => s >= 1);
    const allan = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, .9, 12), mat(C.ento)); allan.position.set(0, -.45, 1.55); allan.rotation.x = -.6;
    add('all', 'Allantoïde', 'J16 : diverticule de l’entoblaste du lécithocèle secondaire qui s’enfonce dans le pédicule embryonnaire, en arrière de la membrane cloacale.', allan, s => s >= 1);
    // plaque neurale → gouttière : deux moitiés qui se relèvent
    const npL = new THREE.Mesh(new THREE.BoxGeometry(.32, .07, 2.2), mat(C.neur)), npR = npL.clone(); npR.material = mat(C.neur);
    const hingeL = new THREE.Group(), hingeR = new THREE.Group(); hingeL.position.set(0, .34, -.45); hingeR.position.copy(hingeL.position);
    npL.position.x = -.16; npR.position.x = .16; hingeL.add(npL); hingeR.add(npR);
    const gNP = add('np', 'Plaque neurale → gouttière neurale', 'J18 : épaississement de l’ectoblaste au-dessus de la chorde (neurectoblaste). J19 : elle se creuse en gouttière neurale bordée par les bourrelets neuraux. Le tube neural se ferme à partir de J21-J22.', [hingeL, hingeR], s => s >= 3);
    const crL = sphere(.07, 0xf2c14e, {}, 12), crR = crL.clone(); crR.material = mat(0xf2c14e); crL.scale.z = crR.scale.z = 14; npL.add(crL); npR.add(crR); crL.position.set(-.16, .04, 0); crR.position.set(.16, .04, 0);
    const gCC = add('ccn', 'Crêtes neurales', 'Cellules à la jonction entre le neurectoblaste et l’ectoblaste de surface (sommet des bourrelets) ; elles migreront après la fermeture du tube neural.', [], s => s >= 6);
    // le groupe des crêtes est porté par la plaque : on rattache les sphères à la partie « crêtes »
    gCC.userData.meshes = [crL, crR]; crL.userData.part = crR.userData.part = 'ccn'; gCC.userData.noBirth = true;
    // mésoblaste condensé
    const parax = [-1, 1].map(sd => { const m = new THREE.Mesh(new THREE.BoxGeometry(.3, .1, 1.7), mat(0xe2665f)); m.position.set(sd * .46, .08, -.3); return m; });
    const inter = [-1, 1].map(sd => { const m = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, 1.5), mat(0xf08a7e)); m.position.set(sd * .68, .08, -.25); return m; });
    const lat = [-1, 1].map(sd => { const m = new THREE.Mesh(new THREE.BoxGeometry(.2, .1, 1.3), mat(0xbf3a33)); m.position.set(sd * .85, .08, -.2); return m; });
    add('mpa', 'Mésoblaste para-axial', 'J18 : condensation du mésoblaste de part et d’autre de la chorde ; il se segmente en somitomères puis somites à partir de J19.', parax, s => s === 3);
    add('mint', 'Mésoblaste intermédiaire', 'Cordon entre mésoblaste para-axial et latéral : néphrotomes (pronéphros dès J20, puis mésonéphros).', inter, s => s >= 3);
    add('mlat', 'Mésoblaste latéral (lame latérale)', 'Lame latérale du mésoblaste ; à J20 elle se clive en somatopleure et splanchnopleure.', lat, s => s >= 3 && s <= 4);
    const somat = [-1, 1].map(sd => { const m = new THREE.Mesh(new THREE.BoxGeometry(.2, .045, 1.3), mat(0xd94a3a)); m.position.set(sd * .85, .125, -.2); return m; });
    const splan = [-1, 1].map(sd => { const m = new THREE.Mesh(new THREE.BoxGeometry(.2, .045, 1.3), mat(0x9e2a24)); m.position.set(sd * .85, .035, -.2); return m; });
    const coel = [-1, 1].map(sd => { const m = new THREE.Mesh(new THREE.BoxGeometry(.18, .04, 1.25), mat(0xbfe6ff, { opacity: .9 })); m.position.set(sd * .85, .08, -.2); return m; });
    add('soma', 'Somatopleure / splanchnopleure', 'J20 : clivage de la lame latérale. Somatopleure (contre l’ectoblaste) et splanchnopleure (contre l’entoblaste).', [...somat, ...splan], s => s >= 5);
    add('coeli', 'Cœlome intra-embryonnaire', 'Cavité née du clivage de la lame latérale (cœlome interne), entre somatopleure et splanchnopleure.', coel, s => s >= 5);
    const NSOM = [0, 0, 0, 0, 1, 4, 7];
    const som = []; for (let i = 0; i < 7; i++) [-1, 1].forEach(sd => { const m = new THREE.Mesh(new THREE.BoxGeometry(.28, .14, .2), mat(0xd94a3a)); m.position.set(sd * .46, .09, -1.0 + i * .26); m.userData.i = i; som.push(m); });
    const gSom = add('som', 'Somitomères / somites', 'Segmentation du mésoblaste para-axial à partir de J19 (première paire), 3-4 paires par jour ; 7 paires à J21.', som, s => s >= 4);
    const card = new THREE.Mesh(new THREE.TorusGeometry(.62, .07, 10, 40, Math.PI), mat(0xb3122e)); card.rotation.x = Math.PI / 2; card.position.set(0, .08, -1.15); card.rotation.z = Math.PI;
    add('card', 'Zone cardiogène', 'Croissant de mésoblaste en avant de la membrane pharyngienne : il donnera les tubes endocardiques puis le tube cardiaque.', card, s => s >= 3);
    const ilots = []; fib(40, 1.9).forEach(p => { if (p.y > -.2) return; const m = sphere(.06, C.blood, {}, 10); m.position.set(p.x * .9, -.35 + p.y * .25, p.z * 1.1); ilots.push(m); });
    add('ilots', 'Îlots de Wolff et Pander', 'Foyers angioformateurs dans le mésoblaste extra-embryonnaire (paroi du lécithocèle) : premiers vaisseaux et cellules sanguines.', ilots, s => s >= 3);
    let spread = 0; ui.spread = v => { spread = v; };
    return { tick(s, t) {
      mig.forEach(m => { const u = (t * .22 + m.userData.ph) % 1; const x = m.userData.sd * u * (W / 2) * .85; const yTop = .26, yEnd = m.userData.deep ? -.07 : .08; const y = u < .15 ? yTop - (yTop - yEnd) * (u / .15) : yEnd; m.position.set(x, y + (m.userData.deep ? -spread * .55 : 0) * (u > .15 ? 1 : u / .15), m.userData.z - u * .5); });
      gEcto.position.y += (spread * .55 - gEcto.position.y) * .15; gEnto.position.y += (-spread * .55 - gEnto.position.y) * .15;
      [gLP, gHN, gNP].forEach(g => { g.position.y = gEcto.position.y; });
      // recul de la ligne primitive vers le pôle caudal
      const lpScale = s >= 5 ? .45 : s >= 3 ? .7 : 1; lp.scale.z += (lpScale - lp.scale.z) * .08; lp.position.z = 1.5 - .68 * lp.scale.z; hn.position.z += ((s >= 3 ? .82 - (1 - lpScale) * .2 : .12) - hn.position.z) * .08;
      // la plaque neurale se creuse en gouttière
      const a = s >= 6 ? .95 : s >= 5 ? .75 : s >= 4 ? .45 : 0; hingeL.rotation.z += (-a - hingeL.rotation.z) * .08; hingeR.rotation.z += (a - hingeR.rotation.z) * .08;
      som.forEach(m => { m.visible = m.userData.i < NSOM[s]; });
    }, hasSpread: true };
  }

  /* ---------------- semaine 4 : délimitation, neurulation, arcs, mésonéphros ---------------- */
  function buildWeek4(scene, reg) {
    const NU = 40, NV = 64, WID = 2.6, LEN = 4.2;
    function map(u, v, off, f, c, out) {
      const k = Math.max(f, .001), th = u * Math.PI * k, r = (WID / 2) / (Math.PI * k);
      let x = (r - off) * Math.sin(th), y = -(r - (r - off) * Math.cos(th)), z = v * LEN / 2;
      if (c > .001) { const R = (LEN / 2) / (c * Math.PI * .75), ph = z / R, yy = y; z = (R + yy) * Math.sin(ph); y = (R + yy) * Math.cos(ph) - R; }
      return (out || new THREE.Vector3()).set(x, y, z);
    }
    function sheet(off, color, o) {
      const g = new THREE.PlaneGeometry(WID, LEN, NU, NV); const base = g.attributes.position.array.slice();
      const m = new THREE.Mesh(g, mat(color, Object.assign({ side: THREE.DoubleSide }, o || {})));
      m.userData.upd = (f, c) => { const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { map(base[i * 3] / (WID / 2), -base[i * 3 + 1] / (LEN / 2), off, f, c, v); p.setXYZ(i, v.x, v.y, v.z); } p.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); };
      return m;
    }
    const add = (id, name, desc, objs, show) => { const g = part(reg, id, name, desc, objs, show); g.userData.noBirth = true; scene.add(g); return g; };
    const ecto = sheet(0, C.ecto, { opacity: .45 }), meso = sheet(.13, C.meso, { opacity: .85 }), ento = sheet(.26, C.ento);
    add('ecto', 'Ectoblaste (futur épiderme)', 'Les plicatures céphalo-caudale et latérales referment l’embryon : l’ectoblaste recouvre tout le corps (paroi ventrale / flancs latéraux).', ecto);
    add('meso', 'Mésoblaste latéral : somatopleure / splanchnopleure', 'Somatopleure (paroi du corps) et splanchnopleure (paroi de l’intestin) délimitent le cœlome intra-embryonnaire (futurs péricarde, plèvres, péritoine).', meso);
    add('ento', 'Entoblaste → intestin primitif', 'La délimitation enroule l’entoblaste en intestin primitif (antérieur, moyen, postérieur), relié au sac vitellin par le canal vitellin.', ento);
    // tube neural qui se ferme (gouttière ouverte aux extrémités = neuropores)
    const tn = new THREE.Mesh(new THREE.BufferGeometry(), mat(C.neur, { side: THREE.DoubleSide }));
    add('tn', 'Tube neural (fermeture bidirectionnelle)', 'La gouttière neurale se ferme en tube neural à partir de J21-J22, au niveau des 4e-5e paires de somites, puis vers l’avant et vers l’arrière.', tn);
    const npC = new THREE.Mesh(new THREE.TorusGeometry(.2, .035, 8, 24), mat(0xf2c14e)), npQ = npC.clone(); npQ.material = mat(0xf2c14e);
    const gNP = add('np', 'Neuropores', 'Les deux ouvertures du tube neural : le neuropore céphalique se ferme à J24, le neuropore caudal à J26.', [npC, npQ], s => s <= 1);
    const crest = []; for (let i = 0; i < 24; i++) crest.push(sphere(.045, 0xf2c14e, {}, 8));
    add('ccn', 'Crêtes neurales', 'Cellules issues des bords de la gouttière neurale ; elles migrent dans tout l’embryon après la fermeture du tube neural.', crest);
    const som = []; for (let i = 0; i < 30; i++) [-1, 1].forEach(sd => { const m = new THREE.Mesh(new THREE.BoxGeometry(.18, .14, .1), mat(0xd94a3a)); m.userData.i = i; m.userData.sd = sd; som.push(m); });
    add('som', 'Somites', 'Environ 20 paires à J24, 25-30 paires à J28, 30 paires à J30. Chaque somite donne sclérotome (vertèbres), myotome et dermatome.', som);
    const arcs = []; for (let i = 0; i < 4; i++) [-1, 1].forEach(sd => { const m = sphere(.13, 0xe08a6a, {}, 16); m.scale.set(.6, 1, .7); m.userData.i = i; m.userData.sd = sd; arcs.push(m); });
    add('arcs', 'Arcs branchiaux', '1er arc à J22, 2e vers J24, 3e à J26, 4e à J28 : bourrelets de la région céphalique séparés par des sillons (dehors) et des poches (dedans).', arcs);
    const pron = [], meson = [];
    for (let i = 0; i < 3; i++) [-1, 1].forEach(sd => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .16, 8), mat(0xf08a7e)); m.userData.i = i; m.userData.sd = sd; pron.push(m); });
    for (let i = 0; i < 12; i++) [-1, 1].forEach(sd => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .18, 8), mat(0xc0392b)); m.userData.i = i; m.userData.sd = sd; meson.push(m); });
    add('pron', 'Pronéphros', 'Mésoblaste intermédiaire cervical : il se segmente vers J20-J23 et a régressé vers J25-J28.', pron, s => s <= 1);
    add('meson', 'Mésonéphros (corps de Wolff)', 'Il se segmente à partir de J24 : environ 30 paires de tubules mésonéphrotiques à J28, drainées par le canal de Wolff.', meson, s => s >= 1);
    const vit = sphere(.5, C.vit, { opacity: .9 }); const stalk = new THREE.Mesh(new THREE.CylinderGeometry(.11, .15, 1, 14), mat(C.vit));
    add('vit', 'Sac vitellin et canal vitellin', 'Partie du lécithocèle secondaire restée hors de l’embryon ; l’étranglement forme le canal vitellin relié à l’intestin moyen.', [vit, stalk]);
    const heart = new THREE.Mesh(new THREE.TorusGeometry(.24, .09, 12, 30, Math.PI * 1.5), mat(0xb3122e));
    add('coeur', 'Tube cardiaque', 'Avec la plicature céphalique, la zone cardiogène bascule en position ventrale, sous l’intestin antérieur ; le cœur bat dès la 4e semaine.', heart);
    const mPh = new THREE.Mesh(new THREE.CircleGeometry(.17, 24), mat(0xffffff, { side: THREE.DoubleSide, opacity: .95 })), mCl = mPh.clone(); mCl.material = mat(0xffffff, { side: THREE.DoubleSide, opacity: .95 });
    const gMPh = add('mph', 'Membrane pharyngienne', 'Elle bascule de 180° avec la plicature céphalique (J25) et se résorbe vers J26-J28 : ouverture de la bouche primitive.', mPh, s => s <= 2);
    add('mcl', 'Membrane cloacale', 'Elle bascule avec la plicature caudale et ferme le cloaque (partie terminale de l’intestin postérieur).', mCl);
    const all = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .8, 10), mat(C.ento));
    add('all', 'Allantoïde', 'Diverticule de l’intestin postérieur qui s’enfonce dans le pédicule / cordon ombilical ; le canal de Wolff s’abouche près d’elle (J26).', all);
    const F = [.3, .62, .85, .97], CC = [.12, .3, .42, .5], NS = [8, 20, 25, 28], NA = [1, 2, 3, 4], NM = [0, 4, 8, 12];
    const CL = [[-.55, -.15], [-1.1, .3], [-1.1, 1.1], [-1.1, 1.1]];
    let f = F[0], c = CC[0], ca = CL[0][0], cb = CL[0][1], last = '';
    const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
    const gutC = (v, out) => { map(0, v, .26, f, c, tmp2); map(1, v, .26, f, c, out); return out.add(tmp2).multiplyScalar(.5); };
    function tubeGeo() {
      const SEG = 44, RING = 18, pos = [], idx = [];
      for (let i = 0; i <= SEG; i++) {
        const v = -.85 + i / SEG * 1.7, P = map(0, v, -.13, f, c), Q = map(0, v, .2, f, c), up = P.clone().sub(Q).normalize();
        const T = map(0, Math.min(.9, v + .01), -.13, f, c).sub(map(0, Math.max(-.9, v - .01), -.13, f, c)).normalize(); const side = new THREE.Vector3().crossVectors(T, up).normalize();
        const k = v >= ca && v <= cb ? 1 : Math.max(0, 1 - Math.min(Math.abs(v - ca), Math.abs(v - cb)) / .18);
        const g = (1 - k) * Math.PI * .85;
        for (let j = 0; j <= RING; j++) { const th = g / 2 + (j / RING) * (Math.PI * 2 - g); const R = .14; pos.push(P.x + R * (Math.cos(th) * up.x + Math.sin(th) * side.x), P.y + R * (Math.cos(th) * up.y + Math.sin(th) * side.y), P.z + R * (Math.cos(th) * up.z + Math.sin(th) * side.z)); }
      }
      for (let i = 0; i < SEG; i++) for (let j = 0; j < RING; j++) { const a = i * (RING + 1) + j, b = a + RING + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    return { tick(s, t) {
      heart.scale.setScalar(1 + .14 * Math.max(0, Math.sin(t * 6.5)) ** 3);
      f += (F[s] - f) * .08; c += (CC[s] - c) * .08; ca += (CL[s][0] - ca) * .08; cb += (CL[s][1] - cb) * .08;
      const key = [f, c, ca, cb].map(x => x.toFixed(3)).join(); if (key === last) return; last = key;
      [ecto, meso, ento].forEach(m => m.userData.upd(f, c));
      tn.geometry.dispose(); tn.geometry = tubeGeo();
      map(0, -.85, -.13, f, c, tmp); npC.position.copy(tmp); npC.lookAt(map(0, -.8, -.13, f, c));
      map(0, .85, -.13, f, c, tmp); npQ.position.copy(tmp); npQ.lookAt(map(0, .8, -.13, f, c));
      npC.visible = ca > -1.0; npQ.visible = cb < 1.0;
      crest.forEach((m, i) => { const sd = i % 2 ? 1 : -1, v = -.8 + Math.floor(i / 2) / 12 * 1.6; map(sd * .07, v, -.22, f, c, tmp); m.position.copy(tmp); });
      som.forEach(m => { const i = m.userData.i; m.visible = i < NS[s]; map(m.userData.sd * .2, -.55 + (i + .5) / 30 * 1.25, .06, f, c, tmp); m.position.copy(tmp); });
      arcs.forEach(m => { m.visible = m.userData.i < NA[s]; map(m.userData.sd * .62, -.86 + m.userData.i * .07, -.02, f, c, tmp); m.position.copy(tmp); });
      pron.forEach(m => { map(m.userData.sd * .34, -.62 + m.userData.i * .05, .12, f, c, tmp); m.position.copy(tmp); });
      meson.forEach(m => { m.visible = m.userData.i < NM[s]; map(m.userData.sd * .34, -.35 + m.userData.i * .055, .12, f, c, tmp); m.position.copy(tmp); });
      map(1, .05, .26, f, c, tmp); const belly = tmp.clone();
      stalk.position.set(0, belly.y - .45, belly.z); vit.position.set(0, belly.y - 1.05, belly.z); vit.scale.setScalar(1 - f * .3);
      map(1, -.62, .3, f, c, tmp); heart.position.set(0, tmp.y - .25, tmp.z); heart.rotation.y = Math.PI / 2;
      gutC(-.95, tmp); mPh.position.copy(tmp); mPh.lookAt(gutC(-.85, tmp2.clone()));
      gutC(.95, tmp); mCl.position.copy(tmp); mCl.lookAt(gutC(.85, tmp2.clone()));
      gutC(.8, tmp); all.position.set(0, tmp.y - .35, tmp.z); all.rotation.x = .5;
    } };
  }

  /* correspondance structure du modèle → notions des annales (window.SDE) */
  const ANN_MAP = {
    s1: { zp: /Éclosion/, zp2: /Éclosion/, zyg: /Zygote/, b1: /Segmentation/, b2: /Segmentation/, b3: /Segmentation|Activation/, mor: /Morula|Jonctions/, troph: /Blastocyste/, mci: /Blastocyste|Cellules souches/, blc: /Blastocyste/ },
    s2: { endo: /Implantation/, tro: /Implantation/, epi: /Épiblaste/, hyp: /Épiblaste/, amn: /Cavité amniotique/, lec1: /Lécithocèle primaire/, lec2: /Lécithocèle secondaire/, mag: /Mésenchyme extra/, mesx: /Lames choriale|Mésenchyme extra/, coel: /Cœlome extra/, ped: /Lames choriale/, ct: /Cytotrophoblaste/, sct: /Syncytiotrophoblaste/, lac: /Lacunes/, plug: /Implantation/ },
    s3: { ecto: /Feuillets définitifs/, ento: /Chordo-mésoblaste/, meso: /Mésoblaste \(axial|Gastrulation \(/, lp: /Ligne primitive|Bourgeon caudal/, hn: /Nœud de Hensen/, mpc: /Membranes pharyngienne/, mig: /Ingression|Gastrulation \(/, cc: /Canal chordal|Processus chordal/, pch: /Plaque chordale/, cne: /Canal neurentérique/, ch: /Chorde dorsale/, ppc: /Plaque préchordale/, all: /Allantoïde/, np: /Plaque neurale|Gouttière neurale|Induction/, ccn: /Crêtes neurales/, mpa: /Mésoblaste \(axial|Segmentation du mésoblaste/, mint: /Mésoblaste \(axial/, mlat: /Lame latérale/, soma: /Somatopleure|Lame latérale/, coeli: /Lame latérale|Cœlome intra/, som: /Segmentation du mésoblaste/, card: /Cœur/, ilots: /Angiogenèse/ },
    s4: { ecto: /Délimitation|Paroi ventrale/, meso: /Mésoblaste latéral|Cœlome intra/, ento: /Intestin primitif|Dérivés/, tn: /Tube neural|Neurulation primaire/, np: /Neuropores/, ccn: /Crêtes neurales/, som: /Somites \(|Somites :|Vertèbres/, arcs: /Arcs branchiaux/, pron: /Pronéphros/, meson: /Mésonéphros|Mésoblaste intermédiaire/, vit: /Lécithocèle II/, coeur: /Cœur|péricarde/, mph: /Cavité bucco|Délimitation/, mcl: /Cloaque/, all: /Allantoïde/ }
  };
  function annFor(wk, id) {
    const W = (window.SDE || []); const rx = (ANN_MAP[wk] || {})[id]; if (!rx) return [];
    const wn = +wk.slice(1); const here = (W.find(w => w.week === wn) || { structs: [] }).structs.filter(x => rx.test(x.name));
    return here.length ? here.slice(0, 2) : W.flatMap(w => w.structs).filter(x => rx.test(x.name)).slice(0, 1);
  }
  const dayNum = d => +String(d).match(/\d+/)[0];
  function eventsFor(wk, stages, i) {
    const W = (window.SDE || []).find(w => w.week === +wk.slice(1)); if (!W) return [];
    const ds = stages.map(st => dayNum(st[0]));
    return W.stages.filter(x => { const d = dayNum(x.day); let best = 0; ds.forEach((v, k) => { if (Math.abs(v - d) < Math.abs(ds[best] - d) || (Math.abs(v - d) === Math.abs(ds[best] - d) && v > ds[best])) best = k; }); return best === i; }).flatMap(x => x.events.map(e => Object.assign({ day: x.day }, e)));
  }
  /* familles de structures, pour n'afficher que certaines parties (combinables) */
  const FAM = [
    ['neural', 'Neural', ['np', 'ccn', 'tn']],
    ['meso', 'Mésoblaste', ['meso', 'mig', 'mpa', 'mint', 'mlat', 'soma', 'coeli', 'som', 'card', 'ilots', 'pron', 'meson', 'coeur', 'mesx']],
    ['axe', 'Ligne primitive & chorde', ['lp', 'hn', 'cc', 'pch', 'cne', 'ch', 'ppc']],
    ['ecto', 'Ectoblaste', ['ecto', 'epi']],
    ['ento', 'Entoblaste', ['ento', 'hyp', 'vit', 'arcs', 'mph', 'mcl', 'mpc']],
    ['annexes', 'Annexes & cavités', ['amn', 'lec1', 'lec2', 'mag', 'coel', 'ped', 'all', 'blc']],
    ['oeuf', 'Œuf & trophoblaste', ['zp', 'zp2', 'zyg', 'mor', 'troph', 'mci', 'tro', 'ct', 'sct', 'lac', 'plug', 'endo']]
  ];
  /* ---------------- visionneuse ---------------- */
  let cur = null;
  function stop() { if (cur) { cancelAnimationFrame(cur.raf); cur.renderer.dispose(); window.removeEventListener('resize', cur.onResize); cur = null; } }
  async function open(host, wi, opts) {
    stop();
    const w = WEEKS[wi]; const esc = (opts && opts.esc) || (s => s);
    host.innerHTML = `<div class="m3d">
      <div class="m3d-filter" id="m3dFilter"></div>
      <div class="m3d-legend" id="m3dLegend"></div>
      <div class="m3d-stage"><div class="m3d-canvas" id="m3dCanvas"><div class="m3d-load">Chargement du modèle…</div></div>
        <div class="m3d-tools"><button class="btn ghost sm" id="m3dCut" aria-pressed="false">Coupe</button>${w.key === 's3' ? '<button class="btn ghost sm" id="m3dSpread" aria-pressed="false">Écarter les feuillets</button>' : ''}<button class="btn ghost sm on" id="m3dHl" aria-pressed="true">✦ Nouveautés</button><button class="btn ghost sm" id="m3dPlay" aria-pressed="false">▶ Lecture</button><button class="btn ghost sm" id="m3dReset">Recentrer</button></div></div>
      <div class="m3d-days" role="tablist">${w.stages.map((st, i) => `<button role="tab" data-st="${i}"><b>${esc(st[0])}</b><span>${esc(st[1])}</span></button>`).join('')}</div>
      <div class="m3d-new" id="m3dNew" aria-live="polite"></div>
      <div class="m3d-info" id="m3dInfo"><b>Touchez une structure</b><span>ou choisissez-la dans la légende.</span></div>
      <div class="m3d-side"><section class="m3d-figs"><h4>Schémas du cours</h4><div id="m3dFigs"></div></section><section class="m3d-ann"><h4>Ce jour, dans les annales</h4><ul id="m3dEvents"></ul></section></div>
      <p class="note-src">${esc(w.note)} Faites tourner avec un doigt, zoomez en pinçant. Légendes d’après le cours d’embryologie (UE5, Pr Labrune) ; « Ce qui tombe aux annales » et « Ce jour, dans les annales » : phrases copiées des corrections d’annales et de banques de QCM. Couleurs : ectoblaste bleu, mésoblaste rouge, entoblaste jaune.</p>
    </div>`;
    try { await load(); } catch (e) { { const l = host.querySelector('.m3d-load'); l.classList.add('err'); l.textContent = 'Le modèle 3D n’a pas pu être chargé (connexion internet nécessaire).'; } return; }
    const box = host.querySelector('#m3dCanvas'); box.innerHTML = '';
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.localClippingEnabled = true; box.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(40, 1, .05, 100);
    const home = { s1: [0, 1.6, 4.6], s2: [3.2, 2.6, 6.2], s3: [0, 4.2, 3.2], s4: [4.2, 2.2, 4.6] }[w.key];
    cam.position.set(...home);
    const ctl = new THREE.OrbitControls(cam, renderer.domElement); ctl.enableDamping = true; ctl.target.set(0, w.key === 's2' ? -.3 : 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, .9)); const dl = new THREE.DirectionalLight(0xffffff, .8); dl.position.set(3, 5, 4); scene.add(dl);
    const reg = []; const ui = {}; const api = w.build(scene, reg, ui);
    // état d'animation de chaque partie : a = 0 (cachée) → 1 (visible)
    reg.forEach(g => { g.userData.a = 0; const ms = []; g.traverse(o => { if (o.isMesh) { o.userData.baseOp = o.material.opacity; o.userData.home = o.position.clone(); o.userData.baseScale = o.scale.clone(); ms.push(o); } }); const c = new THREE.Vector3(); ms.forEach(o => c.add(o.userData.home)); g.userData.center = ms.length ? c.multiplyScalar(1 / ms.length) : c; g.userData.meshes = ms; });
    reg.forEach(g => { if (g.userData.id === 'zyg') g.userData.noBirth = true; });
    function born(g) { if (g.userData.noBirth) return; g.userData.meshes.forEach(o => { if (g.userData.meshes.length > 1) o.position.copy(g.userData.center); o.scale.copy(o.userData.baseScale).multiplyScalar(.55); }); }
    function animate() {
      const pulse = .45 + .4 * Math.sin(performance.now() / 260);
      reg.forEach(g => {
        const tgt = g.userData.show(stage) ? (passes(g) ? 1 : (ghost ? .1 : 0)) : 0; const a = g.userData.a += (tgt - g.userData.a) * .1;
        g.visible = a > .01;
        if (!g.visible) return;
        g.userData.meshes.forEach(o => {
          const op = o.userData.baseOp * a; o.material.opacity = op; const tr = o.userData.baseOp < 1 || a < .99; if (o.material.transparent !== tr) { o.material.transparent = tr; o.material.needsUpdate = true; } o.material.depthWrite = op >= .6;
          if (!g.userData.noBirth) { o.position.lerp(o.userData.home, .09); o.scale.lerp(o.userData.baseScale, .09); }
          if (o.material.emissive) { if (sel === g.userData.id) o.material.emissive.setHex(0x444444); else if (hl && newIds.has(g.userData.id) && passes(g)) o.material.emissive.setRGB(.55 * pulse, .3 * pulse, 0); else o.material.emissive.setHex(0); }
        });
      });
    }
    const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    let stage = 0, sel = null, cut = false, ghost = true, hl = true, newIds = new Set(), goneIds = [];
    const filt = new Set(), passes = g => !filt.size || filt.has(g.userData.id);
    const legend = host.querySelector('#m3dLegend'), info = host.querySelector('#m3dInfo');
    function visibleParts() { return reg.filter(p => p.userData.show(stage) && passes(p)); }
    const shownParts = () => reg.filter(p => p.userData.show(stage));
    const filterBox = host.querySelector('#m3dFilter'), newBox = host.querySelector('#m3dNew');
    function drawLegend() {
      legend.innerHTML = shownParts().map(p => { const id = p.userData.id, vis = passes(p); return `<span class="m3d-li${vis ? '' : ' off'}${newIds.has(id) ? ' new' : ''}"><button class="m3d-eye" data-v="${esc(id)}" aria-pressed="${filt.has(id)}" aria-label="${filt.has(id) ? 'Retirer de la sélection' : 'Afficher seulement cette partie (combinable)'} : ${esc(p.userData.name)}">${filt.has(id) ? '✓' : ''}</button><button data-p="${esc(id)}" class="${sel === id ? 'on' : ''}"><i style="background:#${firstColor(p)}"></i>${esc(p.userData.name)}</button></span>`; }).join('');
      legend.querySelectorAll('[data-p]').forEach(b => b.onclick = () => select(b.dataset.p));
      legend.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { const id = b.dataset.v; filt.has(id) ? filt.delete(id) : filt.add(id); drawLegend(); });
      const ids = shownParts().map(p => p.userData.id), fams = FAM.filter(f => f[2].some(x => ids.includes(x)));
      filterBox.innerHTML = `<span class="m3d-fl">Afficher :</span><button data-f="*" class="${filt.size ? '' : 'on'}" aria-pressed="${!filt.size}">Tout</button>${fams.map(f => { const here = f[2].filter(x => ids.includes(x)), on = here.every(x => filt.has(x)); return `<button data-f="${f[0]}" class="${on ? 'on' : ''}" aria-pressed="${on}">${esc(f[1])}</button>`; }).join('')}${filt.size ? `<label class="m3d-ghost"><input type="checkbox" ${ghost ? 'checked' : ''}> Garder le reste en transparence</label>` : ''}`;
      filterBox.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
        if (b.dataset.f === '*') filt.clear();
        else { const here = FAM.find(f => f[0] === b.dataset.f)[2].filter(x => ids.includes(x)), on = here.every(x => filt.has(x)); here.forEach(x => on ? filt.delete(x) : filt.add(x)); }
        if (sel && !passes(reg.find(p => p.userData.id === sel))) select(sel); drawLegend();
      });
      const gb = filterBox.querySelector('.m3d-ghost input'); if (gb) gb.onchange = () => { ghost = gb.checked; };
    }
    function drawNew(prev) {
      const st = w.stages[stage], name = id => (reg.find(p => p.userData.id === id) || { userData: { name: id } }).userData.name;
      if (prev < 0) { newBox.innerHTML = `<b>${esc(st[0])}</b><span>${esc(st[1])}</span>`; return; }
      const chips = (l, cl) => l.map(id => `<button class="m3d-chip ${cl}" data-c="${esc(id)}">${esc(name(id))}</button>`).join('');
      newBox.innerHTML = `<b>${esc(w.stages[prev][0])} → ${esc(st[0])}</b><span>${esc(st[1])}</span>${newIds.size ? `<div><small>Apparaît :</small>${chips([...newIds], 'plus')}</div>` : ''}${goneIds.length ? `<div><small>Disparaît :</small>${chips(goneIds, 'moins')}</div>` : ''}`;
      newBox.querySelectorAll('.plus').forEach(b => b.onclick = () => select(b.dataset.c));
      newBox.classList.remove('flash'); void newBox.offsetWidth; newBox.classList.add('flash');
    }
    function firstColor(p) { let c = '888888'; p.traverse(o => { if (o.isMesh && c === '888888') c = o.material.color.getHexString(); }); return c; }
    function select(id) {
      sel = sel === id ? null : id; const p = reg.find(x => x.userData.id === sel);
      const A = p ? annFor(w.key, p.userData.id) : [];
      const facts = A.flatMap(x => x.facts).slice(0, 4), traps = A.flatMap(x => x.pieges).slice(0, 2);
      info.innerHTML = p ? `<b>${esc(p.userData.name)}</b><span>${esc(p.userData.desc)}</span>${facts.length ? `<div class="m3d-facts"><h5>Ce qui tombe aux annales</h5><ul>${facts.map(x => `<li>« ${esc(x.t)} »<small>${esc(x.s)}</small></li>`).join('')}</ul></div>` : ''}${traps.length ? `<div class="m3d-traps"><h5>Piège déjà posé</h5><ul>${traps.map(x => `<li><s>${esc(x.f)}</s> — FAUX : ${esc(x.c)}<small>${esc(x.s)}</small></li>`).join('')}</ul></div>` : ''}` : '<b>Touchez une structure</b><span>ou choisissez-la dans la légende.</span>';
      reg.forEach(g => g.traverse(o => { if (o.isMesh && o.material.emissive) { o.material.emissive.setHex(sel && g.userData.id === sel ? 0x444444 : 0x000000); } }));
      drawLegend();
    }
    const figBox = host.querySelector('#m3dFigs'), evBox = host.querySelector('#m3dEvents');
    function drawSide() {
      const st = w.stages[stage][0]; const figs = ((window.COURS3D || {})[w.key] || {})[st] || [];
      figBox.innerHTML = figs.length ? figs.map(fg => `<figure><img src="${esc(fg.src)}" alt="${esc(fg.caption)}" loading="lazy"><figcaption>${esc(fg.caption)}<small>${esc(fg.source)}</small></figcaption></figure>`).join('') : '<p class="note-src">Pas de schéma du cours pour ce jour.</p>';
      figBox.querySelectorAll('img').forEach(im => im.onclick = () => { const z = document.createElement('div'); z.className = 'm3d-zoom'; z.innerHTML = `<img src="${im.src}" alt="">`; z.onclick = () => z.remove(); document.body.appendChild(z); });
      const ev = eventsFor(w.key, w.stages, stage);
      evBox.innerHTML = ev.length ? ev.slice(0, 8).map(e => `<li><b>${esc(e.day)}</b> « ${esc(e.t)} »<small>${esc(e.s)}</small></li>`).join('') : '<li class="note-src">Aucune question d’annales datée de ce jour.</li>';
    }
    function setStage(i) { const prev = stage; stage = i; if (i >= 0) setTimeout(drawSide, 0); host.querySelectorAll('[data-st]').forEach(b => { b.classList.toggle('on', +b.dataset.st === i); if (+b.dataset.st === i) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }); reg.forEach(g => { if (g.userData.show(i) && (!g.userData.show(prev) || prev === i && g.userData.a < .5)) born(g); }); const ref = i - 1; if (ref >= 0) { newIds = new Set(reg.filter(g => g.userData.show(i) && !g.userData.show(ref)).map(g => g.userData.id)); goneIds = reg.filter(g => !g.userData.show(i) && g.userData.show(ref)).map(g => g.userData.id); } else { newIds = new Set(); goneIds = []; } if (sel && !reg.find(p => p.userData.id === sel).userData.show(i)) select(sel); drawLegend(); drawNew(i - 1); }
    let play = null; const pb = host.querySelector('#m3dPlay');
    function setPlay(on) { clearInterval(play); play = null; pb.classList.toggle('on', on); pb.setAttribute('aria-pressed', on); pb.textContent = on ? '❚❚ Pause' : '▶ Lecture'; if (on) { play = setInterval(() => { if (!document.body.contains(box)) { clearInterval(play); return; } setStage((stage + 1) % w.stages.length); }, 2600); } }
    pb.onclick = () => { if (!play && stage === w.stages.length - 1) setStage(0); setPlay(!play); };
    host.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { setPlay(false); setStage(+b.dataset.st); });
    const cb = host.querySelector('#m3dCut'); cb.onclick = () => { cut = !cut; cb.setAttribute('aria-pressed', cut); cb.classList.toggle('on', cut); scene.traverse(o => { if (o.isMesh) { o.material.clippingPlanes = cut ? [clip] : []; o.material.clipShadows = true; o.material.side = cut ? THREE.DoubleSide : o.material.side; o.material.needsUpdate = true; } }); };
    const sb = host.querySelector('#m3dSpread'); if (sb) { let on = false; sb.onclick = () => { on = !on; sb.classList.toggle('on', on); sb.setAttribute('aria-pressed', on); ui.spread && ui.spread(on ? 1 : 0); }; }
    const hb = host.querySelector('#m3dHl'); hb.onclick = () => { hl = !hl; hb.classList.toggle('on', hl); hb.setAttribute('aria-pressed', hl); };
    host.querySelector('#m3dReset').onclick = () => { cam.position.set(...home); ctl.target.set(0, w.key === 's2' ? -.3 : 0, 0); };
    // sélection au toucher (un appui court, pas un glissement)
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
    let idle = 0; ctl.autoRotate = true; ctl.autoRotateSpeed = .7;
    renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; ctl.autoRotate = false; idle = performance.now(); });
    renderer.domElement.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return; const r = renderer.domElement.getBoundingClientRect();
      ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ptr, cam);
      const hits = ray.intersectObjects(visibleParts(), true).filter(h => h.object.visible && (!cut || h.point.z <= .001) && h.object.material.opacity > .2);
      const opaque = hits.find(h => h.object.material.opacity >= .5) || hits[0];
      if (opaque) select(opaque.object.userData.part);
    });
    const onResize = () => { const W = box.clientWidth, H = box.clientHeight; renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix(); };
    window.addEventListener('resize', onResize); onResize();
    stage = -1; setStage(Math.min(Math.max(+(opts && opts.stage) || 0, 0), w.stages.length - 1));
    const loop = () => { if (!document.body.contains(box)) { stop(); return; } const t = performance.now() / 1000; if (!ctl.autoRotate && idle && performance.now() - idle > 7000) ctl.autoRotate = true; ctl.update(); api && api.tick && api.tick(stage, t); animate(); renderer.render(scene, cam); cur.raf = requestAnimationFrame(loop); };
    cur = { renderer, onResize, raf: 0 }; loop();
  }
  window.Model3D = { WEEKS: WEEKS.map(w => ({ key: w.key, title: w.title, sub: w.sub, stages: w.stages })), open, stop };
})();
