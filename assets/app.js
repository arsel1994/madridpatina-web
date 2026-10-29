/* MADRIDPATINA · web del club. JavaScript sin dependencias ni compilación.
   Lee data/app.json (obligatorio) y data/historico.json (opcional).
   Rutas: #/ (Inicio; #/jornada[/2026-S40] sigue valiendo) · #/calendario · #/equipo/C · #/liga/senior-4[/j/2 | /evolucion | /mapa]
          #/pretemporada/<liga|club> · #/partido/<mid> · #/jugadores[/C] · #/jugador/<k> · #/legado · #/metodo
   Rediseño 2026-10 (rediseño/README handoff.md): navegación Inicio · Calendario · Equipos · Ligas · Jugadores · Legado, migas sin «← Volver». 
   Diseño y medidas: design_handoff_madridpatina_web/README.md (prototipo MADRIDPATINA.dc.html). */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RED = '#D3202A';
  const TELEGRAM = 'https://t.me/madridpatina_directo';   // canal con los avisos automáticos de nuestros partidos (los manda el vigía)
  const RES = { V: ['VICTORIA', '#1A7A43'], E: ['EMPATE', '#6B6B70'], D: ['DERROTA', '#55555B'] };
  const MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  /* ── Animaciones (handoff_animaciones/README.md) ─────────────────────────────────────────────
     · data-anim="mpUp .4s ease 120ms" en un elemento: se anima UNA vez cuando entra en pantalla (25 % visible;
       en bloques más altos que la pantalla, cuando ocupa un cuarto de ella). Lo de arriba del todo, al cargar.
     · repetir(el, anim): vuelve a lanzar una animación CSS (quitar, forzar reflow y poner).
     · contar(el, hasta, ms, fmt): cuenta desde 0 hasta la cifra.
     Con «reducir movimiento» todo aparece sin animar (regla de animaciones.css). */
  /*   · data-grupo en un contenedor: sus [data-anim] arrancan juntos cuando entra él (la cascada va en el retraso de cada uno).
       · data-espera="900" (en el elemento o en su grupo): espera extra solo si ya se ve al abrir la página
         (p. ej., que el marcador termine antes); si se llega bajando, arranca sin esperar. */
  const MOV = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  // lo que ya se ha visto en esta visita (tragaperras, escalera de cada liga): la segunda vez va en versión corta (35 %)
  const SES = (() => { try { return JSON.parse(sessionStorage.getItem('mp-visto') || '{}'); } catch (e) { return {}; } })();
  const vistoSes = k => !!SES[k];
  const marcarSes = k => { if (SES[k]) return; SES[k] = 1; try { sessionStorage.setItem('mp-visto', JSON.stringify(SES)); } catch (e) { /* sin almacenamiento */ } };
  // apodos aprobados en el buzón (k → apodo; se guardan para la próxima visita) y cómo se ve cada uno: si dos jugadores
  // tienen el mismo, con la inicial del primer apellido («Toro G.») y, si aun así coinciden, con el apellido entero
  let APODO = (() => { try { return JSON.parse(localStorage.getItem('mp-apodos') || '{}') || {}; } catch (e) { return {}; } })(), APODO_V = {}, SRV = {};
  const apodoDe = p => { if (!p) return ''; const k = p.k || (p.nombre ? kOf(p.nombre, p.apellidos || '') : ''); return (k && APODO_V[k]) || ''; };
  const grupos = new Map();   // disparador → { els, espera }
  const obsAnim = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => {
    const visto = en.intersectionRatio >= 0.25 || en.intersectionRect.height >= innerHeight * 0.25;
    const g = grupos.get(en.target);
    if (!en.isIntersecting || !visto || !g) return;
    obsAnim.unobserve(en.target); grupos.delete(en.target);
    const va = () => g.els.forEach(el => { el.style.animationPlayState = 'running'; });
    if (g.espera) setTimeout(va, g.espera); else va();
  }), { threshold: Array.from({ length: 101 }, (_, i) => i / 100) }) : null;   // pasos finos: en bloques muy largos el % visible es pequeño
  const COMA = /,(?![^(]*\))/;   // separa animaciones, no las comas de cubic-bezier(…)
  function animar(root) {
    if (obsAnim) { obsAnim.disconnect(); grupos.clear(); }
    const els = [...root.querySelectorAll('[data-anim]')], H0 = innerHeight;
    // primero se leen todas las posiciones y luego se escribe (una sola maquetación)
    const info = els.map(el => { const t = el.closest('[data-grupo]') || el; return { el, t, ve: t.getBoundingClientRect().top < H0 }; });
    els.forEach(el => { el.style.animation = 'none'; });
    void root.offsetWidth;   // reinicio: así se puede volver a lanzar (p. ej., al cerrar la intro)
    info.forEach(({ el, t, ve }) => {
      el.style.animation = el.dataset.anim.split(COMA).map(a => { a = a.trim(); return /\b(forwards|backwards|both)\b/.test(a) ? a : a + ' both'; }).join(', ');
      if (!obsAnim || !MOV) return;
      el.style.animationPlayState = 'paused';
      let g = grupos.get(t);
      if (!g) { g = { els: [], espera: ve ? +(t.dataset.espera || 0) : 0 }; grupos.set(t, g); obsAnim.observe(t); }
      g.els.push(el);
    });
  }
  // 7m · ola diagonal: retraso (columna + fila) × 60 ms en lo que se ve al entrar; más abajo, por columnas según se baja
  function ola(root) {
    root.querySelectorAll('[data-ola]').forEach(g => {
      const hijos = [...g.children], H0 = innerHeight;
      const xs = [...new Set(hijos.map(h => h.offsetLeft))].sort((a, b) => a - b), ys = [...new Set(hijos.map(h => h.offsetTop))].sort((a, b) => a - b);
      const pos = hijos.map(h => [xs.indexOf(h.offsetLeft), ys.indexOf(h.offsetTop), h.getBoundingClientRect().top < H0]);
      hijos.forEach((h, i) => { const [c, f, ve] = pos[i]; h.dataset.anim = `${g.dataset.ola} ${((ve ? f : 0) + c) * 60}ms`; });
    });
  }
  // 7k · cada rodillo mide su columna para que cada foto ocupe justo el alto de la tarjeta
  function rodillos(root) {
    const ts = [...root.querySelectorAll('.rod-tira')], hs = ts.map(t => t.parentElement.clientHeight);
    ts.forEach((t, i) => { t.style.setProperty('--h', hs[i] + 'px'); t.style.setProperty('--to', (-(t.children.length - 1) * hs[i]) + 'px'); });
  }
  // 8b · el resguardo se rasga al pasar el ratón; en el móvil, al tocarlo
  function billetes(root) {
    root.querySelectorAll('.billete').forEach(b => {
      b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') b.classList.add('rasgado'); });
      b.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') b.classList.remove('rasgado'); });
      b.querySelector('.resguardo').addEventListener('click', () => { if (!matchMedia('(hover: hover)').matches) b.classList.toggle('rasgado'); });
    });
  }
  function repetir(el, anim) { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = anim; }
  function contar(el, hasta, ms = 800, fmt = v => String(Math.round(v))) {
    if (!MOV) { el.textContent = fmt(hasta); return; }
    const t0 = performance.now();
    const paso = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(k < 1 ? hasta * e : hasta); if (k < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }
  const DIA = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const BS = "font-family:'Big Shoulders Display',sans-serif;";
  const fd = s => { if (!s) return 'Por fijar'; const [y, m, d] = s.split('-').map(Number); return DIA[new Date(y, m - 1, d).getDay()] + ' ' + d + ' ' + MES[m - 1]; };
  const hoyISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const fdc = s => { if (!s) return '—'; const [, m, d] = s.split('-').map(Number); return d + ' ' + MES[m - 1]; };
  const dec = v => String(v).replace('.', ',');

  /* ── Estado: URL + localStorage (mp-nav-v1) ─────────────── */
  const KEY = 'mp-nav-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
  const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const S = Object.assign({ eq: null, lg: null, hist: [] }, load());
  // el historial de «← Volver», solo de esta pestaña: un enlace compartido no hereda el de otra visita
  const HKEY = KEY + '-hist', POS = {};   // POS: dónde estaba cada página al salir de ella, para volver al mismo sitio
  try { S.hist = JSON.parse(sessionStorage.getItem(HKEY) || '[]'); } catch (e) { S.hist = []; }
  if (!Array.isArray(S.hist)) S.hist = [];
  let A = null, H = null, hCargando = true;

  /* ── Utilidades de datos (idénticas al prototipo) ───────── */
  const ours = n => /^MADRIDPATINA/.test(n || '');
  // Escudo por nombre exacto; si no está (equipos de otras temporadas: LAS ROZAS B, KAMIKAZES C…), el de otro equipo del mismo club
  const clubDe = n => (n || '').replace(/ [A-Z]$/, '');
  let porClub = null;
  const crest = n => (A.crests[n] && A.crests[n].e) || (ours(n) ? 'escudos/badge/madridpatina.webp'
    : (porClub || (porClub = Object.fromEntries(Object.entries(A.crests).filter(([, c]) => c.e).map(([k, c]) => [clubDe(k), c.e]))))[clubDe(n)] || '');
  const abr = n => { if (!n) return ''; const w = n.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(' '); const suf = w.length > 1 && /^[A-Z]$/.test(w[w.length - 1]) ? ' ' + w[w.length - 1] : ''; return (w[0] === 'MADRIDPATINA' ? 'MP' : w[0].slice(0, 3)) + suf; };
  const lgOf = id => A.ligas.find(l => l.id === id);
  const teamOf = name => A.equipos.find(e => e.nombre === name);
  // Alevín e Infantil se llaman igual en la FMP («MADRIDPATINA»): en cantera el equipo sale de la liga de sus partidos
  const enEquipo = (p, e) => p.equipo === e.nombre && (!e.cantera || (p.partidos || []).some(x => x.mid.startsWith(e.ligaId + '-')));
  const equiposDe = p => A.equipos.filter(e => enEquipo(p, e));
  // Minutos de sanción del acta: 1,5 → 1'30''
  const fmin = m => { m = +m || 0; const e = Math.floor(m), sg = Math.round((m - e) * 60); return e + "'" + (sg ? String(sg).padStart(2, '0') + "''" : ''); };
  const titulo = s => (s || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
  const quienTxt = x => !x ? '' : !x.nombre ? (x.dorsal ? '#' + esc(x.dorsal) : '')
    : (A.jugadores[x.k] ? `<a href="${hP(x.k)}">#${esc(x.dorsal || '')} ${esc(corto(x))}</a>` : `#${esc(x.dorsal || '')} ${esc(corto(x))}`);
  const letraOf = e => e.cantera ? (e.id === 'AL' ? 'AL' : 'IN') : e.id;
  const tituloOf = e => e.cantera ? (e.id === 'AL' ? 'Alevín' : 'Infantil') : 'Equipo ' + e.id;
  const ini = (n, a) => ((n || '')[0] || '') + ((a || '')[0] || '');
  const kOf = (n, a) => (n + ' ' + a).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-');
  // Nombre + primer apellido, con sus partículas («Andrés Del Valle», «Rodrigo Del Horno»)
  const PART = new Set(['de', 'del', 'la', 'las', 'los', 'san', 'santa', 'y', 'el']);
  // con apodo aprobado, el apodo; real = true, siempre el nombre (plantilla, ficha, pretemporada)
  const corto = (p, real) => { if (!real) { const ap = apodoDe(p); if (ap) return ap; } const w = (p.apellidos || '').split(' ').filter(Boolean), o = [];
    for (const x of w) { o.push(x); if (!PART.has(x.toLowerCase()) || o.length === w.length) break; }
    return (p.nombre + ' ' + o.join(' ')).trim(); };

  /* ── Enlaces ────────────────────────────────────────────── */
  const hEq = id => '#/equipo/' + id;
  const hLg = (id, sub) => '#/liga/' + id + (sub ? '/' + sub : '');
  const hM = mid => mid && A.partidos[mid] ? '#/partido/' + encodeURIComponent(mid) : null;
  const hP = k => k && A.jugadores[k] ? '#/jugador/' + encodeURIComponent(k) : null;
  // foto y dorsal de cualquier jugador que salga en app.json, rivales incluidos (mapa.json no los trae). Solo adultos:
  // el generador no exporta fotos de menores y aquí se descarta además cualquier registro marcado «menor»
  let FK = null;
  const idxFK = () => { if (FK && FK.a === A) return FK; FK = { a: A, f: {}, d: {} };
    const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') {
      if (o.nombre && o.apellidos) { const k = kOf(o.nombre, o.apellidos); if (o.dorsal && !FK.d[k]) FK.d[k] = o.dorsal; if (o.foto && !o.menor && !FK.f[k]) FK.f[k] = o.foto; }
      Object.values(o).forEach(walk); } };
    walk(A); return FK; };
  const hT = name => { const t = teamOf(name); return t ? hEq(t.id) : null; };
  const hPre = id => '#/pretemporada/' + id;
  /* Bloque navegable: <a> si hay destino; si no, un contenedor normal */
  const box = (href, style, inner, tag = 'div', attrs = '') => href ? `<a class="blk" href="${href}"${attrs} style="${style}">${inner}</a>` : `<${tag}${attrs} style="${style}">${inner}</${tag}>`;
  // fotos y escudos: se descargan al acercarse a la pantalla (data-bg); los de la tira de un rodillo, todos a la vez
  const ponFondo = el => { if (el.dataset.bg) { el.style.backgroundImage = `url('${el.dataset.bg}')`; delete el.dataset.bg; } };
  const ioFondos = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting) return;
    const caja = en.target.closest('.rod-foto'); (caja ? [...caja.querySelectorAll('[data-bg]')] : [en.target]).forEach(x => { ponFondo(x); ioFondos.unobserve(x); }); }),
  { rootMargin: '600px 400px' }) : null;
  const fondos = root => (root.matches('[data-bg]') ? [root] : []).concat([...root.querySelectorAll('[data-bg]')]).forEach(el => (ioFondos ? ioFondos.observe(el) : ponFondo(el)));
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) fondos(n); }))).observe(document.body, { childList: true, subtree: true });
  const disc = (url, size, ring = '#FFFFFF', extra = '') => `<div class="disc"${url ? ` data-bg="${esc(url)}"` : ''} style="width:${size}px;height:${size}px;box-shadow:0 0 0 2px ${ring};${extra}"></div>`;
  const photo = (f, filter = 'grayscale(1)', pos = '50% 18%', extra = '', attrs = '') => f ? `<div class="ph" data-bg="${esc(f)}"${attrs} style="filter:${filter};background-position:${pos};${extra}"></div>` : '';
  const lab = (t, extra = '') => `<h2 class="lab" style="${extra}">${t}</h2>`;
  const flecha = d => d ? `<span data-anim="mpArrow .3s 1.2s" style="flex:none;font-size:11px;font-weight:800;color:${d > 0 ? '#3DD27E' : '#FF5A52'}"><span aria-hidden="true">${d > 0 ? '▲' + d : '▼' + -d}</span><span class="sr-only">${d > 0 ? 'sube' : 'baja'} ${Math.abs(d)} ${Math.abs(d) === 1 ? 'puesto' : 'puestos'}</span></span>` : '';
  // 7n · barra V/E/D por tramos (victorias → empates → derrotas) y el balance al final; filas en cascada
  const tramos = (h, i) => { const b0 = 150 + Math.min(i, 10) * 90;
    return { fila: ` data-anim="mpUp .35s ${b0}ms"`, bal: ` data-anim="mpFade .3s ${b0 + 1150}ms"`,
      barra: `<div data-anim="mpWipe .35s ${b0 + 200}ms" style="flex:${h.v};background:#1E8A4C;transform-origin:left"></div><div data-anim="mpWipe .25s ${b0 + 550}ms" style="flex:${h.e};background:#8A8A8F;transform-origin:left"></div><div data-anim="mpWipe .35s ${b0 + 800}ms" style="flex:${h.d};background:#55555B;transform-origin:left"></div>` }; };

  /* ── 1. Jornada ─────────────────────────────────────────── */


  /* ── Inicio (rediseño, fase 2) ─────────────────────────────────────────────────────────────────────────────────────
     Contesta «¿qué hay este fin de semana y cómo nos fue?». Cambia con el momento:
       · antes: los partidos que vienen (el primero en grande, con cuenta atrás), «En casa · ven a vernos» y debajo la semana;
       · en directo: solo los partidos en juego y lo que queda del fin de semana;
       · al acabar el último del fin de semana: la semana, arriba.
     Los terminados van al final del bloque, apagados. Un solo aviso de «pocos partidos» por bloque. */
  let PRON = null, pronP = null;
  const cargarPron = () => pronP || (pronP = fetch('data/pronosticos.json?v=' + verDatos()).then(r => r.json()).then(d => (PRON = d)).catch(() => { pronP = null; return null; }));
  // nombre y primer apellido, con un solo nombre de pila («Rafael Silva», «Andrés Del Valle»)
  const nomCorto = (p, real) => { if (!p) return ''; if (!real) { const ap = apodoDe(p); if (ap) return ap; } const w = (p.apellidos || '').split(' ').filter(Boolean), o = [];
    for (const x of w) { o.push(x); if (!PART.has(x.toLowerCase()) || o.length === w.length) break; }
    return ((p.nombre || '').split(' ')[0] + ' ' + o.join(' ')).trim(); };
  const fotoOK = j => !!(j && j.foto && !j.menor);
  // nuestros equipos: «MP A»… y en la cantera «MP Alevín» / «MP Infantil» (corto: «MP AL» / «MP IN»)
  const eqDeLiga = (n, ligaId) => A.equipos.find(e => e.nombre === n && e.ligaId === ligaId);
  const etqEq = (n, ligaId, cortito) => { const e = ours(n) && eqDeLiga(n, ligaId); return e ? (e.cantera ? (cortito ? 'MP ' + letraOf(e) : mpCorto(e)) : 'MP ' + e.id) : abr(n); };
  const largoEq = (n, ligaId) => { const e = ours(n) && eqDeLiga(n, ligaId); return e && e.cantera ? 'MADRIDPATINA ' + (e.id === 'AL' ? 'ALEVÍN' : 'INFANTIL') : n; };
  const slugEq = n => (n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // dirección de un partido que vale antes y después: #/partido/<liga>/<jornada>/<local>/<visitante>
  const hPar = (ligaId, j, local, vis) => '#/partido/' + ligaId + '/' + j + '/' + slugEq(local) + '/' + slugEq(vis);
  const pronDe = (ligaId, j, local, vis) => { const x = PRON && PRON[ligaId + '|' + j + '|' + local + '|' + vis]; if (!x) return null;
    const usL = ours(x.local), g = Math.round((usL ? x.pL : x.pV) * 100), pe = Math.round((usL ? x.pV : x.pL) * 100);
    return { x, g, pe, e: Math.max(0, 100 - g - pe), derbi: ours(x.local) && ours(x.visitante), poco: x.pj[0] < 4 || x.pj[1] < 4 }; };
  const casoHtml = (sec, tit, txt, chip, chipCls, enlaces) => `<div class="tarjeta caso"><div class="caso-c"><span class="etq">${esc(sec)}</span>${chip ? `<span class="chip ${chipCls || 'neutro'}">${esc(chip)}</span>` : ''}</div>
    <b class="caso-t">${esc(tit)}</b>${txt ? `<p>${esc(txt)}</p>` : ''}${enlaces && enlaces.length ? `<div class="caso-l">${enlaces.map(([t, h]) => `<a class="btn s" href="${h}">${esc(t)}</a>`).join('')}</div>` : ''}</div>`;
  const SKEL = (alto = 220) => `<div class="carga" role="status" aria-label="Cargando"><div class="sk" style="height:${alto}px;margin-top:24px"></div><div class="sk" style="height:120px"></div></div>`;
  const barraPron = P => `<div class="bpron" aria-hidden="true" data-dib data-bx><i style="width:${P.g}%"></i><i class="pen" style="width:${P.e}%"></i><i class="riv" style="width:${P.pe}%"></i></div>`;
  const tsDe = (fecha, hora) => { const [y, m, d] = fecha.split('-').map(Number), [hh, mm] = (hora || '00:00').split(':').map(Number); return new Date(y, m - 1, d, hh, mm).getTime(); };
  const dia0 = fecha => { const [y, m, d] = fecha.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
  const isoT = t => { const d = new Date(t); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  // cuenta atrás DÍAS · HORAS · MIN (sin hora fijada, solo los días); el bloque de los minutos, en rojo
  function cifrasCA(x) {
    if (!x.hora) return [['DÍAS', p2(Math.max(0, Math.round((dia0(x.fecha) - dia0(hoyISO())) / 864e5)))]];
    let s = Math.max(0, Math.floor((x.ts - Date.now()) / 1000)); const d = Math.floor(s / 86400); s %= 86400;
    return [['DÍAS', p2(d)], ['HORAS', p2(Math.floor(s / 3600))], ['MIN', p2(Math.floor(s % 3600 / 60))]];
  }
  const cuentaHtml = (x, cls = '') => `<div class="ca ${cls}" data-ca="${x.ts}" data-ca-dia="${x.hora ? '' : x.fecha}">${cifrasCA(x).map(([l, v], i) => `<div class="ca-b${l === 'MIN' ? ' min' : ''}"><div class="ca-n"><span>${v}</span></div><span class="ca-l">${l}</span></div>`).join('')}</div>`;
  const faltaTxt = x => { if (!x.hora) return [Math.max(0, Math.round((dia0(x.fecha) - dia0(hoyISO())) / 864e5)) + ' d', 'hora por fijar'];
    const ms = Math.max(0, x.ts - Date.now()), d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), mi = Math.floor(ms % 36e5 / 6e4);
    return [d ? d + ' d ' + h + ' h' : h + ' h ' + mi + ' min', 'para empezar']; };
  // cada minuto, justo al cambiar de minuto: solo cae el bloque que cambia (con «reducir movimiento», cambia sin caer)
  function tickCuentas() {
    let empezado = false;
    document.querySelectorAll('[data-ca]').forEach(el => {
      const x = { ts: +el.dataset.ca, hora: el.dataset.caDia ? null : '1', fecha: el.dataset.caDia || isoT(+el.dataset.ca) };
      if (x.hora && x.ts <= Date.now() && !el.dataset.cero) { el.dataset.cero = '1'; empezado = true; }
      cifrasCA(x).forEach(([, v], i) => { const n = el.children[i] && el.children[i].querySelector('.ca-n > span'); if (n && n.textContent !== v) { n.textContent = v; if (MOV) repetir(n, 'mpTick .35s cubic-bezier(.2,.8,.2,1)'); } });
    });
    document.querySelectorAll('[data-falta]').forEach(el => { const ts = +el.dataset.falta; if (!ts) return; const [a] = faltaTxt({ ts, hora: '1' }); if (el.textContent !== a) el.textContent = a; });
    if (empezado && esInicio(location.hash)) render();   // ha empezado un partido: deja la cuenta atrás
    setTimeout(tickCuentas, 60000 - Date.now() % 60000 + 50);
  }
  setTimeout(tickCuentas, 60000 - Date.now() % 60000 + 50);

  // ── nuestros partidos de la temporada (un derbi, una vez), con su pista (agenda) y su estado según el directo ──
  function partidosNuestros() {
    const age = {}; (AGE ? AGE.partidos : []).forEach(m => { age[m.eq + '|' + m.j] = m; });
    const vistos = {}, out = [];
    A.equipos.forEach(e => (e.cal || []).forEach(c => {
      if (!c.fecha || c.descanso) return;
      const local = c.casa ? e.nombre : c.rival, vis = c.casa ? c.rival : e.nombre, k = e.ligaId + '|' + c.j + '|' + local + '|' + vis;
      if (vistos[k]) return; vistos[k] = 1;
      const ag = age[e.id + '|' + c.j] || {};
      const otro = c.derbi ? A.equipos.find(x => x.ligaId === e.ligaId && x.nombre === c.rival) : null;
      out.push({ k, e, otro, ligaId: e.ligaId, L: lgOf(e.ligaId), j: c.j, fecha: c.fecha, hora: c.hora || null, ts: tsDe(c.fecha, c.hora || '23:59'), local, vis, casa: c.casa, derbi: !!c.derbi,
        mid: c.mid, resultado: c.resultado, pista: ag.pista || null, habitual: !!ag.habitual });
    }));
    return out.sort((a, b) => a.ts - b.ts);
  }
  // el directo de un partido (en juego o terminado hoy), por liga, jornada y equipos
  function snapDe(m) {
    for (const sn of Object.values(LIVE.snaps)) { const r = enCalendario(sn); if (r && r.L.id === m.ligaId && r.c.j === m.j && r.local === m.local && r.vis === m.vis) return sn; }
    return null;
  }
  // el fin de semana que toca: el de la semana en curso si aún tiene partidos por jugar o en juego; si no, el siguiente con partidos
  function findeInicio() {
    const todos = partidosNuestros(), hoy = hoyISO(), ahora = Date.now();
    const d = new Date(), lun = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7), dom = new Date(lun.getFullYear(), lun.getMonth(), lun.getDate() + 6);
    const lunISO = isoT(lun.getTime()), domISO = isoT(dom.getTime());
    const estado = m => { const sn = snapDe(m);
      if (sn && (sn.estado === 'directo' || sn.estado === 'descanso')) return ['vivo', sn];
      if (m.resultado || (sn && sn.estado === 'final')) return ['fin', sn];
      if (m.fecha < hoy || (m.hora && m.ts < ahora - 3 * 36e5)) return ['pendiente', sn];   // ya pasó y la FMP aún no da el resultado
      if (m.hora && m.ts <= ahora) return ['ya', sn];   // ha empezado y el directo aún no lo trae
      return ['por', sn]; };
    const conEstado = ms => ms.map(m => { const [st, sn] = estado(m); return Object.assign({}, m, { st, sn }); });
    const semana = conEstado(todos.filter(m => m.fecha >= lunISO && m.fecha <= domISO));
    const quedan = semana.some(m => m.st === 'por' || m.st === 'vivo' || m.st === 'ya');
    let lista = semana, titulo = 'ESTE FIN DE SEMANA', momento = 'antes';
    if (!quedan) {
      if (semana.length) momento = 'fin';   // el fin de semana ya se jugó entero: la semana, arriba
      const sig = todos.find(m => m.fecha > domISO && !m.resultado);
      if (sig) { const f = new Date(dia0(sig.fecha)), l2 = new Date(f.getFullYear(), f.getMonth(), f.getDate() - (f.getDay() + 6) % 7), d2 = new Date(l2.getFullYear(), l2.getMonth(), l2.getDate() + 6);
        lista = conEstado(todos.filter(m => m.fecha >= isoT(l2.getTime()) && m.fecha <= isoT(d2.getTime())));
        titulo = (dia0(isoT(l2.getTime())) - lun.getTime()) / 864e5 <= 7 ? 'EL PRÓXIMO FIN DE SEMANA' : 'PRÓXIMOS PARTIDOS'; }
      else lista = [];
    }
    if (lista.some(m => m.st === 'vivo')) momento = 'directo';
    const orden = { vivo: 0, ya: 1, por: 1, pendiente: 2, fin: 3 };
    lista.sort((a, b) => orden[a.st] - orden[b.st] || a.ts - b.ts);
    const f0 = lista.length ? lista.reduce((a, m) => (m.fecha < a ? m.fecha : a), '9') : null, f1 = lista.length ? lista.reduce((a, m) => (m.fecha > a ? m.fecha : a), '0') : null;
    return { lista, titulo, momento, rango: f0 ? fd(f0) + (f1 !== f0 ? ' – ' + fd(f1) : '') : '', semanaJugada: momento === 'fin' ? semana : [] };
  }

  // ── tarjetas del fin de semana ──
  const escudo = (n, size, cls = '') => `<span class="esc ${cls}"${size ? ` style="width:${size}px;height:${size}px"` : ''}${crest(n) ? ` data-bg="${esc(crest(n))}"` : ''}></span>`;
  function heroHtml(m) {
    const P = m.derbi ? null : pronDe(m.ligaId, m.j, m.local, m.vis);
    const chips = m.derbi ? '<span class="chip derbi">DERBI</span>' : '';   // en casa: la estrella junto a nuestro nombre
    const nom = n => `<span class="hero-n${ours(n) ? ' mp' : ''}">${m.casa && n === m.local && ours(n) ? casaMarca() : ''}${esc(largoEq(n, m.ligaId))}</span>`;
    return `<a class="hero tarjeta" href="${hPar(m.ligaId, m.j, m.local, m.vis)}">
      <div class="hero-cab"><span class="hero-liga">${esc((m.L && m.L.corto) || '')}</span><span class="hero-chips">${chips}</span></div>
      <div class="hero-cuerpo">
        <div class="hero-eq"><div class="hero-escs">${escudo(m.local, 0, 'g')}${escudo(m.vis, 0, 'g')}</div><div class="hero-nombres">${nom(m.local)}<span class="hero-vs">VS</span>${nom(m.vis)}</div></div>
        <div class="hero-ca"><span class="etq">${m.hora ? 'Empieza en' : 'Faltan · hora por fijar'}</span>${cuentaHtml(m, 'grande')}</div>
      </div>
      ${P ? `<div class="hero-pron">${barraPron(P)}<div class="hero-pron-t">Ganamos el ${P.g} % de las veces · penaltis ${P.e} %</div></div>` : ''}
      <div class="hero-pie"><span>${esc(fd(m.fecha))} · ${esc(m.hora || 'hora por fijar')}${m.pista ? ' · ' + esc(m.pista) : ''}</span><span class="ir">Previa</span></div>
    </a>`;
  }
  function filaFinde(m) {
    const fin = m.st === 'fin' || m.st === 'pendiente', P = m.derbi || fin ? null : pronDe(m.ligaId, m.j, m.local, m.vis);
    // rediseño final: sin «EN CASA» ni fondo rojo en la lista (lo de casa ya va en «En casa · ven a vernos»)
    const chips = m.st === 'pendiente' ? '<span class="chip ambar">ACTA PENDIENTE</span>' : fin ? '<span class="chip neutro">FINAL</span>' : m.derbi ? '<span class="chip derbi">DERBI</span>' : '';
    const lado = n => `${escudo(n, 28)}<span class="ff-n${ours(n) && !fin ? ' mp' : ''}">${m.casa && !fin && n === m.local && ours(n) ? casaMarca() : ''}${esc(etqEq(n, m.ligaId, true))}</span>`;
    let der;
    if (m.st === 'fin') {
      const sn = m.sn, [gl, gv] = sn && sn.estado === 'final' && !m.resultado ? [sn.gl || 0, sn.gv || 0] : m.resultado ? (([a, b]) => (m.casa ? [a, b] : [b, a]))(m.resultado.split('-').map(Number)) : [0, 0];
      const vid = sn && VID && VID[sn.idp], href = vid ? '#/video/' + encodeURIComponent(sn.idp) : sn ? '#/directo/' + encodeURIComponent(sn.idp) + '/resumen' : null;
      const pz = gl === gv ? (sn && sn.penaltis && sn.penaltis.ganador) || (m.mid && A.partidos[m.mid] && A.partidos[m.mid].pen ? (A.partidos[m.mid].pen === m.local ? 'L' : 'V') : null) : null;
      der = `<span class="ff-res">${gl}${pz === 'L' ? '<span class="b-pen">B</span>' : ''}–${gv}${pz === 'V' ? '<span class="b-pen">B</span>' : ''}</span><span class="ff-l">${href ? '▶ Ver resumen' : 'Ver partido'}</span>`;
    } else if (m.st === 'pendiente') der = `<span class="ff-res">—</span><span class="ff-l">sin resultado aún</span>`;
    else if (m.st === 'ya') der = `<span class="ff-falta">Ha empezado</span><span class="ff-l">aún sin datos del acta</span>`;
    else { const [a, b] = faltaTxt(m); der = `<span class="ff-falta"${m.hora ? ` data-falta="${m.ts}"` : ''}>${a}</span><span class="ff-l">${b}</span><span class="ff-previa">PREVIA</span>`; }
    const href = m.mid && A.partidos[m.mid] ? hM(m.mid) : hPar(m.ligaId, m.j, m.local, m.vis);
    return `<a class="ff${fin ? ' fin' : ''}" href="${href}">
      <div class="ff-t"><div class="ff-cuando"><span>${esc(fd(m.fecha))} · ${esc(m.hora || 'hora por fijar')}</span>${chips}</div><div class="ff-eqs">${lado(m.local)}<span class="ff-g">vs</span>${lado(m.vis)}</div></div>
      <div class="ff-p">${P ? `<span class="ff-pct">${P.g}%</span><span class="ff-l">ganar</span>` : ''}</div>
      <div class="ff-f">${der}</div></a>`;
  }
  // ── en directo (rediseño final): tarjeta compacta que lleva al directo; parte y reloj, los dos equipos con sus goles,
  // barra de lo jugado y el último gol o sanción. En el escritorio, dos en paralelo ──
  function vivoHtml(m) {
    const sn = m.sn, ctx = ctxDirecto(sn), dur = ctx.dur || (m.L && m.L.cantera ? 1200 : 1500), tot = 2 * dur;
    const abs = e => (e.periodo - 1) * dur + (segs(e.t) || 0);
    const evs = (sn.eventos || []).filter(e => e.periodo && e.t != null).sort((a, b) => abs(a) - abs(b));
    const gl = sn.gl || 0, gv = sn.gv || 0, desc = sn.estado === 'descanso';
    const t = Math.min(tot, Math.max(desc ? dur : 0, ...evs.map(abs)));
    const nombreDe = (e, lado) => { const p = jugadorMP(ctx, lado, e.dorsal); return p ? nomCorto(p) : e.jugador_corto || e.jugador || (e.dorsal ? '#' + e.dorsal : ''); };
    const ult = evs.filter(e => e.tipo === 'GOL' || (e.tipo === 'FALTA' && e.min_sancion)).pop();
    let pie;
    if (!ult) pie = '<b>SE JUEGA</b> · Todavía sin goles';
    else { const gol = ult.tipo === 'GOL', quien = nombreDe(ult, ult.lado);
      pie = `<b class="${gol ? (ctx.mp[ult.lado] ? 'nos' : 'gol') : 'sanc'}">${gol ? 'GOL' : 'SANCIÓN'} ${Math.max(1, Math.ceil(abs(ult) / 60))}'</b> · ${esc((quien ? quien + ' · ' : '') + ctx.abr[ult.lado])}`; }
    const fila = (L, n, g, o) => `<div class="vc-eq">${escudo(n, 32)}<span class="vc-n${ours(n) ? ' mp' : ''}"><span class="nm-largo">${esc(largoEq(n, m.ligaId))}</span><span class="nm-corto">${esc(ctx.abr[L])}</span></span>
      <span class="vc-g${g > o && ctx.mp[L] && !(ctx.mp.L && ctx.mp.V) ? ' gana' : ''}" data-vv-g="${esc(sn.idp)}-${L}"><span>${g}</span></span></div>`;
    return `<a class="vc tarjeta" href="#/directo/${encodeURIComponent(sn.idp)}" data-vivo-card="${esc(sn.idp)}">
      <div class="vc-cab"><div class="vc-est"><i class="punto"></i><span class="vc-parte${desc ? ' desc' : ''}">${desc ? 'DESCANSO' : esc(ordinal(sn.periodo || 1).replace('ª', '.ª').toUpperCase()) + ' PARTE'}</span><span class="vc-liga">${esc((m.L && m.L.corto) || '')}</span></div>
        <span class="vc-reloj${desc ? ' desc' : ''}">${desc ? dur / 60 + ':00' : esc(relojDe(sn) || minEst(sn))}</span></div>
      <div class="vc-eqs">${fila('L', m.local, gl, gv)}${fila('V', m.vis, gv, gl)}</div>
      <div class="vc-prog"><i style="width:${(t / tot * 100).toFixed(1)}%"></i></div>
      <div class="vc-pie"><span class="vc-ult">${pie}</span><span class="vc-seguir">Seguir<span class="nm-largo"> el directo</span> ›</span></div>
    </a>`;
  }
  const tgHtml = `<a class="tg-pil" href="${TELEGRAM}" target="_blank" rel="noopener"><span class="tg-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21.5 3.6 2.9 10.8c-1.3.5-1.3 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.4l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.8-1.4-1.5zM9.6 14.4l-.4 4-1.4-4.6 9.6-6.1-7.8 6.7z"/></svg></span><span>Canal de Telegram de eventos en directo</span></a>`;
  // estrella de 12 puntas de «en casa» (gira despacio; quieta con «reducir movimiento»)
  const ESTRELLA = '<svg viewBox="-10 -10 20 20" aria-hidden="true"><polygon points="' + Array.from({ length: 24 }, (_, i) => { const r = i % 2 ? 4.2 : 10, a = i * Math.PI / 12 - Math.PI / 2; return (r * Math.cos(a)).toFixed(2) + ',' + (r * Math.sin(a)).toFixed(2); }).join(' ') + '"/></svg>';
  // marca de «jugamos en casa» junto a nuestro equipo (sustituye a la etiqueta EN CASA en Inicio y en el Calendario)
  const casaMarca = () => `<span class="casa-m" role="img" aria-label="En casa" title="En casa">${ESTRELLA}</span>`;
  // ── en casa · ven a vernos: los días que jugamos en casa en ese fin de semana, con todos los partidos de la pista ──
  function casaHtml(F) {
    if (!AGE || !F.lista.length) return '';
    const fechas = new Set(F.lista.filter(m => m.st === 'por').map(m => m.fecha));
    return AGE.dias.filter(d => d.casa && fechas.has(d.fecha)).map(d => {
      const vis = {}, filas = [];
      d.nuestros.map(i => AGE.partidos[i]).filter(Boolean).forEach(q => { const k = q.local + q.visitante + q.hora; if (vis[k]) return; vis[k] = 1;
        // en la cantera los dos equipos se llaman «MADRIDPATINA»: el nombre sale de la categoría
        const largo = n => (n === 'MADRIDPATINA' ? 'MP ' + (q.eq === 'AL' ? 'Alevín' : 'Infantil') : n), cortoN = n => (n === 'MADRIDPATINA' ? largo(n) : abr(n));
        const db = ours(q.local) && ours(q.visitante), usL = ours(q.local), us = usL ? q.local : q.visitante, th = usL ? q.visitante : q.local;
        filas.push({ hora: q.hora || '—', liga: (db ? 'Derbi · ' : '') + q.liga, nuestro: true, derbi: db, us: largo(us), them: db ? largo(th) : th, quien: db ? cortoN(us) + ' y ' + cortoN(th) : cortoN(us) }); });
      d.otros.filter(o => o.visitante !== 'DESCANSO').forEach(o => filas.push({ hora: o.hora || '—', liga: o.liga, nuestro: false, us: o.local, them: o.visitante }));
      filas.sort((a, b) => a.hora.localeCompare(b.hora));
      const ns = filas.filter(x => x.nuestro);
      // todos los nuestros del día en esa pista: «Ven a las 16:15 y quédate: a las 17:45 juega MP C y a las 19:15, MP D.»
      const luego = ns.slice(1).map((x, i) => i ? `a las ${x.hora}, ${x.quien}` : `a las ${x.hora} ${x.derbi ? 'juegan' : 'juega'} ${x.quien}`);
      const frase = ns.length > 1 ? `Ven a las ${ns[0].hora} y quédate: ${luego.length > 1 ? luego.slice(0, -1).join(', ') + ' y ' + luego[luego.length - 1] : luego[0]}.` : `Ven a vernos a las ${(ns[0] || filas[0]).hora}.`;
      return `<section class="vernos">
        <div class="casa-cab"><span class="etq">En casa · ven a vernos</span><div class="casa-tit"><span class="h2">${esc(fdLarga(d.fecha).toUpperCase())}</span><span class="casa-pista">${esc(d.pista || '')}</span></div></div>
        <div class="casa-linea" style="--n:${filas.length}">${filas.map(t => `<div class="casa-t${t.nuestro ? ' mp' : ''}">
          <span class="casa-h">${esc(t.hora)}</span><span class="casa-estr">${ESTRELLA}</span>
          <span class="casa-us">${esc(t.us)}</span><span class="casa-vs"><span class="${t.derbi ? 'chip derbi' : 'vs'}">${t.derbi ? 'DERBI' : 'vs'}</span><span>${esc(t.them)}</span></span><span class="casa-liga">${esc(t.liga)}</span></div>`).join('')}</div>
        <div class="casa-frase">${esc(frase)}</div></section>`;
    }).join('');
  }
  const fdLarga = s => { const [y, m, d] = s.split('-').map(Number); return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][new Date(y, m - 1, d).getDay()] + ' ' + d + ' de ' + ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][m - 1]; };

  // ── la semana: una tarjeta por equipo con el resultado y la clasificación (el detalle, al tocar el partido) ──
  // racha: los últimos 5 resultados hasta esa fecha (los penaltis cuentan para quien ganó la tanda) y, si gana seguido, cuántas
  function rachaDe(e, hasta) {
    const rs = (e.cal || []).filter(c => c.resultado && c.fecha && c.fecha <= hasta).slice(-5).map(c => {
      if (c.r !== 'E') return c.r; const pz = c.mid && A.partidos[c.mid] && A.partidos[c.mid].pen; return pz ? (pz === e.clas.equipo ? 'V' : 'D') : null; }).filter(Boolean);
    if (rs.length < 2) return '';
    let k = 0; for (let i = rs.length - 1; i >= 0 && rs[i] === 'V'; i--) k++;
    return `<div class="sem-racha"><span class="pv-res">${rs.map(r => `<span class="res-l ${r.toLowerCase()}">${r}</span>`).join('')}</span>${k >= 2 ? `<span>${k} victorias seguidas</span>` : ''}</div>`;
  }
  const TONO = l => (/^senior-2/.test(l) ? 'tono-s2' : /^senior/.test(l) ? 'tono-s4' : 'tono-cant');
  const fotoDe = (nombre, apellidos) => { const j = A.jugadores[kOf(nombre || '', apellidos || '')]; return fotoOK(j) ? j.foto : null; };
  function semanaHtml(wi) {
    const w = A.semanas[wi], wp = A.semanas[wi + 1]; if (!w) return '';
    const Rs = w.resumen || {}, ganada = n => n.partido && (n.partido.resultado === 'victoria' || (n.partido.resultado === 'empate' && n.partido.penaltis === true));
    const v = w.nuestros.filter(ganada).length, d = w.nuestros.filter(n => n.partido && !ganada(n)).length;
    const gfPct = Rs.goles_a_favor + Rs.goles_en_contra ? Rs.goles_a_favor / (Rs.goles_a_favor + Rs.goles_en_contra) * 100 : 0;
    const vistos = {}, cards = [];
    w.nuestros.forEach(n => {
      const e = eqDeLiga(n.equipo, n.liga_id) || {}, p = n.partido, derbi = !!(p && ours(p.rival));
      const mp = p && Object.values(A.partidos).find(x => x.nuestro && x.liga === n.liga_id && x.fecha === p.fecha && (x.local === n.equipo || x.visitante === n.equipo));
      if (mp && vistos[mp.mid]) return; if (mp) vistos[mp.mid] = 1;
      const c0 = n.clasificacion, c1 = wp && wp.nuestros.find(x => x.equipo === n.equipo && x.liga_id === n.liga_id), b1 = c1 && c1.clasificacion, dp = c0 && b1 ? b1.puesto - c0.puesto : 0;
      const L = lgOf(n.liga_id) || {};
      let letra = 'MP ' + (e.cantera ? letraOf(e) : e.id), chip, score, rival, rivalCrest, donde, puesto, mov = '', dest = p && p.destacado, puestos = c0 ? [c0.puesto] : [];
      if (derbi && mp) {
        const eL = eqDeLiga(mp.local, n.liga_id) || {}, eV = eqDeLiga(mp.visitante, n.liga_id) || {};
        const cl = nn => { const z = w.nuestros.find(x => x.equipo === nn && x.liga_id === n.liga_id); return z && z.clasificacion ? z.clasificacion : null; };
        letra = 'MP ' + eL.id + ' · MP ' + eV.id; chip = '<span class="chip derbi">DERBI</span>';
        score = mp.gl + (mp.pen === mp.local ? '<span class="b-pen">B</span>' : '') + '–' + mp.gv + (mp.pen === mp.visitante ? '<span class="b-pen">B</span>' : '');
        rival = 'MP ' + eL.id + ' – MP ' + eV.id; rivalCrest = 'MADRIDPATINA'; donde = fd(mp.fecha) + ' · ' + (L.corto || '');
        puesto = [[eL, cl(mp.local)], [eV, cl(mp.visitante)]].map(([x, z]) => 'MP ' + x.id + ' ' + (z ? z.puesto + 'º' : '–')).join(' · ');
        puestos = [cl(mp.local), cl(mp.visitante)].filter(Boolean).map(z => z.puesto);
        const ds = [mp.local, mp.visitante].map(nn => w.nuestros.find(x => x.equipo === nn && x.liga_id === n.liga_id)).filter(x => x && x.partido && x.partido.destacado).map(x => x.partido.destacado);
        dest = ds.sort((a, b) => (b.goles * 2 + b.asistencias) - (a.goles * 2 + a.asistencias))[0] || null;
      } else if (p) {
        chip = ganada(n) ? '<span class="chip v">VICTORIA</span>' : '<span class="chip d">DERROTA</span>';
        score = p.goles_nuestros + (p.penaltis === true ? '<span class="b-pen">B</span>' : '') + '–' + p.goles_rival + (p.penaltis === false ? '<span class="b-pen">B</span>' : '');
        rival = p.rival; rivalCrest = p.rival; donde = (p.en_casa ? 'En casa' : 'Fuera') + ' · ' + fd(p.fecha);
        puesto = c0 ? c0.puesto + 'º de ' + c0.de + ' · ' + c0.pts + ' pts' : '';
        mov = `<span class="sem-mov ${dp > 0 ? 'sube' : dp < 0 ? 'baja' : ''}">${dp > 0 ? '▲ ' + dp : dp < 0 ? '▼ ' + -dp : '='}</span>`;
      } else {
        chip = `<span class="chip neutro">${n.descansa ? 'DESCANSA' : 'SIN PARTIDO'}</span>`; score = '—';
        puesto = c0 ? c0.puesto + 'º de ' + c0.de + ' · ' + c0.pts + ' pts' : '';
      }
      const dots = c0 ? Array.from({ length: c0.de }, (_, k) => `<i${puestos.includes(k + 1) ? ' class="on"' : ''}></i>`).join('') : '';
      const df = dest ? fotoDe(dest.nombre, dest.apellidos) : null;
      const destHtml = dest ? `<div class="sem-dest">${df ? `<div class="ph" data-bg="${esc(df)}"></div>` : `<span class="sem-ini">${esc(ini(dest.nombre, dest.apellidos))}</span>`}
        <div class="sem-dest-t"><span>DESTACADO</span><b>${esc(nomCorto(dest))}</b><span>${[dest.goles ? dest.goles + (dest.goles === 1 ? ' gol' : ' goles') : '', dest.asistencias ? dest.asistencias + ' asist.' : ''].filter(Boolean).join(' · ')}</span></div></div>` : '';
      cards.push({ lid: n.liga_id, conDest: !!dest, derbi, html: `<a class="sem-c ${TONO(n.liga_id)}${dest ? ' con-dest' : ''}" href="${mp ? hM(mp.mid) : hEq(e.id)}">
        <div class="sem-in"><span class="sem-liga">${esc((L.corto || '').toUpperCase())}</span>
          <div class="sem-l"><span class="sem-letra">${esc(letra)}</span>${chip}</div>
          <div class="sem-score${p ? '' : ' vacio'}">${score}</div>
          ${rival ? `<div class="sem-riv">${escudo(rivalCrest, 28)}<div><b>${esc(rival)}</b><span>${esc(donde)}</span></div></div>` : '<div class="sem-riv"></div>'}
          ${derbi || !e.clas ? '' : rachaDe(e, w.hasta)}<div class="sem-pie"><div class="sem-pt"><span>${esc(puesto)}</span>${mov}</div><div class="sem-dots">${dots}</div></div></div>${destHtml}</a>` });
    });
    // filas sin huecos: en escritorio de 3 en 3; en el móvil de 2 en 2, y a lo ancho el derbi y las que llevan destacado
    const grupo = l => (/^senior-2/.test(l) ? 0 : /^senior/.test(l) ? 1 : 2);
    cards.sort((a, b) => grupo(a.lid) - grupo(b.lid));
    const spans = (por, cols, entera) => { const rows = []; let cur = []; cards.forEach(c => { if (entera(c)) { if (cur.length) rows.push(cur); rows.push([c]); cur = []; return; } cur.push(c); if (cur.length === por) { rows.push(cur); cur = []; } }); if (cur.length) rows.push(cur);
      const m = new Map(); rows.forEach(r => r.forEach(c => m.set(c, cols / r.length))); return m; };
    const sd = spans(3, 6, () => false), sm = spans(2, 2, c => c.derbi || c.conDest);
    const num = w.id.split('S')[1], ant = A.semanas[wi + 1], sig = A.semanas[wi - 1];
    const flecha = (sem, dir) => sem ? `<a class="sem-flecha" href="#/inicio/${sem.id}" aria-label="Semana ${dir < 0 ? 'anterior' : 'siguiente'}">${FLECHA_SEM[dir < 0 ? 0 : 1]}</a>` : `<span class="sem-flecha off" aria-hidden="true">${FLECHA_SEM[dir < 0 ? 0 : 1]}</span>`;
    return `<section class="sem" id="semana">
      <div class="sem-cab"><div class="sem-tit">${flecha(ant, -1)}<h2 class="sem-h">SEMANA <span>${esc(num)}</span></h2>${flecha(sig, 1)}<div class="sem-rango"><span>${esc(fd(w.desde))}</span><span>${esc(fd(w.hasta))}</span></div></div>
        <div class="sem-kpis"><div><span>Partidos</span><b>${Rs.partidos || 0}</b></div><div class="vd"><div><span>V</span><b class="v">${v}</b></div><div><span>D</span><b class="d">${d}</b></div></div>
          <div><span>Goles</span><b>${Rs.goles_a_favor || 0}–${Rs.goles_en_contra || 0}</b><i style="--w:${gfPct.toFixed(1)}%"></i></div></div></div>
      <div class="sem-grid">${cards.map(c => c.html.replace('<a class="sem-c ', `<a style="--sd:span ${sd.get(c)};--sm:span ${sm.get(c)}" class="sem-c ${sm.get(c) === 2 ? 'ancha-m ' : ''}${sd.get(c) >= 3 ? 'ancha-d ' : ''}`)).join('')}</div>
    </section>`;
  }
  const FLECHA_SEM = ['<svg viewBox="0 0 12 40" preserveAspectRatio="none"><polyline points="10,2 2,20 10,38"/></svg>', '<svg viewBox="0 0 12 40" preserveAspectRatio="none"><polyline points="2,2 10,20 2,38"/></svg>'];

  // ── lo mejor de la semana (tragaperras): portero/a, goleador/a, asistencias y sanciones del club ──
  function mejorHtml(wi) {
    const w = A.semanas[wi]; if (!w) return '';
    const ps = Object.values(A.partidos).filter(p => p.nuestro && p.fecha >= w.desde && p.fecha <= w.hasta);
    let por = null, fig = null; const tot = {}, pool = [];
    ps.forEach(p => [['local', 'gol_l', 'por_l', 'alin_l', 'visitante'], ['visitante', 'gol_v', 'por_v', 'alin_v', 'local']].forEach(([sd, g, pk, al, o]) => {
      if (!ours(p[sd])) return; const eq = etqEq(p[sd], p.liga, true);
      (p[pk] || []).forEach(x => { if (x.tiros >= 10 && (!por || x.pct > por.pct)) por = Object.assign({}, x, { eq, rival: p[o] }); });
      (p[g] || []).forEach(x => { if (!fig || x.g > fig.g || (x.g === fig.g && x.a > fig.a)) fig = Object.assign({}, x, { eq, rival: p[o] }); });
      (p[al] || []).forEach(x => { if (!pool.find(y => y.k === x.k)) pool.push(x); const t = tot[x.k] || (tot[x.k] = Object.assign({}, x, { g: 0, a: 0, pim: 0, eq }));
        t.g += x.g || 0; t.a += x.a || 0; t.pim += x.pim || 0; });
    }));
    const asis = Object.values(tot).filter(x => x.a).sort((a, b) => b.a - a.a || b.g - a.g)[0];
    const sanc = Object.values(tot).filter(x => x.pim).sort((a, b) => b.pim - a.pim)[0];
    const fem = x => (A.jugadores[x.k] || x).fem;
    const cards = [];
    if (por) cards.push({ x: por, cls: 'rojo', tit: fem(por) ? 'PORTERA DE LA SEMANA' : 'PORTERO DE LA SEMANA', valor: por.pct, fmt: 'pct', texto: dec(por.pct.toFixed(1)), suf: '%', det: por.par + ' paradas de ' + por.tiros });
    if (fig) cards.push({ x: fig, cls: 'gol', tit: fem(fig) ? 'GOLEADORA DEL CLUB' : 'GOLEADOR DEL CLUB', valor: fig.g, fmt: 'int', texto: String(fig.g), det: (fig.g === 1 ? 'gol' : 'goles') + ' · ' + fig.a + ' asist.' });
    if (asis) cards.push({ x: asis, cls: '', tit: 'MÁS ASISTENCIAS', valor: asis.a, fmt: 'int', texto: String(asis.a), det: (asis.a === 1 ? 'asistencia' : 'asistencias') + ' · ' + asis.g + (asis.g === 1 ? ' gol' : ' goles') });
    if (sanc) cards.push({ x: sanc, cls: 'sanc', tit: fem(sanc) ? 'MÁS SANCIONADA' : 'MÁS SANCIONADO', valor: sanc.pim, fmt: 'min', texto: fmin(sanc.pim), det: 'de sanción' });
    if (!cards.length) return '';
    const fotoJ = x => { const j = A.jugadores[x.k] || x; return fotoOK(j) ? j.foto : null; }, corta = vistoSes('traga');
    const html = cards.map((c, i) => {
      const dur = Math.round((2600 + i * 450) * (corta ? .35 : 1)), otros = pool.filter(y => y.k !== c.x.k), g0 = otros.length ? (i * 3) % otros.length : 0, base6 = otros.slice(g0).concat(otros.slice(0, g0)).slice(0, 6);
      const tira = base6.concat(base6, [c.x]);
      const item = j => { const f = fotoJ(j); return `<div class="ini rod-item">${esc(ini(j.nombre, j.apellidos))}${f ? `<div class="ph" data-bg="${esc(f)}" data-anim="mpReelBlur ${dur}ms" style="background-position:50% 20%;filter:grayscale(1)"></div>` : ''}</div>`; };
      const h = hP(c.x.k), abre = h ? `<a class="mej ${c.cls}" href="${h}" data-rodillo data-grupo>` : `<div class="mej ${c.cls}" data-rodillo data-grupo>`;
      return abre + `<div class="rod-foto" aria-hidden="true"><div class="rod-tira" data-anim="mpReel ${dur}ms cubic-bezier(.12,.55,.18,1)">${tira.map(item).join('')}</div>
          <div class="rod-sombra" data-anim="mpFade .5s ${dur}ms reverse"></div><div class="rod-flash" data-anim="mpLand .6s ${dur}ms"></div></div>
        <div class="mej-t"><div class="etq">${c.tit}</div>
          <div class="rod-txt"><div class="mej-n">${esc(nomCorto(c.x))}</div><div class="mej-s">${esc((c.x.dorsal ? c.x.dorsal + ' · ' : '') + c.x.eq)}</div></div>
          <div class="rod-num mej-v"><span class="cifra"><span data-cuenta="${c.valor}" data-fmt="${c.fmt}">${esc(c.texto)}</span>${c.suf ? `<span class="suf">${c.suf}</span>` : ''}</span><span class="mej-d">${esc(c.det)}</span></div></div>` + (h ? '</a>' : '</div>');
    }).join('');
    return `<section class="mejor"><h2 class="h2">Lo mejor de la semana</h2><div class="mejor-grid">${html}</div></section>`;
  }

  // ── jugadores que sigue cada persona: se guardan solo en este navegador (sin cuentas); en Inicio, su próximo partido,
  //    cómo le fue el último y el hito que tiene más cerca ──
  const FAV_K = 'mp-favs', FAV_MAX = 6;
  const favs = () => (leeLS(FAV_K, []) || []).filter(k => A.jugadores[k]);
  const esFav = k => favs().includes(k);
  const ESTR5 = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.6 9.4l6.5-.8z"/></svg>';
  const favBoton = k => { const on = esFav(k); return `<button type="button" class="fi-fav${on ? ' on' : ''}" data-fav="${esc(k)}" aria-pressed="${on}">${ESTR5}<span>${on ? 'Siguiendo' : 'Seguir'}</span></button>`; };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-fav]'); if (!b) return;
    const k = b.dataset.fav, xs = favs(), on = xs.includes(k);
    ponLS(FAV_K, on ? xs.filter(x => x !== k) : xs.concat(k).slice(-FAV_MAX));
    b.outerHTML = favBoton(k);
  });
  function favsHtml() {
    const ks = favs(); if (!ks.length) return '';
    const hoy = hoyISO(), todos = partidosNuestros();
    const card = k => {
      const j = A.jugadores[k], eqs = equiposDe(j), f = fotoOK(j) ? j.foto : null;
      // próximo partido de su equipo (o de cualquiera de sus equipos)
      const px = todos.find(m => !m.resultado && m.fecha >= hoy && (eqs.includes(m.e) || (m.otro && eqs.includes(m.otro))));
      const rival = px ? (px.derbi ? 'MP ' + (eqs.includes(px.e) ? px.otro : px.e).id : ours(px.local) ? px.vis : px.local) : '';
      const prox = px ? `<a class="fav-l" href="${hPar(px.ligaId, px.j, px.local, px.vis)}"><span class="etq">Próximo partido</span><b>${esc(fdLarga(px.fecha))}${px.hora ? ' · ' + esc(px.hora) : ''}</b><span>Contra ${esc(rival)}</span></a>` : '';
      // su último partido: resultado del equipo y lo que hizo
      const ux = (j.partidos || []).slice().reverse().find(x => A.partidos[x.mid]);
      let ult = '';
      if (ux) { const pm = A.partidos[ux.mid], mio = [pm.alin_l, pm.por_l, pm.gol_l].some(l => (l || []).some(y => y.k === j.k)) ? pm.local : pm.visitante, R = resLado(pm, mio);
        const suyo = ux.pct != null ? (ux.par || 0) + ' paradas de ' + (ux.tiros || 0) : [ux.g ? ux.g + (ux.g === 1 ? ' gol' : ' goles') : '', ux.a ? ux.a + (ux.a === 1 ? ' asistencia' : ' asistencias') : ''].filter(Boolean).join(' y ') || 'sin goles ni asistencias';
        ult = `<a class="fav-l" href="${hM(ux.mid)}"><span class="etq">Último partido</span><b>${R.r === 'V' ? 'Ganamos' : 'Perdimos'}${R.pen ? ' en los penaltis' : ''} ${R.nos}–${R.ell}</b><span>Contra ${esc(ux.rival)} · ${esc(suyo)}</span></a>`; }
      const h = H && eqs.length ? hitosDe(j).sort((x, y) => x.falta - y.falta)[0] : null;
      const hito = h ? `<div class="fav-h"><b class="cifra">${h.falta}</b><span>${UNI[h.k][h.falta === 1 ? 0 : 1]} para ${h.k === 'a' || h.k === 'par' ? 'las' : 'los'} ${h.u} con el club</span></div>` : '';
      return `<div class="tarjeta fav"><a class="fav-cab" href="${hP(k)}"><span class="fav-f">${f ? `<span class="ph" data-bg="${esc(f)}"></span>` : esc(ini(j.nombre, j.apellidos))}</span>
          <span><b>${esc(nomCorto(j))}</b><span>${esc(eqs.map(mpCorto).join(' · '))}${j.dorsal ? ' · #' + esc(j.dorsal) : ''}</span></span></a>
        <div class="fav-d">${prox}${ult}</div>${hito}</div>`;
    };
    return `<section class="favs"><div class="favs-cab"><h2 class="h2">${ks.length === 1 ? 'Tu jugador' : 'Tus jugadores'}</h2><span>Los que sigues desde su ficha. Se guardan solo en este dispositivo.</span></div>
      <div class="favs-grid">${ks.map(card).join('')}</div></section>`;
  }
  // ── hitos a la vista, en carrusel (histórico + esta temporada; salen también los que no tienen foto) ──
  const UNI = { g: ['gol', 'goles'], a: ['asistencia', 'asistencias'], pj: ['partido', 'partidos'], par: ['parada', 'paradas'] };
  function hitosCarrusel() {
    if (!H) return '';
    const xs = [];
    Object.values(A.jugadores).filter(p => equiposDe(p).length).forEach(p => hitosDe(p).forEach(h => xs.push({ p, h })));
    xs.sort((a, b) => a.h.falta / CERCA[a.h.k] - b.h.falta / CERCA[b.h.k] || b.h.u - a.h.u);
    if (!xs.length) return '';
    const card = ({ p, h }) => `<a class="hito" href="${hP(p.k)}">${fotoOK(p) ? `<span class="hito-f" data-bg="${esc(p.foto)}"></span>` : `<span class="hito-f ini">${esc(ini(p.nombre, p.apellidos))}</span>`}
      <span class="hito-t"><b>${esc(nomCorto(p))}</b><span>${esc(equiposDe(p).map(e => 'MP ' + letraOf(e)).join(' · ') + (p.dorsal ? ' · #' + p.dorsal : ''))}</span>
        <span class="hito-v"><span class="cifra">${h.falta}</span><span>${UNI[h.k][h.falta === 1 ? 0 : 1]}<br><i>para ${h.k === 'a' || h.k === 'par' ? 'las' : 'los'} ${h.u} con el club</i></span></span></span></a>`;
    const lista = xs.slice(0, 12).map(card).join('');
    return `<section class="hitos"><h2 class="h2">Hitos a la vista</h2><div class="hitos-ven${MOV ? ' mueve' : ''}"><div class="hitos-tira" style="--dur:${xs.slice(0, 12).length * 5}s">${lista}${MOV ? lista.replace(/<a class="hito"/g, '<a class="hito" aria-hidden="true" tabindex="-1"') : ''}</div></div></section>`;
  }

  // ── el bloque del fin de semana: título, aviso único, el primero en grande y los demás en lista ──
  function findeHtml(F, titulo, conHero, h1) {
    const lista = F.lista; if (!lista.length) return '';
    const hero = conHero ? lista.find(m => m.st === 'por' && m.ts > Date.now()) : null, resto = lista.filter(m => m !== hero && m.st !== 'vivo');
    const poco = lista.some(m => m.st === 'por' && !m.derbi && (pronDe(m.ligaId, m.j, m.local, m.vis) || {}).poco);
    const T = h1 ? 'h1' : 'h2';
    return `<section class="finde"><div class="finde-cab"><${T} class="${T === 'h1' ? 'h1' : 'h1 h1-2'}">${esc(titulo)}</${T}><span class="finde-rango">${esc(F.rango)}</span></div>
      ${poco ? '<div class="aviso">Llevamos pocos partidos: los pronósticos todavía dicen poco.</div>' : ''}
      ${hero ? heroHtml(hero) : ''}${resto.length ? `<div class="ff-lista${resto.length > 1 ? ' dos' : ''}">${resto.map(filaFinde).join('')}</div>` : ''}</section>`;
  }
  let INI_PEDIDO = false;
  function vInicio(weekId) {
    if (!INI_PEDIDO && (!AGE || !PRON || !ANA)) {   // la primera vez se esperan agenda, pronósticos y análisis (son pequeños)
      INI_PEDIDO = true;
      Promise.all([cargarAgenda(), cargarPron(), cargarAnalisis()]).then(() => { if (esInicio(location.hash) || /^#\/(inicio|jornada)\//.test(location.hash)) render(); });
      return '<div class="carga" role="status" aria-label="Cargando"><div class="sk" style="height:48px;width:60%;margin-top:32px"></div><div class="sk" style="height:260px"></div><div class="carga-tarjetas"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div></div>';
    }
    const wi = weekId ? Math.max(0, A.semanas.findIndex(w => w.id === weekId)) : 0, F = findeInicio();
    const out = [];
    if (F.momento === 'directo') {
      const vivos = F.lista.filter(m => m.st === 'vivo');
      out.push(`<section class="directo-ini"><div class="finde-cab"><div class="dir-t"><i class="punto"></i><h1 class="h1">En directo</h1></div>${tgHtml}</div>
        <div class="vivos${vivos.length > 1 ? ' dos' : ''}">${vivos.map(vivoHtml).join('')}</div></section>`);
      out.push(findeHtml(F, 'Lo que queda del fin de semana', false, false));
      return `<div class="inicio">${apodoCta()}${favsHtml()}${out.join('')}</div>`;
    }
    const fin = F.momento === 'fin', ultSem = F.semanaJugada.reduce((a, m) => (m.fecha > a ? m.fecha : a), '0');
    const semFresca = fin && A.semanas[0] && A.semanas[0].hasta >= ultSem;
    if (fin) out.push(semFresca ? semanaHtml(wi) + mejorHtml(wi) : findeHtml({ lista: F.semanaJugada, rango: F.semanaJugada.length ? fd(F.semanaJugada[0].fecha) + ' – ' + fd(ultSem) : '' }, 'Este fin de semana', false, true));
    const sigT = (+A.temporada.slice(0, 4) + 1) + '/' + String(+A.temporada.slice(5, 7) + 1).padStart(2, '0');
    if (!F.lista.length) out.push(`<section class="finde">${casoHtml('Inicio', 'Se acabó la ' + A.temporada, 'Gracias por seguirnos. Aquí queda el balance; los calendarios de la ' + sigT + ' saldrán cuando la FMP los publique.', 'FINAL', 'derbi', [['Ver Legado', '#/legado']])}</section>`);
    else { if (!fin && F.titulo !== 'ESTE FIN DE SEMANA') out.push(`<section class="finde">${casoHtml('Inicio', 'Este fin de semana no jugamos', 'Ningún equipo nuestro tiene partido esta semana. Debajo, los siguientes y lo que pasó la semana pasada.')}</section>`);
      out.push(findeHtml(F, F.titulo, true, !fin)); }
    out.push(casaHtml(F));
    if (!semFresca) { out.push(semanaHtml(wi)); out.push(mejorHtml(wi)); }
    out.push(hitosCarrusel());
    return `<div class="inicio">${apodoCta()}${favsHtml()}${out.join('')}</div>`;
  }

  /* ── Partido · previa (antes de jugarse; la misma dirección lleva luego al acta) ───────────────────────────────────── */
  function resolverPartido(parts) {
    const L = lgOf(parts[1]); if (!L) return null;
    const j = +parts[2], c = (L.cal || []).find(x => x.j === j && slugEq(x.local) === parts[3] && slugEq(x.visitante) === parts[4]);
    return c ? { L, c } : null;
  }
  let PREV_PEDIDO = false;
  function vPrevia(L, c) {
    if (!PREV_PEDIDO && (!AGE || !PRON || !ANA || !MAPA)) {
      PREV_PEDIDO = true; const h = location.hash;
      Promise.all([cargarAgenda(), cargarPron(), cargarAnalisis(), cargarMapa()]).then(() => { if (location.hash === h) render(); });
      return '<div class="carga" role="status" aria-label="Cargando"><div class="sk" style="height:180px;margin-top:32px"></div><div class="carga-tarjetas"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div></div>';
    }
    const lid = L.id, derbi = ours(c.local) && ours(c.visitante), us = ours(c.local) ? c.local : c.visitante, them = us === c.local ? c.visitante : c.local;
    const ag = AGE && AGE.partidos.find(m => m.liga === L.corto && m.j === c.j && m.local === c.local && m.visitante === c.visitante) || {};
    const x = { fecha: c.fecha, hora: c.hora || null, ts: c.fecha ? tsDe(c.fecha, c.hora || '23:59') : 0 };
    const P = derbi ? null : pronDe(lid, c.j, c.local, c.visitante);
    const pos = n => { const r = L.clasif.find(y => y.equipo === n); return r ? r.puesto + 'º de ' + L.clasif.length + ' · ' + r.pts + (r.pts === 1 ? ' punto' : ' puntos') : ''; };
    const lado = n => `<div class="pv-eq">${escudo(n, 0, 'pv')}<span class="pv-n${ours(n) ? ' mp' : ''}">${esc(etqEq(n, lid))}</span><span class="pv-pos">${esc(pos(n))}</span></div>`;
    const pasado = c.fecha && c.fecha < hoyISO(), conRes = c.gl != null;
    const chips = (pasado ? `<span class="chip ambar pv-chip">${conRes ? 'ACTA PENDIENTE' : 'SIN RESULTADO'}</span>` : '<span class="chip neutro pv-chip">PREVIA</span>') + (derbi ? '<span class="chip derbi pv-chip">DERBI</span>' : ours(c.local) ? '<span class="chip casa pv-chip">EN CASA</span>' : '<span class="chip neutro pv-chip">FUERA</span>');
    const avisos = pasado ? '' : [!c.hora && c.fecha ? 'La FMP aún no ha puesto la hora. La cuenta atrás cuenta solo los días hasta entonces.' : ''].filter(Boolean).join(' ');
    const cab = `<div class="pv-chips">${chips}</div>
      <div class="pv-cab">${lado(c.local)}<div class="pv-c">${pasado && conRes ? `<span class="pv-hora cifra">${c.gl}–${c.gv}</span>` : `<span class="pv-hora cifra">${esc(c.hora || '—')}</span>`}<span class="pv-dia">${esc(c.fecha ? fd(c.fecha) : 'Fecha por fijar')}</span>
        ${c.fecha && !pasado ? `<div class="pv-ca"><span class="etq">${c.hora ? 'Empieza en' : 'Faltan · hora por fijar'}</span>${cuentaHtml(x, 'peque')}</div>` : ''}</div>${lado(c.visitante)}</div>
      <div class="pv-pista">${esc(ag.pista || '')}</div>
      ${pasado ? casoHtml('Partido', conRes ? 'Acta pendiente de la FMP' : 'Sin resultado todavía', conRes ? 'El partido ya se jugó, pero la federación no ha subido el acta. El resultado y los datos saldrán solos esta noche.' : 'La FMP todavía no ha publicado el resultado. Si se ha aplazado, lo avisamos en Telegram en cuanto haya fecha nueva.', 'PENDIENTE', 'ambar') : avisos ? `<div class="aviso">${esc(avisos)}</div>` : ''}`;
    // nosotros frente a ellos (por partido, esta temporada), con barras: lo mejor de cada fila en blanco
    const eU = eqDeLiga(us, lid) || {}, U = ANA && ANA.equipos[eU.id] && ANA.equipos[eU.id].temp;
    const kT = derbi ? (eqDeLiga(them, lid) || {}).id : lid + '|' + them, T = ANA && ANA.equipos[kT] && ANA.equipos[kT].temp;
    const filas = [];
    if (U && T && U.pj && T.pj) {
      const fila = (l, u, t, dir, d, suf = '') => { const bu = dir > 0 ? u > t : u < t, bt = dir > 0 ? t > u : t < u, mx = Math.max(u, t) || 1;
        filas.push(`<div class="pv-cf"><span class="cifra${bu ? ' mejor' : ''}">${dec(u.toFixed(d))}${suf}</span><div class="pv-cf-m"><span>${l}</span><div class="pv-bar"><div><i class="${bu ? 'nos' : ''}" style="width:${(u / mx * 100).toFixed(1)}%"></i></div><div><i class="${bt ? 'ellos' : ''}" style="width:${(t / mx * 100).toFixed(1)}%"></i></div></div></div><span class="cifra${bt ? ' mejor' : ''}">${dec(t.toFixed(d))}${suf}</span></div>`); };
      fila('Goles a favor', U.gf / U.pj, T.gf / T.pj, 1, 1); fila('Goles en contra', U.gc / U.pj, T.gc / T.pj, -1, 1);
      if (U.tiros && T.tiros && U.tiros.f && T.tiros.f) { fila('Tiros a puerta', U.tiros.f / U.tiros.pj, T.tiros.f / T.tiros.pj, 1, 1); fila('Paradas', (1 - U.gc / U.tiros.c) * 100, (1 - T.gc / T.tiros.c) * 100, 1, 0, ' %'); }
      if (U.disc && T.disc) fila('Minutos de sanción', U.disc.min / U.pj, T.disc.min / T.pj, -1, 1);
    }
    const comp = filas.length ? `<div class="tarjeta pv-b"><div class="etq">${derbi ? 'Frente a frente' : 'Nosotros frente a ellos'}</div><div class="pv-cf pv-cf-cab"><span class="mp">${esc(etqEq(us, lid, true))}</span><span>por partido</span><span>${esc(etqEq(them, lid, true))}</span></div>${filas.join('')}</div>` : '';
    // pronóstico: frase, barra con el porcentaje junto a cada equipo y el marcador más probable (siempre local–visitante)
    let pron = '';
    if (P) {
      const fr = P.g >= 55 ? `Somos favoritos: ganamos ${Math.round(P.g / 10)} de cada 10 veces.` : P.pe >= 55 ? `Llegan mejor ellos: ganamos ${Math.round(P.g / 10)} de cada 10 veces.` : `Partido abierto: ganamos ${Math.round(P.g / 10)} de cada 10 veces, y ellos ${Math.round(P.pe / 10)}.`;
      const [a1, b1] = P.x.marcador.split('-').map(Number), usL = ours(c.local);
      pron = `<div class="tarjeta pv-b"><div class="etq">Pronóstico</div><div class="dest">${fr}</div>
        <div class="pv-pron"><i style="width:${P.g}%"><span>${P.g} %</span></i><i class="pen" style="width:${P.e}%"></i><i class="riv" style="width:${P.pe}%"><span>${P.pe} %</span></i></div>
        <div class="pv-pron-l"><span>Penaltis ${P.e} %</span><span>Lo más probable: <b>${esc(etqEq(c.local, lid, true))} ${a1}–${b1} ${esc(etqEq(c.visitante, lid, true))}</b></span></div>
        ${P.poco ? `<div class="aviso">Llevamos pocos partidos (${P.x.pj[usL ? 0 : 1]} nosotros y ${P.x.pj[usL ? 1 : 0]} ellos): el pronóstico todavía dice poco.</div>` : ''}
        <div class="pv-nota">Calculado el ${esc(P.x.hecho.slice(8, 10) + '/' + P.x.hecho.slice(5, 7))} a las ${esc(P.x.hecho.slice(11))}. Se congela el día del partido y no se vuelve a tocar.</div>${comoL('probabilidad')}</div>`;
    }
    // qué nos jugamos: dónde quedaríamos con cada resultado, contando solo este partido (ganar 3 puntos; en los penaltis, 2 y 1)
    let juego = '';
    const rU = L.clasif.find(y => y.equipo === us), rT = L.clasif.find(y => y.equipo === them);
    if (!pasado && !derbi && rU && rT && L.clasif.length > 2) {
      const sitio = (pu, pt) => { const otros = L.clasif.filter(y => y !== rU && y !== rT).map(y => y.pts).concat(pt), a = otros.filter(q => q > pu).length + 1, b = a + otros.filter(q => q === pu).length; return [a, b]; };
      const txt = ([a, b]) => a === b ? a + 'º' : a + 'º–' + b + 'º';   // empatados a puntos: según el desempate
      const opts = [['Ganamos', 3, 0, 'v'], ['Ganamos en los penaltis', 2, 1, 'v'], ['Perdemos en los penaltis', 1, 2, 'd'], ['Perdemos', 0, 3, 'd']].map(([t, a, b, c]) => ({ t, c, pts: rU.pts + a, s: sitio(rU.pts + a, rT.pts + b) }));
      const cur = rU.puesto, que = ([a, b], suma) => (a === b ? (a === cur ? 'seguimos ' + a + 'º' : (a < cur ? 'subimos al ' : 'bajamos al ') + a + 'º')
        : a > cur ? 'podemos bajar hasta el ' + b + 'º' : a < cur && (suma || b < cur) ? 'podemos subir hasta el ' + a + 'º' : 'seguimos ' + cur + 'º');
      const w0 = opts[0].s, l0 = opts[3].s;
      const fr = w0[0] === l0[0] && w0[1] === l0[1] ? `Pase lo que pase, ${que(w0, 3)}.` : `Si ganamos, ${que(w0, 3)}. Si perdemos, ${que(l0, 0)}.`;
      const rv = rT.pts > rU.pts && rU.pts + 3 > rT.pts ? ' Ganando, les pasamos.' : '';
      juego = `<div class="tarjeta pv-b"><div class="etq">Qué nos jugamos</div><div class="dest">${fr}${rv}</div>
        ${opts.map(o => `<div class="pv-jg"><span class="res-l ${o.c}">${o.c.toUpperCase()}</span><span>${o.t}</span><span class="cifra">${o.pts} ${o.pts === 1 ? 'punto' : 'puntos'}</span><b class="cifra">${txt(o.s)}</b></div>`).join('')}
        <div class="pv-nota">Ahora somos ${rU.puesto}º con ${rU.pts} ${rU.pts === 1 ? 'punto' : 'puntos'}. Contamos solo este partido: los demás equipos también juegan.${opts.some(o => o.s[0] !== o.s[1]) ? ' Con guion, empatados a puntos con otros: el puesto lo decide el desempate.' : ''}</div></div>`;
    }
    // cara a cara (con el club, todas las temporadas): los empates que se decidieron en los penaltis, aparte
    const hh = !derbi && (eU.h2h || []).find(y => y.rival === them), n2 = hh ? hh.v + hh.e + hh.d : 0, ult = hh && hh.partidos[0];
    const h2h = hh && n2 ? `<div class="tarjeta pv-b"><div class="etq">Cara a cara</div><div class="dest">${hh.v > hh.d ? 'Les hemos ganado más veces: ' : hh.v < hh.d ? 'Nos han ganado más veces: ' : 'Igualados: '}${hh.v} ${hh.v === 1 ? 'victoria' : 'victorias'} y ${hh.d} ${hh.d === 1 ? 'derrota' : 'derrotas'}${hh.e ? ', más ' + hh.e + ' en los penaltis' : ''}.</div>
      <div class="pv-h2h">${hh.v ? `<i class="v" style="width:${hh.v / n2 * 100}%">${hh.v} V</i>` : ''}${hh.e ? `<i class="e" style="width:${hh.e / n2 * 100}%">${hh.e} PEN</i>` : ''}${hh.d ? `<i class="d" style="width:${hh.d / n2 * 100}%">${hh.d} D</i>` : ''}</div>
      ${ult ? `<div class="pv-nota">Último: ${ult.nosotros}${ult.pen === 'nos' ? '<span class="b-pen">B</span>' : ''}–${ult.ellos}${ult.pen === 'ellos' ? '<span class="b-pen">B</span>' : ''} ${ult.nosotros > ult.ellos ? 'para nosotros' : ult.nosotros < ult.ellos ? 'para ellos' : ult.pen ? 'en los penaltis, para ' + (ult.pen === 'nos' ? 'nosotros' : 'ellos') : 'en los penaltis'} · ${esc(ult.fecha)} (${esc(ult.temporada)})</div>` : ''}</div>` : '';
    // cómo llegan: sus últimos resultados de esta temporada (los penaltis cuentan para quien ganó la tanda)
    const forma = n => (L.cal || []).filter(y => y.gl != null && y.fecha && (y.local === n || y.visitante === n)).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-5).map(y => {
      const mine = y.local === n ? y.gl : y.gv, oth = y.local === n ? y.gv : y.gl, pz = mine === oth && y.mid && A.partidos[y.mid] ? A.partidos[y.mid].pen : null, l = mine > oth || pz === n ? 'V' : 'D';
      if (mine === oth && !pz) return '';   // empate con el acta pendiente: aún no se sabe quién ganó la tanda
      return `<span class="res-l ${l.toLowerCase()}" title="${esc(abr(y.local === n ? y.visitante : y.local) + ' ' + mine + '–' + oth)}">${l}</span>`; }).join('');
    const llegan = `<div class="tarjeta pv-b"><div class="etq">Cómo llegan</div>${[us, them].map(n => `<div class="pv-forma"><div><b class="${ours(n) ? 'mp' : ''}">${esc(etqEq(n, lid, true))}</b><span>${esc(pos(n))}</span></div><div class="pv-res">${forma(n) || '<span class="pv-nota">Aún no ha jugado</span>'}</div></div>`).join('')}</div>`;
    // a vigilar: sus 3 jugadores con más puntos por partido (mapa de la liga) y su portero, en cromos con su foto (solo
    // adultos) y su dorsal; sin foto, las iniciales (rediseño/Cambios fotos rivales.md)
    const ML = MAPA && MAPA.ligas && MAPA.ligas[lid], FKx = idxFK();
    const vig = !derbi && ML ? ML.jug.filter(y => y.eq === them).sort((a, b) => b.x - a.x).slice(0, 3).map(y => [y, (ARQ[y.arq] ? ARQ[y.arq][0] + ' · ' : '') + dec(y.gl.toFixed(1)) + ' g · ' + dec(y.al.toFixed(1)) + ' a por partido', dec(y.x.toFixed(1)), 'puntos/partido']) : [];
    const pt = !derbi && ML && (ML.por || []).filter(y => y.eq === them).sort((a, b) => b.pj - a.pj)[0];
    if (pt) vig.push([pt, 'Su portero · ' + pt.pj + ' partidos', dec(pt.pct.toFixed(1)) + '%', 'de paradas']);
    const vigilar = vig.length ? `<div class="tarjeta pv-b"><div class="etq">A vigilar</div><div class="pv-crs">${vig.map(([y, d, v, u]) => { const f = FKx.f[y.k], dr = FKx.d[y.k];
      return `<div class="pv-cr${f ? '' : ' sin'}">${f ? `<span class="ph" data-bg="${esc(f)}"></span>` : `<span class="pv-cr-i">${esc(ini(y.n, y.a))}</span>`}${dr ? `<b class="cifra pv-cr-d">${esc(dr)}</b>` : ''}
        <span class="pv-cr-p"><b class="pv-cr-n">${esc(y.n + ' ' + y.a)}</b><span class="pv-cr-t">${esc(d)}</span><span class="pv-cr-v"><b class="cifra">${v}</b><span>${u}</span></span></span></div>`; }).join('')}</div></div>` : '';
    // ese día en esta pista: solo si juega otro equipo nuestro
    const dia = AGE && ag.pista ? AGE.dias.find(d => d.fecha === c.fecha && d.pista === ag.pista) : null;
    const visto = new Set();   // un derbi está en el calendario de los dos equipos: una sola vez
    const nos = dia ? dia.nuestros.map(i => AGE.partidos[i]).filter(q => q && !visto.has(q.local + '|' + q.visitante + '|' + q.hora) && visto.add(q.local + '|' + q.visitante + '|' + q.hora))
      .map(q => ({ q, actual: q.local === c.local && q.visitante === c.visitante })) : [];
    let diaHtml2 = '';
    if (nos.length > 1) {
      nos.sort((a, b) => (a.q.hora || '99').localeCompare(b.q.hora || '99'));
      const nm = q => n => (n === 'MADRIDPATINA' ? 'MP ' + (q.eq === 'AL' ? 'Alevín' : 'Infantil') : abr(n));
      const quien = q => { const f = nm(q); return ours(q.local) && ours(q.visitante) ? f(q.local) + ' y ' + f(q.visitante) : ours(q.local) ? f(q.local) : f(q.visitante); };
      const i = nos.findIndex(y => y.actual), luego = nos.slice(i + 1)[0], antes = nos.slice(0, i).pop();
      const frase = luego ? `Quédate: a las ${luego.q.hora || 'hora por fijar'} juega ${quien(luego.q)} aquí.` : antes ? `Ven antes: a las ${antes.q.hora || 'hora por fijar'} juega ${quien(antes.q)} aquí.` : '';
      diaHtml2 = `<div class="tarjeta pv-b"><div class="etq">Ese día en esta pista</div>${frase ? `<div class="dest">${frase}</div>` : ''}${nos.map(({ q, actual }) => `<div class="pv-dia-f${actual ? ' act' : ''}"><span class="cifra">${esc(q.hora || '—')}</span><span>${esc(nm(q)(q.local) + ' – ' + nm(q)(q.visitante))}${actual ? ' · este partido' : ''}</span></div>`).join('')}</div>`;
    }
    return `<div class="previa">${cab}<div class="pv-grid"><div class="pv-col">${juego}${comp}${pron}${h2h}</div><div class="pv-col">${llegan}${vigilar}${diaHtml2}</div></div></div>`;
  }

  /* ── Pestañas dentro de una página (rediseño, fase 4): todas las vistas se pintan y se enseña una; la elegida se
     recuerda mientras dura la visita (TAB_SEL), para que al volver a una página siga en la misma pestaña ── */
  const TAB_SEL = {};
  const pestanas = (id, lista, def) => { const sel = lista.some(([k]) => k === TAB_SEL[id]) ? TAB_SEL[id] : def;
    return { sel, nav: `<nav class="pests" role="tablist" data-tabs="${id}">${lista.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === sel}">${l}</button>`).join('')}</nav>`,
      panel: (k, html) => `<div class="panel" data-panel="${id}:${k}"${k === sel ? '' : ' hidden'}>${html}</div>` }; };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-tab]'), nav = b && b.closest('[data-tabs]'); if (!nav || !view.contains(nav)) return;
    const id = nav.dataset.tabs, k = b.dataset.tab; TAB_SEL[id] = k;
    nav.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    view.querySelectorAll(`[data-panel^="${id}:"]`).forEach(p => { const on = p.dataset.panel === id + ':' + k; p.hidden = !on; if (on && MOV) repetir(p, 'mpFade .18s ease-out'); });
  });
  // subpestañas en píldora (Cómo juega): igual, con data-sub
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-sub]'), g = b && b.closest('[data-subs]'); if (!g || !view.contains(g)) return;
    const id = g.dataset.subs, k = b.dataset.sub; TAB_SEL[id] = k;
    g.querySelectorAll('[data-sub]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    view.querySelectorAll(`[data-subpanel^="${id}:"]`).forEach(p => { const on = p.dataset.subpanel === id + ':' + k; p.hidden = !on; if (on && MOV) repetir(p, 'mpFade .18s ease-out'); });
  });
  const arqDe = (k, lid) => { const L = MAPA && MAPA.ligas && MAPA.ligas[lid]; const x = L && (L.jug.find(j => j.k === k) || (L.por || []).find(j => j.k === k)); return x && ARQ[x.arq] ? { n: ARQ[x.arq][0], c: ARQ[x.arq][3], d: ARQ[x.arq][4], x } : null; };
  const colArq = c => (c || '').replace('#a8281f', '#FF6B63');
  // resultado de un partido para uno de los lados (nunca empate: el empate se decide en los penaltis)
  const resLado = (p, nombre) => { const L = p.local === nombre, nos = L ? p.gl : p.gv, ell = L ? p.gv : p.gl, pen = nos === ell && !!p.pen;
    return { nos, ell, pen, r: nos > ell || (pen && p.pen === nombre) ? 'V' : 'D' }; };
  const marcadorB = (gl, gv, pen, local, visitante) => gl + (pen && pen === local ? '<span class="b-pen">B</span>' : '') + '–' + gv + (pen && pen === visitante ? '<span class="b-pen">B</span>' : '');
  const nomEqLargo = e => (e.cantera ? 'MADRIDPATINA ' + (e.id === 'AL' ? 'ALEVÍN' : 'INFANTIL') : e.nombre);
  // plantilla de un equipo: los de su ficha y los que han jugado con él (en un derbi, solo con su lado del partido)
  const plantillaDe = e => { const mids = new Set(e.cal.map(c => c.mid).filter(Boolean));
    const conEl = j => (j.partidos || []).some(x => { if (!mids.has(x.mid)) return false; const p = A.partidos[x.mid]; if (!p) return false;
      return ([p.alin_l, p.por_l, p.gol_l].some(l => (l || []).some(y => y.k === j.k)) ? p.local : p.visitante) === e.nombre; });
    return Object.values(A.jugadores).filter(j => enEquipo(j, e) || conEl(j)); };

  /* ── Equipo (#/equipo/<id> · rediseño, fase 4): Resumen · Partidos · Cómo juega · Plantilla · Historial ── */
  let EQ_PEDIDO = false;
  function vEquipo2(id) {
    if (!EQ_PEDIDO && (!ANA || !MAPA || !PRON)) {
      EQ_PEDIDO = true; const h = location.hash;
      Promise.all([cargarAnalisis(), cargarMapa(), cargarPron()]).then(() => { if (location.hash === h) render(); });
      return '<div class="carga" role="status" aria-label="Cargando"><div class="sk" style="height:120px;margin-top:24px"></div><div class="carga-tarjetas"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div></div>';
    }
    const e = A.equipos.find(x => x.id === id) || A.equipos[0]; S.eq = e.id;
    const L = lgOf(e.ligaId) || {}, hoy = hoyISO();
    const res = e.cal.filter(c => c.resultado && c.mid && A.partidos[c.mid]).map(c => Object.assign({ c, p: A.partidos[c.mid] }, resLado(A.partidos[c.mid], e.nombre)));
    const cl = e.clas || {}, g = res.filter(x => x.r === 'V'), d = res.filter(x => x.r === 'D');
    const pils = `<nav class="pils eq-pils" aria-label="Equipo">${A.equipos.map(x => `<a class="pil" href="${hEq(x.id)}"${x.id === e.id ? ' aria-current="page"' : ''}>${esc(mpCorto(x))}</a>`).join('')}</nav>`;
    const kpi = (l, v, s, cls = '') => `<div class="eq-k"><span class="etq">${l}</span><b class="cifra ${cls}">${v}</b><span>${s}</span></div>`;
    const cab = `<div class="eq-cab">${escudo(e.nombre, 0, 'eq')}<div><h1 class="h1">${esc(nomEqLargo(e))}</h1><div class="sub">${esc(L.nombre || e.liga)} · ${esc(A.temporada)}</div></div></div>
      <div class="eq-kpis">${kpi('Puesto', cl.puesto ? cl.puesto + 'º' : '–', 'de ' + (L.clasif ? L.clasif.length : '–') + (cl.cambio_puesto ? (cl.cambio_puesto > 0 ? ' · ▲' + cl.cambio_puesto : ' · ▼' + -cl.cambio_puesto) : ''))}
        ${kpi('Puntos', cl.pts != null ? cl.pts : '–', res.length + (res.length === 1 ? ' jugado' : ' jugados'))}${kpi('Ganados', g.length, g.filter(x => x.pen).length + ' en penaltis', 'v')}
        ${kpi('Perdidos', d.length, d.filter(x => x.pen).length + ' en penaltis', 'd')}${kpi('Goles', (cl.gf || 0) + '–' + (cl.gc || 0), 'a favor y en contra')}</div>`;
    const T = pestanas('equipo', [['resumen', 'Resumen'], ['partidos', 'Partidos'], ['juega', 'Cómo juega'], ['plantilla', 'Plantilla'], ['hist', 'Historial']], 'resumen');

    // Resumen: próximo partido, últimos resultados y jugadores clave
    const prox = e.cal.find(c => !c.resultado && !c.descanso && c.fecha && c.fecha >= hoy);
    let proxH = '<div class="tarjeta"><div class="etq">Próximo partido</div><div class="pv-nota" style="margin-top:8px">No quedan partidos en el calendario.</div></div>';
    if (prox) { const local = prox.casa ? e.nombre : prox.rival, vis = prox.casa ? prox.rival : e.nombre, x = { fecha: prox.fecha, hora: prox.hora, ts: tsDe(prox.fecha, prox.hora || '23:59') }, [fa] = faltaTxt(x);
      const rivalT = prox.derbi ? etqEq(prox.rival, e.ligaId) : prox.rival;
      proxH = `<a class="tarjeta eq-prox" href="${hPar(e.ligaId, prox.j, local, vis)}"><div class="eq-prox-c"><span class="etq">Próximo partido</span>${prox.derbi ? '<span class="chip derbi">DERBI</span>' : prox.casa ? '<span class="chip casa">EN CASA</span>' : ''}</div>
        <div class="eq-prox-r">${escudo(prox.rival, 48)}<div><span class="eq-prox-vs">${prox.casa ? 'EN CASA CONTRA' : 'FUERA, EN CASA DE'} · J${prox.j}</span><b>${esc(rivalT)}</b></div></div>
        <div class="eq-prox-p"><div><b class="cifra">${esc(fd(prox.fecha))} · ${esc(prox.hora || 'hora por fijar')}</b><span>${prox.hora ? 'Empieza en <span data-falta="' + x.ts + '">' + fa + '</span>' : 'La FMP aún no ha fijado la hora'}</span></div><span class="ir">Previa</span></div></a>`; }
    const ult = res.slice(-5).map(x => `<a class="eq-ult ${x.r.toLowerCase()}" href="${hM(x.c.mid)}" title="${esc(x.c.rival + ' · J' + x.c.j + ' · ' + fd(x.c.fecha))}">${escudo(x.c.rival, 0, 'eq-ult-e')}<b class="cifra">${x.nos}${x.pen && x.r === 'V' ? '<span class="b-pen">B</span>' : ''}–${x.ell}${x.pen && x.r === 'D' ? '<span class="b-pen">B</span>' : ''}</b><span>J${x.c.j} · ${x.c.casa ? 'CASA' : 'FUERA'}</span></a>`).join('');
    // jugadores clave: los 4 de la plantilla con más puntos (goles + asistencias) con este equipo esta temporada, sin porteros;
    // empate: más goles y luego menos partidos. Se recalcula con cada acta. Antes de que nadie marque, los de la temporada pasada
    const midsE = new Set(e.cal.map(c => c.mid).filter(Boolean)), tPrev = (+A.temporada.slice(0, 4) - 1) + '/' + A.temporada.slice(2, 4);
    const conEq = j => (j.partidos || []).filter(x => midsE.has(x.mid)).reduce((o, x) => ({ pj: o.pj + 1, g: o.g + (x.g || 0), a: o.a + (x.a || 0) }), { pj: 0, g: 0, a: 0 });
    const candidatos = plantillaDe(e).filter(j => !j.portero), orden = (x, y) => (y.g + y.a) - (x.g + x.a) || y.g - x.g || x.pj - y.pj;
    let tClave = A.temporada, top = candidatos.map(j => Object.assign({ j }, conEq(j))).filter(x => x.g + x.a > 0).sort(orden);
    if (!top.length) { tClave = tPrev; top = candidatos.map(j => { const t = (j.temporadas || {})[tPrev] || {}; return { j, pj: t.pj || 0, g: t.goles || 0, a: t.asistencias || 0 }; }).filter(x => x.g + x.a > 0).sort(orden); }
    const clave = top.slice(0, 4).map(({ j, g, a: as }) => { const a = arqDe(j.k, e.ligaId), ok = fotoOK(j);
      return `<a class="eq-clave" href="${hP(j.k)}"><span class="eq-clave-f">${ok ? `<span class="ph" data-bg="${esc(j.foto)}"></span>` : `<span class="ini">${esc(ini(j.nombre, j.apellidos))}</span>`}<span class="eq-clave-d">${esc(j.dorsal || '')}</span></span>
        <span class="eq-clave-t"><b>${esc(nomCorto(j))}</b>${a ? `<span class="arq" style="color:${colArq(a.c)}">${esc(a.n.toUpperCase())}</span>` : ''}<span>${g} g · ${as} a ${tClave === A.temporada ? 'esta temporada' : 'en ' + tClave}</span></span></a>`; }).join('');
    // cuerpo técnico: quien firma el acta en nuestro banquillo esta temporada, con su balance con este equipo y su historial en el club
    const ct = {};
    res.forEach(x => ((x.p.local === e.nombre ? x.p.staff_l : x.p.staff_v) || []).forEach(n => { const o = ct[n] || (ct[n] = { n, pj: 0, v: 0, d: 0 }); o.pj++; if (x.r === 'V') o.v++; else if (x.r === 'D') o.d++; }));
    const cts = Object.values(ct).sort((a, b) => b.pj - a.pj || a.n.localeCompare(b.n));
    const ctIni = n => { const w = n.split(' ').filter(x => !PART.has(x.toLowerCase())); return (w[0] || '')[0] + ((w[1] || '')[0] || ''); };
    const ctCard = o => { const h = (A.staff || {})[o.n] || {};
      return `<div class="ct"><span class="ct-i">${esc(ctIni(o.n))}</span><div class="ct-t"><span class="arq">${esc((h.cargo || 'Cuerpo técnico').toUpperCase())}</span><b>${esc(o.n)}</b>
        <span class="ct-n"><b class="cifra">${o.pj}</b> ${o.pj === 1 ? 'partido' : 'partidos'} esta temporada · ${o.v} ${o.v === 1 ? 'ganado' : 'ganados'} · ${o.d} ${o.d === 1 ? 'perdido' : 'perdidos'}</span>
        ${h.desde ? `<span class="ct-h">${h.desde === A.temporada ? 'Su primera temporada en nuestro banquillo' : `En nuestro banquillo desde ${esc(h.desde)} · ${h.partidos} partidos con el club`}</span>` : ''}</div></div>`; };
    const cuerpo = cts.length ? `<div class="pl-g"><div class="pl-t"><span class="h2">Cuerpo técnico</span><span>${cts.length} ${cts.length === 1 ? 'persona' : 'personas'} · según las actas</span></div><div class="cts">${cts.map(ctCard).join('')}</div></div>` : '';
    const banquillo = cts.length ? `<div><div class="etq">En el banquillo</div><div class="tarjeta eq-banq">${cts.map(o => `<span><b>${esc(o.n)}</b>${esc(((A.staff || {})[o.n] || {}).cargo ? ' · ' + A.staff[o.n].cargo : '')}</span>`).join('')}</div></div>` : '';
    const resumen = `<div class="eq-res"><div class="eq-col">${proxH}${ult ? `<div><div class="etq">Últimos resultados</div><div class="eq-ults" style="--n:${res.slice(-5).length}">${ult}</div></div>` : ''}${banquillo}</div>
      ${clave ? `<div><div class="etq">Jugadores clave · ${esc(tClave)}</div><div class="eq-claves">${clave}</div></div>` : ''}</div>`;

    // Partidos: una baldosa por jornada (descansos incluidos)
    const tiles = e.cal.map(c => { if (c.descanso) return `<div class="eq-t desc"><span class="eq-t-j">J${c.j}</span><span class="eq-t-desc">DESCANSA</span></div>`;
      const x = res.find(y => y.c === c), local = c.casa ? e.nombre : c.rival, vis = c.casa ? c.rival : e.nombre;
      const P = !x && !c.derbi ? pronDe(e.ligaId, c.j, local, vis) : null, tag = c.derbi ? '<span class="eq-t-tag d">DERBI</span>' : c.casa ? '<span class="eq-t-tag">EN CASA</span>' : '';
      const cuerpo = x ? `<b class="cifra">${x.nos}${x.pen && x.r === 'V' ? '<span class="b-pen">B</span>' : ''}–${x.ell}${x.pen && x.r === 'D' ? '<span class="b-pen">B</span>' : ''}</b>` : `<b class="cifra pend">${esc(c.hora || '—')}</b>`;
      const href = x ? hM(c.mid) : c.fecha ? hPar(e.ligaId, c.j, local, vis) : null;
      return `<${href ? `a href="${href}"` : 'div'} class="eq-t${x ? ' ' + x.r.toLowerCase() : ' fut'}"><span class="eq-t-j">J${c.j}</span>${tag}<span class="eq-t-r">${esc(c.derbi ? etqEq(c.rival, e.ligaId) : c.rival)}</span>
        <span class="eq-t-p">${cuerpo}<span>${c.fecha ? esc(fd(c.fecha).slice(4)) : ''}</span></span>${P ? `<span class="eq-t-pct"><b>${P.g}%</b> ganar</span>` : ''}</${href ? 'a' : 'div'}>`; }).join('');
    const partidos = `<div class="eq-tiles">${tiles}</div><div class="cal-ley eq-ley"><span class="l-v">Ganado</span><span class="l-d">Perdido</span><span class="l-fut">Por jugar</span><span class="l-b"><span class="b-pen">B</span> Ganó los penaltis</span></div>`;

    // Cómo juega (analisis.json): cuándo marca y encaja, marcador, tiros, disciplina y asistencias
    const TT = (ANA && ANA.equipos[e.id] || {}).temp || {}, sub = pestSub('juega-' + e.id, [['tramos', 'Cuándo marca y encaja'], ['marcador', 'Marcador'], ['tiros', 'Tiros'], ['disc', 'Disciplina'], ['asis', 'Asistencias']], 'tramos');
    const vacio = '<div class="pv-nota">Todavía no hay datos de esto.</div>';
    let jTramos = vacio, jMarc = vacio, jTiros = vacio, jDisc = vacio, jAsis = vacio;
    if (TT.tramos) { const f = TT.tramos.f, c2 = TT.tramos.c, n = f.length, mx = Math.max(1, ...f, ...c2), seg = c2.slice(n / 2).reduce((a, b) => a + b, 0), pri = c2.slice(0, n / 2).reduce((a, b) => a + b, 0), iC = c2.indexOf(Math.max(...c2));
      const frase = seg > pri * 1.5 ? `Se nos escapan las segundas partes: encajamos ${seg} goles después del descanso y ${pri} antes.` : `Donde más encajamos es entre el ${iC * 5}' y el ${iC * 5 + 5}'.`;
      jTramos = `<div class="dest">${frase}</div><div class="tr-g" data-dib style="--n:${n}">${f.map((v, i) => `<div class="tr-c"><div class="tr-a">${v ? `<span>${v}</span><i data-by style="--i:${i};height:${(v / mx * 100).toFixed(1)}%"></i>` : ''}</div><span class="tr-l">${i * 5}'</span><div class="tr-b">${c2[i] ? `<i data-by style="--i:${i};transform-origin:center top;height:${(c2[i] / mx * 100).toFixed(1)}%"></i><span>${c2[i]}</span>` : ''}</div></div>`).join('')}</div>
        <div class="cal-ley"><span class="l-por">Marcamos</span><span class="l-d">Encajamos</span><span>Minutos de partido, de 5 en 5</span></div>`; }
    if (TT.marcador) { const m = TT.marcador, pips = arr => [['V', 'v'], ['B', 'b'], ['D', 'd']].flatMap(([l, c3], k) => Array.from({ length: arr[k] || 0 }, () => `<span class="pip ${c3}">${l}</span>`)).join('') || '<span class="pip vac">–</span>';
      const caja = (t, a) => { const n = a.reduce((x, y) => x + y, 0); return `<div class="mc-b"><span class="etq">${t}</span><b class="cifra${n && a[0] / n >= .5 ? ' v' : ''}">${a[0] || 0}<span> de ${n}</span></b><span>ganados</span><div class="pips">${pips(a)}</div></div>`; };
      jMarc = `<div class="dest">${m.ventajaPerdida ? `Hemos dejado escapar ${m.ventajaPerdida} ${m.ventajaPerdida === 1 ? 'partido' : 'partidos'} que íbamos ganando.` : 'Cuando nos ponemos por delante, no lo soltamos.'}</div>
        <div class="mc-g">${caja('Cuando marcamos primero', m.primero)}${caja('Cuando encajamos primero', m.encajaPrimero)}
          <div class="mc-giro v"><b class="cifra">${m.remontadas}</b><span>${m.remontadas === 1 ? 'remontada' : 'remontadas'}</span></div><div class="mc-giro d"><b class="cifra">${m.ventajaPerdida}</b><span>${m.ventajaPerdida === 1 ? 'ventaja que se escapó' : 'ventajas que se escaparon'}</span></div></div>
        <div class="pv-nota">B: empate decidido en los penaltis (en el tiempo de juego cuenta como no ganado).</div>`; }
    if (TT.tiros && TT.tiros.pj) { const t = TT.tiros, pj = t.pj, ac = t.gf / Math.max(1, t.f) * 100, pa = (1 - t.gc / Math.max(1, t.c)) * 100;
      const gauge = (v, c3, tl, s) => `<div class="gauge"><div class="gauge-c" style="--p:${v.toFixed(1)};--c:${c3}"><b class="cifra">${dec(v.toFixed(0))}%</b></div><b>${tl}</b><span>${s}</span></div>`;
      jTiros = `<div class="dest">${t.c > t.f ? `Nos tiran más de lo que tiramos: ${dec((t.c / pj).toFixed(1))} en contra y ${dec((t.f / pj).toFixed(1))} a favor por partido.` : `Tiramos más que el rival: ${dec((t.f / pj).toFixed(1))} por partido.`}</div>
        <div class="ti-d"><div><b class="cifra nos">${dec((t.f / pj).toFixed(1))}</b><span>a favor por partido</span></div><div class="ti-bar"><i style="width:${(t.f / (t.f + t.c) * 100).toFixed(1)}%"></i></div><div class="der"><b class="cifra">${dec((t.c / pj).toFixed(1))}</b><span>en contra por partido</span></div></div>
        <div class="gauges">${gauge(ac, '#D3202A', 'Acierto', `De cada 100 tiros, ${Math.round(ac)} son gol`)}${gauge(pa, '#F4F4F5', 'Paradas', `Nuestro portero para ${Math.round(pa / 10)} de cada 10`)}</div>`; }
    if (TT.disc && TT.disc.tipos) { const ds = TT.disc, ord = ds.tipos.slice().sort((a, b) => b[1] - a[1]), mx = Math.max(1, ...ord.map(x => x[1]));
      jDisc = `<div class="dest">${ds.faltas} faltas en ${TT.pj} ${TT.pj === 1 ? 'partido' : 'partidos'}. La que más: ${esc(((ord[0] || ['ninguna'])[0]).toLowerCase())}.</div>
        <div class="di-min"><b class="cifra">${dec((ds.min / Math.max(1, TT.pj)).toFixed(1))}'</b><span>de sanción por partido</span></div>
        <div class="di-g">${ord.map(([l, v]) => { const k2 = v / mx; return `<div class="di-c" style="background:rgba(255,179,71,${(0.12 + k2 * 0.5).toFixed(2)})"><b class="cifra">${v}</b><span>${esc(l)}</span></div>`; }).join('')}</div>`; }
    { const tot = {}; res.forEach(({ p }) => { ((p.local === e.nombre ? p.gol_l : p.gol_v) || []).forEach(x => { if (x.a) { const k = x.k || x.nombre; (tot[k] = tot[k] || { x, a: 0 }).a += x.a; } }); });
      const ls = Object.values(tot).sort((a, b) => b.a - a.a), mx = Math.max(1, ...ls.map(x => x.a));
      if (ls.length) { const pod = [[ls[1], 70, 'seg'], [ls[0], 100, 'pri'], [ls[2], 50, 'ter']];
        jAsis = `<div class="dest">Quien más pases de gol da: ${esc(nomCorto(ls[0].x))}, con ${ls[0].a}.</div><div class="podio">${pod.map(([t, h, cls]) => { if (!t) return '<div class="pod vacio"></div>'; const jj = A.jugadores[t.x.k] || t.x, ok = fotoOK(jj);
          return `<div class="pod ${cls}"><span class="pod-f">${ok ? `<span class="ph" data-bg="${esc(jj.foto)}"></span>` : esc(ini(t.x.nombre, t.x.apellidos))}</span><b>${esc(nomCorto(t.x))}</b><div class="pod-c" style="height:${(h * t.a / mx + 30).toFixed(0)}px"><span class="cifra">${t.a}</span></div></div>`; }).join('')}</div>
          ${ls.slice(3, 10).length ? `<div class="pod-resto">${ls.slice(3, 10).map(t => `<span>${esc(nomCorto(t.x))} <b>${t.a}</b></span>`).join('')}</div>` : ''}`; }
      else jAsis = '<div class="pv-nota">Aún no hay asistencias esta temporada.</div>'; }
    const juega = `<div class="tarjeta juega">${sub.nav}${sub.panel('tramos', jTramos)}${sub.panel('marcador', jMarc)}${sub.panel('tiros', jTiros)}${sub.panel('disc', jDisc)}${sub.panel('asis', jAsis)}</div>`;

    // Plantilla: cromos (porteros y jugadores), con su arquetipo; altas y bajas, plegadas
    const pl = plantillaDe(e);
    pl.sort((a, b) => (b.portero ? 1 : 0) - (a.portero ? 1 : 0) || (+a.dorsal || 99) - (+b.dorsal || 99));
    const cromo = j => { const a = arqDe(j.k, e.ligaId), t = (j.temporadas || {})[A.temporada] || {}, ok = fotoOK(j), w = (j.apellidos || '').split(' ');
      const ap = []; for (const x of w) { ap.push(x); if (!PART.has(x.toLowerCase()) || ap.length === w.length) break; }
      return `<a class="cromo" href="${hP(j.k)}" style="--arq:${a ? colArq(a.c) : '#3A3A40'}"><span class="cromo-f${ok ? '' : ' sin'}"><span class="ini">${esc(ini(j.nombre, j.apellidos))}</span>${ok ? `<span class="ph" data-bg="${esc(j.foto)}"></span>` : ''}<span class="cromo-d">${esc(j.dorsal || '')}</span>${j.capitan ? '<span class="cromo-cap">C</span>' : ''}</span>
        <span class="cromo-t"><b>${esc((j.nombre || '').split(' ')[0])}<br>${esc(ap.join(' '))}</b><span class="arq"${a ? ` style="color:${colArq(a.c)}"` : ''}>${a ? esc(a.n.toUpperCase()) : j.portero ? 'PORTERO' : 'SIN PERFIL TODAVÍA'}</span>
        <span class="cromo-c">${j.portero ? (t.pj || 0) + ' PJ esta temporada' : (t.goles || 0) + ' G · ' + (t.asistencias || 0) + ' A'}</span></span></a>`; };
    const grupo = (t, js) => js.length ? `<div class="pl-g"><div class="pl-t"><span class="h2">${t}</span><span>${js.length} ${js.length === 1 ? 'jugador' : 'jugadores'}</span></div><div class="cromos2">${js.map(cromo).join('')}</div></div>` : '';
    const movs = altasPre(e, L).map(x => { const j = A.jugadores[x.k] || {}; return `<div class="mov"><span class="chip v">LLEGA</span><b>${esc(j.nombre ? j.nombre + ' ' + j.apellidos : x.k)}</b><span>${esc(x.desde ? 'Desde ' + (ours(x.desde) ? etqEq(x.desde, e.ligaId) || x.desde : x.desde) + (x.nota ? ' · ' + x.nota : '') : (x.nota || ''))}</span></div>`; })
      .concat(bajasPre(e, L).map(x => { const int = x.destino && ours(x.destino);
        return `<div class="mov"><span class="chip ${int ? 'v' : 'd'}">${int ? 'PASA' : 'SE VA'}</span><b>${esc(x.nombre + ' ' + x.apellidos)}</b><span>${esc(x.destino ? 'A ' + (int ? x.destino.replace('MADRIDPATINA ', 'MP ') : x.destino) + (x.destinoLiga ? ' (' + x.destinoLiga + ')' : '') : '')}</span></div>`; }));
    const plantilla = cuerpo + grupo('Porteros', pl.filter(j => j.portero)) + grupo('Jugadores', pl.filter(j => !j.portero))
      + (movs.length ? `<details class="movs"><summary><span class="h2">Altas y bajas · ${movs.length}</span></summary>${movs.join('')}</details>` : '');

    // Historial: cara a cara con cada rival, todas las temporadas (los empates de antes cuentan como no ganados)
    const hist = (e.h2h || []).slice().sort((a, b) => (b.v + b.e + b.d) - (a.v + a.e + a.d)).map(h => { const n = h.v + h.e + h.d || 1, u = h.partidos[0];
      return `<div class="h2h tarjeta"><div class="h2h-r">${escudo(h.rival, 32)}<b>${esc(ours(h.rival) ? etqEq(h.rival, e.ligaId) : h.rival)}</b></div><div class="h2h-n"><span class="v">${h.v}</span><i>–</i><span>${h.e + h.d}</span></div>
        <div class="h2h-b"><i style="width:${(h.v / n * 100).toFixed(1)}%"></i></div><div class="pv-nota">${u ? `Último: ${u.nosotros}${u.pen === 'nos' ? '<span class="b-pen">B</span>' : ''}–${u.ellos}${u.pen === 'ellos' ? '<span class="b-pen">B</span>' : ''} · ${esc(u.fecha.slice(-4))}` : ''}</div></div>`; }).join('');
    const historial = hist ? `<div class="h2hs">${hist}</div>` : '<div class="pv-nota">Todavía no hemos jugado contra estos equipos.</div>';
    return `<div class="equipo">${pils}${cab}${T.nav}${T.panel('resumen', resumen)}${T.panel('partidos', partidos)}${T.panel('juega', juega)}${T.panel('plantilla', plantilla)}${T.panel('hist', historial)}</div>`;
  }
  const pestSub = (id, lista, def) => { const sel = lista.some(([k]) => k === TAB_SEL[id]) ? TAB_SEL[id] : def;
    return { nav: `<div class="pils subs" data-subs="${id}">${lista.map(([k, l]) => `<button type="button" class="pil" data-sub="${k}" aria-pressed="${k === sel}">${l}</button>`).join('')}</div>`,
      panel: (k, html) => `<div class="subpanel" data-subpanel="${id}:${k}"${k === sel ? '' : ' hidden'}>${html}</div>` }; };

  /* ── Partido jugado (#/partido/<mid> · rediseño, fase 4): marcador y una frase, gráfico con pestañas (cómo fue · tiros),
     pronóstico frente al resultado, la votación de la afición y, debajo, alineaciones, eventos y datos ── */
  let PA_PEDIDO = false;
  function vPartido2(mid) {
    const p = A.partidos[mid]; if (!p) return vPartido(mid);
    if (!PA_PEDIDO && (!ANA || !PRON)) {
      PA_PEDIDO = true; const h = location.hash;
      Promise.all([cargarAnalisis(), cargarPron()]).then(() => { if (location.hash === h) render(); });
      return '<div class="carga" role="status" aria-label="Cargando"><div class="sk" style="height:220px;margin-top:24px"></div><div class="sk" style="height:260px"></div></div>';
    }
    const lid = p.liga, derbi = ours(p.local) && ours(p.visitante), usL = ours(p.local), us = usL ? p.local : p.visitante, nuestro = ours(p.local) || ours(p.visitante);
    const nm = n => (ours(n) ? largoEq(n, lid) : n), nmC = n => etqEq(n, lid, true);
    const R = resLado(p, us), jugado = p.gl != null;
    const per = /^(alevin|infantil)/.test(lid) ? 20 : 25, tot = per * 2;
    const tGol = x => { const q = segs(x.minuto); return q == null ? null : (parseInt(x.periodo.slice(1), 10) - 1) * per * 60 + per * 60 - q; };
    // opciones de ganar minuto a minuto (tabla de analisis.json: marcador y minutos que quedan)
    const goles = (p.ev || []).filter(x => x.tipo === 'gol' && /^P[12]$/.test(x.periodo)).map(x => Object.assign({}, x, { t: tGol(x) })).filter(x => x.t != null && x.t <= tot * 60).sort((a, b) => a.t - b.t);
    const Tb = ANA && ANA.prob && ANA.prob[per === 20 ? 'cantera' : 'senior'];
    let graf = '', frase = '', minP = 1, minAt = 0, maxP = 0;
    if (Tb && jugado && goles.length) {
      const pts = []; let gl = 0, gv = 0, k = 0;
      for (let m = 0; m <= tot; m++) { while (k < goles.length && goles[k].t <= m * 60) { if (goles[k].lado === 'local') gl++; else gv++; k++; }
        const dl = derbi || usL ? gl - gv : gv - gl, q = Math.max(0, Math.min(Tb.min, tot - m)), f = Tb.tabla[Math.min(4, Math.abs(dl))][Math.floor(q)];
        const pw = m === tot ? (dl > 0 ? 1 : dl < 0 ? 0 : (derbi ? (p.pen === p.local ? 1 : 0) : R.r === 'V' ? 1 : 0)) : dl > 0 ? f[0] + f[1] / 2 : dl < 0 ? 1 - f[0] - f[1] / 2 : .5;
        pts.push([m, pw]); if (pw < minP) { minP = pw; minAt = m; } if (pw > maxP) maxP = pw; }
      const X = m => (m / tot * 600).toFixed(1), Y = v => (8 + (1 - v) * 184).toFixed(1), linea = 'M' + pts.map(([m, v]) => X(m) + ' ' + Y(v)).join(' L');
      const marcas = goles.map(x => { const nuestroG = derbi ? x.lado === 'local' : (x.lado === 'local') === usL, pt = pts[Math.min(tot, Math.ceil(x.t / 60))];
        return `<span class="pa-gol${nuestroG ? ' nos' : ''}" style="left:${(x.t / 60 / tot * 100).toFixed(2)}%;top:${((8 + (1 - pt[1]) * 184) / 200 * 100).toFixed(2)}%" title="Min ${Math.ceil(x.t / 60)} · ${esc(x.jugador ? nomCorto(x.jugador) : 'Gol')} · ${esc((x.marcador || '').replace('-', '–'))}"></span>`; }).join('');
      graf = `<div class="pa-g"><svg viewBox="0 0 600 200" preserveAspectRatio="none" role="img" aria-label="${derbi ? 'Opciones de ganar de ' + esc(nmC(p.local)) : 'Nuestras opciones de ganar'} a lo largo del partido">
          <line x1="0" x2="600" y1="100" y2="100" stroke="#3A3A40" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/><line x1="300" x2="300" y1="0" y2="200" stroke="#26262A" vector-effect="non-scaling-stroke"/>
          <path d="${linea} L600 192 L0 192 Z" fill="rgba(211,32,42,.18)"/><path class="dibuja" d="${linea}" fill="none" stroke="#D3202A" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>
        ${marcas}<span class="pa-g-y a">100 %</span><span class="pa-g-y b">0 %</span></div>
        <div class="vv-ejes"><span>0'</span><span>Descanso</span><span>${tot}'</span></div>
        <div class="cal-ley"><span class="l-por">${derbi ? 'Opciones de ganar de ' + esc(nmC(p.local)) : 'Nuestras opciones de ganar, minuto a minuto'}</span><span class="l-d">${derbi ? 'Gol de ' + esc(nmC(p.visitante)) : 'Gol del rival'}</span></div>${comoL('probabilidad')}`;
    }
    const pc = v => Math.round(v * 100) + ' %';
    // momentos clave: el primer gol, el que dejó el partido decidido (desde él el ganador ya no dejó de ir por delante) y el último
    let momentos = '';
    if (jugado && goles.length) {
      const w = p.gl > p.gv ? 'local' : p.gv > p.gl ? 'visitante' : null; let dl = 0, dec = -1;
      goles.forEach((x, i) => { const antes = dl; dl += x.lado === (w || 'local') ? 1 : -1; if (w && antes <= 0 && dl > 0) dec = i; });
      const idx = [...new Set([0, dec, goles.length - 1].filter(i => i >= 0))].sort((a, b) => a - b);
      momentos = `<div class="pa-mom">${idx.map((i, k) => { const x = goles[i], nos = derbi ? x.lado === 'local' : (x.lado === 'local') === usL;
        return `<div class="pa-m${nos && nuestro ? ' nos' : ''}" style="--i:${k}"><span class="cifra">${Math.max(1, Math.ceil(x.t / 60))}'</span><span><b>Gol de ${esc(x.jugador ? nomCorto(x.jugador) : nmC(x.lado === 'local' ? p.local : p.visitante))}</b> · ${esc(nmC(x.lado === 'local' ? p.local : p.visitante))}${i === dec && goles.length > 1 ? ' · el que lo decidió' : i === 0 ? ' · el primero' : ''}</span><b class="cifra">${esc((x.marcador || '').replace('-', '–'))}</b></div>`; }).join('')}</div>`;
    }
    if (!jugado) frase = '';
    else if (derbi) frase = R.nos === R.ell ? `Derbi: ${p.gl}–${p.gv} y penaltis para ${nmC(p.pen)}.` : `Derbi: gana ${nmC(p.gl > p.gv ? p.local : p.visitante)} ${Math.max(p.gl, p.gv)}–${Math.min(p.gl, p.gv)}.`;
    else if (!nuestro) frase = p.gl === p.gv ? `${p.gl}–${p.gv} y penaltis para ${p.pen || '—'}.` : `Gana ${p.gl > p.gv ? p.local : p.visitante} ${Math.max(p.gl, p.gv)}–${Math.min(p.gl, p.gv)}.`;
    else if (graf && R.r === 'V' && minP < .3) frase = `Llegamos a tener solo un ${pc(minP)} de opciones (minuto ${minAt}) y lo ganamos.`;
    else if (graf && R.r === 'D' && maxP > .7) frase = `Llegamos a tener un ${pc(maxP)} de opciones y se nos escapó.`;
    else frase = (R.r === 'V' ? 'Ganamos ' : 'Perdimos ') + R.nos + '–' + R.ell + (R.pen ? ' en los penaltis.' : '.');
    const chips = ['<span class="chip neutro pv-chip">FINAL</span>'];
    if (derbi) chips.push('<span class="chip derbi pv-chip">DERBI</span>'); else if (nuestro) chips.push(R.r === 'V' ? '<span class="chip v pv-chip">GANAMOS</span>' : '<span class="chip d pv-chip">PERDIMOS</span>');
    if (p.pen) chips.push(`<span class="chip casa pv-chip">PENALTIS PARA ${esc(nmC(p.pen).toUpperCase())}</span>`);
    const lado = n => `<${A.equipos.find(e => e.nombre === n && e.ligaId === lid) ? `a href="${hT(n) || '#'}"` : 'div'} class="pv-eq">${escudo(n, 0, 'pv')}<span class="pv-n${ours(n) ? ' mp' : ''}"><span class="nm-largo">${esc(nm(n))}</span><span class="nm-corto">${esc(nmC(n))}</span></span></${A.equipos.find(e => e.nombre === n && e.ligaId === lid) ? 'a' : 'div'}>`;
    const vid = p.idp && VID && VID[p.idp];
    const botones = `<div class="pa-bot">${vid ? `<a class="btn p" href="#/video/${encodeURIComponent(p.idp)}">▶ Ver resumen</a>` : nuestro && p.idp ? `<a class="btn s" href="#/directo/${encodeURIComponent(p.idp)}/resumen">▶ Resumen del acta</a>` : ''}</div>`;
    const cab = `<div class="pv-chips">${chips.join('')}<span class="pa-cuando">${esc(fd(p.fecha) + (p.hora ? ' · ' + p.hora : '') + ' · ' + (p.ligaNombre || '').replace(/^Liga /, '') + ' · J' + p.jornada)}</span></div>
      <div class="pv-cab pa-cab">${lado(p.local)}<div class="pa-score cifra">${jugado ? marcadorB(p.gl, p.gv, p.pen, p.local, p.visitante) : '–'}</div>${lado(p.visitante)}</div>
      ${frase ? `<div class="pa-frase">${esc(frase)}</div>` : ''}${momentos}${botones}`;
    // gráfico con pestañas: cómo fue (opciones de ganar) · tiros (si el vigía los grabó)
    const G = pestanas('pa-graf', [['prob', 'Cómo fue'], ['tiros', 'Tiros']], graf ? 'prob' : 'tiros');
    const grafico = graf || p.idp ? `<div class="tarjeta pa-gc">${G.nav}${graf ? G.panel('prob', graf) : ''}${p.idp ? G.panel('tiros', `<div data-tiros-partido="${esc(p.mid)}" data-sin-titulo="1"></div>`) : ''}</div>` : '';
    // pronóstico frente al resultado (solo los guardados antes del partido)
    const P = PRON && PRON[lid + '|' + p.jornada + '|' + p.local + '|' + p.visitante];
    const desde = PRON ? Object.values(PRON).reduce((m, x) => (x.hecho < m ? x.hecho : m), '9') : '9';
    let pron = '';
    if (P && P.hecho.slice(0, 10) <= p.fecha && !derbi) { const g = Math.round((nuestro ? (usL ? P.pL : P.pV) : P.pL) * 100), fav = P.pL >= P.pV ? p.local : p.visitante, ganador = p.gl > p.gv ? p.local : p.gl < p.gv ? p.visitante : p.pen;
      pron = `<div class="tarjeta pv-b"><div class="etq">Pronóstico frente al resultado</div><div class="dest">${nuestro ? `Lo dábamos al ${g} % (calculado el ${P.hecho.slice(8, 10)}/${P.hecho.slice(5, 7)}).` : `Dábamos a ${esc(abr(p.local))} un ${g} %.`} ${ganador ? (ganador === fav ? 'Ganó el favorito.' : 'Ganó el que no era favorito.') : ''}</div></div>`; }
    else if (nuestro && !derbi && desde !== '9' && p.fecha < desde.slice(0, 10)) pron = `<div class="tarjeta pv-b"><div class="etq">Pronóstico frente al resultado</div><div class="dest">Este partido se jugó antes de que empezáramos a guardar pronósticos (${desde.slice(8, 10)}/${desde.slice(5, 7)}). Desde entonces, aquí sale lo que dijimos y si acertamos.</div></div>`;
    // alineaciones, eventos y datos
    const alin = (al, por, n) => { const mp = ours(n), lista = (p[al] || []).slice().sort((a, b) => (b.portero ? 1 : 0) - (a.portero ? 1 : 0) || (+a.dorsal || 99) - (+b.dorsal || 99));
      return `<div class="al"><div class="al-t${mp ? ' mp' : ''}">${esc(nm(n))}</div>${lista.map(j => { const pt = (p[por] || []).find(x => x.k === j.k), href = mp && A.jugadores[j.k] ? hP(j.k) : null;
        return `<${href ? `a href="${href}"` : 'div'} class="al-f"><span class="al-d${mp ? ' mp' : ''}">${esc(j.dorsal || '')}</span><span class="al-n"><b>${esc(nomCorto(j))}</b>${j.portero ? ' · portero' : j.capitan ? ' · C' : ''}</span><span class="al-c">${pt ? (pt.tiros ? pt.par + '/' + pt.tiros + ' · ' + dec(pt.pct) + ' %' : 'sin tiros') : [j.g ? j.g + 'G' : '', j.a ? j.a + 'A' : ''].filter(Boolean).join(' ')}</span></${href ? 'a' : 'div'}>`; }).join('')}</div>`; };
    const lados = derbi || usL ? [['alin_l', 'por_l', p.local], ['alin_v', 'por_v', p.visitante]] : [['alin_v', 'por_v', p.visitante], ['alin_l', 'por_l', p.local]];
    const alineaciones = `<div class="als">${lados.map(([a, b, n]) => alin(a, b, n)).join('')}</div>`;
    const eqC = l => nmC(l === 'local' ? p.local : p.visitante);
    const evs = (p.ev || []).filter(x => x.tipo !== 'cambio_portero').map(x => Object.assign({}, x, { t: tGol(x) })).filter(x => x.t != null).sort((a, b) => a.t - b.t).map(x => {
      const nos = derbi ? x.lado === 'local' : (x.lado === 'local') === usL, min = Math.max(1, Math.ceil(x.t / 60)) + "'";
      const enP = x.tipo === 'gol' && x.jugador ? pistaGol(p.idp, `${String(x.periodo).replace('P', '')}-${x.minuto}-GOL-${x.jugador.dorsal}`) : null;
      const pista = enP ? ['L', 'V'].filter(l => enP[l] && enP[l].length).map(l => `<span class="ev-pista">En pista (${esc(nmC(l === 'L' ? p.local : p.visitante))}): ${enP[l].map(d => '#' + esc(d)).join(' ')}</span>`).join('') : '';
      const vb = x.tipo === 'gol' && x.jugador ? botonVer(p.idp, { id: `${String(x.periodo).replace('P', '')}-${x.minuto}-GOL-${x.jugador.dorsal}` }) : '';
      if (x.tipo === 'gol') return `<div class="ev"><span class="ev-m cifra">${min}</span><span class="vv-tipo ${nos ? 'nos' : 'ellos'}">GOL</span><span class="ev-t"><b>${x.jugador ? quienTxt(x.jugador) : 'Gol'}</b> · ${esc(eqC(x.lado))} · ${esc((x.marcador || '').replace('-', '–'))}${x.asistencia ? ' · asist. ' + quienTxt(x.asistencia) : ''}${pista}</span>${vb}</div>`;
      if (x.tipo === 'falta') return `<div class="ev"><span class="ev-m cifra">${min}</span><span class="vv-tipo sanc">SANCIÓN</span><span class="ev-t"><b>${x.jugador ? quienTxt(x.jugador) : ''}</b> · ${esc(fmin(x.minutos))} · ${esc(x.falta || 'falta')} · ${esc(eqC(x.lado))}</span></div>`;
      return `<div class="ev"><span class="ev-m cifra">${min}</span><span class="vv-tipo tiempo">TIEMPO</span><span class="ev-t"><b>Tiempo muerto</b> · ${esc(eqC(x.lado))}</span></div>`; }).join('');
    const dato = (l, v) => v ? `<div class="dato"><span class="etq">${l}</span><span>${v}</span></div>` : '';
    const datos = `<div class="datos">${dato('Pista', esc(p.pista || ''))}${dato(p.arb && p.arb.length > 1 ? 'Árbitros' : 'Árbitro', esc((p.arb || []).join(' · ')))}
      ${p.tl != null ? dato('Tiros a puerta', esc(nmC(p.local) + ' ' + p.tl + ' · ' + nmC(p.visitante) + ' ' + p.tv)) : ''}
      ${p.mvp ? dato('Mejor del partido', esc(nomCorto(p.mvp) + ' · ' + (ours(p.mvp.equipo) ? nmC(p.mvp.equipo) : p.mvp.equipo) + ' · ' + p.mvp.motivo)) : ''}
      ${(p.staff_l || []).length ? dato('Cuerpo técnico · ' + esc(nmC(p.local)), esc(p.staff_l.join(' · '))) : ''}${(p.staff_v || []).length ? dato('Cuerpo técnico · ' + esc(nmC(p.visitante)), esc(p.staff_v.join(' · '))) : ''}</div>${mapasVideo(p)}`;
    const TB = pestanas('pa-tab', [['alin', 'Alineaciones'], ['ev', 'Eventos'], ['datos', 'Datos']], 'alin');
    return `<div class="partido2">${cab}${grafico}${pron}${nuestro && p.idp && jugado ? `<div data-voto="${esc(p.mid)}"></div>` : ''}
      <div class="pa-tabs">${TB.nav}${TB.panel('alin', alineaciones)}${TB.panel('ev', evs ? `<div class="evs">${evs}</div>` : '<div class="pv-nota">El acta no trae eventos.</div>')}${TB.panel('datos', datos)}</div></div>`;
  }
  // lo marcado en el vídeo (#/sincronizar): tiros con su resultado o, si no, desde dónde fueron los goles
  function mapasVideo(p) {
    const vd = p.idp && VID && VID[p.idp]; if (!vd) return '';
    const [cL, cV] = coloresLados(p.local, p.visitante), golesV = Object.values(vd.ev || {}).filter(e => e.tipo === 'GOL');
    if (vd.tiros && vd.tiros.length) {
      const bloque = l => { const nom = l === 'L' ? p.local : p.visitante, col = l === 'L' ? cL : cV, ts = vd.tiros.filter(t => t.lado === l), gs = golesV.filter(e => e.lado === l);
        const par = ts.filter(t => t.r === 'parada').length, totT = ts.length + gs.length, puerta = par + gs.length;
        const pts = ts.filter(t => t.xy).map(t => t.r === 'parada' ? `<circle cx="${t.xy[0] * PISTA_W}" cy="${t.xy[1] * PISTA_H}" r="7" fill="none" stroke="${col}" stroke-width="2.5"><title>Parada${t.dorsal ? ' · #' + esc(t.dorsal) : ''}</title></circle>`
          : `<g stroke="#8A8A8F" stroke-width="2.5"><title>${t.r === 'fuera' ? 'Fuera' : 'Bloqueado'}${t.dorsal ? ' · #' + esc(t.dorsal) : ''}</title><line x1="${t.xy[0] * PISTA_W - 5}" y1="${t.xy[1] * PISTA_H - 5}" x2="${t.xy[0] * PISTA_W + 5}" y2="${t.xy[1] * PISTA_H + 5}"/><line x1="${t.xy[0] * PISTA_W + 5}" y1="${t.xy[1] * PISTA_H - 5}" x2="${t.xy[0] * PISTA_W - 5}" y2="${t.xy[1] * PISTA_H + 5}"/></g>`).join('')
          + gs.filter(e => e.xy).map(e => `<circle cx="${e.xy[0] * PISTA_W}" cy="${e.xy[1] * PISTA_H}" r="9" fill="${col}" stroke="#0D0D0E" stroke-width="2"><title>Gol · ${esc(e.q || '')} · a unos ${distM(e.xy)} m</title></circle>`).join('');
        return `<div><div class="etq" style="margin-bottom:6px">${esc(mpAbr(nom))} · ${totT} tiros · ${puerta} a puerta · ${gs.length} ${gs.length === 1 ? 'gol' : 'goles'}</div><div style="width:min(100%,300px)">${mediaPista(pts, 'width="100%" role="img" aria-label="Media pista con los tiros"')}</div></div>`; };
      return `<div class="pa-mapas"><div class="etq">Tiros marcados en el vídeo</div><div class="pv-nota">● gol · ○ parada · ✕ fuera o bloqueado</div><div class="pa-mapas-g">${bloque('L')}${bloque('V')}</div></div>`;
    }
    const gs = golesV.filter(e => e.xy); if (!gs.length) return '';
    const pts = gs.map(e => `<circle cx="${e.xy[0] * PISTA_W}" cy="${e.xy[1] * PISTA_H}" r="10" fill="${e.lado === 'L' ? cL : cV}" stroke="#0D0D0E" stroke-width="2"><title>${esc(e.q || 'Gol')} · a unos ${distM(e.xy)} m</title></circle>`).join('');
    return `<div class="pa-mapas"><div class="etq">Desde dónde fueron los goles</div><div class="pv-nota">Marcados en el vídeo, mirando a la portería en la que entró cada gol.</div><div style="width:min(100%,300px);margin-top:8px">${mediaPista(pts, 'width="100%" role="img" aria-label="Media pista con los goles"')}</div></div>`;
  }

  /* ── Ficha (#/jugador/<k> · rediseño, fase 4): resumen arriba y Temporadas · Logros · En el equipo · Comparar · Partidos ── */
  let FI_PEDIDO = false;
  function vJugador2(k) {
    if (!FI_PEDIDO && (!ANA || !MAPA)) {
      FI_PEDIDO = true; const h = location.hash;
      Promise.all([cargarAnalisis(), cargarMapa()]).then(() => { if (location.hash === h) render(); });
      return '<div class="carga" role="status" aria-label="Cargando"><div class="sk" style="height:300px;margin-top:24px"></div></div>';
    }
    const j = A.jugadores[k] || Object.values(A.jugadores)[0], eqs = equiposDe(j), e0 = eqs[0] || teamOf(j.equipo) || {};
    const ok = fotoOK(j), a = e0.ligaId ? arqDe(j.k, e0.ligaId) : null;
    const hj = H && H.byTok[H.tok(j.nombre + ' ' + j.apellidos)], ts = hj ? hj.temporadas.filter(t => ours(t.equipo)) : [], ya = (j.temporadas || {})[A.temporada] || {};
    const sum = f => ts.reduce((x, t) => x + (t[f] || 0), 0);
    const temps0 = new Set(ts.map(t => t.temporada)), tot = { pj: sum('pj') + (ya.pj || 0), g: sum('g') + (ya.goles || 0), a: sum('a') + (ya.asistencias || 0), temps: temps0.size + (ya.pj && !temps0.has(A.temporada) ? 1 : 0) };
    const enPor = (j.partidos || []).filter(x => x.pct != null), tirY = enPor.reduce((s, x) => s + (x.tiros || 0), 0), parY = enPor.reduce((s, x) => s + (x.par || 0), 0);
    const tirH = ts.filter(t => t.rol === 'GOALIE').reduce((s, t) => s + (t.tiros || 0), 0), parH = ts.filter(t => t.rol === 'GOALIE' && t.tiros).reduce((s, t) => s + t.tiros - (t.gc || 0), 0);
    const par = parH + parY, tir = tirH + tirY, esPor = j.portero || (tir > 0 && !tot.g && !tot.a);
    const kpis = esPor ? [[tot.pj, 'Partidos'], [par, 'Paradas'], [tir ? dec((par / tir * 100).toFixed(1)) + '%' : '–', '% paradas'], [tot.temps, tot.temps === 1 ? 'Temporada' : 'Temporadas']] : [[tot.pj, tot.pj === 1 ? 'Partido' : 'Partidos'], [tot.g, tot.g === 1 ? 'Gol' : 'Goles'], [tot.a, tot.a === 1 ? 'Asistencia' : 'Asistencias'], [tot.temps, tot.temps === 1 ? 'Temporada' : 'Temporadas']];
    const hs = H && eqs.length ? hitosDe(j) : [], h0 = hs.sort((x, y) => x.falta - y.falta)[0];
    const roles = [j.capitan ? (j.fem ? 'CAPITANA' : 'CAPITÁN') : '', j.asistente ? 'ASISTENTE' : '', esPor ? (j.fem ? 'PORTERA' : 'PORTERO') : ''].filter(Boolean);
    const cab = `<div class="fi-cab"><div class="fi-foto${ok ? '' : ' sin'}"><span class="ini">${esc(ini(j.nombre, j.apellidos))}</span>${ok ? `<span class="ph" data-bg="${esc(j.foto)}"></span>` : ''}<span class="fi-dorsal cifra">${esc(j.dorsal || '')}</span></div>
      <div class="fi-t"><h1 class="h1 fi-n">${esc((j.nombre + ' ' + j.apellidos).toUpperCase())}</h1><div class="sub">${esc(eqs.map(nomEqLargo).join(' · ') || j.equipo || '')}${e0.liga ? ' · ' + esc(e0.liga.replace(/^Liga /, '')) : ''}</div>
        <div class="fi-chips">${a ? `<span class="fi-arq" style="background:${a.c}" title="${esc(a.d)}">${esc(a.n.toUpperCase())}</span>` : ''}${roles.map(r => `<span class="fi-rol">${r}</span>`).join('')}${equiposDe(j).length ? favBoton(j.k) : ''}</div>
        <div class="fi-kpis">${kpis.map(([v, l]) => `<div><b class="cifra">${v}</b><span class="etq">${l}</span></div>`).join('')}</div>
        ${h0 ? `<div class="fi-hito"><b class="cifra">${h0.falta}</b><span>${UNI[h0.k][h0.falta === 1 ? 0 : 1]} para ${h0.k === 'a' || h0.k === 'par' ? 'las' : 'los'} ${h0.u} con el club</span></div>` : ''}</div></div>`;
    // Temporadas: barras de goles y asistencias (porteros: partidos y % de paradas)
    const rows = {};
    ts.forEach(t => { const x = rows[t.temporada] || (rows[t.temporada] = { t: t.temporada, eq: [], pj: 0, g: 0, a: 0, tiros: 0, gc: 0 }); const l = t.equipo === 'MADRIDPATINA' ? (/ALEV/i.test(t.liga || '') ? 'MP Alevín' : /INFANT/i.test(t.liga || '') ? 'MP Infantil' : 'MP') : t.equipo.replace('MADRIDPATINA ', 'MP ');
      if (!x.eq.includes(l)) x.eq.push(l); ['pj', 'g', 'a', 'gc'].forEach(f => { x[f] += t[f] || 0; }); if (t.rol === 'GOALIE') x.tiros += t.tiros || 0; });
    if (ya.pj) rows[A.temporada] = { t: A.temporada, eq: eqs.map(mpCorto), pj: ya.pj, g: ya.goles || 0, a: ya.asistencias || 0, tiros: tirY, gc: tirY - parY, ahora: true };
    const lst = Object.values(rows).sort((x, y) => y.t.localeCompare(x.t)), mx = Math.max(1, ...lst.map(x => (esPor ? x.pj : x.g + x.a)));
    const temporadas = lst.length ? `<div class="fi-temps">${lst.map(x => `<div class="fi-tf"><div><b class="cifra${x.ahora ? ' ahora' : ''}">${esc(x.t)}</b><span>${esc(x.eq.join(' · '))}${x.ahora ? ' · en curso' : ''}</span></div>
        <div class="fi-bar"><i class="g" style="width:${((esPor ? x.pj : x.g) / mx * 100).toFixed(1)}%"></i>${esPor ? '' : `<i class="a" style="width:${(x.a / mx * 100).toFixed(1)}%"></i>`}</div>
        <span class="fi-tv">${esPor ? x.pj + ' PJ' + (x.tiros ? ' · ' + dec(((x.tiros - x.gc) / x.tiros * 100).toFixed(1)) + ' %' : '') : x.pj + ' PJ · ' + x.g + ' G · ' + x.a + ' A'}</span></div>`).join('')}</div>
      <div class="cal-ley"><span class="l-por">${esPor ? 'Partidos' : 'Goles'}</span>${esPor ? '' : '<span class="l-d">Asistencias</span>'}</div>` : '<div class="pv-nota">Aún no tiene partidos con nosotros.</div>';
    // evolución: puntos por partido (porteros, % de paradas) en cada temporada con 3 partidos o más (porteros, 30 tiros)
    const evoP = lst.slice().reverse().map(x => ({ t: x.t, ahora: x.ahora, v: esPor ? (x.tiros >= 30 ? (x.tiros - x.gc) / x.tiros * 100 : null) : (x.pj >= 3 ? (x.g + x.a) / x.pj : null) })).filter(x => x.v != null);
    let evo = '';
    if (evoP.length >= 2) {
      const W = 340, Hh = 130, n0 = evoP.length, lo = esPor ? Math.max(0, Math.min(...evoP.map(x => x.v)) - 6) : 0, hi = Math.max(...evoP.map(x => x.v)) * (esPor ? 1 : 1.2) + (esPor ? 2 : .1);
      const X = i => 26 + i * (W - 52) / Math.max(1, n0 - 1), Y = v => 26 + (1 - (v - lo) / (hi - lo)) * (Hh - 56);
      const fmt = v => (esPor ? dec(Math.round(v)) + ' %' : dec(v.toFixed(1)));
      const tramo = (a, b) => `<line x1="${X(a)}" y1="${Y(evoP[a].v)}" x2="${X(b)}" y2="${Y(evoP[b].v)}" class="${evoP[b].ahora ? 'curso' : ''}"/>`;
      const best = evoP.filter(x => !x.ahora).reduce((m, x) => (!m || x.v > m.v ? x : m), null);
      evo = `<div class="tarjeta fi-evo"><span class="etq">${esPor ? '% de paradas' : 'Puntos por partido'}, temporada a temporada</span>
        ${best ? `<div class="dest">Su mejor temporada: ${esc(best.t)}, con ${fmt(best.v)}${esPor ? ' de paradas' : ' por partido'}.</div>` : ''}
        <svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esPor ? '% de paradas' : 'Puntos por partido'} en cada temporada">
          ${evoP.slice(1).map((_, i) => tramo(i, i + 1)).join('')}
          ${evoP.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x.v)}" r="${x === best ? 6 : 4}" class="${x.ahora ? 'curso' : x === best ? 'mejor' : ''}"/><text x="${X(i)}" y="${Y(x.v) - 11}" class="v">${fmt(x.v)}</text><text x="${X(i)}" y="${Hh - 6}" class="t">${esc(x.t.slice(2))}</text>`).join('')}
        </svg><div class="pv-nota">${esPor ? 'Paradas de cada 100 tiros, en las temporadas con 30 tiros o más.' : 'Goles más asistencias, entre partidos jugados, en las temporadas con 3 partidos o más.'}${evoP.some(x => x.ahora) ? ' La de este año, en curso.' : ''}</div></div>`;
    }
    // su mejor partido con nosotros: más goles + asistencias (porteros: más paradas, con 10 tiros o más); de las
    // temporadas cerradas sale de historico.json y de esta, de sus partidos en app.json
    const cands = ((hj && hj.mejor) || []).filter(m => !!m.por === !!esPor).map(m => Object.assign({}, m));
    (j.partidos || []).forEach(x => { const pm = A.partidos[x.mid]; if (!pm) return;
      const mio = [pm.alin_l, pm.por_l, pm.gol_l].some(l => (l || []).some(y => y.k === j.k)), R = resLado(pm, mio ? pm.local : pm.visitante);
      const base = { t: A.temporada, fecha: pm.fecha, rival: mio ? pm.visitante : pm.local, nos: R.nos, ell: R.ell, pen: !!R.pen, gano: R.r === 'V', mid: x.mid };
      if (esPor && x.tiros >= 10) cands.push(Object.assign(base, { por: true, tiros: x.tiros, par: x.par }));
      if (!esPor && (x.g || 0) + (x.a || 0) >= 2) cands.push(Object.assign(base, { g: x.g || 0, a: x.a || 0 })); });
    const clave = m => (esPor ? [m.par, -(m.tiros - m.par)] : [m.g + m.a, m.g]).concat(m.fecha || '');
    const mj = cands.sort((a, b) => { const x = clave(a), y = clave(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? 1 : -1; return 0; })[0];
    const fLarga = f => f ? +f.slice(8, 10) + '/' + +f.slice(5, 7) + '/' + f.slice(0, 4) : '';
    const mejorP = mj ? `<${mj.mid ? `a href="${hM(mj.mid)}"` : 'div'} class="tarjeta fi-mejor"><span class="etq">Su mejor partido con nosotros</span>
        <b class="cifra">${esPor ? mj.par + '<small> paradas de ' + mj.tiros + '</small>' : [mj.g ? mj.g + '<small>' + (mj.g === 1 ? ' gol' : ' goles') + '</small>' : '', mj.a ? mj.a + '<small>' + (mj.a === 1 ? ' asistencia' : ' asistencias') + '</small>' : ''].filter(Boolean).join(' <small>y</small> ')}</b>
        <span>Contra ${esc(ours(mj.rival) ? mj.rival.replace('MADRIDPATINA ', 'MP ') : mj.rival)} · ${mj.gano ? 'ganamos' : 'perdimos'}${mj.pen ? ' en los penaltis' : ''} ${mj.nos}–${mj.ell} · ${esc(fLarga(mj.fecha))}</span></${mj.mid ? 'a' : 'div'}>` : '';
    // en otros clubes (historico.json → fuera): equipo, competición y cifras de las actas de la FMP, la más reciente arriba
    const fz = (H && H.fuera && H.fuera[H.tok(j.nombre + ' ' + j.apellidos)]) || [];
    const ligaF = l => titulo(l).replace(/ Y /g, ' y ').replace(/ De /g, ' de ');
    const fueraH = fz.length ? `<div class="fi-fuera"><div class="etq">${!lst.length || fz.every(x => x.t < lst[lst.length - 1].t) ? 'Antes de llegar' : 'En otros clubes'}</div>
      <div class="fi-temps">${fz.slice().reverse().map(x => `<div class="fi-tf fuera"><b class="cifra">${esc(x.t)}</b><div><b>${esc(x.equipo)}</b><span>${esc(x.ligas.map(ligaF).join(' · '))}</span></div>
        <span class="fi-tv">${x.por ? x.pj + ' PJ' + (x.tiros ? ' · ' + dec(((x.tiros - x.gc) / x.tiros * 100).toFixed(1)) + ' %' : '') : x.pj + ' PJ · ' + x.g + ' G · ' + x.a + ' A'}</span></div>`).join('')}</div>
      <div class="pv-nota">Según las actas de la Federación Madrileña de Patinaje.</div></div>` : '';
    // Logros, agrupados por tipo
    const eqS = (n, liga) => (n === 'MADRIDPATINA' ? (/ALEV/i.test(liga || '') ? 'MP Alevín' : /INFANT/i.test(liga || '') ? 'MP Infantil' : 'MP') : n.replace('MADRIDPATINA ', 'MP ')), ligaS = l => l.replace(/^LIGA /, '').toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());
    const tsH = []; ts.forEach(t => { const y = tsH.find(z => z.temporada === t.temporada && z.equipo === t.equipo); if (!y) { tsH.push(Object.assign({}, t)); return; } ['pj', 'g', 'a', 'pim', 'tiros', 'gc', 'hattricks'].forEach(f => { y[f] = (y[f] || 0) + (t[f] || 0); }); });
    const G = [], todosH = H ? H.jugadores : [];
    const camp = H ? H.clasificaciones.filter(c => c.puesto === 1 && !/DESCENSO|PERMANENCIA|PROMOCI/i.test(c.liga + ' ' + (c.grupo || '')) && tsH.some(t => t.temporada === c.temporada && t.equipo === c.equipo && t.pj > 0)) : [];
    if (camp.length) G.push({ t: camp.length === 1 ? 'Campeón' : 'Campeón ' + camp.length + ' veces', s: 'Primeros de la liga o del grupo, jugando en el equipo.', n: camp.length, k: 'oro', it: camp.map(c => [c.temporada, eqS(c.equipo, c.liga) + ' · ' + ligaS(c.liga)]) });
    const totL = { pj: tot.pj, g: tot.g, a: tot.a }, cif = [];
    Object.keys(UMBRAL).filter(x => (esPor ? x === 'pj' : x !== 'par')).forEach(x => UMBRAL[x].filter(u => u <= totL[x] && u >= (x === 'pj' ? 50 : 25)).forEach(u => cif.push([String(u), x === 'pj' ? 'PARTIDOS' : x === 'g' ? 'GOLES' : 'ASISTENCIAS'])));
    if (cif.length) G.push({ t: 'Cifras redondas', s: 'Con nosotros: ' + tot.pj + ' partidos' + (esPor ? '.' : ', ' + tot.g + ' goles y ' + tot.a + ' asistencias.'), n: cif.length, k: 'rojo', it: cif });
    const top = (f, t, s) => { const it = tsH.filter(t2 => t2[f] > 0 && t2.pj >= 3 && todosH.every(x => x.temporadas.every(y => !(y.temporada === t2.temporada && y.equipo === t2.equipo) || (y[f] || 0) <= t2[f]))).map(t2 => [t2.temporada, eqS(t2.equipo, t2.liga) + ' · ' + t2[f]]); if (it.length) G.push({ t, s, n: it.length, k: 'gris', it }); };
    if (!esPor) { top('g', j.fem ? 'Máxima goleadora del equipo' : 'Máximo goleador del equipo', 'Temporadas en las que nadie de su equipo marcó más.'); top('a', j.fem ? 'Máxima asistente del equipo' : 'Máximo asistente del equipo', 'Temporadas en las que nadie de su equipo dio más pases de gol.'); }
    const ht = tsH.filter(t => t.hattricks > 0), nHt = ht.reduce((x, t) => x + t.hattricks, 0);
    if (nHt) G.push({ t: 'Hat-tricks', s: 'Partidos con tres goles o más, por temporada.', n: nHt, k: 'gris', it: ht.map(t => [t.temporada, '× ' + t.hattricks]) });
    if (esPor) { const best = tsH.filter(t => t.rol === 'GOALIE' && t.tiros >= 100).map(t => [t, (t.tiros - t.gc) / t.tiros * 100]).filter(x => x[1] >= 85); if (best.length) G.push({ t: 'Por encima del 85 %', s: 'Temporadas con más del 85 % de paradas y al menos 100 tiros.', n: best.length, k: 'gris', it: best.map(([t, v]) => [t.temporada, dec(v.toFixed(1)) + ' %']) }); }
    if (tot.temps >= 3) G.push({ t: 'Temporadas en el club', s: 'Desde ' + ([...temps0].sort()[0] || A.temporada) + (ya.pj ? ', y sigue.' : '.'), n: tot.temps, k: 'gris', it: [...new Set(tsH.map(t => eqS(t.equipo, t.liga)))].map(x => [x, new Set(tsH.filter(t => eqS(t.equipo, t.liga) === x).map(t => t.temporada)).size + ' temp.']) });
    const logK = [[camp.length, 'Títulos', 'oro'], [cif.length, 'Cifras redondas', 'rojo']].concat(esPor ? [] : [[nHt, 'Hat-tricks', 'gris']]).concat([[tot.temps, 'Temporadas', 'gris']]);
    const logros = G.length ? `<div class="lg-k">${logK.map(([v, l, c]) => `<div class="${c}"><b class="cifra">${v}</b><span class="etq">${l}</span></div>`).join('')}</div>
      <div class="lg-g">${G.map(g => `<div class="lg ${g.k}"><div class="lg-c"><span class="lg-m cifra">${g.n}</span><div><b class="h2">${esc(g.t)}</b><span>${esc(g.s)}</span></div></div><div class="lg-it">${g.it.map(([x, y]) => `<span><b class="cifra">${esc(x)}</b><i>${esc(y)}</i></span>`).join('')}</div></div>`).join('')}</div>`
      : '<div class="pv-nota">Todavía sin logros con el club: los irá sumando.</div>';
    // En el equipo (scripts/reporte/juego.py y analisis.json): participación, socios, situación en pista, penaltis y sanciones
    const cxs = j.contexto || {}, tk = Object.keys(cxs).sort().reverse().find(t => cxs[t].pj >= 5) || Object.keys(cxs).sort().reverse()[0], cx = esPor ? null : tk && cxs[tk], aj = ANA && ANA.jugadores[j.k];
    const fotoP = q => { const z = A.jugadores[kOf(q.nombre || '', q.apellidos || '')]; return fotoOK(z) ? z.foto : null; };
    let enEq = '';
    if (cx && cx.gf) { const nG = Math.round(cx.g / cx.gf * 100), nA = Math.round(cx.a / cx.gf * 100);
      enEq += `<div class="tarjeta ee-part"><div><span class="etq">Con ${esc(eqs.map(mpCorto).join(' · ') || 'el equipo')} · ${esc(tk)}</span><b class="cifra">${dec(Math.round(cx.part))}<span>%</span></b><span>de los goles del equipo pasan por ${j.fem ? 'ella' : 'él'}</span></div>
        <div><div class="ee-dots">${Array.from({ length: 100 }, (_, i) => `<i class="${i < nG ? 'g' : i < nG + nA ? 'a' : ''}"></i>`).join('')}</div><div class="cal-ley"><span class="l-por">${cx.g} goles ${j.fem ? 'suyos' : 'suyos'}</span><span class="l-a">${cx.a} asistencias</span><span class="l-d">de ${cx.gf} goles del equipo</span></div></div></div>`;
      const soc = [['Le dan el pase', cx.le, 'pases de gol', 'nos'], [j.fem ? 'Ella se la da a' : 'Él se la da a', cx.aa, 'goles', '']].filter(x => (x[1] || []).length);
      if (soc.length) enEq += `<div class="ee-socs">${soc.map(([t, l, u, c]) => `<div class="tarjeta"><span class="etq">${t}</span><div class="ee-soc">${l.slice(0, 2).map(([q, n]) => { const f = fotoP(q); return `<div><span class="ee-sf">${f ? `<span class="ph" data-bg="${esc(f)}"></span>` : esc(ini(q.nombre, q.apellidos))}</span><b>${esc(nomCorto(q))}</b><span class="cifra ${c}">${n}</span><span>${u}</span></div>`; }).join('')}</div></div>`).join('')}</div>`;
      if (cx.sit && cx.sit.ig + cx.sit.sup + cx.sit.inf) { const tt = cx.sit.ig + cx.sit.sup + cx.sit.inf;
        enEq += `<div class="tarjeta"><span class="etq">Sus goles, según cómo estábamos en pista</span><div class="ee-sit">${[['ig', 'En igualdad', 'r'], ['sup', 'En superioridad', 'v'], ['inf', 'En inferioridad', 'g']].filter(([x]) => cx.sit[x]).map(([x, l, c]) => `<i class="${c}" style="flex:${cx.sit[x]}" title="${l} · ${cx.sit[x]}">${cx.sit[x]}</i>`).join('')}</div>
          <div class="cal-ley"><span class="l-por">En igualdad · ${cx.sit.ig}</span><span class="l-v">En superioridad · ${cx.sit.sup}</span><span class="l-d">En inferioridad · ${cx.sit.inf}</span></div></div>`; } }
    if (aj && (aj.tandas || (aj.faltas && aj.faltas.club.length))) { const pen = [];
      if (aj.tandas && aj.tandas.club[0] + aj.tandas.club[1]) pen.push([aj.tandas.club[0] + '/' + (aj.tandas.club[0] + aj.tandas.club[1]), 'penaltis marcados en tandas', 'nos']);
      (aj.faltas ? aj.faltas.club : []).slice(0, pen.length ? 3 : 4).forEach(([l, v]) => pen.push([v, String(l).toLowerCase(), '']));
      if (pen.length) enEq += `<div class="tarjeta"><span class="etq">Penaltis y sanciones</span><div class="ee-pen">${pen.map(([v, l, c]) => `<div><b class="cifra ${c}">${esc(String(v))}</b><span>${esc(l)}</span></div>`).join('')}</div></div>`; }
    if (!enEq) enEq = '<div class="pv-nota">Necesitamos algunos partidos más para contar cómo juega con el equipo.</div>';
    // Comparar: a quién se parece en su liga (mapa) y el comparador con otro jugador
    const LM = MAPA && e0.ligaId && MAPA.ligas[e0.ligaId], yo = a && a.x;
    const pares = yo && LM ? (esPor ? LM.por || [] : LM.jug).filter(x => x.k !== j.k && x.pj >= 5).map(x => [x, esPor ? Math.abs(x.pct - yo.pct) : Math.hypot((x.x - yo.x) * 10, x.y - yo.y)]).sort((p1, p2) => p1[1] - p2[1]).slice(0, 3) : [];
    const comparar = `<div class="dest">${pares.length ? 'Por cómo juega en ' + esc(LM.nombre || 'su liga') + ', se parece a:' : 'Necesitamos algunos partidos más para comparar.'}</div>
      ${pares.length ? `<div class="pares">${pares.map(([x]) => { const href = x.nuestro && A.jugadores[x.k] ? hP(x.k) : null; return `<${href ? `a href="${href}"` : 'div'} class="tarjeta par"><b>${esc(x.n + ' ' + x.a)}</b><span class="${ours(x.eq) ? 'mp' : ''}">${esc(ours(x.eq) ? etqEq(x.eq, e0.ligaId) : x.eq)}</span><span>${esPor ? dec(x.pct.toFixed(1)) + ' % de paradas' : dec(x.gl.toFixed(1)) + ' goles y ' + dec(x.al.toFixed(1)) + ' asist. por partido'}</span></${href ? 'a' : 'div'}>`; }).join('')}</div>` : ''}
      ${esPor ? '' : `<div data-comparar="${esc(j.k)}"></div>`}`;
    // Partidos de esta temporada: el gráfico partido a partido, la lista y sus goles en vídeo
    const partidosF = (j.partidos || []).slice().reverse().map(x => { const p = A.partidos[x.mid]; if (!p) return '';
      const mio = [p.alin_l, p.por_l, p.gol_l].some(l => (l || []).some(y => y.k === j.k)) ? p.local : p.visitante, Rr = resLado(p, mio);
      return `<a class="fi-p ${Rr.r.toLowerCase()}" href="${hM(x.mid)}">${escudo(x.rival, 40)}<div><span>J${p.jornada} · ${esc(fd(p.fecha))}</span><b>${esc(x.rival)}</b><span class="fi-p-r">${Rr.r === 'V' ? 'Ganado' : 'Perdido'} ${Rr.nos}–${Rr.ell}${Rr.pen ? ' (penaltis)' : ''}</span></div><span class="cifra">${esPor && x.pct != null ? dec(Math.round(x.pct)) + ' %' : (x.g || 0) + 'G ' + (x.a || 0) + 'A'}</span></a>`; }).join('');
    const partidos = (j.partidos || []).length ? `${svgTemporada(j)}<div class="fi-ps">${partidosF}</div><div data-goles-video="${esc(j.k)}"></div>` : '<div class="pv-nota">Aún no ha jugado esta temporada.</div>';
    const TB = pestanas('ficha', [['temp', 'Temporadas'], ['log', 'Logros'], ['eq', 'En el equipo'], ['comp', 'Comparar'], ['part', 'Partidos']], 'temp');
    return `<div class="ficha2">${cab}${TB.nav}${TB.panel('temp', mejorP + evo + temporadas + fueraH)}${TB.panel('log', logros)}${TB.panel('eq', `<div class="ee">${enEq}</div>${comoL('ficha')}`)}${TB.panel('comp', comparar + comoL('mapa'))}${TB.panel('part', partidos)}</div>`;
  }

  /* ── Liga (#/liga/<id>[/evolucion|/mapa|/acertamos|/j/N] · rediseño, fase 5): cabecera con nuestro puesto y la barra
     de jornadas, las cuatro ligas, el archivo de la pretemporada y cinco pestañas: Clasificación (con líderes),
     Jornadas (con pronóstico), Evolución, Mapa y ¿Acertamos? ── */
  let LG_PEDIDO = false;
  const mpCortoN = (n, lid) => ours(n) ? largoEq(n, lid).replace('MADRIDPATINA ', 'MP ').replace('ALEVÍN', 'Alevín').replace('INFANTIL', 'Infantil') : n;
  const tempAnt = () => { const y = +A.temporada.slice(0, 4) - 1; return y + '/' + String(y + 1).slice(2); };   // «2025/26» si estamos en 2026/27
  const ganadorDe = c => { if (c.gl == null) return null; if (c.gl !== c.gv) return c.gl > c.gv ? c.local : c.visitante; const p = c.mid && A.partidos[c.mid]; return p && p.pen ? p.pen : null; };
  // puesto de cada equipo después de la jornada «hasta» (victoria 3 · ganar en penaltis 2 · perder en penaltis 1)
  function puestosHasta(L, hasta) {
    const t = {}; L.clasif.forEach(c => { t[c.equipo] = { pts: 0, gf: 0, gc: 0 }; });
    (L.cal || []).filter(c => c.gl != null && c.j <= hasta).forEach(c => { const a = t[c.local], b = t[c.visitante]; if (!a || !b) return;
      a.gf += c.gl; a.gc += c.gv; b.gf += c.gv; b.gc += c.gl;
      if (c.gl !== c.gv) (c.gl > c.gv ? a : b).pts += 3; else { const w = ganadorDe(c); if (w) { (w === c.local ? a : b).pts += 2; (w === c.local ? b : a).pts += 1; } else { a.pts += 1; b.pts += 1; } } });
    return Object.entries(t).sort((x, y) => y[1].pts - x[1].pts || (y[1].gf - y[1].gc) - (x[1].gf - x[1].gc) || y[1].gf - x[1].gf || x[0].localeCompare(y[0], 'es')).map(([n], i) => [n, i + 1]);
  }
  // ¿Acertamos?: solo pronósticos guardados antes del día del partido y con acta; los penaltis cuentan para quien los ganó
  function acDe(lid) {
    const L = lgOf(lid), ok = [], fuera = []; if (!L || !PRON) return { ok, fuera };
    Object.values(PRON).filter(x => x.liga === lid).forEach(x => { const c = (L.cal || []).find(c2 => c2.j == x.j && c2.local === x.local && c2.visitante === x.visitante); if (!c || c.gl == null) return;
      if (c.sinActa) { fuera.push('acta'); return; }
      if ((x.hecho || '').slice(0, 10) >= x.fecha) { fuera.push('tarde'); return; }
      const g = ganadorDe(c); if (!g) { fuera.push('acta'); return; }
      const w = g === x.local ? 'L' : 'V', fav = x.pL >= x.pV ? 'L' : 'V', pf = Math.max(x.pL, x.pV), hit = w === fav;
      // quién iba por delante en la clasificación antes de ese partido
      const pts = {}; L.cal.filter(z => z.gl != null && z.fecha < x.fecha).forEach(z => { const ww = ganadorDe(z); if (!ww) return; const pen = z.gl === z.gv, pd = ww === z.local ? z.visitante : z.local;
        pts[ww] = (pts[ww] || 0) + (pen ? 2 : 3); pts[pd] = (pts[pd] || 0) + (pen ? 1 : 0); });
      const pl = pts[x.local], pv = pts[x.visitante], lead = pl == null || pv == null || pl === pv ? null : pl > pv ? 'L' : 'V';
      ok.push({ x, c, w, fav, pf, hit, sorp: !hit && pf >= .55, lead, leadHit: lead ? lead === w : null, pen: c.gl === c.gv }); });
    return { ok, fuera };
  }
  const escL = (n, size) => escudo(n, size);
  function vLiga2(id, sub, jn) {
    if (!LG_PEDIDO && (!MAPA || !PRON)) {
      LG_PEDIDO = true; const h = location.hash;
      Promise.all([cargarMapa(), cargarPron()]).then(() => { if (location.hash === h) render(); });
      return '<div class="carga" role="status" aria-label="Cargando"><div class="sk" style="height:220px;margin-top:24px"></div><div class="carga-tarjetas"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div></div>';
    }
    const L = lgOf(id) || A.ligas[0]; S.lg = L.id;
    const hoy = hoyISO(), nE = L.clasif.length, ult = L.ultima || 0;
    // la dirección elige la pestaña (enlaces de siempre: /evolucion, /mapa, /j/N)
    if (sub === 'evolucion' || sub === 'mapa' || sub === 'acertamos') TAB_SEL.liga = sub === 'acertamos' ? 'ac' : sub === 'evolucion' ? 'evo' : 'mapa';
    else if (sub === 'j') TAB_SEL.liga = 'jor';

    // cabecera: categoría, nombre, nuestro puesto y la barra de jornadas
    const nos = L.clasif.filter(c => c.nuestro);
    const usB = nos.map(c => `<div class="lg-us"><span class="lg-us-p"><span class="cifra">${c.puesto}º</span></span><span class="lg-us-t"><b>${esc(mpCortoN(c.equipo, L.id))}</b><span>${c.pts} pts · de ${nE}</span></span></div>`).join('');
    const prog = Array.from({ length: L.total || 0 }, (_, i) => `<i${i < ult ? ' class="on"' : ''}></i>`).join('');
    const hero = `<div class="lg-hero"><span class="lg-ghost" aria-hidden="true">${esc((L.corto || '').split(' ').pop())}</span>
      <div class="lg-tit"><span class="etq">${esc((L.categoria || '').toUpperCase())} · ${esc(A.temporada)}</span><h1 class="h1">${esc(L.nombre)}</h1></div>
      ${usB ? `<div class="lg-uss">${usB}</div>` : ''}
      <div class="lg-prog"><div class="lg-prog-t"><span>Jornada ${ult} de ${L.total}</span><span>${L.total ? Math.round(ult / L.total * 100) + ' % jugado' : ''}</span></div><div class="lg-prog-b">${prog}</div></div></div>`;
    const pills = `<nav class="lg-pills" aria-label="Ligas">${A.ligas.map(l => { const on = l.id === L.id, p = (l.corto || l.nombre).split(' '), eqs = A.equipos.filter(e => e.ligaId === l.id).map(mpCorto).map(s => s.toUpperCase());
      return `<a class="lg-pill" href="${hLg(l.id)}"${on ? ' aria-current="page"' : ''}><span class="etq">${esc(p.slice(0, -1).join(' ').toUpperCase())}</span><b>DIV. ${esc(p[p.length - 1])}</b><span class="lg-pill-us">${esc(eqs.join(' · '))}</span></a>`; }).join('')}</nav>`;
    const hayPre = L.pre && L.pre.equipos && L.pre.equipos.length;
    const archivo = `<a class="archivo" href="${hPre(hayPre ? L.id : 'club')}"><div><div class="etq">Pretemporada ${esc(A.temporada)}</div><div class="h2">Antes de empezar</div><div class="sub">${hayPre ? (L.pre.equipos.some(e => e.tipo === 'sube' || e.tipo === 'baja' || e.tipo === 'nuevo') ? 'Ascensos, descensos y quién ha cambiado de equipo' : 'Quién ha llegado y quién se ha ido') : 'Cómo llegaba cada uno de nuestros equipos'}</div></div><span class="ir">Ver</span></a>`;
    const T = pestanas('liga', [['clas', 'Clasificación'], ['jor', 'Jornadas'], ['evo', 'Evolución'], ['mapa', 'Mapa'], ['ac', '¿Acertamos?']], 'clas');

    // Clasificación: G y P con los penaltis (victoria 3, ganar en penaltis 2, perder en penaltis 1) y la barra de puntos
    const top = Math.max(1, L.clasif[0] ? L.clasif[0].pts : 1);
    const filas = L.clasif.map(c => { const pw = Math.max(0, Math.min(c.e || 0, c.pts - 3 * c.v - (c.e || 0))), pl = (c.e || 0) - pw, mv = c.cambio_puesto || 0;
      return `<a class="lg-f${c.nuestro ? ' nos' : ''}${c.puesto <= 3 ? ' top' : ''}${c.puesto === 1 ? ' uno' : ''}" href="${hT(c.equipo) || hLg(L.id)}"><span class="lg-f-p"><b class="cifra">${c.puesto}</b>${mv ? `<span class="${mv > 0 ? 'sube' : 'baja'}">${mv > 0 ? '▲' + mv : '▼' + -mv}</span>` : ''}</span>
        <span class="lg-f-e">${escL(c.equipo, 28)}<b>${esc(largoEq(c.equipo, L.id))}</b></span><span class="lg-f-n">${c.pj}</span><span class="lg-f-n g">${c.v + pw}</span><span class="lg-f-n p">${c.d + pl}</span>
        <span class="lg-f-n gl">${c.gf}–${c.gc}</span><b class="cifra lg-f-pts">${c.pts}</b><span class="lg-f-bar"><i data-bx style="--i:${c.puesto - 1};width:${(c.pts / top * 100).toFixed(1)}%"></i></span></a>`; }).join('');
    const clasif = `<div class="lg-tabla" data-dib><div class="lg-f cab"><span></span><span>Equipo</span><span class="lg-f-n">PJ</span><span class="lg-f-n">G</span><span class="lg-f-n">P</span><span class="lg-f-n gl">Goles</span><span class="lg-f-pts">Pts</span></div>${filas}
      <div class="pv-nota">G y P cuentan los penaltis: victoria 3 puntos, ganar en penaltis 2, perder en penaltis 1.</div></div>`;
    const LT = [['goleadores', 'Goleador', x => x.goles], ['asistentes', 'Asistente', x => x.asistencias], ['porteros', 'Portero', x => dec((+x.pct_paradas || 0).toFixed(1)) + '%'], ['sancionados', 'Más sancionado', x => fmin(x.minutos)]];
    const lideres = (L.lideres ? LT.filter(([k]) => (L.lideres[k] || []).length) : []).map(([k, t, f]) => { const ls = L.lideres[k], x = ls[0], u = ls.find(y => y.nuestro), ui = u ? ls.indexOf(u) : -1, kx = kOf(x.nombre, x.apellidos), h = hP(kx);
      const fx = x.foto && !x.menor ? x.foto : null;   // con foto (solo adultos), la foto en la mitad derecha; si no, la inicial grande
      return `<${h ? `a href="${h}"` : 'div'} class="lg-lid${k === 'sancionados' ? ' sanc' : ''}">${fx ? `<span class="lg-lid-f" aria-hidden="true" data-bg="${esc(fx)}"></span>` : `<span class="lg-lid-g" aria-hidden="true">${esc(ini(x.nombre, x.apellidos))}</span>`}<span class="etq">${t}</span>
        <span class="lg-lid-c"><span class="lg-lid-n"><b${x.nuestro ? ' class="nos"' : ''}>${esc(nomCorto(x))}</b><span>${esc(largoEq(x.equipo, L.id))}</span></span><b class="cifra">${esc(f(x))}</b></span>
        ${u && ui > 0 ? `<span class="lg-lid-us">El mejor de los nuestros: ${esc(nomCorto(u))}, ${ui + 1}º con ${esc(f(u))}</span>` : ''}</${h ? 'a' : 'div'}>`; }).join('');
    const f1 = (L.cal || []).map(c => c.fecha).filter(Boolean).sort()[0], diaL = f => { const [y, m, d] = f.split('-').map(Number), x = new Date(y, m - 1, d); return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][x.getDay()] + ' ' + d + ' de ' + MES_L[m - 1]; };
    const pClas = !L.clasif.some(c => c.pj > 0) ? casoHtml('Ligas · Clasificación', 'Todavía no ha empezado', (f1 ? 'La primera jornada es el ' + diaL(f1) + '. ' : '') + 'Mientras tanto, lo que sabemos de cada equipo está en la pretemporada.', 'J0', 'neutro', hayPre ? [['Ver pretemporada', hPre(L.id)]] : [])
      : clasif + (lideres ? `<div class="lg-lids-w"><h2 class="h2">Líderes</h2><div class="lg-lids">${lideres}</div></div>` : '');

    // Jornadas: una a una con flechas; nuestros partidos primero; pronóstico en cada partido
    const porJ = {}; (L.cal || []).forEach(c => { (porJ[c.j] = porJ[c.j] || []).push(c); });
    const nums = Object.keys(porJ).map(Number).sort((a, b) => a - b);
    const prox = nums.find(n => porJ[n].some(c => c.gl == null && (!c.fecha || c.fecha >= hoy)));
    const jIni = jn && porJ[jn] ? jn : prox || ult || nums[0];
    const tarjetaJ = c => { const jugado = c.gl != null, w = jugado ? ganadorDe(c) : null, pen = jugado && c.gl === c.gv ? w : null, nuestro = ours(c.local) || ours(c.visitante), derbi = ours(c.local) && ours(c.visitante);
      const pend = !jugado && c.fecha && c.fecha < hoy, P = PRON && PRON[L.id + '|' + c.j + '|' + c.local + '|' + c.visitante], pL = P ? Math.round(P.pL * 100) : 0, pV = P ? Math.round(P.pV * 100) : 0;
      const href = jugado && c.mid && A.partidos[c.mid] ? hM(c.mid) : c.fecha ? hPar(L.id, c.j, c.local, c.visitante) : null;
      const lado = (n, g, gana) => `<span class="jm-e${ours(n) ? ' nos' : ''}">${escL(n, 40)}<b>${esc(mpCortoN(n, L.id))}</b></span>`;
      const marc = jugado ? `<span class="jm-r cifra"><span${w === c.local ? ' class="gana"' : ''}>${c.gl}${pen === c.local ? '<span class="b-pen">B</span>' : ''}</span><i>–</i><span${w === c.visitante ? ' class="gana"' : ''}>${c.gv}${pen === c.visitante ? '<span class="b-pen">B</span>' : ''}</span></span>` : '<span class="jm-r cifra vs">vs</span>';
      const fav = P ? (pL >= pV ? c.local : c.visitante) : null;
      const pron = P ? `<div class="jm-pron"><div class="bpron lg-bp" aria-hidden="true"><i class="${ours(c.local) ? '' : 'riv'}" style="width:${pL}%"></i><i class="pen" style="width:${Math.max(0, 100 - pL - pV)}%"></i><i class="${ours(c.visitante) ? '' : 'riv'}" style="width:${pV}%"></i></div>
        <span>${jugado ? 'Pronóstico' : 'Favorito'}: ${esc(mpCortoN(fav, L.id))} · ${Math.max(pL, pV)} % · penaltis ${Math.max(0, 100 - pL - pV)} %</span></div>` : '';
      const tag = pend ? `<span class="chip ambar">${c.sinActa ? 'ACTA PENDIENTE' : 'SIN RESULTADO'}</span>` : derbi ? '<span class="chip derbi">DERBI</span>' : '';
      return `<${href ? `a href="${href}"` : 'div'} class="jm${nuestro ? ' nos' : ''}"><div class="jm-c"><span class="etq">${c.fecha ? esc(fd(c.fecha)) + (c.hora ? ' · ' + esc(c.hora) : '') : 'Fecha por fijar'}</span>${tag}</div>
        <div class="jm-x">${lado(c.local)}${marc}${lado(c.visitante)}</div>${pron}</${href ? 'a' : 'div'}>`; };
    const paneles = nums.map(n => { const cs = porJ[n].slice().sort((a, b) => ((ours(b.local) || ours(b.visitante)) - (ours(a.local) || ours(a.visitante))) || ((a.fecha || '9') + (a.hora || '')).localeCompare((b.fecha || '9') + (b.hora || ''))),
        fs = cs.map(c => c.fecha).filter(Boolean).sort(), en = new Set(cs.flatMap(c => [c.local, c.visitante])), desc = L.clasif.map(r => r.equipo).filter(e => !en.has(e));
      return `<div class="lg-j" data-jor="${n}"${n === jIni ? '' : ' hidden'}><div class="lg-j-nav"><button type="button" class="lg-j-fl" data-jor-ir="-1" aria-label="Jornada anterior"${n === nums[0] ? ' disabled' : ''}><svg viewBox="0 0 12 40" preserveAspectRatio="none"><polyline points="10,2 2,20 10,38"/></svg></button>
        <div class="lg-j-t"><span class="h1">Jornada <span>${n}</span></span><span class="etq">${fs.length ? esc(fd(fs[0])) + (fs[fs.length - 1] !== fs[0] ? ' – ' + esc(fd(fs[fs.length - 1])) : '') : 'Fechas por fijar'}</span></div>
        <button type="button" class="lg-j-fl" data-jor-ir="1" aria-label="Jornada siguiente"${n === nums[nums.length - 1] ? ' disabled' : ''}><svg viewBox="0 0 12 40" preserveAspectRatio="none"><polyline points="2,2 10,20 2,38"/></svg></button></div>
        <div class="lg-ms">${cs.map(tarjetaJ).join('')}</div>${desc.length ? `<div class="lg-desc">Descansa: ${desc.map(e => esc(mpCortoN(e, L.id))).join(', ')}</div>` : ''}</div>`; }).join('');
    const pJor = `<div class="lg-js">${paneles || '<div class="pv-nota">Sin partidos en el calendario.</div>'}</div>`;

    // Evolución: el puesto de cada equipo jornada a jornada (nosotros en rojo, con el puesto en cada punto). Con varios equipos
    // nuestros en la liga (Senior 4), cada uno con su trazo y su letra en cada punto, y la leyenda encima
    let pEvo;
    if (ult >= 1) {
      const eqs = L.clasif.map(c => c.equipo), pos = {};
      for (let j = 1; j <= ult; j++) (j === ult ? L.clasif.map(c => [c.equipo, c.puesto]) : puestosHasta(L, j)).forEach(([n, p]) => { (pos[n] = pos[n] || [])[j - 1] = p; });
      const X = j => ult === 1 ? 50 : 3 + j / (ult - 1) * 94, Y = p => (p - 1) / Math.max(1, nE - 1) * 100;
      const path = n => 'M' + (pos[n] || []).map((p, j) => X(j).toFixed(2) + ' ' + Y(p).toFixed(2)).join(' L');
      const letra = n => (eqDeLiga(n, L.id) || {}).id || '', us = eqs.filter(ours).sort((a, b) => letra(a).localeCompare(letra(b))), fin = n => (pos[n] || [])[ult - 1] || nE;
      const varios = us.length > 1, TRAZO = ['', '8 5', '2 5'];
      const ley = varios ? `<div class="lg-evo-ley">${us.map((n, i) => `<span><svg viewBox="0 0 30 10" aria-hidden="true"><line x1="1" y1="5" x2="29" y2="5" stroke-dasharray="${TRAZO[i % 3]}"/></svg><i class="lg-evo-lp">${esc(letra(n))}</i>${esc(mpCortoN(n, L.id))}</span>`).join('')}</div>` : '';
      pEvo = `<div class="tarjeta lg-evo" data-dib>${ley}<div class="lg-evo-g" role="img" aria-label="Puesto de cada equipo jornada a jornada">
          <div class="lg-evo-y">${eqs.map((_, i) => `<span style="top:${Y(i + 1).toFixed(2)}%">${i + 1}º</span>`).join('')}</div>
          <div class="lg-evo-p">${eqs.map((_, i) => `<i style="top:${Y(i + 1).toFixed(2)}%"></i>`).join('')}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">${eqs.filter(n => !ours(n)).map(n => `<path d="${path(n)}" class="otro"/>`).join('')}${us.map((n, k) => `<path d="${path(n)}" class="nos"${varios && TRAZO[k % 3] ? ` stroke-dasharray="${TRAZO[k % 3]}"` : ''}/>`).join('')}</svg>
            ${us.flatMap(n => (pos[n] || []).map((p, i) => `<span class="lg-evo-pt" style="left:${X(i).toFixed(2)}%;top:${Y(p).toFixed(2)}%" title="${esc(mpCortoN(n, L.id) + ' · J' + (i + 1) + ' · ' + p + 'º')}">${varios ? esc(letra(n)) : p}</span>`)).join('')}</div>
          <div class="lg-evo-fin">${eqs.map(n => `<span class="${ours(n) ? 'nos' : ''}" style="top:${Y(fin(n)).toFixed(2)}%">${esc(mpCortoN(n, L.id))}</span>`).join('')}</div>
          <div></div><div class="lg-evo-x">${Array.from({ length: ult }, (_, i) => `<span style="left:${X(i).toFixed(2)}%">J${i + 1}</span>`).join('')}</div><div></div></div>
          <div class="lg-evo-l">${eqs.slice().sort((a, b) => fin(a) - fin(b)).map(n => `<span class="${ours(n) ? 'nos' : ''}"><b>${fin(n)}º</b>${esc(mpCortoN(n, L.id))}</span>`).join('')}</div></div>`;
    } else pEvo = '<div class="pv-nota">Esta liga todavía no ha empezado.</div>';

    // Mapa: cada punto, un jugador con al menos 3 partidos; en rojo los nuestros; con nombre, los que más destacan
    const ML = (MAPA && MAPA.ligas && MAPA.ligas[L.id]) || { jug: [] }, jx = ML.jug.filter(j => (j.pj || 3) >= 3);
    let pMapa;
    if (jx.length) {
      const mxX = Math.max(1, ...jx.map(j => j.x)), avgX = jx.reduce((s2, j) => s2 + j.x, 0) / jx.length, avgY = jx.reduce((s2, j) => s2 + j.y, 0) / jx.length;
      const PX = v => v / mxX * 92 + 4, PY = v => v * .9 + 5;
      const ord = jx.slice().sort((a, b) => a.nuestro - b.nuestro);
      const puntos = ord.map(j => `<button type="button" class="lg-mp-pt${j.nuestro ? ' nos' : ''}" style="left:${PX(j.x).toFixed(1)}%;bottom:${PY(j.y).toFixed(1)}%" data-mp="${esc(j.k)}" aria-label="${esc(j.n + ' ' + j.a)}"></button>`).join('');
      const nosJ = ML.jug.filter(j => j.nuestro).sort((a, b) => b.x - a.x), riv = jx.filter(j => !j.nuestro).sort((a, b) => b.x - a.x);
      const etq = (j, us) => { const x = PX(j.x); return `<span class="lg-mp-et${us ? ' nos' : ''}${x > 55 ? ' izq' : ''}" style="left:${x.toFixed(1)}%;bottom:${PY(j.y).toFixed(1)}%">${esc(nomCorto({ nombre: j.n, apellidos: j.a }))}</span>`; };
      const cuad = [['Goleadores', 'marcan más que reparten', 'rd'], ['Pasadores', 'reparten más que marcan', 'bd'], ['Apoyo', 'menos puntos', 'bi']]
        .map(([t, s2, c]) => `<span class="lg-mp-q ${c}"><b>${t}</b><span>${s2}</span></span>`).join('');
      // datos de cada punto para la línea de abajo (sin recargar)
      const info = Object.fromEntries(jx.map(j => [j.k, [nomCorto({ nombre: j.n, apellidos: j.a }), ours(j.eq) ? mpCortoN(j.eq, L.id) : j.eq, dec(j.x.toFixed(2)), j.zona || '', A.jugadores[j.k] && ours(j.eq) ? hP(j.k) : '']]));
      pMapa = `<div class="dest">Cada punto es un jugador de la liga con al menos 3 partidos. En rojo, los nuestros; con nombre, los que más destacan. Toca un punto para ver quién es.</div>
        <div class="tarjeta lg-mp"><div class="lg-mp-y"><span>Más goleador ↑</span></div>
          <div class="lg-mp-c" role="img" aria-label="Mapa de jugadores de la liga" data-mapa-info="${esc(JSON.stringify(info))}">
            <div class="lg-mp-zona" style="left:${PX(avgX).toFixed(1)}%;bottom:${PY(avgY).toFixed(1)}%"></div><div class="lg-mp-vx" style="left:${PX(avgX).toFixed(1)}%"></div><div class="lg-mp-hx" style="bottom:${PY(avgY).toFixed(1)}%"></div>
            ${cuad}${puntos}${nosJ.slice(0, 3).map(j => etq(j, true)).join('')}${riv.slice(0, 2).map(j => etq(j, false)).join('')}
            <span class="lg-mp-media" style="left:calc(${PX(avgX).toFixed(1)}% + 4px)">media de la liga</span></div>
          <div></div><div class="lg-mp-x"><span>Menos puntos</span><span>Más puntos por partido →</span></div></div>
        <div class="lg-mp-sel" aria-live="polite"><span class="pv-nota">Toca un punto para ver quién es.</span></div>
        ${nosJ.length ? `<details class="lg-mp-nos"><summary>Los nuestros · ${nosJ.length}</summary><div>${nosJ.map(j => { const h = A.jugadores[j.k] ? hP(j.k) : null; return `<${h ? `a href="${h}"` : 'span'} class="lg-mp-ch"><i></i>${esc(nomCorto({ nombre: j.n, apellidos: j.a }))}<span>${esc(j.zona || '')}</span></${h ? 'a' : 'span'}>`; }).join('')}</div></details>` : ''}`;
    } else pMapa = '<div class="pv-nota">Todavía no hay jugadores con 3 partidos en esta liga.</div>';

    // ¿Acertamos?
    const R = acDe(L.id), allOk = A.ligas.flatMap(l => acDe(l.id).ok);
    let pAc;
    if (!R.ok.length) {
      const proxL = Object.values(PRON || {}).filter(x => x.liga === L.id && x.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      pAc = `<div class="tarjeta ac-vacio"><div class="h1">Todavía no podemos decirlo</div><div class="dest">En esta liga todavía no se ha jugado ningún partido con pronóstico guardado antes.${proxL ? ' El primero se comprobará después del ' + esc(fd(proxL.fecha).toLowerCase()) + '.' : ''}${allOk.length ? ' En el resto de ligas llevamos ' + allOk.filter(o => o.hit).length + ' de ' + allOk.length + '.' : ''}</div></div>`;
    } else {
      const ord = R.ok.slice().sort((a, b) => (b.x.nuestro - a.x.nuestro) || a.x.fecha.localeCompare(b.x.fecha) || (a.x.hora || '').localeCompare(b.x.hora || ''));
      const fs = [...new Set(R.ok.map(o => o.x.fecha))].sort(), n = R.ok.filter(o => o.hit).length, N = R.ok.length, q1 = Math.round(n / N * 100);
      const bloques = ord.map(o => `<span class="ac-b${o.hit ? ' v' : ''}${o.sorp ? ' sorp' : ''}" title="${esc(o.x.local + ' ' + o.c.gl + '–' + o.c.gv + ' ' + o.x.visitante)}">${o.x.nuestro ? 'MP' : ''}</span>`).join('');
      const cal = [[0, .5, 'menos del 50 %'], [.5, .6, '50–60 %'], [.6, 1.01, 'más del 60 %']].map(([lo, hi, r]) => { const g = allOk.filter(o => o.pf >= lo && o.pf < hi); if (!g.length) return '';
        const w = g.filter(o => o.hit).length, pm = g.reduce((s2, o) => s2 + o.pf, 0) / g.length * 100;
        return `<div class="ac-cal"><div class="ac-cal-t"><span>Les dimos ${r}</span><span>ganaron ${w} de ${g.length}</span></div><div class="ac-cal-b"><i data-bx style="width:${(w / g.length * 100).toFixed(1)}%"></i><em style="left:${pm.toFixed(1)}%"></em></div></div>`; }).join('');
      const conL = R.ok.filter(o => o.lead), a3 = conL.filter(o => o.hit).length, b3 = conL.filter(o => o.leadHit).length;
      const q3t = conL.length ? (a3 > b3 ? 'Acertamos más que la clasificación' : a3 < b3 ? 'La clasificación acertó más que nosotros' : 'Empatados con la clasificación') + `, en los ${conL.length} partidos en los que un equipo iba por delante.` : 'Todavía no hay partidos en los que un equipo fuera por delante en la clasificación.';
      const lista = ord.map(o => { const x = o.x, us = ours(x.local) || ours(x.visitante), derbi = ours(x.local) && ours(x.visitante), pL = Math.round(x.pL * 100), pV = Math.round(x.pV * 100);
        const fila = (sd, nm, p, g) => `<div class="ac-e${o.w === sd ? '' : ' pierde'}"><b${ours(nm) ? ' class="nos"' : ''}>${esc(largoEq(nm, L.id))}</b><span>${Math.round(p * 100)} %</span><span class="cifra">${g}${o.pen && o.w === sd ? '<span class="b-pen">B</span>' : ''}</span></div>`;
        const tag = o.hit ? '<span class="chip v">ACIERTO</span>' : o.sorp ? '<span class="chip ambar">SORPRESA</span>' : '<span class="chip neutro">FALLO</span>';
        return `<a class="ac-m${us ? ' nos' : ''}" href="${o.c.mid && A.partidos[o.c.mid] ? hM(o.c.mid) : hPar(L.id, x.j, x.local, x.visitante)}"><div class="ac-m-c">${tag}<span>J${x.j} · ${esc(fd(x.fecha))}</span></div>${fila('L', x.local, x.pL, o.c.gl)}${fila('V', x.visitante, x.pV, o.c.gv)}
          <div class="bpron lg-bp" aria-hidden="true"><i class="${ours(x.local) ? '' : 'riv'}" style="width:${pL}%"></i><i class="pen" style="width:${Math.max(0, 100 - pL - pV)}%"></i><i class="${ours(x.visitante) ? '' : 'riv'}" style="width:${pV}%"></i></div>
          <span class="ac-m-n">${derbi ? 'Derbi · ' : ''}Favorito: ${esc(largoEq(o.fav === 'L' ? x.local : x.visitante, L.id))} al ${Math.round(o.pf * 100)} %${o.pen ? ' · decidido en los penaltis' : ''}</span></a>`; }).join('');
      const nT = R.fuera.filter(f => f === 'tarde').length, nA = R.fuera.filter(f => f === 'acta').length;
      const fuera = nT + nA ? 'No cuentan: ' + [nT ? nT + (nT === 1 ? ' partido aplazado cuyo pronóstico se calculó después de jugarse' : ' partidos aplazados con pronóstico calculado después de jugarse') : '', nA ? nA + ' con el acta pendiente' : ''].filter(Boolean).join(' y ') + '.' : '';
      pAc = `<div class="tarjeta ac-cab"><div class="ac-cab-t"><div><span class="etq">Desde que guardamos pronósticos · ${esc(fd(fs[0]))}${fs.length > 1 ? ' – ' + esc(fd(fs[fs.length - 1])) : ''}</span><span class="ac-big">Acertamos <b>${n}</b> de ${N}</span></div>
          <div class="ac-club"><span class="etq">En las cuatro ligas</span><b class="cifra">${allOk.filter(o => o.hit).length} de ${allOk.length}</b></div></div>
        <div class="ac-bs">${bloques}</div><div class="cal-ley"><span class="l-v">Acierto</span><span class="l-fut">Fallo</span><span class="l-sorp">Sorpresa: ganó el que tenía menos opciones</span></div></div>
        <div class="ac-qs"><div class="tarjeta ac-q"><span class="etq">1 · ¿Gana el favorito?</span><b class="cifra ac-q1 ${q1 >= 50 ? 'v' : 'd'}">${q1}<span> %</span></b><span class="ac-q-t">${N === 1 ? (n ? 'El que tenía más opciones ganó el único partido.' : 'El que tenía más opciones perdió el único partido.') : `El que tenía más opciones ganó ${n} de ${N} partidos.`} Los penaltis cuentan para quien los ganó.</span></div>
          <div class="tarjeta ac-q" data-dib><span class="etq">2 · ¿Son creíbles los porcentajes?</span>${cal}<span class="pv-nota">Barra: lo que pasó. Raya blanca: lo que dijimos. Cuanto más cerca, más creíbles. Con ${allOk.length} partidos de las cuatro ligas, todavía dice poco.</span></div>
          <div class="tarjeta ac-q"><span class="etq">3 · ¿Mejor que ir con el de arriba?</span><div class="ac-q3"><div class="nos"><b class="cifra">${a3}</b><span>nuestro pronóstico</span></div><div><b class="cifra">${b3}</b><span>el que va por delante</span></div></div><span class="ac-q-t">${q3t}</span></div></div>
        <div class="ac-lista-w"><h2 class="h2">Partido a partido</h2><div class="ac-lista">${lista}</div>${fuera ? `<div class="pv-nota">${fuera}</div>` : ''}</div>`;
    }
    return `<div class="liga2"><div class="lg-arriba">${hero}${pills}</div>${archivo}${T.nav}${T.panel('clas', pClas)}${T.panel('jor', pJor)}${T.panel('evo', pEvo)}${T.panel('mapa', pMapa + comoL('mapa'))}${T.panel('ac', pAc + comoL('probabilidad'))}</div>`;
  }
  // jornadas: flechas anterior / siguiente sin recargar
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-jor-ir]'); if (!b || !view.contains(b)) return;
    const act = b.closest('[data-jor]'), todas = [...view.querySelectorAll('.lg-j')], i = todas.indexOf(act), sig = todas[i + +b.dataset.jorIr]; if (!sig) return;
    act.hidden = true; sig.hidden = false; if (MOV) repetir(sig, 'mpFade .18s ease-out');
    const f = sig.querySelector('[data-jor-ir="' + b.dataset.jorIr + '"]'); if (f && !f.disabled) f.focus(); else { const o = sig.querySelector('[data-jor-ir]:not([disabled])'); if (o) o.focus(); }
  });
  // mapa: al tocar un punto, quién es (nombre, equipo, puntos por partido) y, si es de los nuestros, su ficha
  document.addEventListener('click', e => {
    const p = e.target.closest && e.target.closest('[data-mp]'); if (!p || !view.contains(p)) return;
    const caja = p.closest('[data-mapa-info]'), info = JSON.parse(caja.dataset.mapaInfo)[p.dataset.mp], sel = view.querySelector('.lg-mp-sel'); if (!info || !sel) return;
    caja.querySelectorAll('.lg-mp-pt.sel').forEach(x => x.classList.remove('sel')); p.classList.add('sel');
    sel.innerHTML = `<b>${esc(info[0])}</b><span>${esc(info[1])} · ${esc(info[2])} puntos por partido${info[3] ? ' · ' + esc(info[3]) : ''}</span>${info[4] ? `<a class="ir" href="${info[4]}">Ficha</a>` : ''}`;
  });

  /* ── Pretemporada (#/pretemporada/<club|liga> · rediseño, fase 5): archivo de lo que sabíamos antes de la jornada 1.
     Del club: cifras y una tarjeta por equipo. De cada liga: el contexto, la escalera (quién sube y quién baja, o de
     dónde sale cada equipo), quién tiene más plantilla, nuestros equipos con quién llega y quién se va, y a quién vigilar ── */
  const TIPO_PRE = { sigue: ['SIGUE', 'neutro'], sube: ['SUBE', 'v'], baja: ['BAJA', 'd'], viene: ['VIENE', 'neutro'], nuevo: ['NUEVO', 'derbi'] };
  // la cantera: los pasos entre Alevín e Infantil no son altas ni bajas (muchos juegan en los dos)
  const altasPre = (e, L) => (e.altas || []).filter(x => !(L.cantera && x.desde === 'MADRIDPATINA'));
  const bajasPre = (e, L) => (e.bajas || []).filter(x => !(L.cantera && x.destino === 'MADRIDPATINA'));
  const vanPre = (e, L) => bajasPre(e, L).filter(b => b.estado === 'se_va').length;
  const siguenPre = e => Math.max(0, ((e.p || {}).jugadores_hoy || 0) - ((e.p || {}).nuevos || 0));
  const signo = (s, n) => n ? s + n : '0';
  function vPretemporada2(id) {
    const ls = A.ligas.filter(l => l.pre && l.pre.equipos && l.pre.equipos.length);
    if (!ls.length) return '<div class="pv-nota" style="padding-top:28px">Sin datos de pretemporada.</div>';
    const esClub = !id || id === 'club' || !ls.some(l => l.id === id), L = esClub ? null : ls.find(l => l.id === id);
    if (L) S.lg = L.id;
    const sel = `<nav class="pre-sel" aria-label="Pretemporada">${[['club', 'Del club']].concat(ls.map(l => [l.id, l.corto || l.nombre])).map(([k, l]) => `<a class="pre-b" href="${hPre(k)}"${(esClub ? 'club' : L.id) === k ? ' aria-current="page"' : ''}>${esc(l)}</a>`).join('')}</nav>`;
    const cab = `<div class="pre-cab"><div class="pre-tit"><span class="etq">Archivo · lo que sabíamos antes de la jornada 1</span><h1 class="h1">Pretemporada ${esc(A.temporada)}</h1></div>${sel}</div>`;
    if (esClub) {
      const ord = ['A', 'B', 'C', 'D', 'AL', 'IN'], todos = ls.flatMap(l => l.pre.equipos.filter(e => e.nuestro).map(e => ({ e, l })));
      const tl = todos.reduce((a, { e, l }) => a + altasPre(e, l).length, 0), tb = todos.reduce((a, { e, l }) => a + vanPre(e, l), 0);
      const ck = [[todos.length, 'equipos', ''], ['+' + tl, 'llegan', 'v'], ['−' + tb, 'se van', 'd'], [todos.reduce((a, { e }) => a + ((e.p || {}).jugadores_hoy || 0), 0), 'jugadores en ficha', 'r']]
        .map(([v, l, c]) => `<div class="pre-k ${c}"><b class="cifra">${v}</b><span>${l}</span></div>`).join('');
      const tarjetas = todos.map(({ e, l }) => { const eq = A.equipos.find(x => x.nombre === e.equipo && x.ligaId === l.id) || {}, t = TIPO_PRE[e.tipo] || TIPO_PRE.sigue;
        return { o: ord.indexOf(eq.id), h: `<a class="tarjeta pre-eq" href="${hPre(l.id)}"><div class="pre-eq-c"><div><b class="pre-eq-n">${esc(eq.id ? nomEqLargo(eq) : e.equipo)}</b><span>${esc(l.corto || l.nombre)} · ${esc(e.texto || '')}</span></div><span class="chip ${t[1]}">${t[0]}</span></div>
          <div class="pre-eq-k"><div><b class="cifra">${siguenPre(e)}</b><span>SIGUEN</span></div><div class="v"><b class="cifra">${signo('+', altasPre(e, l).length)}</b><span>LLEGAN</span></div><div class="d"><b class="cifra">${signo('−', vanPre(e, l))}</b><span>SE VAN</span></div></div>
          <div class="pre-eq-p"><span>${e.fuerza ? `Plantilla ${e.fuerza.puesto}ª más fuerte de ${l.pre.equipos.length}` : ''}</span>${e.edad ? `<span>Edad media ${dec(e.edad.toFixed(0))} años</span>` : ''}</div></a>` }; }).sort((a, b) => a.o - b.o).map(x => x.h).join('');
      return `<div class="pre2">${cab}<div class="pre-ks">${ck}</div><div class="pre-eqs">${tarjetas}</div></div>`;
    }
    const P = L.pre, eqs = P.equipos;
    const ctx = (P.contexto || []).map((t, i) => `<div class="pre-ctx"><b class="cifra">${i + 1}</b><span>${esc(t)}</span></div>`).join('');
    const hayMov = eqs.some(e => e.tipo === 'sube' || e.tipo === 'baja');
    const escH = `<section class="pre-sec"><div class="pre-sec-c"><h2 class="h2">${hayMov ? 'Quién sube y quién baja' : 'De dónde salen los equipos'}</h2><button type="button" class="btn s pre-rep" data-esc-play>▶ Repetir</button></div>
      <div class="tarjeta esc2" data-esc="${esc(L.id)}"><div class="esc2-l"></div><div class="esc2-paso"><span class="esc2-n">✓</span><span class="esc2-t"></span></div></div></section>`;
    const mx = Math.max(1, ...eqs.map(e => (e.fuerza || {}).total || 0));
    const fuerza = eqs.filter(e => e.fuerza).sort((a, b) => a.fuerza.puesto - b.fuerza.puesto).map(e => `<div class="fz${e.nuestro ? ' nos' : ''}"><b class="cifra fz-p">${e.fuerza.puesto}º</b><b class="fz-n">${esc(largoEq(e.equipo, L.id))}</b>
      <span class="fz-b" data-bx style="--i:${e.fuerza.puesto - 1}"><i style="width:${(e.fuerza.confirmada / mx * 100).toFixed(1)}%"></i><i class="pos" style="width:${(e.fuerza.posible / mx * 100).toFixed(1)}%"></i></span><b class="cifra fz-v">${e.fuerza.total}</b></div>`).join('');
    const fzH = fuerza ? `<section class="pre-sec"><h2 class="h2">¿Quién tiene más plantilla?</h2><p class="pre-p">Sumamos lo que hicieron la temporada pasada los jugadores que tiene hoy cada equipo, en puntos ajustados a la categoría en la que jugaron. Cuanto más larga la barra, más plantilla sobre el papel. ${comoL('pretemporada')}</p>
      <div class="cal-ley"><span class="l-fz">Ya han jugado esta temporada</span><span class="l-fzp">En la plantilla, aún sin debutar</span></div><div class="fzs" data-dib>${fuerza}</div></section>` : '';
    const mpN = n => ours(n) ? (A.equipos.find(x => x.nombre === n) ? mpCortoN(n, (A.equipos.find(x => x.nombre === n) || {}).ligaId) : n).toUpperCase() : n.toUpperCase();
    const cromo = (j, rol, cls, nota, apag) => { const ok = fotoOK(j), h = j.k && A.jugadores[j.k] ? hP(j.k) : null;
      return `<${h ? `a href="${h}"` : 'div'} class="pc${apag ? ' apag' : ''}"><span class="pc-f">${ok ? `<span class="ph" data-bg="${esc(j.foto)}"></span>` : `<span class="ini">${esc(ini(j.nombre, j.apellidos))}</span>`}<b class="cifra pc-d">${esc(j.dorsal || '')}</b></span>
        <span class="pc-t"><b>${esc(nomCorto(j, true))}</b><span class="pc-rol ${cls}"><span>${esc(rol)}</span></span><span class="pc-nota">${esc(nota || '')}</span></span></${h ? 'a' : 'div'}>`; };
    const nuestros = eqs.filter(e => e.nuestro).map(e => {
      const altas = altasPre(e, L).map(x => { const j = Object.assign({}, A.jugadores[x.k] || {}, x), vuelve = /^Vuelve/.test(x.nota || ''), interno = x.desde && ours(x.desde);
        return cromo(j, x.desde ? (interno ? 'VIENE DE ' : 'LLEGA DE ') + mpN(x.desde) : vuelve ? 'VUELVE' : 'NUEVO', interno ? 'int' : 'v',
          x.stats ? x.stats.goles + ' goles y ' + x.stats.asistencias + ' asist. en ' + tempAnt() : vuelve ? x.nota.replace(/^Vuelve:\s*/, '') : (x.nota || 'Primera temporada en el club')); });
      const bajas = bajasPre(e, L).map(b => { if (b.estado === 'se_va') { const interno = b.destino && ours(b.destino); return cromo(b, (interno ? 'PASA A ' : 'SE VA A ') + mpN(b.destino), interno ? 'int' : 'd', b.nota || (b.destinoLiga ? 'Juega en ' + b.destinoLiga : '')); }
        if (b.estado === 'otro_rol') return cromo(b, (b.nota || 'Otro papel').replace(/^Ahora es (nuestro|nuestra)\s*/i, '').toUpperCase(), 'am', 'Sigue en el club, ya no juega');
        return cromo(b, 'AÚN SIN JUGAR', 'gr', 'En ficha, sin partidos esta temporada', true); });
      const g = (t, cls, js) => js.length ? `<div class="pre-g"><span class="etq ${cls}">${t} · ${js.length}</span><div class="pcs">${js.join('')}</div></div>` : '';
      return `<section class="pre-nos"><div class="pre-nos-c"><div><b class="pre-nos-n">${esc(largoEq(e.equipo, L.id))}</b><span>${esc((e.texto || '') + (e.detalle ? ' · ' + e.detalle : ''))}</span></div>
        <div class="pre-nos-k"><span><b class="cifra">${siguenPre(e)}</b>SIGUEN</span><span class="v"><b class="cifra">${signo('+', altas.length)}</b>LLEGAN</span><span class="d"><b class="cifra">${signo('−', vanPre(e, L))}</b>SE VAN</span></div></div>
        ${g('Llegan', 'v', altas)}${g('Se van', 'd', bajas)}</section>`; }).join('');
    const vig = (P.vigilar || []).filter(j => !j.nuestro).slice(0, 5).map(j => `<div class="pre-l"><b class="cifra pre-l-d">${esc(j.dorsal || '')}</b><span class="pre-l-n"><b>${esc(nomCorto(j))}</b><span>${esc(j.equipo)}${j.nota ? ' · ' + esc(j.nota) : ''}</span></span><span class="pre-l-v"><b class="cifra">${dec((+j.ritmo).toFixed(2))}</b><span>PTS/PARTIDO</span></span></div>`).join('');
    const por = (P.porteros || []).slice(0, 5).map(j => { const h = j.nuestro && j.k && A.jugadores[j.k] ? hP(j.k) : null;
      return `<${h ? `a href="${h}"` : 'div'} class="pre-l${j.nuestro ? ' nos' : ''}"><b class="cifra pre-l-d">${esc(j.dorsal || '')}</b><span class="pre-l-n"><b>${esc(nomCorto(j))}</b><span>${esc(mpCortoN(j.equipo, L.id))} · ${j.tiros} tiros</span></span><b class="cifra pre-l-v">${dec((+j.pct).toFixed(1))}%</b></${h ? 'a' : 'div'}>`; }).join('');
    return `<div class="pre2">${cab}${ctx ? `<div class="pre-ctxs">${ctx}</div>` : ''}${escH}${fzH}${nuestros}
      ${vig || por ? `<div class="pre-dos">${vig ? `<section class="pre-sec"><h2 class="h2">A vigilar</h2><div>${vig}</div></section>` : ''}${por ? `<section class="pre-sec"><h2 class="h2">Porteros</h2><div>${por}</div></section>` : ''}</div>` : ''}</div>`;
  }

  /* Escalera de la pretemporada: los escudos de la temporada pasada se mueven paso a paso hasta la liga de este año.
     Con ascensos y descensos, tres bandas (arriba, la liga, abajo); si no, una banda por liga de origen. En reposo se ve
     el final; «Repetir» lo cuenta paso a paso. En el móvil las bandas son columnas. */
  function escCalc(L, W, st0, D) {
    const P = L.pre, eqs = P.equipos, V = W < 560, cr = n => crest(n) ? 'url(' + crest(n) + ')' : 'none', short = n => mpCortoN(n, L.id);
    const nom = L.nombre.replace(/^Liga\s+/i, ''), hay = eqs.some(e => e.tipo === 'sube' || e.tipo === 'baja');
    const chips = [], huecos = []; let pasos, CZ, H2, bandas, nomD, nomW;
    const mk = o => Object.assign({ op: 1, sc: 1, sh: .35, tag: '', tagBg: 'transparent', tagS: 0, tagDel: 0, delX: 0, delY: 0, dx: 800 * D, dy: 800 * D, delO: 0, z: 2 }, o);
    if (hay) {
      const nn = +((nom.match(/(\d+)\s*$/) || [])[1] || 0), bse = nom.replace(/\s*\d+\s*$/, '');
      const fuera = P.fuera || [], upGo = fuera.filter(x => /sube/i.test(x.que_paso || '')), dnGo = fuera.filter(x => /baja/i.test(x.que_paso || '')), mrg = fuera.filter(x => !/sube|baja/i.test(x.que_paso || ''));
      const dest = (l, d) => { const m = l.length && (l[0].que_paso || '').match(/\ba\s+(.+)$/i); return m ? m[1] : d; };
      const arriba = dest(upGo, nn ? bse + ' ' + (nn - 1) : 'Arriba'), abajo = dest(dnGo, nn ? bse + ' ' + (nn + 1) : 'Abajo');
      const stay = eqs.filter(e => e.tipo === 'sigue' || e.tipo === 'viene'), inDn = eqs.filter(e => e.tipo === 'baja'), inUp = eqs.filter(e => e.tipo === 'sube'), inNew = eqs.filter(e => e.tipo === 'nuevo');
      const lista = ns => ns.join(' y ');
      const old = stay.map(e => ({ n: e.equipo, mp: e.nuestro, k: 'stay' })).concat(upGo.map(x => ({ n: x.equipo, k: 'up', img: x.escudo })), dnGo.map(x => ({ n: x.equipo, k: 'dn', img: x.escudo })), mrg.map(x => ({ n: x.equipo, k: 'mrg', img: x.escudo }))).sort((p, q) => p.n.localeCompare(q.n, 'es'));
      const arr = inDn.map(e => ({ n: e.equipo, mp: e.nuestro, k: 'inDn' })).concat(inUp.map(e => ({ n: e.equipo, mp: e.nuestro, k: 'inUp' })), inNew.map(e => ({ n: e.equipo, mp: e.nuestro, k: 'new' })));
      let ext = old.length; const hUp = old.map((o, i) => o.k === 'up' ? i : -1).filter(i => i >= 0), hDn = old.map((o, i) => o.k === 'dn' ? i : -1).filter(i => i >= 0), hMg = old.map((o, i) => o.k === 'mrg' ? i : -1).filter(i => i >= 0);
      const take = pref => { for (const L2 of pref) if (L2.length) return L2.shift(); return ext++; };
      arr.forEach(x => { x.slot = x.k === 'inDn' ? take([hDn, hMg, hUp]) : take([hUp, hMg, hDn]); });
      const nC = Math.max(old.length, ext);
      pasos = ['Así era ' + nom + ' la temporada pasada.',
        [upGo.length ? 'Suben a ' + arriba + ': ' + lista(upGo.map(x => x.equipo)) + '.' : '', dnGo.length ? 'Bajan a ' + abajo + ': ' + lista(dnGo.map(x => x.equipo)) + '.' : ''].filter(Boolean).join(' '),
        [inDn.length ? 'Bajan de ' + arriba + ': ' + lista(inDn.map(x => x.equipo)) + '.' : '', inUp.length ? 'Suben de ' + abajo + ': ' + lista(inUp.map(x => x.equipo)) + '.' : '', inNew.length ? 'Nuevos: ' + lista(inNew.map(x => x.equipo)) + '.' : ''].filter(Boolean).join(' '),
        mrg.map(x => { const t = ((x.que_paso || '').match(/\ba\s+(.+)$/i) || [])[1]; return x.equipo + (t ? ' se une a ' + t + ': sus jugadores pasan a ese equipo.' : ' deja la liga.'); }).join(' '),
        nom + ' ' + A.temporada + ': ' + eqs.length + ' equipos, ' + arr.length + ' nuevos en la liga.'];
      if (!mrg.length) pasos.splice(3, 1);
      const last = pasos.length - 1, st = Math.min(last, st0 == null ? last : st0), sM = mrg.length ? 3 : 99, sF = last;
      const fin = [...old.filter(o => o.k === 'stay').map(o => ({ n: o.n, slot: old.indexOf(o) })), ...arr.map(x => ({ n: x.n, slot: x.slot }))].sort((p, q) => p.slot - q.slot).map(x => x.n);
      const rankUp = upGo.map(x => old.findIndex(o => o.n === x.equipo)).sort((p, q) => p - q), rankDn = dnGo.map(x => old.findIndex(o => o.n === x.equipo)).sort((p, q) => p - q);
      let P2, PF;
      if (!V) {
        const SL = Math.min(96, Math.floor((W - 24) / nC)); CZ = Math.min(50, SL - 18);
        const cx0 = n => Math.round((W - n * SL) / 2) + Math.round((SL - CZ) / 2), x0 = cx0(nC), RH = CZ + 66, ys = [0, RH + 10, 2 * RH + 20]; H2 = 3 * RH + 20;
        P2 = (band, slot) => [x0 + slot * SL, ys[band] + 30]; PF = (band, rank, n) => [cx0(n) + rank * SL, ys[band] + 30];
        bandas = [[arriba, 0, ''], [nom, 1, 'liga'], [abajo, 2, '']].map(([l, k, c]) => ({ l, c, x: 0, w: W, y: ys[k], h: RH, lx: 12, lw: 300, ly: ys[k] + 9, ta: 'left' }));
        nomD = true; nomW = SL - 4;
      } else {
        const G = 8, SW = Math.floor((W - 2 * G) * .28), MW = W - 2 * G - 2 * SW, RH = 44, HD = 32; CZ = 34;
        const xs = [0, SW + G, SW + G + MW + G], ws = [SW, MW, SW];
        P2 = (band, slot) => [xs[band] + Math.round((ws[band] - CZ) / 2), HD + 8 + slot * RH]; PF = (band, rank) => P2(band, rank);
        H2 = HD + 8 + nC * RH + 4;
        bandas = [[arriba + ' ↑', 0, ''], [nom, 1, 'liga'], [abajo + ' ↓', 2, '']].map(([l, k, c]) => ({ l, c, x: xs[k], w: ws[k], y: 0, h: H2, lx: xs[k], lw: ws[k], ly: 10, ta: 'center' }));
        nomD = false; nomW = 0;
      }
      const T = 0, M = 1, B = 2, nF = fin.length;
      old.forEach((o, i) => { const [cx, cy] = P2(M, i); const c = mk({ x: cx, y: cy, img: o.img ? 'url(' + o.img + ')' : cr(o.n), mp: o.mp, sn: short(o.n), tt: o.n });
        if (o.k === 'stay') { if (st >= sF) { [c.x, c.y] = PF(M, fin.indexOf(o.n), nF); c.dx = c.dy = 700 * D; } chips.push(c); return; }
        if (o.k === 'mrg') { huecos.push({ x: cx, y: cy, c: 'mrg', op: st >= sM && st < sF ? 1 : 0, del: st === sM ? 1300 * D : 0 });
          if (st >= sM) { const tn = (((fuera.find(x => x.equipo === o.n) || {}).que_paso || '').match(/\ba\s+(.+)$/i) || [])[1], ti = fin.indexOf(tn), tp = ti >= 0 ? (st >= sF ? PF(M, ti, nF) : P2(M, (arr.find(x => x.n === tn) || { slot: old.findIndex(z => z.n === tn) }).slot)) : [cx, cy];
            Object.assign(c, { x: tp[0], y: tp[1] - CZ * .7, sc: .5, op: 0, dy: 400 * D, delY: 0, dx: 700 * D, delX: 400 * D, delO: 1100 * D, z: 6, tag: '→', tagBg: '#55555B', tagS: 1 }); }
          chips.push(c); return; }
        const up = o.k === 'up';
        huecos.push({ x: cx, y: cy, c: up ? 'up' : 'dn', op: st === 1 ? 1 : 0, del: st === 1 ? 500 * D : 0 });
        if (st >= 1) { [c.x, c.y] = st >= sF ? PF(up ? T : B, (up ? rankUp : rankDn).indexOf(i), (up ? rankUp : rankDn).length) : P2(up ? T : B, i); Object.assign(c, { tag: up ? '↑' : '↓', tagBg: up ? '#1E8A4C' : '#FF8A3D', tagS: 1, tagDel: 900 * D, z: 3, delX: st >= sF ? 0 : (up ? 0 : 250) * D, delY: (up ? 0 : 250) * D }); }
        if (st >= sF) { c.op = .45; c.sh = 0; }
        chips.push(c); });
      arr.forEach((a2, i) => { const from = a2.k === 'inDn' ? T : B, mv = st >= 2, [sx, sy] = a2.k === 'new' ? P2(M, a2.slot) : P2(from, a2.slot), [ex, ey] = st >= sF ? PF(M, fin.indexOf(a2.n), nF) : P2(M, a2.slot), dl = st >= sF ? 0 : ((a2.k === 'inDn' ? 0 : 300) + i * 90) * D;
        chips.push(mk({ x: mv ? ex : sx, y: mv ? ey : sy, op: a2.k === 'new' && !mv ? 0 : 1, sc: a2.k === 'new' && !mv ? .4 : 1, sh: mv ? .5 : .35, tag: mv ? (a2.k === 'inDn' ? '↓' : a2.k === 'inUp' ? '↑' : '★') : '', tagBg: a2.k === 'inDn' ? '#FF8A3D' : a2.k === 'inUp' ? '#1E8A4C' : '#D3202A', tagS: mv ? 1 : 0, tagDel: 950 * D + dl,
          delX: dl, delY: dl, dx: (st >= sF ? 700 : 850) * D, dy: (st >= sF ? 700 : 850) * D, z: 4, img: cr(a2.n), mp: a2.mp, sn: short(a2.n), tt: a2.n })); });
      return { bandas, chips, huecos, CZ, H2, nomD, nomW, paso: pasos[st], st, last, hay };
    }
    // sin ascensos ni descensos: una banda por la liga de la que viene cada equipo y, abajo, la liga de este año
    const cap = t => t.toUpperCase().replace(/BENJAMIN/, 'BENJAMÍN').replace(/ALEVIN/, 'ALEVÍN');
    const key = e => { if (e.tipo === 'nuevo') return 'EQUIPOS NUEVOS'; const g = (e.detalle || '').match(/grupo ([A-Z])/), lg = ((e.texto || '').match(/de ([A-Za-zÁÉÍÓÚáéíóúñ]+(?: \d)?)$/) || [])[1];
      if (g) return cap((lg || '') + ' · grupo ' + g[1]); const m = (e.detalle || '').match(/º en ([^·]+?) en 2025\/26/); return cap(m ? m[1] : (lg || 'Otra liga')); };
    const grupos = []; eqs.forEach(e => { const kk = key(e); let g = grupos.find(x => x.k === kk); if (!g) grupos.push(g = { k: kk, es: [] }); g.es.push(e); });
    grupos.sort((p, q) => (p.k === 'EQUIPOS NUEVOS') - (q.k === 'EQUIPOS NUEVOS') || (q.es.some(e => e.tipo === 'sigue') - p.es.some(e => e.tipo === 'sigue')) || p.k.localeCompare(q.k, 'es'));
    grupos.forEach(g => g.es.sort((p, q) => p.equipo.localeCompare(q.equipo, 'es')));
    const orden = grupos.flatMap(g => g.es), nT = orden.length, nG = grupos.length;
    const antes = e => ((e.detalle || '').match(/^Antes ([^·]+?) ·/) || [])[1];
    const minus = t => t.charAt(0) + t.slice(1).toLowerCase().replace('senior', 'Senior').replace('alevín', 'Alevín').replace('benjamín', 'Benjamín').replace('infantil', 'Infantil');
    const nCambian = orden.filter(antes).length;
    pasos = ['Así llegaba cada equipo: de dónde sale cada uno de los ' + nT + ' de ' + nom + '.'].concat(grupos.map(g => g.k === 'EQUIPOS NUEVOS'
      ? 'Nuevos: ' + g.es.map(e => e.equipo + ' (' + (e.detalle || '').replace(/^Con /, 'con ').replace(/^Sale del /, 'sale del ').replace(/ \(.*$/, '') + ')').join(' y ') + '.'
      : (g.es.every(e => e.tipo === 'sigue') ? 'Siguen de ' : 'Vienen de ') + minus(g.k) + ': ' + g.es.map(e => short(e.equipo)).join(', ') + '.'),
      [nom + ' ' + A.temporada + ': ' + nT + ' equipos' + (nCambian ? '; ' + nCambian + (nCambian === 1 ? ' cambia' : ' cambian') + ' de nombre.' : '.')]);
    const last = pasos.length - 1, st = Math.min(last, st0 == null ? last : st0);
    let P2;
    if (!V) {
      const SL = Math.min(96, Math.floor((W - 24) / nT)); CZ = Math.min(50, SL - 18); const x0 = Math.round((W - nT * SL) / 2) + Math.round((SL - CZ) / 2), RH = CZ + 66;
      const ys = Array.from({ length: nG + 1 }, (_, i) => i * (RH + 10)); H2 = (nG + 1) * (RH + 10) - 10;
      P2 = (band, col) => [x0 + col * SL, ys[band] + 30];
      bandas = grupos.map((g, i) => ({ l: g.k + (g.k === 'EQUIPOS NUEVOS' ? '' : ' · ' + tempAnt()), c: '', x: 0, w: W, y: ys[i], h: RH, lx: 12, lw: 400, ly: ys[i] + 9, ta: 'left' }))
        .concat([{ l: nom.toUpperCase() + ' · ' + A.temporada, c: 'liga', x: 0, w: W, y: ys[nG], h: RH, lx: 12, lw: 400, ly: ys[nG] + 9, ta: 'left' }]);
      nomD = true; nomW = SL - 4;
    } else {
      const G = 6, nc = nG + 1, MW = Math.floor((W - (nc - 1) * G) * (nc > 3 ? .3 : .38)), SW = Math.floor((W - (nc - 1) * G - MW) / nG), RH = 44, HD = 46; CZ = 34;
      const xs = [], ws = []; let x = 0; for (let i = 0; i < nc; i++) { const w = i === nG ? MW : SW; xs.push(x); ws.push(w); x += w + G; }
      P2 = (band, col) => [xs[band] + Math.round((ws[band] - CZ) / 2), HD + 6 + col * RH];
      H2 = HD + 6 + nT * RH + 4;
      bandas = grupos.map((g, i) => ({ l: g.k + (g.k === 'EQUIPOS NUEVOS' ? '' : ' · 25/26'), c: 'peq', x: xs[i], w: ws[i], y: 0, h: H2, lx: xs[i] + 2, lw: ws[i] - 4, ly: 7, ta: 'center' }))
        .concat([{ l: nom.toUpperCase() + ' · ' + A.temporada.slice(2), c: 'liga', x: xs[nG], w: ws[nG], y: 0, h: H2, lx: xs[nG] + 2, lw: ws[nG] - 4, ly: 7, ta: 'center' }]);
      nomD = false; nomW = 0;
    }
    orden.forEach((e, col) => { const gi = grupos.findIndex(g => g.es.includes(e)), mv = st >= gi + 1, [sx, sy] = P2(gi, col), [ex, ey] = P2(nG, col), dl = (col - orden.findIndex(z => grupos[gi].es.includes(z))) * 120 * D, an = antes(e), nuevo = e.tipo === 'nuevo';
      chips.push(mk({ x: mv ? ex : sx, y: mv ? ey : sy, sh: mv ? .5 : .35, tag: mv ? (nuevo ? '★' : e.tipo === 'sigue' ? '=' : '↓') : '', tagBg: nuevo ? '#D3202A' : e.tipo === 'sigue' ? '#55555B' : '#FF8A3D', tagS: mv ? 1 : 0, tagDel: 950 * D + dl,
        delX: mv ? dl : 0, delY: mv ? dl : 0, dx: 850 * D, dy: 850 * D, z: 3, img: cr(e.equipo), mp: e.nuestro, sn: an && st < last ? an : short(e.equipo), tt: e.equipo + (an ? ' · antes ' + an : '') + (e.detalle ? ' · ' + e.detalle : '') })); });
    return { bandas, chips, huecos, CZ, H2, nomD, nomW, paso: pasos[st], st, last, hay };
  }
  const ESC_T = new WeakMap();
  function pintarEsc(box, st, D) {
    const L = lgOf(box.dataset.esc), lz = box.querySelector('.esc2-l'); if (!L || !L.pre || !lz) return;
    const W = lz.clientWidth; if (!W) return;
    const m = escCalc(L, W, st, D);
    box.dataset.st = m.st;
    // las bandas y los escudos se crean una vez por ancho; luego solo cambian sus posiciones (así se mueven)
    if (+lz.dataset.w !== W) {
      lz.dataset.w = W;
      lz.innerHTML = m.bandas.map(b => `<div class="esc2-band ${b.c}" style="left:${b.x}px;width:${b.w}px;top:${b.y}px;height:${b.h}px"></div><span class="esc2-bl ${b.c}" style="left:${b.lx}px;width:${b.lw}px;top:${b.ly}px;text-align:${b.ta}">${esc(b.l)}</span>`).join('')
        + m.huecos.map(() => '<i class="esc2-h"></i>').join('')
        + m.chips.map(c => `<div class="esc2-c"><div class="esc2-e${c.mp ? ' nos' : ''}" title="${esc(c.tt)}" style="width:${m.CZ}px;height:${m.CZ}px;background-image:${c.img}"><span class="esc2-tag"></span>${m.nomD ? `<span class="esc2-nom" style="width:${m.nomW}px"></span>` : ''}</div></div>`).join('');
      lz.querySelectorAll('.esc2-c, .esc2-e, .esc2-tag, .esc2-h').forEach(x => { x.style.transition = 'none'; });
    }
    lz.style.height = m.H2 + 'px';
    const hs = lz.querySelectorAll('.esc2-h'), cs = lz.querySelectorAll('.esc2-c');
    m.huecos.forEach((h, i) => { const el = hs[i]; if (!el) return; el.className = 'esc2-h ' + h.c; Object.assign(el.style, { left: h.x + 'px', top: h.y + 'px', width: m.CZ + 'px', height: m.CZ + 'px', opacity: h.op, transition: `opacity 300ms ease ${h.del}ms` }); });
    m.chips.forEach((c, i) => { const el = cs[i]; if (!el) return; const e2 = el.firstElementChild, tg = e2.firstElementChild, nm = e2.querySelector('.esc2-nom');
      Object.assign(el.style, { transform: `translateX(${c.x}px)`, transition: `transform ${c.dx}ms cubic-bezier(.45,0,.3,1) ${c.delX}ms`, zIndex: c.z });
      Object.assign(e2.style, { transform: `translateY(${c.y}px) scale(${c.sc})`, opacity: c.op, boxShadow: `0 0 0 2px ${c.mp ? '#D3202A' : '#FFFFFF'}, 0 4px 10px rgba(0,0,0,${c.sh})`, transition: `transform ${c.dy}ms cubic-bezier(.45,0,.3,1.25) ${c.delY}ms, opacity 400ms ease ${c.delO}ms` });
      tg.textContent = c.tag; Object.assign(tg.style, { background: c.tagBg, transform: `scale(${c.tagS})`, transition: `transform 320ms cubic-bezier(.3,1.7,.5,1) ${c.tagDel}ms` });
      if (nm) nm.textContent = c.sn; });
    const n = box.querySelector('.esc2-n'), t = box.querySelector('.esc2-t');
    n.textContent = m.st === m.last ? '✓' : String(m.st + 1); n.classList.toggle('fin', m.st === m.last); t.textContent = m.paso;
    return m;
  }
  function jugarEsc(box, f = 1) {   // f: 1 entera · .35 corta
    (ESC_T.get(box) || []).forEach(clearTimeout);
    const L = lgOf(box.dataset.esc); if (!L) return;
    if (!MOV) { pintarEsc(box, null, 0); return; }
    const m = pintarEsc(box, 0, 0); if (!m) return;
    const paso = m.hay ? 2300 : 2000, ts = Array.from({ length: m.last }, (_, i) => setTimeout(() => { if (box.isConnected) pintarEsc(box, i + 1, f); }, (1200 + i * paso) * f));
    ESC_T.set(box, ts);
  }
  let ioEsc = null;
  // [data-dib]: contenedor de un gráfico. Sus barras ([data-bx] en horizontal, [data-by] en vertical) crecen y sus líneas
  // ([data-traza], con pathLength=1) se trazan en 600 ms, 40 ms entre barras (--i), la primera vez que se ve
  let ioDib = null;
  function dibujar(root) {
    if (!MOV || !('IntersectionObserver' in window)) return;
    if (!ioDib) ioDib = new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting) return; ioDib.unobserve(en.target);
      requestAnimationFrame(() => en.target.classList.remove('dib-pre')); }), { threshold: .15 });
    root.querySelectorAll('[data-dib]').forEach(g => { g.classList.add('dib-pre'); ioDib.observe(g); });
  }
  function rellenarEsc() {
    view.querySelectorAll('.esc2[data-esc]').forEach(b => {
      if (!MOV || !('IntersectionObserver' in window)) { pintarEsc(b, null, 0); return; }
      pintarEsc(b, 0, 0);   // espera en el primer paso hasta que se ve
      if (!ioEsc) ioEsc = new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting) return; ioEsc.unobserve(en.target);
        const k = 'esc-' + en.target.dataset.esc; jugarEsc(en.target, vistoSes(k) ? .35 : 1); marcarSes(k); }), { threshold: .35 });
      ioEsc.observe(b);
    });
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-esc-play]'); if (!b || !view.contains(b)) return; const box = b.closest('.pre-sec').querySelector('.esc2'); if (box) jugarEsc(box); });
  window.addEventListener('resize', () => { view.querySelectorAll('.esc2[data-esc]').forEach(b => { const lz = b.querySelector('.esc2-l'); if (lz && +lz.dataset.w !== lz.clientWidth) { (ESC_T.get(b) || []).forEach(clearTimeout); pintarEsc(b, null, 0); } }); });

  /* ── Jugadores (#/jugadores[/<equipo>] · rediseño, fase 5): buscador y tres pestañas: Plantillas (un equipo cada vez;
     al buscar, todos), Movimientos (rookies, vuelven, cambian de equipo, llegan) y Exjugadores. Se filtra sin recargar ── */
  let JG_PEDIDO = false, JQ = '', JEQ = 'A';
  const nq = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  // cromo: foto solo de mayores (si no, iniciales), dorsal grande, una línea de color (arquetipo o lo que pasa) y la cifra
  const cromoJ = (j, o) => { const ok = fotoOK(j), h = j.k && A.jugadores[j.k] ? hP(j.k) : null, n1 = (j.nombre || '').split(' ')[0], w = (j.apellidos || '').split(' ').filter(Boolean), ap = [];
    for (const x of w) { ap.push(x); if (!PART.has(x.toLowerCase()) || ap.length === w.length) break; }
    return `<${h ? `a href="${h}"` : 'div'} class="cromo" data-q="${esc(nq((j.nombre || '') + ' ' + (j.apellidos || '')))}" data-d="${esc(j.dorsal || '')}" style="--arq:${o.c || '#3A3A40'}"><span class="cromo-f${ok ? '' : ' sin'}"><span class="ini">${esc(ini(j.nombre, j.apellidos))}</span>${ok ? `<span class="ph" data-bg="${esc(j.foto)}"></span>` : ''}<span class="cromo-d">${esc(j.dorsal || '')}</span>${o.cap ? '<span class="cromo-cap">C</span>' : ''}${o.tag ? `<span class="cromo-tag ${o.tag[1]}">${o.tag[0]}</span>` : ''}</span>
      <span class="cromo-t"><b>${esc(n1)}<br>${esc(ap.join(' '))}</b><span class="arq" style="color:${o.sc || '#A6A6AD'}">${esc(o.sub || '')}</span><span class="cromo-c">${esc(o.cifra || '')}</span></span></${h ? 'a' : 'div'}>`; };
  function vJugadores2(fid) {
    if (!JG_PEDIDO && !MAPA) { JG_PEDIDO = true; const h = location.hash; cargarMapa().then(() => { if (location.hash === h) render(); });
      return '<div class="carga" role="status" aria-label="Cargando"><div class="sk" style="height:52px;margin-top:24px"></div><div class="carga-tarjetas"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div></div>'; }
    if (fid && A.equipos.some(e => e.id === fid)) { JEQ = fid; TAB_SEL.jug = 'plant'; }
    const js = Object.values(A.jugadores), ORD = ['A', 'B', 'C', 'D', 'AL', 'IN'], eqsO = ORD.map(id => A.equipos.find(e => e.id === id)).filter(Boolean);
    const tAct = j => (j.temporadas || {})[A.temporada] || {};
    // Plantillas
    const grupos = eqsO.map(e => { const pl = plantillaDe(e);
      pl.sort((a, b) => (b.portero ? 1 : 0) - (a.portero ? 1 : 0) || (+a.dorsal || 99) - (+b.dorsal || 99));
      const cs = pl.map(j => { const a = arqDe(j.k, e.ligaId), t = tAct(j); return cromoJ(j, { c: a ? colArq(a.c) : null, sub: a ? a.n.toUpperCase() : j.portero ? 'PORTERO' : '', sc: a ? colArq(a.c) : '#A6A6AD', cifra: j.portero ? (t.pj || 0) + ' PJ' : (t.goles || 0) + ' G · ' + (t.asistencias || 0) + ' A', cap: j.capitan }); });
      return { e, n: pl.length, h: `<div class="pl-g" data-eqg="${e.id}"${e.id === JEQ ? '' : ' hidden'}><div class="pl-t"><span class="h2">${esc(nomEqLargo(e))}</span><span>${pl.length} ${pl.length === 1 ? 'jugador' : 'jugadores'} · ${esc((lgOf(e.ligaId) || {}).corto || e.liga)}</span></div><div class="cromos2">${cs.join('')}</div></div>` }; });
    const selEq = `<div class="jg-sel">${grupos.map(g => `<button type="button" class="jg-b" data-jeq="${g.e.id}" aria-pressed="${g.e.id === JEQ}"><b>${esc(g.e.cantera ? (g.e.id === 'AL' ? 'ALEVÍN' : 'INFANTIL') : 'MP ' + g.e.id)}</b><span>${g.n} jug.</span></button>`).join('')}</div>`;
    const pPlant = selEq + grupos.map(g => g.h).join('');
    // Movimientos: rookies primero; luego vuelven, cambian de equipo en el club, llegan de otros clubes y los que no jugaron la temporada pasada
    const visto = new Set(), rook = [], vuelven = [], cambian = [], llegan = [], sinPrev = [];
    const cfr = j => { const t = tAct(j); return j.portero ? (t.pj || 0) + ' PJ' : (t.goles || 0) + ' G · ' + (t.asistencias || 0) + ' A'; };
    js.filter(j => j.rookie).forEach(j => { visto.add(j.k); const e = A.equipos.find(x => x.nombre === j.equipo) || {}, d = j.rookie.debut || {};
      rook.push(cromoJ(j, { c: '#FFB347', sub: 'DEBUTA EN LA FMP' + (d.jornada ? ' · J' + d.jornada + (d.rival ? ' vs ' + d.rival : '') : ''), sc: '#FFB347', cifra: cfr(j), tag: ['ROOKIE', 'am'] })); });
    eqsO.forEach(e => (e.altas || []).forEach(x => { const j = A.jugadores[x.k]; if (!j || visto.has(x.k) || (e.cantera && x.desde === 'MADRIDPATINA')) return; visto.add(x.k); const aqui = mpCorto(e).toUpperCase();
      if (x.desde && ours(x.desde)) cambian.push(cromoJ(j, { c: '#D3202A', sub: mpCortoN(x.desde, (A.equipos.find(y => y.nombre === x.desde) || {}).ligaId).toUpperCase() + ' → ' + aqui, sc: '#FF6B63', cifra: cfr(j) }));
      else if (x.desde) llegan.push(cromoJ(j, { c: '#C9C9CE', sub: 'LLEGA DE ' + x.desde, sc: '#C9C9CE', cifra: cfr(j), tag: ['NUEVO', 'r'] }));
      else if (/^Vuelve/.test(x.nota || '')) vuelven.push(cromoJ(j, { c: '#1E8A4C', sub: 'VUELVE A ' + aqui, sc: '#3DD27E', cifra: cfr(j), tag: ['VUELVE', 'v'] }));
      else sinPrev.push(cromoJ(j, { c: '#3A3A40', sub: aqui + ' · SIN PARTIDOS EN ' + tempAnt(), sc: '#A6A6AD', cifra: cfr(j) })); }));
    const gMov = [['Rookies · primera temporada en la FMP', rook], ['Vuelven', vuelven], ['Cambian de equipo en el club', cambian], ['Llegan de otros clubes', llegan], ['Sin partidos la temporada pasada', sinPrev]]
      .filter(x => x[1].length).map(([t, l]) => `<div class="pl-g" data-movg><div class="pl-t"><span class="h2">${t}</span><span>${l.length} ${l.length === 1 ? 'jugador' : 'jugadores'}</span></div><div class="cromos2">${l.join('')}</div></div>`).join('');
    const pMov = gMov || '<div class="pv-nota">Sin movimientos esta temporada.</div>';
    // Exjugadores: jugaron con nosotros y esta temporada no están; los que juegan en otro club, y del resto solo los adultos con paso por senior
    let pEx = '<div class="carga" role="status" aria-label="Cargando"><div class="carga-tarjetas"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div></div>';
    if (H) {
      const cur = new Set(js.map(j => H.tok(j.nombre + ' ' + j.apellidos))), cant = t => /ALEV|INFANT|JUVENIL/i.test(t.liga || '');
      // los que siguen en nuestra ficha aunque aún no hayan jugado no son exjugadores
      A.ligas.forEach(l => ((l.pre || {}).equipos || []).filter(e => e.nuestro).forEach(e => (e.bajas || []).filter(b => b.estado === 'sin_jugar_aun').forEach(b => cur.add(H.tok(b.nombre + ' ' + b.apellidos)))));
      const ex = H.jugadores.filter(j => !cur.has(j.tok) && ((j.ahora && j.ahora.length) || (j.temporadas.some(t => !cant(t)) && j.adulto !== false)))
        .map(j => { const ts = [...new Set(j.temporadas.map(t => t.temporada))].sort(), po = j.temporadas.some(t => t.rol === 'GOALIE'), parts = j.nombre.split(' '), k1 = parts.length >= 4 ? 2 : 1;
          const ult = j.temporadas.filter(t => t.temporada === ts[ts.length - 1]).pop() || {};
          return { pj: j.carrera.pj, h: cromoJ({ nombre: parts.slice(0, k1).join(' '), apellidos: parts.slice(k1).join(' '), dorsal: ult.dorsal || '', foto: j.adulto === true ? j.foto : null },
            { sub: ts[0] === ts[ts.length - 1] ? ts[0] : ts[0].slice(0, 4) + '–' + ts[ts.length - 1].slice(5), cifra: po ? j.carrera.pj + ' PJ' : j.carrera.g + ' G · ' + j.carrera.a + ' A' }) }; })
        .sort((a, b) => b.pj - a.pj);
      pEx = ex.length ? `<div class="pl-g" data-exg><div class="pl-t"><span class="h2">Han jugado con nosotros</span><span>${ex.length} exjugadores · por partidos</span></div><div class="cromos2">${ex.map((x, i) => x.h.replace('class="cromo"', `class="cromo" data-top="${i}"`)).join('')}</div></div>` : '<div class="pv-nota">Sin exjugadores.</div>';
    }
    const T = pestanas('jug', [['plant', 'Plantillas'], ['mov', 'Movimientos'], ['ex', 'Exjugadores']], 'plant');
    const vacio = k => `<div class="jg-vacio" data-vacio="${k}" hidden></div>`;
    return `<div class="jug2"><h1 class="h1">Jugadores</h1>
      <label class="jq"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" id="jq" value="${esc(JQ)}" placeholder="Busca por nombre o dorsal" aria-label="Buscar jugador" autocomplete="off"><button type="button" class="jq-x" aria-label="Borrar"${JQ ? '' : ' hidden'}>✕</button></label>
      ${apodoCta()}${T.nav}${T.panel('plant', vacio('plant') + pPlant)}${T.panel('mov', vacio('mov') + pMov)}${T.panel('ex', vacio('ex') + pEx)}</div>`;
  }
  function filtrarJug() {
    const root = view.querySelector('.jug2'); if (!root) return;
    const q = nq(JQ), pasa = c => !q || c.dataset.q.includes(q) || c.dataset.d === q, x = root.querySelector('.jq-x'); if (x) x.hidden = !q;
    const sel = root.querySelector('.jg-sel'); if (sel) sel.hidden = !!q;
    root.querySelectorAll('[data-jeq]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.jeq === JEQ)));
    const cuenta = (g, max) => { let n = 0; g.querySelectorAll('.cromo').forEach(c => { const ok = pasa(c) && (max == null || n < max) && (q || c.dataset.top == null || +c.dataset.top < 24); c.hidden = !ok; if (ok) n++; }); return n; };
    let nP = 0; root.querySelectorAll('[data-eqg]').forEach(g => { const n = cuenta(g); g.hidden = q ? !n : g.dataset.eqg !== JEQ; if (!g.hidden) nP += n; });
    let nM = 0; root.querySelectorAll('[data-movg]').forEach(g => { const n = cuenta(g); g.hidden = !n; nM += n; });
    let nE = 0; root.querySelectorAll('[data-exg]').forEach(g => { nE += cuenta(g, q ? 60 : null); g.hidden = !nE; });
    [['plant', nP], ['mov', nM], ['ex', nE]].forEach(([k, n]) => { const v = root.querySelector(`[data-vacio="${k}"]`); if (!v) return; v.hidden = !q || n > 0; v.textContent = `No encontramos a nadie con «${JQ}».`; });
  }
  document.addEventListener('input', e => { if (e.target && e.target.id === 'jq') { JQ = e.target.value; filtrarJug(); } });
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-jeq]'); if (b && view.contains(b)) { JEQ = b.dataset.jeq; filtrarJug(); return; }
    const x = e.target.closest && e.target.closest('.jq-x'); if (x && view.contains(x)) { JQ = ''; const i = view.querySelector('#jq'); if (i) { i.value = ''; i.focus(); } filtrarJug(); }
  });

  /* ── Legado (#/legado · rediseño, fase 5): cifras del club, temporada a temporada (en qué liga jugó cada equipo y en
     qué puesto acabó), de un equipo a otro, logros (podios) y récords ── */
  function vLegado2() {
    if (!H) return hCargando ? '<div class="carga" role="status" aria-label="Cargando"><div class="sk" style="height:200px;margin-top:24px"></div></div>' : '<div class="pv-nota" style="padding-top:28px">Sin datos del histórico.</div>';
    // partidos del club (sin derbis): el histórico y lo jugado esta temporada; los empates los decide la tanda
    const cur = Object.values(A.partidos).filter(p => p.gl != null && (ours(p.local) || ours(p.visitante))).map(p => ({ temporada: A.temporada, local: p.local, visitante: p.visitante, gl: p.gl, gv: p.gv, ganador: p.gl !== p.gv ? (p.gl > p.gv ? p.local : p.visitante) : p.pen, liga: p.ligaNombre || '' }));
    const ps = H.partidos.concat(cur).filter(p => !(ours(p.local) && ours(p.visitante)));
    let g = 0, gf = 0; const big = [];
    ps.forEach(p => { const L = ours(p.local), n = L ? p.gl : p.gv, o = L ? p.gv : p.gl; gf += n; if (n > o || (n === o && ours(p.ganador))) g++; big.push({ p, n, o }); });
    const tems = H.temporadas.concat(H.temporadas.includes(A.temporada) ? [] : [A.temporada]);
    const toks = new Set(H.jugadores.map(j => j.tok)); Object.values(A.jugadores).forEach(j => toks.add(H.tok(j.nombre + ' ' + j.apellidos)));
    const kpis = [[ps.length, 'partidos', ''], [g, 'ganados', 'v'], [gf, 'goles marcados', 'r'], [toks.size, 'jugadores han pasado', 'g']].map(([v, l, c]) => `<div class="pre-k ${c}"><b class="cifra">${v}</b><span>${l}</span></div>`).join('');
    // temporada a temporada: una fila por temporada (la más reciente arriba) y una columna por equipo
    const cl = H.clasificaciones;
    // grupos que deciden el título: fuera permanencia, descenso y los grupos bajos de una fase final
    const decide = c => { const gg = (c.grupo || '') + ' ' + (c.liga || ''); return !/DESCENSO|PERMANENCIA/i.test(gg) && !/split_(mid|bottom)/.test(c.fase || '') && !(/FASE FINAL|FASE 2/i.test(gg) && /(GRUPO|GR)\s*([2-9]|[B-Z])\b|\([2-9]\)/i.test(gg)); };
    const EQ = [['A', 'MADRIDPATINA A'], ['B', 'MADRIDPATINA B'], ['C', 'MADRIDPATINA C'], ['D', 'MADRIDPATINA D'], ['ALEVÍN', 'MADRIDPATINA', /ALEV/], ['INFANTIL', 'MADRIDPATINA', /INFANTIL/]];
    const ligaCorta = c => { if (c.categoria === 'senior') { const dv = (+c.nivel || 0) - 2; return dv > 0 ? 'S' + dv : 'SENIOR'; } return /INFANTIL/.test(c.liga) ? 'INFANTIL' : 'ALEVÍN'; };
    const ligaCant = c => (s2 => s2 === '2' ? 'DIV. 2' : s2 === 'B' ? 'GRUPO B' : /^GRUPO/.test(s2) ? s2 : 'LIGA')(c.liga.replace(/^LIGA (ALEVÍN|INFANTIL) ?/, '').trim());
    const filas = H.temporadas.slice().reverse().map(t => { const rows = cl.filter(c => c.temporada === t && /^regular/.test(c.fase || ''));
      const cs = EQ.map(([, n, re]) => { const c = rows.filter(x => x.equipo === n && (!re || re.test(x.liga))).sort((x, y) => (x.fase === 'regular' ? 0 : 1) - (y.fase === 'regular' ? 0 : 1) || y.de - x.de)[0];
        if (!c) return '<div class="lm-c vacia" title="Sin equipo"><b>—</b></div>';
        const k = decide(c) && c.puesto === 1 ? 'oro' : decide(c) && c.puesto <= 3 ? 'podio' : c.puesto <= Math.ceil(c.de / 2) ? 'arriba' : '';
        return `<div class="lm-c ${k}" title="${esc(c.liga + ' · ' + c.puesto + 'º de ' + c.de)}"><span>${esc(re ? ligaCant(c) : ligaCorta(c))}</span><b class="cifra">${c.puesto}º</b><span>de ${c.de}</span></div>`; });
      return `<span class="lm-t${cs.some(x => x.includes(' oro')) ? ' oro' : ''}">${esc(t.replace('20', ''))}</span>${cs.join('')}`; }).join('');
    const matriz = `<section class="leg-sec"><h2 class="h2">Temporada a temporada</h2><p class="pre-p">Cada casilla: en qué liga jugó cada equipo y en qué puesto acabó la liga regular.</p>
      <div class="lm"><span></span>${EQ.map(([l]) => `<span class="lm-cab${l === 'A' ? ' a' : ''}">${l}</span>`).join('')}${filas}</div>
      <div class="cal-ley"><span class="l-oro">Campeón</span><span class="l-podio">Podio</span><span class="l-arriba">Mitad de arriba</span><span class="l-abajo">Mitad de abajo</span><span>S1, S2, S3 = Senior 1ª, 2ª, 3ª división</span></div></section>`;
    // logros: podios de los grupos que deciden el título
    const nomLiga = l => titulo(l).replace(/Division/g, 'División').replace(/ De /g, ' de ');
    const logros = cl.filter(c => c.puesto && c.puesto <= 3 && decide(c)).sort((a, b) => a.puesto - b.puesto || b.temporada.localeCompare(a.temporada)).map(c => `<div class="leg-log${c.puesto === 1 ? ' oro' : ''}"><b class="cifra">${c.puesto}º</b><div><b>${esc(c.equipo === 'MADRIDPATINA' ? 'MADRIDPATINA ' + (/ALEV/.test(c.liga) ? 'ALEVÍN' : /INFANT/.test(c.liga) ? 'INFANTIL' : '') : c.equipo)}</b><span>${esc(nomLiga(c.liga))}</span><span class="etq">${esc(c.temporada)}</span></div></div>`).join('');
    // récords: la carrera en el club, con lo que llevamos esta temporada
    const ya = {}; Object.values(A.jugadores).forEach(x => { const y = x.temporadas[A.temporada]; if (y && y.pj) ya[H.tok(x.nombre + ' ' + x.apellidos)] = { pj: y.pj, g: y.goles || 0, a: y.asistencias || 0, ht: (x.partidos || []).filter(m => (m.g || 0) >= 3).length }; });
    const tot = H.jugadores.map(j => { const c = j.carrera, y = ya[j.tok] || { pj: 0, g: 0, a: 0, ht: 0 }; return { j, g: c.g + y.g, a: c.a + y.a, pj: c.pj + y.pj, ht: (c.hattricks || 0) + y.ht, t: c.temporadas + (ya[j.tok] ? 1 : 0) }; });
    const top = k => tot.slice().sort((a, b) => b[k] - a[k])[0];
    const bw = big.slice().sort((a, b) => (b.n - b.o) - (a.n - a.o))[0];
    const rec = [['Máximo goleador', top('g'), x => x.pj + ' partidos', 'g'], ['Más asistencias', top('a'), x => x.pj + ' partidos', 'a'], ['Más partidos', top('pj'), x => x.t + ' temporadas', 'pj'], ['Más hat-tricks', top('ht'), () => 'tres goles o más en un partido', 'ht']]
      .filter(([, x, , k]) => x && x[k]).map(([t, x, s, k]) => `<div class="tarjeta leg-rec"><div><span class="etq">${t}</span><b>${esc(x.j.nombre)}</b><span>${esc(s(x))}</span></div><b class="cifra">${x[k]}</b></div>`)
      .concat(bw ? [`<div class="tarjeta leg-rec"><div><span class="etq">Victoria más amplia</span><b>${esc(bw.p.local + ' – ' + bw.p.visitante)}</b><span>${esc(bw.p.temporada + (bw.p.liga ? ' · ' + nomLiga(bw.p.liga) : ''))}</span></div><b class="cifra">${bw.p.gl}–${bw.p.gv}</b></div>`] : []).join('');
    return `<div class="leg2"><div class="leg-cab"><span class="etq">Legado · desde ${esc(H.temporadas[0])}</span><h1 class="leg-tit">${tems.length} temporadas</h1></div>
      <div class="pre-ks">${kpis}</div>${matriz}<div data-flujo></div>
      ${logros ? `<section class="leg-sec"><h2 class="h2">Logros</h2><div class="leg-logs">${logros}</div></section>` : ''}
      ${rec ? `<section class="leg-sec"><h2 class="h2">Récords</h2><div class="leg-recs">${rec}</div></section>` : ''}</div>`;
  }

  /* ── 2. Equipos ─────────────────────────────────────────── */

  /* ── 3. Ligas ───────────────────────────────────────────── */
  // 7q · movimientos entre equipos: cada jugador sale de su equipo de 2025/26 y viaja en línea recta al de 2026/27; al final
  // los que llegaron suben a ocupar el hueco. Gris: entre nuestros equipos · verde: llega de otro club · rojo: se va a otro club.
  const quien = x => [x.k, ((x.nombre || '') + ' ' + (x.apellidos || '')).trim().toLowerCase()].filter(Boolean);
  // 8b · «Billete de vuelta»: en un equipo nuestro este año, con temporadas en MP antes de la pasada y ninguna la pasada
  function vuelven(fe) {
    if (!H) return [];
    const y = +A.temporada.slice(0, 4), prev = (y - 1) + '/' + String(y).slice(2);
    const desde = {}; A.equipos.forEach(e => (e.altas || []).forEach(a => { desde[a.k] = a.desde; }));
    return Object.values(A.jugadores).filter(j => j.equipo && ours(j.equipo) && (!fe || enEquipo(j, fe))).map(j => {
      const hj = H.byTok[H.tok(j.nombre + ' ' + j.apellidos)], mp = hj ? hj.temporadas.filter(t => ours(t.equipo)) : [];
      if (!mp.length || mp.some(t => t.temporada >= prev)) return null;
      const last = mp.map(t => t.temporada).sort().pop(), gap = y - +last.slice(0, 4) - 1, g = mp.reduce((sm, t) => sm + (t.g || 0), 0);
      const fuera = desde[j.k] && !ours(desde[j.k]) ? desde[j.k] : null;
      return { j, ultima: last.slice(2), ticket: (fuera ? 'Escala en ' + fuera : gap > 1 ? gap + ' temporadas sin jugar' : 'Un año sin jugar') + ' · ' + (g === 1 ? '1 gol' : g + ' goles') + ' con MP' };
    }).filter(Boolean);
  }

  /* ── Pretemporada: cómo llega cada liga en la que jugamos (todos los equipos y jugadores) ── */

  /* ── 4. Partido ─────────────────────────────────────────── */
  function vPartido(mid) {
    const p = A.partidos[mid] || Object.values(A.partidos)[0];
    const side = (eq, gol, por, alin, staff, ms = 0) => { const camp = (alin || []).filter(x => !x.portero), filas = camp.length ? camp : gol;
      return `<div class="card" data-anim="mpUp .4s cubic-bezier(.2,.8,.2,1) ${ms}ms" style="padding:18px 20px">
        <div style="${BS}font-weight:800;font-size:24px">${esc(eq)}</div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) 32px 32px 48px;gap:8px;font-size:13px;font-weight:700;color:#A6A6AD;padding:10px 0 6px;border-bottom:1px solid #26262A"><span>${camp.length ? 'Jugadores · ' + camp.length : 'Puntos'}</span><span style="text-align:center">G</span><span style="text-align:center">A</span><span style="text-align:right">Sanción</span></div>
        ${filas.map(g => box(A.jugadores[g.k] ? hP(g.k) : null, 'display:grid;grid-template-columns:minmax(0,1fr) 32px 32px 48px;gap:8px;align-items:center;width:100%;padding:8px 0;border-bottom:1px solid #26262A', `
          <span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="color:#A6A6AD">#${esc(g.dorsal)}</span>${g.capitan || g.asistente ? ` <span style="font-size:12px;font-weight:700;color:#A6A6AD">(${g.capitan ? 'C' : 'A'})</span>` : ''} ${esc(corto(g))}</span>
          <span style="text-align:center;${BS}font-weight:800;font-size:22px;color:${g.g ? '#FF6B63' : '#55555B'}">${g.g || 0}</span>
          <span style="text-align:center;${BS}font-weight:800;font-size:22px;color:${g.a ? '#C9C9CE' : '#55555B'}">${g.a || 0}</span>
          <span style="text-align:right;${BS}font-weight:800;font-size:18px;color:${g.pim ? '#F4F4F5' : '#55555B'}">${g.pim ? fmin(g.pim) : '—'}</span>`)).join('')}
        ${filas.some(g => g.capitan || g.asistente) ? '<div style="font-size:12px;color:#A6A6AD;padding-top:8px">(C) capitán · (A) asistente</div>' : ''}
        <div style="font-size:13px;font-weight:700;color:#A6A6AD;padding:16px 0 6px">Portería</div>
        ${por.map(x => box(hP(x.k), 'display:block;width:100%;padding:8px 0', `
          <div style="display:flex;justify-content:space-between;gap:8px"><span style="font-weight:600"><span style="color:#A6A6AD">#${esc(x.dorsal)}</span> ${esc(corto(x))}</span><span style="${BS}font-weight:800;font-size:22px">${x.pct != null ? dec(x.pct) + '%' : '—'}</span></div>
          <div style="height:8px;border-radius:3px;background:#26262A;overflow:hidden;margin-top:6px"><div style="height:100%;width:${(x.pct || 0)}%;background:${RED}"></div></div>
          <div style="font-size:13px;color:#A6A6AD;margin-top:4px">${x.par} ${x.par === 1 ? 'parada' : 'paradas'} de ${x.tiros} ${x.tiros === 1 ? 'tiro' : 'tiros'}</div>`)).join('')}
        ${staff && staff.length ? `<div style="font-size:13px;font-weight:700;color:#A6A6AD;padding:16px 0 6px">Cuerpo técnico</div><div style="font-size:15px;line-height:1.6">${staff.map(esc).join('<br>')}</div>` : ''}
      </div>`; };
    const PER = { P1: '1ª PARTE', P2: '2ª PARTE' };
    const TIPO = { gol: ['GOL', '#FF6B63'], falta: ['FALTA', '#F4F4F5'], tiempo_muerto: ['TIEMPO MUERTO', '#A6A6AD'], cambio_portero: ['CAMBIO DE PORTERO', '#A6A6AD'] };
    // minuto jugado (el acta da lo que queda de la parte): 25 min en senior, 20 en alevín e infantil
    const durP = /^(alevin|infantil)/.test(p.liga || '') ? 1200 : 1500;
    const jugado = m => { const q = segs(m); if (q == null || q > durP) return m || ''; const t = durP - q; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
    const derbiMP = ours(p.local) && ours(p.visitante);
    const vd = p.idp && VID && VID[p.idp];
    const golVid = e => vd && e.tipo === 'gol' && e.jugador ? vd.ev[`${String(e.periodo).replace('P', '')}-${e.minuto}-GOL-${e.jugador.dorsal}`] : null;
    const nomDorsal = (l, d) => { const x = ((l === 'L' ? p.alin_l : p.alin_v) || []).concat((l === 'L' ? p.por_l : p.por_v) || []).find(y => String(y.dorsal) === String(d)); return '#' + d + (x ? ' ' + corto(x) : ''); };
    const enPista = e => { const g = e.tipo === 'gol' && e.jugador ? { pista: pistaGol(p.idp, `${String(e.periodo).replace('P', '')}-${e.minuto}-GOL-${e.jugador.dorsal}`) } : null; if (!g || !g.pista) return ''; return ['L', 'V'].filter(l => (g.pista[l] || []).length).map(l => `<div style="font-size:13px;color:#A6A6AD;margin-top:2px">En pista (${esc(mpAbr(l === 'L' ? p.local : p.visitante))}): ${g.pista[l].map(d => esc(nomDorsal(l, d))).join(', ')}</div>`).join(''); };
    const evRow = e => { const eqn = e.lado === 'local' ? p.local : e.lado === 'visitante' ? p.visitante : ''; const T = TIPO[e.tipo] || [e.tipo, '#A6A6AD'];
      const txt = e.tipo === 'gol' ? quienTxt(e.jugador) + (e.asistencia ? ` <span style="color:#A6A6AD">· asist. ${quienTxt(e.asistencia)}</span>` : '')
        : e.tipo === 'falta' ? quienTxt(e.jugador) + ` <span style="color:#A6A6AD">· ${e.falta ? esc(e.falta) + ' · ' : ''}${fmin(e.minutos)}</span>`
        : e.tipo === 'cambio_portero' && e.jugador ? 'entra ' + quienTxt(e.jugador) : '';
      // en un derbi los dos escudos son el mismo: se pone el equipo (MP C, MP D)
      return `<div style="display:grid;grid-template-columns:50px ${derbiMP ? '38px' : '24px'} minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px;border-radius:6px;background:${ours(eqn) ? '#2A1416' : 'transparent'}">
        <span style="${BS}font-weight:800;font-size:18px;color:#A6A6AD;font-variant-numeric:tabular-nums">${esc(jugado(e.minuto))}</span>${derbiMP ? `<span style="${BS}font-weight:800;font-size:15px;line-height:1;white-space:nowrap;color:#F4F4F5">${esc(eqn ? abr(eqn) : '')}</span>` : disc(crest(eqn), 22)}
        <div style="min-width:0;font-size:15px;line-height:1.35"><span style="font-size:12px;font-weight:700;letter-spacing:.08em;color:${T[1]}">${T[0]}</span>${eqn && !derbiMP ? (e.tipo === 'tiempo_muerto' || e.tipo === 'cambio_portero' ? ` <span style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#C9C9CE">· ${esc(abr(eqn))}</span>` : `<span class="sr-only"> de ${esc(eqn)}</span>`) : ''} ${txt}${enPista(e)}</div>
        <span style="${BS}font-weight:800;font-size:22px">${e.tipo === 'gol' && e.marcador ? esc(e.marcador.replace('-', '–')) : ''}</span></div>`; };
    const eventos = [...new Set((p.ev || []).map(e => e.periodo))].map(g => lab(PER[g] || g, 'margin:16px 0 4px') + p.ev.filter(e => e.periodo === g).map(evRow).join('')).join('');
    const info = [p.pista ? ['Pista', p.pista] : null, p.arb && p.arb.length ? [p.arb.length > 1 ? 'Árbitros' : 'Árbitro', p.arb.join(' · ')] : null].filter(Boolean);
    const team = (name, href) => box(href, 'display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center', `
        <div class="disc" style="width:clamp(56px,8vw,96px);height:clamp(56px,8vw,96px);box-shadow:0 0 0 2px #FFFFFF;${crest(name) ? `background-image:url('${esc(crest(name))}')` : ''}"></div>
        <span style="${BS}font-weight:800;font-size:clamp(20px,3vw,32px);line-height:1;color:${ours(name) ? '#FF6B63' : '#F4F4F5'}"><span class="nm-largo">${esc(name)}</span><span class="nm-corto">${esc(abr(name))}</span></span>`);
    const hasTiros = p.tl != null && p.tv != null;
    // rodillo de tragaperras: columna 0…n que sube hasta el resultado (mismo alto de línea que el marcador, .85em)
    const rodillo = (n, dur) => n == null || n === '' ? esc(n ?? '') : `<span class="sr-only">${n}</span><span aria-hidden="true" style="display:inline-block;height:.85em;overflow:hidden;vertical-align:top"><span data-anim="mpRoll ${dur} .2s cubic-bezier(.2,.9,.25,1.08)" style="display:block;--to:${(-n * 0.85).toFixed(3)}em">${Array.from({ length: +n + 1 }, (_, i) => `<span style="display:block;height:.85em;text-align:center">${i}</span>`).join('')}</span></span>`;
    return `<div style="margin-top:16px;background:#18181B;border-radius:14px;padding:clamp(20px,3vw,36px)">
        <div style="text-align:center;font-size:14px;font-weight:700;letter-spacing:.12em;color:#A6A6AD">${esc((p.ligaNombre + ' · Jornada ' + p.jornada + ' · ' + fd(p.fecha) + (p.hora ? ' · ' + p.hora : '')).toUpperCase())}</div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:clamp(12px,3vw,40px);align-items:center;margin-top:20px">
          ${team(p.local, hT(p.local))}
          <div style="${BS}font-weight:900;font-size:clamp(72px,12vw,150px);line-height:.85;font-variant-numeric:tabular-nums;white-space:nowrap" data-grupo>${p.pen && p.pen === p.local ? bPen() : ''}${rodillo(p.gl, '1.1s')}<span style="color:#55555B">–</span>${rodillo(p.gv, '1.3s')}${p.pen && p.pen === p.visitante ? bPen() : ''}</div>
          ${team(p.visitante, hT(p.visitante))}
        </div>
        ${p.idp ? videoPartido(p.idp) : ''}
        ${p.gl != null ? `<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:22px">${p.nuestro && p.idp && !(VID && VID[p.idp]) ? `<a class="dv-alin" href="#/directo/${encodeURIComponent(p.idp)}/resumen" title="El partido contado otra vez desde el acta: pista, alineaciones, goles, faltas, penaltis y resumen final">▶ Ver resumen</a>` : ''}<button type="button" class="dv-alin" data-tarjeta="partido" data-id="${esc(p.mid)}" title="Una imagen con el resultado para compartir">Compartir resultado</button><a class="dv-alin" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`${ours(p.local) ? mpAbr(p.local) : p.local} ${p.gl}–${p.gv} ${ours(p.visitante) ? mpAbr(p.visitante) : p.visitante} · ${p.ligaNombre}, jornada ${p.jornada}. El partido: ${BASE_WEB()}#/partido/${encodeURIComponent(p.mid)}`)}">WhatsApp</a></div>` : ''}
        ${p.gl != null && (p.ev || []).length ? `<div data-grafico-partido="${esc(p.mid)}"></div>` : ''}
        ${p.idp ? `<div data-tiros-partido="${esc(p.mid)}"></div>` : ''}
        ${hasTiros ? `<div style="max-width:640px;margin:28px auto 0">
          <div style="display:flex;justify-content:space-between;${BS}font-weight:800;font-size:28px;line-height:1"><span>${p.tl}</span><span class="lab" style="align-self:center">TIROS A PUERTA</span><span>${p.tv}</span></div>
          <div style="display:flex;gap:3px;height:10px;margin-top:8px" data-grupo data-espera="1300"><div data-anim="mpWipe .6s" style="flex:${p.tl};background:${ours(p.local) ? RED : '#6B6B70'};border-radius:3px;transform-origin:right"></div><div data-anim="mpWipe .6s" style="flex:${p.tv};background:${ours(p.visitante) ? RED : '#6B6B70'};border-radius:3px;transform-origin:left"></div></div>
        </div>` : ''}
      </div>
      ${p.nuestro && p.idp && p.gl != null ? `<div data-voto="${esc(p.mid)}"></div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:12px" data-grupo data-espera="1700">${side(p.local, p.gol_l, p.por_l, p.alin_l, p.staff_l, 0)}${side(p.visitante, p.gol_v, p.por_v, p.alin_v, p.staff_v, 100)}</div>
      ${info.length || eventos ? `<div class="card" style="margin-top:12px;padding:18px 20px">
        ${info.length ? `<div style="display:flex;gap:12px 32px;flex-wrap:wrap">${info.map(([k, v]) => `<div><div style="font-size:13px;font-weight:700;color:#A6A6AD">${k}</div><div style="font-weight:600;font-size:16px">${esc(v)}</div></div>`).join('')}</div>` : ''}
        ${vd && vd.tiros && vd.tiros.length ? (() => {
          const [cL, cV] = coloresLados(p.local, p.visitante);
          const goles = Object.values(vd.ev || {}).filter(e => e.tipo === 'GOL');
          const bloque = l => { const nom = l === 'L' ? p.local : p.visitante, col = l === 'L' ? cL : cV, ts = vd.tiros.filter(t => t.lado === l), gs = goles.filter(e => e.lado === l);
            const par = ts.filter(t => t.r === 'parada').length, tot = ts.length + gs.length, puerta = par + gs.length;
            const pts = ts.filter(t => t.xy).map(t => t.r === 'parada' ? `<circle cx="${t.xy[0] * PISTA_W}" cy="${t.xy[1] * PISTA_H}" r="7" fill="none" stroke="${col}" stroke-width="2.5"><title>Parada${t.dorsal ? ' · #' + esc(t.dorsal) : ''} · a unos ${distM(t.xy)} m</title></circle>`
              : `<g stroke="#8A8A8F" stroke-width="2.5"><title>${t.r === 'fuera' ? 'Fuera' : 'Bloqueado'}${t.dorsal ? ' · #' + esc(t.dorsal) : ''}</title><line x1="${t.xy[0] * PISTA_W - 5}" y1="${t.xy[1] * PISTA_H - 5}" x2="${t.xy[0] * PISTA_W + 5}" y2="${t.xy[1] * PISTA_H + 5}"/><line x1="${t.xy[0] * PISTA_W + 5}" y1="${t.xy[1] * PISTA_H - 5}" x2="${t.xy[0] * PISTA_W - 5}" y2="${t.xy[1] * PISTA_H + 5}"/></g>`).join('')
              + gs.filter(e => e.xy).map(e => `<circle cx="${e.xy[0] * PISTA_W}" cy="${e.xy[1] * PISTA_H}" r="9" fill="${col}" stroke="#0D0D0E" stroke-width="2"><title>Gol · ${esc(e.q || '')} · a unos ${distM(e.xy)} m</title></circle>`).join('');
            return `<div><div class="an-sub" style="margin-top:0">${esc(mpAbr(nom))} · ${tot} tiros · ${puerta} a puerta · ${gs.length} ${gs.length === 1 ? 'gol' : 'goles'}${puerta ? ' · acierto ' + pct(gs.length / puerta) : ''}</div><div style="width:min(100%,300px)">${mediaPista(pts, `width="100%" role="img" aria-label="Tiros de ${esc(nom)} marcados en el vídeo"`)}</div></div>`; };
          return `<div style="margin-top:${info.length ? 20 : 0}px">${lab('TIROS MARCADOS EN EL VÍDEO')}<div style="font-size:13px;color:#A6A6AD;margin-top:4px">Cada tiro, marcado en el vídeo: ● gol · ○ parada · ✕ fuera o bloqueado. Mirando a la portería a la que se tiró.</div>
            <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:10px">${bloque('L')}${bloque('V')}</div></div>`; })() : (() => { const gs = (p.ev || []).filter(e => golVid(e) && golVid(e).xy); if (!gs.length) return '';
          const [cL, cV] = coloresLados(p.local, p.visitante);
          const pts = gs.map((e, i) => { const g = golVid(e); return `<g><title>${esc(e.marcador || '')} · ${quienTxt(e.jugador)} · a unos ${distM(g.xy)} m</title><circle cx="${g.xy[0] * PISTA_W}" cy="${g.xy[1] * PISTA_H}" r="11" fill="${e.lado === 'local' ? cL : cV}" stroke="#0D0D0E" stroke-width="2"/><text x="${g.xy[0] * PISTA_W}" y="${g.xy[1] * PISTA_H + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${tinta(e.lado === 'local' ? cL : cV)}">${i + 1}</text></g>`; }).join('');
          return `<div style="margin-top:${info.length ? 20 : 0}px">${lab('DESDE DÓNDE FUERON LOS GOLES')}<div style="font-size:13px;color:#A6A6AD;margin-top:4px">Marcados en el vídeo, mirando a la portería en la que entró cada gol. El número es el orden del gol.</div>
            <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-top:8px"><div style="width:min(100%,300px)">${mediaPista(pts, 'width="100%" role="img" aria-label="Media pista con el sitio desde el que se marcó cada gol"')}</div>
            <div style="font-size:13px;color:#A6A6AD"><div><span style="color:${cL}">●</span> ${esc(mpAbr(p.local))}</div><div><span style="color:${cV}">●</span> ${esc(mpAbr(p.visitante))}</div><div style="margin-top:6px">${gs.length} de ${(p.gl || 0) + (p.gv || 0)} goles marcados</div></div></div></div>`; })()}
        ${eventos ? `<div style="margin-top:${info.length ? 20 : 0}px">${lab('EVENTOS DEL PARTIDO')}<div style="font-size:13px;color:#A6A6AD;margin-top:4px">Minuto jugado de cada parte.</div>${eventos}</div>` : ''}
      </div>` : ''}`;
  }

  /* ── 5. Jugadores ───────────────────────────────────────── */




  /* ── Arquetipos (los del Wrapped; scripts/reporte/mapa.py decide cuál toca, comparando con la liga) ───────────────── */
  const ARQ = {
    sniper: ['Sniper', 'el francotirador', 'la francotiradora', '#a8281f', 'Está entre los que más goles marcan por partido en su liga, y marca más de lo que asiste.'],
    playmaker: ['Playmaker', 'el cerebro', 'el cerebro', '#2f6db3', 'Está entre los que más asistencias dan por partido en su liga, y asiste al menos tanto como marca.'],
    momentum: ['Momentum', 'el motor', 'el motor', '#c2520a', 'Está entre los que más puntos hacen por partido en su liga, sumando goles y asistencias.'],
    wildcard: ['Wildcard', 'el espectáculo', 'el espectáculo', '#d4a73b', 'Marca más que la mitad de su liga y está entre los que más minutos de sanción tienen por partido.'],
    steady: ['Steady', 'el consistente', 'la consistente', '#8a4fb5', 'Hace más puntos por partido que la mitad de su liga.'],
    ghost: ['Ghost', 'el fugaz', 'la fugaz', '#b8324a', 'Lleva pocos partidos (7 o menos): su perfil todavía puede cambiar.'],
    wall: ['Wall', 'el ancla', 'el ancla', '#4a6a9e', 'Juega mucho (12 partidos o más), hace pocos puntos y casi no tiene sanciones.'],
    workhorse: ['Workhorse', 'el currante', 'la currante', '#6B6B70', 'Juega con regularidad, sin números que destaquen en goles ni asistencias.'],
    game_changer: ['Game Changer', 'el decisivo', 'la decisiva', '#e89a2b', 'Ha marcado 3 goles o más que dieron la victoria a su equipo.'],
    comeback_king: ['Comeback King', 'el remontador', 'la remontadora', '#7b4ff2', 'Ha marcado 5 goles o más con su equipo por detrás en el marcador.'],
    hot_streak: ['Hot Streak', 'en racha', 'en racha', '#f57f3b', 'Ha marcado en 5 partidos seguidos o más.'],
    one_man_show: ['One Man Show', 'el solista', 'la solista', '#1f8fd8', 'Marca o da el pase en el 35 % o más de los goles de su equipo.'],
    mixed_player: ['Polivalente', 'campo y portería', 'campo y portería', '#4caaaa', 'Ha jugado de portero y de jugador de campo.'],
    rookie_phenom: ['Rookie Phenom', 'la promesa', 'la promesa', '#9d6cc0', 'Primera temporada en senior y ya hace más puntos que la mitad de su liga.'],
    veteran_loyal: ['Veterano', 'el de toda la vida', 'la de toda la vida', '#4a6a9e', 'Lleva 5 temporadas o más en el club.'],
    legend_alltime: ['Leyenda', 'del club histórico', 'del club histórico', '#d4a73b', 'Está entre los 3 primeros de la historia del club en goles, asistencias o partidos.'],
    iron_curtain: ['Iron Curtain', 'la cortina de hierro', 'la cortina de hierro', '#2f6db3', 'De los mejores porcentajes de paradas de su liga.'],
    reactive_wall: ['Reactive Wall', 'el reflejo', 'el reflejo', '#4a6a9e', 'Recibe muchos tiros por partido y para más que la mitad de los porteros de su liga.'],
    embattled: ['Embattled', 'el bombardeado', 'la bombardeada', '#c2520a', 'De los porteros que más tiros reciben por partido en su liga.'],
    undershot: ['Undershot', 'el bien defendido', 'la bien defendida', '#8a4fb5', 'De los porteros que menos tiros reciben por partido en su liga.'],
    workhorse_g: ['Workhorse', 'el titular indiscutible', 'la titular indiscutible', '#a8281f', 'Ha jugado 10 partidos o más en la portería.'],
    shadow: ['Shadow', 'el suplente puntual', 'la suplente puntual', '#6B6B70', 'Lleva pocos partidos en la portería (4 o menos).'],
  };
  const chipArq = (k, fem, grande) => ARQ[k] ? `<span style="display:inline-flex;align-items:center;gap:6px;font-size:${grande ? 14 : 12}px;font-weight:700;letter-spacing:.04em;padding:${grande ? '5px 10px' : '2px 8px'};border-radius:4px;background:#1E1E22;box-shadow:inset 3px 0 0 ${ARQ[k][3]};color:#F4F4F5;white-space:nowrap"><span>${esc(ARQ[k][0].toUpperCase())}</span><span style="font-weight:500;color:#A6A6AD;letter-spacing:0">${esc(fem ? ARQ[k][2] : ARQ[k][1])}</span></span>` : '';
  const LEY = { goles: 'goles', asistencias: 'asistencias', partidos: 'partidos' };
  function porQue(k, r) {   // el dato que lo explica, con los números del jugador
    const x = v => dec(+(+v).toFixed(2));
    return ({
      sniper: `${x(r.gl)} goles por partido: de los que más marcan en su liga`, playmaker: `${x(r.al)} asistencias por partido: de los que más asisten en su liga, y más asistencias que goles`,
      momentum: `${x(r.x)} puntos por partido: entre el 15 % de su liga que más produce`, wildcard: `Marca más que la mitad de su liga y suma ${x(r.sp)} minutos de sanción por partido, de los más altos`,
      steady: `${x(r.x)} puntos por partido: por encima de la mitad de su liga`, ghost: `${r.pj} partidos por ahora`,
      wall: `${r.pj} partidos, pocos puntos y casi sin sanciones`, workhorse: `${r.pj} partidos`,
      game_changer: `${r.gwg} goles que dieron la victoria`, comeback_king: `${r.detras} goles con el equipo por detrás`, hot_streak: `Marcó en ${r.racha} partidos seguidos`,
      one_man_show: `Participa en el ${r.pp} % de los goles de su equipo`, mixed_player: 'Ha jugado en portería y en campo',
      rookie_phenom: 'Primera temporada en senior y por encima de la mitad de su liga', veteran_loyal: `${r.temps} temporadas en el club`,
      legend_alltime: `Entre los 3 primeros de la historia del club en ${(r.ley || []).map(m => LEY[m] || m).join(', ').replace(/, ([^,]*)$/, ' y $1')}`,
      iron_curtain: `${x(r.pct)} % de paradas: del 25 % mejor de su liga`, reactive_wall: `${x(r.tpj)} tiros por partido, y para más que la mitad de su liga`,
      embattled: `${x(r.tpj)} tiros por partido: de los que más reciben`, undershot: `${x(r.tpj)} tiros por partido: de los que menos reciben`,
      shadow: `${r.pj} partidos en portería`, workhorse_g: `${r.pj} partidos en portería`,
    })[k] || '';
  }
  // la entrada de un jugador en el mapa: la de la liga de su equipo o, si juega en dos, la de más partidos
  const entradasMapa = (k, liga) => { if (!MAPA) return []; const xs = [];
    Object.entries(MAPA.ligas).forEach(([id, L]) => L.jug.concat(L.por.map(r => Object.assign({ gk: true }, r))).forEach(r => { if (r.k === k) xs.push(Object.assign({ liga: id }, r)); }));
    return xs.sort((a, b) => (b.liga === liga) - (a.liga === liga) || b.pj - a.pj); };
  const entradaMapa = (k, liga) => entradasMapa(k, liga)[0] || null;
  const conEquipoDe = id => id.startsWith('alevin') ? 'CON EL ALEVÍN' : id.startsWith('infantil') ? 'CON EL INFANTIL' : 'EN ' + ((MAPA.ligas[id] || {}).nombre || id).replace('Liga ', '').toUpperCase();

  /* ── Mapa de jugadores (data/mapa.json, de scripts/reporte/mapa.py) ─────────────────────────────────────────────────
     Cada jugador de campo de la liga por su producción (puntos por partido; en la escala de la liga, o en la de Senior 1
     con el FMPe al juntar las ligas senior) y su perfil (qué parte de sus puntos son goles). Las zonas y los «se parece a»
     vienen calculados. El SVG se dibuja a 1 unidad = 1 px para que los textos tengan siempre el mismo tamaño. */
  let MAPA = null, mapaP = null;
  const cargarMapa = () => mapaP || (mapaP = fetch('data/mapa.json?v=' + encodeURIComponent(A.actualizado || ''))
    .then(r => r.json()).then(d => (MAPA = d)).catch(() => { mapaP = null; return null; }));
  const ZONA = { Referentes: ['#2A1416', '#FF6B63'], Goleadores: ['#26262A', '#F4F4F5'], Pasadores: ['#16222E', '#6FB7FF'], Apoyo: ['#1E1E22', '#A6A6AD'] };
  const chipZona = z => z ? `<span style="font-size:11px;font-weight:700;letter-spacing:.06em;padding:2px 7px;border-radius:3px;background:${ZONA[z][0]};color:${ZONA[z][1]};white-space:nowrap">${esc(z.toUpperCase())}</span>` : '';
  const VISTA = {};   // lo que hay dibujado en cada mapa, para el recuadro de abajo
  const paso = m => [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20].find(st => m / st <= 6) || 50;
  const infoMapa = (c) => { const q = (VISTA[c.dataset.m] || [])[+c.dataset.i], box = view.querySelector(`[data-info="${c.dataset.m}"]`); if (!q || !box) return;
    view.querySelectorAll('.mp-p.sel').forEach(x => x.classList.remove('sel')); c.classList.add('sel');
    box.innerHTML = q.info; };
  document.addEventListener('click', e => { const c = e.target.closest && e.target.closest('.mp-p'); if (c) infoMapa(c); });
  document.addEventListener('pointerover', e => { const c = e.target.closest && e.target.closest('.mp-p'); if (c && e.pointerType === 'mouse') infoMapa(c); });
  // «Se parece a» en la ficha: llega con mapa.json (se pide al abrir la ficha)
  function rellenarArquetipo() {
    const el = view.querySelector('[data-arquetipo]'); if (!el) return;
    const pon = () => { const xs = entradasMapa(el.dataset.arquetipo, el.dataset.liga).filter(r => r.arq), fem = el.dataset.fem === '1'; if (!xs.length) { el.remove(); return; }
      const fila = (k, r, grande) => `<div style="display:flex;flex-direction:column;gap:4px;padding:${grande ? '0 0 10px' : '8px 0'};${grande ? '' : 'border-top:1px solid #26262A'}">
          <div>${chipArq(k, fem, grande)}</div>${grande ? `<div style="font-size:14px;line-height:1.45;color:#C9C9CE;font-style:italic">${esc(ARQ[k][4])}</div>` : ''}<div style="font-size:13px;color:#A6A6AD">${esc(porQue(k, r))}</div></div>`;
      // quien juega en dos ligas (Alevín e Infantil), con cada equipo por separado: cada liga se compara con la suya
      const uno = r => `${xs.length > 1 ? `<div style="font-size:12px;font-weight:700;letter-spacing:.1em;color:#FF6B63;margin:${r === xs[0] ? '0' : '14px'} 0 6px">${conEquipoDe(r.liga)}</div>` : ''}${fila(r.arq, r, true)}${(r.ras || []).map(k => fila(k, r)).join('')}`;
      el.innerHTML = `${lab('ARQUETIPO', 'margin-bottom:8px')}${xs.map(uno).join('')}
        <div style="font-size:12px;color:#6B6B70;margin-top:4px">Comparado con los jugadores de ${xs.length > 1 ? 'cada liga' : 'su liga'}${xs.some(r => r.antes) ? ', con la temporada pasada' : ''}${COMO('mapa')}</div>`; };
    if (MAPA) pon(); else cargarMapa().then(pon);
  }
  function rellenarPerfiles() {
    const el = view.querySelector('[data-perfiles]'); if (!el) return;
    const pon = () => { const L = MAPA && MAPA.ligas[el.dataset.liga]; if (!L) { el.remove(); return; }
      const nuestros = L.jug.concat(L.por).filter(r => r.nuestro && r.eq === el.dataset.equipo && r.arq);
      if (!nuestros.length) { el.remove(); return; }
      const grupos = {}; nuestros.forEach(r => { (grupos[r.arq] = grupos[r.arq] || []).push(r); });
      const rasgos = {}; nuestros.forEach(r => (r.ras || []).forEach(k => { (rasgos[k] = rasgos[k] || []).push(r); }));
      const quien = rs => rs.map(r => { const t = esc(corto({ nombre: r.n, apellidos: r.a })); return A.jugadores[r.k] ? `<a href="${hP(r.k)}">${t}</a>` : t; }).join(', ');
      const bloque = (k, rs) => `<div style="padding:9px 0;border-bottom:1px solid #26262A"><div>${chipArq(k, rs.every(r => (A.jugadores[r.k] || {}).fem))}</div><div style="font-size:14px;margin-top:4px">${quien(rs)}</div></div>`;
      el.innerHTML = `<div class="card" style="padding:16px 20px;margin-top:12px">${lab('PERFILES DE LA PLANTILLA', 'margin-bottom:2px')}<div style="font-size:13px;color:#A6A6AD;margin-bottom:4px">El arquetipo de cada jugador, comparado con los de su liga${COMO('mapa')}</div>
        ${Object.keys(ARQ).filter(k => grupos[k]).map(k => bloque(k, grupos[k])).join('')}
        ${Object.keys(rasgos).length ? `<div style="font-size:13px;font-weight:700;letter-spacing:.1em;color:#A6A6AD;margin:14px 0 2px">RASGOS</div>${Object.keys(ARQ).filter(k => rasgos[k]).map(k => bloque(k, rasgos[k])).join('')}` : ''}</div>`; };
    if (MAPA) pon(); else cargarMapa().then(pon);
  }
  function rellenarParecidos() {
    const el = view.querySelector('[data-parecidos]'); if (!el) return;
    const pon = () => { const xs = MAPA && MAPA.parecidos[el.dataset.parecidos]; if (!xs || !xs.length) { el.remove(); return; }
      const gk = el.dataset.portero === '1';
      el.innerHTML = `${lab('SE PARECE A', 'margin-bottom:2px')}<div style="font-size:13px;color:#A6A6AD;margin-bottom:4px">${gk ? 'Porteros de otros clubes con un % de paradas y unos tiros por partido parecidos' : 'Jugadores de otros clubes con números parecidos: goles, asistencias, parte de los goles de su equipo y sanción por partido, en la misma escala para todas las ligas'}${COMO('mapa')}</div>
        ${xs.map(x => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #26262A">${disc(crest(x.eq), 28)}<div style="min-width:0;flex:1"><div style="font-weight:700">${esc(corto({ nombre: x.n, apellidos: x.a }))}</div><div style="font-size:13px;color:#A6A6AD">${esc(x.eq)} · ${esc(x.liga)}</div></div>${chipZona(x.zona)}</div>`).join('')}
        ${el.dataset.liga ? `<a href="${hLg(el.dataset.liga, 'mapa')}" style="display:inline-block;margin-top:10px;font-size:14px;font-weight:700">Ver el mapa de la liga →</a>` : ''}`; };
    if (MAPA) pon(); else cargarMapa().then(pon);
  }


  /* ── Análisis (data/analisis.json, de scripts/reporte/analisis.py) y agenda (data/agenda.json y cal/*.ics, de agenda.py) ──
     Se piden al abrir la página que los usa. Todo sale de las actas y del calendario de la FMP. */
  let ANA = null, anaP = null, AGE = null, ageP = null;
  const verDatos = () => encodeURIComponent(A.actualizado || '');
  const cargarAnalisis = () => anaP || (anaP = fetch('data/analisis.json?v=' + verDatos()).then(r => r.json()).then(d => (ANA = d)).catch(() => { anaP = null; return null; }));
  const cargarAgenda = () => ageP || (ageP = fetch('data/agenda.json?v=' + verDatos()).then(r => r.json()).then(d => (AGE = d)).catch(() => { ageP = null; return null; }));
  const pct = (v, d = 0) => dec((v * 100).toFixed(d)) + ' %';
  const anTog = (on, attrs, txt) => `<button type="button" class="an-tog"${on ? ' aria-pressed="true"' : ' aria-pressed="false"'} ${attrs}>${txt}</button>`;
  const anK = (k, v, sub, ink) => `<div class="an-k"><div class="k">${k}</div><div class="v"${ink ? ` style="color:${ink}"` : ''}>${v}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  const mpAbr = n => { const e = A.equipos.find(x => x.nombre === n); return e && !e.cantera ? 'MP ' + e.id : abr(n); };

  // ── probabilidad según marcador y minuto: [gana el local, penaltis, gana el visitante] ──
  function prob(cantera, d, queda) {
    const T = ANA && ANA.prob && ANA.prob[cantera ? 'cantera' : 'senior']; if (!T) return null;
    const q = Math.max(0, Math.min(T.min, queda)), q0 = Math.floor(q), q1 = Math.min(T.min, q0 + 1), f = q - q0;
    const fila = T.tabla[Math.min(4, Math.abs(d))], c = fila[q0].map((v, i) => v + (fila[q1][i] - v) * f);
    if (!d) return [c[0], c[1], Math.max(0, 1 - c[0] - c[1])];
    const resto = Math.max(0, 1 - c[0] - c[1]);
    return d > 0 ? [c[0], c[1], resto] : [resto, c[1], c[0]];
  }
  // colores de cada lado en los gráficos: rojo el nuestro; el otro, gris
  const coloresLados = (l, v) => ours(l) && ours(v) ? [RED, '#C9C9CE'] : ours(l) ? [RED, '#8A8A92'] : ours(v) ? ['#8A8A92', RED] : ['#C9C9CE', '#6B6B70'];
  const tinta = c => (c === RED ? '#FFFFFF' : '#0D0D0E');
  const anchoGrafico = (max = 900) => Math.round(Math.min(max, Math.max(300, (innerWidth || 1000) - (innerWidth < 720 ? 72 : 140))));

  /* Gráfico del partido: con el marcador de cada momento, cuántas veces gana cada equipo (y cuántas se va a los penaltis)
     en los partidos de la FMP desde 2016/17. Los goles, marcados arriba (local) y abajo (visitante). */
  const PG = {};
  function graficoPartido(p) {
    const cantera = /^(alevin|infantil)/.test(p.liga || ''), dur = cantera ? 1200 : 1500, T = 2 * dur;
    const goles = (p.ev || []).filter(e => e.tipo === 'gol' && /^P[12]$/.test(e.periodo)).map(e => {
      const q = segs(e.minuto); return q == null || q > dur ? null : { t: (+e.periodo[1] - 1) * dur + dur - q, lado: e.lado === 'local' ? 'L' : 'V', e }; });
    if (!ANA || goles.some(x => !x) || goles.length !== (p.gl || 0) + (p.gv || 0)) return '';
    goles.sort((a, b) => a.t - b.t);
    const tiempos = new Set(); for (let t = 0; t <= T; t += 15) tiempos.add(t);
    goles.forEach(g => { tiempos.add(Math.max(0, g.t - 0.01)); tiempos.add(g.t); });
    const ts = [...tiempos].sort((a, b) => a - b);
    const dif = t => goles.reduce((n, g) => n + (g.t <= t ? (g.lado === 'L' ? 1 : -1) : 0), 0);
    const pts = ts.map(t => ({ t, d: dif(t), p: prob(cantera, dif(t), (T - t) / 60) }));
    if (pts.some(x => !x.p)) return '';
    const W = anchoGrafico(860), H = W < 560 ? 190 : 220, Lm = 6, Rm = 6, Tm = 16, Bm = 26, w = W - Lm - Rm, h = H - Tm - Bm;
    const sx = t => Lm + t / T * w, sy = v => Tm + v * h;
    const [cL, cV] = coloresLados(p.local, p.visitante), cE = '#45454C';
    const banda = (a, b) => { const up = pts.map(x => `${sx(x.t).toFixed(1)},${sy(a(x)).toFixed(1)}`), dn = pts.slice().reverse().map(x => `${sx(x.t).toFixed(1)},${sy(b(x)).toFixed(1)}`); return up.concat(dn).join(' '); };
    const polyL = banda(() => 0, x => x.p[0]), polyE = banda(x => x.p[0], x => x.p[0] + x.p[1]), polyV = banda(x => x.p[0] + x.p[1], () => 1);
    const ticks = []; for (let m = 0; m <= T / 60; m += 10) ticks.push(`<text x="${sx(m * 60)}" y="${H - 8}" text-anchor="${m === 0 ? 'start' : m === T / 60 ? 'end' : 'middle'}">${m}'</text>`);
    const id = 'pg' + (p.idp || p.mid);
    PG[id] = goles.map(g => { const i = pts.findIndex(x => x.t === g.t), pp = pts[i].p, quien = g.e.jugador ? quienTxt(g.e.jugador) : '';
      const eq = g.lado === 'L' ? p.local : p.visitante, k = g.lado === 'L' ? 0 : 2;
      return `<b style="color:#F4F4F5">Minuto ${Math.floor(g.t / 60) + 1}</b> · Gol de ${esc(mpAbr(eq))}${quien ? ' (' + quien + ')' : ''} · ${esc((g.e.marcador || '').replace('-', '–'))}<br>Con ese marcador, ${esc(mpAbr(eq))} acaba ganando el ${pct(pp[k])} de las veces${pp[1] > 0.04 ? ` · a los penaltis, el ${pct(pp[1])}` : ''}.`; });
    const marcas = goles.map((g, i) => { const x = sx(g.t), y = g.lado === 'L' ? Tm - 8 : Tm + h + 8;
      return `<g class="pg-g" data-pg="${id}" data-i="${i}" tabindex="0"><rect x="${x - 9}" y="${y - 9}" width="18" height="18" fill="transparent"/><circle cx="${x}" cy="${y}" r="5" fill="${g.lado === 'L' ? cL : cV}" stroke="#0D0D0E" stroke-width="1.5"/></g>`; }).join('');
    // la frase: si el ganador estuvo muy lejos, o si el que perdió llegó a tenerlo
    const gana = p.gl > p.gv ? 0 : p.gl < p.gv ? 2 : null, nom = k => { const n = k === 0 ? p.local : p.visitante; return esc(ours(n) ? mpAbr(n) : n); };
    const antes = pts.filter(x => x.t < T - 30);
    let frase = '';
    if (gana != null && antes.length) {
      const peor = antes.reduce((a, x) => (x.p[gana] < a.p[gana] ? x : a), antes[0]), pierde = 2 - gana, mejorP = antes.reduce((a, x) => (x.p[pierde] > a.p[pierde] ? x : a), antes[0]);
      const marc = x => { const l = goles.filter(g => g.t <= x.t && g.lado === 'L').length, v = goles.filter(g => g.t <= x.t && g.lado === 'V').length; return l + '–' + v; };
      if (peor.p[gana] < 0.3) frase = `${nom(gana)} llegó a tener solo un ${pct(peor.p[gana])} de opciones de ganar (minuto ${Math.floor(peor.t / 60) + 1}, con ${marc(peor)}) y acabó ganando.`;
      else if (mejorP.p[pierde] > 0.55) frase = `${nom(pierde)} llegó a tener un ${pct(mejorP.p[pierde])} de opciones de ganar (minuto ${Math.floor(mejorP.t / 60) + 1}, con ${marc(mejorP)}), pero perdió.`;
      else if (antes.filter(x => x.p[gana] > 0.6).length > antes.length * 0.6) frase = `${nom(gana)} fue favorito casi todo el partido.`;
    } else if (gana == null && antes.length) frase = 'Acabó en empate y se decidió en los penaltis.';
    const n = ANA.prob[cantera ? 'cantera' : 'senior'].partidos;
    return `<div class="pg" style="max-width:${W}px;margin:28px auto 0">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap"><span class="lab">CÓMO FUE EL PARTIDO</span>
        <span style="display:flex;gap:12px;font-size:13px;color:#A6A6AD;flex-wrap:wrap"><span><span style="color:${cL}">■</span> gana ${esc(mpAbr(p.local))}</span><span><span style="color:${cE}">■</span> penaltis</span><span><span style="color:${cV}">■</span> gana ${esc(mpAbr(p.visitante))}</span></span></div>
      ${frase ? `<div style="font-size:15px;color:#F4F4F5;margin-top:6px">${frase}</div>` : ''}
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Opciones de ganar de cada equipo según el marcador de cada minuto" style="display:block;margin-top:8px;font-size:12px;fill:#8A8A8F;font-family:'IBM Plex Sans Condensed',sans-serif">
        <polygon points="${polyL}" fill="${cL}"/><polygon points="${polyE}" fill="${cE}"/><polygon points="${polyV}" fill="${cV}"/>
        <line x1="${sx(dur)}" x2="${sx(dur)}" y1="${Tm}" y2="${Tm + h}" stroke="#0D0D0E" stroke-width="2" stroke-dasharray="3 3"/>
        <line x1="${Lm}" x2="${Lm + w}" y1="${sy(0.5)}" y2="${sy(0.5)}" stroke="#0D0D0E" stroke-opacity=".35"/>
        <text x="${Lm + 6}" y="${Tm + 15}" fill="${tinta(cL)}" font-weight="700">${esc(mpAbr(p.local))}</text>
        <text x="${Lm + 6}" y="${Tm + h - 6}" fill="${tinta(cV)}" font-weight="700">${esc(mpAbr(p.visitante))}</text>
        ${ticks.join('')}${marcas}</svg>
      <div class="pg-info" data-info="${id}" aria-live="polite" style="min-height:40px;margin-top:6px;font-size:14px;color:#A6A6AD">Toca un gol (los puntos de arriba y de abajo) para ver cómo cambió el partido.</div>
      <div style="font-size:12px;color:#6B6B70;margin-top:2px">La línea de puntos es el descanso. Con cada marcador y minuto, cuántas veces acaba ganando cada equipo en ${n.toLocaleString('es')} partidos ${cantera ? 'de Alevín e Infantil' : 'senior'} de la FMP desde 2016/17. No mira quién juega${COMO('probabilidad')}</div></div>`;
  }
  const infoPG = g => { const box = view.querySelector(`[data-info="${g.dataset.pg}"]`), t = (PG[g.dataset.pg] || [])[+g.dataset.i]; if (box && t) { view.querySelectorAll('.pg-g.sel').forEach(x => x.classList.remove('sel')); g.classList.add('sel'); box.innerHTML = t; } };
  document.addEventListener('click', e => { const g = e.target.closest && e.target.closest('.pg-g'); if (g) infoPG(g); });
  document.addEventListener('pointerover', e => { const g = e.target.closest && e.target.closest('.pg-g'); if (g && e.pointerType === 'mouse') infoPG(g); });
  document.addEventListener('focusin', e => { const g = e.target.closest && e.target.closest('.pg-g'); if (g) infoPG(g); });
  function rellenarGraficoPartido() {
    const el = view.querySelector('[data-grafico-partido]'); if (!el) return;
    const pon = () => { const p = A.partidos[el.dataset.graficoPartido]; const h = p && ANA ? graficoPartido(p) : ''; if (h) el.innerHTML = h; else el.remove(); };
    if (ANA) pon(); else cargarAnalisis().then(pon);
  }
  // en el directo: con el marcador y el minuto del último apunte del acta
  function probDirecto(ctx) {
    const sn = ctx.sn, dur = ctx.dur;
    if (!ANA || !dur || !sn || sn.estado === 'previa' || sn.estado === 'final' || sn.fase === 'penaltis') return null;
    const abs = e => (e.periodo - 1) * dur + (segs(e.t) || 0);
    let t = Math.max(0, ...sn.eventos.filter(e => e.periodo && e.t != null).map(abs));
    if (sn.estado === 'descanso') t = Math.max(t, dur);
    const gl = sn.eventos.filter(e => e.tipo === 'GOL' && e.lado === 'L').length, gv = sn.eventos.filter(e => e.tipo === 'GOL' && e.lado === 'V').length;
    const cantera = dur <= 1200;
    const pr = prob(cantera, gl - gv, (2 * dur - t) / 60);
    return pr ? { pr, queda: Math.max(0, Math.round((2 * dur - t) / 60)) } : null;
  }

  /* ── Equipo: cómo juega (cuándo marca y encaja, el marcador, tiros, disciplina, quién asiste a quién y el próximo rival) ── */
  const ANA_SEL = {};   // temporada elegida en cada equipo
  const tramoTxt = (i, nb) => { const m = i * 5; return `entre el minuto ${m} y el ${m + 5}` + (i === nb - 1 ? ' (los últimos 5)' : i === nb / 2 - 1 ? ' (antes del descanso)' : ''); };
  function svgTramos(x, cantera, nos) {
    const nb = x.tramos.f.length, mx = Math.max(1, ...x.tramos.f, ...x.tramos.c);
    const W = Math.min(560, anchoGrafico(560)), H = 210, Lm = 4, Rm = 4, Tm = 18, Bm = 22, w = W - Lm - Rm, h = H - Tm - Bm, mid = Tm + h / 2, bw = w / nb;
    const barras = x.tramos.f.map((f, i) => { const c = x.tramos.c[i], hf = f / mx * (h / 2 - 12), hc = c / mx * (h / 2 - 12), xx = Lm + i * bw + 3;
      return `<g><title>${tramoTxt(i, nb)}: ${f} a favor, ${c} en contra</title>
        ${f ? `<rect x="${xx}" y="${mid - hf}" width="${bw - 6}" height="${hf}" rx="3" fill="${nos ? RED : '#C9C9CE'}"/><text x="${xx + (bw - 6) / 2}" y="${mid - hf - 3}" text-anchor="middle" fill="#F4F4F5">${f}</text>` : ''}
        ${c ? `<rect x="${xx}" y="${mid + 1}" width="${bw - 6}" height="${hc}" rx="3" fill="#6B6B70"/><text x="${xx + (bw - 6) / 2}" y="${mid + hc + 12}" text-anchor="middle" fill="#C9C9CE">${c}</text>` : ''}</g>`; }).join('');
    const ticks = Array.from({ length: nb / 2 + 1 }, (_, j) => j * 2).map(i => `<text x="${Lm + i * bw}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === nb ? 'end' : 'middle'}">${i * 5}'</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Goles a favor y en contra en cada tramo de 5 minutos" style="display:block;max-width:${W}px;font-size:12px;fill:#8A8A8F;font-family:'IBM Plex Sans Condensed',sans-serif">
      <line x1="${Lm}" x2="${Lm + w}" y1="${mid}" y2="${mid}" stroke="#55555B"/><line x1="${Lm + w / 2}" x2="${Lm + w / 2}" y1="${Tm - 6}" y2="${Tm + h}" stroke="#3A3A40" stroke-dasharray="3 3"/>
      ${barras}${ticks}</svg>`;
  }
  function fraseTramos(x, nos) {
    const nb = x.tramos.f.length, out = [];
    const pico = (arr, tot) => { if (tot < 8) return null; const i = arr.indexOf(Math.max(...arr)); return arr[i] / tot >= 1.6 / nb && arr[i] >= 4 ? i : null; };
    const ic = pico(x.tramos.c, x.gc), iF = pico(x.tramos.f, x.gf);
    if (ic != null) out.push(`${nos ? 'Donde más nos marcan' : 'Donde más le marcan'}: ${tramoTxt(ic, nb)}, ${x.tramos.c[ic]} de ${x.gc} goles (el ${pct(x.tramos.c[ic] / x.gc)}).`);
    if (iF != null) out.push(`${nos ? 'Donde más marcamos' : 'Donde más marca'}: ${tramoTxt(iF, nb)}, ${x.tramos.f[iF]} de ${x.gf} (el ${pct(x.tramos.f[iF] / x.gf)}).`);
    return out.join(' ');
  }
  const ved = a => `${a[0]} V · ${a[1]} E · ${a[2]} D`;
  const media = (xs, f) => { const v = xs.map(f).filter(z => z != null && isFinite(z)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  function svgRed(r, ancho) {
    // los 12 que más goles hacen juntos; líneas más gruesas cuantos más goles entre los dos (en cualquier sentido)
    const peso = {}, par = {};
    r.pares.filter(([a]) => a).forEach(([a, b, n]) => { peso[a] = (peso[a] || 0) + n; peso[b] = (peso[b] || 0) + n; const k = [a, b].sort().join('|'); par[k] = (par[k] || 0) + n; });
    const nodos = Object.keys(peso).sort((a, b) => peso[b] - peso[a]).slice(0, 12);
    if (nodos.length < 3) return '';
    const W = Math.min(ancho, 520), H = Math.round(W * 0.82), cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 64;
    const pos = {}; nodos.forEach((k, i) => { const a = -Math.PI / 2 + i / nodos.length * 2 * Math.PI; pos[k] = [cx + R * Math.cos(a), cy + R * Math.sin(a), a]; });
    const mx = Math.max(...Object.values(par));
    const lineas = Object.entries(par).filter(([k]) => k.split('|').every(x => pos[x])).sort((a, b) => a[1] - b[1]).map(([k, n]) => { const [a, b] = k.split('|');
      return `<line class="rd-l" data-a="${esc(a)}" data-b="${esc(b)}" x1="${pos[a][0].toFixed(1)}" y1="${pos[a][1].toFixed(1)}" x2="${pos[b][0].toFixed(1)}" y2="${pos[b][1].toFixed(1)}" stroke="${RED}" stroke-opacity="${(0.35 + 0.6 * n / mx).toFixed(2)}" stroke-width="${(1.5 + 7 * n / mx).toFixed(1)}" stroke-linecap="round"><title>${n} ${n === 1 ? 'gol' : 'goles'} entre los dos</title></line>`; }).join('');
    const nm = k => { const x = r.nombres[k]; return x ? iniApe({ nombre: x[0], apellidos: x[1] }) : k; };
    const puntos = nodos.map(k => { const [x, y, a] = pos[k], c = Math.cos(a), anchor = Math.abs(c) < 0.25 ? 'middle' : c > 0 ? 'start' : 'end', lx = x + Math.cos(a) * 12, ly = y + Math.sin(a) * 12 + (Math.abs(c) < 0.25 ? (Math.sin(a) > 0 ? 10 : -4) : 4);
      return `<g class="rd-n" data-k="${esc(k)}" tabindex="0"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(5 + 5 * peso[k] / peso[nodos[0]]).toFixed(1)}" fill="#F4F4F5" stroke="#0D0D0E" stroke-width="2"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" fill="#C9C9CE">${esc(nm(k))}</text></g>`; }).join('');
    return `<svg class="rd" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Quién asiste a quién: las líneas unen a dos jugadores que han hecho goles juntos" style="display:block;max-width:${W}px;margin:0 auto;font-size:12px;font-family:'IBM Plex Sans Condensed',sans-serif">${lineas}${puntos}</svg>`;
  }
  document.addEventListener('click', e => { const n = e.target.closest && e.target.closest('.rd-n'); if (!n) return; const svg = n.closest('svg'), k = n.dataset.k, on = !n.classList.contains('sel');
    svg.querySelectorAll('.rd-n').forEach(x => x.classList.toggle('sel', on && x === n)); svg.classList.toggle('foco', on);
    svg.querySelectorAll('.rd-l').forEach(l => l.classList.toggle('on', on && (l.dataset.a === k || l.dataset.b === k))); });
  function bloqueEquipo(e) {
    const yo = ANA.equipos[e.id]; if (!yo || (!yo.temp && !yo.prev)) return '';
    const pjT = (yo.temp || {}).pj || 0, pjP = (yo.prev || {}).pj || 0;
    const sel = ANA_SEL[e.id] || (pjT >= 6 || !pjP ? 'temp' : 'prev'), x = yo[sel] || yo.temp || yo.prev, alc = yo[sel] ? sel : yo.temp ? 'temp' : 'prev';
    const tPrev = tempAnt(), nomT = alc === 'temp' ? 'esta temporada' : tPrev;
    const liga = Object.values(ANA.equipos).filter(o => o.liga === e.ligaId && o[alc]);
    const tog = pjP ? `<div class="an-togs">${anTog(alc === 'temp', `data-ana-eq="${e.id}" data-ana-t="temp"`, `Esta temporada · ${pjT} PJ`)}${anTog(alc === 'prev', `data-ana-eq="${e.id}" data-ana-t="prev"`, `${tPrev} · ${pjP} PJ`)}</div>` : '';
    const poco = x.pj < 6 ? `<div class="an-nota">Con ${x.pj} ${x.pj === 1 ? 'partido' : 'partidos'} todavía dice poco${pjP && alc === 'temp' ? '; la temporada pasada da una idea más completa' : ''}.</div>` : '';
    // 1 · cuándo
    const cuando = `<div class="card an-c">${lab('CUÁNDO MARCAMOS Y CUÁNDO NOS MARCAN')}
      <div class="an-ley"><span><span style="color:${RED}">■</span> a favor (${x.gf})</span><span><span style="color:#6B6B70">■</span> en contra (${x.gc})</span><span>por tramos de 5 minutos</span></div>
      ${svgTramos(x, e.cantera, true)}<div class="an-frase">${fraseTramos(x, true) || 'Sin un tramo que destaque.'}</div>
      ${x.conMin < x.pj ? `<div class="an-nota">${x.pj - x.conMin} ${x.pj - x.conMin === 1 ? 'partido no entra' : 'partidos no entran'}: al acta le faltan minutos de algún gol.</div>` : ''}</div>`;
    // 2 · el marcador
    const m = x.marcador, prim = m.primero[0] + m.primero[1] + m.primero[2], enc = m.encajaPrimero[0] + m.encajaPrimero[1] + m.encajaPrimero[2];
    const marcador = `<div class="card an-c">${lab('VENTAJAS Y REMONTADAS')}<div class="an-ks">
      ${anK('Íbamos ganando y no ganamos', m.ventajaPerdida, m.ventajaPerdida === 1 ? 'partido' : 'partidos', m.ventajaPerdida ? '#FF8A3D' : '')}
      ${anK('Remontadas', m.remontadas, 'partidos ganados yendo por detrás', m.remontadas ? '#3DD27E' : '')}
      ${prim ? anK('Cuando marcamos primero', ved(m.primero), `ganamos el ${pct(m.primero[0] / prim)}`) : ''}
      ${enc ? anK('Cuando nos marcan primero', ved(m.encajaPrimero), `ganamos el ${pct(m.encajaPrimero[0] / enc)}`) : ''}
      ${m.pen[0] + m.pen[1] ? anK('Tandas de penaltis', `${m.pen[0]}–${m.pen[1]}`, 'ganadas – perdidas') : ''}</div>
      <div class="an-nota">En el tiempo de juego: un empate que se gana en los penaltis cuenta como «no ganamos».</div></div>`;
    // 3 · tiros
    const t = x.tiros, tl = liga.filter(o => o[alc].tiros.pj).map(o => o[alc].tiros);
    const mT = media(tl, z => z.f / z.pj), mA = media(tl, z => z.gf / z.f), mP = media(tl, z => 1 - z.gc / z.c);
    const comp = (v, mm, d = 1, suf = '') => mm == null ? '' : `media de la liga: ${dec(mm.toFixed(d))}${suf}`;
    const tiros = t.pj ? `<div class="card an-c">${lab('TIROS A PUERTA')}<div class="an-ks">
      ${anK('Tiramos por partido', dec((t.f / t.pj).toFixed(1)), comp(t.f / t.pj, mT))}
      ${anK('Nos tiran por partido', dec((t.c / t.pj).toFixed(1)), '')}
      ${anK('Acierto', pct(t.gf / t.f), mA != null ? `1 de cada ${Math.round(t.f / Math.max(1, t.gf))} · media de la liga ${pct(mA)}` : `1 de cada ${Math.round(t.f / Math.max(1, t.gf))}`)}
      ${anK('Paradas de nuestra portería', pct(1 - t.gc / t.c), mP != null ? `media de la liga ${pct(mP)}` : '')}</div>
      <div class="an-nota">Los tiros a puerta los apunta el acta en cada portero; no dice quién tira. ${t.pj < x.pj ? `En ${t.pj} de ${x.pj} partidos.` : ''}</div></div>` : '';
    // 4 · disciplina
    const d = x.disc;
    const disc_ = `<div class="card an-c">${lab('DISCIPLINA')}<div class="an-ks">
      ${anK('Faltas por partido', dec((d.faltas / x.pj).toFixed(1)), `${d.faltas} en ${x.pj} PJ`)}
      ${anK('Sanción por partido', fmin(d.min / x.pj), `${fmin(d.min)} en total`)}
      ${anK('Con uno más', `${d.supF}–${d.infC}`, 'goles a favor – en contra')}
      ${anK('Con uno menos', `${d.infF}–${d.supC}`, 'goles a favor – en contra')}</div>
      ${d.tipos.length ? `<div class="an-frase">Las faltas que más repetimos: ${d.tipos.map(([k, n]) => `${esc(k.toLowerCase())} (${n})`).join(', ')}.</div>` : ''}</div>`;
    // 5 · quién asiste a quién
    const rd = ANA.redes[e.id] && ANA.redes[e.id][alc];
    let red = '';
    if (rd && rd.pares.length) {
      const top = rd.pares.filter(([a]) => a).slice(0, 5), solos = rd.pares.filter(([a]) => !a).reduce((s, z) => s + z[2], 0), tot = rd.pares.reduce((s, z) => s + z[2], 0);
      const nmL = k => { const p = A.jugadores[k], x = rd.nombres[k]; const t2 = p ? corto(p) : x ? corto({ nombre: x[0], apellidos: x[1] }) : k; return p ? `<a href="${hP(k)}">${esc(t2)}</a>` : esc(t2); };
      const g = svgRed(rd, anchoGrafico(520));
      red = `<div class="card an-c an-ancha">${lab('QUIÉN ASISTE A QUIÉN')}<div class="an-nota" style="margin-top:2px">Cada línea une a dos jugadores que han hecho goles juntos (uno asiste y el otro marca); cuanto más gruesa, más goles. Toca un nombre para ver solo los suyos.</div>
        <div class="an-red">${g}<div>${top.length ? `<div class="an-sub">LAS PAREJAS CON MÁS GOLES</div>${top.map(([a, b, n]) => `<div class="an-fila"><span>${nmL(a)} <span style="color:#6B6B70">→</span> ${nmL(b)}</span><b>${n}</b></div>`).join('')}` : ''}
          <div class="an-nota">${solos} de ${tot} goles sin asistencia.</div></div></div></div>`;
    }
    return `${lab('CÓMO JUEGA EL EQUIPO · ' + nomT.toUpperCase(), 'margin:28px 0 6px')}${tog}${poco}
      <div class="an-grid">${cuando}${marcador}${tiros}${disc_}${red}</div>${rivalHtml(e, yo)}`;
  }
  function rivalHtml(e, yo) {
    const hoy = hoyISO(), nx = e.cal.filter(c => !c.descanso && !c.resultado && c.fecha && c.fecha >= hoy).sort((a, b) => (a.fecha + (a.hora || '')) < (b.fecha + (b.hora || '')) ? -1 : 1)[0];
    if (!nx) return '';
    const riv = ours(nx.rival) ? ANA.equipos[(A.equipos.find(x => x.nombre === nx.rival && x.ligaId === e.ligaId) || {}).id] : ANA.equipos[e.ligaId + '|' + nx.rival];
    if (!riv) return '';
    const alc = (yo.temp || {}).pj >= 4 && (riv.temp || {}).pj >= 4 ? 'temp' : yo.prev && riv.prev ? 'prev' : yo.temp && riv.temp ? 'temp' : null;
    if (!alc) return '';
    const a = yo[alc], b = riv[alc];
    const pico = (arr, nb) => { const s = arr.reduce((x, y) => x + y, 0); if (s < 6) return '—'; const i = arr.indexOf(Math.max(...arr)); return `${i * 5}–${i * 5 + 5}'`; };
    const fila = (k, f, mejor) => { const va = f(a), vb = f(b); return `<div class="an-cmp"><b class="${mejor && va.n != null && vb.n != null && mejor(va.n, vb.n) ? 'gana' : ''}">${va.t}</b><span>${k}</span><b class="${mejor && va.n != null && vb.n != null && mejor(vb.n, va.n) ? 'gana' : ''}">${vb.t}</b></div>`; };
    const n = (v, d = 1) => ({ n: v, t: v == null || !isFinite(v) ? '—' : dec(v.toFixed(d)) }), pc = v => ({ n: v, t: v == null || !isFinite(v) ? '—' : pct(v) });
    const mas = (x, y) => x > y, menos = (x, y) => x < y;
    const h2h = (e.h2h || []).find(h => h.rival === nx.rival);
    const pel = MAPA && MAPA.ligas[e.ligaId] ? MAPA.ligas[e.ligaId].jug.filter(r => r.eq === nx.rival && r.pj >= 3 && r.x != null).sort((p, q) => q.x - p.x).slice(0, 3) : [];
    return `${lab('PRÓXIMO RIVAL · ' + esc(nx.rival), 'margin:28px 0 6px')}
      <div class="card an-c" style="max-width:760px"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:6px">${disc(crest(nx.rival), 40)}<div><div style="font-weight:700;font-size:16px">${esc(fd(nx.fecha))}${nx.hora ? ' · ' + esc(nx.hora) : ''} · ${nx.casa ? 'en casa' : 'fuera'}</div>
        <div style="font-size:13px;color:#A6A6AD">${alc === 'temp' ? 'Números de esta temporada' : 'Números de ' + tempAnt() + ' (esta temporada aún llevan pocos partidos)'}${h2h ? ` · historial contra ellos: ${h2h.v}-${h2h.e}-${h2h.d}` : ''}</div></div></div>
        <div class="an-cmp cab"><b>${esc(mpAbr(e.nombre))}</b><span></span><b>${esc(abr(nx.rival))}</b></div>
        ${fila('Goles a favor por partido', z => n(z.gf / z.pj), mas)}${fila('Goles en contra por partido', z => n(z.gc / z.pj), menos)}
        ${fila('Tiros a puerta por partido', z => n(z.tiros.pj ? z.tiros.f / z.tiros.pj : null), mas)}${fila('Acierto', z => pc(z.tiros.pj ? z.tiros.gf / z.tiros.f : null), mas)}
        ${fila('% de paradas', z => pc(z.tiros.pj ? 1 - z.tiros.gc / z.tiros.c : null), mas)}${fila('Faltas por partido', z => n(z.disc.faltas / z.pj), menos)}
        ${fila('Ganan si marcan primero', z => { const s = z.marcador.primero.reduce((x, y) => x + y, 0); return pc(s ? z.marcador.primero[0] / s : null); }, mas)}
        ${fila('Tramo en el que más marcan', z => ({ n: null, t: pico(z.tramos.f) }))}${fila('Tramo en el que más encajan', z => ({ n: null, t: pico(z.tramos.c) }))}
        ${pel.length ? `<div class="an-sub" style="margin-top:12px">SUS JUGADORES CON MÁS PUNTOS POR PARTIDO</div>${pel.map(r => `<div class="an-fila"><span>${esc(corto({ nombre: r.n, apellidos: r.a }))}</span><b>${dec(r.x.toFixed(2))} <span style="font-size:12px;color:#A6A6AD;font-weight:600">pts/PJ</span></b></div>`).join('')}` : ''}
        <div class="an-nota">En verde, quién sale mejor en cada fila.</div></div>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-ana-eq]'); if (!b) return;
    ANA_SEL[b.dataset.anaEq] = b.dataset.anaT; const el = view.querySelector('[data-analisis]'); if (el && ANA) el.innerHTML = bloqueEquipo(A.equipos.find(x => x.id === b.dataset.anaEq)); });
  function rellenarEquipo() {
    const el = view.querySelector('[data-analisis]'); if (!el) return;
    const e = A.equipos.find(x => x.id === el.dataset.analisis); if (!e) return;
    const pon = () => { if (!ANA) { el.remove(); return; } el.innerHTML = bloqueEquipo(e); };
    Promise.all([cargarAnalisis(), MAPA ? MAPA : cargarMapa()]).then(pon);
  }

  /* ── Agenda: ven a vernos (días en casa, con los otros partidos de la pista) y calendarios para el móvil ── */
  const BASE_WEB = () => location.origin + location.pathname.replace(/[^/]*$/, '');
  const CAL_OPC = [['club', 'Todo el club'], ['casa', 'Solo en casa'], ['A', 'Equipo A'], ['B', 'Equipo B'], ['C', 'Equipo C'], ['D', 'Equipo D'], ['AL', 'Alevín'], ['IN', 'Infantil']];
  const CAL_SEL = { k: null };
  function calHtml(k, solo) {
    if (!AGE || !AGE.cal) return '';
    const url = BASE_WEB() + AGE.cal[k], wc = url.replace(/^https?:/, 'webcal:'), g = 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(wc);
    const opc = solo ? '' : `<div class="an-togs">${CAL_OPC.map(([kk, t]) => anTog(kk === k, `data-cal="${kk}"`, t)).join('')}</div>`;
    return `${opc}<div class="an-cal"><a class="dv-alin" href="${esc(g)}" target="_blank" rel="noopener">Google Calendar</a><a class="dv-alin" href="${esc(wc)}">iPhone · Outlook</a><button type="button" class="an-tog" data-copiar="${esc(url)}">Copiar enlace</button></div>
      <div class="an-nota">Se actualiza solo: cuando la FMP pone la hora o cambia un partido, el calendario del móvil lo recoge en unas horas. Cada partido lleva la pista y cómo llegar.</div>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-cal]');
    if (b) { CAL_SEL.k = b.dataset.cal; const c = b.closest('[data-cal-caja]'); if (c) c.innerHTML = calHtml(CAL_SEL.k); return; }
    const cp = e.target.closest && e.target.closest('[data-copiar]');
    if (cp) { const ok = () => { cp.textContent = 'Copiado'; setTimeout(() => { cp.textContent = 'Copiar enlace'; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(cp.dataset.copiar).then(ok, () => window.prompt('Copia este enlace:', cp.dataset.copiar)); else window.prompt('Copia este enlace:', cp.dataset.copiar); }
  });
  const diaLargo = s => { const [y, m, d] = s.split('-').map(Number); return ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'][new Date(y, m - 1, d).getDay()] + ' ' + d + ' ' + MES[m - 1]; };
  const eqAge = m => { const e = A.equipos.find(x => x.id === m.eq); return e ? (e.cantera ? 'MP ' + tituloOf(e) : 'MP ' + e.id) : 'MP'; };
  function diaHtml(d) {
    const ms = d.nuestros.map(i => AGE.partidos[i]);
    return `<div class="an-dia"><div class="an-dia-cab"><span>${diaLargo(d.fecha)}</span>${d.mapa ? `<a href="${esc(d.mapa)}" target="_blank" rel="noopener">Cómo llegar →</a>` : ''}</div>
      <div class="an-pista">${esc(d.pista || '')}</div>
      ${ms.map(m => `<a class="an-par blk" href="${hEq(m.eq)}"><b>${esc(m.hora || 'Por fijar')}</b><span><span style="color:#FF6B63;font-weight:700">${esc(eqAge(m))}</span> ${m.casa ? 'contra' : 'en casa de'} ${esc(m.rival)}</span><span class="l">${esc(m.liga)}</span></a>`).join('')}
      ${d.otros.length ? `<div class="an-otros">Ese día en la misma pista también: ${d.otros.map(o => `${esc(o.hora || 'hora por fijar')} ${esc(o.local)} – ${esc(o.visitante)} <span>(${esc(o.liga)})</span>`).join(' · ')}</div>` : ''}</div>`;
  }
  function rellenarAgenda() {
    const el = view.querySelector('[data-agenda]'), eq = view.querySelector('[data-agenda-eq]'); if (!el && !eq) return;
    const pon = () => {
      if (!AGE) { if (el) el.remove(); if (eq) eq.remove(); return; }
      const hoy = hoyISO();
      if (el) {
        const casa = AGE.dias.filter(d => d.casa && d.fecha >= hoy).slice(0, 3);
        el.innerHTML = `<div class="an-grid dos" style="margin-top:12px">
          ${casa.length ? `<div class="card an-c">${lab('EN CASA · VEN A VERNOS')}<div class="an-nota" style="margin-top:2px">Los próximos días que jugamos en casa, con todos los partidos de ese día en la pista.</div>${casa.map(diaHtml).join('')}</div>` : ''}
          <div class="card an-c">${lab('LOS PARTIDOS, EN TU CALENDARIO')}<div class="an-nota" style="margin-top:2px">Elige qué partidos quieres y añádelos al calendario del móvil.</div><div data-cal-caja>${calHtml(CAL_SEL.k || 'club')}</div></div>
          ${el.dataset.agenda === 'cal' ? '' : `<div data-hitos class="card an-c">${hitosHtml()}</div>`}</div>`;
        if (!el.querySelector('[data-hitos] .an-fila')) { const hh = el.querySelector('[data-hitos]'); if (hh) hh.remove(); }
      }
      if (eq) {
        const e = A.equipos.find(x => x.id === eq.dataset.agendaEq);
        const prox = AGE.partidos.filter(m => m.eq === e.id && m.fecha && m.fecha >= hoy);
        const sig = prox[0], sigCasa = prox.find(m => m.casa);
        const linea = (t, m) => m ? `<div class="an-fila" style="align-items:flex-start"><span><span class="an-sub" style="display:block;margin:0">${t}</span>${esc(fd(m.fecha))} · ${esc(m.hora || 'hora por fijar')} · ${m.casa ? 'contra' : 'en casa de'} ${esc(m.rival)}<br><span style="color:#A6A6AD">${esc(m.pista || '')}</span></span>${m.mapa ? `<a href="${esc(m.mapa)}" target="_blank" rel="noopener" style="white-space:nowrap">Cómo llegar →</a>` : ''}</div>` : '';
        eq.innerHTML = `<div class="an-grid dos" style="margin-top:12px"><div class="card an-c">${linea('PRÓXIMO PARTIDO', sig)}${sigCasa && sigCasa !== sig ? linea('PRÓXIMO EN CASA', sigCasa) : ''}${!sig ? '<div class="an-nota">No quedan partidos en el calendario.</div>' : ''}</div>
          <div class="card an-c">${lab('SUS PARTIDOS, EN TU CALENDARIO')}<div data-cal-caja>${calHtml(e.id, true)}</div></div></div>`;
      }
    };
    if (AGE) pon(); else cargarAgenda().then(pon);
  }

  /* ── Calendario (#/calendario · rediseño, fase 3) ─────────────────────────────────────────────────────────────────────
     ¿Cuándo y dónde jugamos? Lista por fines de semana (los pasados, plegados con sus resultados) o mes; filtro por equipo y
     «solo en casa». Con los festivos, los cambios de hora oficiales y los cumpleaños (solo mayores de edad, sin la edad).
     «Añadir a mi calendario» es secundario: un panel con las suscripciones .ics (cal/*.ics, de agenda.py). */
  let FEST = null, festP = null;
  const cargarFest = () => festP || (festP = fetch('data/festivos.json?v=' + verDatos()).then(r => (r.ok ? r.json() : null)).then(d => (FEST = d || { dias: [], cambio_hora: [] })).catch(() => (FEST = { dias: [], cambio_hora: [] })));
  const CAL = { vista: 'lista', filtro: 'club', casa: false, add: false, ext: { c: true, f: true, h: true }, abiertos: {}, mes: null, dia: null, todo: false };
  try { const g = JSON.parse(localStorage.getItem('mp-cal') || '{}'); ['vista', 'filtro', 'casa', 'ext'].forEach(k => { if (g[k] != null) CAL[k] = g[k]; }); } catch (e) { /* sin almacenamiento */ }
  const guardaCal = () => { try { localStorage.setItem('mp-cal', JSON.stringify({ vista: CAL.vista, filtro: CAL.filtro, casa: CAL.casa, ext: CAL.ext })); } catch (e) { /* sin almacenamiento */ } };
  const FILTROS = [['club', 'Todos'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D'], ['AL', 'Alevín'], ['IN', 'Infantil']];
  const MES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  // el sábado del que cuelga cada día: de sábado a viernes, para que un festivo entre semana vaya con su fin de semana
  const sabadoDe = iso => { const d = new Date(dia0(iso)); d.setDate(d.getDate() - (d.getDay() + 1) % 7); return isoT(d.getTime()); };
  const masDias = (iso, n) => { const d = new Date(dia0(iso)); d.setDate(d.getDate() + n); return isoT(d.getTime()); };
  const pistaCal = p => (p || '').replace(/^(Polideportivo Municipal |Instalación Deportiva Municipal (Básica )?|Centro Deportivo Municipal |Parque Deportivo |Centro Deportivo )/, '');
  function partidosCal() {
    const vis = {}, out = [];
    (AGE ? AGE.partidos : []).forEach(p => {
      const k = p.fecha + '|' + p.local + '|' + p.visitante;
      if (vis[k]) { vis[k].eqs.push(p.eq); return; }
      const lid = (A.ligas.find(l => l.corto === p.liga) || {}).id, mp = Object.values(A.partidos).find(x => x.liga === lid && x.fecha === p.fecha && x.local === p.local && x.visitante === p.visitante);
      const o = Object.assign({}, p, { lid, eqs: [p.eq], pen: mp ? mp.pen : null, mid: mp ? mp.mid : null }); vis[k] = o; out.push(o);
    });
    return out.sort((a, b) => ((a.fecha || '9') + (a.hora || '99')).localeCompare((b.fecha || '9') + (b.hora || '99')));
  }
  // festivos, cambios de hora oficiales y cumpleaños (de los jugadores que siguen en el equipo del filtro)
  function eventosCal() {
    const out = [], y0 = A.temporada ? parseInt(A.temporada, 10) : new Date().getFullYear();
    (FEST ? FEST.dias : []).forEach(x => out.push({ fecha: x.fecha, tipo: 'fest', t: x.t, sub: x.ambito === 'local' ? 'Festivo local · ' + x.municipio : x.ambito === 'madrid' ? 'Festivo en la Comunidad de Madrid' : 'Festivo nacional' }));
    (FEST ? FEST.cambio_hora : []).forEach(x => out.push({ fecha: x.fecha, tipo: 'reloj', t: 'Cambio de hora', sub: x.t }));
    (AGE && AGE.cumples || []).forEach(x => { const j = A.jugadores[x.k]; if (!j || j.menor || !equiposDe(j).length) return;
      const eqs = equiposDe(j).map(e => e.id); if (CAL.filtro !== 'club' && !eqs.includes(CAL.filtro)) return;
      const [m] = x.dia.split('-').map(Number);
      out.push({ fecha: (m >= 8 ? y0 : y0 + 1) + '-' + x.dia, tipo: 'cumple', t: 'Cumple ' + corto(j), sub: equiposDe(j).map(e => 'MP ' + letraOf(e)).join(' · ') + (j.dorsal ? ' · #' + j.dorsal : ''), k: x.k }); });
    return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
  const ICO_EV = { fest: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>', cumple: '<path d="M4 21h16M5 21v-7h14v7M8 14v-3M12 14v-3M16 14v-3M8 8.5a1 1 0 0 0 0-2M12 8.5a1 1 0 0 0 0-2M16 8.5a1 1 0 0 0 0-2"/>', reloj: '<path d="M12 7v5l3 2M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z"/>' };
  const evFila = e => `<${e.k ? `a href="${hP(e.k)}"` : 'div'} class="cal-ev ${e.tipo}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICO_EV[e.tipo]}</svg><span><b>${esc(e.t)}</b><span>${esc(e.sub)}</span></span></${e.k ? 'a' : 'div'}>`;
  // una fila por partido, como la lista de Inicio (filaFinde): hora, liga y pista arriba; los dos equipos con su escudo y sus
  // siglas; % de ganar; a la derecha, lo que falta y «Previa», o el resultado. Los partidos de cada día, en una caja .ff-lista
  function calFila(p) {
    const hoy = hoyISO(), derbi = p.derbi && p.eqs.length > 1, jugado = p.gl != null, pend = !jugado && p.fecha && p.fecha < hoy;
    const x = { fecha: p.fecha, hora: p.hora || null, ts: p.fecha ? tsDe(p.fecha, p.hora || '23:59') : 0 }, ya = !jugado && !pend && p.hora && p.fecha === hoy && x.ts <= Date.now();
    const yaJugado = jugado || pend || (p.fecha && p.fecha < hoy);   // en un partido pasado no hay avisos de hora, fecha ni pista
    const chips = [];
    if (!yaJugado && p.fechaAnt) chips.push(`<span class="chip ambar fuerte">CAMBIO DE FECHA · ANTES ${esc(fd(p.fechaAnt))}</span>`);
    else if (!yaJugado && p.horaAnt) chips.push('<span class="chip ambar fuerte">CAMBIO DE HORA</span>');
    if (pend) chips.push('<span class="chip ambar">ACTA PENDIENTE</span>');
    else if (derbi && !jugado) chips.push('<span class="chip derbi">DERBI</span>');
    // marcador centrado: el local hacia el centro desde la izquierda, el visitante desde la derecha y en medio el % o el resultado
    const nom = n => `<span class="ff-n${ours(n) && !jugado ? ' mp' : ''}">${esc(p.lid ? etqEq(n, p.lid, true) : abr(n))}</span>`;
    const enCasa = p.casa && !jugado && !pend;
    const hora = p.horaAnt && !yaJugado ? `<s>${esc(p.horaAnt)}</s> <b class="cambio">${esc(p.hora || 'hora por fijar')}</b>` : esc(p.hora || 'hora por fijar');
    const donde = [esc(p.liga), p.pista ? esc(pistaCal(p.pista)) : ''].filter(Boolean).join(' · ');
    const P = derbi || jugado || pend || ya ? null : pronDe(p.lid, p.j, p.local, p.visitante);
    let centro, pie;
    if (jugado) {
      const usL = ours(p.local), nos = usL ? p.gl : p.gv, ell = usL ? p.gv : p.gl, ganaPen = p.pen ? ours(p.pen) : null;
      const r = derbi ? '' : nos > ell || (nos === ell && ganaPen) ? 'v' : 'd', b = '<span class="b-pen">B</span>';
      centro = `<span class="ff-res">${p.gl}${p.pen && p.pen === p.local ? b : ''}–${p.gv}${p.pen && p.pen === p.visitante ? b : ''}</span>${r ? `<span class="res-l ${r}">${r === 'v' ? 'VICTORIA' : 'DERROTA'}</span>` : ''}`;
      pie = '<span class="ff-l">Ver partido</span>';
    } else if (pend) { centro = '<span class="ff-res">—</span>'; pie = '<span class="ff-l">Sin resultado aún</span>'; }
    else if (ya) { centro = '<span class="ff-g">vs</span>'; pie = '<span class="ff-falta">Ha empezado</span><span class="ff-l">aún sin datos del acta</span>'; }
    else { const [a, b] = faltaTxt(x); centro = P ? `<span class="ff-pct">${P.g}%</span><span class="ff-l">ganar</span>` : '<span class="ff-g">vs</span>';
      pie = `<span class="ff-falta"${p.hora ? ` data-falta="${x.ts}"` : ''}>${a}</span><span class="ff-l">${b}</span><span class="ff-previa">PREVIA</span>`; }
    const href = p.lid ? hPar(p.lid, p.j, p.local, p.visitante) : null;
    return `<${href ? `a href="${href}"` : 'div'} class="ff cal-ff${jugado ? ' fin' : ''}">
      <div class="cf-cab"><span>${hora} · ${donde}</span>${chips.join('')}</div>
      <div class="cf-mid"><div class="cf-eq l">${enCasa && ours(p.local) ? casaMarca() : ''}${nom(p.local)}${escudo(p.local, 32)}</div>
        <div class="cf-c">${centro}</div><div class="cf-eq v">${escudo(p.visitante, 32)}${nom(p.visitante)}</div></div>
      <div class="cf-pie">${pie}</div></${href ? 'a' : 'div'}>`;
  }
  const calFilas = ps => (ps.length ? `<div class="ff-lista cal-ffl${ps.length > 1 ? ' dos' : ''}">${ps.map(calFila).join('')}</div>` : '');
  let CAL_PEDIDO = false;
  function vCalendario() {
    if (!AGE || !FEST || !PRON) {
      if (CAL_PEDIDO) return '<div class="cab-pag"><h1 class="h1">Calendario</h1></div><div class="aviso" style="margin-top:24px">El calendario no se ha podido cargar. Prueba a recargar la página.</div>';
      CAL_PEDIDO = true;
      Promise.all([cargarAgenda(), cargarFest(), cargarPron()]).then(() => { if (/^#\/calendario/.test(location.hash)) render(); });
      return `<div class="cab-pag"><h1 class="h1">Calendario</h1></div><div class="carga" role="status" aria-label="Cargando"><div class="sk" style="height:48px"></div><div class="sk" style="height:420px"></div></div>`;
    }
    return `<div class="cal" data-cal>${calHtml2()}</div>`;
  }
  function calHtml2() {
    const nomF = CAL.filtro === 'club' ? (CAL.casa ? 'los partidos en casa' : 'todo el club') : 'MADRIDPATINA ' + FILTROS.find(x => x[0] === CAL.filtro)[1].toUpperCase();
    const base = AGE.cal[CAL.casa && CAL.filtro === 'club' ? 'casa' : CAL.filtro], fl = ['c', 'f', 'h'].filter(k => CAL.ext[k]).join('');
    const ics = BASE_WEB() + (fl ? base.replace(/\.ics$/, '-' + fl + '.ics') : base), wc = ics.replace(/^https?:/, 'webcal:');
    const add = CAL.add ? `<div class="cal-add tarjeta"><div class="dest">Suscríbete a «${esc(nomF)}» y los partidos aparecerán en tu móvil.</div>
      <div class="cal-add-b"><a class="btn s" href="${esc('https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(wc))}" target="_blank" rel="noopener">Google Calendar</a><a class="btn s" href="${esc(wc)}">iPhone · Mac</a>
        <a class="btn s" href="${esc('https://outlook.live.com/calendar/0/addfromweb?url=' + encodeURIComponent(ics))}" target="_blank" rel="noopener">Outlook</a><button type="button" class="btn s" data-copiar="${esc(ics)}">Copiar enlace</button></div>
      <div class="cal-ext">${[['c', 'Cumpleaños'], ['f', 'Festivos'], ['h', 'Cambios de hora']].map(([k, l]) => `<label><input type="checkbox" data-cal-ext="${k}"${CAL.ext[k] ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <div class="pv-nota">Se actualiza solo: si la FMP cambia una hora o una pista, te llega el cambio.</div></div>` : '';
    const cab = `<div class="cab-pag cal-cab"><h1 class="h1">Calendario</h1><div class="cal-acc">
        <div class="seg" role="group" aria-label="Vista">${[['lista', 'Lista'], ['mes', 'Mes']].map(([k, l]) => `<button type="button" data-cal-vista="${k}" aria-pressed="${CAL.vista === k}">${l}</button>`).join('')}</div>
        <button type="button" class="btn s cal-add-btn" data-cal-add aria-expanded="${CAL.add}"><span aria-hidden="true">+</span><span>Añadir<span class="desk"> a mi calendario</span></span></button></div></div>
      <div class="cal-fil"><nav class="pests" aria-label="Equipo">${FILTROS.map(([k, l]) => `<button type="button" data-cal-filtro="${k}" aria-selected="${CAL.filtro === k}">${l}</button>`).join('')}</nav>
        <label class="interr"><input type="checkbox" data-cal-casa${CAL.casa ? ' checked' : ''}><span class="pista-i" aria-hidden="true"></span><span>Solo en casa</span></label></div>${add}`;
    return cab + `<div class="cal-cuerpo">${CAL.vista === 'mes' ? calMes() : calLista()}</div>`;
  }
  function calLista() {
    const hoy = hoyISO(), todos = partidosCal().filter(p => p.fecha && (CAL.filtro === 'club' || p.eqs.includes(CAL.filtro)) && (!CAL.casa || p.casa));
    const ev = eventosCal(), grupos = {};
    todos.forEach(p => { (grupos[sabadoDe(p.fecha)] = grupos[sabadoDe(p.fecha)] || { ps: [], ev: [] }).ps.push(p); });
    const f0 = todos.length ? todos[0].fecha : hoy, f1 = todos.length ? todos[todos.length - 1].fecha : hoy;
    ev.filter(e => e.fecha >= sabadoDe(f0) && e.fecha <= masDias(f1, 6)).forEach(e => { (grupos[sabadoDe(e.fecha)] = grupos[sabadoDe(e.fecha)] || { ps: [], ev: [] }).ev.push(e); });
    // los fines de semana sin partido también salen («sin partidos»), para que se vea el hueco
    for (let k = sabadoDe(f0); k <= sabadoDe(f1); k = masDias(k, 7)) if (!grupos[k]) grupos[k] = { ps: [], ev: [] };
    // pasado: el fin de semana ya acabó (por fecha, no por el filtro); el «próximo», el primero con un partido por jugar
    const keys = Object.keys(grupos).sort(), prox = keys.find(k => grupos[k].ps.some(p => p.gl == null && p.fecha >= hoy)) || keys[keys.length - 1];
    const yaPaso = k => masDias(k, 1) < hoy, i0 = keys.findIndex(k => !yaPaso(k)), iP = i0 < 0 ? keys.length : i0;
    const lun = new Date(dia0(hoy)); lun.setDate(lun.getDate() - (lun.getDay() + 6) % 7);
    const proxTit = prox && dia0(prox) - lun.getTime() < 7 * 864e5 ? 'Este fin de semana' : 'El próximo fin de semana';
    // de esta semana en adelante (lo ya jugado confunde): los seis fines de semana que vienen; el resto, con «Ver toda la temporada»
    const ver = CAL.todo ? keys : keys.slice(iP, iP + 6);
    const html = ver.map(k => {
      const g = grupos[k], pasado = yaPaso(k), abierto = CAL.abiertos[k] != null ? CAL.abiertos[k] : !pasado, nC = g.ps.filter(p => p.casa).length;
      const sub = (g.ps.length ? g.ps.length + (g.ps.length === 1 ? ' partido' : ' partidos') : 'Sin partidos') + (nC ? ' · ' + nC + ' en casa' : '');
      const resumen = pasado ? g.ps.filter(p => p.gl != null && !(p.derbi && p.eqs.length > 1)).map(p => { const usL = ours(p.local), n = usL ? p.gl : p.gv, o = usL ? p.gv : p.gl, r = n > o || (n === o && p.pen && ours(p.pen)) ? 'V' : 'D'; return `<span class="res-l ${r.toLowerCase()}" title="${esc('MP ' + p.eq + ' ' + n + '–' + o)}">${r}</span>`; }).join('') : '';
      const dias = [...new Set(g.ps.map(p => p.fecha).concat(g.ev.map(e => e.fecha)))].sort();
      const cuerpo = abierto ? dias.map(f => `<div class="cal-dia"><div class="etq">${esc(fd(f))}</div>${g.ev.filter(e => e.fecha === f).map(evFila).join('')}${calFilas(g.ps.filter(p => p.fecha === f))}</div>`).join('') : '';
      const tit = `<span class="cal-fin-t${k === prox ? ' prox' : pasado ? ' pasado' : ''}">${esc(fd(k))} – ${esc(fd(masDias(k, 1)))}</span><span class="cal-fin-s">${sub}</span>`;
      return `<section class="cal-fin">${k === prox ? `<div class="etq cal-este">${proxTit}</div>` : ''}
        ${pasado ? `<button type="button" class="cal-fin-c" data-cal-abre="${k}" aria-expanded="${abierto}">${tit}<span class="cal-fin-r">${resumen}</span><span class="cal-chev" aria-hidden="true">${abierto ? '▴' : '▾'}</span></button>` : `<div class="cal-fin-c">${tit}</div>`}
        ${cuerpo}</section>`;
    }).join('');
    return html + (CAL.todo || ver.length === keys.length ? '' : `<button type="button" class="btn s cal-todo" data-cal-todo>Ver toda la temporada</button>`)
      || '<div class="aviso">No hay partidos con este filtro.</div>';
  }
  function calMes() {
    const hoy = hoyISO(), todos = partidosCal().filter(p => p.fecha && (CAL.filtro === 'club' || p.eqs.includes(CAL.filtro)) && (!CAL.casa || p.casa));
    const meses = [...new Set(partidosCal().filter(p => p.fecha).map(p => p.fecha.slice(0, 7)))].sort();
    const mk = CAL.mes && meses.includes(CAL.mes) ? CAL.mes : meses.includes(hoy.slice(0, 7)) ? hoy.slice(0, 7) : meses.find(m => m > hoy.slice(0, 7)) || meses[meses.length - 1];
    const mi = meses.indexOf(mk), [yy, mm] = mk.split('-').map(Number), off = (new Date(yy, mm - 1, 1).getDay() + 6) % 7, dim = new Date(yy, mm, 0).getDate(), ev = eventosCal();
    const flecha = (i, dir) => i >= 0 && i < meses.length ? `<button type="button" class="sem-flecha" data-cal-mes="${meses[i]}" aria-label="Mes ${dir < 0 ? 'anterior' : 'siguiente'}">${FLECHA_SEM[dir < 0 ? 0 : 1]}</button>` : `<span class="sem-flecha off" aria-hidden="true">${FLECHA_SEM[dir < 0 ? 0 : 1]}</span>`;
    const celdas = [];
    for (let i = 0; i < 42; i++) {
      const dn = i - off + 1; if (dn > dim && i % 7 === 0) break;
      if (dn < 1 || dn > dim) { celdas.push('<div class="cal-c vacia"></div>'); continue; }
      const iso = mk + '-' + p2(dn), ps = todos.filter(p => p.fecha === iso), evd = ev.filter(e => e.fecha === iso), casa = ps.some(p => p.casa);
      const chips = ps.map(p => { const derbi = p.derbi && p.eqs.length > 1, eqT = derbi ? p.eqs.map(x => 'MP ' + x).join('·') : 'MP ' + p.eq;
        if (p.gl == null) return `<span class="cm por"><i></i><b>${esc(eqT)}</b> ${esc(p.hora || '')}</span>`;
        const usL = ours(p.local), n = usL ? p.gl : p.gv, o = usL ? p.gv : p.gl, r = derbi ? 'n' : n > o || (n === o && p.pen && ours(p.pen)) ? 'v' : 'd';
        const bL = p.pen && p.pen === p.local ? '<span class="b-pen">B</span>' : '', bV = p.pen && p.pen === p.visitante ? '<span class="b-pen">B</span>' : '';
        return `<span class="cm ${r}"><i></i><b>${esc(eqT)}</b> ${derbi || usL ? p.gl + bL + '–' + p.gv + bV : p.gv + bV + '–' + p.gl + bL}</span>`; }).join('');
      const marcas = evd.map(e => `<span class="cme ${e.tipo}"><i></i><b>${esc(e.tipo === 'fest' ? e.t : e.tipo === 'cumple' ? e.t.replace('Cumple ', '') : 'Cambio de hora')}</b></span>`).join('');
      celdas.push(`<button type="button" class="cal-c${ps.length ? ' con' : ''}${casa ? ' casa' : ''}${iso === hoy ? ' hoy' : ''}${CAL.dia === iso ? ' sel' : ''}${iso < hoy && !ps.length ? ' pasado' : ''}" data-cal-dia="${iso}"${ps.length || evd.length ? '' : ' tabindex="-1"'}><span class="cal-n">${dn}</span>${marcas}${chips}</button>`);
    }
    const dia = CAL.dia && CAL.dia.slice(0, 7) === mk ? CAL.dia : null;
    const panel = dia ? `<div class="cal-dia sel-dia"><div class="etq">${esc(fdLarga(dia))}</div>${ev.filter(e => e.fecha === dia).map(evFila).join('')}${calFilas(todos.filter(p => p.fecha === dia)) || (ev.some(e => e.fecha === dia) ? '' : '<div class="pv-nota">Ese día no jugamos.</div>')}</div>` : '';
    return `<div class="cal-mes-cab">${flecha(mi - 1, -1)}<h2 class="sem-h cal-mes-t">${esc(MES_L[mm - 1].toUpperCase())} ${yy}</h2>${flecha(mi + 1, 1)}</div>
      <div class="cal-dows">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="calm-grid">${celdas.join('')}</div>${panel}
      <div class="cal-ley"><span class="l-casa">Jugamos en casa</span><span class="l-por">Por jugar</span><span class="l-v">Victoria</span><span class="l-d">Derrota</span><span class="l-fest">Festivo</span><span class="l-cumple">Cumpleaños</span><span class="l-reloj">Cambio de hora</span></div>`;
  }
  function pintarCal() {
    const el = view.querySelector('[data-cal]'); if (!el) return;
    el.innerHTML = calHtml2();
    if (MOV) { const c = el.querySelector('.cal-cuerpo'); if (c) repetir(c, 'mpFade .18s ease-out'); }
    guardaCal();
  }
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-cal-vista],[data-cal-filtro],[data-cal-add],[data-cal-abre],[data-cal-mes],[data-cal-dia],[data-cal-todo]');
    if (!t || !view.contains(t)) return;
    if (t.dataset.calVista) { CAL.vista = t.dataset.calVista; CAL.dia = null; }
    else if (t.dataset.calFiltro) CAL.filtro = t.dataset.calFiltro;
    else if (t.hasAttribute('data-cal-add')) CAL.add = !CAL.add;
    else if (t.dataset.calAbre) { const k = t.dataset.calAbre; CAL.abiertos[k] = !(t.getAttribute('aria-expanded') === 'true'); }
    else if (t.dataset.calMes) { CAL.mes = t.dataset.calMes; CAL.dia = null; }
    else if (t.dataset.calDia) CAL.dia = CAL.dia === t.dataset.calDia ? null : t.dataset.calDia;
    else if (t.hasAttribute('data-cal-todo')) CAL.todo = true;
    pintarCal();
  });
  document.addEventListener('change', e => {
    const t = e.target; if (!view.contains(t)) return;
    if (t.matches('[data-cal-casa]')) { CAL.casa = t.checked; pintarCal(); }
    else if (t.matches('[data-cal-ext]')) { CAL.ext[t.dataset.calExt] = t.checked; pintarCal(); }
  });

  /* ── Hitos a la vista: a quién le falta poco para una cifra redonda con el club (histórico + esta temporada) ── */
  const UMBRAL = { g: [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500], a: [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500], pj: [25, 50, 100, 150, 200, 250, 300, 400, 500], par: [100, 250, 500, 750, 1000, 1500, 2000, 3000] };
  const UMBRAL_TXT = { g: ['gol', 'goles'], a: ['asistencia', 'asistencias'], pj: ['partido', 'partidos'], par: ['parada', 'paradas'] };
  const CERCA = { g: 3, a: 3, pj: 2, par: 40 };
  function totalesClub(p) {
    const hj = H && H.byTok[H.tok(p.nombre + ' ' + p.apellidos)], car0 = (hj && hj.carrera) || {}, ya = (p.temporadas || {})[A.temporada] || {};
    const parH = hj ? hj.temporadas.filter(t => t.rol === 'GOALIE' && t.tiros).reduce((s, t) => s + t.tiros - (t.gc || 0), 0) : 0;
    const parY = (p.partidos || []).filter(x => x.pct != null).reduce((s, x) => s + (x.par || 0), 0);
    return { g: (car0.g || 0) + (ya.goles || 0), a: (car0.a || 0) + (ya.asistencias || 0), pj: (car0.pj || 0) + (ya.pj || 0), par: parH + parY };
  }
  function hitosDe(p) {
    const tot = totalesClub(p), out = [];
    Object.keys(UMBRAL).forEach(k => { if (k === 'par' ? !p.portero : (k !== 'pj' && p.portero)) return;
      const u = UMBRAL[k].find(v => v > tot[k]); if (u && u - tot[k] <= CERCA[k] && tot[k] > 0) out.push({ k, u, falta: u - tot[k] }); });
    return out;
  }
  const hitoTxt = h => `A ${h.falta} ${UMBRAL_TXT[h.k][h.falta === 1 ? 0 : 1]} ${h.k === 'a' || h.k === 'par' ? 'de las' : 'de los'} ${h.u}`;
  function hitosHtml() {
    if (!H) return '';
    const xs = [];
    Object.values(A.jugadores).filter(p => equiposDe(p).length).forEach(p => hitosDe(p).forEach(h => xs.push({ p, h })));
    xs.sort((a, b) => a.h.falta / CERCA[a.h.k] - b.h.falta / CERCA[b.h.k] || b.h.u - a.h.u);
    if (!xs.length) return '';
    return `${lab('HITOS A LA VISTA')}<div class="an-nota" style="margin-top:2px">Jugadores a los que les falta poco para una cifra redonda con el club, contando todas sus temporadas.</div>
      ${xs.slice(0, 8).map(({ p, h }) => `<a class="an-fila blk" href="${hP(p.k)}"><span><b>${esc(corto(p))}</b> <span style="color:#A6A6AD">· ${esc(equiposDe(p).map(e => e.cantera ? tituloOf(e) : 'MP ' + e.id).join(' · '))}</span></span><span class="h">${esc(hitoTxt(h))}</span></a>`).join('')}`;
  }

  /* ── Ficha: partido a partido, tandas de penaltis y faltas ── */
  function svgTemporada(p) {
    const xs = (p.partidos || []).slice().sort((a, b) => ((A.partidos[a.mid] || {}).fecha || '') < ((A.partidos[b.mid] || {}).fecha || '') ? -1 : 1);
    if (xs.length < 2) return '';
    const gk = xs.every(x => x.pct != null);
    const W = Math.min(720, anchoGrafico(720)), H = 150, Lm = 4, Rm = 4, Tm = 18, Bm = 24, w = W - Lm - Rm, h = H - Tm - Bm, bw = Math.min(56, w / xs.length);
    const mx = gk ? 100 : Math.max(2, ...xs.map(x => (x.g || 0) + (x.a || 0)));
    const bars = xs.map((x, i) => { const cx = Lm + i * bw + bw / 2, ww = Math.max(6, bw - 10);
      if (gk) { const hh = (x.pct || 0) / mx * h; return `<g><title>vs ${esc(x.rival)}: ${dec(x.pct)} % de paradas</title><rect x="${cx - ww / 2}" y="${Tm + h - hh}" width="${ww}" height="${hh}" rx="3" fill="${RED}"/><text x="${cx}" y="${Tm + h - hh - 4}" text-anchor="middle" fill="#F4F4F5">${Math.round(x.pct)}</text><text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(abr(x.rival).split(' ')[0])}</text></g>`; }
      const hg = (x.g || 0) / mx * h, ha = (x.a || 0) / mx * h;
      return `<g><title>vs ${esc(x.rival)}: ${x.g || 0} G, ${x.a || 0} A</title>${hg ? `<rect x="${cx - ww / 2}" y="${Tm + h - hg}" width="${ww}" height="${hg}" rx="2" fill="${RED}"/>` : ''}${ha ? `<rect x="${cx - ww / 2}" y="${Tm + h - hg - ha - (hg ? 2 : 0)}" width="${ww}" height="${ha}" rx="2" fill="#8A8A8F"/>` : ''}
        ${(x.g || 0) + (x.a || 0) ? `<text x="${cx}" y="${Tm + h - hg - ha - (hg && ha ? 2 : 0) - 4}" text-anchor="middle" fill="#F4F4F5">${(x.g || 0) + (x.a || 0)}</text>` : `<text x="${cx}" y="${Tm + h - 4}" text-anchor="middle" fill="#55555B">0</text>`}<text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(abr(x.rival).split(' ')[0])}</text></g>`; }).join('');
    return `<div class="card an-c" style="margin-bottom:10px">${lab('PARTIDO A PARTIDO')}<div class="an-ley">${gk ? '<span>% de paradas en cada partido</span>' : `<span><span style="color:${RED}">■</span> goles</span><span><span style="color:#8A8A8F">■</span> asistencias</span>`}</div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${gk ? 'Porcentaje de paradas' : 'Goles y asistencias'} en cada partido de la temporada" style="display:block;max-width:${W}px;font-size:12px;fill:#8A8A8F;font-family:'IBM Plex Sans Condensed',sans-serif"><line x1="${Lm}" x2="${Lm + w}" y1="${Tm + h}" y2="${Tm + h}" stroke="#3A3A40"/>${bars}</svg></div>`;
  }
  function rellenarFicha() {
    const el = view.querySelector('[data-ficha-extra]'); if (!el) return;
    const pon = () => { const j = ANA && ANA.jugadores[el.dataset.fichaExtra]; if (!j) { el.remove(); return; }
      const filas = [];
      if (j.tandas) { const c = j.tandas.club, t = j.tandas.temp;
        filas.push(`<div class="an-fila" style="align-items:flex-start"><span><span class="an-sub" style="display:block;margin:0">TANDAS DE PENALTIS CON EL CLUB</span>${c[0]} ${c[0] === 1 ? 'lanzamiento' : 'lanzamientos'} · ${c[1]} ${c[1] === 1 ? 'gol' : 'goles'}${t[0] ? ` · esta temporada, ${t[1]} de ${t[0]}` : ''}</span><b>${pct(c[1] / c[0])}</b></div>`); }
      if (j.faltas) { const lista = xs => xs.slice(0, 4).map(([k, n]) => `${esc(k.toLowerCase())} (${n})`).join(', ');
        filas.push(`<div class="an-fila" style="align-items:flex-start"><span><span class="an-sub" style="display:block;margin:0">LAS FALTAS QUE MÁS LE PITAN</span>En el club: ${lista(j.faltas.club)}${j.faltas.temp ? `<br><span style="color:#A6A6AD">Esta temporada: ${lista(j.faltas.temp)}</span>` : ''}</span></div>`); }
      el.innerHTML = `${lab('PENALTIS Y FALTAS', 'margin-bottom:2px')}${filas.join('')}`; };
    if (ANA) pon(); else cargarAnalisis().then(pon);
  }

  /* ── Liga: la clasificación jornada a jornada y dónde puede acabar cada equipo ── */
  document.addEventListener('click', e => { const g = e.target.closest && e.target.closest('.ev-e'); if (!g) return; const svg = g.closest('svg'), on = !g.classList.contains('sel');
    svg.querySelectorAll('.ev-e').forEach(x => x.classList.toggle('sel', on && x === g)); svg.classList.toggle('foco', on); });


  /* ── Legado: de un equipo del club a otro, temporada a temporada (flujo de analisis.json) ── */
  const FLU = { todo: false, vista: null };
  const FLU_ORDEN = ['A', 'B', 'C', 'D', 'E', 'Cantera'];
  const FLU_TXT = e => (e === 'Cantera' ? 'Cantera' : 'MP ' + e);
  function svgFlujo() {
    const F = ANA && ANA.flujo; if (!F || F.temporadas.length < 2) return '';
    const n0 = FLU.todo ? 0 : Math.max(0, F.temporadas.length - 6), temps = F.temporadas.slice(n0), nodos = F.nodos.slice(n0);
    const enl = F.enlaces.filter(x => x.i >= n0).map(x => Object.assign({}, x, { i: x.i - n0 }));
    const maxTot = Math.max(...nodos.map(c => Object.values(c).reduce((a, b) => a + b, 0)));
    const colW = 116, W = Math.max(anchoGrafico(1100), temps.length * colW + 100), H = 470, Tm = 34, Bm = 28, nodoW = 16, gap = 10;
    const u = (H - Tm - Bm - gap * 5) / maxTot, sx = i => 72 + i * (W - 130) / Math.max(1, temps.length - 1);
    const pos = nodos.map((c, i) => { let y = Tm; const o = {}; FLU_ORDEN.filter(e => c[e]).forEach(e => { o[e] = { y, h: c[e] * u, sal: y, ent: y }; y += c[e] * u + gap; }); return o; });
    const ultima = temps.length - 1;
    // bandas dentro del club; quien llega o se va, como cifras junto a cada bloque
    const bandas = [], llegan = {}, salen = {};
    enl.forEach(x => {
      if (FLU_ORDEN.includes(x.de) && FLU_ORDEN.includes(x.a)) bandas.push(x);
      else if (x.a !== 'fuera') { const k = x.i + 1 + '|' + x.a; llegan[k] = (llegan[k] || 0) + x.n; }
      else { const k = x.i + '|' + x.de; salen[k] = (salen[k] || 0) + x.n; }
    });
    bandas.sort((a, b) => a.i - b.i || FLU_ORDEN.indexOf(a.de) - FLU_ORDEN.indexOf(b.de) || FLU_ORDEN.indexOf(a.a) - FLU_ORDEN.indexOf(b.a));
    FLU.vista = { temps, bandas, nombres: F.nombres, enl, n0 };
    const paths = bandas.map((x, j) => { const A_ = pos[x.i][x.de], B_ = pos[x.i + 1][x.a]; if (!A_ || !B_) return ''; const h = x.n * u;
      const x0 = sx(x.i) + nodoW / 2, x1 = sx(x.i + 1) - nodoW / 2, y0 = A_.sal, y1 = B_.ent; A_.sal += h; B_.ent += h; const xm = (x0 + x1) / 2;
      const igual = x.de === x.a, col = igual ? '#3A3A40' : FLU_ORDEN.indexOf(x.a) < FLU_ORDEN.indexOf(x.de) ? '#1A7A43' : '#8E1219';
      return `<path class="fl-b" data-j="${j}" tabindex="0" d="M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + h} C${xm},${y1 + h} ${xm},${y0 + h} ${x0},${y0 + h} Z" fill="${col}" fill-opacity="${igual ? 0.55 : 0.75}"><title>${x.n} de ${FLU_TXT(x.de)} a ${FLU_TXT(x.a)}</title></path>`; }).join('');
    const bloques = pos.map((o, i) => Object.entries(o).map(([e, b]) => { const x = sx(i) - nodoW / 2, ll = llegan[i + '|' + e], sa = salen[i + '|' + e];
      return `<g class="fl-n" data-i="${i}" data-e="${esc(e)}" tabindex="0"><rect x="${x}" y="${b.y}" width="${nodoW}" height="${Math.max(2, b.h)}" rx="3" fill="${e === 'A' ? RED : '#C9C9CE'}"/>
        ${b.h >= 14 ? `<text x="${x - 5}" y="${b.y + b.h / 2 + 4}" text-anchor="end" fill="#F4F4F5" font-weight="700">${esc(e === 'Cantera' ? 'Cant.' : e)} ${nodos[i][e]}</text>` : ''}
        ${ll ? `<text x="${x + nodoW + 4}" y="${b.y + 11}" fill="#3DD27E" font-size="11">+${ll}</text>` : ''}${sa && i < ultima ? `<text x="${x + nodoW + 4}" y="${b.y + b.h - 2}" fill="#FF6B63" font-size="11">−${sa}</text>` : ''}</g>`; }).join('')).join('');
    const cab = temps.map((t, i) => `<text x="${sx(i)}" y="18" text-anchor="middle" fill="#A6A6AD" font-weight="700">${esc(t)}</text>`).join('');
    return `<div class="an-tabla" style="margin-top:6px"><svg class="fl" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Paso de jugadores entre los equipos del club, temporada a temporada" style="display:block;font-size:12px;font-family:'IBM Plex Sans Condensed',sans-serif">${cab}${paths}${bloques}</svg></div>`;
  }
  function infoFlujo(el) {
    const V = FLU.vista, box = view.querySelector('[data-info="flujo"]'); if (!V || !box) return;
    const nom = k => { const x = V.nombres[k]; if (!x) return esc(k); const t = corto({ nombre: x[0], apellidos: x[1] }); return A.jugadores[k] ? `<a href="${hP(k)}">${esc(t)}</a>` : esc(t); };
    view.querySelectorAll('.fl-b.sel, .fl-n.sel').forEach(x => x.classList.remove('sel')); el.classList.add('sel');
    if (el.classList.contains('fl-b')) { const x = V.bandas[+el.dataset.j];
      box.innerHTML = `<b style="color:#F4F4F5">${x.n} de ${FLU_TXT(x.de)} (${V.temps[x.i]}) a ${FLU_TXT(x.a)} (${V.temps[x.i + 1]})</b><br>${x.k.map(nom).join(', ')}`; return; }
    const i = +el.dataset.i, e = el.dataset.e, ult = i === V.temps.length - 1;
    const de = V.enl.filter(x => x.i === i - 1 && x.a === e && !FLU_ORDEN.includes(x.de)), va = V.enl.filter(x => x.i === i && x.de === e && x.a === 'fuera');
    const lin = (t, xs) => xs.length ? `<br>${t}: ${xs.flatMap(x => x.k).map(nom).join(', ')}` : '';
    box.innerHTML = `<b style="color:#F4F4F5">${FLU_TXT(e)} en ${V.temps[i]}</b>${lin('Llegan nuevos', de.filter(x => x.de === 'nuevo'))}${lin('Vuelven', de.filter(x => x.de === 'vuelve'))}${lin(ult ? '' : 'No siguen la temporada siguiente', ult ? [] : va)}`;
  }
  document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('.fl-b, .fl-n'); if (el) infoFlujo(el);
    const t = e.target.closest && e.target.closest('[data-flujo-todo]'); if (t) { FLU.todo = t.dataset.flujoTodo === '1'; rellenarFlujo(); } });
  function rellenarFlujo() {
    const el = view.querySelector('[data-flujo]'); if (!el) return;
    const pon = () => { const g = svgFlujo(); if (!g) { el.remove(); return; }
      const F = ANA.flujo, ult = F.temporadas[F.temporadas.length - 1];
      el.innerHTML = `<section class="leg-sec flu"><div class="flu-c"><div><h2 class="h2">De un equipo a otro</h2><p class="pre-p">Cada bloque es un equipo en una temporada; las bandas, los jugadores que pasan de uno a otro. Toca una banda o un bloque para ver los nombres.</p></div>
        <div class="flu-togs"><button type="button" class="flu-tog" data-flujo-todo="0" aria-pressed="${!FLU.todo}">Últimas 6</button><button type="button" class="flu-tog" data-flujo-todo="1" aria-pressed="${FLU.todo}">Desde ${esc(F.temporadas[0])}</button></div></div>
        <div class="cal-ley"><span class="l-sub">Suben</span><span class="l-baj">Bajan</span><span class="l-sig">Siguen</span><span class="l-mas">+ llegan</span><span class="l-menos">− no siguen</span></div>
        <div class="flu-g">${g}</div><div class="flu-info" data-info="flujo" aria-live="polite"><b>Toca una banda o un bloque</b><span>${esc(ult)} va en curso: quien aún no ha jugado cuenta como que no sigue.</span></div></section>`; };
    if (ANA) pon(); else cargarAnalisis().then(pon);
  }

  /* ── Ficha: sus goles en vídeo, comparar con otro jugador y tarjeta para compartir ── */
  function golesVideo(p) {
    if (!VID) return '';
    const yo = (p.partidos || []).flatMap(x => { const m = A.partidos[x.mid], v = m && m.idp && VID[m.idp]; if (!v || !x.g) return [];
      const enL = [m.alin_l, m.gol_l].some(l => (l || []).some(y => y.k === p.k)), lado = enL ? 'L' : 'V';
      const fila = ((enL ? m.alin_l : m.alin_v) || []).concat((enL ? m.gol_l : m.gol_v) || []).find(y => y.k === p.k), dors = String((fila && fila.dorsal) || p.dorsal || '');   // el dorsal de ese partido (las camisetas se prestan)
      return Object.entries(v.ev || {}).filter(([, e]) => e.tipo === 'GOL' && e.lado === lado && (e.q || '').startsWith('#' + dors + ' '))
        .map(([id, e]) => ({ idp: m.idp, s: e.s, t: e.t, p: e.p, m: e.m, rival: lado === 'L' ? m.visitante : m.local, fecha: m.fecha })); });
    // en pista en los goles con el vídeo marcado: a favor y en contra
    let mas = 0, menos = 0, pjV = 0; const mios = [];
    (p.partidos || []).forEach(x => { const m = A.partidos[x.mid], v = (m && m.idp && VID[m.idp]) || { ev: {} }; if (!m || !m.idp) return;
      const enL = [m.alin_l, m.por_l, m.gol_l].some(l => (l || []).some(y => y.k === p.k)), lado = enL ? 'L' : 'V';
      const fila = ((enL ? m.alin_l : m.alin_v) || []).concat((enL ? m.por_l : m.por_v) || []).find(y => y.k === p.k), dors = String((fila && fila.dorsal) || p.dorsal || '');
      const gs = (m.ev || []).filter(e => e.tipo === 'gol' && e.jugador && /^P[12]$/.test(e.periodo)).map(e => ({ lado: e.lado === 'local' ? 'L' : 'V', pista: pistaGol(m.idp, `${e.periodo[1]}-${e.minuto}-GOL-${e.jugador.dorsal}`) }))
        .filter(e => e.pista && (e.pista[lado] || []).length); if (gs.length) pjV++;
      gs.forEach(e => { if (e.pista[lado].includes(dors)) { if (e.lado === lado) mas++; else menos++; } });
      Object.values(v.ev || {}).forEach(e => { if (e.tipo === 'GOL' && e.xy && e.lado === lado && (e.q || '').startsWith('#' + dors + ' ')) mios.push(e); }); });
    const pm = pjV ? `<div style="margin-top:12px">${lab('EN PISTA EN LOS GOLES', 'margin-bottom:2px')}<div class="an-nota" style="margin-top:0">En ${pjV === 1 ? 'el partido' : 'los ' + pjV + ' partidos'} en los que se apuntó quién estaba en pista (en el vídeo o desde el banquillo): goles de su equipo y en contra mientras jugaba.</div>
      <div class="an-ks" style="max-width:480px;grid-template-columns:repeat(3,minmax(0,1fr))">${anK('A favor', '+' + mas, '', '#3DD27E')}${anK('En contra', '−' + menos, '', menos ? '#FF6B63' : '')}${anK('Balance', (mas - menos > 0 ? '+' : '') + (mas - menos))}</div></div>` : '';
    const ds = mios.map(e => distM(e.xy)), mapa = mios.length ? `<div style="margin-top:12px">${lab('DESDE DÓNDE MARCA', 'margin-bottom:2px')}<div class="an-nota" style="margin:0 0 6px">${mios.length} ${mios.length === 1 ? 'gol marcado' : 'goles marcados'} en vídeo · a unos ${Math.round(ds.reduce((a, b) => a + b, 0) / ds.length)} m de media · el más lejano, a ${Math.max(...ds)} m</div><div style="width:min(100%,260px)">${mediaPista(mios.map(e => `<circle cx="${e.xy[0] * PISTA_W}" cy="${e.xy[1] * PISTA_H}" r="9" fill="#D3202A" stroke="#FFFFFF" stroke-width="2"/>`).join(''), 'width="100%" role="img" aria-label="Media pista con el sitio de sus goles marcados en vídeo"')}</div></div>` : '';
    // sus tiros, en los partidos con todos los tiros marcados en el vídeo
    let tir = 0, puerta = 0, gol = 0, pjT = 0; const misTiros = [];
    (p.partidos || []).forEach(x => { const m = A.partidos[x.mid], v = m && m.idp && VID[m.idp]; if (!v || !v.tiros || !v.tiros.length) return;
      const enL = [m.alin_l, m.por_l, m.gol_l].some(l => (l || []).some(y => y.k === p.k)), lado = enL ? 'L' : 'V';
      const fila = ((enL ? m.alin_l : m.alin_v) || []).concat((enL ? m.gol_l : m.gol_v) || []).find(y => y.k === p.k), dors = String((fila && fila.dorsal) || p.dorsal || '');
      pjT++;
      v.tiros.filter(t => t.lado === lado && String(t.dorsal) === dors).forEach(t => { tir++; if (t.r === 'parada') puerta++; misTiros.push(t); });
      Object.values(v.ev || {}).filter(e => e.tipo === 'GOL' && e.lado === lado && (e.q || '').startsWith('#' + dors + ' ')).forEach(e => { tir++; puerta++; gol++; if (e.xy) misTiros.push(Object.assign({ r: 'gol' }, e)); }); });
    const tirosHtml = pjT ? `<div style="margin-top:12px">${lab('SUS TIROS', 'margin-bottom:2px')}<div class="an-nota" style="margin:0 0 6px">En ${pjT === 1 ? 'el partido' : 'los ' + pjT + ' partidos'} con todos los tiros marcados en el vídeo.</div>
      <div class="an-ks" style="max-width:520px;grid-template-columns:repeat(4,minmax(0,1fr))">${anK('Tiros', tir)}${anK('A puerta', puerta)}${anK('Goles', gol, '', '#FF6B63')}${anK('Acierto', puerta ? pct(gol / puerta) : '—', 'goles entre tiros a puerta')}</div>
      ${misTiros.some(t => t.xy) ? `<div style="width:min(100%,260px);margin-top:8px">${mediaPista(misTiros.filter(t => t.xy).map(t => t.r === 'gol' ? `<circle cx="${t.xy[0] * PISTA_W}" cy="${t.xy[1] * PISTA_H}" r="9" fill="#D3202A" stroke="#FFFFFF" stroke-width="2"/>` : t.r === 'parada' ? `<circle cx="${t.xy[0] * PISTA_W}" cy="${t.xy[1] * PISTA_H}" r="7" fill="none" stroke="#D3202A" stroke-width="2.5"/>` : `<g stroke="#8A8A8F" stroke-width="2.5"><line x1="${t.xy[0] * PISTA_W - 5}" y1="${t.xy[1] * PISTA_H - 5}" x2="${t.xy[0] * PISTA_W + 5}" y2="${t.xy[1] * PISTA_H + 5}"/><line x1="${t.xy[0] * PISTA_W + 5}" y1="${t.xy[1] * PISTA_H - 5}" x2="${t.xy[0] * PISTA_W - 5}" y2="${t.xy[1] * PISTA_H + 5}"/></g>`).join(''), 'width="100%" role="img" aria-label="Sus tiros marcados en el vídeo"')}</div><div class="an-nota">● gol · ○ parada · ✕ fuera o bloqueado</div>` : ''}</div>` : '';
    if (!yo.length) return pm + tirosHtml;
    return `${lab('SUS GOLES EN VÍDEO', 'margin-bottom:6px')}<div style="display:flex;gap:8px;flex-wrap:wrap">${yo.map(g => `<a class="dv-alin" href="#/video/${encodeURIComponent(g.idp)}/${Math.max(0, Math.round(g.s - ANTES_JUGADA))}">▶ ${esc(g.m ? g.m.replace('-', '–') : 'Gol')} · ${g.p}ª parte ${esc(g.t)} · vs ${esc(abr(g.rival))}</a>`).join('')}</div>${mapa}${tirosHtml}${pm}`;
  }
  const CMP = {};
  function compararHtml(k, otro) {
    const yo = entradaMapa(k), el = otro && entradasMapa(otro)[0];
    if (!yo) return '';
    const cant = !!MAPA.ligas[yo.liga].cantera, todos = [];   // senior con senior y cantera con cantera
    Object.entries(MAPA.ligas).filter(([, L]) => !!L.cantera === cant).forEach(([id, L]) => L.jug.forEach(r => { if (r.k !== k && r.y != null) todos.push({ k: r.k, t: `${corto({ nombre: r.n, apellidos: r.a })} · ${mpCortoN(r.eq, id)} · ${L.nombre.replace('Liga ', '')}` }); }));
    todos.sort((a, b) => a.t.localeCompare(b.t, 'es'));
    const opts = `<option value="">Elige un jugador…</option>` + todos.map(x => `<option value="${esc(x.k)}"${x.k === otro ? ' selected' : ''}>${esc(x.t)}</option>`).join('');
    const ligaN = r => (MAPA.ligas[r.liga] || {}).nombre || '';
    let tabla = '';
    if (el) {
      const fila = (t, f, mejor) => { const a = f(yo), b = f(el); return `<div class="an-cmp"><b class="${mejor && a.n != null && b.n != null && mejor(a.n, b.n) ? 'gana' : ''}">${a.t}</b><span>${t}</span><b class="${mejor && a.n != null && b.n != null && mejor(b.n, a.n) ? 'gana' : ''}">${b.t}</b></div>`; };
      const nn = (v, d = 2) => ({ n: v, t: v == null ? '—' : dec((+v).toFixed(d)) }), mas = (x, y) => x > y + 1e-9;
      const nomR = r => corto({ nombre: r.n, apellidos: r.a });
      tabla = `<div class="an-cmp cab"><b>${esc(nomR(yo))}</b><span></span><b>${esc(nomR(el))}</b></div>
        <div class="an-cmp"><b style="font-size:14px">${esc(mpCortoN(yo.eq, yo.liga))}<br><span style="color:#A6A6AD;font-weight:600">${esc(ligaN(yo).replace('Liga ', ''))}</span></b><span>Equipo</span><b style="font-size:14px">${esc(mpCortoN(el.eq, el.liga))}<br><span style="color:#A6A6AD;font-weight:600">${esc(ligaN(el).replace('Liga ', ''))}</span></b></div>
        ${fila('Partidos que cuentan', r => ({ n: null, t: r.pj + (r.antes ? '*' : '') }))}
        ${fila('Goles por partido', r => nn(r.gl), mas)}${fila('Asistencias por partido', r => nn(r.al), mas)}
        ${fila('Puntos por partido, en su liga', r => nn(r.x), mas)}
        ${!MAPA.ligas[yo.liga].cantera && !MAPA.ligas[el.liga].cantera ? fila('Puntos por partido, escala de Senior 1', r => nn(r.xf), mas) : ''}
        ${fila('% de los goles de su equipo en los que participa', r => ({ n: r.pp, t: r.pp != null ? r.pp + ' %' : '—' }), mas)}
        ${fila('Parte de sus puntos que son goles', r => ({ n: null, t: r.y != null ? r.y + ' %' : '—' }))}
        ${fila('Arquetipo', r => ({ n: null, t: r.arq && ARQ[r.arq] ? `<span style="font-size:14px">${esc(ARQ[r.arq][0])}</span>` : '—' }))}
        <div class="an-nota">${yo.antes || el.antes ? '* Con la temporada pasada, porque esta lleva menos de 6 partidos. ' : ''}En verde, quién sale mejor. ${cant ? 'En la cantera no hay escala común entre ligas: los números van tal cual.' : 'Entre ligas senior distintas, la fila que vale es la de la escala de Senior 1 (FMPe).'}</div>`;
    }
    return `${lab('COMPARAR CON OTRO JUGADOR', 'margin-bottom:6px')}<label class="sr-only" for="cmp-sel">Jugador con el que comparar</label><select id="cmp-sel" class="an-sel" data-cmp="${esc(k)}">${opts}</select>${tabla}`;
  }
  document.addEventListener('change', e => { const s = e.target.closest && e.target.closest('[data-cmp]'); if (!s) return; CMP[s.dataset.cmp] = s.value;
    const box = view.querySelector('[data-comparar]'); if (box) box.innerHTML = compararHtml(s.dataset.cmp, s.value); const s2 = view.querySelector('#cmp-sel'); if (s2) s2.focus(); });
  function rellenarComparar() {
    const el = view.querySelector('[data-comparar]'); if (!el) return;
    const pon = () => { const h = MAPA ? compararHtml(el.dataset.comparar, CMP[el.dataset.comparar]) : ''; if (h) el.innerHTML = h; else el.remove(); };
    if (MAPA) pon(); else cargarMapa().then(pon);
  }
  function rellenarVideoFicha() {
    const el = view.querySelector('[data-goles-video]'); if (!el) return;
    const pon = () => { const p = A.jugadores[el.dataset.golesVideo], h = p ? golesVideo(p) : ''; if (h) el.innerHTML = h; else el.remove(); };
    Promise.all([VID ? VID : cargarVideos(), PIS ? PIS : cargarPistas()]).then(pon);
  }

  /* Tarjeta para compartir (imagen de 1080 × 1350): la ficha de un jugador o el resultado de un partido. Se dibuja en el
     navegador y se comparte con el menú del móvil o se descarga. A los menores, sin foto (como en toda la web). */
  const cargaImg = src => new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  async function fuentesListas() { try { await Promise.all(["900 100px 'Big Shoulders Display'", "800 100px 'Big Shoulders Display'", "600 40px 'IBM Plex Sans Condensed'", "700 40px 'IBM Plex Sans Condensed'"].map(f => document.fonts.load(f))); } catch (e) { /* con la de sistema */ } }
  function ajusta(ctx, t, max, px, peso, fam = 'Big Shoulders Display') { let s = px; do { ctx.font = `${peso} ${s}px '${fam}'`; s -= 4; } while (ctx.measureText(t).width > max && s > 20); return s + 4; }
  function cubre(ctx, im, x, y, w, h, fy = 0.18) { const r = Math.max(w / im.width, h / im.height), iw = im.width * r, ih = im.height * r; ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) * fy, iw, ih); }
  function pieTarjeta(ctx, esc_) {
    ctx.fillStyle = '#18181B'; ctx.fillRect(0, 1250, 1080, 100);
    if (esc_) { ctx.save(); ctx.beginPath(); ctx.arc(110, 1300, 34, 0, 7); ctx.clip(); ctx.drawImage(esc_, 76, 1266, 68, 68); ctx.restore(); }
    ctx.fillStyle = '#F4F4F5'; ctx.font = "900 40px 'Big Shoulders Display'"; ctx.fillText('MADRIDPATINA', 164, 1300);
    ctx.fillStyle = '#A6A6AD'; ctx.font = "600 26px 'IBM Plex Sans Condensed'"; ctx.fillText('Temporada ' + A.temporada + ' · arsel1994.github.io/madridpatina-web', 164, 1334);
  }
  async function tarjetaJugador(k) {
    const p = A.jugadores[k]; if (!p) return null;
    await fuentesListas();
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d');
    const [foto, escMP] = await Promise.all([cargaImg(p.foto), cargaImg('escudos/badge/madridpatina.webp')]);
    x.fillStyle = '#0D0D0E'; x.fillRect(0, 0, 1080, 1350);
    const g = x.createLinearGradient(0, 0, 1080, 720); g.addColorStop(0, '#D3202A'); g.addColorStop(1, '#8E1219'); x.fillStyle = g; x.fillRect(0, 0, 1080, 720);
    if (foto) { x.save(); x.beginPath(); x.rect(0, 0, 1080, 720); x.clip(); cubre(x, foto, 380, 0, 700, 720); x.restore(); }
    else { x.fillStyle = 'rgba(0,0,0,.18)'; x.font = "900 520px 'Big Shoulders Display'"; x.textAlign = 'right'; x.fillText(ini(p.nombre, p.apellidos), 1040, 640); x.textAlign = 'left'; }
    const sombra = x.createLinearGradient(0, 420, 0, 720); sombra.addColorStop(0, 'rgba(0,0,0,0)'); sombra.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = sombra; x.fillRect(0, 420, 1080, 300);
    x.fillStyle = '#FFFFFF'; x.font = "900 300px 'Big Shoulders Display'"; x.fillText(p.dorsal || '', 56, 690);
    const eq = equiposDe(p), t = (p.temporadas || {})[A.temporada] || {};
    x.fillStyle = '#FF6B63'; x.font = "700 34px 'IBM Plex Sans Condensed'"; x.fillText(((eq.length ? eq.map(e => e.cantera ? 'MP ' + tituloOf(e) : e.nombre).join(' · ') : p.equipo || '') + (eq[0] ? ' · ' + eq[0].liga : '')).toUpperCase(), 56, 790);
    x.fillStyle = '#F4F4F5'; ajusta(x, p.nombre.toUpperCase(), 968, 130, 900); x.fillText(p.nombre.toUpperCase(), 56, 910);
    x.fillStyle = '#A6A6AD'; ajusta(x, p.apellidos.toUpperCase(), 968, 66, 700); x.fillText(p.apellidos.toUpperCase(), 56, 984);
    const gk = (p.partidos || []).length && (p.partidos || []).every(z => z.pct != null);
    const tir = gk ? p.partidos.reduce((a, z) => a + (z.tiros || 0), 0) : 0, par = gk ? p.partidos.reduce((a, z) => a + (z.par || 0), 0) : 0;
    const tiles = gk ? [['PJ', t.pj || 0], ['% PARADAS', tir ? dec((par / tir * 100).toFixed(1)) : '—'], ['PARADAS', par]] : [['PJ', t.pj || 0], ['GOLES', t.goles || 0], ['ASIST.', t.asistencias || 0], ['PUNTOS', (t.goles || 0) + (t.asistencias || 0)]];
    const tw = (968 - (tiles.length - 1) * 16) / tiles.length;
    tiles.forEach(([k2, v], i) => { const xx = 56 + i * (tw + 16); x.fillStyle = '#18181B'; x.fillRect(xx, 1030, tw, 170); x.fillStyle = '#A6A6AD'; x.font = "700 26px 'IBM Plex Sans Condensed'"; x.fillText(k2, xx + 22, 1074);
      x.fillStyle = i === 1 ? '#FF6B63' : '#F4F4F5'; x.font = "900 96px 'Big Shoulders Display'"; x.fillText(String(v), xx + 20, 1172); });
    x.fillStyle = '#6B6B70'; x.font = "600 24px 'IBM Plex Sans Condensed'"; x.fillText('Temporada ' + A.temporada + (t.pj ? '' : ' · aún sin jugar'), 56, 1232);
    pieTarjeta(x, escMP);
    return { canvas: c, nombre: 'madridpatina-' + k + '.png', texto: corto(p) + ' · MADRIDPATINA ' + A.temporada };
  }
  async function tarjetaPartido(mid) {
    const p = A.partidos[mid]; if (!p || p.gl == null) return null;
    await fuentesListas();
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d');
    const [el, ev, escMP] = await Promise.all([cargaImg(crest(p.local)), cargaImg(crest(p.visitante)), cargaImg('escudos/badge/madridpatina.webp')]);
    x.fillStyle = '#0D0D0E'; x.fillRect(0, 0, 1080, 1350);
    const nos = ours(p.local) ? 'l' : ours(p.visitante) ? 'v' : null, gana = p.gl > p.gv ? 'l' : p.gl < p.gv ? 'v' : (p.pen ? (p.pen === p.local ? 'l' : 'v') : null);
    const res = !nos ? 'RESULTADO' : ours(p.local) && ours(p.visitante) ? 'DERBI' : gana === nos ? (p.gl === p.gv ? 'VICTORIA EN LOS PENALTIS' : 'VICTORIA') : gana ? (p.gl === p.gv ? 'DERROTA EN LOS PENALTIS' : 'DERROTA') : 'EMPATE';
    x.fillStyle = res.startsWith('VICTORIA') ? '#1A7A43' : res.startsWith('DERROTA') || res === 'RESULTADO' ? '#3A3A40' : RED; x.fillRect(0, 0, 1080, 110);
    x.fillStyle = '#FFFFFF'; x.font = "900 64px 'Big Shoulders Display'"; x.textAlign = 'center'; x.fillText(res, 540, 78);
    x.fillStyle = '#A6A6AD'; x.font = "700 30px 'IBM Plex Sans Condensed'"; x.fillText((p.ligaNombre + ' · Jornada ' + p.jornada + ' · ' + fd(p.fecha)).toUpperCase(), 540, 180);
    const disco = (im, cx) => { x.save(); x.beginPath(); x.arc(cx, 400, 150, 0, 7); x.fillStyle = '#26262A'; x.fill(); x.clip(); if (im) x.drawImage(im, cx - 150, 250, 300, 300); x.restore(); x.lineWidth = 6; x.strokeStyle = '#FFFFFF'; x.beginPath(); x.arc(cx, 400, 150, 0, 7); x.stroke(); };
    disco(el, 270); disco(ev, 810);
    const nm = n => (ours(n) ? mpAbr(n) : n);
    x.fillStyle = ours(p.local) ? '#FF6B63' : '#F4F4F5'; ajusta(x, nm(p.local), 440, 54, 800); x.fillText(nm(p.local), 270, 620);
    x.fillStyle = ours(p.visitante) ? '#FF6B63' : '#F4F4F5'; ajusta(x, nm(p.visitante), 440, 54, 800); x.fillText(nm(p.visitante), 810, 620);
    x.fillStyle = '#FFFFFF'; x.font = "900 300px 'Big Shoulders Display'"; x.fillText(p.gl + '–' + p.gv, 540, 930);
    if (p.pen) { x.fillStyle = '#A6A6AD'; x.font = "700 30px 'IBM Plex Sans Condensed'"; x.fillText('Gana en los penaltis: ' + nm(p.pen), 540, 990); }
    const goles = (lado) => (lado === 'l' ? p.gol_l : p.gol_v).filter(g => g.g).map(g => corto(g) + (g.g > 1 ? ' (' + g.g + ')' : '')).join(' · ');
    const nuestros = nos ? goles(nos) : '';
    if (nuestros) { x.fillStyle = '#A6A6AD'; x.font = "700 26px 'IBM Plex Sans Condensed'"; x.fillText('GOLES DE ' + nm(nos === 'l' ? p.local : p.visitante).toUpperCase(), 540, 1070);
      x.fillStyle = '#F4F4F5'; ajusta(x, nuestros, 960, 34, 600, 'IBM Plex Sans Condensed'); x.fillText(nuestros, 540, 1120); }
    x.textAlign = 'left';
    pieTarjeta(x, escMP);
    return { canvas: c, nombre: 'madridpatina-' + mid + '.png', texto: nm(p.local) + ' ' + p.gl + '–' + p.gv + ' ' + nm(p.visitante) };
  }
  let tarjetaAbierta = null;
  async function abrirTarjeta(tipo, id) {
    const capa = document.createElement('div'); capa.className = 'tj-capa'; capa.setAttribute('role', 'dialog'); capa.setAttribute('aria-modal', 'true'); capa.setAttribute('aria-label', 'Imagen para compartir');
    capa.innerHTML = '<div class="tj-caja"><div class="tj-img">Preparando la imagen…</div><div class="tj-bot"></div></div>';
    document.body.appendChild(capa); tarjetaAbierta = capa;
    const cerrar = () => { capa.remove(); tarjetaAbierta = null; document.removeEventListener('keydown', tecla); };
    const tecla = e => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    capa.addEventListener('click', e => { if (e.target === capa || e.target.closest('[data-tj-cerrar]')) cerrar(); });
    const r = await (tipo === 'jugador' ? tarjetaJugador(id) : tarjetaPartido(id));
    if (!r) { cerrar(); return; }
    const url = r.canvas.toDataURL('image/png');
    capa.querySelector('.tj-img').innerHTML = `<img src="${url}" alt="Imagen para compartir: ${esc(r.texto)}">`;
    const blob = await new Promise(res => r.canvas.toBlob(res, 'image/png'));
    const file = blob && new File([blob], r.nombre, { type: 'image/png' });
    const puede = file && navigator.canShare && navigator.canShare({ files: [file] });
    capa.querySelector('.tj-bot').innerHTML = `${puede ? '<button type="button" class="dv-alin" data-tj-compartir>Compartir</button>' : ''}<a class="dv-alin" href="${url}" download="${esc(r.nombre)}">Descargar</a><button type="button" class="an-tog" data-tj-cerrar>Cerrar</button>`;
    const b = capa.querySelector('[data-tj-compartir]');
    if (b) b.addEventListener('click', () => navigator.share({ files: [file], title: 'MADRIDPATINA', text: r.texto }).catch(() => {}));
    (b || capa.querySelector('a')).focus();
  }
  // WhatsApp no deja publicar solo en grupos ni canales: el botón prepara el mensaje y cada uno lo manda a quien quiera
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-wa]'); if (!b) return;
    const sn = DV.idp === b.dataset.wa ? snapDV() : null; if (!sn) return;
    const c = ctxDirecto(sn), nm = l => (c.mp[l] ? c.abr[l] : c.nombre[l]), url = BASE_WEB() + '#/directo/' + encodeURIComponent(b.dataset.wa);
    const marc = `${nm('L')} ${sn.gl || 0}–${sn.gv || 0} ${nm('V')}`;
    const txt = sn.estado === 'final' ? `Final: ${marc}${sn.penaltis && sn.penaltis.ganador ? ' (gana ' + nm(sn.penaltis.ganador) + ' en los penaltis)' : ''}. El partido, en la web del club: ${url}`
      : sn.estado === 'previa' ? `Hoy juegan ${nm('L')} y ${nm('V')}${sn.hora ? ' a las ' + sn.hora : ''}${sn.pista ? ' en ' + pistaBonita(sn.pista) : ''}. Directo: ${url}`
      : `En directo: ${marc}. Síguelo en la web del club: ${url}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener'); });
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-tarjeta]'); if (!b) return; e.preventDefault(); abrirTarjeta(b.dataset.tarjeta, b.dataset.id); });


  /* ── Tiros a puerta durante el partido (data/tiros.json, de scripts/reporte/tiros_vivo.py con las capturas del directo) ── */
  let TIR = null, tirP = null;
  const cargarTiros = () => tirP || (tirP = fetch('data/tiros.json?v=' + verDatos()).then(r => r.json()).then(d => (TIR = d)).catch(() => { tirP = null; return null; }));
  function graficoTiros(p, sinTitulo) {
    const x = TIR && p.idp && TIR[p.idp]; if (!x || x.s.length < 5) return '';
    const dur = x.dur, T = 2 * dur, s = x.s, fin = s[s.length - 1], mx = Math.max(4, fin[1], fin[2]);
    const W = anchoGrafico(860), H = W < 560 ? 200 : 230, Lm = 30, Rm = 40, Tm = 12, Bm = 26, w = W - Lm - Rm, h = H - Tm - Bm;
    const sx = t => Lm + Math.min(T, t) / T * w, sy = v => Tm + h - v / mx * h;
    const [cL, cV] = coloresLados(p.local, p.visitante);
    // laguna: más de 8 minutos sin que el acta suba los tiros y luego muchos de golpe; ahí no sabemos cuándo fue cada uno
    const laguna = (a, b) => b[0] - a[0] > 480 && (b[1] - a[1]) + (b[2] - a[2]) > 4;
    const hayLaguna = s.some((z, i) => i && laguna(s[i - 1], z));
    const escalon = (k, discontinua) => { let d = '', prev = [0, 0, 0], val0 = 0;
      s.forEach(z => { const val = z[k]; const xa = sx(prev[0]).toFixed(1), xb = sx(z[0]).toFixed(1);
        if (laguna(prev, z)) { if (discontinua) d += ` M${xa},${sy(val0).toFixed(1)} L${xb},${sy(val).toFixed(1)}`; }
        else if (!discontinua) d += ` M${xa},${sy(val0).toFixed(1)} L${xb},${sy(val0).toFixed(1)} L${xb},${sy(val).toFixed(1)}`;
        prev = z; val0 = val; });
      if (!discontinua) d += ` M${sx(prev[0]).toFixed(1)},${sy(val0).toFixed(1)} L${sx(T)},${sy(val0).toFixed(1)}`;
      return d.trim() || 'M0,0'; };
    const valEn = (t, k) => { let v = 0; s.forEach(z => { if (z[0] <= t) v = z[k]; }); return v; };
    const goles = (p.ev || []).filter(e => e.tipo === 'gol' && /^P[12]$/.test(e.periodo)).map(e => { const q = segs(e.minuto); return q == null || q > dur ? null : { t: (+e.periodo[1] - 1) * dur + dur - q, lado: e.lado === 'local' ? 1 : 2, m: e.marcador }; }).filter(Boolean);
    const marcas = goles.map(g => `<circle cx="${sx(g.t).toFixed(1)}" cy="${sy(valEn(g.t, g.lado)).toFixed(1)}" r="5" fill="${g.lado === 1 ? cL : cV}" stroke="#0D0D0E" stroke-width="1.5"><title>Gol (${esc((g.m || '').replace('-', '–'))}), minuto ${Math.floor(g.t / 60) + 1}</title></circle>`).join('');
    const ticksX = []; for (let m = 0; m <= T / 60; m += 10) ticksX.push(`<text x="${sx(m * 60)}" y="${H - 8}" text-anchor="${m === 0 ? 'start' : m === T / 60 ? 'end' : 'middle'}">${m}'</text>`);
    const st = mx > 40 ? 20 : 10, ticksY = []; for (let v = st; v <= mx; v += st) ticksY.push(`<line x1="${Lm}" x2="${Lm + w}" y1="${sy(v)}" y2="${sy(v)}" stroke="#26262A"/><text x="${Lm - 6}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`);
    const p1 = [valEn(dur, 1), valEn(dur, 2)], p2 = [fin[1] - p1[0], fin[2] - p1[1]], n = k => esc(mpAbr(k === 1 ? p.local : p.visitante));
    return `<div style="max-width:${W}px;margin:28px auto 0">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap">${sinTitulo ? '<span></span>' : '<span class="lab">TIROS A PUERTA DURANTE EL PARTIDO</span>'}
        <span style="display:flex;gap:12px;font-size:13px;color:#A6A6AD"><span><span style="color:${cL}">━</span> ${n(1)}</span><span><span style="color:${cV}">━</span> ${n(2)}</span><span>● gol</span></span></div>
      ${s.some((z, i) => i && laguna(s[i - 1], z) && s[i - 1][0] < dur && z[0] > dur) ? '' : `<div style="font-size:15px;color:#F4F4F5;margin-top:6px">1.ª parte: ${n(1)} ${p1[0]} – ${p1[1]} ${n(2)} · 2.ª parte: ${n(1)} ${p2[0]} – ${p2[1]} ${n(2)}</div>`}
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Tiros a puerta acumulados de cada equipo a lo largo del partido" style="display:block;margin-top:8px;font-size:12px;fill:#8A8A8F;font-family:'IBM Plex Sans Condensed',sans-serif">
        ${ticksY.join('')}<line x1="${sx(dur)}" x2="${sx(dur)}" y1="${Tm}" y2="${Tm + h}" stroke="#55555B" stroke-dasharray="3 3"/><line x1="${Lm}" x2="${Lm + w}" y1="${Tm + h}" y2="${Tm + h}" stroke="#55555B"/>
        <path d="${escalon(2)}" fill="none" stroke="${cV}" stroke-width="2.5" stroke-linejoin="round"/><path d="${escalon(1)}" fill="none" stroke="${cL}" stroke-width="2.5" stroke-linejoin="round"/>
        ${hayLaguna ? `<path d="${escalon(2, true)}" fill="none" stroke="${cV}" stroke-width="2" stroke-dasharray="4 5"/><path d="${escalon(1, true)}" fill="none" stroke="${cL}" stroke-width="2" stroke-dasharray="4 5"/>` : ''}
        <text x="${Lm + w + 6}" y="${sy(fin[1]) + 4}" fill="${cL}" font-weight="700">${fin[1]}</text><text x="${Lm + w + 6}" y="${sy(fin[2]) + 4 + (Math.abs(fin[1] - fin[2]) / mx * h < 14 ? 14 : 0)}" fill="${cV}" font-weight="700">${fin[2]}</text>
        ${marcas}${ticksX.join('')}</svg>
      <div style="font-size:12px;color:#6B6B70;margin-top:4px">Los tiros los apunta el acta de cada portero durante el partido, y los guardamos desde el directo. El acta no publica el reloj: el minuto de cada tiro es aproximado (uno o dos minutos arriba o abajo). La línea de puntos vertical es el descanso.${hayLaguna ? ' <b style="color:#C9C9CE">En los tramos discontinuos, el acta dejó de subir los tiros y luego los apuntó de golpe: solo sabemos cuántos hubo en total en ese rato.</b>' : ''}</div></div>`;
  }
  function rellenarTirosPartido() {
    const el = view.querySelector('[data-tiros-partido]'); if (!el) return;
    const st = !!el.dataset.sinTitulo;
    // dentro de una pestaña (página del partido): si no hay tiros, fuera la pestaña; si era la única, fuera la tarjeta
    const quita = () => { const pn = el.closest('[data-panel]'); if (!pn) { el.remove(); return; }
      const [id, k] = pn.dataset.panel.split(':'), nav = view.querySelector(`[data-tabs="${id}"]`), b = nav && nav.querySelector(`[data-tab="${k}"]`), estaba = !pn.hidden;
      pn.remove(); if (b) b.remove();
      const queda = nav && nav.querySelector('[data-tab]'); if (!queda) { const card = nav && nav.closest('.pa-gc'); if (card) card.remove(); return; }
      if (estaba) queda.click(); };
    const pon = () => { const p = A.partidos[el.dataset.tirosPartido]; const h = p && TIR ? graficoTiros(p, st) : ''; if (h) { el.innerHTML = h; return; }
      if (!p || !p.idp || (p.fecha || '') < VIGIA_DESDE) { quita(); return; }   // antes del vigía no hay nada que pedir
      tirosApi(p.idp).then(d => { if (!d) { quita(); return; } TIR = TIR || {}; TIR[p.idp] = d; const h2 = graficoTiros(p, st); if (h2) el.innerHTML = h2; else quita(); }); };
    if (TIR) pon(); else Promise.all([cargarTiros(), ANA ? ANA : cargarAnalisis()]).then(pon);
  }


  /* ── Afición y banquillo: el servicio del directo en Vercel guarda votos, emojis, quién está en pista y los tiros que
     graba el vigía (/api/voto, /api/reaccion, /api/pista, /api/tiros). Si el servicio no tiene almacén, todo esto se oculta. */
  const API = new URLSearchParams(location.search).get('api') === 'local' ? 'http://localhost:5193/api/' : 'https://madridpatina-directo.vercel.app/api/';
  const DISP = (() => { try { let d = localStorage.getItem('mp-disp'); if (!d) { d = 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('mp-disp', d); } return d; }
    catch (e) { return 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36); } })();
  // ¿tiene almacén el servicio? Lo comprueba cada noche el proceso semanal (data/servicio.json); si no, ni se le pregunta
  let srvP = null;
  // y qué direcciones tiene ya publicadas (p. ej. «video» llega con una versión nueva del servicio)
  const servicioListo = () => srvP || (srvP = API.includes('localhost') ? Promise.resolve({ almacen: true, video: true, apodo: true })
    : fetch('data/servicio.json?v=' + verDatos()).then(r => (r.ok ? r.json() : {})).catch(() => ({})));
  const puede = (s, q) => !!(s && s.almacen) && (!q.startsWith('video') || !!s.video) && (!q.startsWith('apodo') || !!s.apodo);
  const apiGet = q => servicioListo().then(s => (puede(s, q) ? fetch(API + q, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null) : null));
  const apiPost = (q, cuerpo) => servicioListo().then(s => (puede(s, q) ? fetch(API + q, { method: 'POST', body: JSON.stringify(cuerpo) }).then(r => r.json().then(j => Object.assign(j, { _st: r.status }))).catch(() => null) : null));
  const leeLS = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
  const ponLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const normId = id => String(id || '').replace(/-0+(\d+)$/, '-$1');   // «…-GOL-05» y «…-GOL-5» son el mismo gol

  // quién estaba en pista en cada gol: lo marcado en el vídeo y lo apuntado desde el banquillo (data/pista.json + lo último del servicio)
  let PIS = null, pisP = null; const PIS_VIVO = {};
  const cargarPistas = () => pisP || (pisP = fetch('data/pista.json?v=' + verDatos()).then(r => (r.ok ? r.json() : {})).then(d => (PIS = d || {})).catch(() => (PIS = {})));
  function pistaGol(idp, id) {
    const n = normId(id), v = VID && VID[idp], deVid = v && Object.entries(v.ev || {}).find(([k]) => normId(k) === n);
    if (deVid && deVid[1].pista) return deVid[1].pista;
    const de = (o) => { const x = o && Object.entries(o).find(([k]) => normId(k) === n); return x ? x[1] : null; };
    return de(PIS_VIVO[idp]) || de(PIS && PIS[idp]) || null;
  }

  // ── emojis en el directo («la grada») ──
  const EMO = [['aplauso', '👏', 'Aplausos'], ['fuego', '🔥', 'Fuego'], ['sorpresa', '😮', 'Sorpresa'], ['fuerza', '💪', 'Ánimo'], ['corazon', '❤️', 'Corazón']];
  const REAC = { idp: null, datos: null, t: 0 };
  function reacHtml(idp) {
    if (!REAC.datos || REAC.idp !== idp) return '';
    const r = REAC.datos.reacciones;
    return `<div class="an-reac"><span class="lab">LA GRADA</span><div class="b">${EMO.map(([k, e, t]) => `<button type="button" data-reac="${k}" aria-label="${t}: ${r[k] || 0}"><span aria-hidden="true">${e}</span><b>${r[k] || 0}</b></button>`).join('')}</div></div>`;
  }
  const pintarReac = () => { if (!REAC.idp) return; view.querySelectorAll(`[data-reac-caja="${REAC.idp}"]`).forEach(c => { c.innerHTML = reacHtml(REAC.idp); }); };
  function cargarReac(idp, ya) {
    if (!idp || (!ya && REAC.idp === idp && Date.now() - REAC.t < 20000)) return;
    REAC.t = Date.now();
    apiGet('reaccion?idp=' + encodeURIComponent(idp)).then(d => { if (d && d.reacciones) { REAC.idp = idp; REAC.datos = d; pintarReac(); } });
  }
  document.addEventListener('mp-directo', () => { const m = /^#\/video\/([^/]+)/.exec(location.hash); if (!m) return; const idp = decodeURIComponent(m[1]); cargarReac(idp);
    const sn = LIVE.snaps[idp]; if (sn && sn.estado === 'final') pintarVotoDirecto(idp, true); });
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-reac]'); if (!b || !REAC.datos) return;
    const k = b.dataset.reac; REAC.datos.reacciones[k] = (REAC.datos.reacciones[k] || 0) + 1; pintarReac();
    if (MOV) { const f = document.createElement('span'); f.className = 'an-flota'; f.textContent = (EMO.find(x => x[0] === k) || [])[1] || ''; const r = b.getBoundingClientRect();
      f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = r.top + 'px'; document.body.appendChild(f); setTimeout(() => f.remove(), 1100); }
    apiPost('reaccion', { idp: REAC.idp, e: k, d: DISP }).then(d => { if (d && d.reacciones) { REAC.datos = d; pintarReac(); } }); });

  // ── votación al mejor del partido (nuestros partidos; se vota hasta 7 días después) ──
  function candidatos(p) {
    const lados = [['l', p.local], ['v', p.visitante]].filter(([, n]) => ours(n));
    return lados.flatMap(([s]) => ((s === 'l' ? p.alin_l : p.alin_v) || []).concat(s === 'l' ? p.por_l || [] : p.por_v || []))
      .filter((x, i, xs) => x.k && xs.findIndex(y => y.k === x.k) === i).sort((a, b) => (+a.dorsal) - (+b.dorsal));
  }
  function votoHtml(p, d) {
    const cand = candidatos(p); if (!cand.length) return '';
    const mio = leeLS('mp-voto-' + p.idp, null), hoy = hoyISO(), dias = (Date.parse(hoy) - Date.parse(p.fecha)) / 864e5, abierta = dias <= 7;
    const tot = d.total || 0;
    if (!mio && abierta) return `${lab('¿QUIÉN FUE EL MEJOR?', 'margin-bottom:2px')}<div class="an-nota" style="margin-top:0">Vota a un jugador nuestro. Un voto por móvil; se puede votar hasta 7 días después del partido.${tot ? ` Ya han votado ${tot}.` : ''}</div>
      <div class="an-togs">${cand.map(x => `<button type="button" class="an-tog" data-votar="${esc(x.k)}">#${esc(x.dorsal)} ${esc(corto(x))}</button>`).join('')}</div>`;
    if (!tot) return '';
    const orden = cand.map(x => [x, d.votos[x.k] || 0]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]), mx = orden.length ? orden[0][1] : 1;
    return `${lab('EL MEJOR DEL PARTIDO, SEGÚN LA AFICIÓN', 'margin-bottom:2px')}<div class="an-nota" style="margin-top:0">${tot} ${tot === 1 ? 'voto' : 'votos'}${mio === 'ya' ? ' · desde este móvil ya se había votado' : mio && cand.find(x => x.k === mio) ? ' · el tuyo: ' + esc(corto(cand.find(x => x.k === mio))) : ''}${abierta ? ' · se puede votar hasta 7 días después del partido' : ''}</div>
      ${orden.slice(0, 6).map(([x, n]) => `<div class="an-voto"><span>#${esc(x.dorsal)} ${esc(corto(x))}</span><div class="bar"><i style="width:${(n / mx * 100).toFixed(1)}%"></i></div><b>${Math.round(n / tot * 100)} %</b></div>`).join('')}`;
  }
  // en el directo y en el resumen del acta: el partido de app.json si ya está; si no, la plantilla del acta (con su clave de la web)
  function partidoVoto(idp) {
    const p = Object.values(A.partidos).find(x => x.idp === idp); if (p) return p;
    const sn = LIVE.snaps[idp] || (RSM.final && RSM.final.idp === idp && RSM.final); if (!sn || !sn.plantillas) return null;
    const ctx = ctxDirecto(sn), lista = l => (ctx.mp[l] ? (sn.plantillas[l] || []).map(j => { const q = jugadorDe(ctx, l, j.id_player, j.dorsal); return q ? Object.assign({}, q, { dorsal: j.dorsal }) : null; }).filter(Boolean) : []);
    return { idp, fecha: hoyISO(), local: ctx.nombre.L, visitante: ctx.nombre.V, alin_l: lista('L'), alin_v: lista('V'), por_l: [], por_v: [] };
  }
  function pintarVotoDirecto(idp, final) {
    const el = view.querySelector(`[data-voto-directo="${idp}"]`); if (!el || !final || el.dataset.hecho) return;
    const p = partidoVoto(idp); if (!p) return;
    el.dataset.hecho = '1';
    apiGet('voto?idp=' + encodeURIComponent(idp)).then(d => { if (!d) return; const h = votoHtml(p, d); if (h) { el.dataset.voto = '_' + idp; VOTO_P['_' + idp] = p; el.innerHTML = `<div class="card an-c" style="margin-top:12px">${h}</div>`; } });
  }
  const VOTO_P = {};   // partidos que aún no están en app.json (directo de hoy): los usa el voto
  function rellenarVoto() {
    const el = view.querySelector('[data-voto]'); if (!el) return;
    const p = A.partidos[el.dataset.voto]; if (!p || !p.idp) { el.remove(); return; }
    apiGet('voto?idp=' + encodeURIComponent(p.idp)).then(d => { if (!d) { el.remove(); return; } const h = votoHtml(p, d); if (h) el.innerHTML = `<div class="card an-c" style="margin-top:12px">${h}</div>`; else el.remove(); });
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-votar]'); if (!b) return;
    const el = b.closest('[data-voto]'), p = el && (A.partidos[el.dataset.voto] || VOTO_P[el.dataset.voto]); if (!p) return;
    el.querySelectorAll('[data-votar]').forEach(x => { x.disabled = true; });
    apiPost('voto', { idp: p.idp, k: b.dataset.votar, d: DISP }).then(d => {
      if (d && (d._st === 200 || d._st === 409 || d._st === 429)) { ponLS('mp-voto-' + p.idp, d._st === 200 ? b.dataset.votar : 'ya'); el.innerHTML = `<div class="card an-c" style="margin-top:12px">${votoHtml(p, d)}</div>`; }
      else { el.querySelectorAll('[data-votar]').forEach(x => { x.disabled = false; }); } }); });

  // ── tiros grabados por el vigía (antes de que el proceso semanal los publique en data/tiros.json) ──
  const TIR_VIVO = {}, VIGIA_DESDE = '2026-10-23';   // el vigía en internet graba desde ese día
  const tirosApi = idp => (idp in TIR_VIVO ? Promise.resolve(TIR_VIVO[idp]) : apiGet('tiros?idp=' + encodeURIComponent(idp)).then(d => (TIR_VIVO[idp] = d && d.s ? d : null)));

  /* ── Banquillo (#/banquillo/{idp}): el delegado apunta quién está en pista en cada gol, con líneas preparadas para ir rápido.
     Se guarda en el servicio con el PIN del banquillo; si no hay servicio, se queda en este móvil. ── */
  const BQ = { idp: null, S: null, sel: {}, guardado: {}, editar: null, msg: '' };
  function lineas(l) { const n = BQ.S && BQ.S[l === 'L' ? 'local' : 'visitante']; return leeLS('mp-lineas-' + (n || l), [[], [], []]); }
  function golesBQ() { return ((BQ.S && BQ.S.eventos) || []).filter(e => e.tipo === 'GOL' && e.id).slice().sort((a, b) => (a.periodo - b.periodo) || (segs(a.t) - segs(b.t))); }
  function bqHtml() {
    const S = BQ.S, ctx = ctxDirecto(S), lados = ['L', 'V'].filter(l => ctx.mp[l]);
    const jug = l => ((S.plantillas || {})[l] || []).slice().sort((a, b) => (+a.dorsal) - (+b.dorsal));
    const chip = (l, j, on, attrs) => `<button type="button" class="an-tog" aria-pressed="${on ? 'true' : 'false'}" ${attrs}>#${esc(j.dorsal)} ${esc(j.jugador_corto || '')}</button>`;
    const lin = lados.map(l => { const ls = lineas(l); return `<div class="an-sub">LÍNEAS DE ${esc(ctx.abr[l])}</div>${ls.map((x, i) => `<div class="bq-lin"><b>L${i + 1}</b>${BQ.editar === l + i
      ? `<div class="an-togs">${jug(l).map(j => chip(l, j, x.includes(String(j.dorsal)), `data-bq="linea-j" data-l="${l}" data-i="${i}" data-d="${esc(j.dorsal)}"`)).join('')}</div><button type="button" class="dv-alin" data-bq="linea-ok">Hecho</button>`
      : `<span>${x.length ? x.map(d => '#' + esc(d)).join(' ') : 'sin jugadores'}</span><button type="button" class="an-tog" data-bq="linea-editar" data-l="${l}" data-i="${i}">Cambiar</button>`}</div>`).join('')}`; }).join('');
    const goles = golesBQ().map(e => { const id = normId(e.id), sel = BQ.sel[id] || { L: [], V: [] }, gu = BQ.guardado[id];
      const marc = (e.marcador || '').replace('-', '–'), min = Math.floor(((e.periodo - 1) * (S.duracion_periodo || 1500) + (segs(e.t) || 0)) / 60) + 1;
      return `<div class="bq-gol"><div class="cab"><b>${esc(marc)}</b><span>minuto ${min} · gol de ${esc(ctx.abr[e.lado] || '')}${e.dorsal ? ' · #' + esc(e.dorsal) + ' ' + esc(e.jugador_corto || '') : ''}</span><em class="${gu === 'ok' ? 'ok' : gu ? 'mal' : ''}">${gu === 'ok' ? 'Guardado' : gu || ''}</em></div>
        ${lados.map(l => `<div class="an-sub">${esc(ctx.abr[l])} EN PISTA · ${sel[l].length}</div><div class="an-togs">${lineas(l).map((x, i) => x.length ? `<button type="button" class="an-tog bq-l" data-bq="poner-linea" data-id="${esc(id)}" data-l="${l}" data-i="${i}">L${i + 1}</button>` : '').join('')}
          ${jug(l).map(j => chip(l, j, sel[l].includes(String(j.dorsal)), `data-bq="j" data-id="${esc(id)}" data-l="${l}" data-d="${esc(j.dorsal)}"`)).join('')}</div>`).join('')}
        <button type="button" class="dv-alin" data-bq="guardar" data-id="${esc(id)}">Guardar este gol</button></div>`; }).reverse().join('');
    return `<div class="sy"><div class="lab" style="color:#FF6B63">BANQUILLO</div><h1>${esc(S.local || '')} <span>${S.gl ?? ''}–${S.gv ?? ''}</span> ${esc(S.visitante || '')}</h1>
      <p class="sy-ayuda">Para el delegado: en cada gol, marca quién de los nuestros estaba en pista (con el portero) y pulsa «Guardar este gol». Prepara las líneas antes del partido y luego basta con tocar L1, L2 o L3 y corregir. Los goles van apareciendo solos, como en el directo. Con eso la web calcula el más/menos de cada jugador.</p>
      <div class="bq-pin"><label for="bq-pin">PIN del banquillo</label><input id="bq-pin" type="password" inputmode="numeric" autocomplete="off" value="${esc(leeLS('mp-pin', ''))}"><span class="an-nota" style="margin:0">Se guarda en este móvil.</span></div>
      ${BQ.msg ? `<div class="an-frase">${esc(BQ.msg)}</div>` : ''}
      <div class="card an-c" style="margin-top:12px">${lin}</div>
      <div style="margin-top:12px">${lab('GOLES · EL ÚLTIMO, ARRIBA', 'margin-bottom:6px')}${goles || '<div class="an-nota">Aún no hay goles en el acta.</div>'}</div></div>`;
  }
  const pintarBQ = () => { const c = view.querySelector('[data-bq-caja]'); if (c && BQ.S) c.innerHTML = bqHtml(); };
  function vBanquillo(idp) {
    if (BQ.idp !== idp) Object.assign(BQ, { idp, S: null, sel: leeLS('mp-banq-' + idp, {}), guardado: {}, editar: null, msg: '' });
    const S = LIVE.snaps[idp] || BQ.S;
    if (!S) {
      const url = DIRECTO_EJEMPLO ? DIRECTO_URL : DIRECTO_URL + '?idp=' + encodeURIComponent(idp);
      fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(d => {
        BQ.S = (d.partidos || []).find(x => x.idp === idp) || null;
        if (location.hash.indexOf('#/banquillo/' + idp) === 0) render();
      }).catch(() => { const w = $('[data-bq-espera]'); if (w) w.textContent = 'Sin conexión con el acta de la federación.'; });
      return '<div class="loading" data-bq-espera>Cargando el acta del partido…</div>';
    }
    BQ.S = S;
    apiGet('pista?idp=' + encodeURIComponent(idp)).then(d => { if (!d || !d.ev) return; Object.entries(d.ev).forEach(([k, v]) => { const n = normId(k); if (!BQ.sel[n] || !(BQ.sel[n].L.length + BQ.sel[n].V.length)) BQ.sel[n] = { L: v.L || [], V: v.V || [] }; BQ.guardado[n] = BQ.guardado[n] || 'ok'; }); pintarBQ(); });
    return `<div data-bq-caja>${bqHtml()}</div>`;
  }
  document.addEventListener('mp-directo', () => { if (BQ.idp && location.hash.indexOf('#/banquillo/' + BQ.idp) === 0 && LIVE.snaps[BQ.idp]) { BQ.S = LIVE.snaps[BQ.idp]; pintarBQ(); } });
  document.addEventListener('input', e => { if (e.target && e.target.id === 'bq-pin') ponLS('mp-pin', e.target.value); });
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-bq]'); if (!b || !BQ.S) return;
    const a = b.dataset.bq, id = b.dataset.id, l = b.dataset.l;
    const selDe = k => (BQ.sel[k] = BQ.sel[k] || { L: [], V: [] });
    if (a === 'j') { const s = selDe(id)[l], i = s.indexOf(b.dataset.d); if (i >= 0) s.splice(i, 1); else s.push(b.dataset.d); BQ.guardado[id] = 'Sin guardar'; }
    else if (a === 'poner-linea') { selDe(id)[l] = lineas(l)[+b.dataset.i].slice(); BQ.guardado[id] = 'Sin guardar'; }
    else if (a === 'linea-editar') BQ.editar = l + b.dataset.i;
    else if (a === 'linea-ok') BQ.editar = null;
    else if (a === 'linea-j') { const n = BQ.S[l === 'L' ? 'local' : 'visitante'] || l, ls = lineas(l), x = ls[+b.dataset.i], i = x.indexOf(b.dataset.d); if (i >= 0) x.splice(i, 1); else x.push(b.dataset.d); ponLS('mp-lineas-' + n, ls); }
    else if (a === 'guardar') {
      const s = selDe(id), pin = ($('#bq-pin') || {}).value || '';
      BQ.guardado[id] = 'Guardando…'; pintarBQ();
      apiPost('pista', { idp: BQ.idp, id, L: s.L, V: s.V, pin }).then(d => { BQ.guardado[id] = d && d._st === 200 ? 'ok' : (d && d.error) || 'Sin conexión: queda guardado en este móvil'; pintarBQ(); });
    }
    ponLS('mp-banq-' + BQ.idp, BQ.sel);
    pintarBQ();
  });

  // en la página de un partido nuestro: lo último que haya apuntado el banquillo (y data/pista.json)
  function rellenarPistaVivo() {
    const m = /^#\/partido\/([^/]+)/.exec(location.hash), p = m && A.partidos[decodeURIComponent(m[1])];
    if (!p || !p.idp || !p.nuestro) return;
    const repinta = () => { if (location.hash === m[0]) render(); };
    if (!PIS) cargarPistas().then(d => { if (d && d[p.idp]) repinta(); });
    if (!(p.idp in PIS_VIVO)) { PIS_VIVO[p.idp] = null; apiGet('pista?idp=' + encodeURIComponent(p.idp)).then(d => { PIS_VIVO[p.idp] = (d && d.ev) || {}; if (Object.keys(PIS_VIVO[p.idp]).length) repinta(); }); }
  }

  /* ── 6. Ficha de jugador ────────────────────────────────── */
  // FMPe (scripts/reporte/fmpe.py): puntos por partido × factor de su liga × 18, o sea, puntos en una temporada de Senior 1
  const FMPE_PJ = 18;

  /* ── Cómo lo calculamos: cada número que publicamos, de dónde sale y qué no puede decir ─────────────────────────────── */
  const COMO = sec => ` · <a href="#/metodo/${sec}">cómo se calcula</a>`;
  const comoL = sec => `<a class="como-l" href="#/metodo/${sec}">¿Cómo se calcula?</a>`;
  /* ── ¿Nuevo en el hockey línea? (#/nuevo): lo básico para seguir un partido, con las Reglas de juego 2026 y las Bases
     de la FMP 2026/27 (duraciones, empates, categorías). Sin datos de nadie: solo el reglamento. ─────────────────── */
  function vNuevo() {
    // dibujos de línea con el trazo de la web (currentColor); «t» = relleno suave, «f» = relleno, «w» = trazo blanco
    const ico = d => `<svg class="nv-ico" viewBox="0 0 64 64" aria-hidden="true">${d}</svg>`;
    // disco de hockey línea: plástico, con tacos («pines») en las dos caras para que deslice
    const pin = (x, y, r = 1.9) => `<circle class="f" cx="${x}" cy="${y}" r="${r}"/>`;
    const DISCO = (cx, cy, k = 1) => { const rx = 21 * k, ry = 8 * k, h = 8 * k, pr = 1.9 * k;
      const top = (k < .6 ? [0, 90, 180, 270] : [0, 45, 90, 135, 180, 225, 270, 315]).map(a => pin((cx + 14.5 * k * Math.cos(a * Math.PI / 180)).toFixed(1), (cy + 5.6 * k * Math.sin(a * Math.PI / 180)).toFixed(1), pr)).join('');
      const bot = (k < .6 ? [-10, 10] : [-15, -5, 5, 15]).map(dx => pin((cx + dx * k).toFixed(1), (cy + h + ry * Math.sqrt(1 - (dx / 21) ** 2) + 1.6 * k).toFixed(1), pr)).join('');
      return `<path class="t" d="M${cx - rx} ${cy}v${h}a${rx} ${ry} 0 0 0 ${2 * rx} 0v-${h}"/><ellipse class="t" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>${top}${bot}<ellipse cx="${cx}" cy="${cy}" rx="${6 * k}" ry="${2.3 * k}"/>`; };
    const PATIN = '<path class="t" d="M14 6h16v20l13 4.5c6 2 9.5 5.5 9.5 10.5v3H14z"/><path d="M14 14h16"/><path class="w" d="M30 18l5 1.5M30 22.5l7 2.3M30 27l8 2.6"/><path d="M11 46h45"/><path d="M15 44v2M52 44v2"/>'
      + [18, 28.5, 39, 49.5].map(x => `<circle class="t" cx="${x}" cy="52" r="5.5"/><circle class="f" cx="${x}" cy="52" r="1.6"/>`).join('');
    const IC = {
      disco: ico(DISCO(32, 24)),
      cambio: ico('<path d="M9 22h40"/><path d="M41 13l9 9-9 9"/><path d="M55 44H15"/><path d="M23 35l-9 9 9 9"/>'),
      reloj: ico('<circle class="t" cx="32" cy="37" r="20"/><path d="M27 8h10M32 8v9M48 20l4-4"/><path d="M32 20v3M32 51v3M15 37h3M46 37h3"/><rect class="f" x="25" y="29" width="4.5" height="16" rx="1"/><rect class="f" x="34.5" y="29" width="4.5" height="16" rx="1"/>'),
      stick: ico('<path class="g" d="M52 4 27 47"/><path class="gw" d="M52 4l-4.5 7.7"/><path class="t" d="M29 43l-5 9c-2.5 4.4-6.5 6-12 6H5v-5h7c3.6 0 5.8-1.1 7.4-3.9l4.6-8.1z"/><path class="w" d="M13 53v5M17.5 52v5.6M22 49.5l2.4 4"/>'),
      patin: ico(PATIN),
      casco: ico('<path class="t" d="M12 35a20 20 0 0 1 40 0v4H12z"/><path class="w" d="M26 17v7M32 15v9M38 17v7"/><path d="M16 39v11c0 5 4 8 9 8h14c5 0 9-3 9-8V39"/><path d="M24 39v19M32 39v19M40 39v19M16 46h32M17 52h30"/><path d="M12 39l-3 9"/>'),
      patada: ico('<g transform="translate(-2 6) scale(.78)">' + PATIN + '</g>' + DISCO(52, 47, .42) + '<path class="w" d="M38 36h6M40 41h5"/>'),
      valla: ico('<rect class="t" x="4" y="38" width="56" height="18" rx="2"/><path d="M4 43h56M24 43v13M44 43v13"/>' + DISCO(32, 27, .55) + '<path class="w" d="M32 4v11M27 10l5 5 5-5"/>'),
      botella: ico('<rect class="f" x="18" y="4" width="13" height="6" rx="1.5"/><path class="t" d="M19 10h11v6l4 5v33a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V21l4-5z"/><path class="w" d="M15 32h19M15 40h19"/><path class="t" d="M40 16h17v34l-5-3-3.5 3-3.5-3-5 3z"/><path class="w" d="M40 23h17M40 28h17"/>'),
      vacia: ico('<path class="t" d="M14 48l6-9h24l6 9z"/><path d="M20 39V24M44 39V24M20 24l-6-6M44 24l6-6"/><path class="n" d="M26 24v15M32 24v15M38 24v15M20 29h24M20 34h24M14 18l6 6M50 18l-6 6"/><path class="g" d="M8 52V18h48v34"/>'),
    };
    const sec = (id, n, k, t, cuerpo) => `<section id="n-${id}" class="mt-sec nv-sec" data-anim="mpUp .45s cubic-bezier(.2,.8,.2,1)">
        <div class="mt-cab"><span class="n">${n}</span><div><div class="k">${k}</div><h2>${t}</h2></div></div>${cuerpo}</section>`;
    const P = x => `<p class="mt-p">${x}</p>`;
    // la pista, a escala (50 × 25 m, 10 px por metro): línea central, porterías, áreas y puntos de saque
    const gx = [43, 457], spots = [[104, 63], [104, 197], [396, 63], [396, 197]];
    const marca = (x, y, n) => `<g class="nv-m"><circle cx="${x}" cy="${y}" r="17"/><text x="${x}" y="${y + 7}">${n}</text></g>`;
    const pista = `<svg class="nv-pista" viewBox="0 0 500 260" role="img" aria-label="Plano de una pista de hockey línea de 50 por 25 metros, la medida ideal">
        <rect x="5" y="5" width="490" height="250" rx="50" class="valla"/>
        <line x1="250" y1="5" x2="250" y2="255" class="roja"/>
        <circle cx="250" cy="130" r="30" class="circ"/><circle cx="250" cy="130" r="3" class="pto"/>
        ${gx.map(x => `<line x1="${x}" y1="${x < 250 ? 22 : 22}" x2="${x}" y2="238" class="gol"/>`).join('')}
        ${spots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="30" class="circ"/><circle cx="${x}" cy="${y}" r="3" class="pto"/>`).join('')}
        <rect x="43" y="118.5" width="12" height="23" class="area"/><rect x="445" y="118.5" width="12" height="23" class="area"/>
        <rect x="32" y="121.5" width="11" height="17" class="port"/><rect x="457" y="121.5" width="11" height="17" class="port"/>
        ${marca(250, 32, 1)}${marca(22, 96, 2)}${marca(78, 130, 3)}${marca(104, 63, 4)}
      </svg>`;
    const ley = [['1', 'La línea del centro', 'Divide la pista en dos campos. No hay fuera de juego: se puede pasar el disco de un extremo a otro.'],
      ['2', 'La portería', 'Mide 1,70 m de ancho y 1,05 m de alto.'],
      ['3', 'El área del portero', 'Rectángulo rojo delante de la portería. Un atacante no puede estar dentro si el disco no está en ella.'],
      ['4', 'Los puntos de saque', 'Hay cinco: uno en el centro y dos en cada campo. En ellos se reanuda el juego después de una parada.']];
    const s1 = sec('pista', '01', 'LA PISTA', 'Medidas, líneas y porterías', `
      ${P('El reglamento admite pistas de 40 a 60 metros de largo y de 20 a 30 de ancho; lo ideal es 50 × 25, con el ancho la mitad del largo. Las medidas cambian de una instalación a otra. El plano es el de una pista de 50 × 25:')}
      <div class="nv-pista-c">${pista}</div>
      <div class="nv-ley">${ley.map(([n, t, x]) => `<div><span class="nv-num">${n}</span><div><b>${t}</b><span>${x}</span></div></div>`).join('')}</div>
      ${P('La valla mide algo más de un metro y tiene las esquinas redondeadas. Si el disco golpea la valla, el juego continúa. El suelo suele ser de baldosa deportiva; el reglamento también admite madera, cemento o asfalto.')}`);
    // quién juega
    const ficha = (c, t) => `<span class="nv-j ${c}">${t}</span>`;
    const s2 = sec('equipos', '02', 'LOS EQUIPOS', 'Jugadores en pista y cambios', `
      <div class="nv-cinco"><div>${ficha('', '')}${ficha('', '')}${ficha('', '')}${ficha('', '')}${ficha('por', 'P')}</div><span>contra</span><div>${ficha('riv', '')}${ficha('riv', '')}${ficha('riv', '')}${ficha('riv', '')}${ficha('riv por', 'P')}</div></div>
      <div class="mt-tarjetas">
        <div class="mt-tarj"><div class="ic">4 + 1</div><b>En pista</b><p>Cada equipo juega con cuatro jugadores y un portero. En el acta pueden ir hasta 15 jugadores y el portero.</p></div>
        <div class="mt-tarj"><div class="ic">${IC.cambio}</div><b>Cambios</b><p>Se hacen sin parar el juego y sin límite. El jugador que sale tiene que estar a menos de 3 metros del banquillo antes de que entre el otro.</p></div>
        <div class="mt-tarj"><div class="ic">C · A</div><b>Capitán</b><p>Lleva una «C» en la camiseta y sus suplentes, una «A». El portero no puede ser capitán.</p></div>
      </div>`);
    // cuánto dura: dos partes y 5 minutos de descanso; el reloj se para
    const dur = [['Senior', 25, 'nuestros equipos A, B, C y D'], ['Júnior, juvenil, infantil y alevín', 20, 'nuestros Infantil y Alevín'], ['Benjamín y prebenjamín', 15, '']];
    const s3 = sec('tiempo', '03', 'EL PARTIDO', 'Duración y reloj', `
      <div class="nv-dur">${dur.map(([c, m, x]) => `<div class="nv-dur-f"><div class="nv-dur-t"><b>${c}</b><span>${m} + ${m} minutos${x ? ' · ' + x : ''}</span></div>
        <div class="nv-dur-b"><i style="flex:${m}">${m}'</i><i class="d" style="flex:5">5'</i><i style="flex:${m}">${m}'</i><i class="hueco" style="flex:${25 - m}"></i></div></div>`).join('')}</div>
      <div class="cal-ley"><span class="l-por">Partes</span><span class="l-d">Descanso</span></div>
      <div class="mt-tarjetas">
        <div class="mt-tarj"><div class="ic">${IC.reloj}</div><b>Reloj parado</b><p>El reloj se detiene cada vez que se para el juego y se pone en marcha cuando el árbitro suelta el disco. Por eso un partido senior necesita una hora y media de pista.</p></div>
        <div class="mt-tarj"><div class="ic">1'</div><b>Tiempo muerto</b><p>Cada equipo puede pedir uno de un minuto en cada parte, con el juego parado.</p></div>
        <div class="mt-tarj"><div class="ic">0</div><b>Empates</b><p>Si el partido acaba empatado, se tiran penaltis al terminar (apartado 07).</p></div>
      </div>`);
    // el material
    const s4 = sec('material', '04', 'EL MATERIAL', 'Disco, stick, patines y protecciones', `
      <div class="mt-tarjetas">
        <div class="mt-tarj"><div class="ic">${IC.disco}</div><b>El disco</b><p>De plástico, de 7,7 cm de diámetro y entre 120 y 130 gramos, con pequeños tacos en las dos caras para que deslice. En Madrid es obligatorio el modelo Stilmat.</p></div>
        <div class="mt-tarj"><div class="ic">${IC.stick}</div><b>El stick</b><p>Mide como máximo 1,57 m. La curva de la pala es libre.</p></div>
        <div class="mt-tarj"><div class="ic">${IC.patin}</div><b>Los patines</b><p>En línea, de tres o cuatro ruedas. Los porteros pueden llevar cinco, más pequeñas.</p></div>
        <div class="mt-tarj"><div class="ic">${IC.casco}</div><b>Las protecciones</b><p>Casco, guantes, coderas, espinilleras y protección de la cara. Los menores de 19 años la llevan completa; los mayores, al menos una visera.</p></div>
      </div>`);
    // goles: ¿vale o no vale? (se toca para ver la respuesta)
    const quiz = [['El disco rebota sin querer en el patín de un atacante y entra.', true, 'Vale. Lo que no vale es empujarlo a propósito con el patín.'],
      ['Un atacante lo mete de una patada.', false, 'No vale. Dar patadas al disco está permitido en toda la pista, pero no para marcar.'],
      ['Un defensor lo mete en su propia portería.', true, 'Vale, y se le da al último atacante que tocó el disco, sin asistencia.'],
      ['Entra tras golpearlo con el stick por encima del larguero.', false, 'No vale. Con el stick por encima del larguero, el gol se anula.'],
      ['Rebota en el árbitro y entra.', false, 'No vale.'],
      ['Un atacante choca con el portero dentro de su área y el disco entra.', false, 'No vale, y el atacante recibe un castigo.']];
    const s5 = sec('goles', '05', 'LOS GOLES', 'Cuándo vale un gol', `
      ${P('Un gol vale cuando el disco cruza entero la línea de gol, impulsado con el stick. Cada gol lleva como máximo una asistencia, la del último pase. Toca cada jugada para ver si vale:')}
      <div class="nv-quiz">${quiz.map(([q, ok, x]) => `<details class="nv-q"><summary><span>${q}</span><i aria-hidden="true">?</i></summary><div class="${ok ? 'si' : 'no'}"><b>${ok ? 'GOL' : 'NO VALE'}</b><span>${x}</span></div></details>`).join('')}</div>`);
    // faltas y castigos
    const cast = [['1\'30\'\'', 'Menor', 'El jugador va al banquillo de castigados y su equipo juega con uno menos. Si el rival marca, vuelve antes.', 90, 'r'],
      ['1\'30\'\' + 1\'30\'\'', 'Doble menor', 'Por pinchar con la punta de la pala o golpear con el extremo del mango. Si el rival marca, se acaba la primera y empieza la segunda.', 180, 'r'],
      ['4\'', 'Mayor', 'Uno menos durante 4 minutos, aunque el rival marque.', 240, 'r'],
      ['10\'', 'Mala conducta', 'El jugador sale 10 minutos, pero entra un compañero: el equipo no se queda con uno menos.', 600, 'g'],
      ['Fuera', 'Al vestuario', 'Se acaba su partido y se pierde el siguiente. Si va con una mayor, su equipo cumple 4 minutos con uno menos.', 0, 'n']];
    const faltas = [['Zancadilla', 'Hacer caer al rival con el stick o la pierna.'], ['Stick alto', 'Levantar el stick por encima del hombro.'], ['Golpear con el stick', 'Dar al rival con el stick.'],
      ['Enganchar', 'Frenar al rival con la pala del stick.'], ['Agarrar', 'Sujetarle con la mano o el brazo.'], ['Interferencia', 'Bloquear a quien no lleva el disco.'],
      ['Carga contra la valla', 'Empujar al rival contra la valla.'], ['Carga por la espalda', 'Empujar por detrás. Se castiga con mayor y vestuario.'], ['Demasiados jugadores', 'Entrar al cambio antes de que salga el compañero.']];
    const s6 = sec('faltas', '06', 'FALTAS', 'Tipos de castigo', `
      ${P('El contacto al disputar el disco está permitido. Cargar, empujar contra la valla o golpear al rival con el stick es falta. Las faltas se castigan con tiempo fuera de la pista:')}
      <div class="nv-cast">${cast.map(([t, n, x, s, c]) => `<div class="nv-c ${c}"><b class="cifra">${t}</b><div><span class="etq">${n}</span><p>${x}</p></div>${s ? `<i style="--w:${(s / 600 * 100).toFixed(1)}%"></i>` : ''}</div>`).join('')}</div>
      <p class="mt-nota">A la tercera menor, 10 minutos más; a la cuarta, al vestuario. Son las duraciones del reglamento de 2026: en partidos de temporadas anteriores verás menores de 2 minutos y mayores de 5.</p>
      ${'<div class="mt-h">Las faltas más habituales</div>'}
      <div class="nv-faltas">${faltas.map(([n, x]) => `<div><b>${n}</b><span>${x}</span></div>`).join('')}</div>
      ${P('Si el equipo que sufre la falta tiene el disco, el árbitro levanta el brazo y deja seguir. Si marcan en esa jugada, la menor ya no se cumple.')}`);
    // empates y penaltis
    const pts = [['Ganar', 3, 'v'], ['Ganar en los penaltis', 2, 'v'], ['Perder en los penaltis', 1, 'd'], ['Perder', 0, 'd']];
    const s7 = sec('penaltis', '07', 'EMPATES', 'Penaltis y puntos', `
      <div class="mt-dos al">
        <div>${P('Si el partido acaba empatado, en la liga se tiran penaltis en ese momento, sin prórroga:')}
          <ul class="mt-lista">${['Empieza el equipo local y se lanza por turnos.', 'Es a muerte súbita desde el primer lanzamiento: gana el equipo que marca cuando el otro falla.', 'No puede repetir nadie hasta que hayan tirado todos.', 'El penalti se tira desde el centro de la pista: el jugador sale con el disco, solo contra el portero, y tira. Si el portero lo para, no vale el rechace.'].map(x => `<li><i style="color:#FF6B63">·</i><span>${x}</span></li>`).join('')}</ul></div>
        <div class="tarjeta nv-pts"><span class="etq">Puntos en la clasificación</span>${pts.map(([t, n, c]) => `<div><span class="res-l ${c}">${c.toUpperCase()}</span><span>${t}</span><b class="cifra">${n}</b></div>`).join('')}
          <div class="pv-nota">En la web, la <span class="b-pen">B</span> junto al marcador dice quién ganó la tanda: 5<span class="b-pen">B</span>–5.</div></div>
      </div>`);
    // curiosidades
    const cur = [['0', 'fueras de juego', 'No existe el fuera de juego. La única línea es la del centro.'],
      ['🦶', 'goles con el patín', 'Se puede jugar el disco con el patín en toda la pista, pero un gol de patada no vale.'],
      ['✋', 'disco sobre la valla', 'Si el disco se queda quieto encima de la valla, sigue en juego y se puede jugar con la mano.'],
      ['💧', 'toalla y botella', 'El portero tiene su botella y su toalla en la portería: no puede ir al banquillo a beber.'],
      ['5', 'ruedas', 'Los porteros pueden llevar patines de cinco ruedas; el resto, de tres o cuatro.'],
      ['NO', 'hombreras', 'Están prohibidas las hombreras de hockey hielo.'],
      ['1', 'asistencia', 'Cada gol lleva como mucho una asistencia. En el hockey hielo pueden ser dos.'],
      ['🥅', 'portería vacía', 'Se puede cambiar al portero por un jugador más. Si con la portería vacía se comete falta sobre un jugador que va solo hacia ella, se da gol.']];
    const s8 = sec('curioso', '08', 'CURIOSIDADES', 'Normas poco conocidas', `
      <div class="nv-cur">${cur.map(([v, t, x]) => `<div class="nv-cu"><b>${v}</b><span class="etq">${t}</span><p>${x}</p></div>`).join('')}</div>`);
    // categorías 2026/27 por año de nacimiento
    const cats = [['Senior', '2007 y antes', true], ['Júnior', '2008 y 2009'], ['Juvenil', '2010 y 2011'], ['Infantil', '2012 y 2013', true], ['Alevín', '2014 y 2015', true], ['Benjamín', '2016 y 2017'], ['Prebenjamín', '2018 y 2019'], ['Micro', '2020 y 2021']];
    const s9 = sec('categorias', '09', 'CATEGORÍAS', 'Por año de nacimiento', `
      ${P(`Por año de nacimiento, en la temporada ${esc(A.temporada)}. En rojo, en las que tenemos equipo. Hasta juvenil, los equipos pueden ser mixtos.`)}
      <div class="nv-cats">${cats.map(([c, a, mp]) => `<div class="${mp ? 'mp' : ''}"><b>${c}</b><span>${a}</span></div>`).join('')}</div>`);
    // cómo leer la web
    const s10 = sec('web', '10', 'EN ESTA WEB', 'Símbolos y abreviaturas', `
      <div class="nv-faltas">
        <div><b><span class="res-l v">V</span> <span class="res-l d">D</span></b><span>Victoria y derrota. Un partido ganado en los penaltis cuenta como victoria.</span></div>
        <div><b>5<span class="b-pen">B</span>–5</b><span>Empate decidido en los penaltis: la B va con quien ganó la tanda.</span></div>
        <div><b>≈ 12'</b><span>Minuto aproximado en el directo: el acta no publica el reloj.</span></div>
        <div><b>Uno más / uno menos</b><span>Gol marcado con un rival castigado, o con un compañero castigado.</span></div>
        <div><b>PJ · G · A</b><span>Partidos jugados, goles y asistencias.</span></div>
        <div><b>% de paradas</b><span>De cada 100 tiros a puerta que recibe el portero, cuántos para.</span></div>
      </div>
      <a class="como-l" href="#/metodo">Cómo calculamos cada número</a>`);
    const indice = [['pista', 'La pista'], ['equipos', 'Los equipos'], ['tiempo', 'El partido'], ['material', 'El material'], ['goles', 'Goles'], ['faltas', 'Faltas'], ['penaltis', 'Penaltis'], ['curioso', 'Curiosidades'], ['categorias', 'Categorías'], ['web', 'En esta web']];
    return `<div class="mt-hero nv-hero"><div class="lab" style="color:#FF6B63">MADRIDPATINA · HOCKEY LÍNEA</div><h1>¿Nuevo en el hockey línea?</h1>
        <p>Las normas básicas para seguir un partido: la pista, la duración, cuándo vale un gol, los castigos y los penaltis.</p>
        <div class="nv-kpis"><div><b class="cifra">4+1</b><span>jugadores por equipo</span></div><div><b class="cifra">2×25'</b><span>partido senior</span></div><div><b class="cifra">1'30''</b><span>castigo menor</span></div><div><b class="cifra">3</b><span>puntos por victoria</span></div></div></div>
      <nav class="nv-ind" aria-label="Apartados">${indice.map(([id, t]) => `<a href="#/nuevo/${id}">${t}</a>`).join('')}</nav>
      ${s1}${s2}${s3}${s4}${s5}${s6}${s7}${s8}${s9}${s10}
      <p class="mt-nota nv-fuente">Según las Reglas de juego de hockey línea (junio de 2026) y las Bases de la Federación Madrileña de Patinaje para ${esc(A.temporada)}.</p>`;
  }

  function vMetodo() {
    const F = A.fmpe || {}, fac = F.factores || {}, f = k => (fac[k] || {}).f, PJ = F.pj_temporada || 18;
    const fx = (x, n) => x.toFixed(n).replace('.', ','), d2 = x => fx(x, 2), d1 = x => fx(x, 1);
    const P = x => `<p class="mt-p">${x}</p>`, H = t => `<div class="mt-h">${t}</div>`;
    const lista = (xs, marca = '·', color = '#FF6B63') => `<ul class="mt-lista">${xs.map(x => `<li><i style="color:${color}">${marca}</i><span>${x}</span></li>`).join('')}</ul>`;
    const sec = (id, n, k, t, lead, cuerpo) => `<section id="m-${id}" class="mt-sec" data-anim="mpUp .45s cubic-bezier(.2,.8,.2,1)">
        <div class="mt-cab"><span class="n">${n}</span><div><div class="k">${k}</div><h2>${t}</h2></div></div><p class="mt-lead">${lead}</p>${cuerpo}</section>`;
    const td = (x, cl = '') => `<td${cl ? ` class="${cl}"` : ''}>${x}</td>`;
    const tabla = (cab, filas) => `<div class="mt-tabla"><table><thead><tr>${cab.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>`;

    // 1 · los datos
    const datos = sec('datos', '01', 'LOS DATOS', 'De dónde salen', 'Todos los resultados, goles, asistencias, sanciones y paradas salen de las actas de la Federación Madrileña de Patinaje (FMP), desde la temporada 2016/17. La web se actualiza cada noche y, mientras se juega, el directo va leyendo el acta del partido.', `
      <div class="mt-dos">
        <div class="mt-caja"><h3 style="color:#3DD27E">LO QUE TRAE EL ACTA</h3>${lista(['Quién marca y quién asiste (una asistencia por gol)', 'Las expulsiones, con su minuto y su duración', 'Tiempos muertos y cambios de portero', 'De cada portero, los tiros que recibe y los goles que encaja'], '✓', '#3DD27E')}</div>
        <div class="mt-caja"><h3 style="color:#FF6B63">LO QUE NO TRAE</h3>${lista(['Minutos jugados', 'Quién estaba en pista en cada gol', 'Los tiros de cada jugador'], '✕')}<p class="mt-nota">Los minutos no los publicamos. Quién estaba en pista y los tiros de cada jugador solo salen en los partidos en los que los apunta nuestro delegado desde el banquillo o los marcamos viendo el vídeo.</p></div>
      </div>
      ${lista(['De los menores de edad, y de quien no sabemos la fecha de nacimiento, no publicamos ni foto ni edad.'])}`);

    // 2 · FMPe
    const barras = ['S1', 'S2', 'S3', 'S4'].filter(k => fac[k]).map(k => { const x = fac[k], w = Math.min(100, x.f * 100);
      return `<div class="mt-barra"><div class="lg">Senior ${k[1]}<small>${x.provisional ? 'provisional' : k === 'S1' ? 'referencia' : d2(x.p10) + ' – ' + d2(x.p90)}</small></div>
        <div class="tr"><i class="f${k === 'S1' ? ' ref' : x.provisional ? ' prov' : ''}" style="width:${w}%" data-anim="mpWipe .7s cubic-bezier(.2,.8,.2,1)"></i>${!x.provisional && k !== 'S1' ? `<i class="rg" style="left:${x.p10 * 100}%;width:${(x.p90 - x.p10) * 100}%"></i>` : ''}</div>
        <div class="v">${d2(x.f)}${x.provisional ? '*' : ''}</div></div>`; }).join('');
    const cambio = ['S1', 'S2', 'S3'].filter(k => fac[k]).map(k => `<div><b>${k === 'S1' ? '10' : d1(10 / f(k))}</b><span>en Senior ${k[1]}</span></div>`).join('');
    const dir = Object.entries(F.parejas || {}).sort((a, b) => b[1].n - a[1].n).flatMap(([, v]) => Object.entries(v.dir).map(([d, x]) =>
      `<tr>${td(d.replace(/S(\d)/g, 'Senior $1').replace('→', ' → '))}${td(x.n, 'n')}${td(d2(x.ppg_antes) + ' → ' + d2(x.ppg_despues), 'n')}</tr>`));
    const f2 = f('S2'), ppg = 47 / 18;
    const fmpe = sec('fmpe', '02', 'FMPe', 'Los puntos de cada liga, en la misma escala', 'El FMPe pasa los puntos (goles + asistencias) de cualquier liga senior a puntos de Liga Senior 1. Sirve para comparar a jugadores de ligas distintas. La NHL, la liga norteamericana de hockey sobre hielo, usa la misma idea para comparar ligas.', `
      <div class="mt-formula"><div class="eq">FMPe =</div><div class="c"><b>Puntos ÷ PJ</b><span>sus puntos por partido en su liga</span></div><div class="op">×</div>
        <div class="c r"><b>Factor de liga</b><span>cuánto vale un punto de su liga en Senior 1</span></div><div class="op">×</div><div class="c"><b>${PJ}</b><span>partidos de una temporada de Senior 1</span></div></div>
      ${barras ? H('Factor de cada liga') + `<div class="mt-barras">${barras}</div><div class="mt-leyenda"><span><i class="l1"></i>factor</span><span><i class="l2"></i>margen: si repetimos la cuenta con otros jugadores sacados al azar, 8 de cada 10 veces el factor cae en esta franja</span></div>` : ''}
      ${cambio ? `<div class="mt-k">10 puntos de Senior 1 equivalen a…</div><div class="mt-cambio">${cambio}</div>` : ''}
      ${fac.S4 && fac.S4.provisional ? `<p class="mt-nota">* Senior 4 empezó en 2026/27 y todavía no hay suficientes jugadores que hayan jugado en ella y en otra liga. Hasta entonces se usa el factor de la antigua Senior 3, que reunía a los equipos de las dos. Se recalculará cuando haya datos.</p>` : ''}
      ${H('Cómo se calculan los factores')}
      ${P(`Con los jugadores de campo que han jugado en dos ligas senior, de una temporada a la siguiente o en la misma temporada. Como es la misma persona, la diferencia entre sus puntos por partido en una liga y en otra nos dice cuánto más difícil es cada una. Usamos <b>${F.casos || '—'} cambios de liga de ${F.jugadores || '—'} jugadores de campo</b>, de ${F.desde || '—'} a ${F.hasta || '—'}. Hacen falta 6 partidos en cada liga, o 3 si las dos son de la misma temporada.`)}
      ${P('Calculamos por separado a los que suben de liga y a los que bajan, y hacemos la media de los dos casos. Quien sube suele estar mejorando y quien baja, empeorando; con la media se compensa.')}
      ${dir.length ? tabla(['Cambio de liga', 'Casos', 'Puntos por partido, antes → después'], dir) : ''}
      ${f2 ? H('Un ejemplo') + `<p class="mt-p">Un jugador de Senior 2 con 29 goles y 18 asistencias: 47 puntos en 18 partidos.</p>
        <div class="mt-pasos"><div class="mt-paso"><div class="t"><b>Puntos por partido en su liga</b><small>47 ÷ 18</small></div><div class="r">${d2(ppg)}</div></div>
          <div class="mt-paso"><div class="t"><b>Pasados a Senior 1</b><small>${d2(ppg)} × ${fx(f2, 3)}</small></div><div class="r">${fx(ppg * f2, 3)}</div></div>
          <div class="mt-paso fin"><div class="t"><b>Una temporada de Senior 1</b><small>${fx(ppg * f2, 3)} × ${PJ}</small></div><div class="r">${d1(ppg * f2 * PJ)}<small>FMPe</small></div></div></div>` : ''}
      <div class="mt-dos">
        <div class="mt-caja"><h3 style="color:#3DD27E">DÓNDE SALE</h3>${lista(['En el mapa de cada liga y en «Comparar» de la ficha, para juntar puntos de ligas senior distintas', 'En la pretemporada: la fuerza de cada plantilla y «A vigilar»', 'En la presentación del directo, para elegir a los rivales peligrosos'], '→', '#3DD27E')}</div>
        <div class="mt-caja"><h3 style="color:#FF6B63">LÍMITES</h3>${lista(['No mide la defensa ni nada que no esté en el acta', 'Con pocos partidos, el dato es poco fiable', 'No se calcula para porteros'], '!')}</div>
      </div>`);

    // 3 · pretemporada
    const tarj = (ic, t, x) => `<div class="mt-tarj"><div class="ic">${ic}</div><b>${t}</b><p>${x}</p></div>`;
    const pre = sec('pretemporada', '03', 'PRETEMPORADA', 'Cómo llega cada equipo', 'Antes de empezar la temporada, con lo que hizo cada jugador la temporada pasada y el equipo en el que juega este año.', `
      <div class="mt-tarjetas">
        ${tarj('▮▮▯', '¿Quién tiene más plantilla?', 'Sumamos los puntos que hicieron la temporada pasada los jugadores de cada equipo, pasados al nivel de esta liga con el FMPe. De los que siguen contamos lo que hicieron con el equipo; de los que llegan, toda su temporada pasada (o la anterior, si no jugaron). Los del año pasado que todavía no han jugado esta temporada cuentan la mitad: es la parte rayada de la barra. Es una estimación: no sabe quién jugará cada partido.')}
        ${tarj('⚠', 'A vigilar', 'Los 5 jugadores rivales de la liga con más puntos por partido. La temporada pasada cuenta entera y la anterior, a la mitad, con los puntos pasados al nivel de esta liga con el FMPe. Hacen falta 4 partidos entre las dos temporadas.')}
        ${tarj('%', 'Porteros', 'Los 5 con mejor % de paradas: de cada 100 tiros que reciben, cuántos paran. La temporada pasada cuenta entera y la anterior, a la mitad. Hacen falta unos 150 tiros, más o menos cinco partidos.')}
        ${tarj('↻', 'Quién sigue, quién llega y quién se va', 'En nuestros equipos, cuántos jugadores de este año ya estaban la temporada pasada, cuántos llegan y cuántos se han ido a otro equipo. Arriba, qué equipos han subido o bajado de liga.')}
      </div>`);

    // 4 · en directo
    const pista = `<div class="mt-pista" aria-hidden="true"><div class="eq"><span>4</span>${'<i class="r"></i>'.repeat(4)}</div><div class="vs">contra</div><div class="eq"><span>3</span>${'<i></i>'.repeat(3)}<i class="fuera"></i></div><div class="crono">2:00</div></div>`;
    const hito = (t, x) => `<div class="mt-hito"><span class="dv-hito">${t}</span><span>${x}</span></div>`;
    const directo = sec('directo', '04', 'EN DIRECTO', 'Qué marca el directo', 'Durante el partido, y después en su resumen, el minuto a minuto indica en qué situación se marcó cada gol, sus hitos y los rivales con más puntos.', `
      ${H('Superioridad e inferioridad')}
      <div class="mt-dos al"><div>${pista}</div><div>${lista(['Las expulsiones de menos de 10 minutos (1\'30\'\', 2, 4 o 5) dejan al equipo con uno menos. Las de 10 no, porque entra otro jugador.', 'Si coinciden dos, se suman.', 'La de 2 minutos o menos se acaba si marca el que está con uno más.', 'Si no ha acabado al descanso, sigue en la segunda parte.', '«Portería vacía», cuando el acta apunta que sale el portero y no entra otro.', 'El acta no publica el reloj. El minuto con «≈» lo estimamos con el último apunte del acta y puede ir uno o dos minutos desviado.'])}</div></div>
      ${H('Hitos de cada gol')}
      <div class="mt-hitos">
        ${hito('SU PRIMER GOL', 'El primero que tenemos de esa persona en la FMP, desde 2016/17.')}
        ${hito('1.er GOL DE LA TEMPORADA', 'El primero de esa persona esta temporada, en cualquier categoría.')}
        ${hito('HAT TRICK', 'El tercer gol de la misma persona en el partido. Con el cuarto, <span class="dv-hito">PÓKER</span>, y con el quinto, <span class="dv-hito">MANITA</span>.')}
        ${hito('SUPERA SU MEDIA', 'Cuando marca su segundo gol o más y ya lleva al menos el doble de lo que marca de media por partido. La media cuenta la temporada pasada y esta hasta el día anterior, y hacen falta 5 partidos. Lo mismo con las asistencias.')}
      </div>
      <p class="mt-nota">Salen en el minuto a minuto, en la escena de cada gol y en la pantalla final del resumen. Si no tenemos datos recientes del jugador, no se dice nada de su historial.</p>
      ${H('Rivales peligrosos en la presentación')}
      <div class="mt-dos al"><div class="mt-riv" aria-hidden="true"><div class="j"><b>22</b><span>Rival 1<small>PELIGRO · 1,15 puntos por partido en ${tempAnt()}</small></span></div><div class="j otro"><b>7</b><span>Rival 2</span></div><div class="j"><b>4</b><span>Rival 3<small>PELIGRO · 0,93 puntos por partido en ${tempAnt()}</small></span></div></div>
        <div>${P('Marcamos a los 3 jugadores del rival con más puntos por partido, si pasan de 0,4. Contamos esta temporada hasta el partido y la pasada, y hacen falta 4 partidos entre las dos (o 2 de esta). En senior juntamos todas las ligas senior y pasamos los puntos al nivel de la liga del partido con el FMPe. Al lado ponemos sus números de verdad, sin ajustar.')}</div></div>
      ${H('El resumen de un partido')}
      ${P('Vuelve a jugar el partido en unos segundos con los minutos del acta. Si tenemos los tiros minuto a minuto, el % de paradas de cada portero cambia con cada tiro; si no, sale al final, con el acta.')}
      ${H('Tiros a puerta minuto a minuto')}
      ${P('Durante el partido, el acta digital va subiendo los tiros que recibe cada portero cada uno o dos minutos. Desde octubre de 2026 los guardamos cada minuto y en la página del partido dibujamos los tiros de cada equipo. Como el acta no publica el reloj, el minuto lo estimamos con la hora de cada apunte (los goles, las faltas y los tiempos muertos sí llevan minuto), así que puede ir uno o dos minutos desviado. Si el acta deja de subir tiros un rato y luego los apunta de golpe, ese tramo sale en discontinuo.')}
      ${H('La afición y el banquillo')}
      ${lista(['<b>La grada</b>: en el vídeo de cada partido, cualquiera puede mandar emojis (aplauso, fuego, sorpresa, ánimo, corazón). Se cuentan todos.', '<b>El mejor del partido</b>: en nuestros partidos se vota a un jugador nuestro hasta 7 días después. Un voto por móvil.', '<b>En pista</b>: en nuestros partidos, el delegado apunta desde el banquillo quién estaba en pista en cada gol, o lo marcamos después viendo el vídeo. Con eso sale en la ficha «En pista en los goles»: los goles de su equipo y los que encajó mientras jugaba. En los partidos con vídeo también marcamos desde dónde fue cada gol y, a veces, cada tiro (gol, parada, fuera o bloqueado).'])}`);

    // 5 · ficha del jugador
    const ficha = sec('ficha', '05', 'FICHA DEL JUGADOR', 'Con el equipo', 'En la ficha de cada jugador nuestro, su peso en los goles del equipo. Sale la temporada más reciente en la que lleva 5 partidos o más.', `
      <div class="mt-dos al">
        <div class="mt-ficha" aria-hidden="true"><div class="cab"><span class="t">${tempAnt()}</span><span class="p">43,5%</span><span class="x">de los goles del equipo pasan por él (47 de 108, en 18 PJ)</span></div>
          <div><span class="k">Sus goles:</span> 27 en igualdad · 1 en superioridad · 1 en inferioridad</div><div><span class="k">Le dan el pase:</span> un compañero <span class="g">5</span></div><div class="pie">Ejemplo</div></div>
        <div>${lista(['<b>Participación</b>: de los goles que marcó su equipo en los partidos que jugó, en cuántos marcó o dio el pase.', '<b>Sus goles, según cómo estábamos en pista</b>: cuántos marcó en igualdad, con uno más y con uno menos, contados como en el directo.', '<b>Le dan el pase / Se la da a</b>: los dos compañeros con los que más goles ha hecho (dos o más).', '<b>Penaltis y sanciones</b>: los penaltis que ha marcado en las tandas y las faltas que más le pitan con el club.'])}</div>
      </div>`);

    // 6 · mapa de jugadores y «comparar»
    const mapaM = sec('mapa', '06', 'MAPA Y ARQUETIPOS', 'Dónde está cada jugador de la liga', 'En cada liga, un mapa con todos los jugadores de campo: hacia la derecha, más puntos por partido; hacia arriba, más parte de sus puntos son goles. Los nuestros, en rojo.', `
      ${lista(['<b>Puntos por partido</b>: goles más asistencias, entre partidos jugados. En el mapa van en la escala de esa liga; si juntamos partidos de otra liga senior de la temporada pasada, los pasamos a esta escala con el FMPe.', '<b>Parte de goles</b>: de sus puntos, cuántos son goles. El resto son asistencias.', '<b>Qué partidos cuentan</b>: los de esta temporada en esa liga y, hasta que el jugador lleva 6, también los de la temporada pasada (en la cantera, solo los de la misma categoría, porque muchos juegan en Alevín e Infantil). Hacen falta 3 partidos en total para salir.', '<b>Porteros</b>: no salen en el mapa. Para su arquetipo usamos el % de paradas y los tiros que reciben por partido (hacen falta 3 partidos y 40 tiros).'])}
      ${H('Zonas')}
      ${lista(['<b>Referentes</b>: el 15 % de la liga con más puntos por partido.', '<b>Goleadores</b> y <b>Pasadores</b>: del resto, los que están por encima de la mitad de la liga en puntos por partido. Goleadores si su parte de goles es mayor que la de la mitad de la liga; pasadores si es menor.', '<b>Apoyo</b>: los que están por debajo de la mitad de la liga en puntos por partido.'])}
      ${H('Arquetipos')}
      ${P('Los mismos datos dan a cada jugador un arquetipo, comparándolo con los jugadores de su liga. Se mira en este orden y se queda con el primero que cumple:')}
      ${lista(['<b>Sniper</b> (el francotirador): está en el 15 % de su liga con más goles por partido y marca más que asiste.', '<b>Playmaker</b> (el cerebro): está en el 15 % con más asistencias por partido y asiste al menos tanto como marca.', '<b>Momentum</b> (el motor): está en el 15 % con más puntos por partido.', '<b>Wildcard</b> (el espectáculo): marca más que la mitad de su liga y está en el 15 % con más minutos de sanción por partido.', '<b>Ghost</b> (el fugaz): 7 partidos o menos.', '<b>Steady</b> (el consistente): por encima de la mitad de su liga en puntos por partido.', '<b>Wall</b> (el ancla): 12 partidos o más, en la cuarta parte de su liga con menos puntos y casi sin sanción.', '<b>Workhorse</b> (el currante): el resto.'])}
      ${P('Porteros, comparados con los de su liga, en este orden: <b>Shadow</b> (4 partidos o menos), <b>Iron Curtain</b> (el 25 % con mejor % de paradas), <b>Reactive Wall</b> (el 25 % que más tiros recibe y para más que la mitad), <b>Embattled</b> (el 25 % que más tiros recibe), <b>Undershot</b> (el 25 % que menos tiros recibe) y <b>Workhorse</b> (10 partidos o más). Quien no encaja en ninguno queda como Shadow.')}
      ${H('Comparar')}
      ${P('En la pestaña «Comparar» de la ficha salen los 3 jugadores de su liga, de cualquier equipo, con los números más parecidos en puntos por partido y en la parte de sus puntos que son goles. Solo cuentan los que llevan 5 partidos o más. A los porteros los comparamos con los porteros de su liga por el % de paradas. Debajo se puede elegir a cualquier otro jugador y ver sus números al lado.')}
      <div class="mt-caja"><h3 style="color:#FF6B63">LÍMITES</h3>${lista(['No mide la defensa ni nada que no esté en el acta', 'Con pocos partidos, el punto de cada jugador se mueve mucho', 'En la cantera no hay factor entre ligas: los números van tal cual'], '!')}</div>`);

    // 7 · probabilidades, pronósticos y análisis del equipo
    if (!ANA) cargarAnalisis().then(d => { if (d && /^#\/metodo/.test(location.hash)) render(); });
    const T7 = ANA && ANA.prob && ANA.prob.senior, trio = (d, q) => { const r = T7.tabla[d][q], g = Math.round(r[0] * 100), e = Math.round(r[1] * 100); return [g, e, Math.max(0, 100 - g - e)]; },
      cel = (d, q) => { const [g, e, p] = trio(d, q); return `<b>${g}</b> de 100<small>${e} empata · ${p} pierde</small>`; };
    const probM = sec('probabilidad', '07', 'PRONÓSTICOS Y ANÁLISIS', 'Qué pasa normalmente con cada marcador', 'Con todos los partidos de la FMP desde 2016/17 sabemos cuántas veces acaba ganando el que va por delante, según los goles de ventaja y los minutos que quedan. Con eso dibujamos las opciones de ganar de cada partido y del directo.', `
      ${T7 ? H('Senior: si vas ganando, ¿cuántas veces acabas ganando?') + P(`Cada casilla cuenta, de cada 100 partidos en los que un equipo iba ganando por esos goles cuando quedaban esos minutos, cuántos acabó ganando. Debajo, cuántos acabaron en empate (y se decidieron en los penaltis) y cuántos acabó perdiendo. Por ejemplo, con un gol de ventaja y 5 minutos por jugar, el que va ganando gana ${trio(1, 5)[0]} de cada 100, empata ${trio(1, 5)[1]} y pierde ${trio(1, 5)[2]}.`) + tabla(['Va ganando por', 'Quedan 10 min', 'Quedan 5 min', 'Quedan 2 min'], [1, 2, 3].map(d => `<tr>${td(d + (d === 1 ? ' gol' : ' goles'))}${td(cel(d, 10), 'n')}${td(cel(d, 5), 'n')}${td(cel(d, 2), 'n')}</tr>`)) + `<p class="mt-nota">Con ${T7.partidos} partidos senior completos (con el minuto de todos los goles). La cantera tiene su propia tabla, con partes de 20 minutos.</p>` : ''}
      ${lista(['<b>Opciones de ganar, minuto a minuto</b>: en la página de cada partido, nuestras opciones en cada minuto según el marcador y lo que queda. Un empate cuenta como medio, porque se decide en los penaltis. En un derbi, las del equipo de casa. Solo mira el marcador y el reloj: no sabe quién juega ni cuenta jugar en casa.', '<b>Opciones de ganar en el directo</b>: lo mismo, con el minuto estimado del directo.', '<b>Pronóstico de cada partido</b>: de cada 10 veces, cuántas gana cada equipo, cuántas se va a los penaltis y el marcador más probable. Sale de los goles que marca y encaja cada equipo esta temporada. Para que un resultado suelto no pese de más al principio, a cada equipo le sumamos 8 partidos con la media de la liga. No cuenta jugar en casa. Se recalcula hasta la víspera y el día del partido queda fijo.', '<b>¿Acertamos?</b>: en cada liga, cuántas veces ganó el que tenía más opciones en nuestro pronóstico. Solo cuentan los pronósticos guardados antes del día del partido, y los penaltis cuentan para quien ganó la tanda. «Sorpresa» es cuando pierde un favorito que pasaba del 55 %. También miramos si los porcentajes se cumplen (de los partidos que dimos a más del 60 %, cuántos se ganaron) y si acertamos más que dar por ganador al que iba por delante en la clasificación.'])}
      ${H('Antes de cada partido')}
      ${lista(['<b>Nosotros frente a ellos</b>: compara, por partido y esta temporada, goles a favor y en contra, tiros, % de paradas y minutos de sanción.', '<b>Cara a cara</b>: todos los partidos entre los dos con el club, con los decididos en los penaltis aparte.', '<b>A vigilar</b>: sus 3 jugadores con más puntos por partido (los del mapa) y su portero con más partidos.'])}
      ${H('Cómo juega cada equipo')}
      ${lista(['<b>Cuándo marca y cuándo encaja</b>: los goles de cada tramo de 5 minutos, con el minuto del acta. Si al acta le falta el minuto de algún gol, ese partido no entra.', '<b>Marcador</b>: cuántos partidos gana cuando marca primero y cuando encaja primero, las remontadas (ganar yendo por detrás) y las ventajas que se escaparon (ir por delante y no ganar en el tiempo de juego; un empate ganado en los penaltis cuenta como no ganado).', '<b>Tiros</b>: tiros a favor y en contra por partido. El acta solo apunta los que recibe cada portero, así que sabemos los tiros de cada equipo pero no quién tira. Acierto: de cada 100 tiros, cuántos son gol.', '<b>Disciplina</b>: faltas, minutos de sanción por partido y las faltas que más nos pitan.', '<b>Asistencias</b>: quién da más pases de gol en el equipo esta temporada.', '<b>Jugadores clave</b>: los 4 de la plantilla con más puntos con ese equipo esta temporada, sin porteros. Si nadie ha marcado todavía, los de la temporada pasada.'])}
      ${H('Hitos a la vista y agenda')}
      ${lista(['<b>Hitos a la vista</b>: a quién le faltan como mucho 3 goles, 3 asistencias, 2 partidos o 40 paradas para una cifra redonda con el club, contando todas sus temporadas. Goles y asistencias: 10, 25, 50, 75, 100, 150…; partidos: 25, 50, 100, 150…; paradas: 100, 250, 500…', '<b>Lo mejor de la semana</b>: lo más destacado de nuestros partidos de la semana. Para el portero o la portera de la semana, el mejor % de paradas en un partido, con 10 tiros o más.', '<b>Pista de cada partido</b>: la que pone el calendario de la FMP.', '<b>Calendarios para el móvil</b>: los mismos partidos, en un enlace que Google Calendar, el iPhone u Outlook vuelven a leer cada pocas horas.'])}
      <div class="mt-caja"><h3 style="color:#FF6B63">LÍMITES</h3>${lista(['Las opciones de ganar dicen lo que pasó otras veces con ese marcador; el pronóstico, lo que sale con los goles de esta temporada. Ninguno es seguro', 'No saben de bajas, lesiones ni fichajes', 'Con pocos partidos jugados, los números de cada equipo se mueven mucho'], '!')}</div>`);

    const indice = [['datos', '01', 'Los datos', 'De dónde sale cada número'], ['fmpe', '02', 'FMPe', 'Los puntos de cada liga, en la misma escala'],
      ['pretemporada', '03', 'Pretemporada', 'Fuerza de cada plantilla, a quién vigilar y porteros'], ['directo', '04', 'En directo', 'Avisos del directo, hitos y rivales peligrosos'],
      ['ficha', '05', 'Ficha del jugador', 'Su parte en los goles del equipo y con quién combina'], ['mapa', '06', 'Mapa y arquetipos', 'Dónde está cada uno, su arquetipo y con quién se compara'],
      ['probabilidad', '07', 'Pronósticos y análisis', 'Pronósticos, opciones de ganar y cómo juega cada equipo']]
      .map(([id, n, t, x]) => `<a class="blk" href="#/metodo/${id}"><span class="n">${n}</span><b>${t}</b><span class="x">${x}</span></a>`).join('');
    return `<div class="mt-hero"><div class="lab" style="color:#FF6B63">MADRIDPATINA · MÉTODO</div><h1>Cómo lo calculamos</h1>
        <p>Qué mide cada número de la web y cómo lo calculamos. Casi todo sale de las actas de la Federación Madrileña de Patinaje; lo que no, lo decimos en su sitio.</p>
        <a class="como-l" href="#/nuevo">¿Nuevo en el hockey línea? Lo básico para seguir un partido</a>
        <div class="mt-corto"><span class="etq">En pocas palabras</span>${lista(['Los números salen de las actas de la federación, desde 2016/17, y la web se actualiza cada noche.', 'El FMPe pone los puntos de todas las ligas senior en la misma escala, para poder compararlos.', 'Las opciones de ganar salen de lo que pasó otras veces con el mismo marcador; los pronósticos, de los goles de esta temporada.', 'Nada de esto sabe de bajas, lesiones ni de cómo llega cada uno ese día.'])}</div></div>
      <nav class="mt-indice" aria-label="Apartados">${indice}</nav>
      ${datos}${fmpe}${pre}${directo}${ficha}${mapaM}${probM}`;
  }

  /* ── 7. Histórico ───────────────────────────────────────── */
  function prepH(Hx) {
    const st = s => (s || '').replace(/^Temporada\s+/i, '');
    const tc = s => (s || '').toLowerCase().replace(/(^|[\s\-])(\S)/g, (m, a, b) => a + b.toUpperCase());
    const tok = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z]+/).filter(Boolean).sort().join(' ');
    Hx.temporadas = Hx.temporadas.map(st);
    Hx.partidos.forEach(p => { p.temporada = st(p.temporada); });
    Hx.clasificaciones.forEach(c => { c.temporada = st(c.temporada); });
    Hx.byTok = {};
    Hx.jugadores.forEach(j => {
      const k = tok(j.nombre); j.temporadas.forEach(t => { t.temporada = st(t.temporada); });
      const m = Hx.byTok[k];
      if (m) { m.temporadas = m.temporadas.concat(j.temporadas); m.mejor = (m.mejor || []).concat(j.mejor || []); m.ahora = (m.ahora || []).concat(j.ahora || []); m.foto = m.foto || j.foto;
        m.adulto = m.adulto === true || j.adulto === true ? true : m.adulto === false && j.adulto === false ? false : (m.adulto ?? j.adulto); const acc = x => (x.match(/[áéíóúÁÉÍÓÚ]/g) || []).length; if (acc(j.nombre) > acc(m.nombreRaw)) { m.nombreRaw = j.nombre; m.nombre = tc(j.nombre); } }
      else Hx.byTok[k] = { tok: k, nombreRaw: j.nombre, nombre: tc(j.nombre), temporadas: j.temporadas.slice(), adulto: j.adulto, ahora: (j.ahora || []).slice(), foto: j.foto, mejor: (j.mejor || []).slice() };
    });
    Hx.jugadores = Object.values(Hx.byTok).map(j => Object.assign(j, { carrera: { pj: j.temporadas.reduce((s, t) => s + t.pj, 0), g: j.temporadas.reduce((s, t) => s + t.g, 0), a: j.temporadas.reduce((s, t) => s + t.a, 0), pim: j.temporadas.reduce((s, t) => s + (t.pim || 0), 0), hattricks: j.temporadas.reduce((s, t) => s + (t.hattricks || 0), 0), temporadas: new Set(j.temporadas.map(t => t.temporada)).size } }))
      .sort((a, b) => b.carrera.g - a.carrera.g || b.carrera.a - a.carrera.a);
    Hx.tok = tok;
    return Hx;
  }

  // Logros del legado: títulos y podios de los equipos, e hitos de los jugadores (el histórico más la temporada en curso,
  // como en la ficha de cada jugador)
  function logros(lbl) {
    const liga = l => titulo((l || '').replace(/^(LIGA|TORNEO)\s+/i, ''));
    const curK = {}, ya = {}; Object.values(A.jugadores).forEach(x => { const tk = H.tok(x.nombre + ' ' + x.apellidos), y = x.temporadas[A.temporada]; curK[tk] = x.k;
      if (y && y.pj) ya[tk] = { pj: y.pj, g: y.goles || 0, a: y.asistencias || 0, ht: (x.partidos || []).filter(m => (m.g || 0) >= 3).length }; });
    const carr = j => { const c = j.carrera, y = ya[j.tok]; return y ? Object.assign({}, c, { pj: c.pj + y.pj, g: c.g + y.g, a: c.a + y.a, hattricks: (c.hattricks || 0) + y.ht, temporadas: c.temporadas + 1 }) : c; };
    // solo grupos que deciden el título: fuera los de permanencia/descenso y los grupos bajos de una fase final
    const decide = c => { const g = (c.grupo || '') + ' ' + (c.liga || '');
      return !/DESCENSO|PERMANENCIA/i.test(g) && !/split_(mid|bottom)/.test(c.fase || '')
        && !(/FASE FINAL|FASE 2/i.test(g) && /(GRUPO|GR)\s*([2-9]|[B-Z])\b|\([2-9]\)/i.test(g)); };
    const podio = H.clasificaciones.filter(c => c.puesto && c.puesto <= 3 && decide(c))
      .sort((a, b) => a.puesto - b.puesto || (a.temporada < b.temporada ? 1 : -1));
    const hitos = [
      ['100', 'GOLES CON EL CLUB', j => carr(j).g >= 100, j => carr(j).g, ' G'],
      ['100', 'PARTIDOS CON EL CLUB', j => carr(j).pj >= 100, j => carr(j).pj, ' PJ'],
      ['50', 'ASISTENCIAS CON EL CLUB', j => carr(j).a >= 50, j => carr(j).a, ' A'],
      ['3', 'GOLES EN UN PARTIDO · HAT TRICKS', j => carr(j).hattricks > 0, j => carr(j).hattricks, ''],
      ['7', 'TEMPORADAS O MÁS EN EL CLUB', j => carr(j).temporadas >= 7, j => carr(j).temporadas, ' temp.'],
    ].map(([n, k, ok, v, u]) => ({ n, k, who: H.jugadores.filter(ok).sort((a, b) => v(b) - v(a)).slice(0, 6).map(j => ({ j, v: v(j) + (n === '3' ? (v(j) > 1 ? ' veces' : ' vez') : u) })) }))
      .filter(h => h.who.length);
    const medal = pu => `<span style="width:38px;height:38px;flex:none;border-radius:50%;display:grid;place-items:center;${BS}font-weight:900;font-size:20px;background:${pu === 1 ? RED : '#26262A'};color:${pu === 1 ? '#FFFFFF' : '#C9C9CE'};box-shadow:0 0 0 2px ${pu === 1 ? RED : pu === 2 ? '#8A8A8F' : '#55555B'}">${pu}º</span>`;
    const podHtml = podio.length ? `<div class="card" style="padding:18px 20px">
        <div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#FF6B63">TÍTULOS Y PODIOS · ${podio.length}</div>
        ${podio.map(c => `<div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid #26262A">${medal(c.puesto)}
          <div style="min-width:0"><div style="font-weight:700">${c.puesto === 1 ? 'Campeones' : c.puesto === 2 ? 'Subcampeones' : 'Terceros'} · ${esc(lbl(c.equipo, c.liga) === liga(c.liga) ? 'MADRIDPATINA' : lbl(c.equipo, c.liga))}</div>
          <div style="font-size:13px;color:#A6A6AD">${esc(liga(c.liga))}${c.grupo && !/^LIGA/i.test(c.grupo) ? ' · ' + esc(titulo(c.grupo)) : ''} · ${esc(c.temporada)} · ${c.pts} pts</div></div></div>`).join('')}</div>` : '';
    const hitHtml = hitos.map(h => `<div class="card" style="padding:18px 20px;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:baseline;gap:10px"><span style="${BS}font-weight:900;font-size:64px;line-height:.85;color:#FF6B63">${h.n}</span><span style="font-size:14px;font-weight:700;letter-spacing:.1em;color:#A6A6AD">${h.k}</span></div>
        ${h.who.map(({ j, v }) => box(curK[j.tok] ? hP(curK[j.tok]) : null, 'display:flex;justify-content:space-between;gap:10px;width:100%;padding:7px 0;border-bottom:1px solid #26262A', `<span style="font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(j.nombre)}</span><span style="${BS}font-weight:800;font-size:20px;white-space:nowrap">${esc(v)}</span>`)).join('')}</div>`).join('');
    if (!podHtml && !hitHtml) return '';
    return `${lab('LOGROS', 'margin:28px 0 10px')}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:12px;align-items:start">${podHtml}${hitHtml}</div>`;
  }

  /* ── Navegación ─────────────────────────────────────────── */
  const view = $('#view');
  const ICONO = {
    inicio: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z"/>',
    calendario: '<path d="M5.5 4.5h13a2.5 2.5 0 0 1 2.5 2.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18V7a2.5 2.5 0 0 1 2.5-2.5zM8 2.5v4M16 2.5v4M3 10h18"/>',
    equipos: '<path d="M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6l8-3z"/>',
    ligas: '<path d="M5 20v-7M12 20V5M19 20v-10M3 20h18"/>',
    jugadores: '<path d="M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M17.2 6.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM16.5 14.1c2.8.3 5 2.3 5 5.9"/>',
  };
  // a qué sección del menú pertenece cada página (Pretemporada vive en Ligas; el directo y los resúmenes, en Inicio)
  const TOP = { inicio: 'inicio', jornada: 'inicio', calendario: 'calendario', banquillo: 'inicio', directo: 'inicio', equipo: 'equipos', liga: 'ligas', partido: 'ligas', jugadores: 'jugadores', jugador: 'jugadores', historico: 'legado', legado: 'legado', pretemporada: 'ligas', metodo: 'metodo', nuevo: 'metodo', sincronizar: 'inicio', video: 'inicio', apodo: 'inicio', buzon: 'inicio' };
  const TITLES = { inicio: 'Inicio', banquillo: 'Banquillo', directo: 'En directo', jornada: 'Inicio', calendario: 'Calendario', equipo: 'Equipos', liga: 'Ligas', partido: 'Partido', jugadores: 'Jugadores', jugador: 'Jugador', historico: 'Legado', legado: 'Legado', pretemporada: 'Pretemporada', metodo: 'Cómo lo calculamos', nuevo: '¿Nuevo en el hockey línea?', sincronizar: 'Sincronizar vídeo', video: 'Vídeo del partido', apodo: '¿Eres jugador?', buzon: 'Buzón de apodos' };
  // migas: el título de sección se toca para subir un nivel («EQUIPOS / MP A»); la última es la página en la que se está
  const migasHtml = xs => `<nav class="migas" aria-label="Estás en">${xs.map(([t, h], i) => (i ? '<i aria-hidden="true">/</i>' : '') + (h && i < xs.length - 1 ? `<a href="${h}">${esc(t)}</a>` : `<span class="act" aria-current="page">${esc(t)}</span>`)).join('')}</nav>`;
  const mpCorto = e => e.cantera ? (e.id === 'AL' ? 'MP Alevín' : 'MP Infantil') : 'MP ' + e.id;
  function migasDe(v, parts) {
    const ligaM = id => { const L = lgOf(id); return L ? [L.nombre, hLg(L.id)] : null; };
    if (v === 'equipo') { const e = A.equipos.find(x => x.id === parts[1]) || A.equipos[0]; return [['Equipos', hEq(e.id)], [mpCorto(e)]]; }
    if (v === 'liga') {
      const L = lgOf(parts[1]) || A.ligas[0], sub = { evolucion: 'Evolución', mapa: 'Mapa', acertamos: '¿Acertamos?' }[parts[2]], j = parts[2] === 'j' && parts[3];
      return sub || j ? [['Ligas', hLg(L.id)], [L.nombre, hLg(L.id)], [sub || 'Jornada ' + j]] : null;
    }
    if (v === 'partido' && parts.length >= 5) { const L = lgOf(parts[1]), c = L && (L.cal || []).find(x => x.j === +parts[2] && slugEq(x.local) === parts[3] && slugEq(x.visitante) === parts[4]);
      if (c && c.mid && A.partidos[c.mid]) return migasDe('partido', ['partido', c.mid]);
      return L ? [['Ligas', hLg(L.id)], [L.nombre, hLg(L.id)], ['Jornada ' + parts[2], hLg(L.id, 'j/' + parts[2])], ['Previa']] : null; }
    if (v === 'partido') { const m = A.partidos[parts[1]], lm = m && ligaM(m.liga), e = m && (A.equipos.find(x => x.nombre === m.local && x.ligaId === m.liga) || A.equipos.find(x => x.nombre === m.visitante && x.ligaId === m.liga));
      return e ? [['Equipos', hEq(e.id)], [mpCorto(e), hEq(e.id)], ['Jornada ' + m.jornada]] : lm ? [['Ligas', hLg(m.liga)], lm, ['Jornada ' + m.jornada]] : [['Ligas', hLg(S.lg || A.ligas[0].id)], ['Partido']]; }
    if (v === 'pretemporada') return [['Ligas', hLg(S.lg || A.ligas[0].id)], ['Pretemporada']];
    // así fue el partido: «PARTIDO / SENIOR 2 · J3» (Partido sube a la página del partido)
    if (v === 'directo' && RS.m && RS.m.idp === parts[1]) { const m = RS.m, L = lgOf(m.liga), t = ((L ? L.nombre : m.ligaNombre || '').replace(/^Liga /, '') + (m.jornada ? ' · J' + m.jornada : '')).toUpperCase();
      return [m.mid && A.partidos[m.mid] ? ['Partido', hM(m.mid)] : ['Partido'], [t]]; }
    if (v === 'jugador') { const j = A.jugadores[parts[1]], e = j && equiposDe(j)[0]; return [['Jugadores', '#/jugadores']].concat(e ? [[mpCorto(e), '#/jugadores/' + e.id]] : []).concat(j ? [[corto(j, true)]] : []); }
    if (v === 'jugadores' && parts[1]) { const e = A.equipos.find(x => x.id === parts[1]); return e ? [['Jugadores', '#/jugadores'], [mpCorto(e)]] : null; }
    if (v === 'directo') return [['Inicio', '#/'], ['En directo']];
    if (v === 'video') return [['Inicio', '#/'], ['Resumen en vídeo']];
    if (v === 'metodo') return [['Inicio', '#/'], ['Cómo lo calculamos']];
    if (v === 'nuevo') return [['Inicio', '#/'], ['¿Nuevo en el hockey línea?']];
    if (v === 'apodo') return [['Inicio', '#/'], ['Tu apodo']];
    return null;
  }
  let prevRoute = null, navReset = false, goingBack = false;
  // 7a · la píldora roja se desliza desde la sección anterior (y se recoloca si cambia el ancho de la ventana)
  let pilAntes = null, secAntes = null, animarAlCerrar = false;
  function pildora(desliza) {
    const nav = $('#nav'), pil = nav.querySelector('.pildora'), act = nav.querySelector('a[aria-current]');
    if (!pil || !act || !act.offsetWidth) { nav.classList.remove('con-pildora'); pilAntes = null; return; }
    const to = { left: act.offsetLeft + 'px', width: act.offsetWidth + 'px' };
    pil.style.transition = 'none';
    Object.assign(pil.style, desliza && pilAntes ? pilAntes : to);
    void pil.offsetWidth;
    pil.style.transition = '';
    Object.assign(pil.style, to);
    pilAntes = to;
    nav.classList.add('con-pildora');
  }
  window.addEventListener('resize', () => pildora(false));
  function render() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const v = TOP[parts[0]] ? parts[0] : 'inicio';
    // Enlace viejo o mal copiado: a la lista, nunca a la ficha de otra persona ni a otro partido
    if (v === 'jugador' && !A.jugadores[parts[1]]) { history.replaceState(null, '', '#/jugadores'); prevRoute = location.hash; return render(); }
    if (v === 'liga' && parts[2] === 'llega') { history.replaceState(null, '', hPre(parts[1])); prevRoute = location.hash; return render(); }
    if (v === 'partido' && parts.length < 5 && !A.partidos[parts[1]]) { history.replaceState(null, '', '#/'); prevRoute = location.hash; return render(); }
    let rp = null;
    if (v === 'partido' && parts.length >= 5) {
      rp = resolverPartido(parts);
      if (!rp) { history.replaceState(null, '', '#/'); prevRoute = location.hash; return render(); }
      const sn = snapDe({ ligaId: rp.L.id, j: rp.c.j, local: rp.c.local, vis: rp.c.visitante });
      if (!(rp.c.mid && A.partidos[rp.c.mid]) && sn && (sn.estado === 'directo' || sn.estado === 'descanso')) { history.replaceState(null, '', '#/directo/' + encodeURIComponent(sn.idp)); prevRoute = location.hash; return render(); }   // se está jugando: al directo
    }
    if (v === 'directo' && parts[2] === 'resumen' && VID && VID[parts[1]]) { pararResumen(); if (ESC.abierta) ESC.abierta.cerrar(); history.replaceState(null, '', '#/video/' + encodeURIComponent(parts[1])); prevRoute = location.hash; return render(); }
    const mDe = v === 'partido' && (parts.length >= 5 ? (() => { const L = lgOf(parts[1]), c2 = L && (L.cal || []).find(x => x.j === +parts[2] && slugEq(x.local) === parts[3] && slugEq(x.visitante) === parts[4]); return c2 && c2.mid && A.partidos[c2.mid]; })() : A.partidos[parts[1]]);
    const sec = mDe && mDe.nuestro ? 'equipos' : TOP[v];
    const nav = [['inicio', 'Inicio', '#/'], ['calendario', 'Calendario', '#/calendario'], ['equipos', 'Equipos', hEq(S.eq || A.equipos[0].id)], ['ligas', 'Ligas', hLg(S.lg || A.ligas[0].id)], ['jugadores', 'Jugadores', '#/jugadores'], ['legado', 'Legado', '#/legado']];
    $('#nav').innerHTML = '<span class="pildora" aria-hidden="true"></span>' + nav.map(([k, l, h]) => `<a href="${h}" data-nav${sec === k ? ' aria-current="page"' : ''}>${l}</a>`).join('');
    // «?» (Cómo lo calculamos) siempre a mano; en el móvil, Legado va en la cabecera
    $('#ayuda').classList.toggle('on', v === 'metodo');
    if (TOP[v] === 'legado') $('#legado-ic').setAttribute('aria-current', 'page'); else $('#legado-ic').removeAttribute('aria-current');
    // móvil: cinco secciones abajo, con iconos (al alcance del pulgar)
    $('#tabbar').innerHTML = nav.slice(0, 5).map(([k, l, h]) => `<a href="${h}" data-nav${sec === k ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONO[k]}</svg><span>${l}</span></a>`).join('');
    pildora(true);
    if (secAntes && secAntes !== sec) { const ic = $('#tabbar a[aria-current] svg'); if (ic) ic.style.animation = 'mpBounce .45s both'; }
    secAntes = sec;
    let html;
    if (v === 'equipo') html = vEquipo2(parts[1]);
    else if (v === 'liga') html = vLiga2(parts[1], parts[2], parts[2] === 'j' ? parseInt(parts[3], 10) : null);
    else if (v === 'partido') html = rp ? (rp.c.mid && A.partidos[rp.c.mid] ? vPartido2(rp.c.mid) : vPrevia(rp.L, rp.c)) : vPartido2(parts[1]);
    else if (v === 'jugadores') html = vJugadores2(parts[1]);
    else if (v === 'jugador') html = vJugador2(parts[1]);
    else if (v === 'historico' || v === 'legado') html = vLegado2();
    else if (v === 'pretemporada') html = vPretemporada2(parts[1]);
    else if (v === 'directo') html = parts[2] === 'resumen' ? vResumen(parts[1]) : vVivo(parts[1]);   // rediseño final: resumen sin vídeo y directo
    else if (v === 'metodo') html = vMetodo();
    else if (v === 'nuevo') html = vNuevo();
    else if (v === 'sincronizar') html = vSincronizar(parts[1]);
    else if (v === 'banquillo' && !parts[1]) { history.replaceState(null, '', '#/'); return render(); }
    else if (v === 'banquillo') html = vBanquillo(parts[1]);
    else if (v === 'video') html = vVideo(parts[1], parts[2]);
    else if (v === 'calendario') html = vCalendario();
    else if (v === 'apodo') html = vApodo();
    else if (v === 'buzon') html = vBuzon();
    else html = vInicio(parts[0] === 'jornada' || parts[0] === 'inicio' ? parts[1] : null);
    const mg = migasDe(v, parts), back = mg ? migasHtml(mg) : '';
    const pie = `<footer class="pie"><span>MADRIDPATINA · Temporada ${esc(A.temporada)}</span><span><a href="${TELEGRAM}" target="_blank" rel="noopener">Avisos en Telegram</a> · <a href="#/nuevo">¿Nuevo en el hockey línea?</a> · <a href="#/metodo">Cómo lo calculamos</a> · Datos: Federación Madrileña de Patinaje · actualizado ${fdc(A.actualizado).toLowerCase()}</span></footer>`;
    view.innerHTML = back + html + pie;
    if (!VID) cargarVideos().then(() => { const m = /^#\/directo\/([^/]+)\/resumen/.exec(location.hash); if (/^#\/partido\//.test(location.hash) || (m && VID[decodeURIComponent(m[1])])) render(); });
    if ((v === 'metodo' || v === 'nuevo') && parts[1]) setTimeout(() => { const el = document.getElementById((v === 'nuevo' ? 'n-' : 'm-') + parts[1]); if (el) el.scrollIntoView({ block: 'start' }); }, 60);
    if ((v === 'inicio' || v === 'jornada') && parts[1]) setTimeout(() => { const el = document.getElementById('semana'); if (el) el.scrollIntoView({ block: 'start' }); }, 60);   // al cambiar de semana
    // entrada de página (nivel 1): toda la vista sube 8 px en 240 ms, sin cascada
    if (MOV) { view.style.animation = 'none'; void view.offsetWidth; view.style.animation = 'mpEntra .24s cubic-bezier(.2,.8,.2,1) both'; }
    ola(view);
    rodillos(view);
    rellenarParecidos();
    rellenarArquetipo();
    rellenarPerfiles();
    rellenarGraficoPartido();
    rellenarTirosPartido();
    rellenarEquipo();
    rellenarAgenda();
    rellenarFicha();
    rellenarFlujo();
    rellenarEsc();
    filtrarJug();
    dibujar(view);
    rellenarComparar();
    rellenarVideoFicha();
    rellenarVoto();
    rellenarPistaVivo();
    billetes(view);
    // con la intro delante, la web se anima al cerrarla
    if (introEl) animarAlCerrar = true; else animar(view);
    // el título de la pestaña dice qué página es (el jugador, el partido, el equipo o la liga)
    const pp = v === 'partido' && A.partidos[parts[1]], jj = v === 'jugador' && A.jugadores[parts[1]], ee = v === 'equipo' && A.equipos.find(x => x.id === parts[1]), ll = v === 'liga' && lgOf(parts[1]);
    const det = jj ? corto(jj, true) : pp ? abr(pp.local) + ' ' + (pp.gl != null ? pp.gl + '–' + pp.gv : 'vs') + ' ' + abr(pp.visitante) : rp ? 'Previa · ' + etqEq(rp.c.local, rp.L.id, true) + ' – ' + etqEq(rp.c.visitante, rp.L.id, true) : ee ? tituloOf(ee) : ll ? ll.nombre : '';
    const rsT = v === 'directo' && RS.m && RS.m.idp === parts[1] ? (parts[2] === 'resumen' ? 'Así fue · ' : RS.fase === 'fin' ? '' : 'En directo · ') + abr(RS.m.local) + ' ' + RS.m.gl + '–' + RS.m.gv + ' ' + abr(RS.m.visitante) : '';
    document.title = 'MADRIDPATINA · ' + (rsT || det || TITLES[v]);
    save({ route: location.hash, eq: S.eq, lg: S.lg });
    try { sessionStorage.setItem(HKEY, JSON.stringify(S.hist.slice(-10))); } catch (e) { /* sin almacenamiento */ }
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-nav]')) navReset = true;
    const b = e.target.closest('[data-back]');
    // «← Volver» es el Atrás del navegador (no deja una entrada nueva en el historial)
    if (b) { e.preventDefault(); if (S.hist.length) history.back(); else location.hash = '#/'; }
  });
  window.addEventListener('hashchange', () => {
    if (prevRoute) POS[prevRoute] = window.scrollY;
    const atras = !navReset && S.hist.length && S.hist[S.hist.length - 1] === location.hash;   // Atrás del navegador o «← Volver»
    if (navReset) S.hist = [];
    else if (atras) S.hist.pop();
    else if (prevRoute && prevRoute !== location.hash) S.hist = S.hist.concat([prevRoute]).slice(-10);
    navReset = goingBack = false; prevRoute = location.hash;
    window.scrollTo(0, 0); render();
    if (atras && POS[location.hash]) { const y = POS[location.hash]; requestAnimationFrame(() => window.scrollTo(0, y)); }   // vuelve a donde estaba
  });

  /* ── Intro «Focos» (handoff_animaciones §1) ─────────────────────────────────────────────────
     Todos los partidos nuestros pendientes desde el primero que queda hasta el domingo de esa semana, con su cuenta
     atrás (días · horas · min, cada minuto). Una vez por sesión; se cierra con ✕, ENTRAR, Esc o deslizando hacia
     arriba, y el escudo de la cabecera la vuelve a abrir. No está en el menú. */
  const INTRO = 'mp-intro-visto';
  // la cuenta atrás solo se abre sola en inicio: la web sin ruta (o Jornada). Con un enlace a otra página, no
  const HASH_INICIAL = location.hash;
  const esInicio = h => !h || h === '#' || h === '#/' || h === '#/jornada' || h === '#/inicio';
  let introEl = null, introReloj = null;
  // si al cargar no había nada que enseñar pero el directo trae enseguida lo ya jugado esta semana, se abre entonces (una vez)
  let introAbierta = false, introVistaCarga = true;
  const T_CARGA = Date.now();
  const p2 = n => String(n).padStart(2, '0');
  // 9f · partido de la intro que está en juego ahora (según el directo)
  function vivoIntro(k) {
    for (const sn of Object.values(LIVE.snaps)) {
      if (sn.estado !== 'directo' && sn.estado !== 'descanso') continue;
      const r = enCalendario(sn);
      if (r && [r.local, r.vis].sort().join('|') + r.c.fecha === k) return sn;
    }
    return null;
  }
  function finIntro(k) {   // partido de esta semana ya terminado, según el directo
    for (const sn of Object.values(LIVE.snaps)) {
      if (sn.estado !== 'final') continue;
      const r = enCalendario(sn);
      if (r && [r.local, r.vis].sort().join('|') + r.c.fecha === k) return sn;
    }
    return null;
  }
  const IN = { mostrado: {}, pend: {}, visto: 0, cola: null, ps: [], clave: '' };
  function partidosFinde() {
    const ahora = Date.now(), d0 = new Date(), hoy = d0.getFullYear() + '-' + p2(d0.getMonth() + 1) + '-' + p2(d0.getDate());
    const l0 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - (d0.getDay() + 6) % 7), lunes = l0.getFullYear() + '-' + p2(l0.getMonth() + 1) + '-' + p2(l0.getDate());
    const visto = {}, up = [];
    A.equipos.forEach(e => (e.cal || []).forEach(c => {
      if (!c.fecha || c.descanso || c.fecha < lunes) return;
      const local = c.casa ? e.nombre : c.rival, vis = c.casa ? c.rival : e.nombre;
      const k = [local, vis].sort().join('|') + c.fecha;   // derbi: una sola fila
      if (visto[k]) return;
      // ya terminado esta semana: con su resultado (del directo o, si no, del calendario) y enlace a su resumen
      const fin = c.fecha <= hoy ? finIntro(k) : null;
      if (c.resultado || fin) {
        visto[k] = 1;
        const [y, m, d] = c.fecha.split('-').map(Number), [hh, mm] = (c.hora || '00:00').split(':').map(Number);
        let gl, gv, pen = null, href = null;
        if (fin) { gl = fin.gl || 0; gv = fin.gv || 0; pen = fin.penaltis; href = '#/directo/' + encodeURIComponent(fin.idp) + '/resumen'; }
        else { const [n, o] = c.resultado.split('-').map(Number); [gl, gv] = c.casa ? [n, o] : [o, n]; href = c.mid ? hM(c.mid) : null;
          const pp = c.mid && A.partidos[c.mid]; if (gl === gv && pp && pp.pen) pen = { ganador: pp.pen === local ? 'L' : 'V' }; }
        if (fin && VID && VID[fin.idp]) href = '#/video/' + encodeURIComponent(fin.idp);
        const nom = n => ours(n) && n === e.nombre ? 'MP ' + letraOf(e) : abr(n);
        up.push({ k, fin: true, gl, gv, pen, href, mpL: ours(local), mpV: ours(vis), ts: new Date(y, m - 1, d, hh, mm).getTime(), dia: new Date(y, m - 1, d).getTime(), hora: c.hora, derbi: !!c.derbi, local, vis, la: nom(local), va: nom(vis),
          cuando: DIA[new Date(y, m - 1, d).getDay()] + ' ' + d });
        return;
      }
      if (c.resultado || c.fecha < hoy) return;
      visto[k] = 1;
      const [y, m, d] = c.fecha.split('-').map(Number), [hh, mm] = (c.hora || '23:59').split(':').map(Number);
      const ts = new Date(y, m - 1, d, hh, mm).getTime();
      if (ts < ahora && !vivoIntro(k)) return;   // ya empezado: solo si está en juego (9f)
      // Alevín e Infantil se llaman igual en la FMP: «MP AL» / «MP IN»
      const nom = n => ours(n) && n === e.nombre ? 'MP ' + letraOf(e) : abr(n);
      up.push({ k, ts, dia: new Date(y, m - 1, d).getTime(), hora: c.hora, derbi: !!c.derbi, local, vis, la: nom(local), va: nom(vis), mpL: ours(local), mpV: ours(vis),
        prev: hPar(e.ligaId, c.j, local, vis), cuando: fd(c.fecha) + ' · ' + (c.hora || 'hora por fijar') });
    }));
    if (!up.length) return [];
    up.sort((a, b) => a.ts - b.ts);
    const f = new Date(up[0].dia), fin = new Date(f.getFullYear(), f.getMonth(), f.getDate() + (7 - f.getDay()) % 7, 23, 59, 59).getTime();
    return up.filter(x => x.dia <= fin);
  }
  // [días, horas, min]; sin hora fijada solo se cuentan los días
  function cuentaAtras(x) {
    if (!x.hora) { const h = new Date(); return [p2(Math.max(0, Math.round((x.dia - new Date(h.getFullYear(), h.getMonth(), h.getDate())) / 864e5))), '--', '--']; }
    let s = Math.max(0, Math.floor((x.ts - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400;
    return [p2(d), p2(Math.floor(s / 3600)), p2(Math.floor(s % 3600 / 60))];
  }
  const cuandoVivo = sn => '<i></i>' + esc('EN DIRECTO · ' + (sn.estado === 'descanso' ? 'DESCANSO' : estadoCorto(sn)));
  function filaIntro(x, i) {
    const escI = n => `<span class="esc"${crest(n) ? ` style="background-image:url('${esc(crest(n))}')"` : ''}></span>`;
    const sn = x.fin ? null : vivoIntro(x.k);
    let cifras, cuando;
    if (x.fin) {   // terminado: el resultado (en rojo el bloque del ganador si es nuestro), la B de la tanda y «▶ ver resumen»
      const nos = x.mpL && !x.mpV ? 'L' : x.mpV && !x.mpL ? 'V' : null, gana = x.gl > x.gv ? 'L' : x.gv > x.gl ? 'V' : (x.pen && x.pen.ganador) || null;
      cifras = [['L', x.gl, x.la], ['V', x.gv, x.va]].map(([l, n, lab]) => `<div class="bloque"><div class="num res${nos && gana === l && nos === l ? ' gana' : ''}"><div>${n}${x.gl === x.gv && gana === l ? '<span class="b-pen">B</span>' : ''}</div></div><span>${esc(lab)}</span></div>`).join('');
      cuando = `<div class="cuando acabado">FINAL · ${x.href && /resumen|video/.test(x.href) ? '▶ VER RESUMEN' : esc(x.cuando)}</div>`;
    } else if (sn) {   // en juego: dos bloques con el marcador de rodillo
      const m = IN.mostrado[sn.idp] || (IN.mostrado[sn.idp] = { gl: sn.gl || 0, gv: sn.gv || 0 });
      cifras = [['L', m.gl, x.la], ['V', m.gv, x.va]].map(([l, n, lab]) => `<div class="bloque"><div class="num marc ${l}" data-in="${esc(sn.idp)}-${l}"><div style="transform:translateY(-${(n * 1.02).toFixed(2)}em)">${Array.from({ length: Math.max(16, n + 1) }, (_, d) => `<span>${d}</span>`).join('')}</div></div><span>${esc(lab)}</span></div>`).join('');
      cuando = `<div class="cuando envivo">${cuandoVivo(sn)}</div>`;
    } else {   // por jugar: DÍAS · HORAS · MIN (sin hora, solo los días)
      const q = cuentaAtras(x);
      cifras = (x.hora ? ['DÍAS', 'HORAS', 'MIN'] : ['DÍAS']).map((k, j) => `<div class="bloque"><div class="num${j === 2 ? ' min' : ''}"><div>${q[j]}</div></div><span>${k}</span></div>`).join('');
      cuando = `<div class="cuando">${esc(x.cuando)}</div>`;
    }
    const href = x.fin ? x.href : sn ? '#/directo/' + encodeURIComponent(sn.idp) : x.prev;
    return `<div class="fila${x.derbi ? ' con-derbi' : ''}"${sn ? ` data-vivo="${esc(sn.idp)}"` : ''}${x.fin ? ' data-fin' : ''}${href ? ` data-href="${esc(href)}"` : ''}>${x.derbi ? '<div class="derbi"><span>DERBI</span></div>' : ''}
      <div class="eq"><div class="vs-t">${escI(x.local)}<b${x.mpL ? ' class="mp"' : ''}>${esc(x.la)}</b><i>vs</i><b${x.mpV ? ' class="mp"' : ''}>${esc(x.va)}</b>${escI(x.vis)}</div>${cuando}</div>
      <div class="cifras" data-i="${i}">${cifras}</div></div>`;
  }
  // título de la ventana: «Hoy jugamos» si hoy juega uno de los nuestros; si no, «Este fin de semana»; encima, los días.
  // Si esta semana no jugamos y los partidos son de otra, se dice: «Este fin de semana no jugamos» y «El próximo fin de semana» (o «Próximos partidos»)
  function titIntro(ps) {
    const d = new Date(), hoy = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), dias = ps.map(x => x.dia), f = t => { const x = new Date(t); return DIA[x.getDay()] + ' ' + x.getDate() + ' ' + MES[x.getMonth()]; };
    const a = Math.min(...dias), b = Math.max(...dias);
    const lunes = t => { const x = new Date(t); return new Date(x.getFullYear(), x.getMonth(), x.getDate() - (x.getDay() + 6) % 7).getTime(); };
    const semanas = Math.round((lunes(a) - lunes(hoy)) / (7 * 864e5));
    const tit = ps.some(x => x.dia === hoy) ? 'Hoy jugamos' : semanas <= 0 ? 'Este fin de semana' : semanas === 1 ? 'El próximo fin de semana' : 'Próximos partidos';
    return `${semanas > 0 ? '<span class="iv-aviso">Este fin de semana no jugamos</span>' : ''}<span class="etq">${esc(f(a) + (b !== a ? ' – ' + f(b) : ''))}</span><b class="h1">${tit}</b>`;
  }
  // gol en la intro: el bloque del que marca se pone rojo (gris si es el rival), la fila recibe la franja y el rodillo sube
  function pintarRodIntro(idp) {
    const m = IN.mostrado[idp];
    if (!m || !introEl) return;
    [['L', m.gl], ['V', m.gv]].forEach(([l, n]) => { const el = introEl.querySelector(`[data-in="${CSS.escape(idp)}-${l}"] > div`); if (el) el.style.transform = `translateY(-${(n * 1.02).toFixed(2)}em)`; });
  }
  function mostrarGolIntro(x, ms) {
    const { idp, e } = x;
    return new Promise(res => {
      const fin = () => { const m = /^(\d+)-(\d+)$/.exec(e.marcador || ''); if (m) IN.mostrado[idp] = { gl: +m[1], gv: +m[2] }; pintarRodIntro(idp);
        IN.pend[idp] = Math.max(0, (IN.pend[idp] || 0) - 1); res(); };
      const fila = introEl && introEl.querySelector(`[data-vivo="${CSS.escape(idp)}"]`), sn = LIVE.snaps[idp];
      if (!ms || !fila || !sn) return fin();
      const ctx = ctxDirecto(sn), mp = ctx.mp[e.lado], bloque = fila.querySelector(`[data-in="${CSS.escape(idp)}-${e.lado}"]`);
      if (bloque) bloque.style.background = mp ? RED : '#55555B';
      const capa = document.createElement('div'); capa.className = 'gcapa';
      capa.innerHTML = `<div${mp ? ' class="mp"' : ''}><b>GOL</b><span>${esc(ctx.abr[e.lado])}</span></div>`;
      fila.appendChild(capa);
      setTimeout(() => { capa.remove(); if (bloque) bloque.style.background = ''; fin(); }, ms);
    });
  }
  function introDirecto() {
    if (!introEl || !A) return;
    if (!IN.cola) IN.cola = MPDirecto.colaGoles(mostrarGolIntro);
    const ps = partidosFinde(), clave = ps.map(x => x.k + (x.fin ? '=' + x.gl + '-' + x.gv : vivoIntro(x.k) ? '*' : '')).join('|');
    if (ps.length && clave !== IN.clave) {   // entra o sale una fila en directo: se repinta, sin animar la entrada
      IN.ps = ps; IN.clave = clave;
      const caja = introEl.querySelector('.caja');
      caja.innerHTML = ps.map(filaIntro).join('');
      const t = introEl.querySelector('.iv-tit'); if (t) t.innerHTML = titIntro(ps);
    }
    LIVE.nuevos.slice(IN.visto).forEach(({ idp, ev }) => { if (ev.tipo === 'GOL' && IN.mostrado[idp]) { IN.pend[idp] = (IN.pend[idp] || 0) + 1; IN.cola({ idp, e: ev }); } });
    IN.visto = LIVE.nuevos.length;
    introEl.querySelectorAll('[data-vivo]').forEach(fila => {
      const sn = LIVE.snaps[fila.dataset.vivo];
      if (!sn) return;
      const c = fila.querySelector('.cuando');
      if (c) c.innerHTML = cuandoVivo(sn);
      if (!IN.pend[sn.idp] && IN.mostrado[sn.idp] && (IN.mostrado[sn.idp].gl !== (sn.gl || 0) || IN.mostrado[sn.idp].gv !== (sn.gv || 0))) { IN.mostrado[sn.idp] = { gl: sn.gl || 0, gv: sn.gv || 0 }; pintarRodIntro(sn.idp); }
    });
  }
  // sola (al entrar o al empezar un partido) solo los días en que juega un equipo nuestro; con el escudo, siempre
  function abrirIntro(sola) {
    if (introEl || !A) return;
    const ps = partidosFinde();
    if (!ps.length) return;
    const d = new Date(), hoy = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (sola && !ps.some(x => x.dia === hoy)) return;
    introAbierta = true;
    IN.ps = ps; IN.clave = ps.map(x => x.k + (x.fin ? '=' + x.gl + '-' + x.gv : vivoIntro(x.k) ? '*' : '')).join('|'); IN.visto = LIVE.nuevos.length;
    try { sessionStorage.setItem(INTRO, '1'); } catch (e) { /* sin almacenamiento: saldrá en cada visita */ }
    const el = introEl = document.createElement('div');
    el.className = 'intro'; el.tabIndex = -1;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Próximos partidos');
    el.innerHTML = `<div class="iv"><div class="iv-cab"><span class="marca iv-marca" aria-label="LAMHL / MP"><span>LAMHL</span><span class="bar" aria-hidden="true">/</span><span class="mp"><span>MP</span></span></span>
        <button class="iv-x" type="button" aria-label="Cerrar" data-cierra>✕</button></div>
      <div class="iv-centro"><div class="iv-tit">${titIntro(ps)}</div><div class="caja">${ps.map(filaIntro).join('')}</div></div>
      <div class="iv-pie"><button class="btn p iv-entrar" type="button" data-cierra>Entrar</button><span class="iv-m">o desliza hacia arriba</span><span class="iv-d">o pulsa Esc</span></div></div>`;
    document.body.appendChild(el);
    document.documentElement.style.overflow = 'hidden';
    el.focus({ preventScroll: true });
    el.addEventListener('click', e => {
      if (e.target.closest('[data-cierra]')) return cerrarIntro();
      const f = e.target.closest('.fila[data-href]');   // terminado → su resumen; en juego → su directo
      if (f) { const h = f.dataset.href; cerrarIntro(); location.hash = h; }
    });
    let y0 = null;   // deslizar hacia arriba (en el ordenador, la rueda hacia abajo)
    el.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchmove', e => { if (y0 !== null && y0 - e.touches[0].clientY > 60) { y0 = null; cerrarIntro(); } }, { passive: true });
    el.addEventListener('wheel', e => { if (e.deltaY > 30) cerrarIntro(); }, { passive: true });
    document.addEventListener('keydown', teclaIntro);
    // cada minuto, justo al cambiar de minuto; el bloque MIN «cae» al cambiar
    const tic = () => {
      el.querySelectorAll('.cifras').forEach(c => {
        if (c.closest('[data-vivo],[data-fin]') || !IN.ps[+c.dataset.i]) return;   // la fila en directo o terminada lleva el marcador
        const q = cuentaAtras(IN.ps[+c.dataset.i]);
        c.querySelectorAll('.num > div').forEach((n, j) => { if (n.textContent !== q[j]) { n.textContent = q[j]; if (MOV) repetir(n, 'mpTick .35s cubic-bezier(.2,.8,.2,1)'); } });
      });
      introReloj = setTimeout(tic, 60000 - Date.now() % 60000 + 50);
    };
    introReloj = setTimeout(tic, 60000 - Date.now() % 60000 + 50);
  }
  function teclaIntro(e) { if (e.key === 'Escape') cerrarIntro(); }
  function cerrarIntro() {
    if (!introEl) return;
    const el = introEl; introEl = null;
    clearTimeout(introReloj);
    document.removeEventListener('keydown', teclaIntro);
    document.documentElement.style.overflow = '';
    el.classList.add('cierra');   // fundido de 300 ms y queda la web debajo
    if (animarAlCerrar) { animarAlCerrar = false; animar(view); }
    setTimeout(() => el.remove(), MOV ? 320 : 0);
  }
  document.querySelector('[data-marca]').addEventListener('click', e => {   // la marca: a Inicio, y allí la ventana del principio
    e.preventDefault();
    if (!esInicio(location.hash)) location.hash = '#/';
    abrirIntro();
  });

  document.addEventListener('animationend', e => {
    if (e.animationName !== 'mpReel') return;
    const card = e.target.closest('[data-rodillo]');
    if (!card || card.classList.contains('parado')) return;
    card.classList.add('parado'); marcarSes('traga');
    const n = card.querySelector('[data-cuenta]');
    if (!n) return;
    const fin = +n.dataset.cuenta, t = n.dataset.fmt;
    const fmt = t === 'pct' ? v => dec((v === fin ? fin : v).toFixed(1)) : t === 'min' ? v => fmin(v === fin ? fin : Math.round(v * 2) / 2) : v => String(Math.round(v));
    // la cifra ocupa desde el principio lo que ocupará al final: mientras cuenta, ni el texto de al lado ni la tarjeta se mueven
    const w = n.getBoundingClientRect().width;
    Object.assign(n.style, { display: 'inline-block', minWidth: w + 'px', fontVariantNumeric: 'tabular-nums' });
    n.textContent = fmt(0);
    setTimeout(() => contar(n, fin, 800, fmt), MOV ? 250 : 0);
  });

  /* ── En directo (handoff_directo/README.md) ─────────────────────────────────────────────────
     La web no habla con la FMP: lee el endpoint de Vercel (que lee el portal y lo guarda 10 s). Solo se pide el día que
     juega un equipo nuestro, desde 30 min antes del primer partido hasta 3 h después del último; pestaña oculta → nada.
     Con ?directo=ejemplo usa data/directo-ejemplo.json (actas reales recortadas) para desarrollar sin partido.
     La primera respuesta se pinta quieta: solo se anima lo que llega después (MPDirecto no avisa de lo anterior). */
  const DIRECTO_EJEMPLO = new URLSearchParams(location.search).get('directo') === 'ejemplo';
  const DIRECTO_URL = DIRECTO_EJEMPLO ? 'data/directo-ejemplo.json' : 'https://madridpatina-directo.vercel.app/api/directo';
  const LIVE = { snaps: {}, recibido: {}, nuevos: [], ok: null, fallos: 0, sesion: null, cargado: false };
  const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const hoyKey = () => { const d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  const minAhora = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  // partido del directo → nuestro calendario: misma liga y jornada; el partido, por nombres (con acta) o por fecha y hora (antes)
  function enCalendario(sn) {
    const L = A.ligas.find(l => norm(l.nombre) === norm(sn.liga));
    if (!L) return null;
    const [d, m] = (sn.fecha || '').split('/');
    for (const e of A.equipos.filter(x => x.ligaId === L.id)) for (const c of e.cal) {
      if (c.descanso || c.j !== sn.jornada) continue;
      const local = c.casa ? e.nombre : c.rival, vis = c.casa ? c.rival : e.nombre;
      const ok = sn.local && sn.visitante ? norm(local) === norm(sn.local) && norm(vis) === norm(sn.visitante)
        : c.fecha && d && c.fecha.slice(5) === m + '-' + d && (!sn.hora || !c.hora || c.hora === sn.hora);
      if (ok) return { e, c, L, local, vis };
    }
    return null;
  }
  // reloj de la parte: avanza solo entre respuestas; si el portal no lo da, no hay reloj (no se inventa)
  // en el resumen, el reloj es el de la simulación; en directo avanza solo entre respuestas
  // la FMP no publica el reloj: el servicio estima el segundo de partido (seg_est) desde el último apunte del acta; avanza en local
  const segEst = sn => { if (!sn || sn.seg_est == null || sn.estado !== 'directo' || sn.fase === 'penaltis') return null; const dur = sn.duracion_periodo || 1500, per = sn.periodo || 1;
    return Math.min(per * dur, sn.seg_est + Math.max(0, (Date.now() - (LIVE.recibido[sn.idp] || Date.now())) / 1000)); };
  const minEst = sn => { const s = segEst(sn); return s == null ? '' : '≈ ' + Math.max(1, Math.ceil(s / 60)) + "'"; };
  const relojDe = sn => (sn && sn.reloj ? (sn._resumen ? sn.reloj : MPDirecto.relojLocal(sn, LIVE.recibido[sn.idp] || Date.now())) : null);
  let pintaPendiente = false;
  function pintarDirecto() {   // las piezas del directo (pasos 4-7) escuchan 'mp-directo'
    if (pintaPendiente) return;
    pintaPendiente = true;
    requestAnimationFrame(() => { pintaPendiente = false; document.dispatchEvent(new CustomEvent('mp-directo')); });
  }
  function arrancarDirecto() {
    if (!window.MPDirecto || LIVE.sesion) return;
    const hoy = hoyKey();
    const horas = A.equipos.flatMap(e => e.cal.filter(c => c.fecha === hoy && !c.descanso && !c.resultado)
      .map(c => (c.hora ? +c.hora.slice(0, 2) * 60 + +c.hora.slice(3, 5) : null)));
    if (!DIRECTO_EJEMPLO && !horas.length) return;   // hoy no juega ningún equipo nuestro: no se pide nada
    const todas = horas.length && horas.every(h => h != null);
    const ini = DIRECTO_EJEMPLO ? 0 : todas ? Math.min(...horas) - 30 : 9 * 60;
    const fin = DIRECTO_EJEMPLO ? 24 * 60 : todas ? Math.max(...horas) + 180 : 23 * 60 + 59;
    if (minAhora() > fin) return;
    const empezar = () => {
      LIVE.sesion = MPDirecto.start({
        url: DIRECTO_URL, cadaMs: 15000,
        onSnap: sn => { LIVE.snaps[sn.idp] = sn; LIVE.recibido[sn.idp] = Date.now(); pintarDirecto(); },
        onNuevo: (ev, sn) => { LIVE.nuevos.push({ idp: sn.idp, ev }); pintarDirecto(); },
        onEstado: st => { LIVE.ok = st.ok; LIVE.fallos = st.fallos; if (st.ok) LIVE.cargado = true; pintarDirecto(); },
      });
      if (!DIRECTO_EJEMPLO) setTimeout(() => { if (LIVE.sesion) LIVE.sesion.stop(); LIVE.sesion = null; }, Math.max(0, fin - minAhora()) * 60000);
    };
    if (minAhora() >= ini) empezar(); else setTimeout(empezar, (ini - minAhora()) * 60000);
  }
  // una sola petición para traer lo ya jugado esta semana, con su acta para el resumen (si no hay directo en marcha que ya lo traiga)
  function cargarSemana() {
    if (!window.MPDirecto || LIVE.sesion) return;
    const d0 = new Date(), hoy = hoyKey(), l0 = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - (d0.getDay() + 6) % 7);
    const lunes = l0.getFullYear() + '-' + p2(l0.getMonth() + 1) + '-' + p2(l0.getDate());
    const falta = A.equipos.some(e => e.cal.some(c => c.fecha && !c.descanso && c.fecha >= lunes && c.fecha <= hoy
      && (c.fecha < hoy || !c.hora || +c.hora.slice(0, 2) * 60 + +c.hora.slice(3, 5) < minAhora())));
    if (!falta && !DIRECTO_EJEMPLO) return;
    fetch(DIRECTO_URL + (DIRECTO_URL.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(d => {
      (d.partidos || []).forEach(sn => { if (!LIVE.snaps[sn.idp]) { LIVE.snaps[sn.idp] = sn; LIVE.recibido[sn.idp] = Date.now(); } });
      pintarDirecto();
    }).catch(() => { /* sin conexión: la intro sigue como estaba */ });
  }
  // para revisar a mano desde la consola: MPLive.snaps, MPLive.cal('14544')…
  LIVE.cal = idp => { const r = LIVE.snaps[idp] && enCalendario(LIVE.snaps[idp]); return r ? { equipo: r.e.id, jornada: r.c.j, fecha: r.c.fecha, mid: r.c.mid, local: r.local, visitante: r.vis } : null; };
  window.MPLive = LIVE;

  /* ── 9b + 9d · Página del partido en directo (#/directo/{idp}) ──────────────────────────────
     Se pinta quieta al entrar; con cada respuesta solo se anima lo nuevo: los goles hacen cola (MPDirecto.colaGoles), la
     cortina cruza el marcador y, al salir, el rodillo sube un número. Las filas y puntos de gol nuevos esperan a la cortina. */
  const FALTA_TXT = { SP: 'Golpear con la punta del stick', BE: 'Golpear con el taco', SL: 'Golpear con el stick', SA: 'Stick alto', CC: 'Carga con stick',
    EG: 'Enganchar', AG: 'Agarrar', CG: 'Carga', CE: 'Carga por la espalda', VI: 'Violencia innecesaria', MC: 'Mala conducta', ZC: 'Zancadilla', CZ: 'Codazo',
    RZ: 'Rodillazo', CA: 'Conducta antideportiva', IF: 'Interferencia', CI: 'Cambio ilegal', PB: 'Penalización de banquillo', EI: 'Equipación incorrecta',
    RJ: 'Retraso en el juego', SR: 'Stick roto', PP: 'Penalización de partido', EX: 'Expulsión' };
  const motivoFalta = e => (e.falta_tipo && FALTA_TXT[e.falta_tipo] ? FALTA_TXT[e.falta_tipo] + ' (' + e.falta_tipo + ')' : 'Expulsión');
  const minFuera = m => (m % 1 ? fmin(m) : m + ' min');
  const segs = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const ordinal = p => (p ? p + 'ª' : '');
  // «B» junto al marcador de quien gana en los penaltis (así lo pone la FMP)
  const bPen = t => `<sup class="pen-b" title="Gana en los penaltis"><span aria-hidden="true">B</span><span class="sr-only"> (gana en los penaltis) </span></sup>`;
  const DV = { idp: null, vacio: true, gen: 0, mostrado: { gl: 0, gv: 0 }, visto: 0, aparece: {}, claves: new Set(), pendientes: 0, cola: null,
    penVistos: new Set(), situClave: '', tiros: {}, listo: false };
  // contexto del partido: nombres, abreviaturas (MP A / TIS B), qué lado es nuestro y nuestro equipo de cada lado
  function ctxDirecto(sn) {
    const cal = enCalendario(sn);
    const nombre = { L: sn.local || (cal && cal.local) || '', V: sn.visitante || (cal && cal.vis) || '' };
    const eqDe = n => (cal ? A.equipos.find(e => e.nombre === n && e.ligaId === cal.L.id) : null) || null;
    const eq = { L: eqDe(nombre.L), V: eqDe(nombre.V) };
    return { sn, cal, dur: sn.duracion_periodo || null, nombre, eq, mp: { L: ours(nombre.L), V: ours(nombre.V) },
      abr: { L: eq.L ? 'MP ' + letraOf(eq.L) : abr(nombre.L), V: eq.V ? 'MP ' + letraOf(eq.V) : abr(nombre.V) } };
  }
  function jugadorMP(ctx, lado, dorsal) {
    const e = ctx.eq[lado];
    if (!e || !dorsal) return null;
    return Object.values(A.jugadores).find(p => p.equipo === e.nombre && String(p.dorsal) === String(dorsal) && (!e.cantera || enEquipo(p, e))) || null;
  }
  // «#12 J. Griñán»: de los nuestros sale de app.json; del rival, del acta
  const iniApe = p => { const o = []; for (const w of (p.apellidos || '').split(' ')) { o.push(w); if (!PART.has(w.toLowerCase())) break; } return ((p.nombre || '')[0] ? p.nombre[0] + '. ' : '') + o.join(' '); };
  function quienD(ctx, lado, dorsal, corto, largo) {
    const p = jugadorMP(ctx, lado, dorsal);
    return ((dorsal ? '#' + dorsal + ' ' : '') + (p ? apodoDe(p) || iniApe(p) : corto || largo || '')).trim();
  }
  // gol en superioridad (el rival con una expulsión en curso) o a portería vacía (el que encaja había sacado al portero)
  // Superioridad o inferioridad al marcar, contando jugadores en pista: dejan al equipo con uno menos las expulsiones de
  // 1'30'', 2' y 5' (las de 10' no: entra otro), que se suman si coinciden; la de 2' o menos se acaba si el otro equipo
  // marca mientras dura; pasan de una parte a la otra. En el mismo segundo manda el orden del acta.
  const exclusion = f => f.tipo === 'FALTA' && (f.min_sancion || 2) < 10;
  function situacionGol(g, evs, dur) {
    if (!dur || g.t == null) return '';
    const abs = e => (e.periodo - 1) * dur + segs(e.t), tg = abs(g), antes = c => c.periodo < g.periodo || (c.periodo === g.periodo && segs(c.t) <= segs(g.t));
    const cambios = evs.filter(c => c.tipo === 'CAMBIO DE PORTERO' && c.lado !== g.lado && c.t != null && antes(c));
    if (cambios.length && cambios[cambios.length - 1].nota === 'Portero fuera') return 'Portería vacía';
    const fuera = { L: [], V: [] }, otro = l => (l === 'L' ? 'V' : 'L');
    if (!fuera[g.lado]) return '';
    const orden = evs.map((e, i) => [e, i]).filter(([e]) => e.periodo && segs(e.t) != null).sort((a, b) => abs(a[0]) - abs(b[0]) || a[1] - b[1]);
    for (const [e] of orden) {
      const t = abs(e);
      if (e === g || (g.id && e.id === g.id) || t > tg) break;
      ['L', 'V'].forEach(l => { fuera[l] = fuera[l].filter(x => x.fin > t); });
      if (exclusion(e) && fuera[e.lado]) fuera[e.lado].push({ fin: t + (e.min_sancion || 2) * 60, menor: (e.min_sancion || 2) <= 2 });
      else if (e.tipo === 'GOL' && fuera[e.lado] && fuera[otro(e.lado)].length > fuera[e.lado].length) {
        const m = fuera[otro(e.lado)].filter(x => x.menor).sort((a, b) => a.fin - b.fin)[0];
        if (m) fuera[otro(e.lado)].splice(fuera[otro(e.lado)].indexOf(m), 1);
      }
    }
    const n = l => fuera[l].filter(x => x.fin > tg).length, d = n(otro(g.lado)) - n(g.lado);
    return d > 0 ? 'En superioridad' : d < 0 ? 'En inferioridad' : '';
  }
  /* ── Vídeo del partido (YouTube), sincronizado jugada a jugada ─────────────────────────────────────────────────────
     data/videos.json: { idp: { yt, canal, partes: {1, 2}, ev: { id del evento: { s, tipo, p, t, lado, q, m } } } }, que se
     rellena con la herramienta #/sincronizar/{idp}. El reloj del partido se para en cada pitido (1,2–1,7 minutos reales por
     minuto de juego), así que no basta con saber dónde empieza cada parte: se marca cada jugada. */
  let VID = null, vidP = null;
  const cargarVideos = () => vidP || (vidP = fetch('data/videos.json?v=' + encodeURIComponent(A.actualizado || ''), { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : {})).catch(() => ({})).then(d => apiGet('video?lista=1').then(sv => {
      VID = d || {}; if (sv && sv.partidos) Object.entries(sv.partidos).forEach(([k, v]) => { VID[k] = v; }); return VID; })));
  const ANTES_JUGADA = 8;   // la jugada se empieza a ver unos segundos antes
  const segVideo = (idp, e) => { const v = VID && VID[idp], x = v && v.ev && e && v.ev[e.id]; return x ? x.s : null; };
  const botonVer = (idp, e, txt = '▶') => { const t = segVideo(idp, e);
    return t == null ? '' : `<button type="button" class="dv-ver" data-ver="${esc(idp)}|${t}" title="Ver la jugada en el vídeo" aria-label="Ver la jugada en el vídeo">${txt}</button>`; };
  // cada «▶» lleva al vídeo en grande (modo retransmisión), unos segundos antes de la jugada; antes que nadie, porque las
  // escenas se cierran al tocarlas
  const abrirVideo = (idp, t) => { location.hash = '#/video/' + encodeURIComponent(idp) + '/' + Math.max(0, Math.round(t - ANTES_JUGADA)); };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ver]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const [idp, t] = b.dataset.ver.split('|');
    if (ESC.abierta) ESC.abierta.cerrar();
    abrirVideo(idp, +t);
  }, true);
  const TIPO_VID = { GOL: 'Gol', FALTA: 'Expulsión', 'TIEMPO MUERTO': 'Tiempo muerto', 'CAMBIO DE PORTERO': 'Cambio de portero', PENALTI: 'Penalti' };
  // en la página del partido: solo la entrada al resumen en vídeo (la lista de jugadas era larga; el usuario no la quiere)
  function videoPartido(idp) {
    const v = VID && VID[idp];
    if (!v) return '';
    return `<div class="vid-caps"><div class="cab"><span class="lab">VÍDEO DEL PARTIDO${v.canal ? ' · ' + esc(v.canal) : ''}</span><a class="dv-alin" href="#/video/${encodeURIComponent(idp)}">▶ Ver resumen</a></div></div>`;
  }

  /* ── Modo retransmisión (#/video/{idp}[/{segundo}]) ───────────────────────────────────────────────────────────────
     El vídeo en grande y, encima, los rótulos del diseño de Claude Design (design_handoff_video_resumen/README.md): un
     marcador fijo arriba a la izquierda y cada jugada en un rótulo del tercio inferior, justo en su marca de videos.json;
     antes del saque, la presentación de los dos equipos con el «VS». Todo se dibuja en un lienzo de 1920×1080 que escala
     con el vídeo (medidas del diseño tal cual). El reloj del marcador es el de juego, interpolado entre marcas. Pantalla
     completa propia: la de YouTube taparía la capa. */
  const TV = { idp: null, S: null, ctx: null, dur: 1500, player: null, timer: null, t: 0, start: 0, marcas: [], finVisto: false, modo: 'entero', k: 0, rot: null, pend: null, presT0: null };
  // resumen: cuánto se ve de cada jugada después de su marca (antes, ANTES_JUGADA)
  const DESPUES = { GOL: 7, FALTA: 5, 'TIEMPO MUERTO': 3, 'CAMBIO DE PORTERO': 4, ancla: 4, PENALTI: 4, descanso: 3.6 };
  const despues = x => (x.ancla ? DESPUES.ancla : x.pen ? DESPUES.PENALTI : x.desc ? DESPUES.descanso : DESPUES[x.e.tipo] || 4);
  const ANTES_ROT = 0.5;   // el rótulo entra medio segundo antes de la marca
  const conAsis = e => TV.ctx.mp[e.lado] && !!(e.asist_dorsal || e.asist_jugador);   // gol con la foto de quien asiste
  // segundos que está cada rótulo en pantalla (del diseño)
  const durRot = x => (x.ancla ? 2 : x.desc ? 3.4 : x.e.tipo === 'GOL' ? (conAsis(x.e) ? 3.7 : 3.5) : x.e.tipo === 'FALTA' ? 2.9 : 2.2);
  function irTV(t) { if (!TV.player || !TV.player.seekTo) return; TV.saltando = false; TV.t = t; tapaTV(); TV.player.seekTo(t, true); TV.player.playVideo(); }
  const FUNDIDO = 520;   // ms que tarda la cortina en tapar antes de cada salto (transición suave)
  function saltarTV(t) {   // con la cortina ya puesta (cortinaTV): espera a que tape y salta; mientras, no corre nada
    const c = $('#tv-cortina'), tapada = c && c.classList.contains('on') && +getComputedStyle(c).opacity > 0.95;
    const n = TV.salto = (TV.salto || 0) + 1;
    TV.saltando = true;
    setTimeout(() => { if (TV.salto === n) irTV(t); }, tapada ? 0 : FUNDIDO);
  }
  // tras cada salto (y al seguir tras una pausa) YouTube saca 4-5 s su título y su logo, y no hay forma de quitarlos: los
  // tapan una banda arriba y una esquina abajo, que luego se van
  function tapaTV() { const m = TV.modo === 'resumen' && $('#tv-marco'); clearTimeout(TV.tTapa); TV.tTapa = 0; if (m) m.classList.add('tapa'); }
  const PRES_MIN = 4, CELEBRA = 20;   // vídeo previo mínimo para la presentación (dura 7 s) y segundos que se ven tras el final

  // colores: en el derbi, el local rojo y el visitante blanco; con un rival de fuera, nosotros rojo y él gris con su escudo
  const C_RED = '#D3202A', C_REDL = '#FF6B63', C_INK = '#F4F4F5', C_DARK = '#0D0D0E', C_GRIS = '#26262A', C_ORA = '#FF8A3D';
  function colorTV(l) { const mp = TV.ctx.mp; return mp.L && mp.V ? (l === 'L' ? C_RED : C_INK) : mp[l] ? C_RED : C_GRIS; }
  const tintaTV = c => (c === C_INK ? C_DARK : C_INK);
  const varsTV = l => { const c = colorTV(l); return `--c:${c};--ink:${tintaTV(c)}`; };
  const acentoTV = l => (colorTV(l) === C_RED ? C_REDL : '#C9C9CE');   // etiquetas del equipo sobre fondo oscuro
  const escudoTV = l => (TV.ctx.mp[l] ? 'escudos/badge/madridpatina-alpha.svg' : crest(TV.ctx.nombre[l]) || '');
  const imgEsc = l => { const e = escudoTV(l); return e ? `<img src="${esc(e)}" alt="">` : ''; };
  const mmss2 = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const sinDorsal = q => q.replace(/^#\S+\s*/, '');
  const apellidoTV = q => { q = sinDorsal(q); return q.split('. ').slice(1).join('. ') || q; };
  // «POLID. MUNICIPAL JOSE CABALLERO-PISTA 4» → «JOSE CABALLERO P4»
  const pistaCorta = s => (s || '').toUpperCase().replace(/^(POLID(EPORTIVO)?\.?|PABELL[OÓ]N|PAB\.|CENTRO DEPORTIVO|C\.\s?D\.)\s+(MUNICIPAL\s+)?/, '').replace(/\s*-\s*PISTA\s*(\d+)/, ' P$1').trim();

  // foto de rótulo: la del jugador (nuestro y mayor de edad); si no, sus iniciales; del rival, su escudo
  function fotoTV(l, id, dorsal, corto, largo, w, h, o = {}) {
    const ctx = TV.ctx, c = colorTV(l), p = ctx.mp[l] ? jugadorDe(ctx, l, id, dorsal) : null;
    const st = `width:${w}px;height:${h}px;--raya:${o.raya || c};${p && p.foto && c === C_INK ? 'background-color:#D4D4D8;' : ''}`;
    const cls = 'lz-f' + (o.gris ? ' gris' : '') + (o.cls ? ' ' + o.cls : '');
    if (!ctx.mp[l]) { const e = escudoTV(l); return `<div class="${cls} riv" style="${st}">${e ? `<i class="esc" style="background-image:url('${esc(e)}')"></i>` : ''}${o.faja || ''}</div>`; }
    return `<div class="${cls}" style="${st}">${p && p.foto ? `<i class="im" style="background-image:url('${esc(p.foto)}')"></i>` : `<b class="ini" style="font-size:${Math.round(w * 0.42)}px">${esc(p ? ini(p.nombre, p.apellidos) : iniDe(corto || largo))}</b>`}${o.faja || ''}</div>`;
  }

  // ── Rótulos del tercio inferior: devuelven el html y cuándo se van (segundo del vídeo) ──
  function rotGol(x) {
    const ctx = TV.ctx, e = x.e, l = e.lado, c = colorTV(l), h = hitosGol(e, TV.S.eventos, TV.S), sit = situacionGol(e, TV.S.eventos, TV.dur);
    const tags = [...h.tags, sit ? sit.toUpperCase() : ''].filter(Boolean).slice(0, 2);
    const hayA = !!(e.asist_dorsal || e.asist_jugador), quienA = hayA ? quienD(ctx, l, e.asist_dorsal, e.asist_corto, e.asist_jugador) : '';
    const goleador = fotoTV(l, e.id_player, e.dorsal, e.jugador_corto, e.jugador, 205, 256);
    const fotos = conAsis(e) ? `<div class="dos">${goleador}${fotoTV(l, e.assist_id_player, e.asist_dorsal, e.asist_corto, e.asist_jugador, 184, 230, { cls: 'as', raya: 'transparent', faja: `<span class="faja">ASIST.${e.asist_dorsal ? ' #' + esc(e.asist_dorsal) : ''}</span>` })}</div>` : goleador;
    const m = (e.marcador || '0-0').split('-'), nuevo = l === 'L' ? 0 : 1;
    const marc = m.map((n, i) => `<span${i === nuevo ? ` class="nv${c === C_RED ? '' : ' sub'}"` : ''}>${i ? '–' : ''}${esc(n)}</span>`).join('');
    return { gol: l, html: `<div class="lz-rot gol${c === C_INK ? ' claro' : ''}" style="${varsTV(l)}"><div class="fila">${fotos}<div class="bar" style="height:176px"><div class="b1"><div class="top"><span class="k">GOL · ${esc(ctx.abr[l])}</span>${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div><div class="nm g">${esc(quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador))}</div>${hayA ? `<div class="as${c === C_INK ? ' osc' : ''}">Asist. ${esc(quienA)}</div>` : ''}</div><div class="b2"><div class="mc">${marc}</div><div class="mn">${esc(ordinal(x.p) + ' · ' + mmss2(x.G - (x.p - 1) * TV.dur))}</div></div></div></div></div>` };
  }
  function rotExp(x) {
    const ctx = TV.ctx, e = x.e, l = e.lado;
    return { html: `<div class="lz-rot exp" style="${varsTV(l)}"><div class="fila">${fotoTV(l, e.id_player, e.dorsal, e.jugador_corto, e.jugador, 162, 203, { gris: true, raya: C_ORA })}<div class="bar" style="height:148px"><i class="ray"></i><div class="b1"><div class="k">EXPULSIÓN · ${esc(ctx.abr[l])}</div><div class="nm">${esc(quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador))}</div></div><div class="min">${esc(fmin(e.min_sancion || 2))}</div></div></div></div>` };
  }
  function rotLinea(x) {   // tiempo muerto y cambio de portero: una sola línea
    const ctx = TV.ctx, e = x.e, l = e.lado, tm = e.tipo === 'TIEMPO MUERTO';
    const sub = tm ? ctx.abr[l] : 'ENTRA ' + quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador) + ' · ' + ctx.abr[l];
    return { html: `<div class="lz-rot tm" style="${varsTV(l)}"><div class="linea"><div class="es">${imgEsc(l)}</div><div class="tx"><span class="g">${tm ? 'TIEMPO MUERTO' : 'CAMBIO DE PORTERO'}</span><span class="ab">${esc(sub.toUpperCase())}</span></div></div></div>` };
  }
  const rotInicio = x => ({ centro: true, html: `<div class="lz-rot centro ini"><div class="linea"><div class="r">EMPIEZA LA</div><div class="p">${x.p === 3 ? 'TANDA DE PENALTIS' : ordinal(x.p) + ' PARTE'}</div></div></div>` });
  // goleadores de un lado por apellido («Arceo ×2 · García»), del partido o hasta el descanso
  function goleadoresTV(l, soloP1) {
    const c = new Map();
    (TV.S.eventos || []).filter(e => e.tipo === 'GOL' && e.lado === l && (!soloP1 || e.periodo === 1)).forEach(e => { const n = apellidoTV(quienD(TV.ctx, l, e.dorsal, e.jugador_corto, e.jugador)); c.set(n, (c.get(n) || 0) + 1); });
    return [...c].map(([n, k]) => n + (k > 1 ? ' ×' + k : '')).join(' · ');
  }
  function rotTarjeta(fin) {   // descanso o final; en el final, el anuncio del ganador encima
    const ctx = TV.ctx, S = TV.S, tanda = S.penaltis && (S.penaltis.tanda || []).length ? S.penaltis : null;
    const p1 = l => (S.eventos || []).filter(e => e.tipo === 'GOL' && e.lado === l && e.periodo === 1).length;
    const gl = fin ? S.gl ?? 0 : p1('L'), gv = fin ? S.gv ?? 0 : p1('V');
    const gana = fin ? (tanda ? tanda.ganador : gl > gv ? 'L' : gv > gl ? 'V' : null) : null;
    const lado = l => { const c = colorTV(l), g = gana === l; return { st: `border-${l === 'L' ? 'left' : 'right'}:11px solid ${c};` + (g ? `background:${c};color:${tintaTV(c)}` : `background:${l === 'L' ? C_DARK : '#18181B'}`), cls: gana && !g ? ' pierde' : '' }; };
    const L = lado('L'), V = lado('V');
    let pie;
    if (tanda && gana) { const dec = tanda.tanda.filter(y => y.lado === gana && y.gol).pop(); pie = [`Penaltis ${tanda.gl}–${tanda.gv} · ${ctx.abr[gana]}`, dec ? `${quienD(ctx, gana, dec.dorsal, dec.jugador_corto, dec.jugador)}, ${dec.ronda}ª ronda` : '']; }
    else pie = [goleadoresTV('L', !fin), goleadoresTV('V', !fin)];
    const anuncio = !fin ? '' : gana ? `<div class="gana" style="${varsTV(gana)}">${imgEsc(gana)}<div class="gt"><span class="k">${tanda ? 'GANA EN PENALTIS' : 'GANA'}</span><span class="n">${esc((ctx.nombre[gana] || '').toUpperCase())}</span></div></div>` : '<div class="gana empate"><div class="gt"><span class="n">EMPATE</span></div></div>';
    return { centro: true, html: `<div class="lz-rot centro tar${fin ? ' fin' : ''}">${anuncio}<div class="cuerpo"><div class="cab">${fin ? (tanda ? 'FINAL · PENALTIS' : 'FINAL') : 'DESCANSO'}</div><div class="fila2"><div class="sl${L.cls}" style="${L.st}"><span class="ab">${esc(ctx.abr.L)}</span><span class="n">${gl}</span></div><div class="sv${V.cls}" style="${V.st}"><span class="n">${gv}</span><span class="ab">${esc(ctx.abr.V)}</span></div></div><div class="pie"><span>${esc(pie[0] || '')}</span><span>${esc(pie[1] || '')}</span></div></div></div>` };
  }
  // penalti de la tanda: entra al saltar a él (quién lanza y cómo va la tanda) y, en la marca, la casilla y el sello
  function rotPen(x) {
    const ctx = TV.ctx, y = x.pen, l = y.lado, R = y.ronda, pens = TV.marcas.filter(m => m.pen);
    const caja = (lado, r) => {
      const m = pens.find(q => q.pen.lado === lado && q.pen.ronda === r);
      if (m === x) return '<i class="cs pend actual"></i>';
      if (!m || m.s > x.s) return '<i class="cs pend"></i>';   // aún no ha tirado
      return m.pen.gol ? `<i class="cs gol" style="background:${colorTV(lado)}"></i>` : '<i class="cs falla"></i>';
    };
    const fila = lado => `<div class="fl"><span class="ab" style="color:${acentoTV(lado)}">${esc(ctx.abr[lado])}</span>${Array.from({ length: R }, (_, i) => caja(lado, i + 1)).join('')}</div>`;
    return { fin: x.s + 3.6, html: `<div class="lz-rot pen" style="${varsTV(l)}"><div class="fila">${fotoTV(l, y.id_player, y.dorsal, y.jugador_corto, y.jugador, 162, 203)}<div class="bar" style="height:148px"><div class="b1"><div class="k" style="color:${acentoTV(l)}">PENALTI · RONDA ${R} · ${esc(ctx.abr[l])}</div><div class="nm">${esc(quienD(ctx, l, y.dorsal, y.jugador_corto, y.jugador))}</div></div><div class="cas">${fila('L')}${fila('V')}</div></div></div></div>` };
  }
  function tiroTV(x, k) {   // el lanzamiento (si el rótulo no estaba, entra ya con el resultado)
    if (!TV.rot || TV.rot.k !== k) rotuloTV(rotPen(x), k);
    const y = x.pen, c = colorTV(y.lado), el = TV.rot.el, cs = el.querySelector('.cs.actual'), bar = el.querySelector('.bar');
    if (cs) { cs.className = 'cs nv ' + (y.gol ? 'gol' : 'falla'); if (y.gol) cs.style.background = c; }
    // en el resumen, el fallo se cuenta como la parada del portero (lo pidió el usuario)
    if (bar && !bar.querySelector('.sello')) bar.insertAdjacentHTML('beforeend', `<div class="sello" style="${y.gol ? `background:${c};color:${tintaTV(c)}` : 'background:#3F3F46;color:#F4F4F5'}"><span>${y.gol ? 'GOL' : TV.modo === 'resumen' ? 'PARADA' : 'FALLA'}</span></div>`);
  }
  function rotDe(x) {
    const fin = x.s - ANTES_ROT + durRot(x);
    if (x.ancla) return Object.assign(rotInicio(x), { fin });
    if (x.desc) return Object.assign(rotTarjeta(false), { fin });
    if (x.e.tipo === 'GOL') return Object.assign(rotGol(x), { fin });
    return Object.assign(x.e.tipo === 'FALTA' ? rotExp(x) : rotLinea(x), { fin });
  }
  function rotuloTV(r, k) {   // pone un rótulo (el anterior se va sin animar: no se anima el pasado)
    const cont = $('#lz-rots'), gr = $('#lz-grad');
    if (!cont) return;
    cont.innerHTML = r.html;
    TV.rot = { k, fin: r.fin, gol: r.gol || null, el: cont.firstElementChild, sale: false };
    if (gr) gr.classList.add('on');
  }
  function quitarRot() { const cont = $('#lz-rots'), gr = $('#lz-grad'); if (cont) cont.innerHTML = ''; if (gr) gr.classList.remove('on'); TV.rot = null; }

  // ── Presentación (7 s antes del saque): pantalla partida, capitán aparte, el resto en rejilla y el choque del «VS» ──
  function presHtml() {
    const ctx = TV.ctx, S = TV.S, P = S.plantillas || {}, derbi = ctx.mp.L && ctx.mp.V;
    const cara = (l, j, cls) => { const p = ctx.mp[l] ? jugadorDe(ctx, l, j.id_player, j.dorsal) : null; return p && p.foto ? `<i class="im${cls ? ' ' + cls : ''}" style="background-image:url('${esc(p.foto)}')"></i>` : `<b class="ini">${esc(p ? ini(p.nombre, p.apellidos) : iniDe(j.jugador_corto || j.jugador))}</b>`; };
    const panel = l => {
      const pl = ordenPl(P[l] || []), cap = pl.find(j => j.rol === 'C'), resto = pl.filter(j => j !== cap), e = escudoTV(l);
      const qc = cap ? quienD(ctx, l, cap.dorsal, cap.jugador_corto, cap.jugador) : '', mc = /^(#\S+)\s+(.*)$/.exec(qc);
      const capHtml = cap ? `<div class="cap"><div class="cf">${cara(l, cap, 'kb')}<i class="ray"></i></div><div class="ct"><span class="k">CAPITÁN</span><span class="n">${mc ? esc(mc[1]) + '<br>' + esc(mc[2]) : esc(qc)}</span></div></div>` : '';
      const tiles = resto.map((j, i) => `<div class="tl" style="animation-delay:${(1.1 + i * 0.07).toFixed(2)}s"><div class="tf">${cara(l, j)}<i class="velo"></i><b class="dor">${esc(j.dorsal || '')}</b>${j.rol === 'P' || j.rol === 'A' ? `<b class="rol">${j.rol}</b>` : ''}</div><div class="ap">${esc(apellidoTV(quienD(ctx, l, j.dorsal, j.jugador_corto, j.jugador)))}</div></div>`).join('');
      return `<div class="eqp ${l === 'L' ? 'l' : 'v'}${colorTV(l) === C_RED ? ' roja' : ''}" style="${varsTV(l)}"><div class="pbg"></div>${e ? `<img class="mca" src="${esc(e)}" alt="">` : ''}<div class="col"><div class="lab">${e ? `<img src="${esc(e)}" alt="">` : ''}<span>${l === 'L' ? 'LOCAL' : 'VISITANTE'}</span></div><div class="nom">${esc(ctx.abr[l])}</div>${capHtml}<div class="rej">${tiles}</div></div></div>`;
    };
    const info = [(S.liga || '').replace(/^Liga\s+/i, ''), S.jornada ? 'J' + S.jornada : '', S.hora || '', pistaCorta(S.pista)].filter(Boolean).join(' · ').toUpperCase();
    const vs = cls => `<div class="${cls}"><span class="lv">V</span><span class="ls">S</span></div>`;
    return `<div class="lz-pres espera"><div class="vig"></div>${panel('L')}${panel('V')}<div class="vsw"><div class="vsbox"><i class="flash"></i><i class="aro"></i>${Array.from({ length: 10 }, (_, i) => `<i class="chispa${i % 2 ? '' : ' r'}" style="--a:${i * 36 + 8}deg"></i>`).join('')}<div class="vs">${vs('rastro r2')}${vs('rastro r1')}<div class="vsm"><span class="lv">V</span><span class="hueco"><i class="barra"></i></span><span class="ls">S</span></div>${vs('brillo')}</div></div><div class="pill"><span class="d">${derbi ? 'DERBI' : 'PARTIDO'}</span><span class="t">${esc(info)}</span></div></div></div>`;
  }
  function presentarTV() {
    const pr = $('#lz-presc');
    if (!pr || !TV.pres) return jugadaTV(0);
    quitarRot();
    pr.innerHTML = presHtml();   // quieta hasta que se vaya la cortina (arrancaTV)
    $('#tv-marco').classList.add('en-pres');   // el botón de pantalla completa no pisa al visitante
    TV.k = -1; TV.presT0 = null;
    clearTimeout(TV.tCortina); cortinaTV(true, 'RESUMEN EN VÍDEO', TV.ctx.abr.L + ' vs ' + TV.ctx.abr.V);
    saltarTV(TV.pres.desde);
  }
  function quitarPres() { const pr = $('#lz-presc'), m = $('#tv-marco'); if (pr) pr.innerHTML = ''; if (m) m.classList.remove('en-pres'); TV.presT0 = null; }
  // antes del vídeo, la escena del mapa con la pista (la del directo). El vídeo se desbloquea ya con el toque (sin volumen y
  // quieto) para que luego arranque con sonido; en pantalla completa o en el móvil, el mapa va dentro del vídeo
  function introTV() {
    const p = TV.player, m = $('#tv-marco');
    const fin = e => { if (!e.detail || e.detail === 'pista') sigue(); };
    const sigue = () => {
      if (!TV.intro) return;
      TV.intro = false; document.removeEventListener('mp-escena-fin', fin);
      try { p.setVolume(100); } catch (e) { /* sin reproductor */ }
      if (TV.pres) presentarTV(); else jugadaTV(TV.k);
    };
    TV.intro = true;
    try { p.setVolume(0); p.playVideo(); } catch (e) { /* sin reproductor */ }
    document.addEventListener('mp-escena-fin', fin);
    const dentro = esMovil() || document.fullscreenElement === m || m.classList.contains('tv-max');
    escenaPista(TV.S, dentro ? m.querySelector('.tv-giro') : null).then(ok => { if (!ok) sigue(); });
  }
  function arrancaTV() {   // ya sin cortina: la presentación echa a andar y entra el rótulo que esperaba
    const pr = $('.lz-pres.espera');
    if (pr && TV.player) { pr.classList.remove('espera'); TV.presT0 = TV.player.getCurrentTime(); }
    if (TV.pend) { const f = TV.pend; TV.pend = null; f(); }
  }
  // el lienzo de 1920×1080 encaja en la imagen del vídeo (con bandas si la pantalla no es 16:9)
  function lienzoTV() {
    const g = $('#tv-marco .tv-giro'), capa = g && g.querySelector('.tv-capa');
    if (!capa) return;
    const W = g.clientWidth, H = g.clientHeight, k = Math.min(W / 1920, H / 1080);
    capa.style.setProperty('--k', k.toFixed(5));
    capa.style.setProperty('--ox', ((W - 1920 * k) / 2).toFixed(1) + 'px');
    capa.style.setProperty('--oy', ((H - 1080 * k) / 2).toFixed(1) + 'px');
  }

  function jugadaTV(k) {   // resumen: a la jugada k (unos segundos antes); al acabarlas, el resultado
    TV.k = k; TV.acabado = false; TV.finHasta = 0; TV.pend = null;
    quitarRot();
    const x = TV.marcas[k], p = TV.player, t = p && p.getCurrentTime ? p.getCurrentTime() : 0;
    if (!x) {   // el resultado, y el vídeo sigue unos 20 s (la celebración) antes de pararse
      TV.finVisto = true; rotuloTV(rotTarjeta(true), -2);
      const ult = TV.marcas[TV.marcas.length - 1], total = p && p.getDuration ? p.getDuration() : 0;
      let desde = t;
      if (ult && t < ult.s) {   // llegando con «Adelantar» antes de la última jugada: a la celebración, no a lo de antes
        desde = ult.s + 1; clearTimeout(TV.tCortina); cortinaTV(true, 'RESUMEN', 'FINAL'); saltarTV(desde);
      }
      TV.finHasta = Math.min(total ? total - 1 : desde + CELEBRA, desde + CELEBRA);
      return;
    }
    const destino = Math.max(0, x.s - (x.ancla ? 2 : x.desc ? 1 : ANTES_JUGADA));
    const pen = x.pen && TV.modo === 'resumen' ? () => { if (TV.k === k) rotuloTV(rotPen(x), k); } : null;
    if (p && p.getPlayerState && p.getPlayerState() === 1 && destino >= t - 2.5 && destino <= t + 3) {   // ya está ahí: sin saltar
      if (pen) pen(); else if (!x.pen && x.s - ANTES_ROT <= t) rotuloTV(rotDe(x), k);
      return;
    }
    clearTimeout(TV.tCortina); cortinaTV(true, 'RESUMEN', tramoTV(x));   // el salto, tapado: qué tramo viene
    TV.pend = pen;
    saltarTV(destino);
  }
  function partidoSN(idp, ruta) {   // el partido del acta (servicio del directo); al llegar se repinta la ruta
    const S = (RSM.final && RSM.final.idp === idp && RSM.final) || LIVE.snaps[idp];
    if (S) return S;
    const url = DIRECTO_EJEMPLO ? DIRECTO_URL : DIRECTO_URL + '?idp=' + encodeURIComponent(idp);
    fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(d => {
      const x = (d.partidos || []).find(p => p.idp === idp);
      if (x) { RSM.final = x; if (location.hash.indexOf(ruta) === 0) render(); return; }
      const w = $('[data-espera]'); if (w) w.textContent = 'No encuentro este partido en el acta de la federación.';
    }).catch(() => { const w = $('[data-espera]'); if (w) w.textContent = 'Sin conexión con el acta de la federación.'; });
    return null;
  }
  function pararTV() {
    pararMusica();
    if (TV.timer) clearInterval(TV.timer);
    TV.timer = null;
    if (TV.ro) { TV.ro.disconnect(); TV.ro = null; }
    try { if (TV.player && TV.player.destroy) TV.player.destroy(); } catch (e) { /* ya no está */ }
    TV.player = null;
  }
  // estado del marcador en el segundo t del vídeo: goles (cada uno cuenta al irse su rótulo), reloj y expulsiones vigentes
  function estadoTV(t) {
    const M = TV.relojM || TV.marcas.filter(x => !x.desc), dur = TV.dur, a2 = M.find(x => x.ancla && x.p === 2), goles = { L: 0, V: 0 };
    M.forEach(x => { if (x.e && x.e.tipo === 'GOL' && t >= x.s - ANTES_ROT + durRot(x)) goles[x.e.lado]++; });
    const antes = M.filter(x => x.s <= t), u = antes[antes.length - 1];
    if (!u) return { goles, fase: 'previa', reloj: { tx: '' }, pildora: '' };
    if (u.p === 3) { const ult = M.filter(x => x.pen).pop(), fin = ult && t > ult.s + 6; return { goles, fase: fin ? 'final' : 'penaltis', reloj: { tx: fin ? 'FINAL' : 'PENALTIS' }, pildora: '' }; }
    const sig = M.find(x => x.s > t && x.p === u.p);
    let G = sig ? u.G + (t - u.s) * (sig.G - u.G) / Math.max(1, sig.s - u.s) : u.G + (t - u.s) / RITMO_VIDEO;
    G = Math.min(G, u.p * dur);
    const fase = G < u.p * dur ? 'p' + u.p : u.p === 1 ? (a2 && t >= a2.s ? 'p2' : 'descanso') : M.some(x => x.pen) ? 'tiempo' : 'final';   // con tanda, aún no es el final
    const reloj = fase === 'descanso' ? { tx: 'DESCANSO' } : fase === 'tiempo' ? { tx: 'PENALTIS' } : fase === 'final' ? { tx: 'FINAL' } : { pe: ordinal(u.p), tm: mmss2(G - (u.p - 1) * dur) };
    // expulsiones: la píldora sale al irse su rótulo y cuenta atrás hasta que se cumplen (o cambia la parte)
    const fuera = fase[0] === 'p' ? M.filter(x => x.e && exclusion(x.e) && x.p === u.p && t >= x.s - ANTES_ROT + durRot(x) && G < x.G + (x.e.min_sancion || 2) * 60)
      .map(x => ({ lado: x.e.lado, queda: x.G + (x.e.min_sancion || 2) * 60 - G })) : [];
    let pildora = '';
    if (fuera.length) {
      const n = { L: 4, V: 4 }, q = Math.min(...fuera.map(f => f.queda));
      fuera.forEach(f => { n[f.lado] = Math.max(3, n[f.lado] - 1); });
      const mas = n.L > n.V ? 'L' : n.V > n.L ? 'V' : null;
      pildora = mas ? `${n[mas]} c ${n[mas === 'L' ? 'V' : 'L']} · ${TV.ctx.abr[mas]} · ${mmssV(q)}` : `${n.L} c ${n.V} · ${mmssV(q)}`;
    }
    return { goles, fase, reloj, pildora };
  }
  const marcadorHtml = ctx => `<div class="lz-marc" id="lz-marc"><div class="caja"><div class="seg l" id="lz-sl" style="${varsTV('L')}">${imgEsc('L')}<span class="ab">${esc(ctx.abr.L)}</span><span class="g" id="lz-gl">0</span></div><div class="seg v" id="lz-sv" style="${varsTV('V')}"><span class="g" id="lz-gv">0</span><span class="ab">${esc(ctx.abr.V)}</span>${imgEsc('V')}</div><div class="rl" id="lz-rl"></div></div><div class="ex" id="lz-ex" hidden></div></div>`;
  function pintarMarc(st, t, natural) {
    const m = $('#lz-marc');
    if (!m) return;
    const a1 = TV.marcas.find(x => x.ancla && x.p === 1);   // desde el inicio de la 1.ª parte hasta el final
    m.classList.toggle('on', a1 ? t >= a1.s : st.fase !== 'previa');
    ['L', 'V'].forEach(l => {
      const g = $('#lz-g' + l.toLowerCase()), v = String(st.goles[l]);
      if (g.textContent !== v) { g.textContent = v; g.classList.remove('salta'); if (natural) { void g.offsetWidth; g.classList.add('salta'); } }
      $('#lz-s' + l.toLowerCase()).classList.toggle('gol', !!(TV.rot && !TV.rot.sale && TV.rot.gol === l));   // el que marca, teñido
      g.classList.toggle('b', st.fase === 'final' && !!TV.S.penaltis && TV.S.penaltis.ganador === l);   // la B del que gana la tanda
    });
    const rl = $('#lz-rl'), html = st.reloj.tx != null ? `<span class="tx">${st.reloj.tx}</span>` : `<span class="pe">${st.reloj.pe}</span><span class="tm">${st.reloj.tm}</span>`;
    if (TV.rlHtml !== html) { rl.innerHTML = html; TV.rlHtml = html; }
    const ex = $('#lz-ex');
    if (st.pildora) { if (ex.hidden) ex.hidden = false; ex.textContent = st.pildora; } else if (!ex.hidden) ex.hidden = true;
  }
  function tickTV() {
    if (location.hash.indexOf('#/video/' + TV.idp) !== 0) { pararTV(); return; }
    const p = TV.player;
    if (!p || !p.getCurrentTime) return;
    if (TV.saltando) return;   // fundido antes de un salto: el vídeo viejo ya no cuenta
    const t = p.getCurrentTime(), prev = TV.t, natural = t > prev && t - prev < 2;
    const juega = (p.getPlayerState && p.getPlayerState() === 1) || natural;   // si el vídeo avanza, corre (aunque YouTube diga otra cosa)
    TV.t = t;
    const lz = $('#tv-lienzo');
    if (lz) lz.classList.toggle('pausado', !juega);   // en pausa (o cargando) las animaciones se congelan
    // en algunos móviles YouTube no avisa de que el vídeo sigue: si la cortina está puesta y el vídeo avanza, se quita
    const cort = $('#tv-cortina');
    if (TV.modo === 'resumen' && TV.empezado && !TV.intro && !TV.acabado && cort && cort.classList.contains('on') && natural) {
      if (++TV.avanza >= 6) {
        TV.avanza = 0; clearTimeout(TV.tCortina); cortinaTV(false); arrancaTV(); musica(true);
        clearTimeout(TV.tTapa); TV.tTapa = setTimeout(() => { const m = $('#tv-marco'); if (m) m.classList.remove('tapa'); }, 5600);
      }
    } else TV.avanza = 0;
    if (natural && TV.k < TV.marcas.length) TV.marcas.forEach((x, i) => {   // el vídeo avanza solo (no un salto): lo que acaba de pasar (tras el final, nada)
      if (x.pen) { if (x.s > prev && x.s <= t) tiroTV(x, i); return; }
      const e = x.s - ANTES_ROT;
      if (e > prev && e <= t && !(TV.rot && TV.rot.k === i)) rotuloTV(rotDe(x), i);
    });
    if (TV.rot && TV.rot.fin != null) {
      if (!TV.rot.sale && t >= TV.rot.fin - 0.35) { TV.rot.sale = true; TV.rot.el.classList.add('sale'); const gr = $('#lz-grad'); if (gr) gr.classList.remove('on'); }
      if (t >= TV.rot.fin) quitarRot();
    }
    const st = estadoTV(t);
    pintarMarc(st, t, natural);
    if (TV.modo === 'resumen' && TV.empezado && !TV.intro) {   // la música baja al empezar el partido y sube cuando ya hay ganador
      const a1 = TV.marcas.find(x => x.ancla && x.p === 1), ultPen = TV.marcas.filter(x => x.pen).pop();
      const decidido = TV.k >= TV.marcas.length || st.fase === 'final' || (ultPen && t >= ultPen.s);
      const jugando = TV.k >= 0 && (!a1 || t >= a1.s - 1);
      nivelM(jugando && !decidido ? MUS_BAJO : MUS_VOL);
    }
    if (TV.presT0 != null) { const pr = $('.lz-pres'); if (pr && t >= TV.presT0 + 6.6) pr.classList.add('fuera'); if (t >= TV.presT0 + 7) quitarPres(); }
    if (TV.modo === 'entero' && natural && st.fase === 'final' && !TV.finVisto) { TV.finVisto = true; rotuloTV(rotTarjeta(true), -2); }
    if (TV.modo === 'resumen' && TV.k >= TV.marcas.length && TV.finHasta && t >= TV.finHasta) {   // vista la celebración, fin
      TV.finHasta = 0; TV.acabado = true; p.pauseVideo();
    }
    if (TV.modo === 'resumen' && TV.k < TV.marcas.length && juega) {   // acabada la jugada, a la siguiente
      if (TV.k === -1) { if (t >= TV.pres.hasta) jugadaTV(0); return; }   // presentación hasta el saque
      const x = TV.marcas[TV.k];
      if (t >= x.s + despues(x)) jugadaTV(TV.k + 1);
    }
  }
  const ICO_ANT = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="2.5" height="14" rx="1"/><path d="M19 5v14L8.5 12z"/></svg>';
  const ICO_FULL = '<svg class="ab" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
  const ICO_SALIR = '<svg class="ce" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>';
  const ICO_SIG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="16.5" y="5" width="2.5" height="14" rx="1"/><path d="M5 5v14l10.5-7z"/></svg>';
  // #/video/{idp} (resumen), #/video/{idp}/{segundo} (resumen desde esa jugada) y, escondido, #/video/{idp}/entero
  function vVideo(idp, seg) {
    if (!VID) { cargarVideos().then(() => { if (location.hash.indexOf('#/video/' + idp) === 0) render(); }); return SKEL(360); }
    const v = VID[idp];
    if (!v) return '<div class="loading">Este partido aún no tiene vídeo sincronizado.</div>';
    const S = partidoSN(idp, '#/video/' + idp);
    if (!S) return `<div data-espera>${SKEL(360)}</div>`;
    cargarHitos();
    pararTV();
    const ctx = ctxDirecto(S), dur = S.duracion_periodo || 1500, partes = v.partes || {};
    const tanda = (S.penaltis && S.penaltis.tanda) || [];
    const todas = [1, 2, 3].filter(p => partes[p] != null).map(p => ({ s: partes[p], G: (p - 1) * dur, p, ancla: true }))
      .concat(Object.entries(v.ev || {}).map(([id, x]) => {
        const m = /^pen-(\d+)-([LV])$/.exec(id);
        if (m) return { s: x.s, G: 2 * dur, p: 3, pen: tanda.find(y => y.ronda === +m[1] && y.lado === m[2]) };
        return { s: x.s, G: (x.p - 1) * dur + (segs(x.t) || 0), p: x.p, e: (S.eventos || []).find(e => e.id === id) };
      }).filter(x => x.e || x.pen))
      .sort((a, b) => a.s - b.s);
    // los tiempos muertos no salen en el resumen (no aportan, lo pidió el usuario); sus marcas solo afinan el reloj
    const marcas = todas.filter(x => !(x.e && x.e.tipo === 'TIEMPO MUERTO'));
    // el descanso: la tarjeta con los goleadores, unos segundos antes de la 2.ª parte (si hay hueco tras la 1.ª)
    const ult1 = Math.max(partes[1] || 0, ...marcas.filter(x => x.p === 1).map(x => x.s));
    if (partes[2] != null && partes[2] - 6 > ult1 + 10) { marcas.push({ s: partes[2] - 6, p: 1, desc: true }); marcas.sort((a, b) => a.s - b.s); }
    const modo = seg === 'entero' ? 'entero' : 'resumen';
    const desde = /^\d+$/.test(seg || '') ? Math.max(0, marcas.findIndex(x => x.s >= +seg)) : 0;   // desde un «▶»: esa jugada
    const saque = partes[1];   // presentación solo si se empieza por el principio y el vídeo trae calentamiento
    const pres = modo === 'resumen' && desde === 0 && saque >= PRES_MIN && (S.plantillas || {}).L ? { desde: Math.max(0, saque - 7.6), hasta: saque - 1.5 } : null;
    const gen = TV.gen = (TV.gen || 0) + 1;   // si se repinta mientras carga YouTube, solo vale el último
    Object.assign(TV, { intro: false, idp, S, ctx, dur, marcas, relojM: todas, modo, k: desde, t: 0, start: 0, finVisto: false, listo: false, pres, bloqueado: false, rot: null, pend: null, presT0: null, rlHtml: '', saltando: false, salto: 0, avanza: 0 });
    setTimeout(() => {
      if (TV.gen !== gen) return;
      const g = $('#tv-marco .tv-giro');
      if (g && window.ResizeObserver) { TV.ro = new ResizeObserver(lienzoTV); TV.ro.observe(g); }
      lienzoTV();
      cargarYT().then(() => {
        if (location.hash.indexOf('#/video/' + idp) !== 0 || TV.gen !== gen) return;
        const pv = modo === 'resumen'   // en el resumen, sin los controles de YouTube: solo los nuestros
          ? { autoplay: 0, controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, modestbranding: 1, iv_load_policy: 3 }
          : { autoplay: 1, rel: 0, playsinline: 1, fs: 0, modestbranding: 1 };
        TV.player = new YT.Player('tv-player', { host: 'https://www.youtube-nocookie.com', videoId: v.yt, playerVars: pv,
          events: { onReady: ev => { TV.listo = true; if (modo !== 'resumen') ev.target.playVideo(); },
            onStateChange: () => pintarPausa() } });
        TV.timer = setInterval(tickTV, 100);
      });
    }, 0);
    return `<div class="tv"><div class="tv-tit"><div><div class="lab" style="color:#FF6B63">RESUMEN EN VÍDEO${v.canal ? ' · ' + esc(v.canal) : ''}</div>
        <h1>${esc(S.local)} <span>${S.penaltis && S.penaltis.ganador === 'L' ? bPen() : ''}${S.gl ?? ''}–${S.gv ?? ''}${S.penaltis && S.penaltis.ganador === 'V' ? bPen() : ''}</span> ${esc(S.visitante)}</h1></div></div>
      <div class="tv-marco${modo === 'resumen' ? ' bloq' : ''}" id="tv-marco"><div class="tv-giro"><div id="tv-player"></div>
        <div class="tv-capa">
          ${modo === 'resumen' ? '<div class="tv-tapa" aria-hidden="true"></div>' : ''}
          <div class="tv-lienzo pausado" id="tv-lienzo"><div class="lz-in"><div class="lz-velo"></div><div class="lz-grad" id="lz-grad"></div>${marcadorHtml(ctx)}<div id="lz-rots" role="status" aria-live="polite"></div><div id="lz-presc"></div></div></div>
          ${modo === 'resumen' ? `<div class="tv-cortina on" id="tv-cortina"><div class="tc"><img class="tc-esc" src="escudos/badge/madridpatina-alpha.svg" alt=""><b class="tc-nom">MADRIDPATINA</b><i class="tc-raya"></i><div class="tc-pill"><span class="d" id="tv-cortina-t">RESUMEN EN VÍDEO</span><span class="t" id="tv-cortina-i">${esc(ctx.abr.L)} vs ${esc(ctx.abr.V)}</span></div><button type="button" class="tc-otra" id="tv-otra" data-tv="otra" hidden>↺ Ver otra vez</button></div></div>` : ''}
          <button type="button" class="tv-full" data-tv="full" title="Pantalla completa" aria-label="Pantalla completa">${ICO_FULL}${ICO_SALIR}</button>
          ${modo === 'resumen' ? `<div class="tv-ctrl"><button type="button" data-tv="prev" aria-label="Atrasar evento" title="Atrasar evento">${ICO_ANT}</button><button type="button" data-tv="next" aria-label="Adelantar evento" title="Adelantar evento">${ICO_SIG}</button></div>
          <button type="button" class="tv-empieza" id="tv-empieza" data-tv="empieza"><b aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg></b><span>Ver el resumen</span><small>En el móvil se verá a pantalla completa y en horizontal</small></button>` : ''}
        </div></div></div></div>
      ${(() => { const pm = Object.values(A.partidos).find(x => x.idp === idp); setTimeout(() => cargarReac(idp, true), 0);
        return `<div class="an-grid dos tv-aficion" style="margin-top:12px"><div data-reac-caja="${esc(idp)}"></div>${pm && pm.nuestro ? `<div data-voto="${esc(pm.mid)}"></div>` : ''}</div>`; })()}`;
  }
  /* Música de fondo del resumen: «Energetic Sport» de MondaMusic (Pixabay, licencia de contenido de Pixabay: uso libre y
     sin citar), en assets/audio/musica-resumen.mp3 a 128 kbps y con el volumen nivelado. Suena baja y en bucle, y se para
     y sigue con el vídeo. El volumen va por Web Audio (en el iPhone el del <audio> no se puede cambiar). */
  const MUS = { ctx: null, gain: null, el: null, quiere: false, nivel: 0.14 };
  // más alta en el mapa y la presentación y otra vez al decidirse el ganador; durante el partido, bajita
  const MUS_VOL = 0.14, MUS_BAJO = 0.045, MUS_SRC = 'assets/audio/musica-resumen.mp3';
  function rampaM(v, seg) {
    if (MUS.gain) { const g = MUS.gain.gain, t = MUS.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); g.exponentialRampToValueAtTime(Math.max(0.0001, v), t + seg); }
    else if (MUS.el) MUS.el.volume = v;
  }
  function musica(on) {
    MUS.quiere = on;
    if (on && !MUS.el) {
      try {
        const el = new Audio(MUS_SRC);
        el.loop = true; el.preload = 'auto';
        MUS.el = el;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) { const c = new AC(), g = c.createGain(); g.gain.value = 0.0001; c.createMediaElementSource(el).connect(g); g.connect(c.destination); Object.assign(MUS, { ctx: c, gain: g }); }
        else el.volume = 0;
      } catch (e) { return; }
    }
    const el = MUS.el;
    if (!el) return;
    if (on) { if (MUS.ctx && MUS.ctx.state !== 'running') MUS.ctx.resume(); el.play().catch(() => {}); rampaM(MUS.nivel, 1.2); }
    else { rampaM(0, 0.4); setTimeout(() => { if (!MUS.quiere && MUS.el === el) el.pause(); }, 450); }
  }
  function nivelM(v) {   // cambio de nivel, suave (3 s)
    if (MUS.nivel === v) return;
    MUS.nivel = v;
    if (MUS.quiere && MUS.el) rampaM(v, 3);
  }
  function pararMusica() {
    if (MUS.el) { MUS.el.pause(); MUS.el.removeAttribute('src'); MUS.el.load(); }
    if (MUS.ctx) try { MUS.ctx.close(); } catch (e) { /* ya cerrado */ }
    Object.assign(MUS, { ctx: null, gain: null, el: null, quiere: false, nivel: MUS_VOL });
  }
  // pantalla completa de la caja del vídeo (la capa va dentro); en el iPhone, que no la deja, ocupa la ventana
  function pantallaTV(entrar) {
    const m = $('#tv-marco');
    if (!m) return;
    const caja = m.closest('.tv');   // su animación de entrada deja un transform que haría de marco a la ventana entera
    if (!entrar) { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); m.classList.remove('tv-max'); caja.classList.remove('sin-anim'); return; }
    const bloquea = () => { try { screen.orientation.lock('landscape').then(() => { TV.bloqueado = true; ajustarGiro(); }).catch(ajustarGiro); } catch (e) { ajustarGiro(); } };
    const ventana = () => { if (document.fullscreenElement === m || m.classList.contains('tv-max')) return; caja.classList.add('sin-anim'); m.classList.add('tv-max'); ajustarGiro(); };
    // hay navegadores (los de dentro de otras apps, el integrado…) en los que la petición se queda sin respuesta:
    // si en 0,7 s no hay pantalla completa, el vídeo ocupa la ventana entera
    if (m.requestFullscreen) { m.requestFullscreen().then(bloquea).catch(ventana); setTimeout(() => { if (document.fullscreenElement !== m) ventana(); }, 700); }
    else ventana();
  }
  const esMovil = () => matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
  function pintarPausa() {
    const p = TV.player;
    if (!p || !p.getPlayerState || TV.modo !== 'resumen' || !TV.empezado) return;
    if (TV.intro) { if (p.getPlayerState() === 1) p.pauseVideo(); return; }   // durante el mapa, el vídeo quieto
    const st = p.getPlayerState(), lz = $('#tv-lienzo');
    if (lz) lz.classList.toggle('pausado', st !== 1);   // en pausa se congelan las animaciones y el reloj
    if (st === 1) musica(true); else if (st === 2 || st === 0) musica(false);   // la música, con el vídeo
    // cortina: en pausa (YouTube enseña su título y otros vídeos) y mientras carga tras un salto; al correr, se va
    clearTimeout(TV.tCortina);
    if (st === 2) cortinaTV(true, TV.acabado ? 'FIN DEL RESUMEN' : 'EN PAUSA', TV.acabado ? resultadoTV() : 'PULSA PARA SEGUIR');
    const otra = $('#tv-otra'); if (otra) otra.hidden = !(st === 2 && TV.acabado);
    else if (st === 1) TV.tCortina = setTimeout(() => { cortinaTV(false); arrancaTV(); }, 450);
    if (st === 1) { clearTimeout(TV.tTapa); TV.tTapa = setTimeout(() => { const m = $('#tv-marco'); if (m) m.classList.remove('tapa'); }, 5600); }
    else tapaTV();
  }
  function cortinaTV(on, txt, info) {
    const el = $('#tv-cortina');
    if (!el) return;
    if (txt) { const t = $('#tv-cortina-t'); if (t) t.textContent = txt; }
    if (info != null) { const t = $('#tv-cortina-i'); if (t) t.textContent = info; }
    el.classList.toggle('on', on);
    el.classList.toggle('pausa', on && txt === 'EN PAUSA');
  }
  // en la cortina: el tramo al que se salta (sin decir qué pasa) y, al acabar, el resultado
  const tramoTV = x => (x.ancla ? (x.p === 3 ? 'TANDA DE PENALTIS' : ordinal(x.p) + ' PARTE') : x.desc ? 'DESCANSO' : x.pen ? 'PENALTIS · RONDA ' + x.pen.ronda : ordinal(x.p) + ' PARTE · ' + mmss2(x.G - (x.p - 1) * TV.dur));
  function resultadoTV() {
    const S = TV.S, a = TV.ctx.abr, pen = S.penaltis && (S.penaltis.tanda || []).length ? S.penaltis : null;
    return `${a.L} ${S.gl ?? 0}–${S.gv ?? 0} ${a.V}` + (pen ? ` · PEN ${pen.gl}–${pen.gv}` : '');
  }
  function saltaTV(k) {
    if (k === -1 && TV.pres) { presentarTV(); return; }
    quitarPres();
    jugadaTV(Math.max(0, Math.min(k, TV.marcas.length)));
  }
  // horizontal sin pedir nada: si el móvil sigue en vertical (el iPhone no deja girar la pantalla desde una web), la imagen
  // se dibuja girada 90° ocupando toda la pantalla; si el móvil se gira de verdad, vuelve a lo normal
  const vertical = matchMedia('(orientation: portrait)');
  function ajustarGiro() {
    const m = $('#tv-marco'), g = m && m.querySelector('.tv-giro');
    if (!g) return;
    const lleno = document.fullscreenElement === m || m.classList.contains('tv-max');
    if (!(lleno && esMovil() && vertical.matches)) { g.removeAttribute('style'); m.classList.remove('rot'); lienzoTV(); return; }
    const r = m.getBoundingClientRect();
    m.classList.add('rot');
    Object.assign(g.style, { inset: 'auto', top: '0', left: '0', width: r.height + 'px', height: r.width + 'px', transformOrigin: 'top left', transform: `translateX(${r.width}px) rotate(90deg)` });
    lienzoTV();
  }
  if (vertical.addEventListener) vertical.addEventListener('change', () => setTimeout(ajustarGiro, 120));
  window.addEventListener('resize', () => { if ($('#tv-marco')) ajustarGiro(); });
  document.addEventListener('keydown', e => { const m = $('#tv-marco'); if (e.key === 'Escape' && m && m.classList.contains('tv-max')) pantallaTV(false); });   // Esc: vuelve a su tamaño
  document.addEventListener('fullscreenchange', () => { const m = $('#tv-marco'); if (!m) return; if (!document.fullscreenElement) { try { screen.orientation.unlock(); } catch (e) { /* nada que soltar */ } } setTimeout(ajustarGiro, 120); });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tv]');
    if (!b) {   // un toque en el vídeo: pausa / sigue (sin botón a la vista)
      const p = TV.player;
      if (TV.empezado && !TV.acabado && p && p.getPlayerState && e.target.closest('.tv-marco.bloq .tv-capa')) { if (p.getPlayerState() === 1) p.pauseVideo(); else p.playVideo(); }
      return;
    }
    const p = TV.player, a = b.dataset.tv;
    if (a === 'empieza' && p && TV.listo) {   // un toque: con sonido y, en el móvil, a pantalla completa y en horizontal
      b.remove();
      TV.empezado = true;
      if (esMovil()) pantallaTV(true);
      p.unMute();
      musica(true);   // el audio solo arranca con un toque: aquí
      introTV();
    }
    if (!TV.empezado) return;
    if (a === 'prev') saltaTV(TV.k <= 0 ? (TV.pres ? -1 : 0) : TV.k - 1);
    if (a === 'next' && TV.k < TV.marcas.length && !TV.acabado) saltaTV(TV.k + 1);   // tras el final no se sigue
    if (a === 'otra') { TV.acabado = false; quitarRot(); if (TV.pres) presentarTV(); else jugadaTV(0); }   // ver el resumen otra vez
    if (a === 'full') { const m = $('#tv-marco'); pantallaTV(!(document.fullscreenElement === m || m.classList.contains('tv-max'))); }
  });

  /* ── Sincronizar el vídeo de un partido (#/sincronizar/{idp}) ──────────────────────────────────────────────────────
     Se pega el enlace de YouTube; la página va jugada por jugada (inicio de cada parte, goles, expulsiones,
     cambios de portero), lleva el vídeo a unos segundos antes del momento estimado y basta con pulsar «¡Ahora!». Cada marca
     afina la estimación de la siguiente. Al final da un código que se añade a data/videos.json (scripts/reporte/videos.json). */
  const SY = { idp: null, S: null, items: [], i: 0, yt: '', canal: '', player: null, modo: 'jugadas', tiros: [], t: -1, msg: '' };
  const RITMO_VIDEO = 1.45;   // minutos de vídeo por minuto de juego (senior, medido en octubre de 2026)
  const ytId = u => { const m = /(?:youtu\.be\/|[?&]v=|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/.exec(u || '') || /^\s*([\w-]{11})\s*$/.exec(u || ''); return m ? m[1] : null; };
  const mmssV = t => { t = Math.max(0, Math.round(t)); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, x = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const cargarYT = () => (window.YT && window.YT.Player ? Promise.resolve() : window._ytP || (window._ytP = new Promise(res => {
    window.onYouTubeIframeAPIReady = res; const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(sc); })));
  function itemsSync(S) {
    const ctx = ctxDirecto(S), out = [];
    const quien = e => (e.tipo === 'TIEMPO MUERTO' ? ctx.abr[e.lado] : (e.tipo === 'CAMBIO DE PORTERO' ? 'Entra ' : '') + quienD(ctx, e.lado, e.dorsal, e.jugador_corto, e.jugador) + ' (' + ctx.abr[e.lado] + ')');
    const evs = (S.eventos || []).filter(e => e.periodo && e.t && !/^pc-/.test(e.id || '') && TIPO_VID[e.tipo] && e.tipo !== 'TIEMPO MUERTO');   // los tiempos muertos ya no se marcan: el resumen no los usa
    [1, 2].forEach(p => {
      out.push({ id: 'inicio-' + p, ancla: true, p, g: 0, tipo: 'INICIO', txt: 'Empieza la ' + ordinal(p) + ' parte' });
      evs.filter(e => e.periodo === p).sort((a, b) => segs(a.t) - segs(b.t)).forEach(e => out.push({ id: e.id, p, g: segs(e.t), tipo: e.tipo, e, q: quien(e),
        txt: e.tipo === 'TIEMPO MUERTO' ? 'Tiempo muerto · ' + ctx.abr[e.lado] : (TIPO_VID[e.tipo] || e.tipo) + ' · ' + quien(e) + (e.tipo === 'GOL' && e.marcador ? ' · ' + e.marcador.replace('-', '–') : '') }));
    });
    const tanda = ((S.penaltis && S.penaltis.tanda) || []).slice().sort((a, b) => a.ronda - b.ronda || (a.lado === 'L' ? -1 : 1));
    if (tanda.length) {
      out.push({ id: 'tanda', ancla: true, p: 3, g: 0, tipo: 'TANDA', txt: 'Empieza la tanda de penaltis' });
      tanda.forEach((y, k) => { const q = quienD(ctx, y.lado, y.dorsal, y.jugador_corto, y.jugador) + ' (' + ctx.abr[y.lado] + ')';
        out.push({ id: 'pen-' + y.ronda + '-' + y.lado, p: 3, g: k + 1, tipo: 'PENALTI', pen: y, q, txt: 'Penalti · ronda ' + y.ronda + ' · ' + q + ' · ' + (y.gol ? 'gol' : 'falla') }); });
    }
    return out;
  }
  function estimaSync(k) {
    const it = SY.items[k], hechos = SY.items.slice(0, k).filter(x => x.s != null), ult = hechos[hechos.length - 1];
    if (!ult) return 0;
    if (it.p === 3) return ult.p === 3 ? ult.s + 40 : ult.s + Math.max(0, (SY.S.duracion_periodo || 1500) - ult.g) * RITMO_VIDEO + 120;   // la tanda: tras el final, un lanzamiento cada ~40 s
    if (ult.p === it.p) {
      const ini = SY.items.find(x => x.p === it.p && x.ancla && x.s != null);
      const r = ini && ult !== ini && ult.g > 60 ? (ult.s - ini.s) / ult.g : RITMO_VIDEO;
      return ult.s + (it.g - ult.g) * Math.max(1, Math.min(2.2, r));
    }
    const dur = SY.S.duracion_periodo || 1500;   // otra parte: lo que quedaba de la anterior y unos minutos de descanso
    return ult.s + Math.max(0, dur - ult.g) * RITMO_VIDEO + 300 + it.g * RITMO_VIDEO;
  }
  const guardaSync = () => { try { localStorage.setItem('mp-sync-' + SY.idp, JSON.stringify({ yt: SY.yt, canal: SY.canal, m: Object.fromEntries(SY.items.filter(x => x.s != null).map(x => [x.id, x.s])),
    d: Object.fromEntries(SY.items.filter(x => x.xy || x.pista).map(x => [x.id, { xy: x.xy || null, pista: x.pista || null }])), tiros: SY.tiros })); } catch (e) { /* sin almacenamiento: no pasa nada */ } };
  const datosSync = (partes, ev) => Object.assign({ yt: SY.yt, canal: SY.canal || null, partes, ev },
    SY.tiros.length ? { tiros: SY.tiros.filter(t => t.lado && t.r).map(t => ({ s: Math.round(t.s), lado: t.lado, dorsal: t.dorsal || null, xy: t.xy ? t.xy.map(v => Math.round(v * 1000) / 1000) : null, r: t.r })) } : {});
  function codigoSync() {
    const ev = {}, partes = {};
    SY.items.forEach(x => { if (x.s == null) return; if (x.ancla) partes[x.p] = Math.round(x.s);
      else if (x.pen) ev[x.id] = { s: Math.round(x.s), tipo: 'PENALTI', p: 3, t: null, lado: x.pen.lado, q: x.q, m: x.pen.gol ? 'gol' : 'fallo', ronda: x.pen.ronda };
      else ev[x.id] = Object.assign({ s: Math.round(x.s), tipo: x.tipo, p: x.p, t: x.e.t, lado: x.e.lado, q: x.q, m: x.e.marcador || null },
        x.xy ? { xy: x.xy.map(v => Math.round(v * 1000) / 1000) } : {}, x.pista && (x.pista.L.length || x.pista.V.length) ? { pista: x.pista } : {}); });
    return JSON.stringify({ [SY.idp]: datosSync(partes, ev) });
  }
  function pintarSync() {
    const lista = $('#sy-lista'), act = $('#sy-actual'), cod = $('#sy-codigo');
    if (!lista) return;
    const it = SY.items[SY.i];
    act.innerHTML = it ? `<span class="n">${SY.i + 1}/${SY.items.length}</span><b>${esc(it.txt)}</b><span class="t">${it.ancla ? '' : it.pen ? 'Tanda de penaltis' : esc(ordinal(it.p) + ' parte · minuto ' + it.e.t + ' de juego')}${it.s != null ? ' · marcado en ' + mmssV(it.s) : ''}</span>`
      : '<b>¡Listo! Copia el código de abajo y pásamelo.</b>';
    lista.innerHTML = SY.items.map((x, k) => `<button type="button" class="sy-it${k === SY.i ? ' on' : ''}${x.s != null ? ' ok' : ''}${x.ancla ? ' ancla' : ''}" data-sy="ir" data-k="${k}"><span class="s">${x.s != null ? mmssV(x.s) : '—'}</span><span>${esc(x.txt)}</span></button>`).join('');
    const hechas = SY.items.filter(x => x.s != null && !x.ancla).length;
    pintarGolSync();
    pintarTirosSync();
    cod.value = hechas ? codigoSync() : '';
    $('#sy-n').textContent = hechas + ' de ' + SY.items.filter(x => !x.ancla).length + ' jugadas marcadas' + (SY.tiros.length ? ' · ' + SY.tiros.length + ' tiros' : '');
    const m = $('#sy-msg'); if (m) m.textContent = SY.msg;
  }
  // dibujo de media pista (la zona de ataque, con la portería arriba) y los jugadores de cada equipo nuestro
  const PISTA_W = 300, PISTA_H = 270;
  // distancia aproximada a la portería: el dibujo es media pista de 20 m de ancho (pista de unos 40 × 20 m); la portería, en (150, 28)
  const distM = xy => Math.round(Math.hypot((xy[0] - 0.5) * PISTA_W, xy[1] * PISTA_H - 28) * 20 / PISTA_W);
  const mediaPista = (puntos, attrs = '') => `<svg viewBox="0 0 ${PISTA_W} ${PISTA_H}" ${attrs}>
      <path d="M2,${PISTA_H - 3} L2,36 Q2,2 36,2 L${PISTA_W - 36},2 Q${PISTA_W - 2},2 ${PISTA_W - 2},36 L${PISTA_W - 2},${PISTA_H - 3} Z" fill="#1E1E22" stroke="#55555B" stroke-width="2"/>
      <line x1="2" x2="${PISTA_W - 2}" y1="${PISTA_H - 3}" y2="${PISTA_H - 3}" stroke="#D3202A" stroke-width="3"/>
      <line x1="20" x2="${PISTA_W - 20}" y1="34" y2="34" stroke="#55555B" stroke-width="1.5"/>
      <path d="M${PISTA_W / 2 - 36},34 A36,36 0 0 0 ${PISTA_W / 2 + 36},34" fill="rgba(111,183,255,.12)" stroke="#6FB7FF" stroke-width="1.5"/>
      <rect x="${PISTA_W / 2 - 17}" y="22" width="34" height="12" fill="none" stroke="#F4F4F5" stroke-width="2"/>
      <circle cx="${PISTA_W / 2}" cy="${PISTA_H - 3}" r="42" fill="none" stroke="#55555B" stroke-width="1.5"/>${puntos}</svg>`;
  function pintarGolSync() {
    const box = $('#sy-gol'); if (!box) return;
    const it = SY.items[SY.i];
    if (SY.modo === 'tiros' || !it || it.tipo !== 'GOL') { box.innerHTML = ''; return; }
    const ctx = ctxDirecto(SY.S), lados = ['L', 'V'].filter(l => ctx.mp[l]);
    const punto = it.xy ? `<circle cx="${it.xy[0] * PISTA_W}" cy="${it.xy[1] * PISTA_H}" r="9" fill="#D3202A" stroke="#FFFFFF" stroke-width="2"/>` : '';
    const chips = l => ((SY.S.plantillas || {})[l] || []).slice().sort((a, b) => (+a.dorsal) - (+b.dorsal)).map(j => { const on = it.pista && it.pista[l].includes(String(j.dorsal));
      return `<button type="button" class="an-tog" aria-pressed="${on ? 'true' : 'false'}" data-sy="pj" data-l="${l}" data-d="${esc(j.dorsal)}">#${esc(j.dorsal)} ${esc(j.jugador_corto || j.jugador || '')}</button>`; }).join('');
    const hay = SY.items.slice(0, SY.i).some(x => x.pista);
    box.innerHTML = `<div class="sy-gol-cols"><div><div class="lab">DESDE DÓNDE SE TIRÓ</div><div class="an-nota" style="margin-top:2px">Mirando a la portería en la que entró. Toca en el dibujo.</div>
        ${mediaPista(punto, 'class="sy-pista" data-sy-pista width="100%" role="img" aria-label="Media pista: toca desde dónde se tiró"')}${it.xy ? `<div class="an-frase" style="margin:6px 0">A unos ${distM(it.xy)} m de la portería</div><button type="button" class="an-tog" data-sy="xy-borra">Borrar el punto</button>` : ''}</div>
      <div><div class="lab">QUIÉN ESTABA EN PISTA</div><div class="an-nota" style="margin-top:2px">Los ${lados.length > 1 ? 'de cada equipo' : 'nuestros'}, con el portero. ${hay ? '<button type="button" class="an-tog" data-sy="pj-igual">Igual que en el gol anterior</button>' : ''}</div>
        ${lados.map(l => `<div class="an-sub">${esc(ctx.abr[l])} · ${it.pista ? it.pista[l].length : 0} marcados</div><div class="an-togs">${chips(l)}</div>`).join('')}</div></div>
      <div class="an-nota">Cuando acabes con este gol, pulsa «Saltar ▶» para ir a la siguiente jugada.</div>`;
  }
  // modo tiros: cada tiro con quién tira, desde dónde y cómo acaba (los goles ya están en las jugadas del acta, con su sitio)
  const RES_TIRO = [['parada', 'Parada'], ['fuera', 'Fuera'], ['bloqueado', 'Bloqueado']];
  function cuentaTiros(l) {
    const ts = SY.tiros.filter(t => t.lado === l && t.r), goles = SY.items.filter(x => x.tipo === 'GOL' && x.e && x.e.lado === l).length, par = ts.filter(t => t.r === 'parada').length;
    return { tiros: ts.length + goles, puerta: par + goles, goles };
  }
  function pintarTirosSync() {
    const box = $('#sy-tiros'); if (!box) return;
    if (SY.modo !== 'tiros') { box.innerHTML = ''; return; }
    const ctx = ctxDirecto(SY.S), t = SY.tiros[SY.t];
    const jug = l => ((SY.S.plantillas || {})[l] || []).slice().sort((a, b) => (+a.dorsal) - (+b.dorsal));
    const acta = l => { const ps = (SY.S.porteros || []).filter(x => x.lado !== l); return ps.length ? ps.reduce((n, x) => n + (x.tiros || 0), 0) : null; };
    const resumen = ['L', 'V'].map(l => { const c = cuentaTiros(l), a = acta(l);
      return `<div class="an-fila"><span><b style="font-size:16px">${esc(ctx.abr[l])}</b> · ${c.tiros} tiros · ${c.puerta} a puerta · ${c.goles} goles</span><span class="h" style="color:#A6A6AD">${a != null ? 'el acta da ' + a + ' a puerta' : ''}</span></div>`; }).join('');
    const editor = t ? `<div class="sy-gol-cols" style="margin-top:10px"><div><div class="lab">DESDE DÓNDE</div>
        ${mediaPista(t.xy ? `<circle cx="${t.xy[0] * PISTA_W}" cy="${t.xy[1] * PISTA_H}" r="9" fill="#D3202A" stroke="#FFFFFF" stroke-width="2"/>` : '', 'class="sy-pista" data-sy-pista width="100%" role="img" aria-label="Media pista: toca desde dónde se tiró"')}
        ${t.xy ? `<div class="an-frase" style="margin:6px 0">A unos ${distM(t.xy)} m de la portería</div>` : '<div class="an-nota">Toca en el dibujo, mirando a la portería a la que tiró.</div>'}</div>
      <div><div class="lab">TIRO EN ${mmssV(t.s)} DEL VÍDEO</div>
        <div class="an-sub">EQUIPO (tecla 1 o 2)</div><div class="an-togs">${['L', 'V'].map((l, i) => anTog(t.lado === l, `data-sy="t-lado" data-l="${l}"`, `${i + 1} · ${esc(ctx.abr[l])}`)).join('')}</div>
        ${t.lado ? `<div class="an-sub">QUIÉN TIRA</div><div class="an-togs">${jug(t.lado).map(j => anTog(String(t.dorsal) === String(j.dorsal), `data-sy="t-dorsal" data-d="${esc(j.dorsal)}"`, `#${esc(j.dorsal)} ${esc(j.jugador_corto || '')}`)).join('')}${anTog(!t.dorsal, 'data-sy="t-dorsal" data-d=""', 'No se ve')}</div>` : ''}
        <div class="an-sub">CÓMO ACABA (P, F o B)</div><div class="an-togs">${RES_TIRO.map(([k, x]) => anTog(t.r === k, `data-sy="t-r" data-r="${k}"`, x)).join('')}</div>
        <div class="an-togs" style="margin-top:8px"><button type="button" class="an-tog" data-sy="t-borra">Borrar este tiro</button></div></div></div>` : '';
    const lista = SY.tiros.map((x, i) => [x, i]).sort((a, b) => a[0].s - b[0].s).map(([x, i]) => `<button type="button" class="sy-it${i === SY.t ? ' on' : ''}${x.lado && x.r ? ' ok' : ''}" data-sy="t-ir" data-k="${i}"><span class="s">${mmssV(x.s)}</span><span>${esc(x.lado ? ctx.abr[x.lado] : '¿equipo?')}${x.dorsal ? ' · #' + esc(x.dorsal) : ''} · ${esc((RES_TIRO.find(r => r[0] === x.r) || [, '¿cómo acaba?'])[1])}${x.xy ? ' · ' + distM(x.xy) + ' m' : ''}</span></button>`).join('');
    box.innerHTML = `<div class="lab">MODO TIROS</div><div class="an-nota" style="margin-top:2px">Pulsa «+ Tiro» (o la tecla T) en cada tiro, aunque vaya fuera. Luego elige el equipo, quién tira, desde dónde y cómo acaba. Los goles no se marcan aquí: ya están en las jugadas del acta.</div>
      <div class="an-togs" style="margin-top:8px"><button type="button" class="dv-alin" data-sy="t-nuevo" style="font-size:15px;padding:10px 16px">+ Tiro</button></div>
      ${resumen}${editor}${lista ? `<div class="an-sub" style="margin-top:12px">TIROS MARCADOS · ${SY.tiros.length}</div><div class="sy-lista" style="max-height:260px">${lista}</div>` : ''}`;
  }
  document.addEventListener('keydown', e => {
    if (SY.modo !== 'tiros' || !location.hash.startsWith('#/sincronizar/') || /INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
    const k = e.key.toLowerCase(), t = SY.tiros[SY.t];
    const clic = sel => { const b = document.querySelector(sel); if (b) { e.preventDefault(); b.click(); } };
    if (k === 't') clic('[data-sy="t-nuevo"]');
    else if (t && (k === '1' || k === '2')) clic(`[data-sy="t-lado"][data-l="${k === '1' ? 'L' : 'V'}"]`);
    else if (t && k === 'p') clic('[data-sy="t-r"][data-r="parada"]');
    else if (t && k === 'f') clic('[data-sy="t-r"][data-r="fuera"]');
    else if (t && k === 'b') clic('[data-sy="t-r"][data-r="bloqueado"]');
  });
  document.addEventListener('click', e => { const sv = e.target.closest && e.target.closest('[data-sy-pista]'); if (!sv) return;
    if (SY.modo === 'tiros') { const t = SY.tiros[SY.t]; if (!t) return; const r = sv.getBoundingClientRect();
      t.xy = [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; guardaSync(); pintarSync(); return; }
    const it = SY.items[SY.i]; if (!it || it.tipo !== 'GOL') return;
    const r = sv.getBoundingClientRect(); it.xy = [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; guardaSync(); pintarSync(); });
  function irSync(k, buscar = true) {
    SY.i = Math.max(0, Math.min(SY.items.length, k));
    const it = SY.items[SY.i];
    if (buscar && it && SY.player && SY.player.seekTo) { SY.player.seekTo(Math.max(0, (it.s != null ? it.s : estimaSync(SY.i)) - (it.s != null ? 3 : 15)), true); SY.player.playVideo(); }
    pintarSync();
  }
  function arrancarSync(idp) {
    const S = SY.S;
    if (!S) return;
    SY.items = itemsSync(S);
    let previo = null;
    try { previo = JSON.parse(localStorage.getItem('mp-sync-' + idp) || 'null'); } catch (e) { previo = null; }
    const v = (VID && VID[idp]) || null;
    SY.tiros = (previo && previo.tiros) || (v && v.tiros ? v.tiros.map(t => Object.assign({}, t)) : []); SY.t = -1;
    if (previo) { SY.yt = previo.yt; SY.canal = previo.canal || ''; SY.items.forEach(x => { if (previo.m[x.id] != null) x.s = previo.m[x.id]; const d = (previo.d || {})[x.id]; if (d) { x.xy = d.xy; x.pista = d.pista; } }); }
    else if (v) { SY.yt = v.yt; SY.canal = v.canal || ''; SY.items.forEach(x => { const y = x.ancla ? (v.partes || {})[x.p] : (v.ev[x.id] || {}).s; if (y != null) x.s = y; const e2 = v.ev[x.id]; if (e2) { if (e2.xy) x.xy = e2.xy; if (e2.pista) x.pista = e2.pista; } }); }
    SY.i = Math.max(0, SY.items.findIndex(x => x.s == null));
    if (SY.i < 0) SY.i = SY.items.length;
    $('#sy-url').value = SY.yt ? 'https://youtu.be/' + SY.yt : '';
    $('#sy-canal').value = SY.canal;
    pintarSync();
    if (SY.yt) cargarPlayer();
  }
  function cargarPlayer() {
    cargarYT().then(() => {
      if (SY.player && SY.player.loadVideoById) { SY.player.loadVideoById(SY.yt); return; }
      SY.player = new YT.Player('sy-player', { videoId: SY.yt, playerVars: { rel: 0, playsinline: 1 }, events: { onReady: () => irSync(SY.i) } });
    });
  }
  function vSincronizar(idp) {
    if (SY.idp !== idp) Object.assign(SY, { idp, S: null, items: [], i: 0, yt: '', canal: '', player: null });
    const S = (RSM.final && RSM.final.idp === idp && RSM.final) || LIVE.snaps[idp] || SY.S;
    if (!S) {
      const url = DIRECTO_EJEMPLO ? DIRECTO_URL : DIRECTO_URL + '?idp=' + encodeURIComponent(idp);
      fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(d => {
        SY.S = (d.partidos || []).find(p => p.idp === idp) || null;
        if (location.hash.indexOf('#/sincronizar/' + idp) === 0) render();
      }).catch(() => { const w = $('[data-sy-espera]'); if (w) w.textContent = 'Sin conexión con el acta de la federación.'; });
      return '<div class="loading" data-sy-espera>Cargando el acta del partido…</div>';
    }
    SY.S = S;
    cargarVideos().then(() => setTimeout(() => arrancarSync(idp), 0));
    return `<div class="sy"><div class="lab" style="color:#FF6B63">SINCRONIZAR VÍDEO</div><h1>${esc(S.local)} <span>${S.gl ?? ''}–${S.gv ?? ''}</span> ${esc(S.visitante)}</h1>
      <p class="sy-ayuda">1. Pega el enlace de YouTube y pulsa «Cargar». 2. Para cada jugada el vídeo salta a unos segundos antes de cuando debería ser: dale al play y pulsa <b>¡Ahora!</b> justo cuando pasa (el gol entra, el árbitro pita la expulsión…). Si no se ve, «Saltar». En los goles, si se ve bien, toca en el dibujo desde dónde se tiró y marca quién de los nuestros estaba en pista (es opcional). 3. Al final copia el código y pásamelo.</p>
      <div class="sy-form"><input id="sy-url" type="url" placeholder="Enlace de YouTube (https://youtu.be/…)" aria-label="Enlace de YouTube"><input id="sy-canal" type="text" placeholder="Canal (opcional)" aria-label="Canal de YouTube"><button type="button" class="dv-alin" data-sy="cargar">Cargar</button></div>
      <div class="an-togs" style="margin-top:14px">${anTog(SY.modo === 'jugadas', 'data-sy="modo" data-m="jugadas"', 'Jugadas del acta')}${anTog(SY.modo === 'tiros', 'data-sy="modo" data-m="tiros"', 'Modo tiros')}</div>
      <div class="sy-cols"><div><div class="sy-marco"><div id="sy-player"></div></div>
        <div class="sy-actual" id="sy-actual"></div>
        <div class="sy-gol" id="sy-gol"></div><div class="sy-gol" id="sy-tiros"></div>
        <div class="sy-botones"><button type="button" data-sy="atras">◀ Atrás</button><button type="button" data-sy="estima">Ir a la estimación</button><button type="button" class="ahora" data-sy="ahora">¡Ahora!</button><button type="button" data-sy="menos">−2 s</button><button type="button" data-sy="mas">+2 s</button><button type="button" data-sy="saltar">Saltar ▶</button></div></div>
        <div class="sy-lado"><div class="sy-n" id="sy-n"></div><div class="sy-lista" id="sy-lista"></div></div></div>
      <div class="sy-cod"><div class="lab">GUARDAR EN LA WEB</div>
        <div class="bq-pin"><label for="sy-pin">PIN del club</label><input id="sy-pin" type="password" inputmode="numeric" autocomplete="off" value="${esc(leeLS('mp-pin', ''))}"><button type="button" class="dv-alin" data-sy="guardar-web">Guardar en la web</button><span class="an-nota" id="sy-msg" style="margin:0">${esc(SY.msg)}</span></div>
        <div class="an-nota">Se publica solo: al guardar, el partido ya sale con su vídeo, sus goles y sus tiros. Si no hay conexión, copia el código y pásalo.</div>
        <textarea id="sy-codigo" readonly rows="3" aria-label="Código para la web" style="margin-top:8px"></textarea><button type="button" class="an-tog" data-sy="copiar">Copiar el código</button></div></div>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-sy]');
    if (!b) return;
    const a = b.dataset.sy, it = SY.items[SY.i], now = () => (SY.player && SY.player.getCurrentTime ? SY.player.getCurrentTime() : null);
    if (a === 'cargar') { const id = ytId($('#sy-url').value); SY.canal = $('#sy-canal').value.trim(); if (!id) { $('#sy-url').focus(); return; } SY.yt = id; guardaSync(); cargarPlayer(); pintarSync(); }
    else if (a === 'ahora' && it) { const t = now(); if (t == null) return; it.s = t; guardaSync(); if (it.tipo === 'GOL') pintarSync(); else irSync(SY.i + 1); }
    else if (a === 'pj' && it) { const l = b.dataset.l, d = b.dataset.d; it.pista = it.pista || { L: [], V: [] }; const xs = it.pista[l]; const i2 = xs.indexOf(d); if (i2 >= 0) xs.splice(i2, 1); else xs.push(d); guardaSync(); pintarSync(); }
    else if (a === 'pj-igual' && it) { const ant = SY.items.slice(0, SY.i).reverse().find(x => x.pista); if (ant) { it.pista = { L: ant.pista.L.slice(), V: ant.pista.V.slice() }; guardaSync(); pintarSync(); } }
    else if (a === 'xy-borra' && it) { it.xy = null; guardaSync(); pintarSync(); }
    else if (a === 'modo') { SY.modo = b.dataset.m; document.querySelectorAll('[data-sy="modo"]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); pintarSync(); }
    else if (a === 't-nuevo') { const t = now(); if (t == null) { SY.msg = 'Carga el vídeo primero'; pintarSync(); return; } SY.tiros.push({ s: t, lado: SY.tiros.length ? SY.tiros[SY.tiros.length - 1].lado : null, dorsal: null, xy: null, r: null }); SY.t = SY.tiros.length - 1; guardaSync(); pintarSync(); }
    else if (a === 't-ir') { SY.t = +b.dataset.k; const t = SY.tiros[SY.t]; if (t && SY.player && SY.player.seekTo) { SY.player.seekTo(Math.max(0, t.s - 3), true); } pintarSync(); }
    else if (a === 't-lado' && SY.tiros[SY.t]) { const t = SY.tiros[SY.t]; if (t.lado !== b.dataset.l) t.dorsal = null; t.lado = b.dataset.l; guardaSync(); pintarSync(); }
    else if (a === 't-dorsal' && SY.tiros[SY.t]) { SY.tiros[SY.t].dorsal = b.dataset.d || null; guardaSync(); pintarSync(); }
    else if (a === 't-r' && SY.tiros[SY.t]) { SY.tiros[SY.t].r = b.dataset.r; guardaSync(); pintarSync(); }
    else if (a === 't-borra' && SY.tiros[SY.t]) { SY.tiros.splice(SY.t, 1); SY.t = -1; guardaSync(); pintarSync(); }
    else if (a === 'guardar-web') {
      const pin = ($('#sy-pin') || {}).value || ''; ponLS('mp-pin', pin);
      const d = JSON.parse(codigoSync())[SY.idp];
      SY.msg = 'Guardando…'; pintarSync();
      apiPost('video', { idp: SY.idp, pin, datos: d }).then(r => { SY.msg = r && r._st === 200 ? 'Guardado: ya sale en la web' : (r && r.error) || 'Sin conexión: copia el código y pásalo'; if (r && r._st === 200 && VID) VID[SY.idp] = r.datos; pintarSync(); });
    }
    else if (a === 'menos' && it && it.s != null) { it.s = Math.max(0, it.s - 2); guardaSync(); irSync(SY.i); }
    else if (a === 'mas' && it && it.s != null) { it.s += 2; guardaSync(); irSync(SY.i); }
    else if (a === 'saltar') irSync(SY.i + 1);
    else if (a === 'atras') irSync(SY.i - 1);
    else if (a === 'estima' && it) { const t = estimaSync(SY.i); if (SY.player && SY.player.seekTo) { SY.player.seekTo(Math.max(0, t - 15), true); SY.player.playVideo(); } }
    else if (a === 'ir') irSync(+b.dataset.k);
    else if (a === 'copiar') { const t = $('#sy-codigo'); if (!t.value) return; t.select(); (navigator.clipboard ? navigator.clipboard.writeText(t.value) : Promise.reject()).then(() => { b.textContent = '✓ Copiado'; }).catch(() => document.execCommand('copy')); }
  });

  /* ── Hitos de cada gol ──────────────────────────────────────────────────────────────────────────────────────────
     «SU PRIMER GOL» (ninguno en la FMP desde 2016/17) o «1.er GOL DE LA TEMPORADA»; hat trick, póker, manita; «SUPERA SU
     MEDIA» al llegar a 2 o más y al menos el doble de su media por partido (temporada pasada y esta antes del partido,
     con 5 partidos o más), y lo mismo con las asistencias. Lo que llevaba cada uno sale de data/hitos.json, que se
     rehace cada semana: si es de hace más de una jornada, o el jugador no está (la FMP a veces le cambia el id), no se
     dice nada de su historial. */
  let HIT = null, hitP = null;
  const cargarHitos = () => hitP || (hitP = fetch('data/hitos.json?v=' + encodeURIComponent(A.actualizado || ''))
    .then(r => r.json()).then(d => { HIT = d; HIT.antes = new Set(d.goleadores || []); return d; }).catch(() => { hitP = null; return null; }));
  const HITOS = { 3: 'HAT TRICK', 4: 'PÓKER', 5: 'MANITA' };
  const isoDe = sn => { const m = /^(\d{2})\/(\d{2})$/.exec(sn.fecha || ''), y0 = parseInt(A.temporada, 10); return m && y0 ? (+m[2] >= 8 ? y0 : y0 + 1) + '-' + m[2] + '-' + m[1] : null; };
  function previo(id, sn) {
    const f = isoDe(sn);
    if (!HIT || !id || !f || (new Date(f) - new Date(HIT.actualizado)) / 864e5 > 8) return null;
    const x = HIT.j[id];
    if (!x) return HIT.antes.has(+id) ? { g: 1, tg: 0, pj: 0, mg: 0, ma: 0 } : null;   // marcó hace años y no ha jugado desde
    const est = x.t.filter(p => p[0] < f), tg = est.reduce((a, p) => a + p[1], 0), ta = est.reduce((a, p) => a + p[2], 0);
    const u = Object.values(x.u).reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0]);   // todas sus categorías
    return { g: x.c[1] + tg, tg, pj: u[0] + est.length, mg: u[1] + tg, ma: u[2] + ta };
  }
  const catDe = liga => { const n = (liga || '').toLowerCase(), m = /senior\s*(\d)/.exec(n);
    return /senior/.test(n) && /femenin/.test(n) ? 'sf' : m ? 's' + m[1] : /senior/.test(n) ? 's' : /juvenil/.test(n) ? 'j' : /junior/.test(n) ? 'n' : /infantil/.test(n) ? 'i' : /alev/.test(n) ? 'a' : /benjam/.test(n) ? 'b' : ''; };
  // Rivales peligrosos (presentación): puntos por partido, esta temporada antes del partido y la pasada juntas (4 partidos o
  // más, o 2 de esta temporada); los 3 mejores del rival que pasen de 0,4. En senior cuentan todas las ligas senior, con los
  // puntos pasados a la liga del partido con el FMPe (uno de Senior 2 vale el doble que uno de Senior 3); si no, su categoría.
  // El motivo, con sus números de verdad: de esta temporada si ya llevan 2 partidos; si no, de la pasada (y en qué liga).
  function peligrosos(sn, l) {
    const f = isoDe(sn), k = catDe(sn.liga), out = new Map(), cand = [], fm = (HIT && HIT.fmpe) || {};
    if (!HIT || !f || !k || (new Date(f) - new Date(HIT.actualizado)) / 864e5 > 8) return out;
    const peso = c => (fm[k] && fm[c] ? fm[c] / fm[k] : c === k ? 1 : 0), liga = c => (/^s\d$/.test(c) ? 'Senior ' + c[1] : '');
    ((sn.plantillas || {})[l] || []).forEach(j => {
      const x = j.id_player && j.rol !== 'P' && HIT.j[j.id_player];
      if (!x) return;
      const t = x.t.filter(p => p[0] < f && peso(p[3]) > 0), u = Object.entries(x.u).filter(([c]) => peso(c) > 0);
      const pjU = u.reduce((a, [, v]) => a + v[0], 0), pj = t.length + pjU;
      if (pj < 4 && t.length < 2) return;
      const eq = t.reduce((a, p) => a + (p[1] + p[2]) * peso(p[3]), 0) + u.reduce((a, [c, v]) => a + (v[1] + v[2]) * peso(c), 0);
      const tg = t.reduce((a, p) => a + p[1], 0), ta = t.reduce((a, p) => a + p[2], 0);
      let motivo = `${tg} G ${ta} A en ${t.length} PJ esta temporada`;
      if (t.length < 2) { const [c, v] = u.sort((a, b) => b[1][0] - a[1][0])[0]; motivo = `${num2((v[1] + v[2]) / v[0])} puntos por partido en ${HIT.pasada}${c !== k && liga(c) ? ' (en ' + liga(c) + ')' : ''}`; }
      cand.push({ id: j.id_player, ppg: eq / pj, motivo });
    });
    cand.filter(x => x.ppg >= 0.4).sort((a, b) => b.ppg - a.ppg).slice(0, 3).forEach(x => out.set(x.id, x));
    return out;
  }
  // la n-ésima vez cruza el umbral (y la anterior no): se anuncia una sola vez por partido
  const cruza = (n, media) => n >= 2 && n >= 2 * media && !(n - 1 >= 2 && n - 1 >= 2 * media);
  function hitosGol(g, evs, sn) {
    const out = { tags: [], asist: '', media: '' };
    if (g.tipo !== 'GOL' || !(g.id_player || g.dorsal)) return out;
    const i = evs.findIndex(x => x.id === g.id), hasta = i < 0 ? evs : evs.slice(0, i + 1);
    const n = hasta.filter(x => x.tipo === 'GOL' && x.lado === g.lado && (g.id_player ? x.id_player === g.id_player : x.dorsal === g.dorsal)).length;
    const p = previo(g.id_player, sn);
    if (p && n === 1 && p.tg === 0) out.tags.push(p.g === 0 ? 'SU PRIMER GOL' : '1.er GOL DE LA TEMPORADA');
    if (n >= 3) out.tags.push(HITOS[n] || n + ' GOLES');
    else if (p && p.pj >= 5 && cruza(n, p.mg / p.pj)) { out.tags.push('SUPERA SU MEDIA'); out.media = 'su media: ' + num2(p.mg / p.pj) + ' goles por partido'; }
    if (g.asist_dorsal || g.assist_id_player) {
      const na = hasta.filter(x => x.tipo === 'GOL' && x.lado === g.lado && (g.assist_id_player ? x.assist_id_player === g.assist_id_player : x.asist_dorsal === g.asist_dorsal)).length;
      const idA = g.assist_id_player || (((sn.plantillas || {})[g.lado] || []).find(j => j.dorsal && String(j.dorsal) === String(g.asist_dorsal)) || {}).id_player;
      const q = previo(idA, sn);
      if (q && q.pj >= 5 && cruza(na, q.ma / q.pj)) out.asist = na + ' asistencias hoy, supera su media (' + num2(q.ma / q.pj) + ')';
    }
    return out;
  }
  const num2 = x => (Math.round(x * 100) / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 });
  function chipDirecto(sn) {
    const r = relojDe(sn);
    if (sn.estado === 'directo' && sn.fase === 'penaltis') return { vivo: !sn._resumen, txt: 'PENALTIS' + (sn.penaltis ? ' · ' + sn.penaltis.gl + '–' + sn.penaltis.gv : '') };
    if (sn.estado === 'directo') return { vivo: !sn._resumen, txt: ordinal(sn.periodo || 1) + ' PARTE' + (r ? ' · ' + r : '') };
    return { vivo: false, txt: sn.estado === 'descanso' ? 'DESCANSO' : sn.estado === 'final' ? 'FINAL' : 'HOY' + (sn.hora ? ' · ' + sn.hora : '') };
  }
  const chipHtml = c => (c.vivo ? '<span class="punto"></span>' : '') + esc(c.txt);
  const rodilloD = (n, lado) => `<div class="dv-rod ${lado}" data-dv="rod${lado}"><div style="transform:translateY(-${n}em)">${Array.from({ length: Math.max(16, n + 1) }, (_, i) => `<span>${i}</span>`).join('')}</div></div>`;
  // línea del partido: dos tramos que se llenan con el reloj (sin reloj del portal, solo las partes ya terminadas)
  function rellenoDirecto(sn) {
    if (sn.estado === 'previa') return [0, 0];
    if (sn.estado === 'final') return [100, 100];
    if (sn.estado === 'descanso') return [100, 0];
    const r = segs(relojDe(sn)), f = sn.duracion_periodo && r != null ? Math.min(100, r / sn.duracion_periodo * 100) : 0;
    return (sn.periodo || 1) === 1 ? [f, 0] : [100, f];
  }
  const posLinea = (dur, p, t) => `calc((100% - 4px) * ${((p - 1) * 0.5 + Math.min(1, t / dur) * 0.5).toFixed(4)} + ${p === 2 ? 4 : 0}px)`;
  // lo nuevo entra cuando le toca (los goles, al salir su cortina): hasta entonces no se pinta, para no dejar huecos
  const pendiente = clave => DV.aparece[clave] != null && DV.aparece[clave] > Date.now() + 30;
  const animDe = (clave, ms) => (DV.aparece[clave] != null && Date.now() - DV.aparece[clave] < 400 ? `animation:${ms};` : '');
  let timerListas = null;
  function pintarListas(ctx) {
    const mk = $('[data-dv="marcas"]'), fl = $('[data-dv="filas"]');
    if (mk) mk.innerHTML = marcasLinea(ctx);
    if (fl) fl.innerHTML = filasHtml(ctx);
    pintarPorteros(ctx); pintarTanda(ctx);
    clearTimeout(timerListas);
    const prox = Object.values(DV.aparece).concat(...Object.values(DV.tiros).map(st => st.lista.map(x => x.aparece || 0))).filter(t => t > Date.now() + 30);
    if (prox.length) { const gen = DV.gen; timerListas = setTimeout(() => { const sn = snapDV(); if (gen === DV.gen && sn) pintarListas(ctxDirecto(sn)); }, Math.min(...prox) - Date.now()); }
  }
  function marcasLinea(ctx) {
    const { sn, dur } = ctx;
    if (!dur) return '';
    const arriba = l => (ctx.mp.L && ctx.mp.V ? l === 'L' : ctx.mp[l]);   // nuestros goles arriba (en un derbi, el local)
    const evs = sn.eventos.filter(e => e.t != null && e.periodo >= 1 && e.periodo <= 2 && !pendiente(e.id));
    return evs.filter(e => e.tipo === 'FALTA').map(e => { const t = segs(e.t), w = Math.min((e.min_sancion || 2) * 60, dur - t) / dur * 0.5;
      return `<div class="dv-excl" style="left:${posLinea(dur, e.periodo, t)};width:calc((100% - 4px) * ${w.toFixed(4)});${animDe(e.id, 'mpWipe .4s both')}"></div>`; }).join('')
      + evs.filter(e => e.tipo === 'GOL').map(e => `<div class="dv-pgol" style="left:${posLinea(dur, e.periodo, segs(e.t))};top:${arriba(e.lado) ? 2 : 26}px;background:${ctx.mp[e.lado] ? RED : '#F4F4F5'};${animDe(e.id, 'mpDot .4s cubic-bezier(.3,1.4,.5,1) both')}"></div>`).join('');
  }
  const TAGD = { GOL: ['GOL', RED, '#FFFFFF'], FALTA: ["2'", '#FF8A3D', '#0D0D0E'], 'TIEMPO MUERTO': ['TM', '#26262A', '#F4F4F5'], 'CAMBIO DE PORTERO': ['POR', '#26262A', '#F4F4F5'], 'LANZAMIENTO PENALTI': ['PEN', '#F4F4F5', '#0D0D0E'] };
  function filaDirecto(ctx, e) {
    const t = (TAGD[e.tipo] || [e.tipo.slice(0, 3), '#26262A', '#F4F4F5']).slice(), l = e.lado, nom = ctx.nombre[l] || '';
    let tit, sub, hitos = [];
    if (e.tipo === 'GOL') {
      tit = quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador);
      const h = hitosGol(e, ctx.sn.eventos, ctx.sn); hitos = h.tags;
      sub = [e.asist_dorsal || e.asist_jugador ? 'Asist. ' + quienD(ctx, l, e.asist_dorsal, e.asist_corto, e.asist_jugador) + (h.asist ? ' (' + h.asist + ')' : '') : 'Sin asistencia', situacionGol(e, ctx.sn.eventos, ctx.dur), h.media].filter(Boolean).join(' · ');
    } else if (e.tipo === 'FALTA') {
      tit = quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador); t[0] = fmin(e.min_sancion || 2);
      sub = motivoFalta(e) + ' · ' + minFuera(e.min_sancion || 2) + ' fuera';
    } else if (e.tipo === 'TIEMPO MUERTO') { tit = 'Tiempo muerto'; sub = nom; }
    else if (e.tipo === 'CAMBIO DE PORTERO') {
      if (e.nota === 'Portero fuera') { tit = 'Portero fuera' + (e.dorsal ? ' · ' + quienD(ctx, l, e.dorsal, e.sale_corto || e.jugador_corto, e.sale) : ''); sub = nom + ' · juega con 5 de pista'; }
      else if (e.ambiguo) { tit = 'Cambio de portero'; sub = [e.nota, nom, 'momento aproximado'].filter(Boolean).join(' · '); }
      else { tit = 'Entra ' + quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador);
        sub = [e.sale ? 'Sale ' + (e.sale_dorsal ? quienD(ctx, l, e.sale_dorsal, e.sale_corto, e.sale) : (e.sale_corto || e.sale)) : '', nom, e.aprox ? 'momento aproximado' : ''].filter(Boolean).join(' · '); }
    } else { tit = e.tipo.charAt(0) + e.tipo.slice(1).toLowerCase(); sub = nom; }
    const c = crest(nom), bg = (A.crests[nom] && A.crests[nom].bg) || 'transparent';
    return `<div class="dv-fila${e.tipo === 'GOL' && ctx.mp[l] ? ' mp' : ''}" style="${animDe(e.id, 'mpUp .45s cubic-bezier(.2,.8,.2,1) both')}">
      <span class="t">${esc(ordinal(e.periodo) + (e.t ? ' ' + e.t : ''))}</span><span class="tag" style="background:${t[1]};color:${t[2]}">${esc(t[0])}</span>
      <div style="min-width:0"><div class="tit">${esc(tit)}${hitos.map(x => `<span class="dv-hito">${esc(x)}</span>`).join('')}${botonVer(ctx.sn.idp, e)}</div><div class="sub">${esc(sub)}</div></div>
      <div class="der"><div style="box-shadow:0 0 0 1.5px ${ctx.mp[l] ? RED : '#FFFFFF'};background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}"></div><span>${e.tipo === 'GOL' && e.marcador ? esc(e.marcador.replace('-', '–')) : ''}</span></div></div>`;
  }
  // filas en orden cronológico (la lista las muestra al revés) con separadores deducidos del estado: el portal no da inicio/fin
  function itemsFeed(ctx) {
    const { sn } = ctx, evs = sn.eventos, out = [];
    const goles = (p, l) => evs.filter(e => e.tipo === 'GOL' && e.lado === l && e.periodo <= p).length;
    const hay2 = evs.some(e => e.periodo >= 2) || (sn.periodo || 0) >= 2 || sn.estado === 'final';
    evs.filter(e => !e.periodo).forEach(e => out.push(['ev', e.id, e]));
    if (sn.estado !== 'previa') out.push(['div', 'ini1', 'EMPIEZA LA 1ª PARTE']);
    evs.filter(e => e.periodo === 1).forEach(e => out.push(['ev', e.id, e]));
    if (hay2 || sn.estado === 'descanso') out.push(['div', 'desc', 'DESCANSO · ' + goles(1, 'L') + '–' + goles(1, 'V')]);
    if (hay2) out.push(['div', 'ini2', 'EMPIEZA LA 2ª PARTE']);
    evs.filter(e => e.periodo >= 2).forEach(e => out.push(['ev', e.id, e]));
    const gana = sn.penaltis && sn.penaltis.ganador ? ' · GANA ' + ctx.abr[sn.penaltis.ganador] : '';
    if (sn.penaltis || sn.fase === 'penaltis') out.push(['div', 'pen', 'PENALTIS' + (sn.penaltis ? ' · ' + sn.penaltis.gl + '–' + sn.penaltis.gv + gana : '')]);
    if (sn.estado === 'final') out.push(['div', 'fin', 'FINAL · ' + (sn.gl ?? 0) + '–' + (sn.gv ?? 0) + (sn.penaltis ? ' · PENALTIS ' + sn.penaltis.gl + '–' + sn.penaltis.gv + gana : '')]);
    return out;
  }
  function filasHtml(ctx) {
    return itemsFeed(ctx).filter(([k, id]) => !pendiente(k === 'div' ? 'div-' + id : id)).map(([k, id, x]) => (k === 'div' ? `<div class="dv-div" style="${animDe('div-' + id, 'mpUp .45s cubic-bezier(.2,.8,.2,1) both')}">${esc(x)}</div>` : filaDirecto(ctx, x))).join('');
  }
  function cabLista(sn) {
    const n = sn.eventos.length;
    if (sn._resumen) return `<span>${n} ${n === 1 ? 'evento' : 'eventos'} · resumen del acta</span>`;
    if (LIVE.ok === false) return '<span class="off">sin conexión · reintentando</span>';
    return `<span>${n} ${n === 1 ? 'evento' : 'eventos'} · ${DIRECTO_EJEMPLO ? 'datos de ejemplo' : 'cada 15 s'}</span>`;
  }
  /* ── 9c · Expulsiones en curso y situación en pista ──────────────────────────────────────────
     La cuenta atrás necesita el reloj de la parte: sin reloj del portal no se muestran (no se inventan). La portería vacía
     sale de los eventos («Portero fuera») y sí se muestra. Todo termina al cumplirse el tiempo o al cambiar de parte. */
  const mmssD = x => p2(Math.floor(x / 60)) + ':' + p2(Math.floor(x % 60));
  function excluidos(ctx) {
    const { sn } = ctx, r = segs(relojDe(sn)), out = { L: [], V: [] };
    if (sn.estado !== 'directo' || r == null) return out;
    sn.eventos.forEach(e => {
      if (e.tipo !== 'FALTA' || e.periodo !== (sn.periodo || 1) || e.t == null || !out[e.lado]) return;
      const dur = (e.min_sancion || 2) * 60, rem = dur - (r - segs(e.t));
      if (rem > 0 && rem <= dur) out[e.lado].push({ id: e.id, quien: quienD(ctx, e.lado, e.dorsal, e.jugador_corto, e.jugador) + ' · ' + fmin(e.min_sancion || 2), rem, dur, motivo: motivoFalta(e) });
    });
    return out;
  }
  function porteriaVacia(ctx, l) {   // su último cambio de portero en esta parte fue «Portero fuera»
    const { sn } = ctx;
    if (sn.estado !== 'directo') return false;
    const c = sn.eventos.filter(e => e.tipo === 'CAMBIO DE PORTERO' && e.lado === l);
    return !!c.length && c[c.length - 1].nota === 'Portero fuera' && c[c.length - 1].periodo === (sn.periodo || 1);
  }
  function situacionPista(ctx, pens) {
    const M = ctx.mp.L || !ctx.mp.V ? 'L' : 'V', O = M === 'L' ? 'V' : 'L';   // desde el lado nuestro (en un derbi, el local)
    const pv = { L: porteriaVacia(ctx, 'L'), V: porteriaVacia(ctx, 'V') };
    const sk = l => 4 - Math.min(2, pens[l].length) + (pv[l] ? 1 : 0);
    if (ctx.sn.estado !== 'directo' || (sk('L') === sk('V') && !pv.L && !pv.V)) return null;
    const resta = arr => (arr.length ? mmssD(Math.min(...arr.map(p => p.rem))) : '');
    let label, t = '';
    if (pv[O]) label = 'PORTERÍA VACÍA · ' + ctx.abr[O];
    else if (pv[M]) label = 'PORTERÍA VACÍA · ' + ctx.abr[M];
    else if (sk(M) > sk(O)) { label = 'SUPERIORIDAD · ' + ctx.abr[M]; t = resta(pens[O]); }
    else { label = 'INFERIORIDAD · ' + ctx.abr[M]; t = resta(pens[M]); }
    return { n: sk(M) + ' c ' + sk(O), label, t, mp: sk(M) > sk(O) && !pv[M] };
  }
  function pintarSituacion(ctx) {
    const pens = excluidos(ctx);
    ['L', 'V'].forEach(l => {
      const cont = $(`[data-dv="pen${l}"]`), escEl = $(`[data-dv="esc${l}"]`);
      if (escEl) escEl.style.boxShadow = `0 0 0 2px ${pens[l].length ? '#FF8A3D' : ctx.mp[l] ? RED : '#FFFFFF'}`;
      if (!cont) return;
      cont.innerHTML = pens[l].map(p => { const nuevo = !DV.penVistos.has(p.id); DV.penVistos.add(p.id);
        return `<div class="dv-pen"${nuevo && DV.listo ? ' style="animation:mpUp .35s both"' : ''}><div class="q"><span>${esc(p.quien)}</span><span>${mmssD(p.rem)}</span></div><div class="b"><i style="width:${(p.rem / p.dur * 100).toFixed(1)}%"></i></div><div class="m">${esc(p.motivo)}</div></div>`; }).join('');
    });
    const cont = $('[data-dv="situ"]'), si = situacionPista(ctx, pens);
    if (!cont) return;
    if (!si) { cont.innerHTML = ''; DV.situClave = ''; return; }
    const clave = si.label + si.n, nuevo = clave !== DV.situClave; DV.situClave = clave;
    cont.innerHTML = `<div class="dv-situ${si.mp ? ' mp' : ''}"${nuevo && DV.listo ? ' style="animation:mpUp .35s both"' : ''}><b>${esc(si.n)}</b><span>${esc(si.label)}</span>${si.t ? `<span>${si.t}</span>` : ''}</div>`;
  }

  /* ── 9g · Porteros: una tarjeta por equipo, con el portero en pista ─────────────────────────
     % de paradas, barra y un rectángulo por tiro recibido (los nuevos entran con mpDot; los goles, tras la cortina).
     Portero fuera: tarjeta atenuada y sello «FUERA · PORTERÍA VACÍA». Sin tiros todavía, la tarjeta no se muestra. */
  function porteroDe(ctx, l) {
    const ps = ctx.sn.porteros.filter(p => p.lado === l);
    if (!ps.length) return null;
    const dentro = ps.find(p => p.en_pista);
    const vacia = porteriaVacia(ctx, l);
    const ult = ctx.sn.eventos.filter(e => e.tipo === 'CAMBIO DE PORTERO' && e.lado === l).pop();
    const p = dentro || (vacia && ult && ps.find(x => x.dorsal === ult.dorsal)) || ps.slice().sort((a, b) => (b.tiros || 0) - (a.tiros || 0))[0];
    return p && p.tiros ? { p, fuera: vacia && !dentro } : null;
  }
  // tiros de cada portero como lista de rectángulos: al entrar, los que ya hay (quietos: paradas y luego goles, el orden
  // exacto no lo da el portal); después, lo que cambia de una respuesta a otra
  function contarTiros(ctx, nuevosGoles) {
    const ahora = Date.now();
    ctx.sn.porteros.forEach(p => {
      const k = p.lado + '-' + p.dorsal, prev = DV.tiros[k], t = p.tiros || 0, g = p.gc || 0;
      if (!prev || t < prev.t || g < prev.g || !DV.listo) {
        DV.tiros[k] = { t, g, lista: Array(Math.max(0, t - g)).fill(0).map(() => ({ gol: false })).concat(Array(g).fill(0).map(() => ({ gol: true }))) };
        return;
      }
      const dP = (t - prev.t) - (g - prev.g), dG = g - prev.g;
      const golesContra = nuevosGoles.filter(e => e.lado !== p.lado);
      for (let i = 0; i < dP; i++) prev.lista.push({ gol: false, aparece: ahora });
      for (let i = 0; i < dG; i++) prev.lista.push({ gol: true, aparece: golesContra[i] ? DV.aparece[golesContra[i].id] : ahora + (MOV ? 1600 : 0) });
      prev.t = t; prev.g = g;
    });
  }
  const pctP = p => (p.tiros ? Math.round((p.tiros - (p.gc || 0)) / p.tiros * 1000) / 10 : null);
  function tirosHtml(k) {
    const st = DV.tiros[k];
    return st ? st.lista.filter(x => !(x.aparece && x.aparece > Date.now() + 30)).map(x => `<span${x.gol ? ' class="g"' : ''}${x.aparece && Date.now() - x.aparece < 400 ? ' style="animation:mpDot .35s cubic-bezier(.3,1.4,.5,1) both"' : ''}></span>`).join('') : '';
  }
  function porterosHtml(ctx) {
    return ['L', 'V'].map(l => { const x = porteroDe(ctx, l); if (!x) return '';
      const { p } = x, k = l + '-' + p.dorsal, mp = jugadorMP(ctx, l, p.dorsal), pc = pctP(p), nom = mp ? mp.nombre + ' ' + mp.apellidos : p.jugador || '';
      const inis = nom.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('');
      return `<div class="dv-por${x.fuera ? ' fuera' : ''}" data-por="${esc(k)}">
        <div class="foto ini">${esc(inis)}${mp ? photo(mp.foto, 'grayscale(1)', '50% 15%') : ''}</div>
        <div class="datos"><div class="arriba"><div style="min-width:0"><div class="lab2">PORTERO · ${esc(ctx.abr[l])}</div><div class="quien">${esc(quienD(ctx, l, p.dorsal, p.jugador_corto, p.jugador))}</div></div>
          <div style="flex:none"><div class="pct" data-k="pct">${pc == null ? '—' : dec(pc) + '%'}</div><div class="par" data-k="par">${(p.tiros || 0) - (p.gc || 0)}/${p.tiros || 0} PARADAS</div></div></div>
          <div class="barra"><i data-k="bar" style="width:${pc || 0}%;background:${ctx.mp[l] ? RED : '#F4F4F5'}"></i></div>
          <div class="tiros" data-k="tiros">${tirosHtml(k)}</div></div>
        ${x.fuera ? '<div class="sello"><span>FUERA · PORTERÍA VACÍA</span></div>' : ''}</div>`; }).join('');
  }
  function pintarPorteros(ctx) {
    const cont = $('[data-dv="porteros"]');
    if (!cont) return;
    const quiero = ['L', 'V'].map(l => { const x = porteroDe(ctx, l); return x ? l + '-' + x.p.dorsal : ''; }).filter(Boolean).join(',');
    const hay = [...cont.querySelectorAll('[data-por]')].map(c => c.dataset.por).join(',');
    if (quiero !== hay) {   // cambia el portero: se vuelve a pintar (en el resumen, entran al acabar)
      cont.innerHTML = porterosHtml(ctx);
      if (ctx.sn._resumen && DV.listo && MOV) cont.querySelectorAll('.dv-por').forEach((c, i) => { c.style.animation = `mpUp .45s ${i * 120}ms cubic-bezier(.2,.8,.2,1) both`; });
      return;
    }
    ['L', 'V'].forEach(l => { const x = porteroDe(ctx, l); if (!x) return;
      const card = cont.querySelector(`[data-por="${CSS.escape(l + '-' + x.p.dorsal)}"]`), pc = pctP(x.p);
      card.querySelector('[data-k="pct"]').textContent = pc == null ? '—' : dec(pc) + '%';
      card.querySelector('[data-k="par"]').textContent = `${(x.p.tiros || 0) - (x.p.gc || 0)}/${x.p.tiros || 0} PARADAS`;
      card.querySelector('[data-k="bar"]').style.width = (pc || 0) + '%';
      card.querySelector('[data-k="tiros"]').innerHTML = tirosHtml(l + '-' + x.p.dorsal);
      const era = card.classList.contains('fuera');
      card.classList.toggle('fuera', x.fuera);
      if (x.fuera && !era) card.insertAdjacentHTML('beforeend', '<div class="sello"><span style="animation:mpScale .4s cubic-bezier(.2,.8,.2,1) both">FUERA · PORTERÍA VACÍA</span></div>');
      if (!x.fuera && era) { const se = card.querySelector('.sello'); if (se) se.remove(); }
    });
  }

  /* ── 9h · En juego: tiros, paradas, minutos de expulsión y goles en superioridad (goles/ocasiones) ── */
  function datosJuego(ctx) {
    const { sn } = ctx, filas = [];
    const sumP = (l, f) => sn.porteros.filter(p => p.lado === l).reduce((a, p) => a + f(p), 0);
    if (sn.tiros) {
      filas.push(['TIROS A PUERTA', sn.tiros.l, sn.tiros.v, sn.tiros.l, sn.tiros.v]);
      const pl = sumP('L', p => (p.tiros || 0) - (p.gc || 0)), pv = sumP('V', p => (p.tiros || 0) - (p.gc || 0));
      filas.push(['PARADAS', pl, pv, pl, pv]);
    }
    const ex = l => sn.eventos.filter(e => e.tipo === 'FALTA' && e.lado === l).reduce((a, e) => a + (e.min_sancion || 2), 0);
    filas.push(['MIN. EXPULSIÓN', fmin(ex('L')), fmin(ex('V')), ex('L'), ex('V')]);
    if (ctx.dur) {
      const ppG = l => sn.eventos.filter(e => e.tipo === 'GOL' && e.lado === l && situacionGol(e, sn.eventos, ctx.dur) === 'En superioridad').length;
      const ppO = l => sn.eventos.filter(e => exclusion(e) && e.lado !== l).length;
      filas.push(['GOLES EN SUPERIORIDAD', ppG('L') + '/' + ppO('L'), ppG('V') + '/' + ppO('V'), ppG('L'), ppG('V')]);
    }
    const pd = probDirecto(ctx);
    if (pd) filas.push(['OPCIONES DE GANAR', pct(pd.pr[0]), pct(pd.pr[2]), pd.pr[0], pd.pr[2]]);
    else if (!ANA) cargarAnalisis().then(d => { if (d) pintarDirecto(); });
    return filas;
  }
  function juegoHtml(ctx) {
    if (ctx.sn.estado === 'previa') return '';
    const cL = ctx.mp.L ? RED : '#55555B', cV = ctx.mp.V && !ctx.mp.L ? RED : '#55555B';
    return `<div class="dv-juego" data-dv="juego"><div class="cab"><span>${esc(ctx.abr.L)}</span><span>${ctx.sn.estado === 'final' ? 'EL PARTIDO' : 'EN JUEGO'}</span><span>${esc(ctx.abr.V)}</span></div>
      ${datosJuego(ctx).map(([k, l, v, a, b]) => `<div class="fila" data-fj="${esc(k)}"><div class="nums"><b data-k="l">${esc(l)}</b><span>${k}</span><b data-k="v">${esc(v)}</b></div>
        <div class="bar"><i data-k="w" style="width:${(a + b ? a / (a + b) * 100 : 50).toFixed(1)}%;background:${cL}"></i><i style="background:${cV}"></i></div></div>`).join('')}</div>`;
  }
  function pintarJuego(ctx) {
    const cont = $('[data-dv="der"]');
    if (!cont) return;
    const j = cont.querySelector('[data-dv="juego"]'), filas = datosJuego(ctx);
    const misma = j && ctx.sn.estado !== 'previa' && [...j.querySelectorAll('[data-fj]')].map(f => f.dataset.fj).join() === filas.map(f => f[0]).join();
    if (!misma) { if (j) j.remove(); cont.insertAdjacentHTML('afterbegin', juegoHtml(ctx)); return; }
    j.querySelector('.cab span:nth-child(2)').textContent = ctx.sn.estado === 'final' ? 'EL PARTIDO' : 'EN JUEGO';
    filas.forEach(([k, l, v, a, b]) => { const f = j.querySelector(`[data-fj="${CSS.escape(k)}"]`);
      f.querySelector('[data-k="l"]').textContent = l; f.querySelector('[data-k="v"]').textContent = v;
      f.querySelector('[data-k="w"]').style.width = (a + b ? a / (a + b) * 100 : 50).toFixed(1) + '%'; });
  }

  // resultado desde nuestro lado: VICTORIA / EMPATE / DERROTA; empate con tanda → «… EN LOS PENALTIS» (como el prototipo)
  function resultadoMP(ctx, sn) {
    const M = ctx.mp.L && ctx.mp.V ? null : ctx.mp.L ? 'L' : 'V';
    if (!M) return ['DERBI', '#55555B', '#26262A'];
    const nos = M === 'L' ? sn.gl : sn.gv, ellos = M === 'L' ? sn.gv : sn.gl, g = sn.penaltis && sn.penaltis.ganador;
    if (nos > ellos) return ['VICTORIA', '#1E8A4C', '#123A24'];
    if (nos < ellos) return ['DERROTA', '#55555B', '#1F1F22'];
    if (g) return g === M ? ['VICTORIA EN LOS PENALTIS', '#1E8A4C', '#123A24'] : ['DERROTA EN LOS PENALTIS', '#55555B', '#1F1F22'];
    return ['EMPATE', '#8A8A8F', '#26262A'];
  }
  // 9e · franja V/E/D bajo el marcador cuando acaba (y después de la última cortina)
  function finalHtml(ctx, animar) {
    const { sn } = ctx;
    if (sn.estado !== 'final' || DV.pendientes || DV.mostrado.gl !== (sn.gl || 0) || DV.mostrado.gv !== (sn.gv || 0)) return '';
    const r = resultadoMP(ctx, sn);
    const pen = sn.penaltis ? ' · PENALTIS ' + sn.penaltis.gl + '–' + sn.penaltis.gv : '';
    return `<div class="dv-final"><i style="background:${r[1]};${animar ? 'animation:mpWipe .5s cubic-bezier(.2,.8,.2,1) both' : ''}"></i><span${animar ? ' style="animation:mpFade .3s .35s both"' : ''}>${r[0]} · ${esc(ctx.abr.L)} ${sn.gl ?? 0}–${sn.gv ?? 0} ${esc(ctx.abr.V)}${pen}</span></div>`;
  }
  // tanda de penaltis bajo el marcador: una fila por ronda (como el acta, que no dice quién tiró primero); verde = gol
  function tandaHtml(ctx) {
    const { sn } = ctx, pen = sn.penaltis;
    if (!pen && sn.fase !== 'penaltis') return '';
    const tiros = (pen && pen.tanda) || [], vis = x => x && !pendiente('tanda-' + x.lado + x.ronda);
    const rondas = tiros.reduce((m, x) => Math.max(m, x.ronda || 0), 0), filas = [];
    const marca = x => (vis(x) ? `<i class="m ${x.gol ? 'si' : 'no'}" style="${animDe('tanda-' + x.lado + x.ronda, 'mpDot .35s cubic-bezier(.3,1.4,.5,1) both')}">${x.gol ? '✓' : '✕'}</i>` : '<i class="m"></i>');
    const nom = x => (vis(x) ? esc(quienD(ctx, x.lado, x.dorsal, x.jugador_corto, x.jugador)) : '');
    for (let r = 1; r <= rondas; r++) {
      const a = tiros.find(x => x.lado === 'L' && x.ronda === r), b = tiros.find(x => x.lado === 'V' && x.ronda === r);
      if (vis(a) || vis(b)) filas.push(`<div class="r"><span class="n">${nom(a)}</span>${marca(a)}<b>${r}</b>${marca(b)}<span class="n v">${nom(b)}</span></div>`);
    }
    const g = l => tiros.filter(x => x.lado === l && x.gol && vis(x)).length;
    const gana = pen && pen.ganador && !DV.pendientes ? `<div class="gana${ctx.mp[pen.ganador] ? ' mp' : ''}">GANA LA TANDA ${esc(ctx.abr[pen.ganador])} · ${pen.gl}–${pen.gv}</div>` : '';
    return `<div class="dv-tanda"><div class="cab"><span>TANDA DE PENALTIS</span><span>${esc(ctx.abr.L)} ${tiros.length ? g('L') : pen ? pen.gl : 0}–${tiros.length ? g('V') : pen ? pen.gv : 0} ${esc(ctx.abr.V)}</span></div>${filas.join('')}${gana}</div>`;
  }
  function pintarTanda(ctx) { const c = $('[data-dv="tanda"]'), h = tandaHtml(ctx); if (c && c._h !== h) { c.innerHTML = h; c._h = h; } }
  // plantilla de un equipo: porteros primero y luego por dorsal; C capitán, A asistente, P portero
  const nomPres = (ctx, l, j) => quienD(ctx, l, j.dorsal, j.jugador_corto, j.jugador).replace(/^#\d+\s+/, '');
  const RANGO_ROL = { P: 0, C: 1, A: 2 };   // porteros, capitán, asistentes y el resto; en cada grupo, por dorsal
  const ordenPl = pl => pl.slice().sort((a, b) => ((RANGO_ROL[a.rol] ?? 3) - (RANGO_ROL[b.rol] ?? 3)) || ((+a.dorsal || 99) - (+b.dorsal || 99)));
  const posHtml = j => (j.rol === 'P' ? '<i class="dv-pos">P</i>' : j.rol === 'C' ? '<i class="dv-pos c">C</i>' : j.rol === 'A' ? '<i class="dv-pos a">A</i>' : '');
  const escFicha = (ctx, l) => { const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent';
    return `<i style="--ring:${ctx.mp[l] ? RED : '#FFFFFF'};background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}"></i>`; };
  const staffDe = (sn, l) => (sn.staff && sn.staff[l]) || [];
  const staffTxt = st => st.map(x => (x.cargo ? x.cargo + ' · ' : '') + x.nombre).join(' · ');
  // «POLID. MUNICIPAL JOSE CABALLERO-PISTA 4» → «Polid. Municipal Jose Caballero-Pista 4» (el acta la da en mayúsculas)
  const pistaBonita = s => (s || '').toLowerCase().replace(/(^|[\s\-(])(\p{L})/gu, (m, a, c) => a + c.toUpperCase()).replace(/ (De|Del|La|Las|Los|Y) /g, m => m.toLowerCase());
  // 9h · ficha del partido (columna derecha): pista, árbitros, alineaciones y cuerpo técnico, tal como los da el acta
  function fichaHtml(ctx) {
    const { sn } = ctx, P = sn.plantillas, arb = sn.arbitros || [];
    if (!sn.pista && !arb.length && !P) return '';
    const eq = l => (P && P[l] ? `<div class="eq"><div class="n">${escFicha(ctx, l)}${esc(ctx.abr[l])}</div>${ordenPl(P[l]).map(j => `<div class="j"><b>${esc(j.dorsal)}</b><span>${esc(nomPres(ctx, l, j))}</span>${posHtml(j)}</div>`).join('')}
      ${staffDe(sn, l).length ? `<div class="staff">Cuerpo técnico · ${esc(staffTxt(staffDe(sn, l)))}</div>` : ''}</div>` : '<div></div>');
    return `<div class="dv-ficha"><div class="cab">FICHA DEL PARTIDO</div>
      ${sn.pista ? `<div class="dato"><span>PISTA</span><b>${esc(pistaBonita(sn.pista))}</b></div>` : ''}
      ${arb.length ? `<div class="dato"><span>${arb.length > 1 ? 'ÁRBITROS' : 'ÁRBITRO'}</span><b>${esc(arb.join(' · '))}</b></div>` : ''}
      ${P ? `<div class="eqs">${eq('L')}${eq('V')}</div><div class="ley"><span><i class="dv-pos c">C</i>capitán</span><span><i class="dv-pos a">A</i>asistente</span><span><i class="dv-pos">P</i>portero</span></div>` : ''}</div>`;
  }
  function pintarFicha(ctx) { const c = $('[data-dv="ficha"]'), h = fichaHtml(ctx); if (c && c._h !== h) { c.innerHTML = h; c._h = h; } }
  /* ── 10b · Presentación a pantalla completa ─────────────────────────────────────────────────────────────────────
     Al abrirse el acta (el portal no da convocados antes: el acta se abre 0-2 min antes de empezar), una vez, si aún no hay
     apuntes; o con «Ver alineación». Título → nuestros uno a uno cada 1,25 s (foto a color, dorsal gigante de fondo, rol,
     apellido grande; la rejilla se rellena) → rival en lista → escudos chocando «VS» con hora y pista. */
  const PRES_VISTAS = new Set();
  const ROL_TXT = { P: ['PORTERO', '#F4F4F5', '#0D0D0E'], C: ['CAPITÁN', '#D3202A', '#FFFFFF'], A: ['ASISTENTE', '#26262A', '#F4F4F5'] };
  let POR_ID = null;   // nuestros jugadores por id del portal (la foto es fotos/{id}.webp); sin foto, por dorsal
  const jugadorPorId = id => {
    if (!POR_ID) { POR_ID = {}; Object.values(A.jugadores).forEach(p => { const m = /fotos\/(\d+)\./.exec(p.foto || ''); if (m) POR_ID[m[1]] = p; }); }
    return id ? POR_ID[id] || null : null;
  };
  const jugadorDe = (ctx, l, id, dorsal) => (ctx.mp[l] && jugadorPorId(id)) || jugadorMP(ctx, l, dorsal);
  const fechaLarga = sn => { const [d, m] = (sn.fecha || '').split('/'); if (!d) return ''; const y = new Date().getFullYear(); return DIA[new Date(y, +m - 1, +d).getDay()] + ' ' + (+d) + ' ' + MES[+m - 1]; };
  function escenaPresentacion(ctx) {
    const { sn } = ctx, P = sn.plantillas;
    if (!P || ESC.abierta || ESC.cargando || !A) return false;
    // en un derbi los dos equipos son nuestros: los dos se presentan igual, uno a uno (primero el local)
    const derbi = ctx.mp.L && ctx.mp.V, nos = ctx.mp.L ? 'L' : ctx.mp.V ? 'V' : null, riv = nos === 'L' ? 'V' : 'L';
    const lados = (derbi ? ['L', 'V'] : [nos]).filter(l => l && P[l] && P[l].length);
    if (!lados.length) return false;
    const plantillaDe = l => ordenPl(P[l]).map(j => { const p = jugadorDe(ctx, l, j.id_player, j.dorsal); return { j, foto: (p && p.foto) || '', ini: p ? ini(p.nombre, p.apellidos) : iniDe(j.jugador_corto || j.jugador),
      // el nombre como lo tenemos nosotros (el acta trae alguno mal: «Müller Magg» es «Müller-Magg»)
      nm: (p && p.nombre) || j.nombre || '', ap: (p && p.apellidos) || j.apellido || j.jugador_corto || '', fem: !!(p && p.fem) }; });
    const rivs = !derbi && P[riv] ? ordenPl(P[riv]) : [];
    const estr = innerWidth < 640 || innerWidth / Math.max(1, innerHeight) < .8;
    const liga = ((sn.liga || '') + (sn.jornada ? ' · J' + sn.jornada : '')).toUpperCase();
    const escB = (l, cls) => { const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent'; return `<i class="${cls}" style="box-shadow:0 0 0 3px ${ctx.mp[l] ? RED : '#FFFFFF'};background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}"></i>`; };
    const el = document.createElement('div');
    el.className = 'escena esc-pres' + (estr ? ' estr' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Alineación de ' + lados.map(l => ctx.nombre[l]).join(' y '));
    el.innerHTML = `<div class="foco a"></div><div class="foco b"></div><div class="ep-stage"></div>
      <div class="esc-top"><div class="l">PRESENTACIÓN · ${esc(liga)}</div><div class="r">${sn.pista ? `<div class="pista"><i></i><span>PISTA</span><b>${esc(pistaBonita(sn.pista))}</b></div>` : ''}<button type="button" class="esc-saltar" data-esc-cierra>Saltar ›</button></div></div>`;
    document.body.appendChild(el);
    document.documentElement.style.overflow = 'hidden';
    const stage = el.querySelector('.ep-stage'), timers = [], luego = (ms, f) => timers.push(setTimeout(f, ms));
    const cuando = [fechaLarga(sn), sn.hora].filter(Boolean).join(' · ');
    // 1 · título y 2 · los nuestros uno a uno, por cada equipo nuestro (en un derbi, los dos)
    let t = 0;
    lados.forEach(l => {
      const mps = plantillaDe(l);
      const titulo = `<div class="pr-tit">${escB(l, 'e0')}<div class="k">${derbi ? 'DERBI · ' : ''}ALINEACIÓN</div><div class="n">${esc(ctx.nombre[l])}</div><div class="bar"></div><div class="s">${esc([liga, cuando].filter(Boolean).join(' · '))}</div></div>`;
      if (!t) stage.innerHTML = titulo; else luego(t, () => { stage.innerHTML = titulo; });
      t += 1600;
      luego(t, () => {
        stage.innerHTML = `<div class="pr-mp"><div class="pr-hero"></div><div class="pr-rej" style="--cols:${Math.max(3, Math.ceil(mps.length / 3))}">${mps.map(x => `<div>${x.foto ? `<div class="f" style="background-image:url('${esc(x.foto)}')"></div>` : `<div class="i">${esc(x.ini)}</div>`}<div class="d">${esc(x.j.dorsal)}</div></div>`).join('')}</div></div>`;
      });
      mps.forEach((x, k) => luego(t + k * 1250, () => {
        const hero = stage.querySelector('.pr-hero'), celdas = [...stage.querySelectorAll('.pr-rej > div')];
        if (!hero) return;
        const r0 = ROL_TXT[x.j.rol] || ['JUGADOR', '#26262A', '#F4F4F5'];
        const r = x.fem ? [{ PORTERO: 'PORTERA', 'CAPITÁN': 'CAPITANA', JUGADOR: 'JUGADORA' }[r0[0]] || r0[0], r0[1], r0[2]] : r0;
        hero.innerHTML = `<div class="pr-big"><span>${esc(x.j.dorsal)}</span></div>
          <div class="pr-foto">${x.foto ? `<div class="f" style="background-image:url('${esc(x.foto)}')"></div>` : `<div class="i">${esc(x.ini)}</div>`}<div class="d">${esc(x.j.dorsal)}</div></div>
          <div class="pr-nom"><div class="rol" style="background:${r[1]};color:${r[2]}">${r[0]}</div><div class="nm">${esc(x.nm)}</div><div class="ap">${x.ap.toUpperCase().split(/\s+/).filter(Boolean).map(w => `<span style="white-space:nowrap">${esc(w)}</span>`).join(' ')}</div>
            <div class="cnt">${p2(k + 1)} / ${p2(mps.length)}</div></div>`;
        // el apellido, siempre con sus palabras enteras: si alguna no cabe, se reduce la letra (y como último recurso, se parte)
        const ap = hero.querySelector('.ap'); let fs = parseFloat(getComputedStyle(ap).fontSize);
        while (ap.scrollWidth > ap.clientWidth + 1 && fs > 30) { fs -= 3; ap.style.fontSize = fs + 'px'; }
        if (ap.scrollWidth > ap.clientWidth + 1) { ap.style.overflowWrap = 'anywhere'; ap.querySelectorAll('span').forEach(w => { w.style.whiteSpace = 'normal'; }); }
        celdas.forEach((cl, q) => { cl.classList.toggle('on', q <= k); cl.classList.toggle('cur', q === k); });
      }));
      t += mps.length * 1250;
    });
    // 3 · rival en lista (no en un derbi)
    if (rivs.length) {
      luego(t, () => {
        const pos = j => (j.rol === 'P' ? 'POR' : j.rol === 'C' ? 'CAP' : j.rol === 'A' ? 'ASIS' : '');
        const pel = peligrosos(sn, riv);
        stage.innerHTML = `<div class="pr-riv"><div class="cab">${escB(riv, 'e1')}<div class="k">RIVAL</div><div class="n">${esc(ctx.nombre[riv])}</div>${pel.size ? '<div class="pel-k">En rojo, sus jugadores más peligrosos</div>' : ''}</div>
          <div class="lista">${rivs.map((j, q) => { const p = pel.get(j.id_player);
            return `<div class="j${p ? ' pel' : ''}" style="animation-delay:${(0.35 + q * 0.09).toFixed(2)}s"><b>${esc(j.dorsal)}</b><span>${esc(quienD(ctx, riv, j.dorsal, j.jugador_corto, j.jugador).replace(/^#\d+\s+/, ''))}${p ? `<small>PELIGRO · ${esc(p.motivo)}</small>` : ''}</span><em>${pos(j)}</em></div>`; }).join('')}</div></div>`;
      });
      t += 3200;
    }
    // 4 · escudos chocando «VS», con la hora y la pista
    luego(t, () => {
      const h = sn._resumen ? cuando.toUpperCase() : sn.estado === 'previa' ? (sn.hora ? sn.hora + ' · EMPIEZA' : 'EMPIEZA') : sn.estado === 'directo' || sn.estado === 'descanso' ? 'EN JUEGO' : cuando.toUpperCase();
      stage.innerHTML = `<div class="pr-vs"><div class="fila"><div class="eq l">${escB('L', '')}<span>${esc(ctx.abr.L)}</span></div><span class="vs">VS</span><div class="eq v">${escB('V', '')}<span>${esc(ctx.abr.V)}</span></div></div>
        <div class="chips">${h ? `<span class="h">${esc(h)}</span>` : ''}${sn.pista ? `<span class="p"><i></i>${esc(pistaBonita(sn.pista))}</span>` : ''}</div></div>`;
    });
    t += 3000;
    let cerrada = false;
    const cerrar = () => {
      if (cerrada) return; cerrada = true;
      timers.forEach(clearTimeout); document.removeEventListener('keydown', tecla);
      el.classList.add('cierra'); setTimeout(() => el.remove(), 400);
      document.documentElement.style.overflow = ''; ESC.abierta = null;
      document.dispatchEvent(new CustomEvent('mp-escena-fin', { detail: 'presentacion' }));
    };
    const tecla = e => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    el.querySelector('[data-esc-cierra]').addEventListener('click', cerrar);
    luego(t, cerrar);
    ESC.abierta = { tipo: 'presentacion', cerrar };
    return true;
  }
  // en directo: una vez, al abrirse el acta antes de que haya ningún apunte (en el resumen la lanza su bucle)
  function presentarSiToca(ctx) {
    const { sn } = ctx;
    if (!sn.plantillas || !MOV || ESC.abierta || ESC.cargando || (RSM.activo && RSM.idp === DV.idp)) return;
    if (PRES_VISTAS.has(sn.idp) || !(sn.estado === 'previa' || (sn.estado === 'directo' && (sn.periodo || 1) === 1 && !sn.eventos.length))) return;
    PRES_VISTAS.add(sn.idp);
    escenaPresentacion(ctx);
  }
  const alinBtn = sn => (sn && sn.plantillas ? '<button type="button" class="dv-alin" data-alin>▶ Ver alineación</button>' : '');
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-alin]')) return;
    const sn = snapDV();
    if (!sn) return;
    if (MOV) escenaPresentacion(ctxDirecto(sn)); else { const f = $('[data-dv="ficha"]'); if (f) f.scrollIntoView({ block: 'start' }); }   // sin animaciones: a la ficha
  });

  function pintarFinal() {
    const sn = snapDV(), cont = $('[data-dv="final"]');
    if (!sn || !cont) return;
    const h = finalHtml(ctxDirecto(sn), true);
    if (!h) cont.innerHTML = ''; else if (!cont.firstElementChild) cont.innerHTML = h;
  }
  // 9e · «Hoy»: todos nuestros partidos del día con su estado; el que se juega, con fondo granate
  function hoyHtml() {
    const d = new Date(), hoyDM = p2(d.getDate()) + '/' + p2(d.getMonth() + 1);
    const ps = Object.values(LIVE.snaps).filter(sn => !sn.fecha || sn.fecha === hoyDM).sort((a, b) => horaDe(a).localeCompare(horaDe(b)));
    if (!ps.length) return '';
    const escHoy = (ctx, l) => { const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent';
      return `<div class="esc2" style="box-shadow:0 0 0 1.5px ${ctx.mp[l] ? RED : '#FFFFFF'};background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}"></div>`; };
    return `<div class="dv-hoy-t">HOY · ${DIA[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]}</div>` + ps.map(sn => {
      const ctx = ctxDirecto(sn), vivo = sn.estado === 'directo' || sn.estado === 'descanso';
      const st = sn.estado === 'directo' ? '● ' + estadoCorto(sn) : sn.estado === 'descanso' ? '● DESCANSO' : sn.estado === 'final' ? 'FINAL' : (sn.hora || 'POR FIJAR');
      const m = sn.idp === DV.idp && !DV.vacio && !RSM.activo ? DV.mostrado : { gl: sn.gl || 0, gv: sn.gv || 0 };
      const cat = (sn.liga || '').replace(/^Liga\s+/i, '').toUpperCase() + ' · ' + (ctx.mp.L && ctx.mp.V ? 'DERBI' : sn.hora || '');
      return `<a class="blk dv-hoy${vivo ? ' vivo' : ''}" href="#/directo/${encodeURIComponent(sn.idp)}${sn.estado === 'final' ? '/resumen' : ''}"><div class="c"><span>${esc(cat)}</span><span${vivo ? ' class="r"' : ''}>${esc(st)}</span></div>
        <div class="e"><div>${escHoy(ctx, 'L')}<span>${esc(ctx.abr.L)}</span></div><b>${sn.estado === 'previa' ? 'vs' : m.gl + '–' + m.gv}</b><div><span>${esc(ctx.abr.V)}</span>${escHoy(ctx, 'V')}</div></div></a>`;
    }).join('');
  }
  function pintarHoy() { const c = $('[data-dv="hoy"]'); if (c) c.innerHTML = hoyHtml(); }

  /* ── 10a · La pista: mapa a pantalla completa (prototipo «Pista intro.html») ────────────────────────────────────
     Al abrir el partido en la previa o la primera vez en la sesión: la Comunidad se dibuja, el resto de pistas como puntos,
     vuelo a la pista, pin con onda y el nombre palabra a palabra. Solo pistas con coordenadas comprobadas (data/venues_geo.json);
     sin ellas no hay escena (no se inventa el sitio). Leaflet y el mapa se cargan solo cuando hacen falta. */
  const ESC = { abierta: null, cargando: false };
  let leafletP = null, geoP = null;
  function cargarLeaflet() {
    if (window.L && window.L.map) return Promise.resolve();
    if (!leafletP) leafletP = new Promise((ok, ko) => {
      const l = document.createElement('link');
      Object.assign(l, { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', integrity: 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H', crossOrigin: 'anonymous' });
      const j = document.createElement('script');
      Object.assign(j, { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', integrity: 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH', crossOrigin: 'anonymous', onload: ok, onerror: ko });
      document.head.append(l, j);
    }).catch(e => { leafletP = null; throw e; });
    return leafletP;
  }
  const cargarGeo = () => geoP || (geoP = fetch('data/venues_geo.json').then(r => r.json()).catch(() => { geoP = null; return null; }));
  // «…, Calle de Guadarrama, Galapagar, Comunidad de Madrid, 28260, España» → «Calle de Guadarrama · Galapagar»
  const lugarPista = d => { const p = (d || '').split(',').map(x => x.trim()).filter(x => x && !/^\d+$/.test(x) && !/^Comunidad de Madrid$|^España$/i.test(x)); return p.length <= 2 ? p.slice(-1).join('') : p.slice(-2).join(' · '); };
  function escenaPista(sn, cont) {   // cont: dentro de ese elemento (el vídeo en pantalla completa); si no, toda la página
    const key = (sn && sn.pista || '').toUpperCase();
    if (!key || ESC.abierta || ESC.cargando) return Promise.resolve(false);
    ESC.cargando = true;
    return Promise.all([cargarGeo(), cargarLeaflet()]).then(([geo]) => {
      ESC.cargando = false;
      const v = geo && geo.venues[key];
      if (!v || ESC.abierta) return false;
      const d0 = new Date(), hoyDM = p2(d0.getDate()) + '/' + p2(d0.getMonth() + 1);
      const [dd, mm] = (sn.fecha || '').split('/'), cuando = sn.fecha && sn.fecha !== hoyDM && dd ? 'LA PISTA · ' + DIA[new Date(d0.getFullYear(), +mm - 1, +dd).getDay()] + ' ' + (+dd) + ' ' + MES[+mm - 1] : 'LA PISTA DE HOY';
      const el = document.createElement('div');
      el.className = 'escena esc-pista' + (cont ? ' en-video' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'La pista: ' + key);
      el.innerHTML = `<div class="ep-mapa"></div><div class="ep-vig"></div><div class="ep-cam"><i></i><i></i><i></i><i></i></div>
        <div class="ep-hud"><span>${esc(cuando)}</span><b data-coord></b></div><button type="button" class="esc-saltar" data-esc-cierra>Saltar ›</button>
        <div class="ep-card"><div class="ep-k">PISTA</div><div class="ep-n">${key.split(' ').map((w, i) => `<span style="animation-delay:${(0.12 + i * 0.07).toFixed(2)}s">${esc(w)}</span>`).join(' ')}</div><div class="ep-s">${esc(lugarPista(v.display))}</div><div class="ep-bar"></div></div>`;
      (cont || document.body).appendChild(el);
      document.documentElement.style.overflow = 'hidden';
      const map = L.map(el.querySelector('.ep-mapa'), { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, zoomSnap: 0 });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
      const fmtC = ll => Math.abs(ll.lat).toFixed(4) + ' N · ' + Math.abs(ll.lng).toFixed(4) + ' O', coord = el.querySelector('[data-coord]');
      map.on('move', () => { coord.textContent = fmtC(map.getCenter()); });
      const target = [v.lat, v.lon], timers = [], luego = (ms, f) => timers.push(setTimeout(f, MOV ? ms : 0));
      map.setView(MOV ? [40.50, -3.72] : target, MOV ? (el.clientWidth < 600 ? 7.6 : 8.6) : 16, { animate: false });
      coord.textContent = fmtC(map.getCenter());
      if (geo.madrid_polygon && geo.madrid_polygon.length) {   // silueta de la Comunidad, que se dibuja
        const poly = L.polygon(geo.madrid_polygon.map(([lo, la]) => [la, lo]), { color: '#D3202A', weight: 2, fillColor: '#D3202A', fillOpacity: .06, interactive: false }).addTo(map);
        const pe = poly.getElement();
        if (pe && MOV) { const len = pe.getTotalLength(); pe.style.strokeDasharray = len; pe.style.strokeDashoffset = len; pe.style.animation = 'mpDraw 1.6s cubic-bezier(.6,0,.2,1) forwards'; }
      }
      if (MOV) L.marker([40.36, -3.70], { interactive: false, icon: L.divIcon({ className: '', html: '<div class="ep-lbl" data-mlbl>MADRID</div>', iconSize: [0, 0] }) }).addTo(map);
      Object.entries(geo.venues).forEach(([k, p], i) => { if (k !== key) L.marker([p.lat, p.lon], { interactive: false, icon: L.divIcon({ className: '', html: `<div class="ep-vdot" style="animation-delay:${(0.5 + i * 0.04).toFixed(2)}s"></div>`, iconSize: [8, 8], iconAnchor: [4, 4] }) }).addTo(map); });
      let cerrada = false;
      const cerrar = () => {
        if (cerrada) return; cerrada = true;
        timers.forEach(clearTimeout); document.removeEventListener('keydown', tecla);
        el.classList.add('cierra');
        setTimeout(() => { try { map.remove(); } catch (e) { /* ya quitado */ } el.remove(); }, MOV ? 400 : 0);
        document.documentElement.style.overflow = ''; ESC.abierta = null;
        document.dispatchEvent(new CustomEvent('mp-escena-fin', { detail: 'pista' }));
      };
      const tecla = e => { if (e.key === 'Escape') cerrar(); };
      document.addEventListener('keydown', tecla);
      el.querySelector('[data-esc-cierra]').addEventListener('click', cerrar);
      ESC.abierta = { tipo: 'pista', cerrar };
      luego(1900, () => { const m = el.querySelector('[data-mlbl]'); if (m) m.style.opacity = 0; if (MOV) { try { map.invalidateSize(); map.flyTo(target, 16, { duration: 3.8, easeLinearity: 0.2 }); } catch (e) { map.setView(target, 16, { animate: false }); } } });   // si el tamaño cambia a medias, va directo
      luego(5800, () => {   // pin con onda, el pin queda por encima de la tarjeta y el nombre entra
        L.marker(target, { interactive: false, icon: L.divIcon({ className: '', html: '<div class="ep-pin"><em></em><em></em><span></span></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map);
        map.panBy([0, Math.round(el.clientHeight * 0.16)], { animate: MOV, duration: .6 });
        el.querySelector('.ep-cam').style.opacity = 0; el.querySelector('.ep-card').classList.add('on');
      });
      timers.push(setTimeout(cerrar, MOV ? 9800 : 3000));
      return true;
    }).catch(() => { ESC.cargando = false; return false; });
  }
  // en la previa, o la primera vez que se abre el partido en esta sesión; en el resumen, siempre que empieza (es el principio de la historia)
  function pistaSiToca(sn, siempre) {
    if (!sn || !sn.pista) return;
    const k = 'mp-pista-' + sn.idp;
    let visto = false;
    try { visto = sessionStorage.getItem(k) === '1'; } catch (e) { /* sin almacenamiento */ }
    if (!siempre && visto && sn.estado !== 'previa') return;
    try { sessionStorage.setItem(k, '1'); } catch (e) { /* sin almacenamiento */ }   // también cuando sale por empezar un resumen
    escenaPista(sn);
  }
  const pistaChip = sn => (sn && sn.pista ? `<button type="button" class="dv-pista" data-pista title="Ver la pista en el mapa"><i></i><span>PISTA</span><b>${esc(pistaBonita(sn.pista))}</b></button>` : '');
  document.addEventListener('click', e => { if (e.target.closest('[data-pista]')) escenaPista(snapDV()); });
  document.addEventListener('mp-escena-fin', () => { const sn = snapDV(); if (sn && $('[data-dv="caja"]')) presentarSiToca(ctxDirecto(sn)); });

  /* ── Modo resumen (#/directo/{idp}/resumen): un partido terminado se vuelve a «jugar» deprisa ─────────────────
     El reloj corre (el partido entero en unos 25 s y parado mientras pasa cada cortina de gol); los eventos entran a su
     minuto, el marcador sube con las cortinas, y al final aparecen los porteros, los tiros y la franja del resultado.
     Los tiros de cada portero solo se conocen al final (el acta no dice cuándo fue cada uno): no se inventan por el camino. */
  const RSM = { activo: false, idp: null, final: null, foto: null, T: 0, fase: '', nuevos: [], pausa: 0, timer: null, tPen: null, saltado: false };
  const snapDV = () => (RSM.activo && RSM.idp === DV.idp ? RSM.foto : LIVE.snaps[DV.idp]);
  const fuenteNuevos = () => (RSM.activo && RSM.idp === DV.idp ? RSM.nuevos : LIVE.nuevos);
  function fotoResumen(S, T) {
    const dur = S.duracion_periodo || 1200, p = T < dur || RSM.fase === 'descanso' || RSM.fase === 'p1fin' ? 1 : 2, tp = Math.max(0, Math.min(dur, p === 1 ? T : T - dur));
    const tE = e => (e.t != null ? segs(e.t) : e.t_acta ? dur - segs(e.t_acta) : 0);
    const evs = S.eventos.filter(e => !e.periodo || e.periodo < p || (e.periodo === p && tE(e) <= tp));
    return Object.assign({}, S, { _resumen: true, estado: RSM.fase === 'descanso' ? 'descanso' : 'directo', periodo: p, reloj: mmssD(tp), fase: null, penaltis: null,
      gl: evs.filter(e => e.tipo === 'GOL' && e.lado === 'L').length, gv: evs.filter(e => e.tipo === 'GOL' && e.lado === 'V').length, eventos: evs, porteros: [], tiros: null });
  }
  function aplicarFotoResumen(f) {
    const ids = new Set(RSM.foto.eventos.map(e => e.id));
    f.eventos.filter(e => !ids.has(e.id)).forEach(e => RSM.nuevos.push({ idp: RSM.idp, ev: e }));
    RSM.foto = f;
    if (RSM.idp === DV.idp && !DV.vacio) actualizarDirecto();
  }
  function pasoResumen() {
    if (!RSM.activo || !new RegExp('^#/directo/' + RSM.idp + '/resumen').test(location.hash.replace(/%2F/g, '/'))) return pararResumen();
    if (DV.pendientes > 0 || Date.now() < RSM.pausa || Date.now() - (DV.finCortina || 0) < 1300 || RSM.fase === 'fin' || ESC.abierta || ESC.cargando) return;
    const S = RSM.final, dur = S.duracion_periodo || 1200;
    if (RSM.fase === 'pista') {   // la escena de la pista ya pasó (o no tocaba): la presentación, si hay convocados
      RSM.fase = S.plantillas && MOV && escenaPresentacion(ctxDirecto(snapDV())) ? 'pres' : '';
      return;
    }
    if (RSM.fase === 'pres') { RSM.fase = ''; RSM.pausa = Date.now() + 500; return; }
    if (RSM.fase === 'p2fin' || RSM.fase === 'pen') return tandaResumen();
    if (RSM.fase === 'p1fin') { RSM.fase = 'descanso'; RSM.pausa = Date.now() + 1600; return aplicarFotoResumen(fotoResumen(S, dur)); }
    if (RSM.fase === 'descanso') RSM.fase = 'p2';
    RSM.T += 2 * dur / 25 * 0.1;
    // al acabar cada parte, primero su último minuto (con sus goles, y sus cortinas) y después el descanso o el final
    if (RSM.fase === '' && RSM.T >= dur) { RSM.T = dur; RSM.fase = 'p1fin'; } else if (RSM.T >= 2 * dur) { RSM.T = 2 * dur; RSM.fase = 'p2fin'; }
    aplicarFotoResumen(fotoResumen(S, RSM.T));
  }
  // la tanda: se aplica el final (con la tanda entera y su ganador) y la escena 10d la cuenta lanzamiento a lanzamiento
  const tandaResumen = () => finResumen();
  function finResumen() {
    RSM.fase = 'fin'; clearInterval(RSM.timer); RSM.timer = null;
    aplicarFotoResumen(Object.assign({}, RSM.final, { _resumen: true }));
    quizasResumen();   // si no quedó nada por anunciar
  }
  function pararResumen() { clearInterval(RSM.timer); clearTimeout(RSM.tPen); RSM.timer = RSM.tPen = null; RSM.activo = false; }
  // devuelve el aviso de espera si aún no tenemos el partido; si no, deja preparada la simulación (o el final, si se saltó)
  function prepararResumen(idp) {
    const S = RSM.final && RSM.final.idp === idp ? RSM.final : LIVE.snaps[idp];
    if (!S) { cargarPartidoResumen(idp); return `<div class="dv-espera" data-dv="espera">${SKEL(260)}</div>`; }
    if (S.estado !== 'final') { pararResumen(); return null; }   // aún se juega: la página del directo
    pararResumen();
    Object.assign(RSM, { activo: true, idp, final: S, T: 0, fase: '', nuevos: [], pausa: Date.now() + 900, resumenVisto: false });
    if (RSM.saltado || !MOV) { RSM.fase = 'fin'; RSM.foto = Object.assign({}, S, { _resumen: true }); setTimeout(() => quizasResumen(true), 0); return null; }   // directo al final: el resumen
    RSM.fase = 'pista';   // primero la pista (si toca), luego la presentación
    RSM.foto = fotoResumen(S, 0);
    RSM.timer = setInterval(pasoResumen, 100);
    return null;
  }
  function cargarPartidoResumen(idp) {
    const url = DIRECTO_EJEMPLO ? DIRECTO_URL : DIRECTO_URL + '?idp=' + encodeURIComponent(idp);
    fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(d => {
      const S = (d.partidos || []).find(p => p.idp === idp);
      if (!S) { const w = $('[data-dv="espera"]'); if (w) w.textContent = 'No encuentro este partido en el acta de la federación.'; return; }
      RSM.final = S;
      if (location.hash.indexOf('#/directo/' + idp) === 0) render();
    }).catch(() => { const w = $('[data-dv="espera"]'); if (w) w.textContent = 'Sin conexión con el acta de la federación. Prueba otra vez en un momento.'; });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-res]');
    if (!b) return;
    RSM.saltado = b.dataset.res === 'saltar';
    render();
  });
  const barraResumen = () => (RSM.activo && RSM.idp === DV.idp ? `<div class="dv-resumen"><span><b>▶</b>RESUMEN · ASÍ FUE EL PARTIDO</span>${MOV ? `<span class="b">${RSM.fase === 'fin' ? '' : '<button type="button" data-res="saltar">Saltar al final</button>'}<button type="button" data-res="repetir">↺ Repetir</button></span>` : ''}</div>` : '');

  const esperaHtml = () => (LIVE.ok === false && !LIVE.cargado ? casoHtml('Directo', 'El directo no está disponible', 'Ahora mismo no podemos seguir el partido en vivo. El resultado saldrá con el acta de la FMP.', 'SIN CONEXIÓN', 'neutro')
    : LIVE.cargado || (!LIVE.sesion && !DIRECTO_EJEMPLO) ? casoHtml('Directo', 'Este partido no está ahora en el directo', 'Cuando empiece, el marcador saldrá aquí solo. Si ya terminó, el resultado saldrá con el acta de la FMP.') : SKEL(260));
  /* ── Así fue el partido (rediseño final · «Resumen sin vídeo», #/directo/{idp}/resumen): el partido se vuelve a jugar deprisa
     en la misma página con las piezas del directo: alineaciones, reloj que corre (el partido entero en unos 10 s), marcador de
     rodillo, aviso de cada momento al lado del marcador, porteros con su % de paradas que se mueve con cada tiro y línea de
     tiempo. Al terminar, la página se queda en el acta. Sin escenas a pantalla completa y sin compartir.
     Datos: el partido de app.json (con los tiros de tiros.json); recién acabado, antes del proceso de la noche, el del directo.
     La tanda, lanzamiento a lanzamiento, solo si la trae el servicio del directo: nunca se inventa. ── */
  const RS = { vivo: false, previa: false, relojOk: false, visto: 0, idp: null, sn: null, tTiros: null, m: null, fase: '', g: 0, vel: 1, pausa: false, desc: false, kick: 2, hold: 0, ann: null, annAt: 0, timer: null, tos: [], snap: {}, pidio: {}, flash: null, pen: null };
  const rsLater = (fn, ms) => { RS.tos.push(setTimeout(fn, ms)); };
  function rsLimpiar() { clearInterval(RS.timer); RS.timer = null; RS.tos.forEach(clearTimeout); RS.tos = []; }
  const rsMin = t => Math.max(1, Math.ceil(t / 60)) + "'";
  const rsRel = g => Math.floor(g / 60) + ':' + p2(Math.floor(g % 60));
  const rsEs = n => ours(n);
  // «#9 Santiago Muñoz»: de los nuestros, con su apodo si lo tiene; del rival, nombre y primer apellido
  function rsQ(j, nuestro) { if (!j) return ''; const J = nuestro && j.k && A.jugadores[j.k]; const n = J ? nomCorto(J) : j.nombre ? corto(j, true) : (j.jugador_corto || j.jugador || '');
    return ((j.dorsal ? '#' + j.dorsal + ' ' : '') + n).trim(); }
  const rsFoto = (j, nuestro) => { if (!nuestro || !j) return null; const J = (j.k && A.jugadores[j.k]) || j; return fotoOK(J) ? J.foto : null; };
  const rsApe = j => { const w = (j.apellidos || '').split(' ').filter(Boolean), o = []; for (const x of w) { o.push(x); if (!PART.has(x.toLowerCase()) || o.length === w.length) break; } return o.join(' ') || j.nombre || ''; };

  // el partido de app.json → el modelo del resumen (minutos en segundos de juego, lados 'L'/'V')
  function rsModelo(p) {
    const per = (/^senior/.test(p.liga) ? 25 : 20) * 60, tot = per * 2; let ml = 0, mv = 0;
    const ev = (p.ev || []).filter(e => /^P[12]$/.test(e.periodo) && ['gol', 'falta', 'cambio_portero'].includes(e.tipo)).map(e => {
      const [mm, ss] = (e.minuto || '0:0').split(':').map(Number), pn = +e.periodo.slice(1), rest = mm * 60 + ss;
      // el acta apunta algunos cambios de portero a 00:00 o al minuto entero de la parte: son del principio de esa parte
      const t = e.tipo === 'cambio_portero' && (rest === 0 || rest >= per) ? (pn - 1) * per : (pn - 1) * per + per - rest;
      return { t: Math.max(0, Math.min(tot, t)), tipo: e.tipo === 'cambio_portero' ? 'cambio' : e.tipo, lado: e.lado === 'local' ? 'L' : 'V', j: e.jugador || null, as: e.asistencia || null, falta: e.falta || '', min: e.minutos || 0 }; })
      .sort((a, b) => a.t - b.t).map(e => { if (e.tipo === 'gol') { if (e.lado === 'L') ml++; else mv++; } return Object.assign(e, { ml, mv }); });
    const x = TIR && TIR[p.idp]; let tiros = null;
    if (x && x.s && x.s.length) { tiros = []; let a0 = 0, b0 = 0; x.s.forEach(([t, a, b]) => { for (let i = a0; i < a; i++) tiros.push({ t, lado: 'L' }); for (let i = b0; i < b; i++) tiros.push({ t, lado: 'V' }); a0 = Math.max(a0, a); b0 = Math.max(b0, b); }); }
    return { idp: p.idp, mid: p.mid, liga: p.liga, ligaNombre: p.ligaNombre || (lgOf(p.liga) || {}).nombre || '', jornada: p.jornada, fecha: p.fecha, hora: p.hora, pista: p.pista,
      local: p.local, visitante: p.visitante, gl: p.gl, gv: p.gv, pen: p.pen ? (p.pen === p.local ? 'L' : 'V') : null, per, tot, ev, tiros,
      alin: { L: p.alin_l || [], V: p.alin_v || [] }, por: { L: p.por_l || [], V: p.por_v || [] }, staff: { L: p.staff_l || [], V: p.staff_v || [] }, arb: p.arb || [],
      tl: p.tl, tv: p.tv, mvp: p.mvp || null, tanda: null };
  }
  // recién acabado (aún no está en app.json): el modelo sale del directo
  function rsModeloSnap(sn) {
    const ctx = ctxDirecto(sn), cal = enCalendario(sn), ligaId = cal ? cal.L.id : '', per = (ctx.dur || (/SENIOR/i.test(sn.liga || '') ? 1500 : 1200)), tot = per * 2;
    const nombre = { L: ctx.nombre.L, V: ctx.nombre.V };
    const persona = (l, dorsal, completo, cortoTxt) => { const J = ours(nombre[l]) ? jugadorMP(ctx, l, dorsal) : null;
      if (J) return Object.assign({ dorsal }, J); const w = (completo || '').split(' '); return { dorsal, nombre: w[0] || cortoTxt || '', apellidos: w.slice(1).join(' ') }; };
    let ml = 0, mv = 0;
    const ev = (sn.eventos || []).filter(e => (e.periodo === 1 || e.periodo === 2) && ['GOL', 'FALTA', 'CAMBIO DE PORTERO'].includes(e.tipo) && segs(e.t) != null).map(e => ({
      t: Math.min(tot, (e.periodo - 1) * per + segs(e.t)), tipo: e.tipo === 'GOL' ? 'gol' : e.tipo === 'FALTA' ? 'falta' : 'cambio', lado: e.lado,
      j: e.dorsal || e.jugador ? persona(e.lado, e.dorsal, e.jugador, e.jugador_corto) : null, as: e.asist_dorsal || e.asist_jugador ? persona(e.lado, e.asist_dorsal, e.asist_jugador, e.asist_corto) : null,
      falta: e.falta_tipo ? motivoFalta(e) : '', min: e.min_sancion || 0 })).sort((a, b) => a.t - b.t)
      .map(e => { if (e.tipo === 'gol') { if (e.lado === 'L') ml++; else mv++; } return Object.assign(e, { ml, mv }); });
    const pl = sn.plantillas || {}, porteros = sn.porteros || [];
    const alin = l => (pl[l] || []).map(x => Object.assign(persona(l, x.dorsal, x.jugador || ((x.nombre || '') + ' ' + (x.apellido || '')), x.jugador_corto), {
      portero: porteros.some(q => q.lado === l && q.dorsal === x.dorsal) || x.portero, capitan: x.pos === 'C' || x.rol === 'C', asistente: x.pos === 'A' || x.rol === 'A' }));
    const por = l => porteros.filter(q => q.lado === l).map(q => { const b = persona(l, q.dorsal, q.jugador, q.jugador_corto), par = Math.max(0, (q.tiros || 0) - (q.gc || 0));
      return Object.assign(b, { tiros: q.tiros || 0, gc: q.gc || 0, par, pct: q.tiros ? par / q.tiros * 100 : 0 }); });
    const t2 = TIR_VIVO[sn.idp]; let tiros = null;
    if (t2 && t2.s && t2.s.length) { tiros = []; let a0 = 0, b0 = 0; t2.s.forEach(([t, a, b]) => { for (let i = a0; i < a; i++) tiros.push({ t, lado: 'L' }); for (let i = b0; i < b; i++) tiros.push({ t, lado: 'V' }); a0 = Math.max(a0, a); b0 = Math.max(b0, b); }); }
    const st = sn.staff || {}, [dd, mm] = (sn.fecha || '').split('/'), anio = new Date().getFullYear();
    return { idp: sn.idp, mid: cal && cal.c.mid, liga: ligaId || (/SENIOR/i.test(sn.liga || '') ? 'senior' : 'cantera'), ligaNombre: titulo(sn.liga || ''), jornada: sn.jornada, fecha: dd && mm ? anio + '-' + mm + '-' + dd : '', hora: sn.hora, pista: sn.pista,
      local: nombre.L, visitante: nombre.V, gl: sn.gl || 0, gv: sn.gv || 0, pen: sn.penaltis && sn.penaltis.ganador ? sn.penaltis.ganador : null, per, tot, ev, tiros,
      alin: { L: alin('L'), V: alin('V') }, por: { L: por('L'), V: por('V') }, staff: { L: (st.L || []).map(x => x.nombre), V: (st.V || []).map(x => x.nombre) }, arb: sn.arbitros || [],
      tl: sn.tiros ? sn.tiros.l : null, tv: sn.tiros ? sn.tiros.v : null, mvp: null, tanda: null };
  }
  // la tanda, lanzamiento a lanzamiento, del servicio del directo (si aún la tiene)
  function rsTanda(m, sn) {
    const td = sn && sn.penaltis && sn.penaltis.tanda; if (!td || !td.length) return null;
    return td.map(x => { const lista = m.alin[x.lado] || [], j = lista.find(y => String(y.dorsal) === String(x.dorsal));
      return { lado: x.lado, ronda: x.ronda, gol: !!x.gol, j: j || { dorsal: x.dorsal, nombre: x.jugador_corto || x.jugador || '' } }; });
  }
  // tramos de cada portería: quién estaba en pista de qué segundo a qué segundo (con los cambios de portero del acta)
  function rsPorteria(m) {
    const k = p => p && (p.k || '#' + p.dorsal);
    return ['L', 'V'].map(l => { const lista = m.por[l] || [], o = l === 'L' ? 'V' : 'L', cambios = m.ev.filter(e => e.tipo === 'cambio' && e.lado === l && e.j);
      const ini0 = lista.find(p => !cambios.length || k(p) !== k(cambios[0].j)) || lista[0] || (cambios[0] && cambios[0].j);
      const segs2 = ini0 ? [{ p: ini0, from: 0 }] : [];
      cambios.forEach(e => { const cur = segs2[segs2.length - 1], nuevo = lista.find(p => k(p) === k(e.j)) || e.j;
        if (cur && k(cur.p) === k(e.j)) return; if (cur && cur.from === e.t) { cur.p = nuevo; return; } segs2.push({ p: nuevo, from: e.t, ev: e, sale: cur && cur.p }); });
      segs2.forEach((sg, i) => { sg.to = i + 1 < segs2.length ? segs2[i + 1].from : m.tot + 1; });
      return { l, o, segs: segs2 }; });
  }
  const rsAnunciable = (m, e) => e.tipo === 'gol' || (e.tipo === 'falta' && e.min >= 2) || (e.tipo === 'cambio' && RS.POR.some(x => x.segs.some(s => s.ev === e)));

  // ── la página ──
  function vResumen(idp) {
    rsLimpiar(); clearInterval(RS.tTiros); RS.vivo = false;
    const espera = '<div class="carga" role="status" aria-label="Cargando"><div class="sk" style="height:48px;width:50%;margin-top:24px"></div><div class="sk" style="height:420px"></div></div>';
    const h = location.hash, otra = () => { if (location.hash === h) render(); };
    if (!TIR) { cargarTiros().then(otra); return espera; }
    const p = Object.values(A.partidos).find(x => x.idp === idp && x.gl != null);
    let sn = LIVE.snaps[idp] || RS.snap[idp];
    const pide = () => { RS.pidio[idp] = true; fetch(DIRECTO_URL + (DIRECTO_URL.includes('?') ? '&' : '?') + 'idp=' + encodeURIComponent(idp), { cache: 'no-store' }).then(r => r.json())
      .then(d => { const x = (d.partidos || [d]).find(y => y.idp === idp); if (x) RS.snap[idp] = x; }).catch(() => {}).then(() => (p ? Promise.resolve() : tirosApi(idp).catch(() => null))).then(otra); };
    let m;
    if (p) {
      m = rsModelo(p);
      if (m.pen && !(sn && sn.penaltis && sn.penaltis.tanda) && !RS.pidio[idp]) { pide(); return espera; }   // la tanda solo la tiene el directo
    } else {
      if (!sn && !RS.pidio[idp]) { pide(); return espera; }
      if (!sn) return `<div class="rs-vacio">${casoHtml('Partido', 'Todavía no está el acta', 'En cuanto la FMP publique el acta de este partido, aquí estará el resumen.', 'ACTA', 'derbi', [['Ir a Inicio', '#/']])}</div>`;
      if (sn.estado !== 'final') { setTimeout(() => { history.replaceState(null, '', '#/directo/' + encodeURIComponent(idp)); render(); }, 0); return espera; }
      if (!RS.pidio[idp]) { pide(); return espera; }
      m = rsModeloSnap(sn);
    }
    m.tanda = m.pen ? rsTanda(m, sn) : null;
    RS.m = m; RS.POR = rsPorteria(m);
    rsLater(rsArrancar, 0);
    return rsHtml(m);
  }

  function rsHtml(m) {
    const derbi = ours(m.local) && ours(m.visitante), lid = m.liga, nm = n => largoEq(n, lid);
    const L = lgOf(lid) || {}, ligaJ = ((L.nombre || m.ligaNombre || '').replace(/^Liga /, '') + (m.jornada ? ' · J' + m.jornada : '')).toUpperCase();
    const cuando = `<div class="rs-cuando"><b>${esc(fd(m.fecha).toUpperCase())}<i>/</i>${esc(m.hora || 'Hora por fijar')}</b><span>${esc(m.pista ? pistaBonita(m.pista).replace(/-Pista \d+$/i, '').replace(/^Polid\. Municipal /i, 'Polideportivo ') : '')}</span></div>`;
    // alineaciones: los nuestros como cromos (foto o iniciales), el rival en fichas de dorsal y apellido
    const orden = l => (l || []).slice().sort((a, b) => (b.portero ? 1 : 0) - (a.portero ? 1 : 0) || (b.capitan ? 1 : 0) - (a.capitan ? 1 : 0) || (b.asistente ? 1 : 0) - (a.asistente ? 1 : 0) || (+a.dorsal || 99) - (+b.dorsal || 99));
    const entr = (j, l) => (m.staff[l] || []).some(s => rsMismo(s, j));
    const roles = (j, l) => [j.portero ? 'POR' : '', j.capitan ? 'C' : '', j.asistente ? 'A' : '', entr(j, l) ? 'ENT' : ''].filter(Boolean);
    const lados = ['L', 'V'].sort((a, b) => (ours(m[b === 'L' ? 'local' : 'visitante']) ? 1 : 0) - (ours(m[a === 'L' ? 'local' : 'visitante']) ? 1 : 0));
    let k0 = 0;
    const alin = lados.map(l => { const n = l === 'L' ? m.local : m.visitante, nos = ours(n), js = orden(m.alin[l]), d0 = k0; k0 += 150 + js.length * (nos ? 45 : 25);
      const cab = `<div class="rs-al-cab">${escudo(n, 32, nos ? 'mp' : '')}<div><b class="${nos ? 'mp' : ''}">${esc(nm(n))}</b><span>${js.length} convocados${m.staff[l] && m.staff[l][0] ? ' · ' + esc(m.staff[l][0]) : ''}</span></div></div>`;
      const cuerpo = nos ? `<div class="rs-cromos${derbi ? ' derbi' : ''}">${js.map((j, i) => { const f = rsFoto(j, true), r = roles(j, l);
          return `<div class="rs-cromo${j.portero ? ' por' : ''}" style="--d:${derbi ? 120 + i * 10 : d0 + 150 + i * 45}ms"><span class="rs-cf"><span class="ini">${esc(ini(j.nombre, j.apellidos))}</span>${f ? `<span class="ph" data-bg="${esc(f)}"></span>` : ''}
            ${r.length ? `<span class="rs-rol${j.portero ? ' por' : ''}">${r.join(' · ')}</span>` : ''}<span class="rs-cd">${esc(j.dorsal || '')}</span></span><span class="rs-cn">${esc(derbi ? (j.nombre || '')[0] + '. ' + rsApe(j) : (j.nombre || '').split(' ')[0] + ' ' + rsApe(j))}</span></div>`; }).join('')}</div>`
        : `<div class="rs-fichas">${js.map((j, i) => { const r = roles(j, l); return `<div class="rs-ficha" style="--d:${d0 + i * 25}ms"><b>${esc(j.dorsal || '')}</b><span>${esc(rsApe(j))}</span>${r.length ? `<i class="${j.portero ? 'por' : ''}">${r.join(' · ')}</i>` : ''}</div>`; }).join('')}</div>`;
      return `<div class="rs-al-eq">${cab}${cuerpo}</div>`; }).join('');
    // marcador: una fila por equipo (escudo, nombre, tiros a puerta, «B» del ganador de la tanda, rodillo)
    const fila = l => { const n = l === 'L' ? m.local : m.visitante, nos = ours(n) && !(derbi && l === 'V');
      return `<div class="rs-fila" data-rs-fila="${l}">${escudo(n, 0, 'rs-esc' + (nos ? ' mp' : ''))}<div class="rs-fn"><b class="${nos ? 'mp' : ''}">${esc(nm(n))}</b>
        <span class="rs-fl"><span class="rs-tir" data-rs-tir="${l}"><b data-rs-tn="${l}">0</b> TIROS A PUERTA</span><span class="rs-tanda" data-rs-td="${l}"></span></span></div><span class="rs-b" data-rs-bp="${l}"></span>
        <div class="rs-rod" data-rs-rod="${l}"><div>${Array.from({ length: Math.max(21, m.gl + 1, m.gv + 1) }, (_, d) => `<span>${d}</span>`).join('')}</div></div></div>`; };
    const portero = l => `<div class="rs-por" data-rs-por="${l}"></div>`;
    const ofi = `<div class="rs-ofi"><div><span class="rs-ok am">${m.arb.length > 1 ? 'ÁRBITROS' : 'ÁRBITRO'}</span>${m.arb.length ? m.arb.map(a => `<span>${esc(a)}</span>`).join('') : '<span class="nada">Sin datos en el acta</span>'}</div>
      ${['L', 'V'].map(l => { const n = l === 'L' ? m.local : m.visitante, st = m.staff[l] || [];
        return `<div><span class="rs-ok${ours(n) ? ' mp' : ''}">BANQUILLO · ${esc(nm(n).toUpperCase())}</span>${st.length ? st.map(s => { const j = (m.alin[l] || []).find(x => rsMismo(s, x)); return `<span>${esc(s)}${j ? `<i class="rs-tj">TAMBIÉN JUEGA · #${esc(j.dorsal)}</i>` : ''}</span>`; }).join('') : '<span class="nada">Sin datos en el acta</span>'}</div>`; }).join('')}</div>`;
    return `<div class="rs" data-rs>
      <div class="rs-card">
        <div class="rs-top"><div class="rs-reloj"><span class="rs-t cifra" data-rs-t>0:00</span><span class="rs-parte" data-rs-parte>ALINEACIONES</span></div>${cuando}</div>
        <div class="rs-alin${derbi ? ' derbi' : ''}" data-rs-alin>${alin}</div>
        <div class="rs-juego" data-rs-juego hidden>
          <div class="rs-main"><div class="rs-marc" data-rs-blq="1">${fila('L')}${fila('V')}</div><div class="rs-ann" data-rs-blq="2" data-rs-ann aria-live="polite"></div></div>
          <div class="rs-pors" data-rs-blq="3">${portero('L')}${portero('V')}</div>
          ${m.tiros || RS.vivo ? '' : '<div class="rs-sintiros">Este partido no tiene los tiros en directo: el % de paradas sale al final, con el acta.</div>'}
          <div class="rs-lin" data-rs-blq="4"><div class="rs-linea" data-rs-linea></div>
            <div class="rs-partes"><span>1.ª PARTE</span><span>DESCANSO</span><span>2.ª PARTE</span></div>
            <div class="rs-ley"><span><i class="g mp"></i>${derbi ? 'Gol de ' + esc(etqEq(m.local, lid, true)) : 'Gol nuestro'}</span><span><i class="g"></i>${derbi ? 'Gol de ' + esc(etqEq(m.visitante, lid, true)) : 'Gol rival'}</span><span><i class="s"></i>Sanción</span><span><i class="c"></i>Cambio de portero</span>${m.tiros ? '<span><i class="t"></i>Tiro a puerta</span>' : ''}<span><i class="b"></i>Barra: ${derbi ? 'por delante · empate' : 'vamos ganando · empate · gana el rival'}</span></div></div>
        </div>
        ${ofi}
        <div class="rs-pie" data-rs-pie></div>
      </div>
      <div class="rs-acta" data-rs-acta></div>
    </div>`;
  }
  const rsMismo = (s, j) => { const a = norm(s), b = norm((j.nombre || '') + ' ' + (j.apellidos || '')); return !!a && !!b.trim() && (a === b || a.includes(b) || b.includes(a)); };

  // ── el motor: alineaciones → saque → juego → (penaltis) → final y acta ──
  function rsRoot() { return document.querySelector('[data-rs]'); }
  function rsArrancar() {
    const root = rsRoot(); if (!root || !RS.m || root.dataset.rsOn) return;
    root.dataset.rsOn = '1'; root.addEventListener('click', rsClick);
    rsLinea(root);
    if (!MOV) return rsAcabar();
    rsJugar();
  }
  function rsJugar() {
    const root = rsRoot(); if (!root) return;
    rsLimpiar(); Object.assign(RS, { fase: 'alin', g: 0, pausa: false, desc: false, kick: 0, hold: 0, ann: null, annAt: 0, flash: null, pen: null });
    const al = root.querySelector('[data-rs-alin]'), jg = root.querySelector('[data-rs-juego]');
    al.hidden = false; al.classList.remove('on', 'sale'); jg.hidden = true; jg.classList.remove('on');
    root.querySelector('[data-rs-acta]').innerHTML = '';
    rsPintar(); rsPie();
    rsLater(() => al.classList.add('on'), 30);
    rsLater(rsSaque, 3000 / RS.vel);
  }
  function rsSaque() {
    if (RS.fase !== 'alin') return; rsLimpiar(); RS.fase = 'saque';
    const root = rsRoot(); if (!root) return; root.querySelector('[data-rs-alin]').classList.add('sale'); rsPintar(); rsPie();
    rsLater(rsEmpezar, 480);
  }
  function rsEmpezar() {
    const root = rsRoot(); if (!root) return;
    RS.fase = 'play'; RS.kick = 0;
    root.querySelector('[data-rs-alin]').hidden = true;
    const jg = root.querySelector('[data-rs-juego]'); jg.hidden = false; void jg.offsetWidth;
    rsLater(() => jg.classList.add('on'), 30);
    rsPintar(); rsPie();
    rsLater(() => { RS.kick = 1; rsPintar(); rsLater(() => { RS.kick = 2; rsPintar(); RS.timer = setInterval(rsTick, 50); }, 1100 / RS.vel); }, 1300 / RS.vel);
  }
  function rsTick() {
    if (!rsRoot()) return rsLimpiar();
    const m = RS.m; if (RS.pausa || RS.fase !== 'play' || Date.now() < RS.hold) return;
    const g0 = RS.g; let g = g0 + m.tot / 10 * 0.05 * RS.vel;
    if (g0 < m.per && g >= m.per) {   // descanso: el reloj se para 0,9 s
      RS.g = m.per; RS.desc = true; RS.hold = Date.now() + 900 / RS.vel; rsPintar();
      rsLater(() => { RS.desc = false; rsPintar(); }, 900 / RS.vel); return;
    }
    const cruz = m.ev.filter(e => e.t > g0 && e.t <= g && rsAnunciable(m, e)), gol = cruz.find(e => e.tipo === 'gol');
    if (gol) { g = gol.t; RS.hold = Date.now() + 600 / RS.vel; rsAviso(gol); }   // gol: el reloj se para 0,6 s para que se lea
    else if (cruz.length) rsAviso(cruz[cruz.length - 1]);
    RS.g = Math.min(g, m.tot);
    if (RS.g >= m.tot) { clearInterval(RS.timer); RS.timer = null; rsPintar(); return m.pen ? rsLater(rsPenaltis, 300) : rsAcabar(); }
    rsPintar();
  }
  function rsAviso(e) { RS.ann = e; RS.annAt = Date.now(); if (e.tipo === 'gol') RS.flash = { l: e.lado, hasta: Date.now() + 900 }; }
  // la tanda: banda «SE DECIDE EN LOS PENALTIS» y, si el directo la trae, cada lanzamiento
  function rsPenaltis() {
    const m = RS.m; RS.fase = 'pen'; RS.pen = { banda: true, i: -1 }; RS.ann = null; rsPintar(); rsPie();
    const td = m.tanda;
    if (!td) { rsLater(() => { RS.pen.banda = false; rsPintar(); rsLater(rsAcabar, 1800); }, 1400); return; }
    td.forEach((x, i) => rsLater(() => { RS.pen = { banda: false, i }; rsPintar(); }, 1400 + i * 1100));
    rsLater(rsAcabar, 1400 + (td.length - 1) * 1100 + 1600);
  }
  function rsAcabar() {
    rsLimpiar(); const m = RS.m, root = rsRoot(); if (!root) return;
    Object.assign(RS, { fase: 'fin', g: m.tot, pausa: false, desc: false, kick: 2, ann: null, pen: null, flash: null });
    root.querySelector('[data-rs-alin]').hidden = true;
    const jg = root.querySelector('[data-rs-juego]'); jg.hidden = false; jg.classList.add('on');
    rsPintar(); rsPie();
    const acta = root.querySelector('[data-rs-acta]'); acta.innerHTML = rsActa(m); fondos(acta);
    if (MOV) { void acta.offsetWidth; rsLater(() => acta.classList.add('on'), 30); rsLater(() => acta.querySelectorAll('[data-cuenta]').forEach(el => contar(el, +el.dataset.cuenta, 650, el.dataset.fmt === 'pct' ? v => Math.round(v) + '%' : undefined)), 300); }
    else acta.classList.add('on');
  }

  // ── pintar el momento g ──
  function rsPintar() {
    const root = rsRoot(), m = RS.m; if (!root || !m) return;
    const g = RS.g, fin = RS.fase === 'fin', pen = RS.fase === 'pen', derbi = ours(m.local) && ours(m.visitante), usL = ours(m.local) || derbi;
    // reloj y parte
    const t = root.querySelector('[data-rs-t]'), pt = root.querySelector('[data-rs-parte]');
    let tt = rsRel(g), tc = '#F4F4F5', ptT, ptC = '#FF6B63', pulso = false;
    if (RS.fase === 'alin') { tt = '0:00'; tc = '#55555B'; ptT = 'ALINEACIONES'; ptC = '#A6A6AD'; }
    else if (RS.fase === 'saque') { tt = '0:00'; ptT = '1.ª PARTE'; ptC = '#A6A6AD'; }
    else if (fin) { tt = rsRel(m.tot); tc = '#8A8A8F'; ptT = 'FINAL'; ptC = '#F4F4F5'; }
    else if (pen) { tt = rsRel(m.tot); tc = '#8A8A8F'; ptT = 'PENALTIS'; ptC = '#FFB347'; }
    else if (RS.desc) { tt = m.per / 60 + ':00'; ptT = 'DESCANSO'; ptC = '#FFB347'; pulso = true; }
    else ptT = (g < m.per ? '1.ª' : '2.ª') + ' PARTE';
    if (RS.pausa && RS.fase === 'play') { ptT = 'EN PAUSA · ' + ptT; ptC = '#FFB347'; pulso = true; }
    if (RS.vivo && RS.fase === 'play' && !RS.desc && !RS.relojOk) { tt = RS.estOk && !RS.previa ? '≈ ' + rsMin(g) : ''; if (RS.previa) { ptT = 'ANTES DEL PARTIDO'; ptC = '#A6A6AD'; } }
    t.textContent = tt; t.hidden = !tt; t.style.color = tc; pt.textContent = ptT; pt.style.color = ptC; pt.classList.toggle('pulso', pulso);
    if (RS.fase === 'alin' || RS.fase === 'saque') return;
    // marcador: goles hasta g, rodillo, destello de quien marca y, al final, el ganador
    const gls = { L: 0, V: 0 }; m.ev.forEach(e => { if (e.tipo === 'gol' && e.t <= g) gls[e.lado]++; });
    const ganaL = m.gl > m.gv || (m.gl === m.gv && m.pen === 'L'), fl = RS.flash && Date.now() < RS.flash.hasta ? RS.flash.l : null;
    const nTir = l => m.tiros ? m.tiros.filter(x => x.lado === l && x.t <= g).length : null;
    ['L', 'V'].forEach(l => {
      const n = l === 'L' ? m.local : m.visitante, nos = ours(n) && !(derbi && l === 'V'), gana = l === 'L' ? ganaL : !ganaL;
      const f = root.querySelector(`[data-rs-fila="${l}"]`); if (!f) return;
      f.style.background = fl === l ? (nos ? 'rgba(211,32,42,.22)' : 'rgba(244,244,245,.10)') : '';
      f.classList.toggle('golea', fl === l); f.classList.toggle('pierde', fin && !gana);
      const rod = f.querySelector(`[data-rs-rod="${l}"]`); rod.classList.toggle('gana', fin && gana && nos);
      rod.firstElementChild.style.transform = `translateY(calc(var(--rh) * -${gls[l]}))`;
      f.querySelector(`[data-rs-bp="${l}"]`).textContent = fin && m.pen === l ? 'B' : '';
      const tn = f.querySelector(`[data-rs-tn="${l}"]`), tl = f.querySelector(`[data-rs-tir="${l}"]`);
      const nt = fin || RS.vivo ? (l === 'L' ? m.tl : m.tv) : nTir(l);
      tl.hidden = nt == null; if (nt != null) tn.textContent = nt;
      // cuadritos de la tanda
      const td = f.querySelector(`[data-rs-td="${l}"]`);
      if (m.tanda && (pen || fin)) { const hasta = fin ? m.tanda.length - 1 : RS.pen ? RS.pen.i : -1;
        td.innerHTML = m.tanda.map((x, i) => x.lado !== l ? '' : `<i class="${i > hasta ? '' : x.gol ? 'si' : 'no'}${i === hasta && pen ? ' pop' : ''}">${i > hasta ? '' : x.gol ? '✓' : '✕'}</i>`).join(''); tl.classList.add('corta'); }
      else { td.innerHTML = ''; tl.classList.remove('corta'); }
    });
    // porteros
    RS.POR.forEach(x => { const el = root.querySelector(`[data-rs-por="${x.l}"]`); if (el) rsPortero(el, x, g, fin || pen); });
    // aviso del momento
    const ann = root.querySelector('[data-rs-ann]'), h = rsAnnHtml(m, g, fin, pen, derbi, usL);
    if (ann.dataset.k !== h.k) { ann.dataset.k = h.k; ann.innerHTML = h.html; fondos(ann); if (MOV) { const c = ann.firstElementChild; if (c) { c.classList.add('entra'); void c.offsetWidth; requestAnimationFrame(() => c.classList.remove('entra')); } } }
    // línea de tiempo
    const lin = root.querySelector('[data-rs-linea]'); if (!lin || !lin.dataset.ok) return;
    const x = g / m.tot * 100;
    lin.querySelector('.rs-tapa').style.left = x + '%';
    const cab = lin.querySelector('.rs-cabezal'); cab.style.left = x + '%'; cab.hidden = fin || pen;
    lin.querySelectorAll('[data-t]').forEach(d => { const on = +d.dataset.t <= g + .01; if (on !== d.classList.contains('on')) d.classList.toggle('on', on); });
    lin.querySelectorAll('[data-sup]').forEach(d => { const a = +d.dataset.sup, b = +d.dataset.hasta, hasta = fin || pen ? b : Math.min(g, b);
      d.style.width = Math.max(0, hasta - a) / m.tot * 100 + '%'; d.style.opacity = !fin && !pen && g >= a && g < b ? 1 : .45; });
  }
  function rsPortero(el, x, g, alFinal) {
    const m = RS.m, n = x.l === 'L' ? m.local : m.visitante, derbi = ours(m.local) && ours(m.visitante), nos = ours(n) && !(derbi && x.l === 'V');
    const sg = alFinal ? x.segs[x.segs.length - 1] : x.segs.filter(s => s.from <= g).pop() || x.segs[0];
    if (!sg) { if (el.dataset.k !== 'nada') { el.dataset.k = 'nada'; el.className = 'rs-por'; el.innerHTML = `<span class="rs-pl">PORTERÍA · ${esc(largoEq(n, m.liga).toUpperCase())}</span><b class="rs-pn">Sin portero en el acta</b>`; } return; }
    const p = sg.p, multi = x.segs.length > 1, desde = multi && sg.from > 0 ? ' · desde el ' + rsMin(sg.from) : '';
    let sub, pct = '', w = 0;
    const st = (m.por[x.l] || []).find(q => (q.k || '#' + q.dorsal) === (p.k || '#' + p.dorsal));
    if ((alFinal || RS.vivo) && st && st.tiros) { sub = st.par + ' paradas de ' + st.tiros + desde; pct = dec((+st.pct).toFixed(1)) + '%'; w = st.pct; }
    else if (m.tiros) { const hasta = Math.min(g, sg.to - .01), tiros = m.tiros.filter(z => z.lado === x.o && z.t >= sg.from && z.t <= hasta).length,
        ga = m.ev.filter(e => e.tipo === 'gol' && e.lado === x.o && e.t >= sg.from && e.t <= hasta).length, par = Math.max(0, tiros - ga);
      sub = par + ' paradas de ' + tiros + desde; pct = tiros ? dec((par / tiros * 100).toFixed(1)) + '%' : '—'; w = tiros ? par / tiros * 100 : 0; }
    else { const ga = m.ev.filter(e => e.tipo === 'gol' && e.lado === x.o && e.t >= sg.from && e.t <= Math.min(g, sg.to - .01)).length; sub = 'Encaja ' + ga + desde; }
    const f = rsFoto(p, nos), cambia = sg.ev && RS.ann === sg.ev && Date.now() - RS.annAt < 1800 && !alFinal, k = (p.k || p.dorsal) + '|' + sub + '|' + pct + '|' + cambia;
    if (el.dataset.k === k) return;
    const nuevoP = el.dataset.p && el.dataset.p !== String(p.k || p.dorsal);
    el.dataset.k = k; el.dataset.p = p.k || p.dorsal;
    el.className = 'rs-por' + (nos ? ' mp' : '') + (cambia ? ' cambia' : '');
    el.innerHTML = `${f ? `<span class="rs-pf${nuevoP && MOV ? ' swap' : ''}" data-bg="${esc(f)}"></span>` : `<span class="rs-pi">${esc(ini(p.nombre, p.apellidos))}</span>`}
      <span class="rs-pl">PORTERÍA · ${esc(largoEq(n, m.liga).toUpperCase())}${cambia ? '<i>↻ CAMBIO</i>' : ''}</span>
      <b class="rs-pn">${esc(rsQ(p, nos))}</b><span class="rs-pp cifra">${pct}</span><span class="rs-ps">${esc(sub)}</span><span class="rs-pb"><i style="width:${w.toFixed(1)}%"></i></span>`;
    fondos(el);
  }
  // el panel de al lado del marcador: el aviso del momento, o la calma («SE JUEGA», descanso, superioridad, final)
  function rsAnnHtml(m, g, fin, pen, derbi, usL) {
    const lid = m.liga, nmT = n => largoEq(n, lid), Ln = etqEq(m.local, lid, true), Vn = etqEq(m.visitante, lid, true), nosLado = l => derbi ? l === 'L' : (l === 'L') === usL;
    const sanc = m.ev.filter(e => e.tipo === 'falta' && e.min >= 2 && e.t <= g), activa = fin || pen ? [] : sanc.filter(e => g < Math.min(m.tot, e.t + e.min * 60));
    const supTxt = e => derbi ? nmT(e.lado === 'L' ? m.local : m.visitante) + ' con uno menos' : nosLado(e.lado) ? 'Jugamos con uno menos' : 'Jugamos con uno más';
    const calma = (t, c, s, cls = '') => ({ k: 'c|' + t + '|' + s, html: `<div class="rs-calma ${cls}"><b style="color:${c}">${esc(t)}</b>${s ? `<span>${esc(s)}</span>` : ''}</div>` });
    const aviso = (tipo, bg, fg, quien, det, min, minC, foto) => ({ k: 'a|' + tipo + '|' + quien + '|' + min, html: `<div class="rs-aviso">${foto ? `<span class="rs-af" data-bg="${esc(foto)}"></span>` : ''}<div class="rs-at">
      <span class="rs-tag" style="background:${bg};color:${fg}"><span>${esc(tipo)}</span></span><b>${esc(quien)}</b><span>${esc(det)}</span></div><span class="rs-am cifra" style="color:${minC}">${esc(min)}</span></div>` });
    if (pen) {
      if (RS.pen && RS.pen.banda) return { k: 'pb', html: `<div class="rs-penb"><b>SE DECIDE EN LOS PENALTIS</b><span class="cifra">${m.gl}–${m.gv}</span></div>` };
      if (m.tanda && RS.pen && RS.pen.i >= 0) { const x = m.tanda[RS.pen.i], n = x.lado === 'L' ? m.local : m.visitante, hasta = m.tanda.slice(0, RS.pen.i + 1);
        const a = hasta.filter(y => y.lado === 'L' && y.gol).length, b = hasta.filter(y => y.lado === 'V' && y.gol).length;
        return { k: 'pt' + RS.pen.i, html: `<div class="rs-lanz"><div class="rs-at"><span class="rs-tag" style="background:#FFB347;color:#0D0D0E"><span>PENALTI · RONDA ${x.ronda}</span></span>
          <b class="${ours(n) ? 'mp' : ''}">${esc(rsQ(x.j, ours(n)))}</b><span>${esc(nmT(n))} · tanda ${a}–${b}</span></div><span class="rs-res ${x.gol ? 'si' : 'no'}">${x.gol ? 'GOL' : 'FALLA'}</span></div>` }; }
      return aviso('PENALTIS', '#FFB347', '#0D0D0E', 'Penaltis para ' + nmT(m.pen === 'L' ? m.local : m.visitante), m.gl + '–' + m.gv + ' al final del tiempo', '', '#FFB347');
    }
    if (fin) {
      const nos = usL ? m.gl : m.gv, ell = usL ? m.gv : m.gl, ganamos = derbi ? null : (usL ? m.gl > m.gv || (m.gl === m.gv && m.pen === 'L') : m.gv > m.gl || (m.gl === m.gv && m.pen === 'V'));
      let best = { d: 0 }, worst = { d: 0 };
      m.ev.filter(e => e.tipo === 'gol').forEach(e => { const dd = usL ? e.ml - e.mv : e.mv - e.ml, sc = usL ? e.ml + '–' + e.mv : e.mv + '–' + e.ml;
        if (dd > best.d) best = { d: dd, m: sc, min: Math.ceil(e.t / 60) }; if (dd < worst.d) worst = { d: dd, m: sc, min: Math.ceil(e.t / 60) }; });
      const tM = m.tanda ? ' (' + Math.max(...['L', 'V'].map(l => m.tanda.filter(x => x.lado === l && x.gol).length)) + '–' + Math.min(...['L', 'V'].map(l => m.tanda.filter(x => x.lado === l && x.gol).length)) + ')' : '';
      const ganador = m.gl > m.gv || (m.gl === m.gv && m.pen === 'L') ? m.local : m.visitante;
      const frase = derbi ? (m.pen ? m.gl + '–' + m.gv + ' al final del tiempo y la tanda' + tM + ' para ' + nmT(ganador) + '.' : nmT(ganador) + ' gana ' + Math.max(m.gl, m.gv) + '–' + Math.min(m.gl, m.gv) + '.')
        : nos === ell ? nos + '–' + ell + ' al final del tiempo y la tanda' + tM + ' para ' + (ganamos ? 'nosotros' : nmT(ganador)) + '.'
        : ganamos ? (worst.d <= -2 ? 'Remontada: perdíamos ' + worst.m + ' en el minuto ' + worst.min + ' y ganamos ' + nos + '–' + ell + '.' : 'Ganamos ' + nos + '–' + ell + '.')
        : (best.d >= 2 ? 'Llegamos a ir ' + best.m + ' en el minuto ' + best.min + ' y perdimos ' + nos + '–' + ell + '.' : 'Perdimos ' + nos + '–' + ell + '.');
      return derbi ? calma('GANA ' + etqEq(ganador, lid, true).toUpperCase(), '#FF6B63', frase) : calma(ganamos ? 'VICTORIA' : 'DERROTA', ganamos ? '#3DD27E' : '#C9C9CE', frase);
    }
    if (RS.fase === 'play' && RS.kick !== 2 && g === 0) return RS.kick === 1 ? calma('COMIENZA EL PARTIDO', '#FFFFFF', '1.ª parte · ' + m.per / 60 + ' minutos', 'pop') : { k: 'vacio', html: '' };
    if (RS.vivo && RS.previa) return calma('TODAVÍA NO HA EMPEZADO', '#C9C9CE', m.hora ? 'Empieza a las ' + m.hora : 'La FMP aún no ha fijado la hora');
    const e0 = RS.ann, vivo = e0 && (RS.pausa || Date.now() - RS.annAt < (RS.vivo ? 8000 : 2400));
    if (vivo) {
      const n = e0.lado === 'L' ? m.local : m.visitante, nos = ours(n) && !(derbi && e0.lado === 'V'), suyo = ours(n);
      if (e0.tipo === 'gol') return aviso('GOL', nos ? '#D3202A' : '#F4F4F5', nos ? '#FFFFFF' : '#0D0D0E', rsQ(e0.j, suyo), (e0.as ? 'Asistencia de ' + rsQ(e0.as, suyo) + ' · ' : '') + Ln + ' ' + e0.ml + '–' + e0.mv + ' ' + Vn, rsMin(e0.t), nos ? '#FF6B63' : '#F4F4F5', rsFoto(e0.j, suyo));
      if (e0.tipo === 'falta') return aviso('SANCIÓN', '#FFB347', '#0D0D0E', rsQ(e0.j, suyo), String(e0.min).replace('.', ',') + "' · " + (e0.falta || 'falta') + ' · ' + supTxt(e0), rsMin(e0.t), '#FFB347', rsFoto(e0.j, suyo));
      const sg = RS.POR.flatMap(x => x.segs).find(z => z.ev === e0) || {};
      return aviso('CAMBIO DE PORTERO', '#F4F4F5', '#0D0D0E', 'Entra ' + rsQ(sg.p || e0.j, suyo), (sg.sale ? 'Sale ' + rsQ(sg.sale, suyo) + ' · ' : '') + nmT(n), rsMin(e0.t), '#C9C9CE', rsFoto(sg.p || e0.j, suyo));
    }
    if (RS.desc) { const gl = m.ev.filter(e => e.tipo === 'gol' && e.t <= g), a = gl.filter(e => e.lado === 'L').length, b = gl.length - a, nos = usL ? a - b : b - a;
      return calma(derbi ? 'MITAD DEL DERBI' : nos > 0 ? 'MANDAMOS AL DESCANSO' : nos < 0 ? 'PERDEMOS AL DESCANSO' : 'IGUALADOS AL DESCANSO', '#FFB347', 'Quedan ' + m.per / 60 + ' minutos'); }
    if (activa.length) { const e = activa[activa.length - 1]; return calma(supTxt(e).toUpperCase(), '#FFB347', 'Hasta el minuto ' + Math.ceil(Math.min(m.tot, e.t + e.min * 60) / 60)); }
    return calma('SE JUEGA', '#C9C9CE', '', 'pulso');
  }

  // ── línea de tiempo: goles y cambios de portero arriba (hasta tres carriles), barra de quién va ganando, sanciones y tiros ──
  function rsLinea(root) {
    const m = RS.m, lin = root.querySelector('[data-rs-linea]'); if (!lin) return;
    const derbi = ours(m.local) && ours(m.visitante), usL = ours(m.local) || derbi, W = lin.clientWidth || 600, S = W >= 600 ? 12 : 10, pct = t => t / m.tot * 100;
    const marcas = m.ev.filter(e => e.tipo === 'gol' || (e.tipo === 'cambio' && RS.POR.some(x => x.segs.some(s => s.ev === e))));
    const fil = []; let nF = 1;
    marcas.forEach(e => { const px = pct(e.t) / 100 * W; let r = 0; while (r < 3 && fil[r] != null && px - fil[r] < S + 2) r++; if (r >= 3) r = 2; fil[r] = px; e._r = r; nF = Math.max(nF, r + 1); });
    const lane = nF * (S + 3), bar = lane + 10;
    lin.style.height = bar + 25 + 'px'; lin.style.setProperty('--S', S + 'px');
    // tramos de la barra: rojo si vamos ganando, blanco si empate, gris si gana el rival
    const tramos = []; let a = 0, b = 0, desde = 0;
    const col = () => { const d = usL ? a - b : b - a; return d > 0 ? '#D3202A' : d < 0 ? '#8A8A8F' : '#F4F4F5'; };
    m.ev.filter(e => e.tipo === 'gol').forEach(e => { tramos.push([desde, e.t, col()]); if (e.lado === 'L') a++; else b++; desde = e.t; });
    tramos.push([desde, m.tot, col()]);
    const txt = e => { const n = e.lado === 'L' ? m.local : m.visitante, suyo = ours(n);
      if (e.tipo === 'gol') return ['GOL · ' + rsMin(e.t), rsQ(e.j, suyo) + ' · ' + e.ml + '–' + e.mv, ours(n) && !(derbi && e.lado === 'V') ? 'gol' : ''];
      if (e.tipo === 'falta') return ['SANCIÓN · ' + rsMin(e.t), String(e.min).replace('.', ',') + "' a " + rsQ(e.j, suyo), 'sanc'];
      const sg = RS.POR.flatMap(x => x.segs).find(z => z.ev === e) || {}; return ['CAMBIO DE PORTERO · ' + rsMin(e.t), 'entra ' + rsQ(sg.p || e.j, suyo) + (sg.sale ? ', sale ' + rsQ(sg.sale, suyo) : ''), '']; };
    const punto = (e, cls, top) => { const [t1, t2, c] = txt(e); return `<button type="button" class="rs-d ${cls}" data-t="${e.t}" data-tip="${esc(t1)}" data-tip2="${esc(t2)}" data-tc="${c}" style="left:${pct(e.t)}%;top:${top}px" aria-label="${esc(t1 + ' · ' + t2)}"><i></i></button>`; };
    const sanc = m.ev.filter(e => e.tipo === 'falta' && e.min >= 2);
    lin.innerHTML = `<div class="rs-base" style="top:${bar}px">${tramos.map(([x0, x1, c]) => `<i style="left:${pct(x0)}%;width:${pct(x1 - x0)}%;background:${c}"></i>`).join('')}<span class="rs-tapa"></span><span class="rs-corte"></span></div>
      ${(m.tiros || []).map(x => `<span class="rs-ti ${(x.lado === 'L') === usL || derbi ? 'nos' : ''}" data-t="${x.t}" style="left:${pct(x.t)}%;top:${lane + 2}px"></span>`).join('')}
      ${sanc.map(e => `<span class="rs-sup" data-sup="${e.t}" data-hasta="${Math.min(m.tot, e.t + e.min * 60)}" style="left:${pct(e.t)}%;top:${bar + 9}px" title="${esc((derbi ? largoEq(e.lado === 'L' ? m.local : m.visitante, m.liga) + ' con uno menos' : ((e.lado === 'L') === usL ? 'Jugamos con uno menos' : 'Jugamos con uno más')) + ' · min ' + rsMin(e.t).replace("'", '') + '–' + Math.ceil(Math.min(m.tot, e.t + e.min * 60) / 60))}"></span>`).join('')}
      ${sanc.map(e => punto(e, 'sanc', bar + 15)).join('')}
      ${marcas.map(e => punto(e, e.tipo === 'gol' ? 'gol ' + (ours(e.lado === 'L' ? m.local : m.visitante) && !(derbi && e.lado === 'V') ? 'mp' : '') : 'cambio', lane - (e._r + 1) * (S + 3) + 3)).join('')}
      <span class="rs-cabezal" style="top:${bar - 3}px"></span><div class="rs-tip" hidden></div>`;
    lin.dataset.ok = '1';
  }
  function rsTip(d, mostrar) {
    const lin = d.closest('[data-rs-linea]'), tip = lin && lin.querySelector('.rs-tip'); if (!tip) return;
    if (!mostrar) { tip.hidden = true; return; }
    tip.innerHTML = `<b class="${d.dataset.tc}">${esc(d.dataset.tip)}</b><span>${esc(d.dataset.tip2)}</span>`; tip.hidden = false;
    const x = parseFloat(d.style.left), W = lin.clientWidth, px = x / 100 * W;
    tip.style.left = Math.max(0, Math.min(W - 200, px - 100)) + 'px'; tip.style.top = (parseFloat(d.style.top) - 6) + 'px';
  }
  document.addEventListener('mouseover', e => { const d = e.target.closest && e.target.closest('.rs-d'); if (d && matchMedia('(hover: hover)').matches) rsTip(d, true); });
  document.addEventListener('mouseout', e => { const d = e.target.closest && e.target.closest('.rs-d'); if (d && matchMedia('(hover: hover)').matches) rsTip(d, false); });

  // ── botones: empezar ya, pausa, velocidad, saltar al final, repetir; y los puntos de la línea ──
  function rsPie() {
    const root = rsRoot(), el = root && root.querySelector('[data-rs-pie]'), m = RS.m; if (!el) return;
    const jugando = RS.fase === 'play' || RS.fase === 'pen';
    if (RS.vivo) { el.innerHTML = RS.fase === 'fin' ? `<span>Final · acta de la FMP</span><div class="rs-bots"><a class="rs-bt" href="#/directo/${encodeURIComponent(RS.idp)}/resumen">↺ Repetir</a></div>`
      : `<span>${RS.previa && m.hora ? 'Empieza a las ' + esc(m.hora) + ' · ' : 'En directo · '}el acta de la FMP se actualiza cada 15 s</span><div class="rs-bots">${tgHtml}</div>`; return; }
    el.innerHTML = RS.fase === 'fin' ? `<span>Resumen hecho con el acta de la FMP</span><div class="rs-bots"><button type="button" class="rs-bt" data-rs-b="otra">↺ Repetir</button></div>`
      : `<span>Del acta de la FMP · ${m.tot / 60} minutos en unos 10 s</span><div class="rs-bots">${RS.fase === 'alin' ? '<button type="button" class="rs-bt p" data-rs-b="ya">Empezar ya</button>' : ''}
        ${jugando ? `<button type="button" class="rs-bt ic${RS.pausa ? ' p' : ''}" data-rs-b="pausa" aria-label="${RS.pausa ? 'Seguir' : 'Pausa'}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${RS.pausa ? 'M4 2.5 13.5 8 4 13.5Z' : 'M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z'}"/></svg></button>
          <button type="button" class="rs-bt vel${RS.vel === 2 ? ' on' : ''}" data-rs-b="vel" aria-label="Velocidad">×${RS.vel}</button>` : ''}
        <button type="button" class="rs-bt" data-rs-b="fin">Saltar al final</button></div>`;
  }
  function rsClick(e) {
    const b = e.target.closest('[data-rs-b]'), d = e.target.closest('.rs-d');
    if (b) { const k = b.dataset.rsB;
      if (k === 'ya') rsSaque();
      else if (k === 'pausa') { RS.pausa = !RS.pausa; if (!RS.pausa && RS.ann) RS.annAt = Date.now() - Math.min(1200, Date.now() - RS.annAt); rsPintar(); rsPie(); }
      else if (k === 'vel') { RS.vel = RS.vel === 1 ? 2 : 1; rsPie(); }
      else if (k === 'fin') rsAcabar();
      else if (k === 'otra') { RS.vel = 1; rsJugar(); }
      return; }
    if (d) {   // un punto de la línea: en el juego, salta a ese momento (en pausa, con su aviso); en el móvil, además, qué pasó
      if (RS.fase === 'play' && !RS.vivo) { const t = +d.dataset.t, ev = RS.m.ev.find(x => x.t === t && rsAnunciable(RS.m, x)); RS.g = t; RS.pausa = true; RS.desc = false; RS.hold = 0; if (ev) { RS.ann = ev; RS.annAt = Date.now(); } rsPintar(); rsPie(); }
      if (RS.vivo || !matchMedia('(hover: hover)').matches) { const tip = d.closest('[data-rs-linea]').querySelector('.rs-tip'); rsTip(d, tip.hidden); }
    }
  }
  // al salir del directo o del resumen se para todo (entre los dos, cada página para lo suyo al pintarse)
  window.addEventListener('hashchange', () => { if (!/^#\/directo\//.test(location.hash)) { rsLimpiar(); clearInterval(RS.tTiros); RS.vivo = false; } });

  // ── el acta: momentos clave, goles a dos lados, el mejor, en números, tanda y porteros ──
  function rsActa(m) {
    const derbi = ours(m.local) && ours(m.visitante), A0 = ours(m.local) || derbi ? 'L' : 'V', B0 = A0 === 'L' ? 'V' : 'L', lid = m.liga;
    const nmS = l => l === 'L' ? m.local : m.visitante, nmT = l => largoEq(nmS(l), lid), nos = l => ours(nmS(l)) && !(derbi && l === 'V'), mpC = l => nos(l) ? '#FF6B63' : '#F4F4F5';
    const sc = e => A0 === 'L' ? e.ml + '–' + e.mv : e.mv + '–' + e.ml, golesA = m.ev.filter(e => e.tipo === 'gol');
    // momentos
    let lead = { d: 0 }, run = { n: 0 }, cur = { l: null, n: 0 }, decisivo = null, prev = 0;
    golesA.forEach(e => { const dd = A0 === 'L' ? e.ml - e.mv : e.mv - e.ml; if (Math.abs(dd) > Math.abs(lead.d)) lead = { d: dd, e };
      if (cur.l === e.lado) cur.n++; else cur = { l: e.lado, n: 1, from: e }; if (cur.n > run.n) run = { n: cur.n, l: e.lado, from: cur.from, to: e };
      const sg = Math.sign(dd); if (sg !== prev && sg !== 0) decisivo = e; if (sg === 0) decisivo = null; prev = sg; });
    const mom = [], g0 = golesA[0];
    if (g0) mom.push(['PRIMER GOL', rsMin(g0.t), mpC(g0.lado), rsQ(g0.j, ours(nmS(g0.lado))) + ' · ' + nmT(g0.lado), nos(g0.lado)]);
    if (lead.e) { const l = lead.d > 0 ? A0 : B0; mom.push(['MAYOR VENTAJA', '+' + Math.abs(lead.d), mpC(l), nmT(l) + ' ' + sc(lead.e) + ' en el ' + rsMin(lead.e.t), nos(l)]); }
    if (run.n >= 2) mom.push(['MEJOR RACHA', run.n + ' seguidos', mpC(run.l), nmT(run.l) + ', del ' + rsMin(run.from.t) + ' al ' + rsMin(run.to.t), nos(run.l)]);
    if (m.pen) mom.push(['SE DECIDE EN', 'PENALTIS', '#FFB347', 'Gana ' + nmT(m.pen) + ' tras el ' + m.gl + '–' + m.gv, 'am']);
    else if (decisivo) mom.push(['GOL DECISIVO', rsMin(decisivo.t), mpC(decisivo.lado), rsQ(decisivo.j, ours(nmS(decisivo.lado))) + ' · ' + sc(decisivo), nos(decisivo.lado)]);
    const momH = mom.length ? `<div class="rs-mom">${mom.slice(0, 4).map(([k, v, vc, s, n], i) => `<div class="rs-mc${n === 'am' ? ' am' : n ? ' mp' : ''}" style="--d:${i * 70}ms"><span class="etq">${k}</span><b class="cifra" style="color:${vc}">${esc(v)}</b><span>${esc(s)}</span></div>`).join('')}</div>` : '';
    // espina de goles: los nuestros a la izquierda
    let kk = 0;
    const gol = e => `<div class="rs-eg ${e.lado === A0 ? 'a' : 'b'}${nos(e.lado) ? ' mp' : ''}" style="--d:${200 + (kk++) * 60}ms"><div class="rs-eq"><b>${esc(rsQ(e.j, ours(nmS(e.lado))))}</b>${e.as ? `<span>Asist. ${esc(rsQ(e.as, ours(nmS(e.lado))))}</span>` : ''}<em>${esc(nmT(e.lado).toUpperCase())}</em></div>
      <div class="rs-em"><span class="cifra">${rsMin(e.t)}</span><b class="cifra">${sc(e)}</b></div></div>`;
    const sep = (t, v, cls) => `<div class="rs-es ${cls}"><span>${t}${v ? ` <b class="cifra">${v}</b>` : ''}</span></div>`;
    const g1 = golesA.filter(e => e.t < m.per), g2 = golesA.filter(e => e.t >= m.per), fA = A0 === 'L' ? m.gl : m.gv, fB = A0 === 'L' ? m.gv : m.gl;
    const espina = `<div class="rs-esp" style="--d:120ms"><div class="rs-esp-cab"><b style="color:${mpC(A0)}">${esc(nmT(A0))}</b><span class="etq">GOLES</span><b style="color:${mpC(B0)}">${esc(nmT(B0))}</b></div>
      ${golesA.length ? g1.map(gol).join('') + sep('DESCANSO', g1.length ? sc(g1[g1.length - 1]) : '0–0', 'desc') + g2.map(gol).join('') + sep('FINAL', fA + '–' + fB, 'fin') : '<div class="pv-nota">Sin goles</div>'}
      ${m.pen ? sep('PENALTIS PARA ' + nmT(m.pen).toUpperCase(), '', 'pen') : ''}</div>`;
    // el mejor del partido
    const mv = m.mvp, mvN = mv && ours(mv.equipo), mvF = mv && mvN ? fotoDe(mv.nombre, mv.apellidos) : null;
    const mejor = mv ? `<div class="rs-mvp${mvN ? ' mp' : ''}${mvF ? ' con-f' : ''}" style="--d:220ms">${mvF ? `<span class="rs-mvf" data-bg="${esc(mvF)}"></span>` : ''}<div><span class="etq">EL MEJOR DEL PARTIDO</span>
      <b>${esc(rsQ(mv, mvN))}</b><span>${esc(largoEq(mv.equipo, lid) + (mvN ? '' : ' · rival'))}</span>${mv.motivo ? `<span class="rs-tag blanco"><span>${esc(mv.motivo)}</span></span>` : ''}</div></div>` : '';
    // en números
    const tir = l => (l === 'L' ? m.tl : m.tv) || 0, gl = l => l === 'L' ? m.gl : m.gv;
    const parP = l => { const ps = m.por[l] || [], t = ps.reduce((s, p) => s + (p.tiros || 0), 0); return t ? ps.reduce((s, p) => s + (p.par || 0), 0) / t * 100 : null; };
    const g12 = (l, dos) => golesA.filter(e => e.lado === l && (e.t >= m.per) === dos).length, fal = l => m.ev.filter(e => e.tipo === 'falta' && e.lado === l).reduce((s, e) => s + (e.min || 0), 0);
    const filas = [['Goles', gl(A0), gl(B0), 1, ''], ['Tiros a puerta', tir(A0), tir(B0), 1, ''], tir(A0) && tir(B0) ? ['Acierto', gl(A0) / tir(A0) * 100, gl(B0) / tir(B0) * 100, 1, '%'] : null,
      parP(A0) != null && parP(B0) != null ? ['Paradas', parP(A0), parP(B0), 1, '%'] : null, ['Goles en la 1.ª parte', g12(A0, false), g12(B0, false), 1, ''], ['Goles en la 2.ª parte', g12(A0, true), g12(B0, true), 1, ''], ['Minutos de sanción', fal(A0), fal(B0), -1, '']].filter(Boolean);
    const num = `<div class="rs-num" style="--d:320ms"><span class="etq">EN NÚMEROS</span>${filas.map(([k, a, b, dir, suf], i) => { const mx = Math.max(a, b, .0001), wa = suf ? a >= b : dir > 0 ? a > b : a < b, wb = suf ? b >= a : dir > 0 ? b > a : b < a;
      const fmt = v => suf ? Math.round(v) + '%' : dec(String(Math.round(v * 10) / 10));
      const barra = (l, w, gana) => `<i style="width:${(suf ? w : w / mx * 100).toFixed(1)}%;background:${nos(l) ? (gana ? '#D3202A' : '#6B2A2E') : (gana ? '#C9C9CE' : '#55555B')};--d:${400 + i * 60}ms"></i>`;
      return `<div class="rs-nf"><b class="cifra${wa ? ' gana' : ''}"${!suf && Number.isInteger(a) ? ` data-cuenta="${a}"` : ''}>${fmt(a)}</b><div><span>${k}</span><div class="rs-nb"><span class="a">${barra(A0, a, wa)}</span><span>${barra(B0, b, wb)}</span></div></div><b class="cifra${wb ? ' gana' : ''}"${!suf && Number.isInteger(b) ? ` data-cuenta="${b}"` : ''}>${fmt(b)}</b></div>`; }).join('')}</div>`;
    // tanda (si el directo la trae)
    let tanda = '';
    if (m.tanda) { const rs2 = [...new Set(m.tanda.map(x => x.ronda))].sort((a, b) => a - b), tl = m.tanda.filter(x => x.lado === 'L' && x.gol).length, tv = m.tanda.filter(x => x.lado === 'V' && x.gol).length;
      const marca = x => x ? `<span class="rs-tm ${x.gol ? 'si' : 'no'}">${x.gol ? '✓' : '✕'}</span>` : '<span class="rs-tm"></span>';
      tanda = `<div class="rs-tnd" style="--d:320ms"><span class="etq">TANDA DE PENALTIS</span><div class="rs-tnd-cab"><b style="color:${mpC('L')}">${esc(etqEq(m.local, lid, true))}</b><b class="cifra">${tl}–${tv}</b><b style="color:${mpC('V')}">${esc(etqEq(m.visitante, lid, true))}</b></div>
        ${rs2.map(r => { const a = m.tanda.find(x => x.ronda === r && x.lado === 'L'), b = m.tanda.find(x => x.ronda === r && x.lado === 'V');
          return `<div class="rs-tr"><span>${a ? esc(rsQ(a.j, ours(m.local))) : ''}</span>${marca(a)}<i>R${r}</i>${marca(b)}<span>${b ? esc(rsQ(b.j, ours(m.visitante))) : ''}</span></div>`; }).join('')}
        <div class="rs-tg${nos(m.pen) ? ' mp' : ''}">GANA LA TANDA ${esc(nmT(m.pen).toUpperCase())}</div></div>`; }
    // porteros en anillo
    const pors = [A0, B0].flatMap(l => (m.por[l] || []).filter(p => p.tiros).map(p => ({ p, l })));
    const porH = pors.length ? `<div class="rs-anillos" style="--d:420ms">${pors.map(({ p, l }) => { const x = RS.POR.find(z => z.l === l), sg = x && x.segs.find(z => (z.p.k || '#' + z.p.dorsal) === (p.k || '#' + p.dorsal)), multi = x && x.segs.length > 1;
      const rango = multi && sg ? ' · del ' + rsMin(sg.from) + ' al ' + Math.min(m.tot / 60, Math.ceil((sg.to - 1) / 60)) + "'" : '';
      return `<div class="rs-an${nos(l) ? ' mp' : ''}"><span class="rs-ring" style="--p:${(+p.pct).toFixed(1)}"><b class="cifra">${Math.round(p.pct)}%</b></span><div><b>${esc(rsQ(p, ours(nmS(l))))}</b><span>${esc(nmT(l))}</span><span>${p.par} de ${p.tiros}${rango}</span></div></div>`; }).join('')}</div>` : '';
    return `${momH}<div class="rs-acta-g">${espina}<div class="rs-acta-d">${mejor}${num}${tanda}${porH}</div></div>`;
  }


  /* ── El directo (rediseño final, #/directo/{idp}): la misma página que «Así fue el partido», con los datos del servicio del
     directo (cada 15 s). Antes de empezar, las alineaciones (si ya está abierta el acta); en juego, reloj, marcador de rodillo,
     aviso de cada gol, sanción o cambio de portero (8 s), porteros con sus paradas del acta, línea de tiempo con los tiros del
     vigía; en los penaltis, cada lanzamiento; al acabar, el acta. Sin reacciones ni votación; el canal de Telegram, abajo. ── */
  function vVivo(idp) {
    rsLimpiar(); clearInterval(RS.tTiros); RS.vivo = true;
    const espera = '<div class="carga" role="status" aria-label="Cargando"><div class="sk" style="height:48px;width:50%;margin-top:24px"></div><div class="sk" style="height:420px"></div></div>';
    const h = location.hash, otra = () => { if (location.hash === h) render(); };
    const sn = LIVE.snaps[idp] || RS.snap[idp];
    if (!sn) {
      if (!RS.pidio[idp]) { RS.pidio[idp] = true; fetch(DIRECTO_URL + (DIRECTO_URL.includes('?') ? '&' : '?') + 'idp=' + encodeURIComponent(idp), { cache: 'no-store' }).then(r => r.json())
        .then(d => { const x = (d.partidos || [d]).find(y => y.idp === idp); if (x) RS.snap[idp] = x; }).catch(() => {}).then(otra); return espera; }
      return `<div class="rs-vacio">${casoHtml('En directo', 'Este partido no está en directo', 'El directo sale cuando la FMP abre el acta del partido. Mientras, la previa y el calendario.', 'DIRECTO', 'derbi', [['Ir a Inicio', '#/'], ['Calendario', '#/calendario']])}</div>`;
    }
    // terminado y ya en los datos de la noche: el acta de app.json (con el mejor del partido); si no, la del directo
    const p = sn.estado === 'final' && Object.values(A.partidos).find(x => x.idp === idp && x.gl != null);
    const m = p ? rsModelo(p) : rsModeloSnap(sn);
    m.tanda = rsTanda(m, sn);
    RS.m = m; RS.POR = rsPorteria(m); RS.idp = idp; RS.sn = sn;
    RS.visto = m.ev.filter(e => rsAnunciable(m, e)).length;   // lo que ya había al abrir no se anuncia
    rsVivoEstado(sn);
    rsLater(rsVivoArrancar, 0);
    return rsHtml(m);
  }
  // en qué momento está: alineaciones (antes de empezar), juego, penaltis o final; y el segundo de partido
  function rsVivoEstado(sn) {
    const m = RS.m, conAlin = (m.alin.L.length + m.alin.V.length) > 0;
    RS.previa = sn.estado === 'previa';
    RS.fase = sn.estado === 'final' ? 'fin' : sn.fase === 'penaltis' ? 'pen' : RS.previa && conAlin ? 'alin' : 'play';
    RS.desc = sn.estado === 'descanso'; RS.kick = 2; RS.pausa = false;
    const r = relojDe(sn), ult = m.ev.length ? m.ev[m.ev.length - 1].t : 0, est = segEst(sn);
    RS.relojOk = !!r && sn.estado === 'directo'; RS.estOk = !RS.relojOk && est != null;
    RS.g = RS.fase === 'fin' || RS.fase === 'pen' ? m.tot : RS.desc ? m.per : RS.previa ? 0 : Math.min(m.tot, Math.max(ult, RS.estOk ? est : 0, ((sn.periodo || 1) - 1) * m.per + (RS.relojOk ? segs(r) || 0 : 0)));
    if (RS.fase === 'pen') { const td = m.tanda || []; RS.pen = { banda: !td.length, i: td.length - 1 }; } else RS.pen = null;
  }
  function rsVivoArrancar() {
    const root = rsRoot(); if (!root || !RS.m || root.dataset.rsOn) return;
    root.dataset.rsOn = '1'; root.addEventListener('click', rsClick);
    rsLinea(root);
    const al = root.querySelector('[data-rs-alin]'), jg = root.querySelector('[data-rs-juego]');
    if (RS.fase === 'alin') { al.hidden = false; jg.hidden = true; requestAnimationFrame(() => al.classList.add('on')); }
    else { al.hidden = true; jg.hidden = false; requestAnimationFrame(() => jg.classList.add('on')); }
    if (RS.fase === 'fin') return rsAcabar();
    rsPintar(); rsPie();
    rsVivoTiros(); RS.tTiros = setInterval(rsVivoTiros, 60000);
  }
  // los tiros minuto a minuto los graba el vigía en el servicio: se piden al abrir y cada minuto
  function rsVivoTiros() {
    const idp = RS.idp; if (!RS.vivo || !idp || !rsRoot()) return clearInterval(RS.tTiros);
    apiGet('tiros?idp=' + encodeURIComponent(idp)).then(d => { if (!d || !d.s || !d.s.length || RS.idp !== idp || !RS.vivo) return; TIR_VIVO[idp] = d;
      const t = []; let a0 = 0, b0 = 0; d.s.forEach(([s, a, b]) => { for (let i = a0; i < a; i++) t.push({ t: s, lado: 'L' }); for (let i = b0; i < b; i++) t.push({ t: s, lado: 'V' }); a0 = Math.max(a0, a); b0 = Math.max(b0, b); });
      if (RS.m.tiros && RS.m.tiros.length === t.length) return; RS.m.tiros = t; const root = rsRoot(); if (root) { rsLinea(root); rsPintar(); } }).catch(() => {});
  }
  // llega un dato nuevo del directo: se rehace el modelo, se anuncia lo último nuevo y se repinta
  function rsVivoActualizar(idp) {
    const root = rsRoot(); if (!root || !RS.vivo || RS.idp !== idp) return;
    const sn = LIVE.snaps[idp]; if (!sn || sn === RS.sn) return;
    const antes = RS.m, faseAntes = RS.fase, alinAntes = antes.alin.L.length + antes.alin.V.length;
    const m = rsModeloSnap(sn); m.tiros = antes.tiros; m.tanda = rsTanda(m, sn);
    if (m.alin.L.length + m.alin.V.length !== alinAntes) { RS.snap[idp] = sn; return render(); }   // se ha abierto el acta: la página entera
    RS.m = m; RS.POR = rsPorteria(m); RS.sn = sn;
    const anun = m.ev.filter(e => rsAnunciable(m, e));
    if (anun.length > RS.visto) { const e = anun[anun.length - 1]; RS.ann = e; RS.annAt = Date.now(); if (e.tipo === 'gol') RS.flash = { l: e.lado, hasta: Date.now() + 1500 }; }
    RS.visto = anun.length;
    rsVivoEstado(sn);
    const al = root.querySelector('[data-rs-alin]'), jg = root.querySelector('[data-rs-juego]');
    if (faseAntes === 'alin' && RS.fase !== 'alin') { al.classList.add('sale'); setTimeout(() => { al.hidden = true; jg.hidden = false; requestAnimationFrame(() => jg.classList.add('on')); }, MOV ? 480 : 0); }
    if (RS.fase === 'fin') { clearInterval(RS.tTiros); return rsAcabar(); }
    rsLinea(root); rsPintar(); rsPie();
  }

  function vDirecto(idp, modo) {
    if (ESC.abierta && ESC.abierta.tipo === 'resumen') ESC.abierta.cerrar();
    cargarHitos();
    DV.idp = idp; DV.gen++;
    if (modo === 'resumen') { const espera = prepararResumen(idp); if (espera) { DV.vacio = true; return espera; } } else { pararResumen(); RSM.saltado = false; }
    const sn = snapDV();
    if (!sn) { DV.vacio = true; return `<div class="dv-espera" data-dv="espera">${esperaHtml()}</div>`; }
    DV.vacio = false;
    const ctx = ctxDirecto(sn), [f1, f2] = rellenoDirecto(sn), ch = chipDirecto(sn);
    // se pinta quieto: lo que ya hay no se anima
    Object.assign(DV, { mostrado: { gl: sn.gl || 0, gv: sn.gv || 0 }, visto: fuenteNuevos().length, aparece: {}, pendientes: 0, cola: MPDirecto.colaGoles(mostrarGol),
      penVistos: new Set(), situClave: '', tiros: {}, listo: false, colaFin: 0, ganVisto: !!(sn.penaltis && sn.penaltis.ganador), tanda: new Set(((sn.penaltis && sn.penaltis.tanda) || []).map(x => x.lado + x.ronda)) });
    contarTiros(ctx, []);
    excluidos(ctx).L.concat(excluidos(ctx).V).forEach(p => DV.penVistos.add(p.id));
    { const si = situacionPista(ctx, excluidos(ctx)); DV.situClave = si ? si.label + si.n : ''; }
    setTimeout(() => { DV.listo = true; const c2 = ctxDirecto(snapDV() || sn); pintarSituacion(c2); pistaSiToca(c2.sn, modo === 'resumen' && RSM.activo && RSM.fase === 'pista'); presentarSiToca(c2); }, 0);
    DV.claves = new Set(itemsFeed(ctx).map(([, id]) => id));
    const eqHtml = l => { const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent';
      return `<div class="dv-eq"><div class="dv-esc" data-dv="esc${l}" style="box-shadow:0 0 0 2px ${ctx.mp[l] ? RED : '#FFFFFF'};background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}"></div><span class="dv-abr">${esc(ctx.abr[l])}</span><div class="dv-pens" data-dv="pen${l}"></div></div>`; };
    const resumenHtml = barraResumen();
    if (modo === 'resumen') RSM.saltado = false;
    const verRes = modo === 'resumen' ? '<button type="button" class="dv-alin" data-ver-resumen>▶ Resumen final</button>'
      : sn.estado === 'final' ? `<a class="dv-alin" href="#/directo/${encodeURIComponent(idp)}/resumen">▶ Ver resumen</a>` : '';
    cargarReac(idp, true);
    setTimeout(() => pintarVotoDirecto(idp, modo === 'resumen' || sn.estado === 'final'), 0);
    const arriba = verRes + alinBtn(sn) + pistaChip(sn) + `<button type="button" class="dv-alin" data-wa="${esc(idp)}" title="Manda el marcador y el enlace del directo por WhatsApp">WhatsApp</button>`
      + (ctx.mp.L || ctx.mp.V ? `<a class="dv-alin" href="${TELEGRAM}" target="_blank" rel="noopener" title="Avisos de cada gol en el móvil">Avisos en Telegram</a>` : '');
    return `${arriba ? `<div class="dv-arriba">${arriba}</div>` : ''}${resumenHtml}<div class="dv">
      <div class="dv-izq">
        <div class="dv-caja" data-dv="caja">
          <div class="dv-cab"><div class="dv-cabtx"><div class="dv-liga">${esc(((sn.liga || '') + (sn.jornada ? ' · J' + sn.jornada : '')).toUpperCase())}</div>${sn.pista ? `<div class="dv-sede">${esc(pistaBonita(sn.pista))}</div>` : ''}</div><div class="dv-chip${ch.vivo ? ' vivo' : ''}" data-dv="chip">${chipHtml(ch)}</div></div>
          <div class="dv-marcador">${eqHtml('L')}<div class="dv-num">${rodilloD(DV.mostrado.gl, 'L')}<span class="dv-guion">–</span>${rodilloD(DV.mostrado.gv, 'V')}</div>${eqHtml('V')}</div>
          <div class="dv-situ-caja" data-dv="situ"></div>
          ${ctx.dur ? `<div class="dv-linea"><div class="dv-tramos"><div><i data-dv="f1" style="width:${f1}%"></i></div><div><i data-dv="f2" style="width:${f2}%"></i></div></div><div data-dv="marcas">${marcasLinea(ctx)}</div></div>
          <div class="dv-partes"><span>1ª PARTE</span><span>2ª PARTE</span></div>` : '<div style="height:clamp(14px,2.4vw,22px)"></div>'}
          <div data-dv="tanda">${tandaHtml(ctx)}</div>
          <div data-dv="final">${finalHtml(ctx, false)}</div>
        </div>
        <div class="dv-porteros" data-dv="porteros">${porterosHtml(ctx)}</div>
        <div class="dv-lista"><div class="dv-lcab"><span>MINUTO A MINUTO <a class="dv-como" href="#/metodo/directo">¿qué significa cada aviso?</a></span><span data-dv="lcab">${cabLista(sn).replace(/^<span[^>]*>|<\/span>$/g, '')}</span></div>
          <div class="dv-filas" data-dv="filas">${filasHtml(ctx)}</div></div>
      </div>
      <div class="dv-der" data-dv="der">${juegoHtml(ctx)}<div data-dv="reac" data-reac-caja="${esc(idp)}">${reacHtml(idp)}</div><div data-voto-directo="${esc(idp)}"></div><div data-dv="ficha">${fichaHtml(ctx)}</div><div style="display:flex;flex-direction:column;gap:8px" data-dv="hoy">${hoyHtml()}</div></div>
    </div>`;
  }
  function pintarMarcador() {
    ['L', 'V'].forEach(l => { const el = $(`[data-dv="rod${l}"] > div`), n = l === 'L' ? DV.mostrado.gl : DV.mostrado.gv;
      if (!el) return;
      if (el.children.length <= n) el.innerHTML = Array.from({ length: n + 6 }, (_, i) => `<span>${i}</span>`).join('');
      el.style.transform = `translateY(-${n}em)`; });
    pintarHoy(); pintarFinal();
  }
  function sincronizarMarcador() {   // por si el portal corrige un gol: sin cortinas pendientes, el marcador es el del portal
    const sn = snapDV();
    if (!sn || DV.pendientes || (DV.mostrado.gl === (sn.gl || 0) && DV.mostrado.gv === (sn.gv || 0))) return;
    DV.mostrado = { gl: sn.gl || 0, gv: sn.gv || 0 }; pintarMarcador();
  }
  /* ── Gol (rediseño, fase 6): una banda cruza el centro de la pantalla en 1,6 s (roja si es nuestro, gris si es del rival)
     con «GOL», quién marca y el marcador; no tapa el marcador de arriba y se toca para saltarla. Con reducir movimiento,
     la banda se queda quieta 2 s. */
  const DUR_GOL = { mp: MOV ? 1600 : 2000, riv: MOV ? 1600 : 2000 }, DUR_FALTA = 5000, DUR_CORTA = 2200;
  const T_TIRO = 2300, T_GANA = 3200;   // 10d: cada lanzamiento (tarjeta y, a los 1,3 s, el sello) y la tarjeta del ganador
  const durAnuncio = (ctx, e) => (e.tipo === 'GOL' ? (ctx.mp[e.lado] ? DUR_GOL.mp : DUR_GOL.riv) : e.tipo === 'FALTA' ? DUR_FALTA
    : e.tipo === 'TANDA' ? e.nuevos.length * T_TIRO + (e.ganador ? T_GANA : 500) : e.tipo === 'CAMBIO DE PORTERO' ? 3600 : DUR_CORTA);
  const anunciable = e => e.tipo === 'GOL' || e.tipo === 'FALTA' || (e.tipo === 'CAMBIO DE PORTERO' && e.jugador && !e.ambiguo);
  const iniDe = n => (n || '').replace(/\./g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  function escenaGolHtml(ctx, e) {
    const l = e.lado, quien = quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador), marc = e.marcador ? ctx.abr.L + ' ' + e.marcador.replace('-', '–') + ' ' + ctx.abr.V : '';
    return `<div class="gol-banda${ctx.mp[l] ? ' mp' : ''}${MOV ? '' : ' quieta'}" role="status" aria-label="Gol de ${esc(ctx.abr[l])}"><div class="gb"><b>GOL</b><span><strong>${esc(quien)}</strong><em>${esc(marc || ctx.abr[l])}</em></span></div></div>`;
  }

  /* ── 10f · Falta a pantalla completa ────────────────────────────────────────────────────────────────────────────
     Foto del sancionado en blanco y negro (la única escena en B/N) y caen 6 barrotes con rebote y 2 travesaños; rival sin
     foto: su escudo entre rejas. «EXPULSIÓN · equipo», cuenta atrás grande (la sanción, corriendo deprisa) con barra naranja,
     nombre y «Motivo (COD)». Sin candado. */
  function escenaFaltaHtml(ctx, e) {
    const l = e.lado, estr = innerWidth < 640 || innerWidth / Math.max(1, innerHeight) < .8 ? ' estr' : '';
    let dentro;
    if (ctx.mp[l]) { const p = jugadorDe(ctx, l, e.id_player, e.dorsal); dentro = p && p.foto ? `<div class="f" style="background-image:url('${esc(p.foto)}')"></div>` : `<div class="i">${esc(p ? ini(p.nombre, p.apellidos) : iniDe(e.jugador_corto || e.jugador))}</div>`; }
    else { const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent'; dentro = `<div class="e" style="background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}"></div>`; }
    const sub = [motivoFalta(e), ordinal(e.periodo) + (e.t ? ' · ' + e.t : '')].filter(Boolean).join(' · ');
    return `<div class="esc-falta${estr}" role="status" aria-label="Expulsión de ${esc(ctx.abr[l])}">
      <div class="ef-foto"><div class="ef-caja">${dentro}<div class="velo"></div>
        <div class="ef-rejas">${[0, 1, 2, 3, 4, 5].map(k => `<i style="animation-delay:${(0.45 + k * 0.07).toFixed(2)}s"></i>`).join('')}</div>
        <div class="ef-trav a"></div><div class="ef-trav b"></div><div class="d">${esc(e.dorsal || '')}</div></div></div>
      <div class="ef-tx"><div class="ef-pill">EXPULSIÓN · ${esc(ctx.abr[l])}</div><div class="ef-reloj">${mmssD((e.min_sancion || 2) * 60)}</div><div class="ef-barra"><i></i></div>
        <div class="ef-quien">${esc(quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador))}</div><div class="ef-sub">${esc(sub)}</div></div>
    </div>`;
  }

  /* ── 10d · Penaltis a pantalla completa ─────────────────────────────────────────────────────────────────────────
     Rodillo de la tanda entre los escudos, la tarjeta de cada lanzador (foto a color si es nuestro; escudo si es rival) con
     «LANZA · RONDA n», el sello GOL / FALLA, las casillas de cada equipo y, al acabar, quién gana la tanda. El acta da los
     dos tiros de cada ronda a la vez: van por rondas, el local primero. */
  function escenaPenaltis(ctx, e, alFin) {
    const { sn } = ctx, tiros = e.tiros, estr = innerWidth < 640 || innerWidth / Math.max(1, innerHeight) < .8;
    const rondas = Math.max(3, tiros.reduce((m, x) => Math.max(m, x.ronda || 0), 0));
    const escP = l => { const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent'; return `background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}`; };
    const resueltos = new Set(tiros.slice(0, e.desde).map(x => x.lado + x.ronda));
    const goles = l => tiros.filter(x => x.lado === l && x.gol && resueltos.has(x.lado + x.ronda)).length;
    const el = document.createElement('div');
    el.className = 'escena esc-pen' + (estr ? ' estr' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Tanda de penaltis');
    const rod = l => `<div class="pn-rod"><div data-rod="${l}" style="transform:translateY(-${goles(l)}em)">${Array.from({ length: 16 }, (_, d) => `<div>${d}</div>`).join('')}</div></div>`;
    el.innerHTML = `<div class="esc-top"><div class="l">${sn._resumen ? 'RESUMEN' : '● EN DIRECTO'} · PENALTIS</div><div class="r">${sn.pista ? `<div class="pista"><i></i><span>PISTA</span><b>${esc(pistaBonita(sn.pista))}</b></div>` : ''}<button type="button" class="esc-saltar" data-esc-cierra>Saltar ›</button></div></div>
      <div class="pn"><div class="pn-k">TANDA DE PENALTIS</div>
        <div class="pn-marc"><i style="box-shadow:0 0 0 2px ${ctx.mp.L ? RED : '#FFFFFF'};${escP('L')}"></i><div class="pn-num">${rod('L')}<span>–</span>${rod('V')}</div><i style="box-shadow:0 0 0 2px ${ctx.mp.V ? RED : '#FFFFFF'};${escP('V')}"></i></div>
        <div class="pn-stage"></div><div class="pn-filas" style="--n:${rondas}"></div></div>`;
    document.body.appendChild(el);
    const stage = el.querySelector('.pn-stage'), filas = el.querySelector('.pn-filas'), timers = [], luego = (ms, f) => timers.push(setTimeout(f, ms));
    // casillas: gol (rojo si es nuestro, blanco si es del rival), fallo «×», el que tira ahora con el aro que late
    const pintaFilas = (cur, recien) => { filas.innerHTML = ['L', 'V'].map(l => `<div class="pn-fila"><span>${esc(ctx.abr[l])}</span>${Array.from({ length: rondas }, (_, r) => {
      const x = tiros.find(t => t.lado === l && t.ronda === r + 1), k = x && x.lado + x.ronda, hecho = k && resueltos.has(k);
      const bg = hecho ? (x.gol ? (ctx.mp[l] ? RED : '#F4F4F5') : '#3A3A3F') : '', ink = hecho && x.gol && !ctx.mp[l] ? '#0D0D0E' : '';
      return `<i class="${k && k === cur ? 'cur' : hecho && k === recien ? 'res' : ''}" style="${bg ? `background:${bg};` : ''}${ink ? `color:${ink}` : ''}">${hecho && !x.gol ? '×' : ''}</i>`; }).join('')}</div>`).join(''); };
    pintaFilas(null, null);
    e.nuevos.forEach((x, q) => {
      const t0 = q * T_TIRO, k = x.lado + x.ronda, mp = ctx.mp[x.lado];
      luego(t0, () => {
        let card;
        if (mp) { const p = jugadorDe(ctx, x.lado, x.id_player, x.dorsal); card = `<div class="pn-card mp">${p && p.foto ? `<div class="f" style="background-image:url('${esc(p.foto)}')"></div>` : `<div class="i">${esc(p ? ini(p.nombre, p.apellidos) : iniDe(x.jugador_corto || x.jugador))}</div>`}`; }
        else card = `<div class="pn-card riv"><div class="e" style="${escP(x.lado)}"></div>`;
        stage.innerHTML = card + `<div class="pie"><small>LANZA · RONDA ${x.ronda}</small><b>${esc(quienD(ctx, x.lado, x.dorsal, x.jugador_corto, x.jugador))}</b></div></div>`;
        pintaFilas(k, null);
      });
      luego(t0 + 1300, () => {   // el sello y el rodillo
        resueltos.add(k);
        const bg = x.gol ? (mp ? RED : '#F4F4F5') : '#3A3A3F', ink = x.gol && !mp ? '#0D0D0E' : '#FFFFFF';
        stage.insertAdjacentHTML('beforeend', `<div class="pn-sello"><b style="background:${bg};color:${ink}">${x.gol ? 'GOL' : 'FALLA'}</b></div>`);
        const r = el.querySelector(`[data-rod="${x.lado}"]`); if (r) r.style.transform = `translateY(-${goles(x.lado)}em)`;
        pintaFilas(null, k);
      });
    });
    let t = e.nuevos.length * T_TIRO;
    if (e.ganador) {   // quién gana la tanda: verde si somos nosotros
      luego(t, () => { stage.innerHTML = `<div class="pn-gana" style="background:${ctx.mp[e.ganador] ? '#1E8A4C' : '#3A3A3F'}"><i style="${escP(e.ganador)}"></i><b>${esc(ctx.abr[e.ganador])} GANA LA TANDA</b></div>`; });
      t += T_GANA;
    } else t += 500;
    let cerrada = false;
    const cerrar = () => { if (cerrada) return; cerrada = true; timers.forEach(clearTimeout); el.classList.add('cierra'); setTimeout(() => el.remove(), 300); alFin(); };
    el.querySelector('[data-esc-cierra]').addEventListener('click', cerrar);
    luego(t, cerrar);
  }

  /* ── 10e · Resumen final a pantalla completa ────────────────────────────────────────────────────────────────────
     Resultado (V/E/D, «… EN LOS PENALTIS»), marcador y penaltis, pista; goles con foto del goleador y del asistente (a color;
     rival con su escudo), porteros con sus paradas y la tanda. Se desplaza dentro de la escena; «Cerrar» o Esc la quitan. */
  function escenaResumen(ctx) {
    const { sn } = ctx;
    if (!sn || sn.estado !== 'final' || ESC.abierta || ESC.cargando) return false;
    const r = resultadoMP(ctx, sn), pen = sn.penaltis;
    const escR = l => { const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent'; return `background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}`; };
    const fotoB = (p, nombre) => (p && p.foto ? `style="background-image:url('${esc(p.foto)}')">` : `>${esc(p ? ini(p.nombre, p.apellidos) : iniDe(nombre))}`);
    const logros = [];   // hitos del partido (hat trick, primer gol…), también juntos bajo el marcador
    const goles = sn.eventos.filter(e => e.tipo === 'GOL').map((e, q) => {
      const l = e.lado, mp = ctx.mp[l], hayA = !!(e.asist_dorsal || e.asist_jugador), h = hitosGol(e, sn.eventos, sn);
      h.tags.forEach(t => logros.push({ t, quien: quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador).replace(/^#\d+\s+/, ''), mp }));
      let ph;
      if (mp) { const s1 = jugadorDe(ctx, l, e.id_player, e.dorsal), a1 = hayA ? jugadorDe(ctx, l, e.assist_id_player, e.asist_dorsal) : null;
        ph = `${hayA ? `<div class="a" ${fotoB(a1, e.asist_corto || e.asist_jugador)}</div>` : ''}<div class="s" ${fotoB(s1, e.jugador_corto || e.jugador)}</div>`; }
      else ph = `<div class="e" style="${escR(l)}"></div>`;
      const sub = [hayA ? 'Asist. ' + quienD(ctx, l, e.asist_dorsal, e.asist_corto, e.asist_jugador) + (h.asist ? ' (' + h.asist + ')' : '') : 'Sin asistencia', situacionGol(e, sn.eventos, ctx.dur)].filter(Boolean).join(' · ');
      return `<div class="er-gol${mp ? ' mp' : ''}" style="animation-delay:${(0.7 + q * 0.12).toFixed(2)}s"><span class="t">${esc(ordinal(e.periodo) + ' ' + (e.t || ''))}</span><div class="erf">${ph}</div>
        <div class="q"><b>${esc(quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador))}${h.tags.map(x => `<span class="dv-hito">${esc(x)}</span>`).join('')}${botonVer(sn.idp, e)}</b><span>${esc(sub)}</span></div><span class="m">${esc((e.marcador || '').replace('-', '–'))}</span></div>`;
    }).join('');
    const pors = (sn.porteros || []).filter(p => p.tiros).map((p, q) => {
      const mp = ctx.mp[p.lado], pj = mp ? jugadorDe(ctx, p.lado, p.id_player, p.dorsal) : null, pc = pctP(p);
      return `<div class="er-por" style="animation-delay:${(0.8 + q * 0.1).toFixed(1)}s"><div class="erf" ${fotoB(pj, p.jugador_corto || p.jugador)}</div>
        <div class="d"><small>PORTERO · ${esc(ctx.abr[p.lado])}</small><b>${esc(quienD(ctx, p.lado, p.dorsal, p.jugador_corto, p.jugador))}</b>
          <div class="n"><strong>${pc == null ? '—' : dec(pc) + '%'}</strong><span>${(p.tiros || 0) - (p.gc || 0)}/${p.tiros || 0} PARADAS</span></div>
          <div class="bar"><i style="width:${pc || 0}%;background:${mp ? RED : '#F4F4F5'}"></i></div></div></div>`;
    }).join('');
    let penHtml = '';
    if (pen && (pen.tanda || []).length) {
      const n = Math.max(3, pen.tanda.reduce((m, x) => Math.max(m, x.ronda || 0), 0));
      penHtml = `<div class="er-pen"><div class="er-t" style="padding:0;border:0">PENALTIS · ${pen.gl}–${pen.gv}${pen.ganador ? ' · GANA ' + esc(ctx.abr[pen.ganador]) : ''}</div>${['L', 'V'].map(l => `<div class="fila" style="--n:${n}"><span>${esc(ctx.abr[l])}</span>${Array.from({ length: n }, (_, k) => {
        const x = pen.tanda.find(t => t.lado === l && t.ronda === k + 1);
        return `<i style="${x ? `background:${x.gol ? (ctx.mp[l] ? RED : '#F4F4F5') : '#3A3A3F'};${x.gol && !ctx.mp[l] ? 'color:#0D0D0E' : ''}` : ''}">${x && !x.gol ? '×' : ''}</i>`; }).join('')}</div>`).join('')}</div>`;
    }
    const el = document.createElement('div');
    el.className = 'escena esc-res'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Resumen del partido');
    el.style.background = `radial-gradient(ellipse at 50% -10%, ${r[2]} 0%, #0D0D0E 55%)`;
    el.innerHTML = `<div class="esc-top"><div class="l">RESUMEN · ${esc(fechaLarga(sn))}</div><div class="r"><button type="button" data-res="repetir">↺ Ver otra vez</button><button type="button" data-esc-cierra>Cerrar ✕</button></div></div>
      <div class="er"><div class="er-cab"><div class="k">FINAL · ${esc(((sn.liga || '') + (sn.jornada ? ' · J' + sn.jornada : '')).toUpperCase())}</div>
        <div class="er-pill"><i style="background:${r[1]}"></i><span>${esc(r[0])}</span></div>
        <div class="er-marc"><div class="er-eq l"><i style="box-shadow:0 0 0 2px ${ctx.mp.L ? RED : '#FFFFFF'};${escR('L')}"></i><span>${esc(ctx.abr.L)}</span></div>
          <div class="er-num"><b>${sn.gl ?? 0}<em>–</em>${sn.gv ?? 0}</b>${pen ? `<small>PENALTIS ${pen.gl}–${pen.gv}</small>` : ''}</div>
          <div class="er-eq v"><i style="box-shadow:0 0 0 2px ${ctx.mp.V ? RED : '#FFFFFF'};${escR('V')}"></i><span>${esc(ctx.abr.V)}</span></div></div>
        ${sn.pista ? `<div class="er-pista"><i></i>${esc(pistaBonita(sn.pista))}</div>` : ''}
        ${logros.length ? `<div class="er-logros"><span class="k">HITOS DEL PARTIDO</span>${Object.values(logros.filter(x => x.mp).concat(logros.filter(x => !x.mp)).reduce((g, x) => { const k = (x.mp ? 'n' : 'r') + x.t;
          (g[k] = g[k] || { t: x.t, mp: x.mp, quien: [] }).quien.includes(x.quien) || g[k].quien.push(x.quien); return g; }, {}))
          .map(x => `<span class="lg${x.mp ? ' mp' : ''}"><b>${esc(x.t)}</b> ${esc(x.quien.join(', '))}</span>`).join('')}</div>` : ''}</div>
      <div class="er-cols"><div class="er-goles"><div class="er-t">GOLES</div>${goles || '<div class="er-gol"><span class="t"></span><div></div><div class="q"><span>Sin goles</span></div></div>'}</div>
        ${pors || penHtml ? `<div class="er-der">${pors}${penHtml}</div>` : ''}</div></div>`;
    document.body.appendChild(el);
    document.documentElement.style.overflow = 'hidden';
    let cerrada = false;
    const cerrar = () => {
      if (cerrada) return; cerrada = true;
      document.removeEventListener('keydown', tecla);
      el.classList.add('cierra'); setTimeout(() => el.remove(), MOV ? 400 : 0);
      document.documentElement.style.overflow = ''; ESC.abierta = null;
      document.dispatchEvent(new CustomEvent('mp-escena-fin', { detail: 'resumen' }));
    };
    const tecla = e => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    el.querySelector('[data-esc-cierra]').addEventListener('click', cerrar);
    el.querySelector('[data-res="repetir"]').addEventListener('click', cerrar);
    ESC.abierta = { tipo: 'resumen', cerrar };
    return true;
  }
  // al terminar la simulación (sin anuncios pendientes), una vez por pasada
  function quizasResumen(ya) {   // ya: con «Saltar al final» (o sin animaciones), sin esperar
    if (!RSM.activo || RSM.idp !== DV.idp || RSM.fase !== 'fin' || DV.pendientes || RSM.resumenVisto) return;
    RSM.resumenVisto = true;
    const idp = RSM.idp, gen = DV.gen;
    setTimeout(() => { if (DV.idp === idp && DV.gen === gen && RSM.activo) escenaResumen(ctxDirecto(Object.assign({}, RSM.final, { _resumen: true }))); }, ya || !MOV ? 0 : 1800);
  }
  // si se cambia de página con una escena abierta, se cierra
  window.addEventListener('hashchange', () => { if (ESC.abierta) ESC.abierta.cerrar(); if (location.hash.indexOf('#/video/') !== 0) pararTV(); });
  document.addEventListener('click', e => { if (!e.target.closest('[data-ver-resumen]')) return; const S = RSM.final || LIVE.snaps[DV.idp]; if (S) escenaResumen(ctxDirecto(Object.assign({}, S, { _resumen: true }))); });

  /* ── Cambio de portero a pantalla completa ─────────────────────────────────────────────────────────────────────
     «CAMBIO DE PORTERO · equipo»: la tarjeta del que sale se apaga y entra la del nuevo (fotos a color si son nuestros;
     del rival, su escudo). Si la hora se dedujo de los goles encajados, lo dice («momento aproximado»). */
  function escenaCambioHtml(ctx, e) {
    const l = e.lado, estr = innerWidth < 640 || innerWidth / Math.max(1, innerHeight) < .8 ? ' estr' : '';
    const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent';
    const tarjeta = (cls, rotulo, id, dorsal, corto, largo) => {
      let dentro;
      if (ctx.mp[l]) { const p = jugadorDe(ctx, l, id, dorsal); dentro = p && p.foto ? `<div class="f" style="background-image:url('${esc(p.foto)}')"></div>` : `<div class="i">${esc(p ? ini(p.nombre, p.apellidos) : iniDe(corto || largo))}</div>`; }
      else dentro = `<div class="e" style="background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}"></div>`;
      const ring = cls === 'entra' && ctx.mp[l] ? 'box-shadow:0 0 0 3px #D3202A, 0 20px 50px rgba(0,0,0,.5)' : '';
      return `<div class="ec-card ${cls}" style="${ring}">${dentro}<div class="pie"><small>${rotulo}</small><b>${esc(quienD(ctx, l, dorsal, corto, largo))}</b></div></div>`;
    };
    const sub = [ordinal(e.periodo) + (e.t ? ' · ' + e.t : ''), e.aprox ? 'momento aproximado' : ''].filter(Boolean).join(' · ');
    return `<div class="esc-cambio${estr}" role="status" aria-label="Cambio de portero de ${esc(ctx.abr[l])}"><div class="ec-k">CAMBIO DE PORTERO · ${esc(ctx.abr[l])}</div>
      <div class="ec-fila">${tarjeta('sale', 'SALE', e.sale_id_player, e.sale_dorsal, e.sale_corto, e.sale)}<div class="ec-flecha">›</div>${tarjeta('entra', 'ENTRA', e.id_player, e.dorsal, e.jugador_corto, e.jugador)}</div>
      <div class="ec-sub">${esc(sub)}</div></div>`;
  }

  // cola de goles: una cortina cada vez (2,8 s); al salir, el rodillo sube un número (con «reducir movimiento», directo)
  function mostrarGol(e, ms) {
    const gen = DV.gen;
    return new Promise(res => {
      const fin = () => { if (gen === DV.gen) { const m = /^(\d+)-(\d+)$/.exec(e.marcador || ''); if (m) DV.mostrado = { gl: +m[1], gv: +m[2] }; pintarMarcador();
        DV.pendientes = Math.max(0, DV.pendientes - 1); DV.finCortina = Date.now();
        if (!DV.pendientes) {   // sin anuncios pendientes: entra lo que esperaba (la franja final, quién gana la tanda…)
          const s2 = snapDV(); if (s2 && $('[data-dv="caja"]')) { pintarFinal(); pintarListas(ctxDirecto(s2)); }
          setTimeout(sincronizarMarcador, 1300); quizasResumen();
        } } res(); };
      const caja = $('[data-dv="caja"]'), sn = snapDV();
      if ((!ms && (MOV || e.tipo !== 'GOL')) || !caja || !sn || gen !== DV.gen) return fin();
      const ctx = ctxDirecto(sn), dur = durAnuncio(ctx, e), tmp = document.createElement('div');
      if (e.tipo === 'TANDA') {   // 10d: la tanda a pantalla completa (espera a que acabe la pista o la presentación)
        const mostrar = () => (gen !== DV.gen ? fin() : escenaPenaltis(ctx, e, fin));
        if (ESC.abierta || ESC.cargando) document.addEventListener('mp-escena-fin', mostrar, { once: true }); else mostrar();
        return;
      }
      if (e.tipo === 'GOL' || e.tipo === 'FALTA' || e.tipo === 'CAMBIO DE PORTERO') {   // gol en banda; 10f / cambio: a pantalla completa; se puede tocar para cerrarla antes
        const mostrar = () => {
          if (gen !== DV.gen) return fin();
          tmp.innerHTML = e.tipo === 'GOL' ? escenaGolHtml(ctx, e) : e.tipo === 'FALTA' ? escenaFaltaHtml(ctx, e) : escenaCambioHtml(ctx, e);
          const el = tmp.firstElementChild; document.body.appendChild(el);
          if (e.tipo === 'GOL') {   // la banda nunca tapa el marcador: si caería encima, va justo debajo (o encima)
            const m = $('[data-dv="rodL"]'), r = m && (m.closest('.dv-marcador') || m.parentElement).getBoundingClientRect(), h = el.offsetHeight, y = innerHeight / 2 - h / 2;
            if (r && r.bottom > 0 && r.top < innerHeight && y < r.bottom + 12 && y + h > r.top - 12) {
              const abajo = r.bottom + 24, arriba = r.top - 24 - h;
              el.style.top = (abajo + h < innerHeight - 70 ? abajo : arriba > 70 ? arriba : y) + 'px'; el.style.marginTop = '0'; }
            // reducir movimiento: el marcador cambia ya y el aviso «GOL» se queda quieto 2 s (sin hacer esperar al siguiente)
            if (!MOV) { document.querySelectorAll('.gol-banda').forEach(x => { if (x !== el) x.remove(); }); el.addEventListener('click', () => el.remove()); setTimeout(() => el.remove(), 2000); return fin(); }
          }
          let hecho = false, tic = null;
          if (e.tipo === 'FALTA') {   // la sanción corre deprisa (×4) desde el segundo 1,6, para que se vea el reloj bajar
            const total = (e.min_sancion || 2) * 60, t0 = Date.now(), r = el.querySelector('.ef-reloj'), b = el.querySelector('.ef-barra i');
            tic = setInterval(() => { const rem = Math.max(0, total - Math.max(0, Date.now() - t0 - 1600) / 1000 * 4); r.textContent = mmssD(rem); b.style.width = (rem / total * 100).toFixed(1) + '%'; }, 100);
            setTimeout(() => el.classList.add('sale'), dur - 350);
          }
          if (e.tipo === 'CAMBIO DE PORTERO') setTimeout(() => el.classList.add('sale-ya'), dur - 350);
          const acaba = () => { if (hecho) return; hecho = true; clearInterval(tic); el.remove(); fin(); };
          el.addEventListener('click', acaba); setTimeout(acaba, dur);
        };
        if (ESC.abierta || ESC.cargando) document.addEventListener('mp-escena-fin', mostrar, { once: true }); else mostrar();
        return;
      }
      fin();
    });
  }
  function actualizarDirecto() {
    const sn = snapDV();
    if (!sn || !$('[data-dv="caja"]')) return;
    const ctx = ctxDirecto(sn), ahora = Date.now();
    const fuente = fuenteNuevos(), nuevos = fuente.slice(DV.visto).filter(x => x.idp === DV.idp).map(x => x.ev);
    DV.visto = fuente.length;
    // goles y faltas se anuncian (cortina) y su fila entra al acabar; la tanda, ronda a ronda
    const turno = dur => { const ini0 = Math.max(ahora, DV.colaFin || 0), fin = ini0 + dur; DV.colaFin = fin + 1200; return fin; };
    nuevos.forEach(e => { const anuncia = anunciable(e);
      DV.aparece[e.id] = anuncia && MOV ? turno(durAnuncio(ctx, e)) : ahora; if (anuncia) { DV.pendientes++; DV.cola(e); } });
    const tanda = (sn.penaltis && sn.penaltis.tanda) || [], nuevosT = tanda.filter(x => !DV.tanda.has(x.lado + x.ronda)), gan = sn.penaltis && sn.penaltis.ganador;
    if (nuevosT.length || (gan && !DV.ganVisto)) {
      nuevosT.forEach(x => DV.tanda.add(x.lado + x.ronda)); DV.ganVisto = !!gan;
      const item = { tipo: 'TANDA', id: 'tanda-' + tanda.length, tiros: tanda, desde: nuevosT.length ? tanda.indexOf(nuevosT[0]) : tanda.length, nuevos: nuevosT, ganador: gan || null };
      const fin = MOV ? turno(durAnuncio(ctx, item)) : ahora;
      nuevosT.forEach(x => { DV.aparece['tanda-' + x.lado + x.ronda] = fin; });
      DV.pendientes++; DV.cola(item);
    }
    itemsFeed(ctx).forEach(([k, id]) => { if (k === 'div' && !DV.claves.has(id)) { DV.claves.add(id); DV.aparece['div-' + id] = MOV && DV.pendientes ? DV.colaFin - 1200 : ahora; } });
    contarTiros(ctx, nuevos.filter(e => e.tipo === 'GOL'));
    pintarSituacion(ctx); pintarJuego(ctx); pintarHoy(); pintarFinal(); pintarFicha(ctx); presentarSiToca(ctx);
    const ch = chipDirecto(sn), chip = $('[data-dv="chip"]');
    if (chip) { chip.classList.toggle('vivo', ch.vivo); chip.innerHTML = chipHtml(ch); }
    const [f1, f2] = rellenoDirecto(sn), e1 = $('[data-dv="f1"]'), e2 = $('[data-dv="f2"]');
    if (e1) e1.style.width = f1 + '%';
    if (e2) e2.style.width = f2 + '%';
    pintarListas(ctx);
    const lc = $('[data-dv="lcab"]');
    if (lc) { const h = cabLista(sn); lc.className = /off/.test(h) ? 'off' : ''; lc.textContent = h.replace(/<[^>]+>/g, ''); }
    if (!DV.pendientes) sincronizarMarcador();
    const br = $('.dv-resumen');
    if (br && RSM.fase === 'fin') { const sb = br.querySelector('[data-res="saltar"]'); if (sb) sb.remove(); }
  }
  document.addEventListener('mp-directo', () => {
    const m = /^#\/directo\/([^/]+)/.exec(location.hash);
    if (!m) return;
    const idp = decodeURIComponent(m[1]);
    if (/\/resumen/.test(location.hash)) return;   // el resumen no cambia con el directo
    if (RS.vivo && RS.idp === idp) rsVivoActualizar(idp); else if (LIVE.snaps[idp] && !rsRoot()) render();
  });
  /* ── 9a · Barra «En directo» sobre el menú ──────────────────────────────────────────────────
     En toda la web mientras haya un partido nuestro en juego (o en el descanso): marcador de rodillo, parte · reloj y el
     siguiente partido del día. Con un gol, la franja roja (gris si es del rival) la cruza y al salir sube el marcador. */
  const BAR = { mostrado: {}, visto: 0, pendientes: {}, cola: null, clave: '' };
  const horaDe = sn => sn.hora || '99:99';
  const estadoCorto = sn => (sn.estado === 'descanso' ? 'DESCANSO' : sn.fase === 'penaltis' ? 'PENALTIS' : relojDe(sn) ? ordinal(sn.periodo || 1) + ' · ' + relojDe(sn) : ordinal(sn.periodo || 1) + ' PARTE');
  const rodBarra = (idp, l, n) => `<div class="bd-rod" data-bd="${esc(idp)}-${l}"><div style="transform:translateY(-${n}em)">${Array.from({ length: Math.max(16, n + 1) }, (_, i) => `<span>${i}</span>`).join('')}</div></div>`;
  function escBarra(ctx, l) {
    const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent';
    return `<div class="bd-esc" style="box-shadow:0 0 0 1.5px ${ctx.mp[l] ? RED : '#FFFFFF'};background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}"></div>`;
  }
  function pintarRodBarra(idp) {
    const m = BAR.mostrado[idp];
    if (!m) return;
    [['L', m.gl], ['V', m.gv]].forEach(([l, n]) => { const el = document.querySelector(`[data-bd="${CSS.escape(idp)}-${l}"] > div`); if (el) el.style.transform = `translateY(-${n}em)`; });
  }
  function mostrarGolBarra(x, ms) {
    const { idp, e } = x;
    return new Promise(res => {
      const fin = () => { const m = /^(\d+)-(\d+)$/.exec(e.marcador || ''); if (m) BAR.mostrado[idp] = { gl: +m[1], gv: +m[2] }; pintarRodBarra(idp);
        if (e.tipo === 'GOL') BAR.pendientes[idp] = Math.max(0, (BAR.pendientes[idp] || 0) - 1); res(); };
      const barra = $('#barra-directo'), sn = LIVE.snaps[idp];
      if (!ms || !barra || barra.hidden || !sn) return fin();
      const ctx = ctxDirecto(sn), d = document.createElement('div');
      const falta = e.tipo === 'FALTA';
      d.className = 'bd-gol' + (falta ? ' falta' : ctx.mp[e.lado] ? ' mp' : '');
      d.innerHTML = `<b>${falta ? 'EXPULSIÓN ' + esc(fmin(e.min_sancion || 2)) : 'GOL'}</b><strong>${esc(ctx.abr[e.lado])}</strong><span>${esc(quienD(ctx, e.lado, e.dorsal, e.jugador_corto, e.jugador))}</span>`;
      barra.appendChild(d);
      setTimeout(() => { d.remove(); fin(); }, falta ? Math.min(ms, 2200) : ms);
    });
  }
  function barraDirecto() {
    const barra = $('#barra-directo'), sc = $('#bd-scroll');
    if (!barra || !A || !window.MPDirecto) return;
    if (!BAR.cola) BAR.cola = MPDirecto.colaGoles(mostrarGolBarra);
    const snaps = Object.values(LIVE.snaps).sort((a, b) => horaDe(a).localeCompare(horaDe(b)));
    const vivos = snaps.filter(sn => sn.estado === 'directo' || sn.estado === 'descanso');
    // goles nuevos a la cola (solo de partidos que ya se estaban viendo; lo de antes se pinta quieto)
    LIVE.nuevos.slice(BAR.visto).forEach(({ idp, ev }) => {
      if ((ev.tipo !== 'GOL' && ev.tipo !== 'FALTA') || !BAR.mostrado[idp]) return;
      if (ev.tipo === 'GOL') BAR.pendientes[idp] = (BAR.pendientes[idp] || 0) + 1;
      BAR.cola({ idp, e: ev });
    });
    BAR.visto = LIVE.nuevos.length;
    snaps.forEach(sn => { if (!BAR.mostrado[sn.idp] || (!BAR.pendientes[sn.idp] && (BAR.mostrado[sn.idp].gl !== (sn.gl || 0) || BAR.mostrado[sn.idp].gv !== (sn.gv || 0))))
      BAR.mostrado[sn.idp] = { gl: sn.gl || 0, gv: sn.gv || 0 }; });
    if (!vivos.length) { barra.hidden = true; BAR.clave = ''; return; }
    const sig = snaps.find(sn => sn.estado === 'previa');
    const clave = vivos.map(sn => sn.idp).join(',') + '|' + (sig ? sig.idp : '');
    if (clave !== BAR.clave) {   // cambia qué se juega: se vuelve a montar (sin animar)
      BAR.clave = clave;
      sc.innerHTML = '<span class="bd-tag"><i></i>EN DIRECTO</span>' + vivos.map(sn => { const ctx = ctxDirecto(sn), m = BAR.mostrado[sn.idp];
        return `<a class="blk bd-partido" href="#/directo/${encodeURIComponent(sn.idp)}">${escBarra(ctx, 'L')}<span class="bd-abr">${esc(ctx.abr.L)}</span>
          <div class="bd-num">${rodBarra(sn.idp, 'L', m.gl)}<span class="bd-guion">–</span>${rodBarra(sn.idp, 'V', m.gv)}</div>
          <span class="bd-abr">${esc(ctx.abr.V)}</span>${escBarra(ctx, 'V')}<span class="bd-st" data-bdst="${esc(sn.idp)}">${esc(estadoCorto(sn))}</span></a>`; }).join('<span class="bd-sep"></span>')
        + (sig ? (() => { const c = ctxDirecto(sig); return `<span class="bd-sep"></span><span class="bd-despues">DESPUÉS · <b>${esc(c.abr.L)} vs ${esc(c.abr.V)}</b>${sig.hora ? ' · ' + esc(sig.hora) : ''}</span>`; })() : '');
    } else {
      vivos.forEach(sn => { pintarRodBarra(sn.idp); const st = document.querySelector(`[data-bdst="${CSS.escape(sn.idp)}"]`); if (st) st.textContent = estadoCorto(sn); });
    }
    barra.hidden = false;
  }
  document.addEventListener('mp-directo', barraDirecto);
  document.addEventListener('mp-directo', () => {
    if (!A || !(esInicio(location.hash) || /^#\/(inicio|jornada)\//.test(location.hash)) || view.querySelector('.carga')) return;
    const F = findeInicio(), vivos = F.lista.filter(m => m.st === 'vivo');
    if (vivos.map(m => m.sn.idp).join(',') !== [...view.querySelectorAll('[data-vivo-card]')].map(e => e.dataset.vivoCard).join(',')) { render(); return; }
    vivos.forEach(m => { const el = view.querySelector(`[data-vivo-card="${CSS.escape(m.sn.idp)}"]`); if (!el) return;
      const antes = [...el.querySelectorAll('[data-vv-g]')].map(g => g.textContent);
      el.outerHTML = vivoHtml(m);
      const nuevo = view.querySelector(`[data-vivo-card="${CSS.escape(m.sn.idp)}"]`);
      if (nuevo && MOV) nuevo.querySelectorAll('[data-vv-g]').forEach((g, i) => { if (antes[i] != null && antes[i] !== g.textContent) repetir(g.firstElementChild, 'mpTick .7s cubic-bezier(.2,.9,.25,1.08)'); }); });
  });
  document.addEventListener('mp-directo', () => { if (introEl) introDirecto(); else if (!introAbierta && !introVistaCarga && Date.now() - T_CARGA < 5000) abrirIntro(true); });

  // el reloj de la parte avanza cada segundo entre respuestas (si el portal lo da)
  setInterval(() => {
    Object.values(LIVE.snaps).forEach(sn => { if (sn.estado === 'directo' && sn.reloj) { const st = document.querySelector(`[data-bdst="${CSS.escape(sn.idp)}"]`); if (st) st.textContent = estadoCorto(sn);
      const fi = introEl && introEl.querySelector(`[data-vivo="${CSS.escape(sn.idp)}"] .cuando`); if (fi) fi.innerHTML = cuandoVivo(sn); } });
    if (/^#\/directo\//.test(location.hash)) { if (RS.vivo && RS.sn && rsRoot() && RS.fase !== 'fin') { rsVivoEstado(RS.sn); rsPintar(); } return; }   // el directo nuevo (rediseño final)
    if (!DV.vacio && /^#\/directo\//.test(location.hash) && Object.values(LIVE.snaps).some(sn => sn.estado === 'directo' && sn.reloj)) pintarHoy();
    if (DV.vacio || !/^#\/directo\//.test(location.hash)) return;
    const sn = snapDV();
    if (!sn || sn.estado !== 'directo' || !sn.reloj) return;
    const ch = chipDirecto(sn), chip = $('[data-dv="chip"]');
    if (chip) chip.innerHTML = chipHtml(ch);
    const [f1, f2] = rellenoDirecto(sn), e1 = $('[data-dv="f1"]'), e2 = $('[data-dv="f2"]');
    if (e1) e1.style.width = f1 + '%';
    if (e2) e2.style.width = f2 + '%';
    pintarSituacion(ctxDirecto(sn));
  }, 1000);

  /* ── Versión nueva ──────────────────────────────────────── */
  // GitHub Pages deja la página en la caché del navegador hasta 10 minutos, y con ella la versión anterior de la web. Si hay otra
  // versión, la web se actualiza sola, sin preguntar: al abrirla, al volver a la pestaña o, si se estaba usando (cada 10 minutos
  // se mira), en cuanto se cambia de página. Nunca a mitad de un directo o de un vídeo: espera a que se salga de ahí.
  const VERSION = (((document.querySelector('script[src*="assets/app.js"]') || {}).src || '').split('v=')[1] || '').split('&')[0];
  const conVersion = v => location.pathname + '?v=' + encodeURIComponent(v) + location.hash;
  const enVivo = () => /^#\/(directo|video|sincronizar|banquillo)\//.test(location.hash);
  let vPendiente = null;
  function versionNueva(momento) {   // 'abrir' · 'volver' (a la pestaña) · 'mirar' (cada 10 minutos)
    if (!VERSION) return;
    fetch('index.html?_=' + Date.now(), { cache: 'no-store' }).then(r => (r.ok ? r.text() : '')).then(t => {
      const v = (/assets\/app\.js\?v=([\w-]+)/.exec(t) || [])[1];
      if (!v || v === VERSION || location.search.indexOf('v=' + v) >= 0) return;   // misma versión, o ya pedida (sin bucles)
      if (momento === 'mirar' || enVivo()) { vPendiente = v; return; }   // se está usando: al cambiar de página
      location.replace(conVersion(v));
    }).catch(() => { /* sin conexión: ya se mirará */ });
  }
  versionNueva('abrir');
  document.addEventListener('visibilitychange', () => { if (!document.hidden) versionNueva('volver'); });
  setInterval(() => { if (!document.hidden) versionNueva('mirar'); }, 10 * 60000);
  window.addEventListener('hashchange', () => { if (vPendiente && !enVivo()) location.replace(conVersion(vPendiente)); });

  /* ── Carga ──────────────────────────────────────────────── */
  // historico.json se pide a la vez que app.json y la web se pinta cuando están los dos (si el histórico falla, sin él):
  // así no se vuelve a pintar a mitad de las animaciones. Mientras, el esqueleto de carga (7l).
  /* ── Apodos: «¿Eres jugador?» (#/apodo) y el buzón del club (#/buzon, sin enlace en ninguna página) ── */
  function prepApodos() {
    APODO_V = {}; const grupos = {}, nrm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    Object.entries(APODO || {}).forEach(([k, ap]) => { if (ap) (grupos[nrm(ap)] = grupos[nrm(ap)] || []).push(k); });
    const ape = k => { const j = A && A.jugadores[k], w = ((j && j.apellidos) || '').split(' ').filter(Boolean), o = [];
      for (const x of w) { o.push(x); if (!PART.has(x.toLowerCase()) || o.length === w.length) break; } return o.join(' '); };
    Object.values(grupos).forEach(ks => {
      if (ks.length === 1) { APODO_V[ks[0]] = APODO[ks[0]]; return; }
      const inis = ks.map(k => (ape(k).match(/\p{L}/u) || [''])[0].toUpperCase());
      ks.forEach((k, i) => { const a = ape(k); APODO_V[k] = APODO[k] + (a ? ' ' + (inis.filter(x => x === inis[i]).length > 1 ? a : inis[i] + '.') : ''); });
    });
  }
  function cargarApodos() {
    apiGet('apodo').then(d => { if (!d || !d.apodos || JSON.stringify(d.apodos) === JSON.stringify(APODO)) return;
      APODO = d.apodos; try { localStorage.setItem('mp-apodos', JSON.stringify(APODO)); } catch (e) { /* sin almacenamiento */ }
      prepApodos(); render(); });
  }
  const apodoCta = () => (SRV.apodo ? '<a class="ap-cta" href="#/apodo"><span><b>¿Eres jugador?</b> Propón tu apodo</span><span class="ir">Proponer</span></a>' : '');
  const AP = { q: '', k: null, msg: '', ok: false };
  const apLista = () => { const q = nq(AP.q); if (!q) return '<div class="pv-nota">Escribe tu nombre o tu dorsal.</div>';
    const ORD = ['A', 'B', 'C', 'D', 'AL', 'IN'], eqO = j => Math.min(99, ...equiposDe(j).map(e => ORD.indexOf(e.id)).filter(x => x >= 0));
    const js = Object.values(A.jugadores).filter(j => nq(j.nombre + ' ' + j.apellidos).includes(q) || String(j.dorsal || '') === q).sort((a, b) => eqO(a) - eqO(b) || (a.nombre + a.apellidos).localeCompare(b.nombre + b.apellidos, 'es')).slice(0, 12);
    return js.length ? js.map(j => `<button type="button" class="ap-j" data-ap-k="${esc(j.k)}"><b>${esc(j.nombre + ' ' + j.apellidos)}</b><span>${esc([equiposDe(j).map(mpCorto).join(' · '), j.dorsal ? '#' + j.dorsal : '', APODO[j.k] ? 'ahora: «' + APODO[j.k] + '»' : ''].filter(Boolean).join(' · '))}</span></button>`).join('')
      : `<div class="pv-nota">No encontramos a nadie con «${esc(AP.q)}».</div>`; };
  function vApodo() {
    if (!SRV.apodo) return casoHtml('Jugadores', 'Todavía no está disponible', 'Muy pronto podrás proponer aquí tu apodo.');
    const j = AP.k && A.jugadores[AP.k];
    const cab = `<div class="cab-pag"><div><h1 class="h1">¿Eres jugador?</h1><div class="sub">Búscate y propón tu apodo. Lo revisamos antes de publicarlo; después saldrá en la web en lugar de tu nombre. En la plantilla y en tu ficha seguirá tu nombre completo.</div></div></div>`;
    if (!j) return `<div class="apodo2">${cab}<label class="jq"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input type="search" id="ap-q" value="${esc(AP.q)}" placeholder="Tu nombre o tu dorsal" aria-label="Buscarte" autocomplete="off"></label><div class="ap-lista" data-ap-lista>${apLista()}</div></div>`;
    return `<div class="apodo2">${cab}<div class="tarjeta ap-sel"><div><b>${esc(j.nombre + ' ' + j.apellidos)}</b><span>${esc([equiposDe(j).map(mpCorto).join(' · '), j.dorsal ? '#' + j.dorsal : ''].filter(Boolean).join(' · '))}${APODO[j.k] ? ' · ahora: «' + esc(APODO[j.k]) + '»' : ''}</span></div><button type="button" class="btn s" data-ap-otro>No soy yo</button></div>
      ${AP.ok ? `<div class="aviso ap-ok">${esc(AP.msg)}</div>` : `<form class="ap-form" data-ap-form novalidate><label class="etq" for="ap-apodo">Tu apodo</label><div class="ap-fila"><input id="ap-apodo" maxlength="20" autocomplete="off" placeholder="Hasta 20 letras o números" required><button class="btn p" type="submit">Enviar</button></div>
        <div class="pv-nota" data-ap-msg>${esc(AP.msg)}</div></form>`}</div>`;
  }
  document.addEventListener('input', e => { if (e.target && e.target.id === 'ap-q') { AP.q = e.target.value; const l = view.querySelector('[data-ap-lista]'); if (l) l.innerHTML = apLista(); } });
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-ap-k], [data-ap-otro]'); if (!b || !view.contains(b)) return;
    AP.k = b.dataset.apK || null; AP.msg = ''; AP.ok = false; render(); const i = view.querySelector(AP.k ? '#ap-apodo' : '#ap-q'); if (i) i.focus();
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest && e.target.closest('[data-ap-form]'); if (!f) return; e.preventDefault();
    const v = (f.querySelector('#ap-apodo').value || '').replace(/\s+/g, ' ').trim(), msg = f.querySelector('[data-ap-msg]');
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .'’-]{0,19}$/u.test(v)) { msg.textContent = 'Hasta 20 caracteres: letras, números, espacios, punto, guion o apóstrofo.'; return; }
    msg.textContent = 'Enviando…';
    apiPost('apodo', { k: AP.k, apodo: v, d: DISP }).then(d => {
      if (d && d._st === 200) { AP.ok = true; AP.msg = `Recibido: «${v}». Lo revisamos y, si lo aprobamos, saldrá en la web.`; render(); }
      else msg.textContent = (d && d.error) || 'No se ha podido enviar. Prueba más tarde.';
    });
  });
  // buzón: con el PIN del club (el mismo de las herramientas), aprobar, rechazar o quitar
  const BZ = { d: null, msg: 'Pon el PIN del club para ver las propuestas.' };
  const nomK = k => { const j = A.jugadores[k]; return j ? j.nombre + ' ' + j.apellidos + ' · ' + (equiposDe(j).map(mpCorto).join(' · ') || j.equipo || '') : k; };
  const buzonHtml = () => { if (!BZ.d) return `<div class="pv-nota">${esc(BZ.msg)}</div>`;
    const pend = BZ.d.pendientes || [], ok = Object.entries(BZ.d.apodos || {});
    return `${BZ.msg ? `<div class="pv-nota">${esc(BZ.msg)}</div>` : ''}<h2 class="h2">Pendientes · ${pend.length}</h2>
      ${pend.length ? pend.map(p => `<div class="bz-f"><div><b>«${esc(p.apodo)}»</b><span>${esc(nomK(p.k))} · ${esc(fdc(p.ts.slice(0, 10)))}</span></div><div class="bz-b"><button type="button" class="btn p" data-bz="aprobar" data-id="${esc(p.id)}">Aprobar</button><button type="button" class="btn s" data-bz="rechazar" data-id="${esc(p.id)}">Rechazar</button></div></div>`).join('') : '<div class="pv-nota">No hay propuestas pendientes.</div>'}
      <h2 class="h2">Aprobados · ${ok.length}</h2>
      ${ok.length ? ok.sort((a, b) => nomK(a[0]).localeCompare(nomK(b[0]), 'es')).map(([k, ap]) => `<div class="bz-f"><div><b>«${esc(APODO_V[k] || ap)}»</b><span>${esc(nomK(k))}</span></div><div class="bz-b"><button type="button" class="btn s" data-bz="quitar" data-k="${esc(k)}">Quitar</button></div></div>`).join('') : '<div class="pv-nota">Todavía no hay apodos aprobados.</div>'}`; };
  function buzon(cuerpo) {
    const pin = leeLS('mp-pin', ''); if (!pin) { BZ.msg = 'Pon el PIN del club.'; const c = view.querySelector('[data-bz-caja]'); if (c) c.innerHTML = buzonHtml(); return; }
    apiPost('apodo', Object.assign({ pin }, cuerpo || {})).then(d => {
      if (!d) { BZ.msg = 'Sin conexión con el servicio.'; }
      else if (d._st !== 200 && !d.pendientes) { BZ.d = null; BZ.msg = d.error || 'No se ha podido abrir el buzón.'; }
      else { BZ.d = d; BZ.msg = d._st !== 200 ? d.error : ''; APODO = d.apodos || {}; try { localStorage.setItem('mp-apodos', JSON.stringify(APODO)); } catch (e) { /* sin almacenamiento */ } prepApodos(); }
      const c = view.querySelector('[data-bz-caja]'); if (c) c.innerHTML = buzonHtml();
    });
  }
  function vBuzon() {
    if (!BZ.d && leeLS('mp-pin', '')) setTimeout(() => buzon(), 0);
    return `<div class="sy buzon"><div class="cab-pag"><h1 class="h1">Buzón de apodos</h1></div>
      <div class="bq-pin"><label for="bz-pin">PIN del club</label><input id="bz-pin" type="password" inputmode="numeric" autocomplete="off" value="${esc(leeLS('mp-pin', ''))}"><button type="button" class="btn s" data-bz="ver">Ver</button></div>
      <div class="bz-caja" data-bz-caja>${buzonHtml()}</div></div>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-bz]'); if (!b || !view.contains(b)) return;
    const k = b.dataset.bz;
    if (k === 'ver') { ponLS('mp-pin', (view.querySelector('#bz-pin') || {}).value || ''); buzon(); return; }
    b.disabled = true; buzon(k === 'quitar' ? { accion: k, k: b.dataset.k } : { accion: k, id: b.dataset.id });
  });

  const pHist = fetch('data/historico.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
  // qué tiene el servicio (data/servicio.json): se pide a la vez que app.json, así «¿Eres jugador?» sale ya en la primera pantalla
  const pSrv = srvP = (API.includes('localhost') ? Promise.resolve({ almacen: true, video: true, apodo: true })
    : fetch('data/servicio.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : {}))).catch(() => ({}));
  fetch('data/app.json', { cache: 'no-cache' }).then(r => r.json()).then(app => Promise.all([pHist, pSrv]).then(([h, srv]) => {
    A = app;
    SRV = srv || {};
    hCargando = false;
    if (h) H = prepH(h);
    prepApodos();
    if (!location.hash && S.route) history.replaceState(null, '', S.route);
    prevRoute = location.hash;
    let introVista = false;
    try { introVista = sessionStorage.getItem(INTRO) === '1'; } catch (e) { /* sin almacenamiento */ }
    introVistaCarga = introVista || !esInicio(HASH_INICIAL);
    if (!introVistaCarga) abrirIntro(true);
    render();
    arrancarDirecto();
    cargarSemana();
    cargarApodos();
  })).catch(() => { view.innerHTML = '<div class="loading">No se ha podido cargar la web. Prueba a recargar la página.</div>'; });
})();
