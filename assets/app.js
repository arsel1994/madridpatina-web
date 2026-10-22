/* MADRIDPATINA · web del club. JavaScript sin dependencias ni compilación.
   Lee data/app.json (obligatorio) y data/historico.json (opcional).
   Rutas: #/jornada[/2026-S40] · #/equipo/C · #/liga/senior-4[/llega | /j/2] · #/partido/<mid>
          #/jugadores[/C] · #/jugador/<k> · #/historico
   Diseño y medidas: design_handoff_madridpatina_web/README.md (prototipo MADRIDPATINA.dc.html). */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RED = '#D3202A';
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
  // Jugador del acta: enlace a su ficha si es de los nuestros
  // jugadoras: app.json las marca con «fem» (por el nombre de pila; la FMP no da el sexo)
  const rolDe = p => p.portero ? (p.fem ? 'Portera' : 'Portero') : p.capitan ? (p.fem ? 'Capitana' : 'Capitán') : p.asistente ? 'Asistente' : (p.fem ? 'Jugadora' : 'Jugador');
  const quienTxt = x => !x ? '' : !x.nombre ? (x.dorsal ? '#' + esc(x.dorsal) : '')
    : (A.jugadores[x.k] ? `<a href="${hP(x.k)}">#${esc(x.dorsal || '')} ${esc(corto(x))}</a>` : `#${esc(x.dorsal || '')} ${esc(corto(x))}`);
  const letraOf = e => e.cantera ? (e.id === 'AL' ? 'AL' : 'IN') : e.id;
  const tituloOf = e => e.cantera ? (e.id === 'AL' ? 'Alevín' : 'Infantil') : 'Equipo ' + e.id;
  const ini = (n, a) => ((n || '')[0] || '') + ((a || '')[0] || '');
  const kOf = (n, a) => (n + ' ' + a).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-');
  // Nombre + primer apellido, con sus partículas («Andrés Del Valle», «Rodrigo Del Horno»)
  const PART = new Set(['de', 'del', 'la', 'las', 'los', 'san', 'santa', 'y', 'el']);
  const corto = p => { const w = (p.apellidos || '').split(' ').filter(Boolean), o = [];
    for (const x of w) { o.push(x); if (!PART.has(x.toLowerCase()) || o.length === w.length) break; }
    return (p.nombre + ' ' + o.join(' ')).trim(); };

  /* ── Enlaces ────────────────────────────────────────────── */
  const hJor = id => '#/jornada' + (id ? '/' + id : '');
  const hEq = id => '#/equipo/' + id;
  const hLg = (id, sub) => '#/liga/' + id + (sub ? '/' + sub : '');
  const hM = mid => mid && A.partidos[mid] ? '#/partido/' + encodeURIComponent(mid) : null;
  const hP = k => k && A.jugadores[k] ? '#/jugador/' + encodeURIComponent(k) : null;
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
  // 7h · cada fila parte del puesto de la semana anterior y se recoloca; ▲n / ▼n con los puestos ganados o perdidos
  // las semanas guardadas ya desempatan como la FMP (semana.py: primero los partidos entre los empatados)
  const antesDe = (ligaId, wi) => { const sm = A.semanas[wi + 1], l = sm && sm.ligas.find(x => x.id === ligaId); return l ? Object.fromEntries(l.clasif.map(r => [r.equipo, r.puesto])) : {}; };
  const swapA = d => d ? ' data-anim="mpSwap .9s .3s cubic-bezier(.5,0,.2,1)"' : '';
  const swapS = (d, r, gap) => `position:relative;z-index:${r.nuestro ? 3 : d ? 2 : 1};${d ? `--dy:calc(${d} * (100% + ${gap}px));` : ''}`;
  const flecha = d => d ? `<span data-anim="mpArrow .3s 1.2s" style="flex:none;font-size:11px;font-weight:800;color:${d > 0 ? '#3DD27E' : '#FF5A52'}"><span aria-hidden="true">${d > 0 ? '▲' + d : '▼' + -d}</span><span class="sr-only">${d > 0 ? 'sube' : 'baja'} ${Math.abs(d)} ${Math.abs(d) === 1 ? 'puesto' : 'puestos'}</span></span>` : '';
  // 7n · barra V/E/D por tramos (victorias → empates → derrotas) y el balance al final; filas en cascada
  const tramos = (h, i) => { const b0 = 150 + Math.min(i, 10) * 90;
    return { fila: ` data-anim="mpUp .35s ${b0}ms"`, bal: ` data-anim="mpFade .3s ${b0 + 1150}ms"`,
      barra: `<div data-anim="mpWipe .35s ${b0 + 200}ms" style="flex:${h.v};background:#1E8A4C;transform-origin:left"></div><div data-anim="mpWipe .25s ${b0 + 550}ms" style="flex:${h.e};background:#8A8A8F;transform-origin:left"></div><div data-anim="mpWipe .35s ${b0 + 800}ms" style="flex:${h.d};background:#55555B;transform-origin:left"></div>` }; };
  // 7p · cifras que giran como un rodillo, dígito a dígito (alto de línea .85em, como el resto de cifras grandes)
  const rodarCifra = (v, ms) => `<span aria-hidden="true">${rodarCifra0(v, ms)}</span><span class="sr-only">${esc(v)}</span>`;
  const rodarCifra0 = (v, ms) => String(v).split('').map(ch => /\d/.test(ch)
    ? `<span style="display:inline-block;height:.85em;overflow:hidden;vertical-align:top"><span data-anim="mpRoll 1s cubic-bezier(.2,.9,.25,1.08) ${ms}ms" style="display:block;--to:${(-ch * 0.85).toFixed(3)}em">${Array.from({ length: +ch + 1 }, (_, i) => `<span style="display:block;height:.85em;text-align:center">${i}</span>`).join('')}</span></span>`
    : `<span>${esc(ch)}</span>`).join('');
  // ancho útil dentro de una tarjeta (para las piezas con posiciones calculadas: escalera y movimientos)
  const anchoUtil = pad => Math.min(document.documentElement.clientWidth || innerWidth, 1280) - 2 * Math.min(40, Math.max(16, innerWidth * 0.03)) - 2 * pad;
  const tableRows = (rows, dark = '#2A1416') => { const max = Math.max(3, ...rows.map(r => r.pts)); return rows.map(r => ({ puesto: r.puesto, equipo: r.equipo, crest: crest(r.equipo), pj: r.pj, v: r.v, e: r.e, d: r.d, pts: r.pts, dg: (r.gf - r.gc > 0 ? '+' : '') + (r.gf - r.gc), ptsPct: (r.pts / max * 100) + '%', weight: r.nuestro ? 800 : 500, bg: r.nuestro ? dark : '#18181B', bar: r.nuestro ? RED : '#6B6B70', nuestro: r.nuestro })); };

  /* ── 1. Jornada ─────────────────────────────────────────── */
  // Acta resumida de un partido nuestro (tarjetas de la Jornada); el acta completa está en la página del partido
  function actaMini(p, nombre) {
    const s = p.local === nombre ? 'l' : 'v', alin = p['alin_' + s] || [], por = p['por_' + s] || [];
    const nm = x => `#${esc(x.dorsal || '')} ${esc(corto({ nombre: (x.nombre || '').split(' ')[0], apellidos: x.apellidos }))}`;
    const goles = alin.filter(x => x.g || x.a).sort((a, b) => b.g - a.g || b.a - a.a)
      .map(x => nm(x) + ` <span style="color:#A6A6AD">${[x.g ? x.g + ' G' : '', x.a ? x.a + ' A' : ''].filter(Boolean).join(' · ')}</span>`);
    const sanc = alin.filter(x => x.pim).map(x => nm(x) + ` <span style="color:#A6A6AD">${fmin(x.pim)}</span>`);
    const fila = (k, v) => `<div style="display:grid;grid-template-columns:78px minmax(0,1fr);gap:8px"><span style="font-size:13px;font-weight:700;color:#A6A6AD">${k}</span><span>${v}</span></div>`;
    if (!alin.length && !p.ev) return '';
    return `<div style="padding:12px 18px 14px;border-top:1px solid #26262A;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.4">
        ${fila('Goles', goles.length ? goles.join('<br>') : '<span style="color:#A6A6AD">Sin goles</span>')}
        ${alin.length ? fila('Jugaron · ' + alin.length, alin.map(nm).join(', ')) : ''}
        ${por.length ? fila('Portería', por.map(x => nm(x) + ` <span style="color:#A6A6AD">${x.pct != null ? dec(x.pct) + '% · ' : ''}${x.par}/${x.tiros}</span>`).join('<br>')) : ''}
        ${sanc.length ? fila('Sanciones', sanc.join('<br>')) : ''}
        ${p.pista ? fila('Pista', esc(p.pista)) : ''}
        ${p.arb && p.arb.length ? fila(p.arb.length > 1 ? 'Árbitros' : 'Árbitro', p.arb.map(esc).join(', ')) : ''}
        ${box(hM(p.mid), 'font-weight:700;color:#FF6B63;margin-top:2px', 'Ver acta completa →')}
      </div>`;
  }

  function vJornada(weekId) {
    const wi = Math.max(0, A.semanas.findIndex(w => w.id === weekId));
    const w = A.semanas[wi];
    const eqSem = (p, s) => { const L = lgOf(p.liga); return L && L.cantera && ours(p[s]) ? p[s] + (p.liga.startsWith('alevin') ? ' Alevín' : ' Infantil') : p[s]; };   // las dos de cantera se llaman igual
    const bal = { pj: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0 };
    const nexts = [], mids = [];
    const cards = A.equipos.map(e => {
      const L = lgOf(e.ligaId);
      const m = e.cal.find(c => c.fecha && c.fecha >= w.desde && c.fecha <= w.hasta && c.resultado);
      const nx = e.cal.filter(c => c.fecha && c.fecha > w.hasta && !c.descanso)
        .sort((a, b) => (a.fecha + (a.hora || '')) < (b.fecha + (b.hora || '')) ? -1 : 1)[0];
      const wn = w.nuestros.find(n => n.equipo === e.nombre && (!n.liga_id || n.liga_id === e.ligaId));   // alevín e infantil se llaman igual
      const lj = L.jornadas.find(j => j.desde && j.desde <= w.hasta && j.hasta >= w.desde);
      const ce = lj && e.cal.find(c => c.j === lj.n);
      const cl0 = wn ? wn.clasificacion : { puesto: e.clas ? e.clas.puesto : '-', de: L.clasif.length, pts: e.clas ? e.clas.pts : 0 };
      const wl0 = w.ligas.find(x => x.id === e.ligaId), fila = wl0 && (wi === 0 && L.clasif.length ? L.clasif : wl0.clasif).find(x => x.equipo === e.nombre);
      const cl = fila ? Object.assign({}, cl0, { puesto: fila.puesto, pts: fila.pts }) : cl0;   // el mismo puesto que la tabla de esa semana
      let gn = null, gr = null;
      if (m) { [gn, gr] = m.resultado.split('-').map(Number); bal.pj++; bal[m.r.toLowerCase()]++; bal.gf += gn; bal.gc += gr; if (m.mid && !mids.includes(m.mid)) mids.push(m.mid); }   // un derbi, una vez
      if (nx) nexts.push({ e, nx });
      // su partido de esa jornada se jugó (o se jugará) otro día: aplazado, no descanso
      const aplazado = !m && ce && !ce.descanso && ce.fecha && !(ce.fecha >= w.desde && ce.fecha <= w.hasta);
      const r = m ? RES[m.r] : [aplazado ? 'APLAZADO' : (wn && wn.descansa) || (ce && ce.descanso) ? 'DESCANSA' : 'SIN PARTIDO', '#2E2E33'];
      const wl = w.ligas.find(x => x.id === e.ligaId), sinEmpezar = !!(wl && wl.clasif.length && wl.clasif.every(x => !x.pj));
      const pm = m && m.mid && A.partidos[m.mid], penNos = pm && pm.pen ? (pm.pen === e.nombre ? 1 : -1) : 0;   // empate decidido en los penaltis
      const dots = Array.from({ length: cl.de || 0 }, (_, i) => `<div style="flex:1;height:8px;border-radius:2px;background:${i + 1 === cl.puesto && !sinEmpezar ? RED : '#2E2E33'}"></div>`).join('');
      return `<div class="card" style="overflow:hidden;display:flex;flex-direction:column">
        ${box(hEq(e.id), 'display:flex;align-items:center;justify-content:space-between;padding:16px 18px 0;gap:8px', `
          <div style="display:flex;align-items:baseline;gap:10px;min-width:0"><span style="${BS}font-weight:900;font-size:44px;line-height:1;color:${RED}">${letraOf(e)}</span><span style="font-size:14px;font-weight:600;color:#A6A6AD">${esc(L.corto)}</span></div>
          <span style="flex:none;font-size:13px;font-weight:700;letter-spacing:.06em;padding:4px 9px;border-radius:4px;background:${r[1]};color:#fff">${r[0]}</span>`)}
        ${box(m && m.mid ? hM(m.mid) : hEq(e.id), `padding:12px 18px 14px;${BS}font-weight:800;font-size:80px;line-height:.9;letter-spacing:-.01em;font-variant-numeric:tabular-nums;color:${m ? '#F4F4F5' : '#3A3A40'}`, m ? gn + (penNos > 0 ? bPen() : '') + '–' + gr + (penNos < 0 ? bPen() : '') : '—')}
        <div style="display:flex;align-items:center;gap:10px;padding:0 18px 16px;min-height:52px">
          ${m ? `${disc(crest(m.rival), 32)}<div style="min-width:0"><div style="font-weight:700;font-size:15px;letter-spacing:.02em">${esc(m.rival)}</div><div style="font-size:13px;color:#A6A6AD">${(m.casa ? 'En casa' : 'Fuera') + ' · ' + fd(m.fecha)}</div></div>` : ''}
        </div>
        <div style="padding:14px 18px;border-top:1px solid #26262A">
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#A6A6AD;font-weight:600"><span>Clasificación</span><span style="color:#F4F4F5">${sinEmpezar ? 'La liga aún no ha empezado' : `${cl.puesto}º de ${cl.de} · ${cl.pts} ${cl.pts === 1 ? 'pt' : 'pts'}`}</span></div>
          <div style="display:flex;gap:3px;margin-top:8px">${dots}</div>
        </div>
        <div style="margin-top:auto;padding:14px 18px;background:#121214;display:flex;align-items:center;gap:10px">
          ${disc(nx ? crest(nx.rival) : '', 28)}
          <div style="flex:1;min-width:0"><div style="font-size:13px;color:#A6A6AD;font-weight:600">Próximo · ${nx ? (nx.casa ? 'en casa' : 'fuera') : ''}</div><div style="font-weight:700;font-size:15px">${esc(nx ? nx.rival : 'Fin de temporada')}</div></div>
          <div style="text-align:right"><div style="font-weight:700;font-size:15px">${nx ? fd(nx.fecha) : ''}</div><div style="font-size:13px;color:#A6A6AD">${nx ? esc(nx.hora || 'hora por fijar') : ''}</div></div>
        </div>
      </div>`;
    }).join('');
    // Portero de la semana (mejor % con ≥10 tiros) y goleador del club
    let por = null, fig = null;
    mids.forEach(mid => { const p = A.partidos[mid]; [['local', 'gol_l', 'por_l', 'visitante'], ['visitante', 'gol_v', 'por_v', 'local']].forEach(([s, g, pk, o]) => {
      if (!ours(p[s])) return;
      p[pk].forEach(x => { if (x.tiros >= 10 && (!por || x.pct > por.pct)) por = Object.assign({}, x, { equipo: eqSem(p, s), rival: p[o] }); });
      p[g].forEach(x => { if (!fig || x.g > fig.g || (x.g === fig.g && x.a > fig.a)) fig = Object.assign({}, x, { equipo: eqSem(p, s), rival: p[o] }); });
    }); });
    // Más asistencias y más sancionado del club en la semana (sumando si un jugador juega más de un partido)
    const tot = {};
    mids.forEach(mid => { const p = A.partidos[mid]; [['local', 'alin_l', 'visitante'], ['visitante', 'alin_v', 'local']].forEach(([s, al, o]) => {
      if (!ours(p[s])) return;
      (p[al] || []).forEach(x => { const t = tot[x.k] || (tot[x.k] = Object.assign({}, x, { g: 0, a: 0, pim: 0, faltas: 0, equipo: eqSem(p, s), rivales: [] }));
        t.g += x.g || 0; t.a += x.a || 0; t.pim += x.pim || 0; t.rivales.push(p[o]);
        t.faltas += (p.ev || []).filter(e => e.tipo === 'falta' && e.jugador && e.jugador.k === x.k).length; });
    }); });
    const asis = Object.values(tot).filter(x => x.a).sort((a, b) => b.a - a.a || b.g - a.g)[0];
    const sanc = Object.values(tot).filter(x => x.pim).sort((a, b) => b.pim - a.pim || b.faltas - a.faltas)[0];
    const empatan = (x, igual) => { const o = Object.values(tot).filter(y => y.k !== x.k && igual(y)).map(y => esc(corto(y)));
      return o.length ? `<br><span style="font-size:13px;font-weight:400;color:#A6A6AD">Empata con ${o.join(', ')}</span>` : ''; };
    const pf = x => x && (x.foto || (A.jugadores[x.k] && A.jugadores[x.k].foto));
    // 7k · solo la columna de la foto es un rodillo de tragaperras: tira con las fotos de los nuestros que jugaron esa
    // semana (×3 y el ganador al final). Paran escalonadas; al parar aparecen nombre y equipo y la cifra cuenta desde 0.
    const ordenM = [por, fig, asis, sanc].filter(Boolean);
    const pool = campo => { const v = {}, r = []; mids.forEach(mid => { const p = A.partidos[mid];
      [['local', 'alin_l', 'por_l'], ['visitante', 'alin_v', 'por_v']].forEach(([sd, al, pk]) => { if (!ours(p[sd])) return;
        (campo ? (p[al] || []).filter(x => !x.portero) : p[pk] || []).forEach(x => { if (pf(x) && !v[x.k]) { v[x.k] = 1; r.push(x); } }); }); }); return r; };
    const poolCampo = pool(true), poolPor = pool(false);
    const mejor = o => { const x = o.x, i = Math.max(0, ordenM.indexOf(x)), dur = 2600 + i * 450;
      let base = (o.porteros && poolPor.length > 1 ? poolPor : poolCampo).filter(j => j.k !== x.k);
      const g = base.length ? (i * 3) % base.length : 0; base = base.slice(g).concat(base.slice(0, g)).slice(0, 6);   // 6 caras distintas bastan para el giro
      const tira = base.concat(base, base, [x]);
      const item = j => `<div class="ini rod-item" style="background:${o.photoBg};font-size:48px;color:${o.iniInk}">${esc(ini(j.nombre, j.apellidos))}${pf(j) ? `<div class="ph" data-bg="${esc(pf(j))}" data-anim="mpReelBlur ${dur}ms" style="background-position:50% 20%;filter:grayscale(1)"></div>` : ''}</div>`;
      return box(hP(x.k), `background:${o.bg};border-radius:12px;overflow:hidden;display:grid;grid-template-columns:${o.colW}px minmax(0,1fr);min-height:250px`, `
        <div class="rod-foto" aria-hidden="true" style="background:${o.photoBg}"><div class="rod-tira" data-anim="mpReel ${dur}ms cubic-bezier(.12,.55,.18,1)">${tira.map(item).join('')}</div>
          <div class="rod-sombra" data-anim="mpFade .5s ${dur}ms reverse"></div><div class="rod-flash" data-anim="mpLand .6s ${dur}ms"></div></div>
        <div style="padding:20px 22px;display:flex;flex-direction:column;min-width:0">
          <div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:${o.titInk}">${o.titulo}</div>
          <div class="rod-txt"><div style="${BS}font-weight:800;font-size:${o.nameFs}px;line-height:1;margin-top:10px">${esc(corto(x))}</div><div style="font-size:15px;color:${o.subInk};margin-top:4px">${o.sub}</div></div>
          <div class="rod-num" style="margin-top:auto;padding-top:16px;display:flex;align-items:end;gap:${o.gap}px;flex-wrap:wrap">
            <div style="${BS}font-weight:900;font-size:${String(o.texto).length > 4 ? `min(${o.valFs}px,${Math.round(125 / String(o.texto).length)}vw)` : o.valFs + 'px'};line-height:.85;color:${o.valInk};white-space:nowrap"><span data-cuenta="${o.valor}" data-fmt="${o.fmt}">${o.texto}</span>${o.suf ? `<span style="font-size:36px">${o.suf}</span>` : ''}</div>
            <div style="font-size:15px;font-weight:600;padding-bottom:4px">${o.detalle}</div>
          </div>
        </div>`, 'div', ' data-rodillo data-grupo');
    };
    const statCard = (x, titulo, valor, color, detalle, fmt, texto) => mejor({ x, titulo, valor, fmt, texto, detalle, valInk: color, bg: '#18181B', photoBg: '#26262A', iniInk: '#A6A6AD',
      titInk: '#A6A6AD', subInk: '#C9C9CE', sub: `#${esc(x.dorsal)} · ${esc(x.equipo)}`, colW: 130, nameFs: 30, valFs: 88, gap: 14 });
    const asisCard = asis ? statCard(asis, 'MÁS ASISTENCIAS DEL CLUB', asis.a, '#F4F4F5',
      `${asis.a === 1 ? 'asistencia' : 'asistencias'} · ${asis.g} ${asis.g === 1 ? 'gol' : 'goles'}<br>vs ${esc([...new Set(asis.rivales)].join(', '))}${empatan(asis, y => y.a === asis.a && y.g === asis.g)}`, 'int', asis.a) : '';
    const sancCard = sanc ? statCard(sanc, 'MÁS SANCIONADO DEL CLUB', sanc.pim, '#FF8A3D',
      `de sanción · ${sanc.faltas} ${sanc.faltas === 1 ? 'falta' : 'faltas'}<br>vs ${esc([...new Set(sanc.rivales)].join(', '))}${empatan(sanc, y => y.pim === sanc.pim && y.faltas === sanc.faltas)}`, 'min', fmin(sanc.pim))
      : (mids.length ? `<div class="card" style="padding:20px 22px;display:flex;flex-direction:column;justify-content:center;min-height:250px"><div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#A6A6AD">MÁS SANCIONADO DEL CLUB</div><div style="${BS}font-weight:900;font-size:44px;line-height:1;margin-top:12px;color:#3DD27E">SEMANA SIN SANCIONES</div><div style="font-size:15px;color:#C9C9CE;margin-top:6px">Ningún jugador nuestro vio una falta.</div></div>` : '');
    const seen = {};
    const label = (n, e) => abr(n) === 'MP' ? 'MP ' + letraOf(e) : abr(n);
    const proximos = nexts.map(({ e, nx }) => { const local = nx.casa ? e.nombre : nx.rival, vis = nx.casa ? nx.rival : e.nombre;
      return { k: [local, vis].sort().join('|') + nx.fecha, s: (nx.fecha || '9') + (nx.hora || ''), dia: fd(nx.fecha), hora: nx.hora || 'Por fijar', lc: crest(local), vc: crest(vis), la: label(local, e), va: label(vis, e), derbi: !!nx.derbi }; })
      .filter(p => !seen[p.k] && (seen[p.k] = 1)).sort((a, b) => a.s < b.s ? -1 : 1);   // uno por equipo nuestro (los derbis, una vez)
    const [y1, m1, d1] = w.desde.split('-').map(Number), [y2, m2, d2] = w.hasta.split('-').map(Number);
    const older = A.semanas[wi + 1], newer = A.semanas[wi - 1];
    const arrow = (sem, ch) => sem ? `<a class="blk" href="${hJor(sem.id)}" aria-label="${ch === '‹' ? 'Semana anterior' : 'Semana siguiente'}" style="width:32px;height:32px;display:grid;place-items:center;border:1px solid #3A3A40;border-radius:6px;color:#F4F4F5">${ch}</a>`
      : `<span style="width:32px;height:32px;display:grid;place-items:center;border:1px solid #3A3A40;border-radius:6px;color:#3A3A40">${ch}</span>`;
    const kpi = (k, v, ink = '') => `<div><div style="font-size:14px;color:#A6A6AD;font-weight:600">${k}</div><div style="${BS}font-weight:800;font-size:56px;line-height:1;${ink}">${v}</div></div>`;
    const gfPct = bal.gf + bal.gc ? (bal.gf / (bal.gf + bal.gc) * 100) + '%' : '0%';
    const porCard = por ? mejor({ x: por, porteros: true, titulo: (A.jugadores[por.k] || por).fem ? 'PORTERA DE LA SEMANA' : 'PORTERO DE LA SEMANA', valor: por.pct, fmt: 'pct', texto: dec(por.pct), suf: '%',
      detalle: `${por.par} paradas<br>de ${por.tiros} tiros`, valInk: '#FFFFFF', bg: RED, photoBg: '#A9161E', iniInk: '#FFFFFF', titInk: '#FFFFFF', subInk: '#FFFFFF',
      sub: `#${esc(por.dorsal)} · ${esc(por.equipo)} vs ${esc(por.rival)}`, colW: 140, nameFs: 28, valFs: 76, gap: 16 }) : '';
    const figCard = fig ? mejor({ x: fig, titulo: 'GOLEADOR DEL CLUB', valor: fig.g, fmt: 'int', texto: fig.g, detalle: `${fig.g === 1 ? 'gol' : 'goles'} · ${fig.a} asist.<br>vs ${esc(fig.rival)}`,
      valInk: RED, bg: '#18181B', photoBg: '#26262A', iniInk: '#A6A6AD', titInk: '#A6A6AD', subInk: '#C9C9CE', sub: `#${esc(fig.dorsal)} · ${esc(fig.equipo)}`, colW: 130, nameFs: 30, valFs: 88, gap: 14 }) : '';
    const proxHtml = proximos.map((p, i) => `<div class="prox-fila" style="display:grid;grid-template-columns:1fr 84px 1fr;gap:6px;padding:12px 0;border-bottom:1px solid #26262A;align-items:center">
        <div data-anim="mpInL .55s cubic-bezier(.3,1.3,.5,1) ${i * 160}ms" style="display:flex;flex-direction:column;align-items:center;gap:5px">${disc(p.lc, 52)}<span style="${BS}font-weight:800;font-size:17px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(p.la)}</span></div>
        <div data-anim="mpCrash .45s cubic-bezier(.3,1.4,.5,1) ${420 + i * 160}ms" style="text-align:center"><div style="${BS}font-weight:800;font-size:22px;line-height:1">${esc(p.hora)}</div><div style="font-size:12px;color:#A6A6AD;margin-top:2px">${p.dia}</div>${p.derbi ? `<div style="display:inline-block;margin-top:5px;font-size:11px;font-weight:700;letter-spacing:.1em;padding:2px 6px;border-radius:3px;background:${RED}">DERBI</div>` : ''}</div>
        <div data-anim="mpInR .55s cubic-bezier(.3,1.3,.5,1) ${i * 160}ms" style="display:flex;flex-direction:column;align-items:center;gap:5px">${disc(p.vc, 52)}<span style="${BS}font-weight:800;font-size:17px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(p.va)}</span></div>
      </div>`).join('');
    // la semana más reciente, con la clasificación oficial de la FMP (la misma de la página de la liga: a veces cuenta un
    // partido que aún no tenemos); las anteriores, como quedaron esa semana
    const clasifSem = l => { const L0 = wi === 0 && lgOf(l.id); return L0 && L0.clasif && L0.clasif.length ? L0.clasif : l.clasif; };
    // las ligas que esa semana aún no habían empezado, sin tabla
    const tablas = w.ligas.filter(l => l.clasif.some(x => x.pj)).map(l => { const antes = antesDe(l.id, wi); return `<div class="card" style="padding:20px 22px">
        ${box(hLg(l.id), 'display:flex;justify-content:space-between;align-items:baseline;width:100%;gap:8px', `<span style="${BS}font-weight:800;font-size:28px">${esc(l.nombre)}</span><span style="font-size:14px;color:#A6A6AD">Ver liga →</span>`)}
        <div data-grupo style="display:flex;flex-direction:column;gap:2px;margin-top:12px">${tableRows(clasifSem(l)).map(r => { const d = antes[r.equipo] ? antes[r.equipo] - r.puesto : 0; return `
          <div class="fila-barra cinco"${swapA(d)} style="${swapS(d, r, 2)}display:grid;grid-template-columns:24px 26px minmax(0,1fr) minmax(40px,120px) 34px;gap:10px;align-items:center;padding:6px 8px;border-radius:6px;background:${r.bg}">
            <span style="font-weight:700;font-size:15px;color:#A6A6AD;text-align:right">${r.puesto}</span>${disc(r.crest, 24)}
            <span style="display:flex;align-items:center;gap:6px;min-width:0"><span style="font-weight:${r.weight};font-size:15px;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.equipo)}</span>${flecha(d)}</span>
            <div class="barra" style="height:6px;background:#26262A;border-radius:3px;overflow:hidden"><div style="height:100%;width:${r.ptsPct};background:${r.bar}"></div></div>
            <span style="${BS}font-weight:800;font-size:20px;text-align:right">${r.pts}</span>
          </div>`; }).join('')}</div>
      </div>`; }).join('');
    return `<div style="display:flex;flex-wrap:wrap;gap:24px 48px;align-items:flex-end;justify-content:space-between;padding:36px 0 28px">
        <div>
          <div style="display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600;color:#A6A6AD">${arrow(older, '‹')}<span style="letter-spacing:.08em">${d1} ${MES[m1 - 1]} – ${d2} ${MES[m2 - 1]} ${y2}</span>${arrow(newer, '›')}</div>
          <h1 class="pt" style="${BS}font-weight:900;font-size:clamp(64px,10vw,120px);line-height:.85;letter-spacing:-.01em;margin-top:14px">SEMANA <span style="color:${RED}">${esc(w.id.split('S')[1])}</span></h1>
        </div>
        <div class="kpis" style="display:flex;gap:12px;flex-wrap:wrap">
          <div style="padding:16px 22px;background:#18181B;border-radius:10px;min-width:96px">${kpi('Partidos', bal.pj)}</div>
          <div style="padding:16px 22px;background:#18181B;border-radius:10px;display:flex;gap:18px">${kpi('V', bal.v, 'color:#3DD27E')}${kpi('E', bal.e)}${kpi('D', bal.d, 'color:#FF5A52')}</div>
          <div style="padding:16px 22px;background:#18181B;border-radius:10px;width:220px">
            <div style="display:flex;justify-content:space-between;font-size:14px;color:#A6A6AD;font-weight:600"><span>A favor</span><span>En contra</span></div>
            <div style="display:flex;justify-content:space-between;${BS}font-weight:800;font-size:56px;line-height:1"><span>${bal.gf}</span><span style="color:#A6A6AD">${bal.gc}</span></div>
            <div style="height:6px;border-radius:3px;overflow:hidden;margin-top:8px;background:#3A3A40"><div style="height:100%;width:${gfPct};background:${RED}"></div></div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:12px">${cards}</div>
      <div class="semana-dest${[porCard, figCard, asisCard, sancCard].some(Boolean) ? '' : ' solo'}">
        ${[porCard, figCard, asisCard, sancCard].some(Boolean) ? `<div class="cuatro">${porCard}${figCard}${asisCard}${sancCard}</div>` : ''}
        <div class="card" style="padding:20px 22px">${lab('PRÓXIMOS PARTIDOS')}<div data-grupo style="display:flex;flex-direction:column;margin-top:8px">${proxHtml}</div></div>
      </div>
      ${wi === 0 ? '<div data-agenda></div>' : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:12px">${tablas}</div>`;
  }

  /* ── 2. Equipos ─────────────────────────────────────────── */
  const FLIP = i => `data-anim="mpFlip .5s cubic-bezier(.2,.8,.2,1) ${i * 70}ms"`;
  function calTile(c, cal, i = 0) {
    if (c.descanso) return `<div ${FLIP(i)}><div style="height:100%;background:#18181B;border:1px solid #26262A;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;align-items:center;opacity:.5">
        <div style="display:flex;justify-content:space-between;width:100%;padding:8px 10px 0;font-size:12px;font-weight:700;color:#A6A6AD"><span>J${c.j}</span><span></span></div>
        <div style="width:64px;height:64px;border-radius:50%;background:#26262A;margin:8px 0 6px;box-shadow:0 0 0 2px #26262A"></div>
        <span style="${BS}font-weight:800;font-size:20px;letter-spacing:.04em;line-height:1;white-space:nowrap">DESCANSA</span>
        <div style="margin-top:10px;width:100%;padding:6px 0;text-align:center;background:#26262A;color:#A6A6AD;${BS}font-weight:800;font-size:20px;line-height:1">—</div></div></div>`;
    const played = !!c.resultado;
    // aplazado: sin jugar y con fecha posterior a la de una jornada siguiente
    const aplazado = !played && c.fecha && (cal || []).some(o => o.j > c.j && o.fecha && o.fecha < c.fecha);
    const col = played ? RES[c.r][1] : (aplazado ? '#FF8A3D' : (c.derbi ? RED : '#26262A'));
    return box(hM(c.mid), `background:#18181B;border:1px solid ${col};border-radius:10px;overflow:hidden;display:flex;flex-direction:column;align-items:center`, `
      <div style="display:flex;justify-content:space-between;width:100%;padding:8px 10px 0;font-size:12px;font-weight:700;color:#A6A6AD"><span>J${c.j}</span><span>${c.casa ? 'CASA' : 'FUERA'}</span></div>
      <div style="width:64px;height:64px;border-radius:50%;margin:8px 0 6px;box-shadow:0 0 0 2px #FFFFFF">${disc(crest(c.rival), 64, 'transparent')}</div>
      <span style="${BS}font-weight:800;font-size:20px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(abr(c.rival))}</span>
      ${aplazado ? '<span style="font-size:11px;font-weight:700;letter-spacing:.06em;color:#FF8A3D;margin-top:3px">APLAZADO</span>' : c.sinActa && played ? '<span style="font-size:11px;font-weight:700;letter-spacing:.04em;color:#FF8A3D;margin-top:3px">ACTA PENDIENTE</span>' : ''}
      <div style="position:relative;margin-top:${aplazado || (c.sinActa && played) ? 4 : 10}px;width:100%;padding:6px 0;text-align:center;background:#26262A;color:#FFFFFF;${BS}font-weight:800;font-size:20px;line-height:1">
        <div data-anim="mpWipe .4s ${350 + i * 70}ms" style="position:absolute;inset:0;background:${col};transform-origin:left"></div><span style="position:relative">${played ? c.resultado.replace('-', '–') : fd(c.fecha).replace(/^\S+ /, '')}</span></div>`, 'div', ' ' + FLIP(i));
  }
  function playerCard(k, temp, o) {   // con los números de esa temporada (o los que se le pasen: los de una liga)
    const p = A.jugadores[k], t = (o && o.t) || (p.temporadas || {})[temp] || {};
    const stat = t.pj ? (t.goles || 0) + ' G · ' + (t.asistencias || 0) + ' A en ' + t.pj + ' PJ' : 'Aún sin jugar';
    return box(hP(k), 'background:#18181B;border-radius:10px;overflow:hidden;display:flex;flex-direction:column', `
      <div class="ini" style="aspect-ratio:4/5;background:#26262A;font-size:48px;color:#55555B">${esc(ini(p.nombre, p.apellidos))}${photo(p.foto)}<span style="position:absolute;left:8px;bottom:6px;${BS}font-weight:900;font-size:40px;line-height:1;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${esc(p.dorsal || '')}</span></div>
      <div style="padding:10px 12px"><div style="font-weight:700;font-size:15px;line-height:1.15">${esc(corto(p))}</div><div style="font-size:13px;color:#A6A6AD;margin-top:2px">${stat}</div>${o && o.otra ? `<div style="font-size:12px;color:#8A8A8F;margin-top:3px">${esc(o.otra)}</div>` : ''}</div>`);
  }
  function vEquipo(id) {
    const e = A.equipos.find(x => x.id === id) || A.equipos[0], L = lgOf(e.ligaId), J = A.jugadores;
    S.eq = e.id;
    const c = e.clas || { puesto: '-', pts: 0, pj: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0 };
    const tabs = A.equipos.map(x => `<a class="blk" href="${hEq(x.id)}"${x.id === e.id ? ' aria-current="page"' : ''} style="padding:10px 18px;border-radius:8px;background:${x.id === e.id ? RED : '#18181B'};color:${x.id === e.id ? '#FFFFFF' : '#C9C9CE'};${BS}font-weight:800;font-size:22px;letter-spacing:.02em">${x.cantera ? tituloOf(x) : x.id}</a>`).join('');
    const proc = e.procTexto && /^Su base/.test(e.procTexto) && e.proc ? e.procTexto.replace(/Alevin\b/, 'Alevín') + ': ' + e.proc : e.proc;   // el Infantil sale del Alevín
    const sub = [proc, e.edad ? 'Edad media ' + dec(e.edad) : null].filter(Boolean).join(' · ') || L.nombre;
    const tiles = [['Puesto', c.puesto + 'º/' + L.clasif.length, RED], ['Puntos', c.pts], ['PJ', c.pj], ['V-E-D', c.v + '-' + c.e + '-' + c.d], ['Goles', c.gf + ':' + c.gc]]
      .map(([k, v, ink]) => `<div style="padding:12px 16px;background:#121214;border-radius:8px;min-width:96px"><div style="font-size:13px;color:#A6A6AD;font-weight:600">${k}</div><div style="${BS}font-weight:800;font-size:36px;line-height:1;color:${ink || '#F4F4F5'}">${v}</div></div>`).join('');
    // jugadores clave: los 5 de la plantilla con más puntos (goles + asistencias) esta temporada, sin porteros; cambia con
    // cada jornada (empate: más goles, menos partidos). Antes de que nadie juegue, los de la temporada pasada
    // en la cantera muchos juegan en Alevín e Infantil: aquí cuentan solo los partidos de esta liga, y los de la otra van aparte
    const ligaDe = (p, lid) => { const xs = (p.partidos || []).filter(x => x.mid.startsWith(lid + '-'));
      return { pj: xs.length, goles: xs.reduce((n, x) => n + (x.g || 0), 0), asistencias: xs.reduce((n, x) => n + (x.a || 0), 0) }; };
    const otraCat = e.cantera && A.equipos.find(x => x.cantera && x.id !== e.id);
    // la temporada pasada de la cantera, también solo en esta categoría (del histórico, que la separa por liga)
    const catRe = e.cantera ? (e.ligaId.startsWith('alevin') ? /ALEV/i : /INFANT/i) : null;
    const histCat = (p, t) => { const hj = H && H.byTok[H.tok(p.nombre + ' ' + p.apellidos)]; if (!hj) return null;
      const rs = hj.temporadas.filter(x => x.temporada === t && ours(x.equipo) && catRe.test(x.liga || ''));
      return { pj: rs.reduce((n, x) => n + (x.pj || 0), 0), goles: rs.reduce((n, x) => n + (x.g || 0), 0), asistencias: rs.reduce((n, x) => n + (x.a || 0), 0) }; };
    const est = (p, t) => (!e.cantera ? (p.temporadas || {})[t] || {} : t === A.temporada ? ligaDe(p, e.ligaId) : histCat(p, t) || (p.temporadas || {})[t] || {}),
      pts = (p, t) => (est(p, t).goles || 0) + (est(p, t).asistencias || 0);
    const enLaOtra = p => { const s2 = otraCat && ligaDe(p, otraCat.ligaId); return s2 && s2.pj ? `Además, con el ${tituloOf(otraCat)}: ${s2.goles} G · ${s2.asistencias} A en ${s2.pj} PJ` : ''; };
    const topDe = t => Object.values(J).filter(p => enEquipo(p, e) && !p.portero && pts(p, t) > 0)
      .sort((a, b) => pts(b, t) - pts(a, t) || (est(b, t).goles || 0) - (est(a, t).goles || 0) || est(a, t).pj - est(b, t).pj || corto(a).localeCompare(corto(b), 'es')).slice(0, 5);
    let tClave = A.temporada, top5 = topDe(tClave);
    if (!top5.length) { tClave = '2025/26'; top5 = topDe(tClave); }
    const clave = top5.map(p => playerCard(p.k, tClave, e.cantera ? { t: est(p, tClave), otra: tClave === A.temporada ? enLaOtra(p) : '' } : null)).join('');
    // 7j · altas desde la izquierda (borde verde) y bajas hacia la derecha (borde rojo), en cascada
    const uniq = (xs, f) => xs.filter((x, i) => xs.findIndex(y => f(y) === f(x)) === i);
    const canteras = A.equipos.filter(x => x.cantera);
    const catsDe = q => { const c = canteras.filter(x => enEquipo(q, x)).map(x => x.ligaId.startsWith('alevin') ? 'Alevín' : 'Infantil'); return c.length > 1 ? c.join(' e ') : c[0] || ''; };
    const lAltas = e.cantera ? uniq(canteras.flatMap(x => x.altas).filter(a => J[a.k] && !(a.desde && ours(a.desde))), a => a.k) : e.altas.filter(a => J[a.k]);
    const lBajas = e.cantera ? uniq(canteras.flatMap(x => x.bajas).filter(b => !(b.destino && ours(b.destino))), b => b.nombre + ' ' + b.apellidos) : e.bajas;
    // de dónde llega cada alta senior: de otro equipo (MP B, KAMIKAZES C…), vuelve al club, vuelve a jugar o debuta
    const vuK = new Set(vuelven(null).map(v => v.j.k));
    const altaTxt = a => a.desde ? 'de ' + a.desde.replace(/^MADRIDPATINA/, 'MP') : vuK.has(a.k) ? 'Vuelve al club'
      : /^Vuelve/.test(a.nota || '') ? 'Vuelve a jugar' : /^Sin partidos senior/.test(a.nota || '') ? 'Debuta en senior' : 'Nuevo';
    const altas = lAltas.map((a, i) => box(hP(a.k), 'display:flex;justify-content:space-between;gap:10px;width:100%;padding:9px 0 9px 10px;border-bottom:1px solid #26262A;box-shadow:inset 3px 0 0 #3DD27E',
      `<span style="font-weight:700">#${esc(J[a.k].dorsal)} ${esc(corto(J[a.k]))}</span><span style="color:#A6A6AD;font-size:14px;text-align:right">${esc(e.cantera ? ['Nuevo', catsDe(J[a.k])].filter(Boolean).join(' · ') : altaTxt(a))}</span>`, 'div', ` data-anim="mpInL .45s cubic-bezier(.2,.8,.2,1) ${150 + i * 110}ms"`)).join('');
    const bajas = lBajas.map((b, i) => `<div data-anim="mpInR .45s cubic-bezier(.2,.8,.2,1) ${250 + i * 110}ms" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:9px 10px 9px 0;border-bottom:1px solid #26262A;box-shadow:inset -3px 0 0 #FF5A52;align-items:center">
        <div style="min-width:0"><div style="font-weight:700">#${esc(b.dorsal)} ${esc(corto(b))}</div><div style="color:#A6A6AD;font-size:14px">${esc(b.destino ? '→ ' + b.destino + (b.destinoLiga ? ' · ' + b.destinoLiga : '') : 'Sin equipo esta temporada')}</div></div>
        ${b.pct != null ? `<div style="text-align:right"><div style="${BS}font-weight:800;font-size:22px;line-height:1">${dec(b.pct)}%</div><div style="font-size:12px;color:#A6A6AD">de los puntos</div></div>` : '<span></span>'}</div>`).join('');
    const h2h = e.h2h.filter(h => !ours(h.rival)).sort((a, b) => (b.v + b.e + b.d) - (a.v + a.e + a.d));
    const h2hHtml = h2h.map((h, i) => { const t = tramos(h, i); return `<div class="fila-barra"${t.fila} style="--c1:28px;display:grid;grid-template-columns:28px minmax(0,1fr) minmax(80px,280px) 90px;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid #26262A">
        ${disc(crest(h.rival), 26)}<span style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.rival)}</span>
        <div class="barra" style="display:flex;height:10px;border-radius:3px;overflow:hidden;background:#26262A">${t.barra}</div>
        <span${t.bal} style="text-align:right;${BS}font-weight:800;font-size:20px">${h.v}-${h.e}-${h.d}</span></div>`; }).join('');
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:28px">${tabs}</div>
      <div style="margin-top:16px;border-radius:14px;overflow:hidden;background:#18181B">
        <div style="display:flex;flex-wrap:wrap;align-items:stretch">
          <div class="eq-kit" style="background:${e.kit[0]};color:${e.kit[1]};padding:24px 28px;min-width:200px;display:flex;flex-direction:column;justify-content:space-between;gap:12px">
            <img src="escudos/badge/madridpatina.webp" alt="" style="width:52px;height:52px;object-fit:contain;border-radius:50%;box-shadow:0 0 0 2px #FFFFFF">
            <div style="${BS}font-weight:900;font-size:120px;line-height:.8">${letraOf(e)}</div>
          </div>
          <div style="flex:1;min-width:260px;padding:24px 28px;display:flex;flex-direction:column;gap:18px">
            <div>
              ${lab(esc(e.liga.toUpperCase()))}
              <h1 class="pt" style="${BS}font-weight:900;font-size:clamp(40px,6vw,64px);line-height:.95">${esc(tituloOf(e).toUpperCase())}</h1>
              <div style="font-size:15px;color:#C9C9CE;margin-top:6px">${esc(sub)}</div>
            </div>
            <div class="kpis" style="display:flex;flex-wrap:wrap;gap:10px">${tiles}</div>
          </div>
        </div>
      </div>
      ${lab('CALENDARIO · ' + e.cal.length + ' JORNADAS', 'margin:28px 0 10px')}
      <div class="cal-grid" data-grupo style="display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px">${e.cal.map((c, i) => calTile(c, e.cal, i)).join('')}</div>
      <div data-agenda-eq="${esc(e.id)}"></div>
      ${(() => { const jug = e.cal.filter(c => c.mid && A.partidos[c.mid]).reverse();
        return jug.length ? `${lab('PARTIDOS JUGADOS · ' + A.temporada + ' · ' + jug.length, 'margin:28px 0 10px')}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr));gap:12px;align-items:start">${jug.map(c => { const pen = A.partidos[c.mid].pen;   // empate decidido en los penaltis
          const r = c.r === 'E' && pen ? (pen === e.nombre ? ['GANA EN PENALTIS', '#1A7A43'] : ['PIERDE EN PENALTIS', '#55555B']) : RES[c.r] || ['', '#2E2E33'];
          return `<div class="card" style="overflow:hidden">
            ${box(hM(c.mid), 'display:flex;align-items:center;gap:12px;padding:14px 18px', `${disc(crest(c.rival), 36)}
              <div style="flex:1;min-width:0"><div style="font-size:13px;color:#A6A6AD;font-weight:600">J${c.j} · ${c.casa ? 'En casa' : 'Fuera'} · ${fd(c.fecha)}</div><div style="font-weight:700;font-size:15px">${esc(c.rival)}</div></div>
              <div style="text-align:right"><div style="${BS}font-weight:800;font-size:32px;line-height:1">${esc((c.resultado || '').replace('-', '–'))}</div><div style="font-size:11px;font-weight:700;letter-spacing:.06em;padding:2px 6px;border-radius:3px;background:${r[1]};color:#fff;margin-top:4px;display:inline-block">${r[0]}</div></div>`)}
            ${actaMini(A.partidos[c.mid], e.nombre)}</div>`; }).join('')}</div>` : ''; })()}
      <div data-analisis="${esc(e.id)}"></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:12px;margin-top:28px">
        <div>${lab('JUGADORES CLAVE · ' + tClave, 'margin-bottom:10px')}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">${clave}</div>
          <a href="${hLg(e.ligaId, 'mapa')}" style="display:inline-block;margin-top:12px;font-size:14px;font-weight:700">Ver a nuestros jugadores en el mapa de la liga →</a>
          <div data-perfiles data-liga="${esc(e.ligaId)}" data-equipo="${esc(e.nombre)}"></div></div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="card" data-grupo style="padding:18px 20px"><div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#3DD27E">${e.cantera ? 'ALTAS EN LA CANTERA' : 'ALTAS'} · ${lAltas.length}</div>${e.cantera ? '<div style="font-size:13px;color:#A6A6AD;margin-top:4px">Alevín e Infantil juntos, porque muchos juegan en los dos. Solo los que llegan nuevos al club.</div>' : ''}${altas}</div>
          <div class="card" data-grupo style="padding:18px 20px"><div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#FF5A52">${e.cantera ? 'BAJAS DE LA CANTERA' : 'BAJAS'} · ${lBajas.length}</div>${e.cantera ? '<div style="font-size:13px;color:#A6A6AD;margin-top:4px">Los que jugaron en la cantera la temporada pasada y ya no están en ningún equipo del club.</div>' : ''}${bajas}</div>
        </div>
      </div>
      ${h2h.length ? `${lab('CARA A CARA CON LOS RIVALES DE LA LIGA · HISTÓRICO', 'margin:28px 0 10px')}
        <div class="card" data-grupo style="padding:10px 20px">${h2hHtml}
          <div style="display:flex;gap:16px;font-size:13px;color:#A6A6AD;padding:10px 0 6px"><span><span style="color:#1E8A4C">■</span> Victorias</span><span><span style="color:#8A8A8F">■</span> Empates</span><span><span style="color:#55555B">■</span> Derrotas</span></div></div>` : ''}`;
  }

  /* ── 3. Ligas ───────────────────────────────────────────── */
  function vLiga(id, sub, jn) {
    const L = lgOf(id) || A.ligas[0];
    S.lg = L.id;
    const jsel = jn && jn >= 1 && jn <= L.total ? jn : L.ultima;
    const J0 = L.jornadas.find(j => j.n === jsel) || { partidos: [] };
    const hasPre = !!L.pre, lt = sub === 'mapa' || sub === 'todas' ? 'mapa' : sub === 'evolucion' ? 'evolucion' : 'tabla';
    const tabs = A.ligas.map(l => `<a class="blk" href="${hLg(l.id)}"${l.id === L.id ? ' aria-current="page"' : ''} style="padding:10px 18px;border-radius:8px;background:${l.id === L.id ? RED : '#18181B'};color:${l.id === L.id ? '#FFFFFF' : '#C9C9CE'};font-weight:700;font-size:15px;white-space:nowrap">${esc(l.nombre)}</a>`).join('');
    const subs = [['tabla', 'Clasificación y jornadas', hLg(L.id)], ['evolucion', 'Evolución', hLg(L.id, 'evolucion')], ['mapa', 'Mapa de jugadores', hLg(L.id, 'mapa')]].concat(hasPre ? [['llega', 'Pretemporada', hPre(L.id)]] : [])
      .map(([k, l, h]) => `<a class="blk" href="${h}" style="padding:12px 16px;font-weight:700;font-size:15px;white-space:nowrap;color:${lt === k ? '#F4F4F5' : '#A6A6AD'};border-bottom:3px solid ${lt === k ? RED : 'transparent'};margin-bottom:-1px">${l}</a>`).join('');
    let body;
    if (lt === 'mapa') body = vMapa(L, sub === 'todas');
    else if (lt === 'evolucion') body = vEvolucion(L);
    else if (lt === 'tabla') {
      const antes = antesDe(L.id, 0);
      const rows = tableRows(L.clasif).map(r => { const d = antes[r.equipo] ? antes[r.equipo] - r.puesto : 0; return `<div class="cl-fila"${swapA(d)} style="${swapS(d, r, 0)}display:grid;grid-template-columns:26px 26px minmax(0,1fr) 30px 30px 30px 30px 44px 44px;gap:8px;align-items:center;padding:8px;border-radius:6px;background:${r.bg};font-size:15px">
          <span style="font-weight:700;color:#A6A6AD;text-align:right">${r.puesto}</span>${disc(r.crest, 24)}
          <span style="display:flex;align-items:center;gap:6px;min-width:0">${box(hT(r.equipo), `min-width:0;font-weight:${r.weight};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`, ours(r.equipo) && abr(r.equipo) !== 'MP' ? `<span class="nm-largo">${esc(r.equipo)}</span><span class="nm-corto">${esc(abr(r.equipo))}</span>` : esc(r.equipo), 'span')}${flecha(d)}</span>
          <span style="text-align:center">${r.pj}</span><span class="ved" style="text-align:center">${r.v}</span><span class="ved" style="text-align:center">${r.e}</span><span class="ved" style="text-align:center">${r.d}</span><span style="text-align:center;color:#C9C9CE">${r.dg}</span>
          <span style="text-align:right;${BS}font-weight:800;font-size:22px">${r.pts}</span></div>`; }).join('');
      // todas las jornadas se abren: las jugadas con resultado y las que faltan con su fecha y hora
      const strip = Array.from({ length: L.total }, (_, i) => { const n = i + 1, has = L.jornadas.some(j => j.n === n);
        const st = `flex:none;width:40px;height:40px;border-radius:6px;display:grid;place-items:center;${BS}font-weight:800;font-size:18px;background:${n === jsel ? RED : (has ? '#26262A' : 'transparent')};color:${n === jsel || has ? '#F4F4F5' : '#A6A6AD'};border:1px solid ${n === jsel ? RED : '#26262A'}`;
        return `<a class="blk" href="${hLg(L.id, 'j/' + n)}" aria-label="Jornada ${n}"${n === jsel ? ' aria-current="page"' : ''} style="${st}">${n}</a>`; }).join('');
      const partidos = J0.partidos.map(m => box(hM(m.mid), `display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;width:100%;padding:12px 8px;border-radius:8px;background:${m.nuestro ? '#2A1416' : 'transparent'};border-bottom:1px solid #26262A`, `
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px"><span style="${BS}font-weight:800;font-size:19px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(abr(m.local))}</span>${disc(crest(m.local), 44)}</div>
          <span style="text-align:center;${BS}font-weight:800;font-size:28px;line-height:1;min-width:70px;white-space:nowrap">${m.gl != null ? (m.pen && m.pen === m.local ? bPen() : '') + m.gl + '–' + m.gv + (m.pen && m.pen === m.visitante ? bPen() : '') : fd(m.fecha)}</span>
          <div style="display:flex;align-items:center;gap:10px">${disc(crest(m.visitante), 44)}<span style="${BS}font-weight:800;font-size:19px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(abr(m.visitante))}</span></div>`)).join('')
        + (L.cal || []).filter(c => c.j === jsel && (c.gl == null || c.sinActa) && !J0.partidos.some(m => m.local === c.local && m.visitante === c.visitante))
          .sort((a, b) => ((a.fecha || '9') + (a.hora || '')) < ((b.fecha || '9') + (b.hora || '')) ? -1 : 1)
          .map(c => `<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;width:100%;padding:12px 8px;border-radius:8px;background:${ours(c.local) || ours(c.visitante) ? '#2A1416' : 'transparent'};border-bottom:1px solid #26262A">
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px"><span style="${BS}font-weight:800;font-size:19px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(abr(c.local))}</span>${disc(crest(c.local), 44)}</div>
          ${c.sinActa && c.gl != null ? `<span style="text-align:center;min-width:70px;line-height:1.1"><span style="display:block;${BS}font-weight:800;font-size:28px;white-space:nowrap">${c.gl}–${c.gv}</span><span style="font-size:11px;font-weight:700;letter-spacing:.04em;color:#FF8A3D;white-space:nowrap">Acta pendiente de la FMP</span></span>`
            : `<span style="text-align:center;min-width:70px;line-height:1.15"><span style="display:block;${BS}font-weight:800;font-size:17px;white-space:nowrap">${c.fecha ? esc(fd(c.fecha)) : 'Fecha por fijar'}</span>${c.fecha && c.fecha < hoyISO()
              ? '<span style="font-size:11px;font-weight:700;letter-spacing:.04em;color:#FF8A3D;white-space:nowrap">Sin resultado de la FMP</span>'   // ya pasó la fecha: aplazado o sin resultado
              : `<span style="font-size:13px;color:#A6A6AD;white-space:nowrap">${esc(c.hora || 'hora por fijar')}</span>`}</span>`}
          <div style="display:flex;align-items:center;gap:10px">${disc(crest(c.visitante), 44)}<span style="${BS}font-weight:800;font-size:19px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(abr(c.visitante))}</span></div></div>`).join('');
      const enJor = new Set((L.cal || []).filter(c => c.j === jsel).flatMap(c => [c.local, c.visitante]));
      const descansa = L.clasif.map(r => r.equipo).filter(n => enJor.size && !enJor.has(n));
      const lid = L.lideres;
      const ldrFila = (x, f, attrs = '') => box(hP(kOf(x.nombre, x.apellidos)), `display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;padding:8px 6px;border-radius:6px;background:${x.nuestro ? '#2A1416' : 'transparent'}`, `
          ${disc(crest(x.equipo), 22)}<div style="min-width:0"><div style="font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">#${esc(x.dorsal)} ${esc(corto(x))}</div><div style="font-size:13px;color:#A6A6AD">${esc(x.equipo)}</div></div>
          <span style="${BS}font-weight:800;font-size:26px;color:${x.nuestro ? '#FF6B63' : '#F4F4F5'}">${esc(f(x))}</span>`, 'div', attrs);
      // 7o · podio 2º-1º-3º: las columnas se levantan de 3º a 1º y el escudo «choca» al llegar
      const podio = (arr, f) => { const mx = Math.max(1, ...arr.slice(0, 3).map(f));
        return `<div data-grupo style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:end;margin:6px 0 8px">${[1, 0, 2].map(k => { const x = arr[k], d = [2, 1, 0][k] * 250 + 100;
          return box(hP(kOf(x.nombre, x.apellidos)), 'display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0', `
            <div data-anim="mpCrash .45s ${d + 500}ms">${disc(crest(x.equipo), 46, x.nuestro ? RED : '#FFFFFF')}</div>
            <div data-anim="mpFade .3s ${d + 500}ms" style="text-align:center;min-width:0;max-width:100%"><div style="font-weight:700;font-size:13px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(corto(x))}</div><div style="font-size:11px;color:#A6A6AD;white-space:nowrap">${esc(abr(x.equipo))}</div></div>
            <div data-anim="mpRise .6s cubic-bezier(.3,1.2,.5,1) ${d}ms" style="width:100%;height:${Math.round(70 + f(x) / mx * 90)}px;border-radius:8px 8px 0 0;background:${k === 0 ? RED : '#26262A'};display:flex;flex-direction:column;align-items:center;padding-top:8px;transform-origin:bottom">
              <span style="${BS}font-weight:900;font-size:40px;line-height:1">${esc(f(x))}</span><span style="font-size:11px;font-weight:700;opacity:.8">${k + 1}º</span></div>`); }).join('')}</div>`; };
      const ldr = (titulo, arr, f, conPodio) => { arr = arr || []; const pod = conPodio && arr.length >= 3;
        return `<div class="card" style="padding:16px 18px">${lab(titulo, 'margin-bottom:6px')}${pod ? podio(arr, f) : ''}${arr.slice(pod ? 3 : 0, 5).map(x => ldrFila(x, f, pod ? ' data-anim="mpFade .3s 1.1s"' : '')).join('')}</div>`; };
      body = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:12px;margin-top:20px;align-items:start">
          <div class="card" style="padding:16px 18px;overflow-x:auto"><div class="cl-in" data-grupo style="min-width:480px">
            <div class="cl-fila" style="display:grid;grid-template-columns:26px 26px minmax(0,1fr) 30px 30px 30px 30px 44px 44px;gap:8px;font-size:13px;font-weight:700;color:#A6A6AD;padding:4px 8px 8px;border-bottom:1px solid #26262A">
              <span></span><span></span><span>Equipo</span><span style="text-align:center">PJ</span><span class="ved" style="text-align:center">V</span><span class="ved" style="text-align:center">E</span><span class="ved" style="text-align:center">D</span><span style="text-align:center">DG</span><span style="text-align:right">PTS</span></div>
            ${rows}</div></div>
          <div class="card" style="padding:16px 18px">
            <div style="display:flex;gap:4px;overflow-x:auto;padding-bottom:8px">${strip}</div>
            ${lab('JORNADA ' + jsel, 'margin:10px 0 4px')}${partidos || '<div style="padding:12px 0;color:#A6A6AD">Sin partidos en el calendario.</div>'}
            ${descansa.length ? `<div style="font-size:13px;color:#A6A6AD;padding:10px 8px 2px">Descansa: <b style="color:#C9C9CE">${descansa.map(esc).join(', ')}</b></div>` : ''}
          </div>
        </div>
        ${lid ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;margin-top:12px">
          ${ldr('GOLEADORES', lid.goleadores, x => x.goles, true)}${ldr('ASISTENCIAS', lid.asistentes, x => x.asistencias)}${ldr('PORTEROS · % PARADAS', lid.porteros, x => dec(x.pct_paradas))}${lid.sancionados && lid.sancionados.length ? ldr('MÁS MINUTOS DE SANCIÓN', lid.sancionados, x => fmin(x.minutos)) : ''}</div>` : ''}`;
    }
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:28px">${tabs}</div>
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px;margin-top:24px">
        <h1 class="pt" style="${BS}font-weight:900;font-size:clamp(48px,7vw,84px);line-height:.9">${esc(L.nombre)}</h1>
        <div style="font-size:15px;color:#A6A6AD;font-weight:600">Jornada ${L.ultima} de ${L.total} · ${L.clasif.length} equipos</div>
      </div>
      <div style="display:flex;gap:4px;margin-top:18px;border-bottom:1px solid #26262A">${subs}</div>
      ${body}`;
  }
  // ── Pretemporada · nuestro club: todos los movimientos de MADRIDPATINA en las ligas en las que jugamos ──
  const mpLbl = (nombre, liga) => { if (!ours(nombre)) return nombre; const l = (liga || '').toLowerCase();
    if (nombre !== 'MADRIDPATINA') return 'MP ' + nombre.split(' ').pop(); return /alev/.test(l) ? 'MP Alevín' : /infant/.test(l) ? 'MP Infantil' : 'MP'; };
  const mpRango = l => ({ 'MP A': 1, 'MP B': 2, 'MP C': 3, 'MP D': 4, 'MP Infantil': 5, 'MP Alevín': 6 })[l] || 9;
  // tipo de alta: cambio dentro del club (sube/baja), vuelve, llega de otro club o debuta
  const tipoAlta = (x, equipo, liga) => {
    if (x.desde && ours(x.desde) && ours(equipo)) { const de = mpLbl(x.desde, x.desdeLiga), a = mpLbl(equipo, liga); if (de === a) return ['club', 'mismo equipo', '#8A8A8F']; return mpRango(a) < mpRango(de) ? ['sube', '↑ sube de ' + de, '#3DD27E'] : ['baja', '↓ baja de ' + de, '#FF8A3D']; }
    if (x.desde && x.desde.split(' ')[0] === equipo.split(' ')[0]) return ['club', 'mismo club', '#8A8A8F'];
    if (/^Vuelve/i.test(x.nota || '')) return ['vuelve', 'vuelve', '#6FB7FF'];
    if (x.desde) return ['fuera', 'de otro club', '#C9A7F5'];
    return ['debuta', 'debuta', '#FF6B63'];
  };
  // 7b · escalera de ligas: los recuadros con la liga del año pasado; los que se van suben/bajan en L y quedan atenuados;
  // los que llegan entran en vertical desde su liga de origen; al final, sello ↓ ↑ ★. Solo si en la liga hubo ascensos o descensos.
  function escalera(L) {
    const P = L.pre, T = { baja: ['↓', '#FF8A3D'], sube: ['↑', '#3DD27E'], nuevo: ['★', RED] };
    const stay = P.equipos.filter(e => !T[e.tipo]), arrNew = P.equipos.filter(e => e.tipo === 'nuevo'), arrUp = P.equipos.filter(e => e.tipo === 'sube'), arrDown = P.equipos.filter(e => e.tipo === 'baja');
    const upGo = (P.fuera || []).filter(f => /sube/i.test(f.que_paso || '')), downGo = (P.fuera || []).filter(f => /baja/i.test(f.que_paso || ''));
    if (!arrUp.length && !arrDown.length && !upGo.length && !downGo.length) return '';
    const nom = L.nombre.replace(/^Liga\s+/i, ''), n = +((nom.match(/(\d+)\s*$/) || [])[1] || 0), base = nom.replace(/\s*\d+\s*$/, '');
    const destino = (lista, def) => { const m = lista.length && (lista[0].que_paso || '').match(/\ba\s+(.+)$/i); return m ? m[1] : def; };
    const arriba = destino(upGo, n ? base + ' ' + (n - 1) : 'Arriba'), abajo = destino(downGo, n ? base + ' ' + (n + 1) : 'Abajo');
    const RD = 67, PAD = 8, FW = Math.min(anchoUtil(20), 560), USE = FW - 58 - 8 - 2 * PAD;
    const ordenB = stay.concat(arrNew, arrUp, arrDown), N = ordenB.length, SL = Math.min(36, Math.floor((USE + 5) / Math.max(N, 1))), CZ = SL - 5;
    const x0 = PAD + Math.round((USE - (N * SL - 5)) / 2), xc = k => x0 + k * SL;
    const nArr = arrNew.length + arrUp.length + arrDown.length, firstArr = N - nArr;
    const ficha = (c, ring, x, dy, dx, anim, z, tag, tagBg, tagMs) => `<div data-anim="${anim}" style="position:absolute;left:${x}px;top:50%;margin-top:${-CZ / 2}px;width:${CZ}px;height:${CZ}px;border-radius:50%;box-shadow:0 0 0 2px ${ring};${c ? `background:url('${esc(c)}') center/contain no-repeat;` : 'background:#26262A;'}--dy:${dy}px;--dx:${dx}px;z-index:${z}">${tag ? `<span data-anim="mpTagIn .35s ${tagMs}ms" style="position:absolute;right:-5px;top:-5px;width:16px;height:16px;border-radius:50%;background:${tagBg};font-size:10px;font-weight:900;color:#fff;display:grid;place-items:center">${tag}</span>` : ''}</div>`;
    const centro = ordenB.map((e, k) => { const t = T[e.tipo], ring = e.nuestro ? RED : '#FFFFFF';
      if (!t) return ficha(crest(e.equipo), ring, xc(k), 0, 0, `mpUp .35s ${200 + k * 40}ms`, 2);
      const i = k - firstArr, dl = 2450 + i * 160, dy = e.tipo === 'baja' ? -RD : e.tipo === 'sube' ? RD : 0;
      return ficha(crest(e.equipo), ring, xc(k), dy, 0, e.tipo === 'nuevo' ? `mpTagIn .5s ${dl}ms` : `mpDrop 1500ms cubic-bezier(.45,0,.4,1) ${dl}ms`, 3, t[0], t[1], dl + (e.tipo === 'nuevo' ? 500 : 1500) + 60); });
    let slot = 0;
    const salen = (lista, dy, signo) => lista.map((f, j) => { const xf = PAD + j * SL, xs = xc(firstArr + (slot++ % Math.max(1, nArr))), dl = 800 + (slot - 1) * 140;
      return ficha(f.escudo || crest(f.equipo), '#55555B', xf, dy, xs - xf, `mpLeave 1s ease-in-out ${dl}ms`, 1, signo, '#55555B', dl + 1060); });
    const fila = (liga, items, h, central) => `<div style="display:grid;grid-template-columns:58px minmax(0,1fr);gap:8px;align-items:center;margin-bottom:8px">
        <div data-anim="mpUp .4s" style="text-align:right;${BS}font-weight:800;font-size:${central ? 19 : 16}px;color:${central ? '#F4F4F5' : '#8A8A8F'};line-height:1;white-space:nowrap">${esc(liga)}</div>
        <div style="position:relative;height:${h}px"><div data-anim="mpBox .4s cubic-bezier(.2,.8,.2,1)" style="position:absolute;inset:0;border:1px solid ${central ? RED : '#26262A'};border-radius:10px;background:${central ? '#121214' : 'transparent'}"></div>${items.join('')}</div></div>`;
    return `<div data-grupo style="max-width:${FW}px;margin:14px auto 8px">${fila(arriba, salen(upGo, RD, '↑'), 54)}${fila(nom, centro, 64, true)}${fila(abajo, salen(downGo, -RD, '↓'), 54)}</div>`;
  }
  // 7q · movimientos entre equipos: cada jugador sale de su equipo de 2025/26 y viaja en línea recta al de 2026/27; al final
  // los que llegaron suben a ocupar el hueco. Gris: entre nuestros equipos · verde: llega de otro club · rojo: se va a otro club.
  const quien = x => [x.k, ((x.nombre || '') + ' ' + (x.apellidos || '')).trim().toLowerCase()].filter(Boolean);
  function tablero(vistos) {
    const sen = A.equipos.filter(e => !e.cantera), ids = sen.map(e => e.id), OUT = sen.length, moves = [];
    const nom = (a, b) => ((a || '').split(' ')[0] + ' ' + (b || '').split(' ')[0]).trim();
    sen.forEach((e, di) => (e.altas || []).forEach(a => { const j = A.jugadores[a.k] || {};
      const from = a.desde && ours(a.desde) ? ids.indexOf(a.desde.split(' ').pop()) : a.desde ? OUT : -1;
      if (from >= 0) { moves.push({ from, to: di, nombre: nom(j.nombre, j.apellidos), foto: j.foto, tipo: from === OUT ? 'in' : 'int' }); quien({ k: a.k, ...j }).forEach(q => vistos.add(q)); } }));
    sen.forEach((e, fi) => (e.bajas || []).forEach(b => { if (b.destino && !ours(b.destino)) { moves.push({ from: fi, to: OUT, nombre: nom(b.nombre, b.apellidos), foto: b.foto, tipo: 'out' }); quien(b).forEach(q => vistos.add(q)); } }));
    if (!moves.length) return '';
    const BW = anchoUtil(16), NARROW = BW < 760;
    const dep = {}, arr = {}; moves.forEach(m => { dep[m.from] = (dep[m.from] || 0) + 1; arr[m.to] = (arr[m.to] || 0) + 1; });
    const cols = sen.map(e => ({ t: 'MP ' + e.id, sub: e.liga.replace(/^Liga\s+/i, ''), c: 'escudos/badge/madridpatina.webp' })).concat([{ t: 'OTROS CLUBES', sub: '', c: '' }]);
    let cajas, pos, HH, chipW;
    if (!NARROW) {
      const GAP = 14, CW = Math.floor((BW - (cols.length - 1) * GAP) / cols.length), Y0 = 56, SL = 38;
      const depMax = Math.max(1, ...Object.values(dep)), arrMax = Math.max(1, ...Object.values(arr)), YA = Y0 + depMax * SL + 14;
      chipW = CW - 16; HH = Math.max(220, YA + arrMax * SL + 4);
      cajas = cols.map((c, i) => [c, i * (CW + GAP), 0, CW, HH]);
      pos = { ini: (k, sl) => [k * (CW + GAP) + 8, Y0 + sl * SL], fin: (k, sl) => [k * (CW + GAP) + 8, YA + sl * SL], arriba: (k, sl) => Y0 + sl * SL };
    } else {   // móvil: los equipos son filas (cabecera + líneas de 38 px; 3 jugadores por línea, 2 en pantallas estrechas para que se lea el nombre)
      const NL = BW < 420 ? 2 : 3, LH = 38, HDR = 48, lin = k => Math.ceil((dep[k] || 0) / NL), RH = k => HDR + Math.max(1, lin(k) + Math.ceil((arr[k] || 0) / NL)) * LH + 8;
      chipW = Math.floor((BW - 16 - (NL - 1) * 6) / NL);
      const RY = []; let y = 0; cols.forEach((c, k) => { RY[k] = y; y += RH(k) + 10; }); HH = y - 10;
      cajas = cols.map((c, k) => [c, 0, RY[k], BW, RH(k)]);
      const p = (k, l, sl) => [8 + (sl % NL) * (chipW + 6), RY[k] + HDR + (l + Math.floor(sl / NL)) * LH];
      pos = { ini: (k, sl) => p(k, 0, sl), fin: (k, sl) => p(k, lin(k), sl), arriba: (k, sl) => p(k, 0, sl)[1] };
    }
    const si = {}, ei = {}, tEnd = 1200 + (moves.length - 1) * 320 + 900 + 500;
    const chips = moves.map((m, i) => { const a = (si[m.from] = (si[m.from] || 0) + 1) - 1, b = (ei[m.to] = (ei[m.to] || 0) + 1) - 1;
      const [sx, sy] = pos.ini(m.from, a), [ex, ey] = pos.fin(m.to, b), fy = pos.arriba(m.to, b);
      return `<div data-anim="mpFade .35s ${a * 60 + m.from * 40}ms, mpArc .9s ease-in-out ${1200 + i * 320}ms, mpShift .6s cubic-bezier(.3,1.2,.5,1) ${tEnd}ms forwards" style="position:absolute;left:0;top:0;width:${chipW}px;height:32px;display:flex;align-items:center;gap:7px;padding:0 10px 0 3px;border-radius:999px;background:${m.tipo === 'out' ? '#3A1215' : m.tipo === 'in' ? '#12301F' : '#26262A'};box-shadow:0 6px 16px rgba(0,0,0,.45);--sx:${sx}px;--sy:${sy}px;--ex:${ex}px;--ey:${ey}px;--fy:${fy}px;z-index:${10 + i}">
        <div style="width:26px;height:26px;border-radius:50%;flex:none;background:#26262A${m.foto ? ` url('${esc(m.foto)}') 50% 15%/cover no-repeat` : ''};filter:grayscale(1)"></div>
        <div style="min-width:0;flex:1;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.nombre)}</div></div>`; }).join('');
    const cajasHtml = cajas.map(([c, x, y, w, h]) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:12px;background:#121214;border:1px solid #26262A;overflow:hidden">
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #26262A">${c.c ? `<div style="width:28px;height:28px;flex:none;border-radius:50%;box-shadow:0 0 0 2px #FFFFFF;background:url('${c.c}') center/contain no-repeat"></div>` : ''}<span style="${BS}font-weight:900;font-size:${c.c ? 22 : 18}px;line-height:1;white-space:nowrap;color:${c.c ? '#F4F4F5' : '#A6A6AD'}">${c.t}</span><span style="margin-left:auto;font-size:11px;font-weight:700;color:#A6A6AD;white-space:nowrap">${esc(c.sub)}</span></div></div>`).join('');
    return `${lab('MOVIMIENTOS ENTRE EQUIPOS SENIOR · ' + moves.length, 'margin:28px 0 10px')}
      <div class="card" style="padding:16px;overflow:hidden"><div data-grupo style="position:relative;width:${BW}px;max-width:100%;height:${HH}px">${cajasHtml}${chips}</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:#A6A6AD;padding-top:12px"><span><span style="color:#8A8A8F">●</span> Entre nuestros equipos</span><span><span style="color:#3DD27E">●</span> Llega de otro club</span><span><span style="color:#FF5A52">●</span> Se va a otro club</span></div></div>`;
  }
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
  // 16 tiras anidadas (cada una hija de la anterior, desde la derecha) con su copia del papel: al rasgar se doblan hacia ti
  function tirasResguardo(papel) {
    const W = 184, N = 16, w = W / N, TOT = 78;
    const ANG = Array.from({ length: N }, (_, k) => k === 0 ? 0 : TOT * 2 * k / (N * (N - 1)));
    const CUM = ANG.reduce((acc, a, k) => (acc.push((acc[k - 1] || 0) + a), acc), []);
    const sh = k => (CUM[Math.min(k, N - 1)] / TOT * 0.24).toFixed(3);
    let html = '';
    for (let k = N - 1; k >= 0; k--) {
      const rad = k === 0 ? '0 0 12px 0' : k === N - 1 ? '0 0 0 12px' : '0';
      html = `<div class="tira${k === 0 ? ' t0' : ''}"${k === 1 ? ' aria-hidden="true"' : ''} style="--a:${ANG[k].toFixed(2)}deg;--dIn:${k * 14}ms;--dOut:${(N - k) * 8}ms"><div class="recorte" style="border-radius:${rad}">${papel(W - (k + 1) * w)}<div class="sombra" style="background:linear-gradient(to left,rgba(0,0,0,${sh(k)}),rgba(0,0,0,${sh(k + 1)}))"></div>${k === 0 ? '<div class="muesca" style="right:-8px"></div>' : ''}${k === N - 1 ? '<div class="muesca" style="left:-8px"></div>' : ''}</div>${html}</div>`;
    }
    return html;
  }
  function billete(v, i) {
    const j = v.j, d2 = 950 + i * 220, d4 = 1400 + i * 220, d5 = 2050 + i * 220, t = equiposDe(j)[0];
    const papel = x => `<div class="papel" style="left:${-x}px"><div style="font-size:10px;font-weight:700;letter-spacing:.14em">BILLETE DE VUELTA</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:4px;${BS}font-weight:900;font-size:22px;line-height:1">
        <span data-anim="mpYear .3s ${d2}ms">${esc(v.ultima)}</span><div style="position:relative;flex:1;height:10px"><div data-anim="mpRoute .7s ease-in-out ${d4}ms" style="position:absolute;left:0;right:0;top:4px;height:2px;background:#0D0D0E;transform-origin:left"></div><div data-anim="mpTravel .7s ease-in-out ${d4}ms" style="position:absolute;top:0;width:10px;height:10px;border-radius:50%;background:#0D0D0E"></div></div><span data-anim="mpYear .3s ${d5}ms">${esc(A.temporada.slice(2))}</span></div>
      <div data-anim="mpYear .3s ${d5}ms" style="font-size:11px;font-weight:600;margin-top:6px;line-height:1.3">${esc(v.ticket)}</div></div>`;
    return `<div class="billete" data-grupo>
      <div class="giro" data-anim="mpFlipIn .9s cubic-bezier(.3,1.1,.5,1) ${i * 220}ms">
        <div class="reverso"><div style="width:84px;height:84px;border-radius:50%;box-shadow:0 0 0 3px #FFFFFF;background:url('escudos/badge/madridpatina.webp') center/contain no-repeat"></div><div style="${BS}font-weight:900;font-size:26px;letter-spacing:.06em;color:#FFFFFF">↩ DE VUELTA</div></div>
        <div class="anverso">
          ${box(hP(j.k), 'display:block;position:relative;border-radius:12px 12px 4px 4px;overflow:hidden;background:#18181B', `
            <div class="ini" style="aspect-ratio:4/5;background:#26262A;font-size:52px;color:#55555B">${esc(ini(j.nombre, j.apellidos))}${photo(j.foto)}<span style="position:absolute;right:8px;bottom:4px;${BS}font-weight:900;font-size:40px;line-height:1;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${esc(j.dorsal || '')}</span></div>
            <div style="padding:10px 12px"><div style="font-weight:700;font-size:15px;line-height:1.15">${esc(corto(j))}</div><div style="font-size:12px;color:#A6A6AD">${esc(t ? 'MP ' + letraOf(t) : j.equipo)}${j.edad ? ' · ' + j.edad + ' años' : ''}</div></div>`)}
          <div class="troquel"></div>
          <div class="resguardo" data-anim="mpTear .5s cubic-bezier(.3,1.3,.5,1) ${d2}ms backwards" title="Pasa el ratón (o toca) para rasgarlo">${tirasResguardo(papel)}</div>
        </div>
      </div></div>`;
  }
  // 8c · «Se busca»: senior con MP la temporada pasada que aún no tienen equipo (nunca menores ni quien cambió de papel)
  function seBusca(fe) {
    const vistos = new Set(), out = [], rol = new Set();
    A.ligas.forEach(L => ((L.pre && L.pre.equipos) || []).forEach(e => (e.bajas || []).forEach(b => { if (b.estado === 'otro_rol') rol.add((b.nombre + ' ' + b.apellidos).toLowerCase()); })));
    A.equipos.filter(e => !fe || e.id === fe.id).forEach(e => (e.bajas || []).forEach(b => {
      if (b.destino || b.estado === 'otro_rol' || rol.has((b.nombre + ' ' + b.apellidos).toLowerCase())) return;
      const k = (b.nombre + ' ' + b.apellidos).toLowerCase(); if (vistos.has(k)) return; vistos.add(k);
      const hj = H && H.byTok[H.tok(b.nombre + ' ' + b.apellidos)];
      // en la cantera, la categoría en la que jugó la temporada pasada (Alevín o Infantil), no la de la página
      const ult = e.cantera && hj ? hj.temporadas.filter(t => ours(t.equipo)).sort((x, y) => (x.temporada < y.temporada ? -1 : 1)).pop() : null;
      const lbl = 'MP ' + (!e.cantera ? e.id : ult && /ALEV/i.test(ult.liga || '') ? 'Alevín' : ult && /INFANT/i.test(ult.liga || '') ? 'Infantil' : 'cantera');
      out.push({ e, b, lbl, yrs: hj ? new Set(hj.temporadas.filter(t => ours(t.equipo)).map(t => t.temporada)).size : 0, pct: b.pct || 0 });
    }));
    return out.sort((x, y) => y.pct - x.pct);
  }
  function buscado(m, i) {
    const b = m.b, y = +A.temporada.slice(0, 4), prev = (y - 1) + '/' + String(y).slice(2);
    return `<div data-anim="mpFadeIn .5s ${i * 120}ms" data-grupo style="flex:none"><div data-cromo style="--brillo:${(i * 0.7).toFixed(1)}s;width:184px;height:300px;border-radius:12px;overflow:hidden;background:#141416;border:2px dashed #55555B">
      <div style="position:absolute;inset:0;display:grid;place-items:center;${BS}font-weight:900;font-size:90px;color:#222226">${esc(ini(b.nombre, b.apellidos))}</div>
      ${b.foto ? `<div style="position:absolute;inset:0;background:url('${esc(b.foto)}') 50% 18%/cover no-repeat;filter:grayscale(1) brightness(.55) contrast(1.1)"></div>` : ''}
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(13,13,14,.15) 0%,rgba(13,13,14,.25) 45%,rgba(13,13,14,.92) 72%)"></div>
      <span style="position:absolute;right:10px;top:6px;${BS}font-weight:900;font-size:36px;line-height:1;color:rgba(255,255,255,.35)">${esc(b.dorsal || '')}</span>
      <div data-anim="mpStampSb .45s cubic-bezier(.3,1.4,.5,1) ${400 + i * 120}ms" style="position:absolute;left:50%;top:34%;width:150px;margin-left:-75px;padding:5px 0;text-align:center;border:3px solid ${RED};border-radius:4px;color:#FF5A52;${BS}font-weight:900;font-size:17px;line-height:1.05;letter-spacing:.04em;background:rgba(13,13,14,.55)">DESAPARECIDO<br>EN ACCIÓN</div>
      <div style="position:absolute;left:0;right:0;bottom:0;padding:12px;display:flex;flex-direction:column;gap:6px">
        <div><div style="font-weight:700;font-size:15px;line-height:1.15;color:#F4F4F5">${esc(corto(b))}</div><div style="font-size:12px;color:#A6A6AD">Visto por última vez: ${prev} · ${esc(m.lbl)}</div></div>
        ${b.pct != null ? `<div style="display:flex;align-items:baseline;gap:6px"><span style="${BS}font-weight:900;font-size:30px;line-height:1;color:#F4F4F5">${dec(m.pct)}%</span><span style="font-size:11px;font-weight:600;color:#A6A6AD;line-height:1.2">de los puntos de su equipo en ${prev.slice(2)}</span></div>` : ''}
        ${m.yrs ? `<div style="font-size:12px;color:#8A8A8F">${m.yrs} ${m.yrs === 1 ? 'temporada' : 'temporadas'} en MP</div>` : ''}
      </div></div></div>`;
  }
  // los dos cromos de Pretemporada (también en Jugadores, bajo la franja de rookies); en el móvil, carrusel
  function seccionCromos(fe, vistos) {
    const vu = vuelven(fe), sb = H ? seBusca(fe) : [];
    if (vistos) { vu.forEach(v => quien({ k: v.j.k, ...v.j }).forEach(q => vistos.add(q))); sb.forEach(m => quien(m.b).forEach(q => vistos.add(q))); }
    if (!vu.length && !sb.length) return '';
    return `<div style="--fondo:#0D0D0E">
      ${vu.length ? `${lab('BILLETE DE VUELTA · ' + vu.length, 'margin:28px 0 2px;color:#3DD27E')}<div style="font-size:13px;color:#A6A6AD">Vuelven al club tras un tiempo fuera</div><div class="cromos">${vu.map(billete).join('')}</div>` : ''}
      ${sb.length ? `${lab('SE BUSCA · ' + sb.length, 'margin:20px 0 2px;color:#FF5A52')}<div style="font-size:13px;color:#A6A6AD">Estaban la temporada pasada y aún no han jugado esta. ¡Os esperamos!</div><div class="cromos">${sb.map(buscado).join('')}</div>` : ''}
    </div>`;
  }
  function movimientosClub() {
    const G = { interno: [], vuelven: [], llegan: [], debutan: [], seVan: [], rol: [], pendientes: [] }, vistos = new Set();
    const vuK = new Set(vuelven(null).map(v => v.j.k));   // los que ya jugaron con nosotros: vuelven, aunque lleguen de otro club
    A.ligas.filter(l => l.pre).forEach(L => L.pre.equipos.filter(e => e.nuestro).forEach(e => {
      const yo = mpLbl(e.equipo, L.nombre);
      (e.altas || []).forEach(x => { const t = tipoAlta(x, e.equipo, L.nombre)[0];
        if (t === 'club') return;   // sigue en el mismo equipo
        if (x.desde === 'MADRIDPATINA' && e.equipo === 'MADRIDPATINA') return;   // de Alevín a Infantil o al revés: muchos juegan en los dos
        if (t === 'sube' || t === 'baja') { if (!vistos.has(x.k)) { vistos.add(x.k); G.interno.push({ x, de: mpLbl(x.desde, x.desdeLiga), a: yo, t, nota: x.nota }); } }
        else if (t === 'vuelve' || (t === 'fuera' && vuK.has(x.k))) G.vuelven.push({ x, a: yo });
        else if (t === 'fuera') G.llegan.push({ x, a: yo });
        else G.debutan.push({ x, a: yo }); });
      (e.bajas || []).forEach(x => {
        if (x.destino === 'MADRIDPATINA' && e.equipo === 'MADRIDPATINA') return;   // sigue en la cantera, en la otra categoría
        if (x.destino && ours(x.destino)) { if (!vistos.has(x.k)) { vistos.add(x.k); const a = mpLbl(x.destino, x.destinoLiga); G.interno.push({ x, de: yo, a, t: mpRango(a) < mpRango(yo) ? 'sube' : 'baja', nota: x.nota }); } }
        else if (vistos.has(x.k)) return;   // la misma persona en dos equipos nuestros: una sola vez
        else if (x.destino) { vistos.add(x.k); G.seVan.push({ x, de: yo }); }
        else if (x.estado === 'otro_rol') { vistos.add(x.k); G.rol.push({ x, de: yo }); }
        else { vistos.add(x.k); G.pendientes.push({ x, de: yo }); } });
    }));
    G.interno.sort((a, b) => mpRango(a.a) - mpRango(b.a));
    return G;
  }
  function vPretemporadaClub(tabs) {
    const G = movimientosClub(), vistos = new Set(), tab = tablero(vistos), cromos = seccionCromos(null, vistos);
    const fuera = m => !quien(m.x).some(q => vistos.has(q)), una = new Set(), unaVez = m => !quien(m.x).some(q => una.has(q)) && (quien(m.x).forEach(q => una.add(q)), true);
    const lista = k => G[k].filter(fuera).filter(unaVez);
    const jn = x => { const t = `${x.dorsal ? '<span style="color:#A6A6AD">#' + esc(x.dorsal) + '</span> ' : ''}${esc(corto(x))}`; return A.jugadores[x.k] ? `<a href="${hP(x.k)}">${t}</a>` : t; };
    const tAnt = (+A.temporada.slice(0, 4) - 1) + '/' + A.temporada.slice(2, 4);
    const st = s2 => s2 && s2.pj ? `${tAnt}: ${s2.pj} PJ · ${s2.goles} G ${s2.asistencias} A` : '';
    const notaSt = (nota, s2) => [nota ? esc(nota) : '', st(s2)].filter(Boolean).join(' · ');
    const fila = (izq, dcha) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid #26262A"><div style="min-width:0">${izq}</div><div style="text-align:right">${dcha}</div></div>`;
    const chip = (t, c) => `<span style="font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;background:${c};color:#0D0D0E;white-space:nowrap">${t}</span>`;
    const bloque = (titulo, color, filas, nota) => filas.length ? `<div class="card" style="padding:16px 20px">
        <div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:${color}">${titulo} · ${filas.length}</div>${nota ? `<div style="font-size:13px;color:#A6A6AD;margin-top:2px">${nota}</div>` : ''}${filas.join('')}</div>` : '';
    const interno = lista('interno').map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div><div style="font-size:12px;color:#A6A6AD">${notaSt(m.nota, m.x.stats)}</div>`,
      `<span style="${BS}font-weight:800;font-size:18px;white-space:nowrap">${esc(m.de)} <span style="color:${m.t === 'sube' ? '#3DD27E' : '#FF8A3D'}">${m.t === 'sube' ? '↑' : '↓'}</span> ${esc(m.a)}</span>`));
    const vuelven = lista('vuelven').map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div><div style="font-size:12px;color:#A6A6AD">${esc(m.x.desde && !ours(m.x.desde) ? 'Vuelve desde ' + m.x.desde : (m.x.nota || '').replace(/^Vuelve:\s*/, 'Su última temporada: '))}</div>`, chip(m.a, '#6FB7FF')));
    const llegan = lista('llegan').map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div><div style="font-size:12px;color:#A6A6AD">de ${esc(m.x.desde)}${m.x.desdeLiga ? ' · ' + esc(m.x.desdeLiga) : ''}${st(m.x.stats) ? ' · ' + st(m.x.stats) : ''}</div>`, chip(m.a, '#C9A7F5')));
    const debutan = lista('debutan').map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div><div style="font-size:12px;color:#A6A6AD">${esc(m.x.nota || 'Primer año')}</div>`, chip(m.a, '#FF6B63')));
    const seVan = lista('seVan').map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div><div style="font-size:12px;color:#A6A6AD">→ ${esc(m.x.destino)}${m.x.destinoLiga ? ' · ' + esc(m.x.destinoLiga) : ''}</div>`, chip(m.de, '#3A3A40').replace('color:#0D0D0E', 'color:#F4F4F5')));
    const rol = G.rol.map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div><div style="font-size:12px;color:#A6A6AD">${esc(m.x.nota || '')}</div>`, chip(m.de, '#3A3A40').replace('color:#0D0D0E', 'color:#F4F4F5')));
    const pend = lista('pendientes').map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div>`, chip(m.de, '#3A3A40').replace('color:#0D0D0E', 'color:#F4F4F5')));
    const cuenta = k => new Set(G[k].map(m => m.x.k || m.x.nombre + ' ' + m.x.apellidos)).size;   // alevín e infantil: una persona, una vez
    const kpis = [['Cambian de equipo', cuenta('interno'), '#3DD27E'], ['Vuelven', cuenta('vuelven'), '#6FB7FF'], ['Llegan de otros clubes', cuenta('llegan'), '#C9A7F5'],
      ['Debutan', cuenta('debutan'), '#FF6B63'], ['Se van a otros clubes', cuenta('seVan'), '#A6A6AD']]
      .map(([k, v, ink]) => `<div style="padding:14px 18px;background:#18181B;border-radius:10px;min-width:120px"><div style="font-size:14px;color:#A6A6AD;font-weight:600">${k}</div><div style="${BS}font-weight:800;font-size:48px;line-height:1;color:${ink}">${v}</div></div>`).join('');
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:28px">${tabs}</div>
      <div style="margin-top:24px"><div class="lab" style="color:#FF6B63">PRETEMPORADA ${esc(A.temporada)}</div><h1 class="pt" style="${BS}font-weight:900;font-size:clamp(44px,6.5vw,80px);line-height:.9;margin-top:6px">Nuestro club</h1></div>
      <div style="font-size:15px;line-height:1.5;color:#C9C9CE;margin-top:12px;max-width:860px">Quién sube o baja entre nuestros equipos, quién vuelve, quién llega de otro club y quién debuta, en todas las ligas en las que jugamos.</div>
      <div class="kpis" style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap">${kpis}</div>
      ${tab}
      ${cromos}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:24px;align-items:start">
        ${bloque('CAMBIAN DE EQUIPO DENTRO DEL CLUB', '#3DD27E', interno, (tab ? 'Los de senior, en el tablero de arriba · ' : '') + '↑ sube a un equipo de más nivel · ↓ baja')}
        ${bloque('VUELVEN', '#6FB7FF', vuelven, 'No jugaron la temporada pasada y vuelven este año')}
        ${bloque('LLEGAN DE OTROS CLUBES', '#C9A7F5', llegan)}
        ${bloque('DEBUTAN', '#FF6B63', debutan, 'Su primer año en senior; en la cantera, los que no jugaron la temporada pasada')}
        ${bloque('SE VAN A OTROS CLUBES', '#A6A6AD', seVan)}
        ${bloque('CAMBIAN DE PAPEL', '#A6A6AD', rol)}
        ${bloque('AÚN NO HAN JUGADO ESTA TEMPORADA', '#55555B', pend, 'Estaban la temporada pasada; pueden volver en cualquier jornada' + (cromos.includes('SE BUSCA') ? ' (además de los de «Se busca»)' : ''))}
      </div>`;
  }

  /* ── Pretemporada: cómo llega cada liga en la que jugamos (todos los equipos y jugadores) ── */
  function vPretemporada(id) {
    const ls = A.ligas.filter(l => l.pre);
    if (!ls.length) return '<div class="loading">Sin datos de pretemporada.</div>';
    const tabClub = `<a class="blk" href="${hPre('club')}"${!id || id === 'club' ? ' aria-current="page"' : ''} style="padding:10px 18px;border-radius:8px;background:${!id || id === 'club' ? RED : '#18181B'};color:${!id || id === 'club' ? '#FFFFFF' : '#C9C9CE'};font-weight:700;font-size:15px;white-space:nowrap">MADRIDPATINA</a>`;
    if (!id || id === 'club') return vPretemporadaClub(tabClub + ls.map(l => `<a class="blk" href="${hPre(l.id)}" style="padding:10px 18px;border-radius:8px;background:#18181B;color:#C9C9CE;font-weight:700;font-size:15px;white-space:nowrap">${esc(l.nombre)}</a>`).join(''));
    const L = ls.find(l => l.id === id) || ls[0];
    S.lg = L.id;
    const P = L.pre;
    const T = { baja: ['↓', '#FF8A3D', 'BAJA'], sube: ['↑', '#3DD27E', 'SUBE'], nuevo: ['★', RED, 'NUEVO'], viene: ['→', '#6B6B70', 'VIENE'], sigue: ['', '#3A3A40', 'SIGUE'] };
    const tabs = tabClub + ls.map(l => `<a class="blk" href="${hPre(l.id)}"${l.id === L.id ? ' aria-current="page"' : ''} style="padding:10px 18px;border-radius:8px;background:${l.id === L.id ? RED : '#18181B'};color:${l.id === L.id ? '#FFFFFF' : '#C9C9CE'};font-weight:700;font-size:15px;white-space:nowrap">${esc(l.nombre)}</a>`).join('');
    // jugador: enlace a su ficha si es de los nuestros
    const jn = x => { const t = `${x.dorsal ? '<span style="color:#A6A6AD">#' + esc(x.dorsal) + '</span> ' : ''}${esc(corto(x))}`; return A.jugadores[x.k] ? `<a href="${hP(x.k)}">${t}</a>` : t; };
    const st = s2 => s2 && s2.pj ? `${s2.pj} PJ · ${s2.goles} G ${s2.asistencias} A` : '';
    const tag = e => { const t = T[e.tipo] || T.sigue; return e.tipo === 'sigue' ? '' : ` <span style="font-size:11px;font-weight:700;letter-spacing:.06em;padding:2px 6px;border-radius:3px;background:${t[1]};color:${e.tipo === 'sube' || e.tipo === 'baja' ? '#0D0D0E' : '#fff'};vertical-align:2px">${t[2]}</span>`; };
    const eqs = P.equipos.slice().sort((a, b) => (a.fuerza ? a.fuerza.puesto : 99) - (b.fuerza ? b.fuerza.puesto : 99));
    // nuestra cantera: Alevín e Infantil juntos (muchos juegan en los dos), sin los pasos de una categoría a otra y con la
    // misma lista en las dos páginas, como en Equipos
    const canteraL = /^(alevin|infantil)/.test(L.id), CANT = 'MADRIDPATINA';
    const deCantera = campo => { const v = new Set(); return A.ligas.filter(l => /^(alevin|infantil)/.test(l.id) && l.pre)
      .flatMap(l => l.pre.equipos.filter(e => e.nuestro).flatMap(e => e[campo] || []))
      .filter(x => (campo === 'altas' ? x.desde : x.destino) !== CANT).filter(x => { const q = x.k || x.nombre + ' ' + x.apellidos; return !v.has(q) && v.add(q); }); };
    const nA = P.equipos.reduce((n, e) => n + (e.nuestro && canteraL ? deCantera('altas') : e.altas || []).length, 0),
      nB = P.equipos.reduce((n, e) => n + (e.nuestro && canteraL ? deCantera('bajas') : e.bajas || []).length, 0);
    const nLlegan = P.equipos.filter(e => e.tipo !== 'sigue').length;
    const kpis = [['Equipos', P.equipos.length, '#F4F4F5']].concat(nLlegan < P.equipos.length ? [['Llegan de otra liga o son nuevos', nLlegan, '#3DD27E']] : []).concat([
      ['Altas', nA, '#F4F4F5'], ['Bajas', nB, '#A6A6AD']]).concat(L.rookies.length ? [['Debutantes', L.rookies.length, '#FF6B63']] : [])
      .map(([k, v, ink]) => `<div style="padding:14px 18px;background:#18181B;border-radius:10px;min-width:120px"><div style="font-size:14px;color:#A6A6AD;font-weight:600">${k}</div><div style="${BS}font-weight:800;font-size:48px;line-height:1;color:${ink}">${v}</div></div>`).join('');
    // 1) Fuerza de plantilla
    const maxF = Math.max(1, ...eqs.map(e => e.fuerza ? e.fuerza.total : 0));
    const fuerza = eqs.map(e => { const f = e.fuerza || { confirmada: 0, posible: 0, total: 0, puesto: '' };
      return `<div class="fila-barra" style="--c1:34px;display:grid;grid-template-columns:34px minmax(0,1fr) minmax(80px,300px) 56px;gap:12px;align-items:center;padding:10px 8px;border-radius:8px;background:${e.nuestro ? '#2A1416' : 'transparent'}">
        <span style="${BS}font-weight:900;font-size:26px;color:${f.puesto === 1 ? RED : '#8A8A8F'}">${f.puesto}</span>
        <div style="display:flex;align-items:center;gap:10px;min-width:0">${disc(crest(e.equipo), 30)}<div style="min-width:0">
          <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${e.nuestro ? '#FF6B63' : '#F4F4F5'}">${esc(e.equipo)}${tag(e)}</div>
          <div style="font-size:12px;color:#A6A6AD;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.sinp ? 'Aún no ha jugado: se estima con su plantilla de 2025/26' : (e.detalle || ''))}</div></div></div>
        <div class="barra" style="display:flex;height:12px;border-radius:3px;overflow:hidden;background:#26262A"><div style="width:${f.confirmada / maxF * 100}%;background:${e.nuestro ? RED : '#C9C9CE'}"></div><div style="width:${f.posible / maxF * 100}%;background:${e.nuestro ? '#7A1C22' : '#55555B'}"></div></div>
        <span style="text-align:right;${BS}font-weight:800;font-size:26px">${f.total}</span></div>`; }).join('');
    // 2) Más peligrosos y porteros más fiables (de toda la liga, también los nuestros)
    const fila = (i, x, sub, v, u) => `<div style="display:grid;grid-template-columns:24px 28px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 6px;border-radius:6px;border-bottom:1px solid #26262A;background:${x.nuestro ? '#2A1416' : 'transparent'}">
        <span style="${BS}font-weight:900;font-size:20px;color:#8A8A8F">${i + 1}</span>${disc(crest(x.equipo), 26)}
        <div style="min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${jn(x)}</div><div style="font-size:12px;color:#A6A6AD;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</div></div>
        <div style="text-align:right"><div style="${BS}font-weight:900;font-size:26px;line-height:1;color:${x.nuestro ? '#FF6B63' : '#F4F4F5'}">${v}</div><div style="font-size:11px;color:#A6A6AD">${u}</div></div></div>`;
    const pel = (P.peligrosos || []).map((x, i) => fila(i, x, esc(x.equipo) + (x.stats ? ' · 25/26: ' + st(x.stats) : ''), dec(x.ritmo), 'pts/partido')).join('');
    const gks = (P.porteros || []).map((g, i) => fila(i, g, esc(g.equipo) + ` · ${g.tiros} tiros` + (g.t2526 && g.t2526.pj ? ` · 25/26: ${g.t2526.pj} PJ` : ''), dec(g.pct) + '%', 'paradas')).join('');
    // 3) Cómo llegan los equipos: la escalera de ascensos y descensos, y los que ya no están
    const fuera = (P.fuera || []).map(f => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:84px;opacity:.5;text-align:center">${disc(f.escudo || crest(f.equipo), 52, '#55555B')}<span style="${BS}font-weight:800;font-size:15px;white-space:nowrap">${esc(abr(f.equipo))}</span><span style="font-size:11px;line-height:1.25;color:#A6A6AD">${esc(f.que_paso || '')}</span></div>`).join('');
    const mov = (fuera ? `<div style="display:grid;grid-template-columns:minmax(0,150px) minmax(0,1fr);gap:14px;align-items:center;padding:10px 0"><div style="font-size:12px;font-weight:700;letter-spacing:.1em;color:#55555B">YA NO ESTÁN</div><div style="display:flex;gap:14px;flex-wrap:wrap">${fuera}</div></div>` : '');
    // 4) Altas y bajas, equipo por equipo (los nuestros primero)
    const orden = P.equipos.slice().sort((a, b) => (b.nuestro - a.nuestro) || ((a.fuerza || {}).puesto - (b.fuerza || {}).puesto));
    const lin = (x, sub, dir, i) => { const al = dir === 'alta';
      return `<div data-anim="${al ? 'mpInL' : 'mpInR'} .45s cubic-bezier(.2,.8,.2,1) ${(al ? 150 : 250) + i * 110}ms" style="padding:${al ? '7px 0 7px 10px' : '7px 10px 7px 0'};border-bottom:1px solid #26262A;box-shadow:inset ${al ? '3px' : '-3px'} 0 0 ${al ? '#3DD27E' : '#FF5A52'}"><div style="font-weight:600">${jn(x)}${x.portero ? ` <span style="font-size:12px;color:#A6A6AD">· ${x.fem ? 'portera' : 'portero'}</span>` : ''}${x.tag ? ` <span style="font-size:11px;font-weight:700;padding:1px 6px;border-radius:3px;background:${x.tag[2]};color:#0D0D0E;white-space:nowrap">${esc(x.tag[1])}</span>` : ''}</div><div style="font-size:12px;color:#A6A6AD">${sub}</div></div>`; };
    const ab = orden.map(e => {
      const juntos = e.nuestro && canteraL, lAltas = juntos ? deCantera('altas') : e.altas || [], lBajas = juntos ? deCantera('bajas') : e.bajas || [];
      const altas = lAltas.map((x, i) => { const t = tipoAlta(x, e.equipo, L.nombre), interno = t[0] === 'sube' || t[0] === 'baja';
        const de = interno ? esc(x.desdeLiga || '') : x.desde ? 'de ' + esc(x.desde) + (x.desdeLiga ? ' · ' + esc(x.desdeLiga) : '') : esc(x.nota || 'Nuevo');
        return lin(Object.assign({}, x, { tag: t }), [de, x.stats && x.stats.pj ? '25/26: ' + st(x.stats) : ''].filter(Boolean).join(' · '), 'alta', i); }).join('') || '<div style="padding:7px 0;color:#A6A6AD;font-size:14px">Ninguna</div>';
      const bajas = lBajas.map((x, i) => lin(x, x.destino ? '→ ' + esc(x.destino) + (x.destinoLiga ? ' · ' + esc(x.destinoLiga) : '') : esc(x.nota || 'Sin partidos esta temporada'), 'baja', i)).join('') || '<div style="padding:7px 0;color:#A6A6AD;font-size:14px">Ninguna</div>';
      return `<div class="card" style="padding:16px 18px;border:1px solid ${e.nuestro ? RED : '#18181B'}">
        <div style="display:flex;align-items:center;gap:12px">${disc(crest(e.equipo), 36)}<div style="min-width:0;flex:1">
          <div style="font-weight:800;font-size:17px;color:${e.nuestro ? '#FF6B63' : '#F4F4F5'}">${esc(e.equipo)}${tag(e)}</div></div></div>
        ${juntos ? '<div style="font-size:13px;color:#A6A6AD;margin-top:8px">Alevín e Infantil juntos, porque muchos juegan en los dos. Solo los que llegan nuevos al club y los que ya no están en ningún equipo nuestro.</div>' : ''}
        <details${e.nuestro ? ' open' : ''} style="margin-top:10px"><summary style="cursor:pointer;font-weight:700;font-size:14px;color:#C9C9CE;padding:6px 0">Altas ${lAltas.length} · Bajas ${lBajas.length}</summary>
          <div data-grupo style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:4px 18px">
            <div><div style="font-size:12px;font-weight:700;letter-spacing:.1em;color:#3DD27E;margin-top:6px">ALTAS</div>${altas}</div>
            <div><div style="font-size:12px;font-weight:700;letter-spacing:.1em;color:#FF5A52;margin-top:6px">BAJAS</div>${bajas}</div>
          </div></details></div>`; }).join('');
    // 5) Renovación de plantillas y rookies
    const renov = P.equipos.filter(e => e.p && e.p.tenia_2025_26).map(e => { const pct = Math.round(e.p.siguen / e.p.tenia_2025_26 * 100);
      return `<div style="display:grid;grid-template-columns:40px 70px minmax(0,1fr) 56px 80px;gap:12px;align-items:center;padding:9px 6px;border-bottom:1px solid #26262A;border-radius:6px;background:${e.nuestro ? '#2A1416' : 'transparent'}">
          ${disc(crest(e.equipo), 36)}<span style="${BS}font-weight:800;font-size:19px;white-space:nowrap">${esc(abr(e.equipo))}</span>
          <div style="display:flex;height:12px;border-radius:3px;overflow:hidden;background:#26262A"><div style="width:${pct}%;background:${e.nuestro ? RED : '#8A8A8F'}"></div></div>
          <span style="text-align:right;${BS}font-weight:800;font-size:22px">${pct}%</span>
          <span style="text-align:right;font-size:13px;color:#C9C9CE;white-space:nowrap">${(n => n ? '+' + n + (n === 1 ? ' nuevo' : ' nuevos') : 'sin nuevos')(e.nuestro && canteraL ? (e.altas || []).filter(x => x.desde !== CANT).length : e.p.nuevos)}</span></div>`; }).join('');
    const rk = L.rookies.slice().sort((a, b) => (b.nuestro - a.nuestro) || ((a.edad || 99) - (b.edad || 99)));
    const rook = rk.map((r, i) => box(hP(r.k), `background:#18181B;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;border:2px solid ${r.nuestro ? RED : '#18181B'};--brillo:${(i % 6) * 0.5}s`, `
          <div class="ini" style="aspect-ratio:4/5;background:#26262A;font-size:52px;color:#55555B">${esc(ini(r.nombre, r.apellidos))}${photo(r.foto)}
            <span style="position:absolute;left:8px;top:8px;font-size:11px;font-weight:700;letter-spacing:.1em;padding:3px 6px;border-radius:3px;background:${RED};color:#fff;font-family:'IBM Plex Sans Condensed',sans-serif">DEBUTANTE</span>
            <div style="position:absolute;right:8px;top:8px">${disc(crest(r.equipo), 36)}</div>
            <span style="position:absolute;left:10px;bottom:4px;${BS}font-weight:900;font-size:40px;line-height:1;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${esc(r.dorsal ?? '')}</span>
            <span style="position:absolute;right:10px;bottom:8px;${BS}font-weight:800;font-size:18px;line-height:1;white-space:nowrap;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${r.edad != null ? r.edad + ' años' : ''}</span>
          </div>
          <div style="padding:10px 12px;text-align:left"><div style="font-weight:700;font-size:15px;line-height:1.15">${esc(corto(r))}</div><div style="font-size:13px;color:#A6A6AD;margin-top:2px">${esc(abr(r.equipo))} · ${esc(r.cantera ? r.cantera.replace(/ en 20\d\d\/\d\d$/, '') : 'Primer año en la FMP')}</div></div>`, 'div', ' data-cromo')).join('');
    const titulo2 = (t, nota) => `<div style="display:flex;justify-content:space-between;align-items:baseline;margin:32px 0 10px;gap:8px;flex-wrap:wrap"><span class="lab">${t}</span>${nota ? `<span style="font-size:13px;color:#A6A6AD">${nota}</span>` : ''}</div>`;
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:28px">${tabs}</div>
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px;margin-top:24px">
        <div><div class="lab" style="color:#FF6B63">PRETEMPORADA ${esc(A.temporada)}</div><h1 class="pt" style="${BS}font-weight:900;font-size:clamp(44px,6.5vw,80px);line-height:.9;margin-top:6px">${esc(L.nombre)}</h1></div>
      </div>
      ${P.contexto && P.contexto.length ? `<div style="font-size:15px;line-height:1.5;color:#C9C9CE;margin-top:12px;max-width:860px">${P.contexto.map(esc).join(' ')}</div>` : ''}
      <div class="kpis" style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap">${kpis}</div>
      ${titulo2('FUERZA DE CADA PLANTILLA · PRONÓSTICO', 'Puntos (goles + asistencias) de sus jugadores la temporada pasada, pasados al nivel de esta liga con el FMPe' + COMO('pretemporada'))}
      <div class="card" style="padding:8px 12px">${fuerza}
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:#A6A6AD;padding:10px 8px 6px"><span><span style="color:#C9C9CE">■</span> ya han jugado este año</span><span><span style="color:#55555B">■</span> de su plantilla 2025/26 que aún no han jugado (cuentan la mitad)</span></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:12px;align-items:start">
        <div>${titulo2('JUGADORES MÁS PELIGROSOS', 'Puntos por partido en 2025/26 y 2024/25, al nivel de esta liga (FMPe)' + COMO('pretemporada'))}<div class="card" style="padding:6px 14px">${pel || '<div style="padding:12px 0;color:#A6A6AD">Sin datos todavía.</div>'}</div></div>
        <div>${titulo2('PORTEROS MÁS FIABLES', '% de paradas en 2025/26 y 2024/25' + COMO('pretemporada'))}<div class="card" style="padding:6px 14px">${gks || '<div style="padding:12px 0;color:#A6A6AD">Sin datos todavía.</div>'}</div></div>
      </div>
      ${(() => { const esc_ = escalera(L); return esc_ || mov ? `${titulo2('CÓMO LLEGAN LOS EQUIPOS', esc_ ? 'Quién sube y quién baja' : '')}<div class="card" style="padding:6px 20px">${esc_}${mov}</div>` : ''; })()}
      ${titulo2('ALTAS Y BAJAS · EQUIPO POR EQUIPO', 'Primero los nuestros')}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr));gap:12px;align-items:start">${ab}</div>
      ${renov ? `${titulo2('RENOVACIÓN DE PLANTILLAS', 'Puntos de 2025/26 que siguen en el equipo · caras nuevas')}<div class="card" style="padding:8px 18px">${renov}</div>` : ''}
      ${rk.length ? `${titulo2('DEBUTANTES DE LA LIGA · ' + rk.length, rk.filter(r => r.menor || r.edad < 18).length + ' menores de 18 · primero los de MADRIDPATINA')}
      <div class="carrusel-movil" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px">${rook}</div>` : ''}`;
  }

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
    const evRow = e => { const eqn = e.lado === 'local' ? p.local : e.lado === 'visitante' ? p.visitante : ''; const T = TIPO[e.tipo] || [e.tipo, '#A6A6AD'];
      const txt = e.tipo === 'gol' ? quienTxt(e.jugador) + (e.asistencia ? ` <span style="color:#A6A6AD">· asist. ${quienTxt(e.asistencia)}</span>` : '')
        : e.tipo === 'falta' ? quienTxt(e.jugador) + ` <span style="color:#A6A6AD">· ${e.falta ? esc(e.falta) + ' · ' : ''}${fmin(e.minutos)}</span>`
        : e.tipo === 'cambio_portero' && e.jugador ? 'entra ' + quienTxt(e.jugador) : '';
      // en un derbi los dos escudos son el mismo: se pone el equipo (MP C, MP D)
      return `<div style="display:grid;grid-template-columns:50px ${derbiMP ? '38px' : '24px'} minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px;border-radius:6px;background:${ours(eqn) ? '#2A1416' : 'transparent'}">
        <span style="${BS}font-weight:800;font-size:18px;color:#A6A6AD;font-variant-numeric:tabular-nums">${esc(jugado(e.minuto))}</span>${derbiMP ? `<span style="${BS}font-weight:800;font-size:15px;line-height:1;white-space:nowrap;color:#F4F4F5">${esc(eqn ? abr(eqn) : '')}</span>` : disc(crest(eqn), 22)}
        <div style="min-width:0;font-size:15px;line-height:1.35"><span style="font-size:12px;font-weight:700;letter-spacing:.08em;color:${T[1]}">${T[0]}</span>${eqn && !derbiMP ? (e.tipo === 'tiempo_muerto' || e.tipo === 'cambio_portero' ? ` <span style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#C9C9CE">· ${esc(abr(eqn))}</span>` : `<span class="sr-only"> de ${esc(eqn)}</span>`) : ''} ${txt}</div>
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
        ${p.nuestro && p.idp && !(VID && VID[p.idp]) ? `<div style="display:flex;justify-content:center;margin-top:22px"><a class="dv-alin" href="#/directo/${encodeURIComponent(p.idp)}/resumen" title="El partido contado otra vez desde el acta: pista, alineaciones, goles, faltas, penaltis y resumen final">▶ Ver resumen</a></div>` : ''}
        ${p.gl != null && (p.ev || []).length ? `<div data-grafico-partido="${esc(p.mid)}"></div>` : ''}
        ${hasTiros ? `<div style="max-width:640px;margin:28px auto 0">
          <div style="display:flex;justify-content:space-between;${BS}font-weight:800;font-size:28px;line-height:1"><span>${p.tl}</span><span class="lab" style="align-self:center">TIROS A PUERTA</span><span>${p.tv}</span></div>
          <div style="display:flex;gap:3px;height:10px;margin-top:8px" data-grupo data-espera="1300"><div data-anim="mpWipe .6s" style="flex:${p.tl};background:${ours(p.local) ? RED : '#6B6B70'};border-radius:3px;transform-origin:right"></div><div data-anim="mpWipe .6s" style="flex:${p.tv};background:${ours(p.visitante) ? RED : '#6B6B70'};border-radius:3px;transform-origin:left"></div></div>
        </div>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:12px" data-grupo data-espera="1700">${side(p.local, p.gol_l, p.por_l, p.alin_l, p.staff_l, 0)}${side(p.visitante, p.gol_v, p.por_v, p.alin_v, p.staff_v, 100)}</div>
      ${info.length || eventos ? `<div class="card" style="margin-top:12px;padding:18px 20px">
        ${info.length ? `<div style="display:flex;gap:12px 32px;flex-wrap:wrap">${info.map(([k, v]) => `<div><div style="font-size:13px;font-weight:700;color:#A6A6AD">${k}</div><div style="font-weight:600;font-size:16px">${esc(v)}</div></div>`).join('')}</div>` : ''}
        ${eventos ? `<div style="margin-top:${info.length ? 20 : 0}px">${lab('EVENTOS DEL PARTIDO')}<div style="font-size:13px;color:#A6A6AD;margin-top:4px">Minuto jugado de cada parte.</div>${eventos}</div>` : ''}
      </div>` : ''}`;
  }

  /* ── 5. Jugadores ───────────────────────────────────────── */
  function vJugadores(fid) {
    const J = A.jugadores;
    const list = Object.values(J).filter(p => p.equipo && ours(p.equipo));
    const teams = A.equipos.filter(e => list.some(p => enEquipo(p, e)));
    const fe = teams.find(e => e.id === fid);
    const jf = fe ? fe.id : 'todos';
    const tPrev = (+A.temporada.slice(0, 4) - 1) + '/' + A.temporada.slice(2, 4);
    const pts = p => { const t = p.temporadas[tPrev] || {}, t7 = p.temporadas[A.temporada] || {}; return (t7.goles || 0) * 3 + (t7.asistencias || 0) * 3 + (t.goles || 0) + (t.asistencias || 0); };
    const ordenEq = p => { const i = A.equipos.indexOf(equiposDe(p)[0]); return i < 0 ? 99 : i; };   // A, B, C, D, Alevín, Infantil
    const filtros = [['todos', 'Todos', '#/jugadores']].concat(teams.map(e => [e.id, tituloOf(e), '#/jugadores/' + e.id]))
      .map(([k, l, h]) => `<a class="blk" href="${h}"${jf === k ? ' aria-current="page"' : ''} style="padding:8px 16px;border-radius:999px;background:${jf === k ? RED : '#18181B'};color:${jf === k ? '#FFFFFF' : '#C9C9CE'};font-weight:700;font-size:15px">${l}</a>`).join('');
    const jugList = list.filter(p => !fe || enEquipo(p, fe)).sort((a, b) => ordenEq(a) - ordenEq(b) || pts(b) - pts(a)).map(p => {
      const stat = rolDe(p);
      return box(hP(p.k), 'background:#18181B;border-radius:10px;overflow:hidden;display:flex;flex-direction:column', `
        <div class="ini" style="aspect-ratio:4/5;background:#26262A;font-size:48px;color:#55555B">${esc(ini(p.nombre, p.apellidos))}${photo(p.foto)}
          <span class="dors" style="position:absolute;left:8px;bottom:6px;${BS}font-weight:900;font-size:40px;line-height:1;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${esc(p.dorsal || '')}</span>
          <span class="chapa" style="position:absolute;right:8px;top:8px;font-size:12px;font-weight:700;padding:3px 7px;border-radius:4px;background:${RED};color:#fff;font-family:'IBM Plex Sans Condensed',sans-serif">${esc('MP ' + (equiposDe(p).map(letraOf).join('·') || p.equipo.replace('MADRIDPATINA', '').trim()))}</span>
        </div>
        <div class="pie-cromo" style="padding:10px 12px"><div style="font-weight:700;font-size:15px;line-height:1.15">${esc(corto(p))}</div><div style="font-size:13px;color:#A6A6AD;margin-top:2px">${stat}</div></div>`);
    }).join('');
    const seen = {};
    // los de senior (su primer año en senior) y los nuevos de la cantera (no jugaron la temporada pasada)
    const debCant = A.ligas.filter(l => /^(alevin|infantil)/.test(l.id) && l.pre).flatMap(l => l.pre.equipos.filter(e => e.nuestro)
      .flatMap(e => (e.altas || []).filter(x => !x.desde && J[x.k]).map(x => Object.assign({}, x, { equipo: 'MADRIDPATINA', nuestro: true, cant: true }))));
    const rook = [].concat(...A.ligas.map(l => l.rookies), debCant).filter(r => r.nuestro && !seen[r.k] && (seen[r.k] = 1))
      .filter(r => !fe || (r.cant ? enEquipo(J[r.k], fe) : r.equipo === fe.nombre));
    const notaDeb = fe && fe.cantera ? 'No jugaron la temporada pasada' : fe ? 'Su primer año en senior' : 'Su primer año en senior; en la cantera, los que no jugaron la temporada pasada';
    const rookHtml = rook.map((r, i) => box(hP(r.k), `flex:none;width:150px;background:#121214;border-radius:10px;overflow:hidden;--brillo:${(i % 6) * 0.5}s`, `
        <div class="ini" style="height:150px;background:#26262A;font-size:40px;color:#55555B">${esc(ini(r.nombre, r.apellidos))}${photo(r.foto || (J[r.k] && J[r.k].foto))}
          <span style="position:absolute;left:8px;top:8px;font-size:11px;font-weight:700;letter-spacing:.1em;padding:3px 6px;border-radius:3px;background:${RED};color:#fff;font-family:'IBM Plex Sans Condensed',sans-serif">DEBUTANTE</span>
          <span style="position:absolute;right:8px;bottom:4px;${BS}font-weight:900;font-size:34px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${esc(r.dorsal ?? '')}</span></div>
        <div style="padding:8px 10px"><div style="font-weight:700;font-size:14px;line-height:1.15">${esc(corto(r))}</div><div style="font-size:12px;color:#A6A6AD">${esc(r.cant ? 'MP ' + (equiposDe(J[r.k]).map(tituloOf).join(' e ') || 'cantera') : abr(r.equipo) === 'MP' ? 'MADRIDPATINA' : abr(r.equipo))}${r.edad != null ? ' · ' + r.edad + ' años' : ''}</div></div>`, 'div', ' data-cromo')).join('');
    return `<h1 class="pt" style="${BS}font-weight:900;font-size:clamp(48px,7vw,84px);line-height:.9;padding-top:32px">PLANTILLAS</h1>
      ${rook.length ? `<div class="card" style="margin-top:20px;padding:16px 18px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#FF6B63">DEBUTANTES ${esc(A.temporada)} · ${rook.length}</span><span style="font-size:13px;color:#A6A6AD">${notaDeb}</span></div>
        <div style="display:flex;gap:12px;overflow-x:auto;margin-top:6px;padding:8px 2px">${rookHtml}</div></div>` : ''}
      ${seccionCromos(fe)}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:16px">${filtros}</div>
      <div class="plantilla" data-ola="mpWave .45s cubic-bezier(.2,.8,.2,1)" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:16px">${jugList}</div>${exJugadores(list, fe)}`;
  }

  // Exjugadores: jugaron con nosotros (en senior) y esta temporada no están en nuestras plantillas. Solo mayores de edad.
  function exJugadores(list, fe) {
    if (!H || fe) return '';
    const cur = new Set(list.map(p => H.tok(p.nombre + ' ' + p.apellidos)));
    const cant = t => /ALEV|INFANT|JUVENIL/i.test(t.liga || '');
    // los que juegan ahora en otro club, también los de la cantera; sin equipo, solo los adultos con paso por senior
    const catEx = t => t.equipo === 'MADRIDPATINA' ? 'MP ' + (/ALEV/i.test(t.liga || '') ? 'Alevín' : /INFANT/i.test(t.liga || '') ? 'Infantil' : /JUVENIL/i.test(t.liga || '') ? 'Juvenil' : 'cantera') : t.equipo.replace('MADRIDPATINA', 'MP');
    const ex = H.jugadores.filter(j => !cur.has(j.tok) && ((j.ahora && j.ahora.length) || (j.temporadas.some(t => !cant(t)) && j.adulto !== false)))
      .map(j => { const ult = j.temporadas.map(t => t.temporada).sort().pop();
        return Object.assign({}, j, { ult, eqs: [...new Set(j.temporadas.filter(t => t.temporada === ult).map(catEx))] }); })
      .sort((a, b) => (a.ult < b.ult ? 1 : a.ult > b.ult ? -1 : b.carrera.pj - a.carrera.pj));
    if (!ex.length) return '';
    const otro = ex.filter(j => j.ahora && j.ahora.length), fuera = ex.filter(j => !(j.ahora && j.ahora.length));
    const fila = (j, dcha) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #26262A">
        <div style="min-width:0"><div style="font-weight:700">${esc(j.nombre)}</div><div style="font-size:13px;color:#A6A6AD">${esc(j.eqs.join(', '))} hasta ${esc(j.ult)} · ${j.carrera.pj} PJ · ${j.carrera.g} G ${j.carrera.a} A</div></div>${dcha}</div>`;
    const ahora = j => `<div style="display:flex;align-items:center;gap:8px">${disc(crest(j.ahora[0].equipo), 28)}<div style="text-align:right"><div style="font-weight:700;font-size:14px">${esc([...new Set(j.ahora.map(a => a.equipo))].join(', '))}</div><div style="font-size:12px;color:#A6A6AD">${esc([...new Set(j.ahora.map(a => titulo(a.liga)))].join(', '))}</div></div></div>`;
    const recientes = fuera.filter(j => j.ult >= '2023/24'), antes = fuera.filter(j => j.ult < '2023/24');
    return `${lab('EXJUGADORES · ' + ex.length, 'margin:36px 0 4px')}
      <div style="font-size:14px;color:#A6A6AD;margin-bottom:12px">Jugaron con MADRIDPATINA y esta temporada no están en nuestras plantillas.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;align-items:start">
        <div class="card" style="padding:16px 20px"><div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#FF6B63">AHORA EN OTRO EQUIPO · ${otro.length}</div>
          ${otro.map(j => fila(j, ahora(j))).join('') || '<div style="padding:10px 0;color:#A6A6AD">Nadie por ahora.</div>'}</div>
        <div class="card" style="padding:16px 20px"><div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#A6A6AD">SIN PARTIDOS EN ${esc(A.temporada)} · ${fuera.length}</div>
          ${recientes.map(j => fila(j, '')).join('')}
          ${antes.length ? `<details style="margin-top:6px"><summary style="cursor:pointer;color:#C9C9CE;font-weight:600;padding:10px 0">Ver ${antes.length === 1 ? 'uno' : 'los ' + antes.length} de temporadas anteriores</summary>${antes.map(j => fila(j, '')).join('')}</details>` : ''}</div>
      </div>`;
  }



  /* ── Arquetipos (los del Wrapped; scripts/reporte/mapa.py decide cuál toca, comparando con la liga) ───────────────── */
  const ARQ = {
    sniper: ['Sniper', 'el francotirador', 'la francotiradora', '#a8281f', 'El gol es lo suyo. Cuando aparece, hay peligro en la portería rival. No persigue el puck: el puck le llega al stick.'],
    playmaker: ['Playmaker', 'el cerebro', 'el cerebro', '#2f6db3', 'No firma los goles, los inventa. Ve líneas que el resto no ve y descose defensas con un pase.'],
    momentum: ['Momentum', 'el motor', 'el motor', '#c2520a', 'Cuando entra, el partido cambia. Goles, asistencias, intensidad: empuja al equipo cuando hace falta.'],
    wildcard: ['Wildcard', 'el espectáculo', 'el espectáculo', '#d4a73b', 'Goles, faltas, intensidad pura. Donde está, pasa algo. El equipo lo agradece; el árbitro lo nota.'],
    steady: ['Steady', 'el consistente', 'la consistente', '#8a4fb5', 'Sale, marca, asiste. Sin estridencias, con presencia. Lo que se espera, lo cumple.'],
    ghost: ['Ghost', 'el fugaz', 'la fugaz', '#b8324a', 'Apariciones breves por ahora. Cada partido cuenta, aunque la cuenta sea corta.'],
    wall: ['Wall', 'el ancla', 'el ancla', '#4a6a9e', 'No sale en los highlights. Sale en los partidos ganados. Sostiene desde donde nadie mira.'],
    workhorse: ['Workhorse', 'el currante', 'la currante', '#6B6B70', 'Cada partido, cada turno. Sin números espectaculares, pero el equipo no rueda sin su trabajo.'],
    game_changer: ['Game Changer', 'el decisivo', 'la decisiva', '#e89a2b', 'Sus goles no son uno más: ponen por delante y deciden partidos.'],
    comeback_king: ['Comeback King', 'el remontador', 'la remontadora', '#7b4ff2', 'Cuando el equipo va perdiendo, aparece. Sus goles empiezan remontadas.'],
    hot_streak: ['Hot Streak', 'en racha', 'en racha', '#f57f3b', 'Cuando enciende el modo gol, no para: partidos seguidos marcando.'],
    one_man_show: ['One Man Show', 'el solista', 'la solista', '#1f8fd8', 'Buena parte de los goles del equipo pasan por su stick.'],
    mixed_player: ['Polivalente', 'campo y portería', 'campo y portería', '#4caaaa', 'Ha jugado de campo y bajo palos. No todos hacen las dos cosas.'],
    rookie_phenom: ['Rookie Phenom', 'la promesa', 'la promesa', '#9d6cc0', 'Acaba de llegar a senior y ya pesa en el equipo.'],
    veteran_loyal: ['Veterano', 'el de toda la vida', 'la de toda la vida', '#4a6a9e', 'Temporadas y temporadas en el club. Parte del esqueleto del equipo.'],
    legend_alltime: ['Leyenda', 'del club histórico', 'del club histórico', '#d4a73b', 'Su nombre está entre los 3 primeros de la historia del club.'],
    iron_curtain: ['Iron Curtain', 'la cortina de hierro', 'la cortina de hierro', '#2f6db3', 'De los mejores porcentajes de paradas de su liga. Quien intenta marcarle se lo piensa dos veces.'],
    reactive_wall: ['Reactive Wall', 'el reflejo', 'el reflejo', '#4a6a9e', 'Recibe tiros sin parar y los resuelve. El equipo aguanta porque aguanta antes.'],
    embattled: ['Embattled', 'el bombardeado', 'la bombardeada', '#c2520a', 'El rival no para de probarle. Bajo presión constante, cada parada cuenta el doble.'],
    undershot: ['Undershot', 'el bien defendido', 'la bien defendida', '#8a4fb5', 'Su equipo trabaja delante: le llegan pocos tiros, y los importantes los para.'],
    workhorse_g: ['Workhorse', 'el titular indiscutible', 'la titular indiscutible', '#a8281f', 'Partido tras partido en la portería. Esta temporada, la portería lleva su nombre.'],
    shadow: ['Shadow', 'el suplente puntual', 'la suplente puntual', '#6B6B70', 'Cuando hubo que entrar, entró. Apariciones breves pero firmadas con su nombre.'],
  };
  const arqNom = (k, fem) => ARQ[k] ? ARQ[k][0] + ' · ' + (fem ? ARQ[k][2] : ARQ[k][1]) : '';
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
  function svgMapa(id, pts, o) {
    const W = Math.round(Math.min(1100, Math.max(300, (innerWidth || 1000) - (innerWidth < 720 ? 64 : 120)))), H = Math.round(W < 600 ? W * 1.05 : W * 0.48);
    const L = 62, R = 12, T = 14, B = 44, w = W - L - R, h = H - T - B;
    const sx = v => L + Math.max(0, Math.min(1, (v - o.xmin) / (o.xmax - o.xmin))) * w, sy = v => T + h - (v - o.ymin) / (o.ymax - o.ymin) * h;
    const tx = paso(o.xmax - o.xmin), ty = paso(o.ymax - o.ymin), g = [];
    for (let v = Math.ceil(o.xmin / tx) * tx; v <= o.xmax + 1e-9; v += tx) g.push(`<line x1="${sx(v)}" x2="${sx(v)}" y1="${T}" y2="${T + h}" stroke="#26262A"/><text x="${sx(v)}" y="${T + h + 16}" text-anchor="middle">${dec(+v.toFixed(2))}</text>`);
    for (let v = Math.ceil(o.ymin / ty) * ty; v <= o.ymax + 1e-9; v += ty) g.push(`<line x1="${L}" x2="${L + w}" y1="${sy(v)}" y2="${sy(v)}" stroke="#26262A"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${dec(+v.toFixed(1))}${o.ysuf || ''}</text>`);
    let zon = '';
    if (o.zonas) {
      const z = o.zonas, xm = sx(z.mediana), xp = sx(z.p85), yg = sy(z.medianaGoles), et = (x, y, t, anc = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anc}" fill="#6B6B70" font-weight="700" letter-spacing=".08em">${t}</text>`;
      zon = `<rect x="${xp}" y="${T}" width="${Math.max(0, L + w - xp)}" height="${h}" fill="rgba(211,32,42,.10)"/>
        <line x1="${xm}" x2="${xm}" y1="${T}" y2="${T + h}" stroke="#55555B" stroke-dasharray="4 4"/><line x1="${xm}" x2="${xp}" y1="${yg}" y2="${yg}" stroke="#55555B" stroke-dasharray="4 4"/>
        ${L + w - xp > 70 ? et((xp + L + w) / 2, T + 16, 'REFERENTES') : et(L + w - 4, T + 16, 'REFERENTES', 'end')}
        ${xp - xm > 80 ? et((xm + xp) / 2, T + 16, 'GOLEADORES') + et((xm + xp) / 2, T + h - 8, 'PASADORES') : ''}${xm - L > 60 ? et(L + 8, T + 16, 'APOYO', 'start') : ''}`;
    }
    VISTA[id] = pts;
    const punto = (q, i) => q.nuestro
      ? `<circle class="mp-p" data-m="${id}" data-i="${i}" cx="${sx(q.x)}" cy="${sy(q.y)}" r="7" fill="${RED}" stroke="#FFFFFF" stroke-width="1.5"/>`
      : `<circle class="mp-p" data-m="${id}" data-i="${i}" cx="${sx(q.x)}" cy="${sy(q.y)}" r="5" fill="${q.hueco ? 'none' : 'rgba(166,166,173,.55)'}" stroke="${q.hueco ? '#A6A6AD' : 'none'}" stroke-width="1.5"/>`;
    const orden = pts.map((q, i) => [q, i]).sort((a, b) => a[0].nuestro - b[0].nuestro);
    return `<svg class="mapa-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.aria)}" style="display:block;max-width:${W}px;font-size:12px;fill:#8A8A8F;font-family:'IBM Plex Sans Condensed',sans-serif">
      ${g.join('')}${zon}<line x1="${L}" x2="${L + w}" y1="${T + h}" y2="${T + h}" stroke="#55555B"/>
      ${orden.map(([q, i]) => punto(q, i)).join('')}
      <text x="${L + w / 2}" y="${H - 6}" text-anchor="middle" fill="#A6A6AD">${esc(o.xlab)}</text>
      <text transform="translate(14 ${T + h / 2}) rotate(-90)" text-anchor="middle" fill="#A6A6AD">${esc(o.ylab)}</text></svg>
      <div class="mapa-info" data-info="${id}" aria-live="polite" style="min-height:40px;margin-top:8px;font-size:14px;color:#A6A6AD">Toca un punto para ver quién es.</div>`;
  }
  const infoMapa = (c) => { const q = (VISTA[c.dataset.m] || [])[+c.dataset.i], box = view.querySelector(`[data-info="${c.dataset.m}"]`); if (!q || !box) return;
    view.querySelectorAll('.mp-p.sel').forEach(x => x.classList.remove('sel')); c.classList.add('sel');
    box.innerHTML = q.info; };
  document.addEventListener('click', e => { const c = e.target.closest && e.target.closest('.mp-p'); if (c) infoMapa(c); });
  document.addEventListener('pointerover', e => { const c = e.target.closest && e.target.closest('.mp-p'); if (c && e.pointerType === 'mouse') infoMapa(c); });
  function vMapa(L, todas) {
    if (!MAPA) { cargarMapa().then(d => { if (d && /\/mapa/.test(location.hash)) render(); }); return '<div class="loading" style="padding:40px 0;color:#A6A6AD">Cargando el mapa…</div>'; }
    const M = MAPA.ligas[L.id];
    if (!M) return '<div style="padding:24px 0;color:#A6A6AD">Esta liga aún no tiene mapa.</div>';
    const nm = r => esc(corto({ nombre: r.n, apellidos: r.a }));
    const enlace = r => A.jugadores[r.k] ? `<a href="${hP(r.k)}">${nm(r)}</a>` : nm(r);
    const senior = !M.cantera, otras = senior ? Object.entries(MAPA.ligas).filter(([, x]) => !x.cantera) : [];
    const base = r => r.antes ? `${r.pj} PJ, con la temporada pasada` : `${r.pj} PJ esta temporada`;
    const lista = todas ? otras.flatMap(([id, x]) => x.jug.map(r => Object.assign({}, r, { liga: id, ligaN: x.nombre.replace('Liga ', '') }))) : M.jug;
    const conPts = lista.filter(r => r.y != null), sinPts = lista.length - conPts.length;
    const val = r => (todas ? r.xf : r.x);
    const pts = conPts.map(r => ({ x: val(r), y: r.y, nuestro: r.nuestro, hueco: todas && r.liga !== L.id,
      info: `<b style="color:#F4F4F5">${enlace(r)}</b> · ${esc(r.eq)}${todas ? ' · ' + esc(r.ligaN) : ''} ${todas ? '' : chipZona(r.zona)}<br>${dec(val(r).toFixed(2))} puntos por partido${todas ? ' en escala de Senior 1' : ''} · ${r.y}% de sus puntos son goles · ${base(r)}${r.arq ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${[r.arq].concat(r.ras || []).map(q => chipArq(q, (A.jugadores[r.k] || {}).fem)).join('')}</div>` : ''}` }));
    // el eje llega hasta donde está casi todo el mundo (percentil 97); quien se sale queda pegado al borde derecho
    const xs = pts.map(q => q.x).sort((a, b) => a - b), p97 = xs.length ? xs[Math.min(xs.length - 1, Math.floor(xs.length * 0.97))] : 1;
    const xmax = Math.max(0.5, p97 * 1.12, ...pts.filter(q => q.nuestro).map(q => q.x * 1.08));
    const fesc = M.escala || 1, um = M.umbral || {};
    const zonas = !todas && um.mediana != null ? { mediana: um.mediana / fesc, p85: um.p85 / fesc, medianaGoles: um.medianaGoles } : null;
    const mapa = svgMapa('campo', pts, { xmin: 0, xmax, ymin: -4, ymax: 104, ysuf: '%', zonas,
      xlab: todas ? 'Puntos por partido, en escala de Senior 1 (FMPe)' : 'Puntos (goles + asistencias) por partido', ylab: '% de sus puntos que son goles',
      aria: `Mapa de ${pts.length} jugadores de ${todas ? 'las ligas senior' : L.nombre}: puntos por partido y parte de goles. Los nuestros, en rojo; la lista de los nuestros va debajo.` });
    const gks = (todas ? otras.flatMap(([id, x]) => x.por.map(r => Object.assign({}, r, { liga: id, ligaN: x.nombre.replace('Liga ', '') }))) : M.por);
    const pg = gks.map(r => ({ x: r.tpj, y: r.pct, nuestro: r.nuestro, hueco: todas && r.liga !== L.id,
      info: `<b style="color:#F4F4F5">${enlace(r)}</b> · ${esc(r.eq)}${todas ? ' · ' + esc(r.ligaN) : ''}<br>${dec(r.pct)}% de paradas · ${dec(r.tpj)} tiros por partido · ${base(r)}${r.arq ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${[r.arq].concat(r.ras || []).map(q => chipArq(q, (A.jugadores[r.k] || {}).fem)).join('')}</div>` : ''}` }));
    const ys = pg.map(q => q.y);
    const mapaGk = pg.length > 2 ? svgMapa('porteros', pg, { xmin: 0, xmax: Math.max(10, ...pg.map(q => q.x)) * 1.08, ymin: Math.floor(Math.min(...ys) - 2), ymax: Math.min(100, Math.ceil(Math.max(...ys) + 2)), ysuf: '%',
      xlab: 'Tiros recibidos por partido', ylab: '% de paradas', aria: `Mapa de ${pg.length} porteros: tiros por partido y % de paradas. Los nuestros, en rojo.` }) : '';
    const nuestros = (todas ? lista : M.jug).filter(r => r.nuestro);
    const filas = nuestros.map(r => `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #26262A">
        <div style="min-width:0"><div style="font-weight:700">${enlace(r)}</div><div style="font-size:13px;color:#A6A6AD">${esc(r.eq.replace('MADRIDPATINA', 'MP'))}${todas ? ' · ' + esc(r.ligaN) : ''} · ${r.y != null ? dec(val(r).toFixed(2)) + ' pts/PJ · ' + r.y + '% goles' : 'sin puntos'} · ${base(r)}</div></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">${todas ? '' : chipZona(r.zona)}${chipArq(r.arq, (A.jugadores[r.k] || {}).fem)}</div></div>`).join('');
    const tog = senior ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 4px">${[['', 'Esta liga'], ['todas', 'Todas las ligas senior']].map(([k, t]) => `<a class="blk" href="${hLg(L.id, 'mapa' + (k ? '/' + k : ''))}"${(k === 'todas') === !!todas ? ' aria-current="page"' : ''} style="padding:7px 14px;border-radius:999px;background:${(k === 'todas') === !!todas ? RED : '#18181B'};color:${(k === 'todas') === !!todas ? '#FFFFFF' : '#C9C9CE'};font-weight:700;font-size:14px">${t}</a>`).join('')}</div>` : '';
    const leyenda = `<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:#A6A6AD;margin-top:6px"><span><span style="color:${RED}">●</span> MADRIDPATINA</span>${todas ? `<span><span style="color:#A6A6AD">●</span> ${esc(L.nombre.replace('Liga ', ''))}</span><span><span style="color:#A6A6AD">○</span> la otra liga senior</span>` : '<span><span style="color:#A6A6AD">●</span> resto de la liga</span>'}</div>`;
    return `${tog}
      <div style="font-size:15px;line-height:1.5;color:#C9C9CE;margin:10px 0 4px;max-width:860px">Cada punto es un jugador de campo. Hacia la derecha, más puntos (goles + asistencias) por partido; hacia arriba, más parte de esos puntos son goles. Quien lleva menos de ${MAPA.soloEsta} partidos esta temporada cuenta también la temporada pasada${senior ? ', en la misma escala gracias al FMPe' : ', solo en esta categoría'}${COMO('mapa')}.</div>
      <div class="card" style="padding:16px 18px;margin-top:12px">${leyenda}${mapa}${sinPts ? `<div style="font-size:13px;color:#6B6B70">${sinPts} ${sinPts === 1 ? 'jugador aún sin puntos no sale' : 'jugadores aún sin puntos no salen'} en el mapa.</div>` : ''}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:12px;align-items:start">
        <div class="card" style="padding:16px 20px">${lab('NUESTROS JUGADORES · ' + nuestros.length, 'margin-bottom:4px')}${filas || '<div style="padding:8px 0;color:#A6A6AD">Ninguno con partidos suficientes todavía.</div>'}</div>
        ${mapaGk ? `<div class="card" style="padding:16px 18px">${lab('PORTEROS', 'margin-bottom:4px')}${mapaGk}</div>` : ''}
      </div>`;
  }
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
    const tPrev = '2025/26', nomT = alc === 'temp' ? 'esta temporada' : tPrev;
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
        <div style="font-size:13px;color:#A6A6AD">${alc === 'temp' ? 'Números de esta temporada' : 'Números de 2025/26 (esta temporada aún llevan pocos partidos)'}${h2h ? ` · historial contra ellos: ${h2h.v}-${h2h.e}-${h2h.d}` : ''}</div></div></div>
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
      <div class="an-pista">${esc(d.pista || 'Pista por confirmar')}${d.habitual ? ' <span>(la habitual; la FMP aún no la ha puesto)</span>' : ''}</div>
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
          <div data-hitos class="card an-c">${hitosHtml()}</div></div>`;
        if (!el.querySelector('[data-hitos] .an-fila')) { const hh = el.querySelector('[data-hitos]'); if (hh) hh.remove(); }
      }
      if (eq) {
        const e = A.equipos.find(x => x.id === eq.dataset.agendaEq);
        const prox = AGE.partidos.filter(m => m.eq === e.id && m.fecha && m.fecha >= hoy);
        const sig = prox[0], sigCasa = prox.find(m => m.casa);
        const linea = (t, m) => m ? `<div class="an-fila" style="align-items:flex-start"><span><span class="an-sub" style="display:block;margin:0">${t}</span>${esc(fd(m.fecha))} · ${esc(m.hora || 'hora por fijar')} · ${m.casa ? 'contra' : 'en casa de'} ${esc(m.rival)}<br><span style="color:#A6A6AD">${esc(m.pista || 'Pista por confirmar')}${m.habitual ? ' (la habitual)' : ''}</span></span>${m.mapa ? `<a href="${esc(m.mapa)}" target="_blank" rel="noopener" style="white-space:nowrap">Cómo llegar →</a>` : ''}</div>` : '';
        eq.innerHTML = `<div class="an-grid dos" style="margin-top:12px"><div class="card an-c">${linea('PRÓXIMO PARTIDO', sig)}${sigCasa && sigCasa !== sig ? linea('PRÓXIMO EN CASA', sigCasa) : ''}${!sig ? '<div class="an-nota">No quedan partidos en el calendario.</div>' : ''}</div>
          <div class="card an-c">${lab('SUS PARTIDOS, EN TU CALENDARIO')}<div data-cal-caja>${calHtml(e.id, true)}</div></div></div>`;
      }
    };
    if (AGE) pon(); else cargarAgenda().then(pon);
  }

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
  function tablaHasta(L, n) {   // con los resultados del calendario (también los que aún esperan acta)
    const t = {}; L.clasif.forEach(r => { t[r.equipo] = { e: r.equipo, pts: 0, gf: 0, gc: 0, pj: 0 }; });
    (L.cal || []).filter(c => c.j <= n && c.gl != null).forEach(c => { const l = t[c.local], v = t[c.visitante]; if (!l || !v) return;
      const pen = c.mid && A.partidos[c.mid];
      l.pj++; v.pj++; l.gf += c.gl; l.gc += c.gv; v.gf += c.gv; v.gc += c.gl;
      if (c.gl > c.gv) l.pts += 3; else if (c.gl < c.gv) v.pts += 3; else if (pen && pen.pen) { (pen.pen === c.local ? l : v).pts += 2; (pen.pen === c.local ? v : l).pts += 1; } else { l.pts += 1; v.pts += 1; } });
    return Object.values(t).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf || a.e.localeCompare(b.e, 'es'));
  }
  function svgEvolucion(L) {
    const ult = L.ultima || 0; if (ult < 2) return '';
    const js = Array.from({ length: ult }, (_, i) => i + 1), eqs = L.clasif.map(r => r.equipo), n = eqs.length;
    const pos = {}; eqs.forEach(e => { pos[e] = []; });
    js.forEach(j => { const tb = j === ult ? L.clasif.map(r => ({ e: r.equipo })) : tablaHasta(L, j); tb.forEach((r, i) => { if (pos[r.e]) pos[r.e].push(i + 1); }); });
    const W = anchoGrafico(900), lab0 = W < 560 ? 64 : 120, H = 24 + n * (W < 560 ? 22 : 26), Lm = 26, Rm = lab0, Tm = 12, Bm = 22, w = W - Lm - Rm, h = H - Tm - Bm;
    const sx = j => Lm + (ult === 1 ? w / 2 : (j - 1) / (ult - 1) * w), sy = p => Tm + (p - 1) / Math.max(1, n - 1) * h;
    const linea = e => { const nos = ours(e), d = pos[e].map((p, i) => `${i ? 'L' : 'M'}${sx(i + 1).toFixed(1)},${sy(p).toFixed(1)}`).join(' ');
      return `<g class="ev-e${nos ? ' nos' : ''}" data-e="${esc(e)}" tabindex="0"><path d="${d}" fill="none" stroke="${nos ? RED : '#55555B'}" stroke-width="${nos ? 3.5 : 2}" stroke-linejoin="round" stroke-linecap="round"/>
        ${pos[e].map((p, i) => `<circle cx="${sx(i + 1).toFixed(1)}" cy="${sy(p).toFixed(1)}" r="${nos ? 4.5 : 3}" fill="${nos ? RED : '#55555B'}"/>`).join('')}
        <text x="${(sx(ult) + 10).toFixed(1)}" y="${(sy(pos[e][pos[e].length - 1]) + 4).toFixed(1)}" fill="${nos ? '#FF6B63' : '#A6A6AD'}" font-weight="${nos ? 700 : 500}">${esc(W < 560 ? abr(e) : e)}</text><title>${esc(e)}: ${pos[e].map((p, i) => 'J' + (i + 1) + ' ' + p + 'º').join(' · ')}</title></g>`; };
    const ejes = js.map(j => `<text x="${sx(j)}" y="${H - 6}" text-anchor="middle">J${j}</text>`).join('') + Array.from({ length: n }, (_, i) => `<text x="${Lm - 8}" y="${sy(i + 1) + 4}" text-anchor="end">${i + 1}</text>`).join('');
    return `<svg class="ev" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Puesto de cada equipo después de cada jornada" style="display:block;max-width:${W}px;font-size:12px;fill:#6B6B70;font-family:'IBM Plex Sans Condensed',sans-serif">${ejes}${eqs.filter(e => !ours(e)).map(linea).join('')}${eqs.filter(ours).map(linea).join('')}</svg>`;
  }
  document.addEventListener('click', e => { const g = e.target.closest && e.target.closest('.ev-e'); if (!g) return; const svg = g.closest('svg'), on = !g.classList.contains('sel');
    svg.querySelectorAll('.ev-e').forEach(x => x.classList.toggle('sel', on && x === g)); svg.classList.toggle('foco', on); });
  // simulación del resto de la liga: goles con una Poisson por equipo (ataque y defensa de esta temporada, acercados a la media
  // de la liga con 8 partidos «de media» para que pocos partidos no pesen de más); empate → penaltis al 50 %
  function simularLiga(L, veces = 4000) {
    const eqs = L.clasif.map(r => r.equipo), n = eqs.length, idx = Object.fromEntries(eqs.map((e, i) => [e, i]));
    const jug = (L.cal || []).filter(c => c.gl != null), quedan = (L.cal || []).filter(c => c.gl == null && idx[c.local] != null && idx[c.visitante] != null);
    if (!quedan.length) return null;
    const gf = Array(n).fill(0), gc = Array(n).fill(0), pj = Array(n).fill(0);
    jug.forEach(c => { const l = idx[c.local], v = idx[c.visitante]; if (l == null || v == null) return; gf[l] += c.gl; gc[l] += c.gv; gf[v] += c.gv; gc[v] += c.gl; pj[l]++; pj[v]++; });
    const tot = pj.reduce((a, b) => a + b, 0), mu = tot ? gf.reduce((a, b) => a + b, 0) / tot : 4, K = 8;
    const at = gf.map((g, i) => ((g + K * mu) / (pj[i] + K)) / mu), de = gc.map((g, i) => ((g + K * mu) / (pj[i] + K)) / mu);
    const base = tablaHasta(L, 99), pts0 = eqs.map(e => base.find(r => r.e === e).pts), dg0 = eqs.map(e => { const r = base.find(x => x.e === e); return r.gf - r.gc; });
    const poi = lam => { let L_ = Math.exp(-lam), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L_); return k - 1; };
    const cuenta = eqs.map(() => Array(n).fill(0));
    for (let s = 0; s < veces; s++) {
      const pts = pts0.slice(), dg = dg0.slice();
      quedan.forEach(c => { const l = idx[c.local], v = idx[c.visitante], a = poi(mu * at[l] * de[v]), b = poi(mu * at[v] * de[l]);
        dg[l] += a - b; dg[v] += b - a; if (a > b) pts[l] += 3; else if (b > a) pts[v] += 3; else if (Math.random() < 0.5) { pts[l] += 2; pts[v] += 1; } else { pts[v] += 2; pts[l] += 1; } });
      eqs.map((e, i) => i).sort((x, y) => pts[y] - pts[x] || dg[y] - dg[x] || Math.random() - 0.5).forEach((i, p) => { cuenta[i][p]++; });
    }
    return { eqs, prob: cuenta.map(r => r.map(c => c / veces)), quedan: quedan.length };
  }
  function vEvolucion(L) {
    const ev = svgEvolucion(L), sim = simularLiga(L);
    const n = L.clasif.length;
    let mat = '';
    if (sim) {
      const orden = sim.eqs.map((e, i) => i).sort((a, b) => sim.prob[b].reduce((s, v, p) => s + v * (n - p), 0) - sim.prob[a].reduce((s, v, p) => s + v * (n - p), 0));
      const celda = v => { const a = Math.min(1, v * 2.2); return `<td style="background:rgba(211,32,42,${(a * 0.9).toFixed(2)});color:${a > 0.5 ? '#FFFFFF' : '#A6A6AD'}">${v >= 0.005 ? Math.round(v * 100) : ''}</td>`; };
      const nos = orden.filter(i => ours(sim.eqs[i])).map(i => { const pr = sim.prob[i], best = pr.indexOf(Math.max(...pr));
        let lo = best, hi = best, acc = pr[best]; while (acc < 0.6 && (lo > 0 || hi < n - 1)) { if (hi < n - 1 && (lo === 0 || pr[hi + 1] >= pr[lo - 1])) acc += pr[++hi]; else acc += pr[--lo]; }
        const arriba = pr.slice(0, Math.ceil(n / 2)).reduce((a, b) => a + b, 0);
        return `<div class="an-fila"><span><b style="color:#FF6B63">${esc(mpAbr(sim.eqs[i]))}</b> · lo más probable: ${lo === hi ? (lo + 1) + 'º' : `entre el ${lo + 1}º y el ${hi + 1}º`} (${pct(acc)})</span><span class="h">${pr[0] >= 0.01 ? `1º: ${pct(pr[0])}` : `mitad de arriba: ${pct(arriba)}`}</span></div>`; }).join('');
      mat = `<div class="card an-c">${lab('¿DÓNDE PUEDE ACABAR CADA EQUIPO?')}<div class="an-nota" style="margin-top:2px">Jugamos los ${sim.quedan} partidos que quedan 4.000 veces con lo que lleva marcado y encajado cada equipo esta temporada. Cada casilla: en cuántas de cada 100 acaba en ese puesto.${COMO('probabilidad')}</div>
        ${nos}<div class="an-tabla"><table><thead><tr><th></th>${Array.from({ length: n }, (_, p) => `<th>${p + 1}º</th>`).join('')}</tr></thead><tbody>
        ${orden.map(i => `<tr class="${ours(sim.eqs[i]) ? 'nos' : ''}"><th>${esc(W_corta(sim.eqs[i]))}</th>${sim.prob[i].map(celda).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="an-nota">Con pocas jornadas jugadas casi todo está abierto; se afina cada semana. No sabe de bajas ni de fichajes.</div></div>`;
    }
    return `<div class="an-grid una" style="margin-top:20px">${ev ? `<div class="card an-c">${lab('CLASIFICACIÓN JORNADA A JORNADA')}<div class="an-nota" style="margin-top:2px">El puesto de cada equipo después de cada jornada. Toca una línea para seguirla.</div>${ev}</div>` : '<div class="card an-c"><div class="an-nota">Hacen falta dos jornadas para dibujar la evolución.</div></div>'}${mat}</div>`;
  }
  const W_corta = n => (innerWidth < 560 ? abr(n) : n);

  /* ── 6. Ficha de jugador ────────────────────────────────── */
  // FMPe (scripts/reporte/fmpe.py): puntos por partido × factor de su liga × 18, o sea, puntos en una temporada de Senior 1
  const FMPE_PJ = 18;
  const nivelSenior = liga => { const n = (liga || '').toUpperCase(), m = /SENIOR\s*(\d)/.exec(n); return m && !/FEMENIN/.test(n) ? 's' + m[1] : null; };
  function vJugador(k) {
    let p = A.jugadores[k] || Object.values(A.jugadores)[0];
    const hj = H && H.byTok[H.tok(p.nombre + ' ' + p.apellidos)];
    const TS = Object.assign({}, p.temporadas), FM = (H && H.fmpe) || {};
    const catDe = liga => { const n = (liga || '').toUpperCase(); return /ALEV/.test(n) ? 'Alevín' : /INFANT/.test(n) ? 'Infantil' : /BENJAM/.test(n) ? 'Benjamín' : /JUVENIL/.test(n) ? 'Juvenil' : ''; };
    if (hj) { const agg = {}; hj.temporadas.forEach(t => { const a = agg[t.temporada] || (agg[t.temporada] = { pj: 0, goles: 0, asistencias: 0, pim: 0, eqs: [], fx: 0, fpj: 0, tiros: 0, gc: 0 }); a.pj += t.pj; a.goles += t.g; a.asistencias += t.a; a.pim += t.pim || 0;
      const l = t.equipo === 'MADRIDPATINA' && catDe(t.liga) ? 'MP ' + catDe(t.liga) : t.equipo.replace('MADRIDPATINA', 'MP'); if (!a.eqs.includes(l)) a.eqs.push(l);
      if (t.rol === 'GOALIE' && t.tiros) { a.tiros += t.tiros; a.gc += t.gc || 0; return; }   // de portero: sus tiros, no cuenta para el FMPe
      const f = FM[nivelSenior(t.liga)]; if (f) { a.fx += (t.g + t.a) * f; a.fpj += t.pj; } }); Object.keys(agg).forEach(t => { const a = agg[t]; TS[t] = Object.assign(a, { fmpe: a.fpj >= 3 ? a.fx / a.fpj * FMPE_PJ : null }); }); }
    if (H) Object.keys(TS).forEach(t => { if (t !== A.temporada && !(hj && hj.temporadas.some(x => x.temporada === t))) delete TS[t]; });
    // la temporada en curso de un portero: tiros y paradas de sus partidos
    const enPorteria = (p.partidos || []).filter(x => x.pct != null);
    if (enPorteria.length && TS[A.temporada]) { const tir = enPorteria.reduce((a, x) => a + (x.tiros || 0), 0);
      TS[A.temporada] = Object.assign({}, TS[A.temporada], { tiros: tir, gc: tir - enPorteria.reduce((a, x) => a + (x.par || 0), 0) }); }
    p = Object.assign({}, p, { temporadas: TS });
    const order = Object.keys(TS).sort().filter(t => TS[t] && (TS[t].pj || t === A.temporada));
    const max = Math.max(1, ...order.map(t => Math.max(TS[t].goles || 0, TS[t].asistencias || 0)));
    // totales en el club: el histórico llega hasta la temporada pasada; se le suma la que está en curso
    const car0 = (hj && hj.carrera) || null, ya0 = p.temporadas[A.temporada] || {};
    const car = car0 || ya0.pj ? { g: ((car0 && car0.g) || 0) + (ya0.goles || 0), a: ((car0 && car0.a) || 0) + (ya0.asistencias || 0),
      pj: ((car0 && car0.pj) || 0) + (ya0.pj || 0), temporadas: ((car0 && car0.temporadas) || 0) + (ya0.pj ? 1 : 0), pim: ((car0 && car0.pim) || 0) + (ya0.pim || 0) } : null;
    const tirosT = order.reduce((a, kk) => a + (TS[kk].tiros || 0), 0), gcT = order.reduce((a, kk) => a + (TS[kk].gc || 0), 0);
    const esPortero = p.portero || (tirosT > 0 && order.every(kk => TS[kk].tiros || !(TS[kk].goles || TS[kk].asistencias)));
    const t = equiposDe(p)[0] || teamOf(p.equipo);
    const ya = TS[A.temporada], fy = t && FM[nivelSenior(t.liga)];
    if (ya && fy && ya.pj >= 3 && !ya.tiros) TS[A.temporada] = Object.assign({}, ya, { fmpe: ((ya.goles || 0) + (ya.asistencias || 0)) / ya.pj * fy * FMPE_PJ });
    const tags = [rolDe(p).toUpperCase(), p.edad ? p.edad + ' AÑOS' : null, p.rookie ? 'DEBUTANTE' : null].filter(Boolean);
    const tile = (k2, v, ink = '') => `<div style="padding:12px 16px;background:#121214;border-radius:8px"><div style="font-size:13px;color:#A6A6AD;font-weight:600">${k2}</div><div style="${BS}font-weight:900;font-size:48px;line-height:1;${ink}">${v}</div></div>`;
    const eqYa = 'MP ' + (equiposDe(p).map(letraOf).join('·') || (p.equipo || '').replace('MADRIDPATINA', '').trim());
    const temps = order.map((kk, ti) => { const s = TS[kk]; const g = s.goles || 0, a = s.asistencias || 0;
      const izq = `<div><div style="${BS}font-weight:800;font-size:22px;line-height:1">${kk}</div><div style="font-size:13px;color:#A6A6AD">${s.pj} PJ${s.parcial ? ' · ' + esc(eqYa) + ' · en curso' : (s.eqs ? ' · ' + esc(s.eqs.join(', ')) : '')}${s.pim ? ' · ' + fmin(s.pim) + ' de sanción' : ''}</div></div>`;
      if (s.tiros) { const pc = (s.tiros - s.gc) / s.tiros * 100;
        return `<div style="display:grid;grid-template-columns:72px minmax(0,1fr) 120px;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid #26262A">${izq}
        <div data-anim="mpWipe .6s cubic-bezier(.2,.8,.2,1) ${ti * 150}ms" style="height:12px;border-radius:2px;background:${RED};width:${Math.max(2, pc)}%;transform-origin:left"></div>
        <div style="text-align:right"><div style="${BS}font-weight:800;font-size:28px;line-height:1">${dec(Math.round(pc * 10) / 10)}<span style="font-size:14px">%</span></div><div style="margin-top:5px;font-size:12px;font-weight:600;color:#A6A6AD">${s.tiros - s.gc} paradas de ${s.tiros}</div></div></div>`; }
      return `<div style="display:grid;grid-template-columns:72px minmax(0,1fr) 120px;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid #26262A">
        ${izq}
        <div style="display:flex;flex-direction:column;gap:4px"><div data-anim="mpWipe .6s cubic-bezier(.2,.8,.2,1) ${ti * 150}ms" style="height:12px;border-radius:2px;background:${RED};width:${Math.max(2, g / max * 100)}%;transform-origin:left"></div><div data-anim="mpWipe .6s cubic-bezier(.2,.8,.2,1) ${ti * 150 + 80}ms" style="height:12px;border-radius:2px;background:#8A8A8F;width:${Math.max(2, a / max * 100)}%;transform-origin:left"></div></div>
        <div style="text-align:right"><div style="display:flex;gap:12px;justify-content:flex-end;${BS}font-weight:800;font-size:28px;line-height:1"><span style="color:#FF6B63">${g}<span style="font-size:14px"> G</span></span><span>${a}<span style="font-size:14px"> A</span></span></div>${TS[kk].fmpe != null ? `<div title="Puntos que habría hecho en una temporada de Liga Senior 1 (18 partidos)" style="margin-top:5px;font-size:12px;font-weight:700;letter-spacing:.08em;color:#A6A6AD">FMPe ${dec(Math.round(TS[kk].fmpe * 10) / 10)}</div>` : ''}</div></div>`; }).join('');
    // cómo juega con el equipo (scripts/reporte/juego.py): solo lo que dice el acta, desde 3 partidos
    const cx = esPortero ? {} : p.contexto || {};
    const conEquipo = Object.keys(cx).sort().reverse().map(tt => { const c = cx[tt];
      const ns = l => l.map(([x, n]) => `${esc(corto(x))} <span style="color:#A6A6AD">${n}</span>`).join(' · ');
      const sit = [['ig', 'en igualdad'], ['sup', 'en superioridad'], ['inf', 'en inferioridad']].filter(([k2]) => c.sit[k2]).map(([k2, t2]) => c.sit[k2] + ' ' + t2).join(' · ');
      const fila = (k2, v) => `<div style="font-size:14px;margin-top:3px"><span style="color:#A6A6AD;font-weight:700">${k2}</span> ${v}</div>`;
      return `<div style="padding:12px 0;border-bottom:1px solid #26262A">
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span style="${BS}font-weight:800;font-size:22px;line-height:1">${tt}</span>${c.part != null ? `<span style="${BS}font-weight:900;font-size:30px;line-height:1;color:#FF6B63">${dec(c.part)}%</span><span style="font-size:13px;color:#A6A6AD">de los goles del equipo llevan su gol o su asistencia (${c.g + c.a} de ${c.gf}, en ${c.pj} PJ)</span>` : ''}</div>
        ${c.g ? fila('Sus goles:', sit) : ''}${c.le.length ? fila('Le asisten más:', ns(c.le)) : ''}${c.aa.length ? fila('Asiste más a:', ns(c.aa)) : ''}
        ${c.socios ? `<div style="font-size:13px;margin-top:3px;color:#A6A6AD">Ha combinado en algún gol con ${c.socios === 1 ? '1 compañero' : c.socios + ' compañeros distintos'}</div>` : ''}</div>`; }).join('');
    const resDe = x => { const m = A.partidos[x.mid]; if (!m || m.gl == null) return null;
      const yo = [m.alin_l, m.por_l, m.gol_l].some(l => (l || []).some(y => y.k === p.k)) ? 'l' : [m.alin_v, m.por_v, m.gol_v].some(l => (l || []).some(y => y.k === p.k)) ? 'v' : ours(m.local) ? 'l' : 'v';
      const [a, b] = yo === 'l' ? [m.gl, m.gv] : [m.gv, m.gl], mio = yo === 'l' ? m.local : m.visitante;
      const r = a > b ? ['Victoria', '#3DD27E'] : a < b ? ['Derrota', '#FF6B63'] : m.pen ? (m.pen === mio ? ['Gana en penaltis', '#3DD27E'] : ['Pierde en penaltis', '#FF6B63']) : ['Empate', '#C9C9CE'];
      return { txt: a + '–' + b, r, cab: 'J' + m.jornada + ' · ' + fd(m.fecha) }; };
    const partidos = p.partidos.map(x => { const rs = resDe(x); return box(hM(x.mid), 'background:#18181B;border-radius:10px;padding:14px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:12px', `
        ${disc(crest(x.rival), 48)}<div style="flex:1;min-width:0"><div style="font-size:13px;color:#A6A6AD;white-space:nowrap">${rs ? esc(rs.cab) + ' · ' : ''}vs</div><span style="${BS}font-weight:800;font-size:22px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(abr(x.rival))}</span></div>
        <div style="text-align:right"><div style="${BS}font-weight:800;font-size:24px;line-height:1">${x.pct != null ? dec(x.pct) + '%' : x.g + 'G ' + x.a + 'A'}</div>${rs ? `<div style="font-size:12px;font-weight:700;margin-top:4px;color:${rs.r[1]};white-space:nowrap">${rs.r[0]} ${rs.txt}</div>` : ''}</div>${x.pim ? `<div style="flex-basis:100%;margin-top:-6px;padding-left:60px;font-size:13px;font-weight:600;color:#A6A6AD">${fmin(x.pim)} de sanción</div>` : ''}`); }).join('');
    return `<div style="margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;align-items:stretch">
        <div class="ini ficha-foto" data-grupo style="background:linear-gradient(160deg,#D3202A 0%,#8E1219 100%);border-radius:14px;overflow:hidden;align-self:start;aspect-ratio:4/5;font-size:120px;color:#A9161E">
          <span data-anim="mpReveal .01s .45s">${esc(ini(p.nombre, p.apellidos))}</span>${photo(p.foto, 'none', '50% 15%', '', ' data-anim="mpReveal .01s .45s"')}
          <div data-anim="mpRedWipe .9s cubic-bezier(.7,0,.3,1)" style="position:absolute;inset:0;background:#D3202A;z-index:2"></div>
          <span data-anim="mpScale .5s .7s cubic-bezier(.2,.8,.2,1)" style="position:absolute;left:18px;bottom:8px;z-index:3;font-size:150px;line-height:.85;color:#fff;text-shadow:0 4px 18px rgba(0,0,0,.5);transform-origin:left bottom">${esc(p.dorsal || '')}</span>
        </div>
        <div style="grid-column:span 2;min-width:0;background:#18181B;border-radius:14px;padding:clamp(20px,3vw,32px);display:flex;flex-direction:column;gap:20px" class="fj">
          <div data-anim="mpUp .4s cubic-bezier(.2,.8,.2,1) .5s">
            ${t ? `<a href="${hEq(t.id)}" style="font-size:14px;font-weight:700;letter-spacing:.12em">${esc((p.equipo || '').toUpperCase() + ' · ' + t.liga.toUpperCase())}</a>` : `<div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#FF6B63">${esc((p.equipo || '').toUpperCase())}</div>`}
            <h1 class="pt"><span style="display:block;${BS}font-weight:900;font-size:clamp(44px,6vw,76px);line-height:.9;margin-top:6px">${esc(p.nombre.toUpperCase())}</span>
            <span style="display:block;${BS}font-weight:700;font-size:clamp(24px,3vw,36px);line-height:1;color:#A6A6AD">${esc(p.apellidos.toUpperCase())}</span></h1>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">${tags.map(tg => `<span style="font-size:13px;font-weight:700;letter-spacing:.06em;padding:4px 10px;border-radius:4px;background:#26262A">${tg}</span>`).join('')}</div>
          </div>
          <div data-arquetipo="${esc(p.k)}" data-liga="${t ? esc(t.ligaId) : ''}" data-fem="${p.fem ? 1 : ''}"></div>
          ${car ? `<div class="kpis" data-anim="mpUp .4s cubic-bezier(.2,.8,.2,1) .6s" style="display:flex;gap:10px;flex-wrap:wrap">${esPortero && tirosT
            ? tile('% de paradas', dec(Math.round((tirosT - gcT) / tirosT * 1000) / 10) + '<span style="font-size:24px">%</span>', 'color:#FF6B63') + tile('Paradas en el club', tirosT - gcT)
            : tile('Goles en el club', car.g, 'color:#FF6B63') + tile('Asistencias', car.a)}${tile('Partidos', car.pj)}${tile('Temporadas', car.temporadas)}${tile('Sanción', fmin(car.pim || 0))}</div>` : ''}
          ${(() => { const hs = H && equiposDe(A.jugadores[k] || p).length ? hitosDe(A.jugadores[k] || p) : []; return hs.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:-8px">${hs.map(h => `<span class="an-hito">${esc(hitoTxt(h))} con el club</span>`).join('')}</div>` : ''; })()}
          <div data-grupo data-espera="900">${lab('POR TEMPORADA', 'margin-bottom:' + (order.some(kk => TS[kk].fmpe != null) ? '2px' : '12px'))}${order.some(kk => TS[kk].fmpe != null) ? '<div style="font-size:13px;color:#A6A6AD;margin-bottom:10px">FMPe: los puntos que habría hecho en una temporada de Liga Senior 1, para comparar ligas distintas' + COMO('fmpe') + '</div>' : ''}${temps}</div>
          ${conEquipo ? `<div data-grupo data-espera="900">${lab('CON EL EQUIPO', 'margin-bottom:2px')}<div style="font-size:13px;color:#A6A6AD;margin-bottom:4px">Lo que dice el acta: en cuántos goles del equipo participa, en qué situación marca y con quién combina${COMO('ficha')}</div>${conEquipo}</div>` : ''}
          <div data-ficha-extra="${esc(p.k)}"></div>
          <div data-parecidos="${esc(p.k)}" data-liga="${t ? esc(t.ligaId) : ''}" data-portero="${esPortero ? 1 : ''}"></div>
        </div>
      </div>
      ${p.partidos.length ? `${lab('PARTIDOS ' + A.temporada, 'margin:28px 0 10px')}${svgTemporada(p)}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">${partidos}</div>` : ''}`;
  }

  /* ── Cómo lo calculamos: cada número que publicamos, de dónde sale y qué no puede decir ─────────────────────────────── */
  const COMO = sec => ` · <a href="#/metodo/${sec}">cómo se calcula</a>`;
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
    const datos = sec('datos', '01', 'LOS DATOS', 'De dónde salen', 'Todos los números salen de las actas de la Federación Madrileña de Patinaje (FMP), desde la temporada 2016/17. La web se actualiza cada semana, y los partidos en directo, mientras se juegan.', `
      <div class="mt-dos">
        <div class="mt-caja"><h3 style="color:#3DD27E">LO QUE TRAE EL ACTA</h3>${lista(['Quién marca y quién asiste (una asistencia por gol)', 'Las expulsiones, con su minuto y su duración', 'Tiempos muertos y cambios de portero', 'De cada portero, los tiros que recibe y los goles que encaja'], '✓', '#3DD27E')}</div>
        <div class="mt-caja"><h3 style="color:#FF6B63">LO QUE NO TRAE</h3>${lista(['Más/menos', 'Minutos jugados', 'Quién estaba en pista en cada gol', 'Los tiros de los jugadores de campo'], '✕')}<p class="mt-nota">Por eso no publicamos ninguno de esos datos.</p></div>
      </div>
      ${lista(['De los menores de edad no publicamos ni foto ni edad.'])}`);

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
      ${barras ? H('Factor de cada liga') + `<div class="mt-barras">${barras}</div><div class="mt-leyenda"><span><i class="l1"></i>factor</span><span><i class="l2"></i>margen: 8 de cada 10 cálculos con otra muestra de jugadores caen dentro</span></div>` : ''}
      ${cambio ? `<div class="mt-k">10 puntos de Senior 1 equivalen a…</div><div class="mt-cambio">${cambio}</div>` : ''}
      ${fac.S4 && fac.S4.provisional ? `<p class="mt-nota">* Senior 4 empezó en 2026/27 y todavía no hay suficientes jugadores que hayan jugado en ella y en otra liga. Hasta entonces se usa el factor de la antigua Senior 3, que reunía a los equipos de las dos. Se recalculará cuando haya datos.</p>` : ''}
      ${H('Cómo se calculan los factores')}
      ${P(`Con los jugadores que han jugado en dos ligas distintas. Comparamos sus puntos por partido en cada una: como es el mismo jugador, la diferencia indica cuánto más difícil es una liga que otra. Usamos <b>${F.casos || '—'} cambios de liga de ${F.jugadores || '—'} jugadores de campo</b>, de ${F.desde || '—'} a ${F.hasta || '—'}, con al menos 6 partidos en cada liga.`)}
      ${P('Calculamos por separado a los que suben de liga y a los que bajan, y hacemos la media de los dos casos. Quien sube suele estar mejorando y quien baja, empeorando; con la media se compensa.')}
      ${dir.length ? tabla(['Cambio de liga', 'Casos', 'Puntos por partido, antes → después'], dir) : ''}
      ${f2 ? H('Un ejemplo') + `<p class="mt-p">Un jugador de Senior 2 con 29 goles y 18 asistencias: 47 puntos en 18 partidos.</p>
        <div class="mt-pasos"><div class="mt-paso"><div class="t"><b>Puntos por partido en su liga</b><small>47 ÷ 18</small></div><div class="r">${d2(ppg)}</div></div>
          <div class="mt-paso"><div class="t"><b>Pasados a Senior 1</b><small>${d2(ppg)} × ${fx(f2, 3)}</small></div><div class="r">${fx(ppg * f2, 3)}</div></div>
          <div class="mt-paso fin"><div class="t"><b>Una temporada de Senior 1</b><small>${fx(ppg * f2, 3)} × ${PJ}</small></div><div class="r">${d1(ppg * f2 * PJ)}<small>FMPe</small></div></div></div>` : ''}
      <div class="mt-dos">
        <div class="mt-caja"><h3 style="color:#3DD27E">DÓNDE SALE</h3>${lista(['En la ficha de cada jugador, en cada temporada senior con 3 partidos o más', 'En la pretemporada: la fuerza de cada plantilla y los más peligrosos', 'En la presentación del directo, para ordenar a los rivales peligrosos', 'En el pronóstico de la temporada'], '→', '#3DD27E')}</div>
        <div class="mt-caja"><h3 style="color:#FF6B63">LÍMITES</h3>${lista(['No mide la defensa ni nada que no esté en el acta', 'Con pocos partidos, el dato es poco fiable', `Antes de ${F.desde || '2021/22'} se usan los mismos factores, calculados con las temporadas recientes`, 'No se calcula para porteros'], '!')}</div>
      </div>`);

    // 3 · pretemporada
    const tarj = (ic, t, x) => `<div class="mt-tarj"><div class="ic">${ic}</div><b>${t}</b><p>${x}</p></div>`;
    const pre = sec('pretemporada', '03', 'PRETEMPORADA', 'Cómo llega cada equipo', 'Antes de empezar la temporada, con lo que hizo cada jugador la temporada pasada y el equipo en el que juega este año.', `
      <div class="mt-tarjetas">
        ${tarj('▮▮▯', 'Fuerza de cada plantilla', 'Los puntos de la temporada pasada de los jugadores de este año, pasados al nivel de esta liga con el FMPe. Los que siguen cuentan lo que hicieron con el equipo; los que llegan, lo de su equipo anterior. Los que aún no han jugado este año cuentan la mitad (la parte oscura de la barra). Es una estimación: no tiene en cuenta quién juega cada partido.')}
        ${tarj('⚠', 'Jugadores más peligrosos', 'Puntos por partido de la temporada pasada más la mitad de los de la anterior, pasados al nivel de esta liga con el FMPe, con 4 partidos o más. Se toman los cinco con más puntos de cada equipo y, de ellos, salen los 10 mejores de la liga.')}
        ${tarj('%', 'Porteros más fiables', 'Paradas entre tiros recibidos. La temporada pasada cuenta entera y la anterior a la mitad, y hacen falta unos 150 tiros (unos cinco partidos) para entrar en la lista.')}
        ${tarj('↻', 'Renovación de plantillas', 'Qué parte de los puntos que hizo el equipo la temporada pasada siguen en la plantilla de este año, y cuántas caras nuevas hay.')}
      </div>`);

    // 4 · en directo
    const pista = `<div class="mt-pista" aria-hidden="true"><div class="eq"><span>4</span>${'<i class="r"></i>'.repeat(4)}</div><div class="vs">contra</div><div class="eq"><span>3</span>${'<i></i>'.repeat(3)}<i class="fuera"></i></div><div class="crono">2:00</div></div>`;
    const hito = (t, x) => `<div class="mt-hito"><span class="dv-hito">${t}</span><span>${x}</span></div>`;
    const directo = sec('directo', '04', 'EN DIRECTO', 'Qué marca el directo', 'Durante el partido, y después en su resumen, el minuto a minuto indica en qué situación se marcó cada gol, sus hitos y los rivales con más puntos.', `
      ${H('Superioridad e inferioridad')}
      <div class="mt-dos al"><div>${pista}</div><div>${lista(['Las expulsiones de 1\'30\'\', 2 y 5 minutos dejan al equipo con uno menos; las de 10 no, porque entra otro.', 'Si coinciden dos, se suman.', 'La de 2 minutos o menos se acaba si marca el que está con uno más.', 'Si no ha acabado al descanso, sigue en la segunda parte.', '«Portería vacía», cuando el acta apunta que sale el portero y no entra otro.'])}</div></div>
      ${H('Hitos de cada gol')}
      <div class="mt-hitos">
        ${hito('SU PRIMER GOL', 'El primero que tenemos de esa persona en la FMP, desde 2016/17.')}
        ${hito('1.er GOL DE LA TEMPORADA', 'El primero de esa persona esta temporada, en cualquier categoría.')}
        ${hito('HAT TRICK', 'El tercer gol del mismo jugador en el partido. Luego vienen <span class="dv-hito">PÓKER</span> y <span class="dv-hito">MANITA</span>.')}
        ${hito('SUPERA SU MEDIA', 'Cuando llega a 2 goles o más y al menos al doble de su media por partido (la temporada pasada y esta antes del partido, con 5 partidos o más). Lo mismo con las asistencias.')}
      </div>
      <p class="mt-nota">Salen en el minuto a minuto, en la escena de cada gol y en la pantalla final del resumen. Si no tenemos datos recientes del jugador, no se dice nada de su historial.</p>
      ${H('Rivales peligrosos en la presentación')}
      <div class="mt-dos al"><div class="mt-riv" aria-hidden="true"><div class="j"><b>22</b><span>Rival 1<small>PELIGRO · 1,15 puntos por partido en 2025/26</small></span></div><div class="j otro"><b>7</b><span>Rival 2</span></div><div class="j"><b>4</b><span>Rival 3<small>PELIGRO · 0,93 puntos por partido en 2025/26</small></span></div></div>
        <div>${P('Los 3 jugadores del rival con más puntos por partido, sumando esta temporada antes del partido y la pasada (4 partidos o más, o 2 de esta temporada), siempre que pasen de 0,4. En senior cuentan todas las ligas senior, pasadas a la del partido con el FMPe. Al lado se muestran sus números reales.')}</div></div>
      ${H('El resumen de un partido')}
      ${P('Reproduce el partido con los minutos del acta. Los tiros y las paradas de cada portero solo se ven al final, porque el acta no dice cuándo fue cada tiro.')}`);

    // 5 · ficha del jugador
    const ficha = sec('ficha', '05', 'FICHA DEL JUGADOR', 'Con el equipo', 'En la ficha de cada jugador nuestro, su peso en los goles del equipo. Solo con datos del acta y a partir de 3 partidos.', `
      <div class="mt-dos al">
        <div class="mt-ficha" aria-hidden="true"><div class="cab"><span class="t">2025/26</span><span class="p">43,5%</span><span class="x">de los goles del equipo llevan su gol o su asistencia (47 de 108, en 18 PJ)</span></div>
          <div><span class="k">Sus goles:</span> 27 en igualdad · 1 en superioridad · 1 en inferioridad</div><div><span class="k">Le asisten más:</span> un compañero <span class="g">5</span></div><div class="pie">Ejemplo</div></div>
        <div>${lista(['<b>Participación</b>: de los goles que marcó su equipo en los partidos que jugó, en cuántos marcó o asistió.', '<b>Sus goles</b>: cuántos fueron en igualdad, en superioridad y en inferioridad, contados como en el directo.', '<b>Le asisten más / asiste más a</b>: con quién combina en los goles (dos veces o más) y con cuántos compañeros distintos ha combinado alguna vez.'])}</div>
      </div>`);

    // 6 · mapa de jugadores y «se parece a»
    const mapaM = sec('mapa', '06', 'MAPA Y ARQUETIPOS', 'Dónde está cada jugador de la liga', 'En cada liga, un mapa con todos los jugadores de campo: hacia la derecha, más puntos por partido; hacia arriba, más parte de sus puntos son goles. Los nuestros, en rojo.', `
      ${lista(['<b>Puntos por partido</b>: goles más asistencias, entre partidos jugados. En senior se pasan a la escala de Senior 1 con el FMPe, para poder juntar temporadas y ligas. En el mapa de una liga se enseñan en la escala de esa liga; en «Todas las ligas senior», en la de Senior 1.', '<b>Parte de goles</b>: de sus puntos, cuántos son goles. El resto son asistencias.', '<b>Qué partidos cuentan</b>: los de esta temporada en esa liga y, hasta que el jugador lleva 6, también los de la temporada pasada (en la cantera, solo los de la misma categoría, porque muchos juegan en Alevín e Infantil). Hacen falta 3 partidos en total para salir.', '<b>Porteros</b>, en su propio mapa: % de paradas y tiros recibidos por partido.'])}
      ${H('Zonas')}
      ${lista(['<b>Referentes</b>: el 15 % de la liga con más puntos por partido.', '<b>Goleadores</b> y <b>Pasadores</b>: del resto, los que están por encima de la mitad de la liga en puntos por partido. Goleadores si su parte de goles es mayor que la de la mitad de la liga; pasadores si es menor.', '<b>Apoyo</b>: los que están por debajo de la mitad de la liga en puntos por partido.'])}
      ${H('Arquetipos')}
      ${P('Los mismos datos dan a cada jugador un arquetipo, comparándolo con los jugadores de su liga. Se mira en este orden y se queda con el primero que cumple:')}
      ${lista(['<b>Sniper</b>: está en el 15 % de su liga con más goles por partido y marca más que asiste.', '<b>Playmaker</b>: está en el 15 % con más asistencias por partido y asiste al menos tanto como marca.', '<b>Momentum</b>: está en el 15 % con más puntos por partido.', '<b>Wildcard</b>: marca más que la mitad de su liga y está en el 15 % con más minutos de sanción por partido.', '<b>Ghost</b>: 7 partidos o menos.', '<b>Steady</b>: por encima de la mitad de su liga en puntos por partido.', '<b>Wall</b>: 12 partidos o más, en la cuarta parte de su liga con menos puntos y casi sin sanción.', '<b>Workhorse</b>: el resto.'])}
      ${P('Rasgos, que se suman al arquetipo:')}
      ${lista(['<b>Game Changer</b>: 3 goles o más que dieron la victoria (el gol que deja al ganador con uno más de los que acabó marcando el rival).', '<b>Comeback King</b>: 5 goles o más con su equipo por detrás en el marcador.', '<b>Hot Streak</b>: marcó en 5 partidos seguidos o más.', '<b>One Man Show</b>: participa en el 35 % o más de los goles de su equipo (desde 6 partidos).', '<b>Polivalente</b>: ha jugado en portería y en campo.', '<b>Rookie Phenom</b>: primera temporada en senior y por encima de la mitad de su liga.', '<b>Veterano</b>: 5 temporadas o más en el club.', '<b>Leyenda</b>: entre los 3 primeros de la historia del club en goles, asistencias o partidos.'])}
      ${P('Porteros, comparados con los porteros de su liga: <b>Shadow</b> (4 partidos o menos), <b>Iron Curtain</b> (el 25 % con mejor % de paradas), <b>Reactive Wall</b> (el 25 % que más tiros recibe y para más que la mitad), <b>Embattled</b> (el 25 % que más tiros recibe), <b>Undershot</b> (el 25 % que menos tiros recibe) y <b>Workhorse</b> (10 partidos o más).')}
      ${H('Se parece a')}
      ${P('En la ficha de cada jugador nuestro salen los 3 jugadores de otros clubes con los números más parecidos: goles y asistencias por partido (en la escala de Senior 1), parte de los goles de su equipo en los que participa y minutos de sanción por partido. Cada número pesa lo mismo. Senior se compara con senior, la cantera con la cantera y los porteros con porteros, por % de paradas y tiros por partido.')}
      <div class="mt-caja"><h3 style="color:#FF6B63">LÍMITES</h3>${lista(['No mide la defensa ni nada que no esté en el acta', 'Con pocos partidos, el punto de cada jugador se mueve mucho', 'En la cantera no hay factor entre ligas: los números van tal cual'], '!')}</div>`);

    // 7 · probabilidades y análisis del equipo
    if (!ANA) cargarAnalisis().then(d => { if (d && /^#\/metodo/.test(location.hash)) render(); });
    const T7 = ANA && ANA.prob && ANA.prob.senior, cel = (d, q) => { const r = T7.tabla[d][q]; return `${Math.round(r[0] * 100)} % · ${Math.round(r[1] * 100)} % · ${Math.round(Math.max(0, 1 - r[0] - r[1]) * 100)} %`; };
    const probM = sec('probabilidad', '07', 'PROBABILIDADES Y ANÁLISIS', 'Qué pasa normalmente con cada marcador', 'Con todos los partidos de la FMP desde 2016/17 sabemos cuántas veces acaba ganando el que va por delante según la ventaja y los minutos que quedan. Con eso se dibuja el gráfico de cada partido, las opciones de ganar del directo y la simulación de la liga.', `
      ${T7 ? H('Senior: el que va ganando… gana · empata (penaltis) · pierde') + tabla(['Ventaja', 'Quedan 10 min', 'Quedan 5 min', 'Quedan 2 min'], [1, 2, 3].map(d => `<tr>${td(d === 3 ? '3 goles o más' : d + (d === 1 ? ' gol' : ' goles'))}${td(cel(d, 10), 'n')}${td(cel(d, 5), 'n')}${td(cel(d, 2), 'n')}</tr>`)) + `<p class="mt-nota">Con ${T7.partidos} partidos senior completos (con el minuto de todos los goles). La cantera tiene su propia tabla, con partes de 20 minutos.</p>` : ''}
      ${lista(['<b>Gráfico del partido</b>: en cada momento, con el marcador y los minutos que quedan, cuántas veces gana cada equipo y cuántas se va a los penaltis. No sabe quién juega ni cómo va el partido: solo el marcador y el reloj. No cuenta el factor campo.', '<b>Opciones de ganar en el directo</b>: lo mismo, con el minuto del último apunte del acta (el acta no publica el reloj en marcha).', '<b>¿Dónde puede acabar cada equipo?</b>: jugamos 4.000 veces los partidos que quedan. Los goles de cada partido salen al azar según lo que marca y encaja cada equipo esta temporada, acercado a la media de la liga como si llevara 8 partidos más «normales» (así, con pocas jornadas, un resultado no pesa de más). Un empate se decide a los penaltis al 50 %.'])}
      ${H('Cómo juega cada equipo')}
      ${lista(['<b>Cuándo marca y cuándo encaja</b>: los goles de cada tramo de 5 minutos, con el minuto del acta. Si al acta le falta el minuto de algún gol, ese partido no entra.', '<b>Ventajas y remontadas</b>: partidos en los que fue por delante y no ganó en el tiempo de juego (un empate que se gana en los penaltis cuenta como no ganado), los que ganó yendo por detrás y cómo acaba cuando marca o encaja primero.', '<b>Tiros a puerta</b>: los que recibe cada portero, que es lo único que apunta el acta. Así sabemos los tiros de cada equipo, pero no quién tira. Acierto = goles ÷ tiros.', '<b>Con uno más y con uno menos</b>: los goles marcados con superioridad o inferioridad, contados como en el directo.', '<b>Quién asiste a quién</b>: las parejas que han hecho goles juntas (uno asiste y otro marca). Desde 2025/26 el acta solo da el dorsal de quien asiste; se busca en la alineación de ese partido.', '<b>Próximo rival</b>: los mismos números de los dos equipos, de esta temporada si los dos llevan 4 partidos o más; si no, de la temporada pasada.'])}
      ${H('Hitos a la vista y agenda')}
      ${lista(['<b>Hitos a la vista</b>: a quién le faltan como mucho 3 goles o 3 asistencias, 2 partidos o 40 paradas para una cifra redonda (10, 25, 50, 75, 100, 150…) con el club, contando todas sus temporadas.', '<b>Pista de cada partido</b>: la del calendario de la FMP. Si la FMP no la pone (el calendario de Infantil 2 no la publica), la pista habitual del equipo local, y se avisa.', '<b>Calendarios para el móvil</b>: los mismos partidos, en un enlace que Google Calendar, el iPhone u Outlook vuelven a leer cada pocas horas.'])}
      <div class="mt-caja"><h3 style="color:#FF6B63">LÍMITES</h3>${lista(['Son frecuencias del pasado, no una predicción de lo que va a pasar', 'No sabe de bajas, lesiones ni fichajes', 'Con pocos partidos jugados, los números de cada equipo se mueven mucho'], '!')}</div>`);

    const indice = [['datos', '01', 'Los datos', 'De dónde sale cada número'], ['fmpe', '02', 'FMPe', 'Los puntos de cada liga, en la misma escala'],
      ['pretemporada', '03', 'Pretemporada', 'Fuerza, peligrosos y porteros de cada liga'], ['directo', '04', 'En directo', 'Hitos, superioridades y rivales peligrosos'],
      ['ficha', '05', 'Ficha del jugador', 'Con quién combina cada uno'], ['mapa', '06', 'Mapa y arquetipos', 'Dónde está cada uno, su arquetipo y a quién se parece'],
      ['probabilidad', '07', 'Probabilidades y análisis', 'Opciones de ganar, simulación de la liga y cómo juega cada equipo']]
      .map(([id, n, t, x]) => `<a class="blk" href="#/metodo/${id}"><span class="n">${n}</span><b>${t}</b><span class="x">${x}</span></a>`).join('');
    return `<div class="mt-hero"><div class="lab" style="color:#FF6B63">MADRIDPATINA · MÉTODO</div><h1>Cómo lo calculamos</h1>
        <p>Qué mide cada número de la web, de dónde sale y cómo se calcula. Todo son cuentas con los datos de las actas de la federación.</p></div>
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
      if (m) { m.temporadas = m.temporadas.concat(j.temporadas); m.ahora = (m.ahora || []).concat(j.ahora || []);
        m.adulto = m.adulto === true || j.adulto === true ? true : m.adulto === false && j.adulto === false ? false : (m.adulto ?? j.adulto); const acc = x => (x.match(/[áéíóúÁÉÍÓÚ]/g) || []).length; if (acc(j.nombre) > acc(m.nombreRaw)) { m.nombreRaw = j.nombre; m.nombre = tc(j.nombre); } }
      else Hx.byTok[k] = { tok: k, nombreRaw: j.nombre, nombre: tc(j.nombre), temporadas: j.temporadas.slice(), adulto: j.adulto, ahora: (j.ahora || []).slice() };
    });
    Hx.jugadores = Object.values(Hx.byTok).map(j => Object.assign(j, { carrera: { pj: j.temporadas.reduce((s, t) => s + t.pj, 0), g: j.temporadas.reduce((s, t) => s + t.g, 0), a: j.temporadas.reduce((s, t) => s + t.a, 0), pim: j.temporadas.reduce((s, t) => s + (t.pim || 0), 0), hattricks: j.temporadas.reduce((s, t) => s + (t.hattricks || 0), 0), temporadas: new Set(j.temporadas.map(t => t.temporada)).size } }))
      .sort((a, b) => b.carrera.g - a.carrera.g || b.carrera.a - a.carrera.a);
    Hx.tok = tok;
    return Hx;
  }
  function vHistorico() {
    if (!H && hCargando) return '<div class="loading">Cargando el legado…</div>';
    const deco = arr => { const mx = Math.max(1, ...arr.map(s => s.v + s.e + s.d)); return arr.map(s => { const pj = s.v + s.e + s.d; return Object.assign(s, { pj, h: Math.max(4, pj / mx * 220) + 'px', pct: pj ? Math.round(s.v / pj * 100) + '% V' : '—' }); }); };
    let hi;
    if (H) {
      const lbl = (n, liga) => { if (n === 'MADRIDPATINA') return /ALEV/i.test(liga || '') ? 'Alevín' : /INFANT/i.test(liga || '') ? 'Infantil' : 'MP'; return 'Equipo ' + n.split(' ').pop(); };
      const cur = Object.values(A.partidos).filter(p => p.gl != null && (ours(p.local) || ours(p.visitante))).map(p => ({ temporada: A.temporada, local: p.local, visitante: p.visitante, gl: p.gl, gv: p.gv, liga: p.ligaNombre }));
      const hm = H.partidos.concat(cur).map(p => { const casa = ours(p.local); const n = casa ? p.gl : p.gv, o = casa ? p.gv : p.gl; return { t: p.temporada, n, o, rival: casa ? p.visitante : p.local, eqName: casa ? p.local : p.visitante, liga: p.liga, derbi: ours(p.local) && ours(p.visitante) }; }).filter(p => !p.derbi);
      const temps = H.temporadas.concat(H.temporadas.includes(A.temporada) ? [] : [A.temporada]);
      const hs = deco(temps.map(t => { const ms = hm.filter(m => m.t === t); const c = { V: 0, E: 0, D: 0 }; ms.forEach(m => c[m.n > m.o ? 'V' : m.n < m.o ? 'D' : 'E']++); return { t, v: c.V, e: c.E, d: c.D }; }));
      const ht = hs.reduce((s, x) => ({ v: s.v + x.v, e: s.e + x.e, d: s.d + x.d }), { v: 0, e: 0, d: 0 });
      const hb = hm.slice().sort((a, b) => (b.n - b.o) - (a.n - a.o))[0], hw = hm.slice().sort((a, b) => (a.n - a.o) - (b.n - b.o))[0];
      const seasonsAll = [].concat(...H.jugadores.map(j => { const ag = {}; j.temporadas.forEach(t => { const a = ag[t.temporada] || (ag[t.temporada] = { temporada: t.temporada, g: 0, a: 0, eq: [] }); a.g += t.g; a.a += t.a; const l = t.equipo.replace('MADRIDPATINA', 'MP'); if (!a.eq.includes(l)) a.eq.push(l); }); return Object.values(ag).map(t => ({ j, t: Object.assign(t, { equipo: t.eq.join(', ') }) })); }));
      const sg = seasonsAll.slice().sort((a, b) => b.t.g - a.t.g)[0], sa = seasonsAll.slice().sort((a, b) => b.t.a - a.t.a)[0];
      // balance por CLUB (KAMIKAZES B y KAMIKAZES C cuentan juntos); el club de cada equipo viene en historico.json
      const clubOf = n => (H.clubes && H.clubes[n]) || clubDe(n);
      const rv = {}; hm.forEach(m => { const c = clubOf(m.rival); const r = rv[c] || (rv[c] = { rival: c, v: 0, e: 0, d: 0 }); r[m.n > m.o ? 'v' : m.n < m.o ? 'd' : 'e']++; });
      Object.values(rv).forEach(r => { const k = Object.keys(A.crests).find(t => A.crests[t].e && clubOf(t) === r.rival); r.crest = k ? A.crests[k].e : crest(r.rival); });
      const byTeam = {}; H.clasificaciones.forEach(c => { const k = lbl(c.equipo, c.liga); (byTeam[k] = byTeam[k] || []).push(c); });
      A.equipos.forEach(e => { if (e.clas) (byTeam[tituloOf(e)] = byTeam[tituloOf(e)] || []).push({ temporada: A.temporada, liga: e.liga.replace('Liga ', 'LIGA '), puesto: e.clas.puesto, equipo: e.nombre, actual: true, id: e.id }); });
      const ordT = ['Equipo A', 'Equipo B', 'Equipo C', 'Equipo D', 'Alevín', 'Infantil', 'MP'];
      const maxC = Math.max(1, ...H.jugadores.slice(0, 10).map(j => j.carrera.g));
      hi = { pj: hm.length, v: ht.v, e: ht.e, d: ht.d, seasons: hs, tlTitle: 'LÍNEA DE TIEMPO · TODOS LOS PARTIDOS DEL CLUB', trTitle: 'TRAYECTORIA POR EQUIPO',
        records: [
          hb && { k: 'MAYOR VICTORIA', v: hb.n + '–' + hb.o, who: lbl(hb.eqName, hb.liga) + ' vs ' + hb.rival, sub: 'Temporada ' + hb.t, bg: RED, kInk: '#FFFFFF', subInk: '#FFFFFF' },
          sg && { k: 'MÁS GOLES EN UNA TEMPORADA', v: sg.t.g, who: sg.j.nombre, sub: sg.t.temporada + ' · ' + sg.t.equipo, bg: '#18181B', kInk: '#A6A6AD', subInk: '#A6A6AD' },
          sa && { k: 'MÁS ASISTENCIAS EN UNA TEMPORADA', v: sa.t.a, who: sa.j.nombre, sub: sa.t.temporada + ' · ' + sa.t.equipo, bg: '#18181B', kInk: '#A6A6AD', subInk: '#A6A6AD' },
          hw && { k: 'DERROTA MÁS ABULTADA', v: hw.n + '–' + hw.o, who: lbl(hw.eqName, hw.liga) + ' vs ' + hw.rival, sub: 'Temporada ' + hw.t, bg: '#18181B', kInk: '#A6A6AD', subInk: '#A6A6AD' },
        ].filter(Boolean),
        tray: Object.entries(byTeam).sort((a, b) => ordT.indexOf(a[0]) - ordT.indexOf(b[0])).map(([kk, cs]) => { const eqo = A.equipos.find(e => tituloOf(e) === kk);
          return { letra: kk.replace('Equipo ', '').replace('Alevín', 'AL').replace('Infantil', 'IN'), href: eqo ? hEq(eqo.id) : null,
            steps: cs.sort((a, b) => a.temporada < b.temporada ? -1 : 1).map(c => ({ t: c.temporada.replace('20', ''), p: c.puesto + 'º', c: (c.liga || '').replace(/^(LIGA|TORNEO)\s+/i, '').replace(/PRIMAVERA /i, 'Prim. ').replace(/GRUPO /i, 'gr. ').toLowerCase().replace(/\bdivision\b/g, 'división').replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()), bg: c.actual ? '#2A1416' : '#121214' })) }; }),
        rivales: Object.values(rv).sort((a, b) => (b.v + b.e + b.d) - (a.v + a.e + a.d)).slice(0, 20),
        logros: logros(lbl),
        sancion: H.jugadores.filter(j => j.carrera.pim).sort((a, b) => b.carrera.pim - a.carrera.pim).slice(0, 10).map((j, i, arr) => ({ n: i + 1, nombre: j.nombre, temps: j.carrera.temporadas + ' temp. · ' + j.carrera.pj + ' PJ', pim: j.carrera.pim, w: (j.carrera.pim / arr[0].carrera.pim * 100) + '%' })),
        carrera: H.jugadores.slice(0, 10).map((j, i) => ({ n: i + 1, nombre: j.nombre, temps: j.carrera.temporadas + ' temp. · ' + j.carrera.pj + ' PJ', g: j.carrera.g, a: j.carrera.a, w: (j.carrera.g / maxC * 100) + '%' })),
        nota: 'Datos de las actas de la Federación Madrileña de Patinaje · ' + H.temporadas[0] + ' a ' + H.temporadas[H.temporadas.length - 1] + '.' };
    } else {
      // Sin historico.json: solo los cara a cara de app.json
      const all = [], byRival = {};
      A.equipos.forEach(e => e.h2h.forEach(h => { if (ours(h.rival)) return;
        const r = byRival[h.rival] || (byRival[h.rival] = { rival: h.rival, v: 0, e: 0, d: 0 }); r.v += h.v; r.e += h.e; r.d += h.d;
        h.partidos.forEach(m => all.push({ t: m.temporada, n: m.nosotros, o: m.ellos, rival: h.rival, eq: e })); }));
      const seasons = deco([...new Set(all.map(m => m.t))].sort().map(t => { const c = { V: 0, E: 0, D: 0 }; all.filter(m => m.t === t).forEach(m => c[m.n > m.o ? 'V' : m.n < m.o ? 'D' : 'E']++); return { t, v: c.V, e: c.E, d: c.D }; }));
      const tot = seasons.reduce((s, x) => ({ v: s.v + x.v, e: s.e + x.e, d: s.d + x.d }), { v: 0, e: 0, d: 0 });
      const best = all.slice().sort((a, b) => (b.n - b.o) - (a.n - a.o))[0], worst = all.slice().sort((a, b) => (a.n - a.o) - (b.n - b.o))[0];
      const pl = Object.values(A.jugadores).filter(p => p.equipo && ours(p.equipo));
      const topBy = f => { let b = null; pl.forEach(p => ['2024/25', '2025/26'].forEach(t => { const s = p.temporadas[t]; if (s && (!b || f(s) > b.v)) b = { p, t, v: f(s) }; })); return b; };
      const tg = topBy(s => s.goles || 0), ta = topBy(s => s.asistencias || 0);
      hi = { pj: all.length, v: tot.v, e: tot.e, d: tot.d, seasons, tlTitle: 'LÍNEA DE TIEMPO · PARTIDOS CONTRA LOS RIVALES ACTUALES', trTitle: 'TRAYECTORIA DE LOS EQUIPOS SENIOR',
        records: [
          best && { k: 'MAYOR VICTORIA', v: best.n + '–' + best.o, who: tituloOf(best.eq) + ' vs ' + best.rival, sub: 'Temporada ' + best.t, bg: RED, kInk: '#FFFFFF', subInk: '#FFFFFF', href: hEq(best.eq.id) },
          tg && { k: 'MÁS GOLES EN UNA TEMPORADA', v: tg.v, who: corto(tg.p), sub: tg.t + ' · ' + tg.p.equipo, bg: '#18181B', kInk: '#A6A6AD', subInk: '#A6A6AD', href: hP(tg.p.k) },
          ta && { k: 'MÁS ASISTENCIAS EN UNA TEMPORADA', v: ta.v, who: corto(ta.p), sub: ta.t + ' · ' + ta.p.equipo, bg: '#18181B', kInk: '#A6A6AD', subInk: '#A6A6AD', href: hP(ta.p.k) },
          worst && { k: 'DERROTA MÁS ABULTADA', v: worst.n + '–' + worst.o, who: tituloOf(worst.eq) + ' vs ' + worst.rival, sub: 'Temporada ' + worst.t, bg: '#18181B', kInk: '#A6A6AD', subInk: '#A6A6AD', href: hEq(worst.eq.id) },
        ].filter(Boolean),
        tray: A.equipos.filter(e => !e.cantera).map(e => ({ letra: e.id, href: hEq(e.id), steps: e.comp2526.map(c => ({ t: '2025/26', p: c.puesto + 'º', c: (c.competicion || '').replace('Liga ', '').replace(' · grupo', ' · gr.'), bg: '#121214' })).concat([{ t: '2026/27 · ahora', p: (e.clas ? e.clas.puesto : '-') + 'º', c: e.liga.replace('Liga ', ''), bg: '#2A1416' }]) })),
        rivales: Object.values(byRival).sort((a, b) => (b.v + b.e + b.d) - (a.v + a.e + a.d)), carrera: [],
        nota: 'Datos disponibles desde ' + (seasons[0] ? seasons[0].t : '—') + '. Ejecuta export_historico.py para cargar todas las temporadas de la base de datos.' };
    }
    const kpi = (k, v, ink = '') => `<div><div style="font-size:14px;color:#A6A6AD;font-weight:600">${k}</div><div style="${BS}font-weight:800;font-size:48px;line-height:1;${ink}">${v}</div></div>`;
    return `<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:20px;padding-top:32px">
        <h1 class="pt" style="${BS}font-weight:900;font-size:clamp(48px,7vw,84px);line-height:.9">LEGADO</h1>
        <div class="kpis" style="display:flex;gap:12px;flex-wrap:wrap">
          <div style="padding:14px 20px;background:#18181B;border-radius:10px">${kpi('Partidos registrados', hi.pj)}</div>
          <div style="padding:14px 20px;background:#18181B;border-radius:10px;display:flex;gap:16px">${kpi('V', hi.v, 'color:#3DD27E')}${kpi('E', hi.e)}${kpi('D', hi.d, 'color:#FF5A52')}</div>
        </div>
      </div>
      ${lab(hi.tlTitle, 'margin:28px 0 10px')}
      <div class="card" style="padding:20px;overflow-x:auto">
        <div data-grupo style="display:flex;gap:10px;align-items:flex-end;min-width:640px">${hi.seasons.map((se, si) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px">
            <div style="${BS}font-weight:800;font-size:15px;color:#C9C9CE;white-space:nowrap">${se.v}-${se.e}-${se.d}</div>
            <div data-anim="mpRise .5s cubic-bezier(.2,.8,.2,1) ${si * 110}ms" style="display:flex;flex-direction:column-reverse;width:100%;max-width:56px;height:${se.h};border-radius:3px;overflow:hidden;transform-origin:bottom"><div style="flex:${se.v};background:#1E8A4C"></div><div style="flex:${se.e};background:#8A8A8F"></div><div style="flex:${se.d};background:#55555B"></div></div>
            <div style="font-size:12px;color:#A6A6AD;white-space:nowrap;text-align:center">${se.pj} PJ<br>${se.pct}</div>
            <div style="font-size:13px;font-weight:700;color:#A6A6AD;border-top:1px solid #3A3A40;padding-top:6px;width:100%;text-align:center;white-space:nowrap">${esc(se.t)}</div></div>`).join('')}</div>
        <div style="display:flex;gap:16px;font-size:13px;color:#A6A6AD;padding-top:14px;flex-wrap:wrap"><span><span style="color:#1E8A4C">■</span> Victoria</span><span><span style="color:#8A8A8F">■</span> Empate</span><span><span style="color:#55555B">■</span> Derrota</span><span>Altura = partidos jugados (sin derbis)</span></div>
      </div>
      ${hi.logros || ''}
      ${lab('RÉCORDS', 'margin:28px 0 10px')}
      <div class="recs" data-grupo style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:12px">${hi.records.map((rc, ri) => box(rc.href, `background:${rc.bg};border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:8px;min-height:170px`, `
          <div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:${rc.kInk}">${rc.k}</div>
          <div class="rec-v" style="${BS}font-weight:900;font-size:72px;line-height:.85;white-space:nowrap">${rodarCifra(rc.v, 200 + ri * 140)}</div>
          <div style="margin-top:auto"><div style="font-weight:700">${esc(rc.who)}</div><div style="font-size:14px;color:${rc.subInk}">${esc(rc.sub)}</div></div>`, 'div', ` data-anim="mpUp .4s cubic-bezier(.2,.8,.2,1) ${ri * 140}ms"`)).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:28px;align-items:start">
        <div>${lab(hi.trTitle, 'margin-bottom:10px')}
          <div class="card" style="padding:6px 20px">${hi.tray.map(tr => box(tr.href, 'display:grid;grid-template-columns:44px minmax(0,1fr);gap:14px;align-items:center;width:100%;padding:14px 0;border-bottom:1px solid #26262A', `
              <span style="${BS}font-weight:900;font-size:44px;line-height:1;color:${RED}">${esc(tr.letra)}</span>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${tr.steps.map(st => `<div style="padding:8px 12px;border-radius:8px;background:${st.bg};min-width:110px"><div style="font-size:12px;font-weight:700;color:#A6A6AD">${esc(st.t)}</div><div style="display:flex;align-items:baseline;gap:6px"><span style="${BS}font-weight:900;font-size:30px;line-height:1">${st.p}</span><span style="font-size:13px;font-weight:600;color:#C9C9CE">${esc(st.c)}</span></div></div>`).join('')}</div>`)).join('')}</div>
        </div>
        <div>${lab('BALANCE CONTRA CADA CLUB', 'margin-bottom:10px')}
          <div class="card" data-grupo style="padding:6px 20px">${hi.rivales.map((h, i) => { const t = tramos(h, i); return `<div class="fila-barra"${t.fila} style="--c1:26px;display:grid;grid-template-columns:26px minmax(0,1fr) minmax(60px,180px) 76px;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid #26262A">
              ${disc(h.crest || crest(h.rival), 24)}<span style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.rival)}</span>
              <div class="barra" style="display:flex;height:10px;border-radius:3px;overflow:hidden;background:#26262A">${t.barra}</div>
              <span${t.bal} style="text-align:right;${BS}font-weight:800;font-size:20px">${h.v}-${h.e}-${h.d}</span></div>`; }).join('')}</div>
        </div>
      </div>
      ${hi.carrera.length ? `${lab('MÁXIMOS GOLEADORES DE LA HISTORIA DEL CLUB', 'margin:28px 0 10px')}
        <div class="card" style="padding:6px 20px">${hi.carrera.map(cr => `<div class="fila-barra" style="--c1:32px;display:grid;grid-template-columns:32px minmax(0,1fr) minmax(60px,260px) 90px;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #26262A">
            <span style="${BS}font-weight:900;font-size:26px;color:${RED}">${cr.n}</span>
            <div style="min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(cr.nombre)}</div><div style="font-size:13px;color:#A6A6AD">${cr.temps}</div></div>
            <div class="barra" style="height:10px;background:#26262A;border-radius:3px;overflow:hidden"><div style="height:100%;width:${cr.w};background:${RED}"></div></div>
            <div style="text-align:right;${BS}font-weight:800;font-size:24px;white-space:nowrap">${cr.g}<span style="font-size:14px;color:#A6A6AD"> G · ${cr.a} A</span></div></div>`).join('')}</div>` : ''}
      ${hi.sancion && hi.sancion.length ? `${lab('MÁS MINUTOS DE SANCIÓN DE LA HISTORIA DEL CLUB', 'margin:28px 0 10px')}
        <div class="card" style="padding:6px 20px">${hi.sancion.map(sx => `<div class="fila-barra" style="--c1:32px;display:grid;grid-template-columns:32px minmax(0,1fr) minmax(60px,260px) 90px;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #26262A">
            <span style="${BS}font-weight:900;font-size:26px;color:#8A8A8F">${sx.n}</span>
            <div style="min-width:0"><div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sx.nombre)}</div><div style="font-size:13px;color:#A6A6AD">${sx.temps}</div></div>
            <div class="barra" style="height:10px;background:#26262A;border-radius:3px;overflow:hidden"><div style="height:100%;width:${sx.w};background:#8A8A8F"></div></div>
            <div style="text-align:right;${BS}font-weight:800;font-size:24px;white-space:nowrap">${fmin(sx.pim)}</div></div>`).join('')}</div>` : ''}
      <div style="font-size:13px;color:#A6A6AD;margin-top:16px">${esc(hi.nota)}</div>`;
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
    jornada: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/>',
    pretemporada: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    equipos: '<path d="M12 3l8 3v6c0 4.8-3.4 8-8 9-4.6-1-8-4.2-8-9V6l8-3z"/>',
    ligas: '<path d="M5 20v-7M12 20V5M19 20v-10M3 20h18"/>',
    jugadores: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.2" cy="9" r="2.6"/><path d="M16.5 14.1c2.8.3 5 2.3 5 5.9"/>',
    legado: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 6h3a3 3 0 0 1-3 3.5M7 6H4a3 3 0 0 0 3 3.5"/>',
  };
  const TOP = { directo: 'jornada', jornada: 'jornada', equipo: 'equipos', liga: 'ligas', partido: 'ligas', jugadores: 'jugadores', jugador: 'jugadores', historico: 'legado', legado: 'legado', pretemporada: 'pretemporada', metodo: 'metodo', sincronizar: 'jornada', video: 'jornada' };
  const TITLES = { directo: 'En directo', jornada: 'Jornada', equipo: 'Equipos', liga: 'Ligas', partido: 'Partido', jugadores: 'Jugadores', jugador: 'Jugador', historico: 'Legado', legado: 'Legado', pretemporada: 'Pretemporada', metodo: 'Cómo lo calculamos', sincronizar: 'Sincronizar vídeo', video: 'Vídeo del partido' };
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
    const v = TOP[parts[0]] ? parts[0] : 'jornada';
    // Enlace viejo o mal copiado: a la lista, nunca a la ficha de otra persona ni a otro partido
    if (v === 'jugador' && !A.jugadores[parts[1]]) { history.replaceState(null, '', '#/jugadores'); prevRoute = location.hash; return render(); }
    if (v === 'liga' && parts[2] === 'llega') { history.replaceState(null, '', hPre(parts[1])); prevRoute = location.hash; return render(); }
    if (v === 'partido' && !A.partidos[parts[1]]) { history.replaceState(null, '', '#/jornada'); prevRoute = location.hash; return render(); }
    if (v === 'directo' && parts[2] === 'resumen' && VID && VID[parts[1]]) { pararResumen(); if (ESC.abierta) ESC.abierta.cerrar(); history.replaceState(null, '', '#/video/' + encodeURIComponent(parts[1])); prevRoute = location.hash; return render(); }
    const nav = [['pretemporada', 'Pretemporada', hPre('club')], ['jornada', 'Jornada', '#/jornada'], ['equipos', 'Equipos', hEq(S.eq || A.equipos[0].id)], ['ligas', 'Ligas', hLg(S.lg || A.ligas[0].id)], ['jugadores', 'Jugadores', '#/jugadores'], ['legado', 'Legado', '#/legado']];
    $('#nav').innerHTML = '<span class="pildora" aria-hidden="true"></span>' + nav.map(([k, l, h]) => `<a href="${h}" data-nav${TOP[v] === k ? ' aria-current="page"' : ''}>${l}</a>`).join('');
    // «?»: Cómo lo calculamos, siempre a mano
    let ay = $('#ayuda');
    if (!ay) { ay = document.createElement('a'); ay.id = 'ayuda'; ay.className = 'ayuda'; ay.href = '#/metodo'; ay.title = 'Cómo lo calculamos'; ay.setAttribute('aria-label', 'Cómo lo calculamos'); ay.textContent = '?'; $('#nav').after(ay); }
    ay.classList.toggle('on', v === 'metodo');
    // móvil: la misma navegación, abajo y con iconos (al alcance del pulgar)
    $('#tabbar').innerHTML = nav.map(([k, l, h]) => `<a href="${h}" data-nav${TOP[v] === k ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONO[k]}</svg><span>${l}</span></a>`).join('');
    pildora(true);
    if (secAntes && secAntes !== TOP[v]) { const ic = $('#tabbar a[aria-current] svg'); if (ic) ic.style.animation = 'mpBounce .45s both'; }
    secAntes = TOP[v];
    let html;
    if (v === 'equipo') html = vEquipo(parts[1]);
    else if (v === 'liga') html = vLiga(parts[1], parts[2] === 'llega' ? 'llega' : parts[2] === 'mapa' ? (parts[3] === 'todas' ? 'todas' : 'mapa') : parts[2] === 'evolucion' ? 'evolucion' : null, parts[2] === 'j' ? parseInt(parts[3], 10) : null);
    else if (v === 'partido') html = vPartido(parts[1]);
    else if (v === 'jugadores') html = vJugadores(parts[1]);
    else if (v === 'jugador') html = vJugador(parts[1]);
    else if (v === 'historico' || v === 'legado') html = vHistorico();
    else if (v === 'pretemporada') html = vPretemporada(parts[1]);
    else if (v === 'directo') html = vDirecto(parts[1], parts[2]);
    else if (v === 'metodo') html = vMetodo();
    else if (v === 'sincronizar') html = vSincronizar(parts[1]);
    else if (v === 'video') html = vVideo(parts[1], parts[2]);
    else html = vJornada(parts[1]);
    const back = S.hist.length && v !== 'jornada' ? '<a class="back" href="#" data-back>← Volver</a>' : '';
    const pie = `<footer class="pie"><span>MADRIDPATINA · Temporada ${esc(A.temporada)}</span><span><a href="#/metodo">Cómo lo calculamos</a> · Datos: Federación Madrileña de Patinaje · actualizado ${fdc(A.actualizado).toLowerCase()}</span></footer>`;
    view.innerHTML = back + html + pie;
    if (!VID) cargarVideos().then(() => { const m = /^#\/directo\/([^/]+)\/resumen/.exec(location.hash); if (/^#\/partido\//.test(location.hash) || (m && VID[decodeURIComponent(m[1])])) render(); });
    if (v === 'metodo' && parts[1]) setTimeout(() => { const el = document.getElementById('m-' + parts[1]); if (el) el.scrollIntoView({ block: 'start' }); }, 60);
    // el contenido que no trae su propia animación entra con fundido + subida, en cascada de 60 ms
    let k = 0;
    [...view.children].forEach(ch => {
      if (ch.tagName === 'FOOTER' || ch.matches('[data-anim],[data-ola]') || ch.querySelector('[data-anim],[data-ola]')) return;
      ch.dataset.anim = 'mpUp .4s cubic-bezier(.2,.8,.2,1)'; ch.dataset.espera = Math.min(k++, 8) * 60;
    });
    ola(view);
    rodillos(view);
    rellenarParecidos();
    rellenarArquetipo();
    rellenarPerfiles();
    rellenarGraficoPartido();
    rellenarEquipo();
    rellenarAgenda();
    rellenarFicha();
    billetes(view);
    // con la intro delante, la web se anima al cerrarla
    if (introEl) animarAlCerrar = true; else animar(view);
    // el título de la pestaña dice qué página es (el jugador, el partido, el equipo o la liga)
    const pp = v === 'partido' && A.partidos[parts[1]], jj = v === 'jugador' && A.jugadores[parts[1]], ee = v === 'equipo' && A.equipos.find(x => x.id === parts[1]), ll = v === 'liga' && lgOf(parts[1]);
    const det = jj ? corto(jj) : pp ? abr(pp.local) + ' ' + (pp.gl != null ? pp.gl + '–' + pp.gv : 'vs') + ' ' + abr(pp.visitante) : ee ? tituloOf(ee) : ll ? ll.nombre : '';
    document.title = 'MADRIDPATINA · ' + (det || TITLES[v]);
    save({ route: location.hash, eq: S.eq, lg: S.lg });
    try { sessionStorage.setItem(HKEY, JSON.stringify(S.hist.slice(-10))); } catch (e) { /* sin almacenamiento */ }
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-nav]')) navReset = true;
    const b = e.target.closest('[data-back]');
    // «← Volver» es el Atrás del navegador (no deja una entrada nueva en el historial)
    if (b) { e.preventDefault(); if (S.hist.length) history.back(); else location.hash = '#/jornada'; }
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
  const esInicio = h => !h || h === '#' || h === '#/' || h === '#/jornada';
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
        else { const [n, o] = c.resultado.split('-').map(Number); [gl, gv] = c.casa ? [n, o] : [o, n]; href = c.mid ? hM(c.mid) : null; }
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
      up.push({ k, ts, dia: new Date(y, m - 1, d).getTime(), hora: c.hora, derbi: !!c.derbi, local, vis, la: nom(local), va: nom(vis),
        cuando: DIA[new Date(y, m - 1, d).getDay()] + ' ' + d + ' · ' + (c.hora || 'Hora por fijar') });
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
    const esc1 = n => `<div class="esc" style="--ring:${ours(n) ? '#D3202A' : '#FFFFFF'};${crest(n) ? `background-image:url('${esc(crest(n))}')` : ''}"></div>`;
    const sn = x.fin ? null : vivoIntro(x.k);
    let cifras, cuando;
    if (x.fin) {   // terminado: el resultado (en rojo el bloque del ganador si es nuestro) y «▶ resumen»
      const nos = x.mpL && !x.mpV ? 'L' : x.mpV && !x.mpL ? 'V' : null, gana = x.gl > x.gv ? 'L' : x.gv > x.gl ? 'V' : null;
      cifras = [['L', x.gl, x.la], ['V', x.gv, x.va]].map(([l, n, lab]) => `<div class="bloque"><div class="num res${nos && gana === l && nos === l ? ' gana' : ''}"><div>${n}</div></div><span>${esc(lab)}</span></div>`).join('');
      const nb = t => esc(t).replace(/ /g, '&nbsp;');   // corta solo entre «FINAL · SÁB 17» y «PENALTIS 1–0»
      cuando = `<div class="cuando fin">${nb('FINAL · ' + x.cuando)}${x.pen ? ' · ' + nb('PENALTIS ' + x.pen.gl + '–' + x.pen.gv) + (x.pen.ganador ? ' · ' + nb('GANA ' + (x.pen.ganador === 'L' ? x.la : x.va)) : '') : ''}</div>${x.href && /resumen/.test(x.href) ? '<div class="cuando ver">▶ VER RESUMEN</div>' : ''}`;
    } else if (sn) {   // en juego: dos bloques con el marcador de rodillo, del mismo tamaño que la cuenta atrás
      const m = IN.mostrado[sn.idp] || (IN.mostrado[sn.idp] = { gl: sn.gl || 0, gv: sn.gv || 0 });
      cifras = [['L', m.gl, x.la], ['V', m.gv, x.va]].map(([l, n, lab]) => `<div class="bloque"><div class="num marc ${l}" data-in="${esc(sn.idp)}-${l}"><div style="transform:translateY(-${(n * 1.02).toFixed(2)}em)">${Array.from({ length: Math.max(16, n + 1) }, (_, d) => `<span>${d}</span>`).join('')}</div></div><span>${esc(lab)}</span></div>`).join('');
      cuando = `<div class="cuando vivo">${cuandoVivo(sn)}</div>`;
    } else {
      const q = cuentaAtras(x);
      cifras = ['DÍAS', 'HORAS', 'MIN'].map((k, j) => `<div class="bloque"><div class="num${j === 2 ? ' min' : ''}"><div>${q[j]}</div></div><span>${k}</span></div>`).join('');
      cuando = `<div class="cuando">${esc(x.cuando)}</div>`;
    }
    const href = x.fin ? x.href : sn ? '#/directo/' + encodeURIComponent(sn.idp) : null;
    return `<div class="fila" style="animation-delay:${150 + i * 110}ms"${sn ? ` data-vivo="${esc(sn.idp)}"` : ''}${x.fin ? ' data-fin' : ''}${href ? ` data-href="${esc(href)}"` : ''}>${x.derbi ? '<div class="derbi"><span>DERBI</span></div>' : ''}
      <div class="eq">${esc1(x.local)}<div><div class="vs-t">${esc(x.la)} <span>vs</span> ${esc(x.va)}</div>${cuando}</div>${esc1(x.vis)}</div>
      <div class="cifras" data-i="${i}">${cifras}</div></div>`;
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
      caja.classList.add('quieta'); caja.innerHTML = ps.map(filaIntro).join('');
      introEl.style.setProperty('--n', Math.max(3, ps.length));
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
  function abrirIntro() {
    if (introEl || !A) return;
    const ps = partidosFinde();
    if (!ps.length) return;
    introAbierta = true;
    IN.ps = ps; IN.clave = ps.map(x => x.k + (x.fin ? '=' + x.gl + '-' + x.gv : vivoIntro(x.k) ? '*' : '')).join('|'); IN.visto = LIVE.nuevos.length;
    try { sessionStorage.setItem(INTRO, '1'); } catch (e) { /* sin almacenamiento: saldrá en cada visita */ }
    const el = introEl = document.createElement('div');
    el.className = 'intro'; el.tabIndex = -1;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Próximos partidos');
    el.style.setProperty('--n', Math.max(3, ps.length));
    el.innerHTML = `<div class="focos"><div class="haz a"></div><div class="haz b"></div></div>
      <div class="centro"><div class="caja">${ps.map(filaIntro).join('')}</div></div>
      <button class="cerrar" type="button" aria-label="Cerrar" data-cierra>✕</button>
      <button class="entrar" type="button" data-cierra><span>ENTRAR</span><span aria-hidden="true">↓</span></button>`;
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
        c.querySelectorAll('.num > div').forEach((n, j) => { if (n.textContent !== q[j]) { n.textContent = q[j]; if (j === 2) repetir(n, 'mpTick .35s cubic-bezier(.2,.8,.2,1)'); } });
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
  document.querySelector('.brand img').addEventListener('click', () => {   // el escudo del club: a inicio, y allí la cuenta atrás
    if (!esInicio(location.hash)) location.hash = '#/jornada';
    abrirIntro();
  });

  document.addEventListener('animationend', e => {
    if (e.animationName !== 'mpReel') return;
    const card = e.target.closest('[data-rodillo]');
    if (!card || card.classList.contains('parado')) return;
    card.classList.add('parado');
    const n = card.querySelector('[data-cuenta]');
    if (!n) return;
    const fin = +n.dataset.cuenta, t = n.dataset.fmt;
    const fmt = t === 'pct' ? v => (v === fin ? dec(fin) : dec(v.toFixed(1))) : t === 'min' ? v => fmin(v === fin ? fin : Math.round(v * 2) / 2) : v => String(Math.round(v));
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
    return ((dorsal ? '#' + dorsal + ' ' : '') + (p ? iniApe(p) : corto || largo || '')).trim();
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
    .then(r => (r.ok ? r.json() : {})).catch(() => ({})).then(d => { VID = d || {}; return VID; }));
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
    if (!VID) { cargarVideos().then(() => { if (location.hash.indexOf('#/video/' + idp) === 0) render(); }); return '<div class="loading">Cargando el vídeo…</div>'; }
    const v = VID[idp];
    if (!v) return '<div class="loading">Este partido aún no tiene vídeo sincronizado.</div>';
    const S = partidoSN(idp, '#/video/' + idp);
    if (!S) return '<div class="loading" data-espera>Cargando el acta del partido…</div>';
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
          <button type="button" class="tv-empieza" id="tv-empieza" data-tv="empieza"><b>▶</b><span>Ver el resumen</span><small>En el móvil se verá a pantalla completa y en horizontal</small></button>` : ''}
        </div></div></div></div>`;
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
  const SY = { idp: null, S: null, items: [], i: 0, yt: '', canal: '', player: null };
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
  const guardaSync = () => { try { localStorage.setItem('mp-sync-' + SY.idp, JSON.stringify({ yt: SY.yt, canal: SY.canal, m: Object.fromEntries(SY.items.filter(x => x.s != null).map(x => [x.id, x.s])) })); } catch (e) { /* sin almacenamiento: no pasa nada */ } };
  function codigoSync() {
    const ev = {}, partes = {};
    SY.items.forEach(x => { if (x.s == null) return; if (x.ancla) partes[x.p] = Math.round(x.s);
      else if (x.pen) ev[x.id] = { s: Math.round(x.s), tipo: 'PENALTI', p: 3, t: null, lado: x.pen.lado, q: x.q, m: x.pen.gol ? 'gol' : 'fallo', ronda: x.pen.ronda };
      else ev[x.id] = { s: Math.round(x.s), tipo: x.tipo, p: x.p, t: x.e.t, lado: x.e.lado, q: x.q, m: x.e.marcador || null }; });
    return JSON.stringify({ [SY.idp]: { yt: SY.yt, canal: SY.canal || null, partes, ev } });
  }
  function pintarSync() {
    const lista = $('#sy-lista'), act = $('#sy-actual'), cod = $('#sy-codigo');
    if (!lista) return;
    const it = SY.items[SY.i];
    act.innerHTML = it ? `<span class="n">${SY.i + 1}/${SY.items.length}</span><b>${esc(it.txt)}</b><span class="t">${it.ancla ? '' : it.pen ? 'Tanda de penaltis' : esc(ordinal(it.p) + ' parte · minuto ' + it.e.t + ' de juego')}${it.s != null ? ' · marcado en ' + mmssV(it.s) : ''}</span>`
      : '<b>¡Listo! Copia el código de abajo y pásamelo.</b>';
    lista.innerHTML = SY.items.map((x, k) => `<button type="button" class="sy-it${k === SY.i ? ' on' : ''}${x.s != null ? ' ok' : ''}${x.ancla ? ' ancla' : ''}" data-sy="ir" data-k="${k}"><span class="s">${x.s != null ? mmssV(x.s) : '—'}</span><span>${esc(x.txt)}</span></button>`).join('');
    const hechas = SY.items.filter(x => x.s != null && !x.ancla).length;
    cod.value = hechas ? codigoSync() : '';
    $('#sy-n').textContent = hechas + ' de ' + SY.items.filter(x => !x.ancla).length + ' jugadas marcadas';
  }
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
    if (previo) { SY.yt = previo.yt; SY.canal = previo.canal || ''; SY.items.forEach(x => { if (previo.m[x.id] != null) x.s = previo.m[x.id]; }); }
    else if (v) { SY.yt = v.yt; SY.canal = v.canal || ''; SY.items.forEach(x => { const y = x.ancla ? (v.partes || {})[x.p] : (v.ev[x.id] || {}).s; if (y != null) x.s = y; }); }
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
      <p class="sy-ayuda">1. Pega el enlace de YouTube y pulsa «Cargar». 2. Para cada jugada el vídeo salta a unos segundos antes de cuando debería ser: dale al play y pulsa <b>¡Ahora!</b> justo cuando pasa (el gol entra, el árbitro pita la expulsión…). Si no se ve, «Saltar». 3. Al final copia el código y pásamelo.</p>
      <div class="sy-form"><input id="sy-url" type="url" placeholder="Enlace de YouTube (https://youtu.be/…)" aria-label="Enlace de YouTube"><input id="sy-canal" type="text" placeholder="Canal (opcional)" aria-label="Canal de YouTube"><button type="button" class="dv-alin" data-sy="cargar">Cargar</button></div>
      <div class="sy-cols"><div><div class="sy-marco"><div id="sy-player"></div></div>
        <div class="sy-actual" id="sy-actual"></div>
        <div class="sy-botones"><button type="button" data-sy="atras">◀ Atrás</button><button type="button" data-sy="estima">Ir a la estimación</button><button type="button" class="ahora" data-sy="ahora">¡Ahora!</button><button type="button" data-sy="menos">−2 s</button><button type="button" data-sy="mas">+2 s</button><button type="button" data-sy="saltar">Saltar ▶</button></div></div>
        <div class="sy-lado"><div class="sy-n" id="sy-n"></div><div class="sy-lista" id="sy-lista"></div></div></div>
      <div class="sy-cod"><div class="lab">CÓDIGO PARA LA WEB</div><textarea id="sy-codigo" readonly rows="4" aria-label="Código para la web"></textarea><button type="button" class="dv-alin" data-sy="copiar">Copiar el código</button></div></div>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-sy]');
    if (!b) return;
    const a = b.dataset.sy, it = SY.items[SY.i], now = () => (SY.player && SY.player.getCurrentTime ? SY.player.getCurrentTime() : null);
    if (a === 'cargar') { const id = ytId($('#sy-url').value); SY.canal = $('#sy-canal').value.trim(); if (!id) { $('#sy-url').focus(); return; } SY.yt = id; guardaSync(); cargarPlayer(); pintarSync(); }
    else if (a === 'ahora' && it) { const t = now(); if (t == null) return; it.s = t; guardaSync(); irSync(SY.i + 1); }
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
      for (let i = 0; i < dG; i++) prev.lista.push({ gol: true, aparece: golesContra[i] ? DV.aparece[golesContra[i].id] : ahora + (MOV ? 2800 : 0) });
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
    if (!S) { cargarPartidoResumen(idp); return '<div class="loading" data-dv="espera">Cargando el resumen…</div>'; }
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

  // sin datos del partido: aún conectando, sin conexión (se reintenta) o el partido no está hoy en el directo
  const esperaTxt = () => (LIVE.ok === false && !LIVE.cargado ? 'Sin conexión con el directo · reintentando…' : LIVE.cargado ? 'Este partido no está ahora en el directo.' : 'Conectando con el directo…');
  function vDirecto(idp, modo) {
    if (ESC.abierta && ESC.abierta.tipo === 'resumen') ESC.abierta.cerrar();
    cargarHitos();
    DV.idp = idp; DV.gen++;
    if (modo === 'resumen') { const espera = prepararResumen(idp); if (espera) { DV.vacio = true; return espera; } } else { pararResumen(); RSM.saltado = false; }
    const sn = snapDV();
    if (!sn) { DV.vacio = true; return `<div class="loading" data-dv="espera">${esperaTxt()}</div>`; }
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
    const arriba = verRes + alinBtn(sn) + pistaChip(sn);
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
      <div class="dv-der" data-dv="der">${juegoHtml(ctx)}<div data-dv="ficha">${fichaHtml(ctx)}</div><div style="display:flex;flex-direction:column;gap:8px" data-dv="hoy">${hoyHtml()}</div></div>
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
  /* ── 10c · Gol a pantalla completa ──────────────────────────────────────────────────────────────────────────────
     Nuestro: cortina roja (5 s) con la foto a color del goleador delante y la del asistente detrás («ASIST.»); sin
     asistencia, solo el goleador. Rival: cortina gris (4 s) con su escudo. Sin foto (o menores, que nunca la tienen): iniciales. */
  const DUR_GOL = { mp: 5000, riv: 4000 }, DUR_FALTA = 5000, DUR_CORTA = 2200;
  const T_TIRO = 2300, T_GANA = 3200;   // 10d: cada lanzamiento (tarjeta y, a los 1,3 s, el sello) y la tarjeta del ganador
  const durAnuncio = (ctx, e) => (e.tipo === 'GOL' ? (ctx.mp[e.lado] ? DUR_GOL.mp : DUR_GOL.riv) : e.tipo === 'FALTA' ? DUR_FALTA
    : e.tipo === 'TANDA' ? e.nuevos.length * T_TIRO + (e.ganador ? T_GANA : 500) : e.tipo === 'CAMBIO DE PORTERO' ? 3600 : DUR_CORTA);
  const anunciable = e => e.tipo === 'GOL' || e.tipo === 'FALTA' || (e.tipo === 'CAMBIO DE PORTERO' && e.jugador && !e.ambiguo);
  const iniDe = n => (n || '').replace(/\./g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  function escenaGolHtml(ctx, e) {
    const l = e.lado, estr = innerWidth < 640 || innerWidth / Math.max(1, innerHeight) < .8 ? ' estr' : '';
    const parte = ordinal(e.periodo) + (e.t ? ' · ' + e.t : ''), marc = e.marcador ? ctx.abr.L + ' ' + e.marcador.replace('-', '–') + ' ' + ctx.abr.V : '';
    const quien = quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador), hayA = !!(e.asist_dorsal || e.asist_jugador);
    const asWho = hayA ? quienD(ctx, l, e.asist_dorsal, e.asist_corto, e.asist_jugador) : '';
    if (!ctx.mp[l]) {
      const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent';
      const sub = [...hitosGol(e, ctx.sn.eventos, ctx.sn).tags, hayA ? 'Asist. ' + asWho : 'Sin asistencia', parte, marc].filter(Boolean).join(' · ');
      return `<div class="esc-gol riv${estr}" role="status" aria-label="Gol de ${esc(ctx.abr[l])}"><div class="eg-cortina"><div class="eg-esc" style="background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}"></div>
        <div class="eg-tx"><div class="eg-gol">GOL</div><div class="eg-quien">${esc(quien)}</div><div class="eg-sub">${esc(sub)}</div>${botonVer(ctx.sn.idp, e, '▶ VER EL GOL')}</div></div></div>`;
    }
    const foto = (p, nombre) => (p && p.foto ? `<div class="f" style="background-image:url('${esc(p.foto)}')"></div>` : `<div class="i">${esc(p ? ini(p.nombre, p.apellidos) : iniDe(nombre))}</div>`);
    const s1 = jugadorDe(ctx, l, e.id_player, e.dorsal), a1 = hayA ? jugadorDe(ctx, l, e.assist_id_player, e.asist_dorsal) : null;
    const nota = situacionGol(e, ctx.sn.eventos, ctx.dur), h = hitosGol(e, ctx.sn.eventos, ctx.sn);
    return `<div class="esc-gol${estr}" role="status" aria-label="Gol de ${esc(ctx.abr[l])}"><div class="eg-cortina">
      <div class="eg-fotos${hayA ? ' con-a' : ''}">
        ${hayA ? `<div class="eg-as">${foto(a1, e.asist_corto || e.asist_jugador)}<div class="tag">ASIST.</div><div class="d">${esc(e.asist_dorsal || '')}</div></div>` : ''}
        <div class="eg-sc">${foto(s1, e.jugador_corto || e.jugador)}<div class="d">${esc(e.dorsal || '')}</div></div>
      </div>
      <div class="eg-tx"><div class="eg-gol">GOL</div><div class="eg-quien">${esc(quien)}</div>${hayA ? `<div class="eg-asis">Asistencia de <b>${esc(asWho)}</b>${h.asist ? ' · ' + esc(h.asist) : ''}</div>` : ''}
        <div class="eg-chips">${botonVer(ctx.sn.idp, e, '▶ VER EL GOL')}${h.tags.map(x => `<span class="hito">${esc(x)}</span>`).join('')}${[parte, marc, nota.toUpperCase()].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div></div>
    </div></div>`;
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
      if (!ms || !caja || !sn || gen !== DV.gen) return fin();
      const ctx = ctxDirecto(sn), dur = durAnuncio(ctx, e), tmp = document.createElement('div');
      if (e.tipo === 'TANDA') {   // 10d: la tanda a pantalla completa (espera a que acabe la pista o la presentación)
        const mostrar = () => (gen !== DV.gen ? fin() : escenaPenaltis(ctx, e, fin));
        if (ESC.abierta || ESC.cargando) document.addEventListener('mp-escena-fin', mostrar, { once: true }); else mostrar();
        return;
      }
      if (e.tipo === 'GOL' || e.tipo === 'FALTA' || e.tipo === 'CAMBIO DE PORTERO') {   // 10c / 10f / cambio: a pantalla completa; se puede tocar para cerrarla antes
        const mostrar = () => {
          if (gen !== DV.gen) return fin();
          tmp.innerHTML = e.tipo === 'GOL' ? escenaGolHtml(ctx, e) : e.tipo === 'FALTA' ? escenaFaltaHtml(ctx, e) : escenaCambioHtml(ctx, e);
          const el = tmp.firstElementChild; document.body.appendChild(el);
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
    if (DV.vacio) { if (LIVE.snaps[idp]) render(); else if (!/\/resumen/.test(location.hash)) { const w = $('[data-dv="espera"]'); if (w) w.textContent = esperaTxt(); } return; }
    if (DV.idp === idp) actualizarDirecto();
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
  document.addEventListener('mp-directo', () => { if (introEl) introDirecto(); else if (!introAbierta && !introVistaCarga && Date.now() - T_CARGA < 5000) abrirIntro(); });

  // el reloj de la parte avanza cada segundo entre respuestas (si el portal lo da)
  setInterval(() => {
    Object.values(LIVE.snaps).forEach(sn => { if (sn.estado === 'directo' && sn.reloj) { const st = document.querySelector(`[data-bdst="${CSS.escape(sn.idp)}"]`); if (st) st.textContent = estadoCorto(sn);
      const fi = introEl && introEl.querySelector(`[data-vivo="${CSS.escape(sn.idp)}"] .cuando`); if (fi) fi.innerHTML = cuandoVivo(sn); } });
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
  // GitHub Pages deja la página en la caché del navegador hasta 10 minutos, y con ella la versión anterior de la web. Al abrirla
  // se mira la página real: si ya es otra versión, se recarga con la nueva. Si llega mientras se usa (al volver a la pestaña),
  // se avisa en vez de recargar de golpe (podría estar viendo un directo).
  const VERSION = (((document.querySelector('script[src*="assets/app.js"]') || {}).src || '').split('v=')[1] || '').split('&')[0];
  const conVersion = v => location.pathname + '?v=' + encodeURIComponent(v) + location.hash;
  function versionNueva(alAbrir) {
    if (!VERSION) return;
    fetch('index.html?_=' + Date.now(), { cache: 'no-store' }).then(r => (r.ok ? r.text() : '')).then(t => {
      const v = (/assets\/app\.js\?v=([\w-]+)/.exec(t) || [])[1];
      if (!v || v === VERSION) return;
      if (alAbrir && location.search.indexOf('v=' + v) < 0) { location.replace(conVersion(v)); return; }
      if ($('#aviso-version')) return;
      const el = document.createElement('div'); el.id = 'aviso-version'; el.className = 'aviso-version'; el.setAttribute('role', 'status');
      el.innerHTML = 'Hay una versión nueva de la web <button type="button">Actualizar</button>';
      el.querySelector('button').addEventListener('click', () => location.replace(conVersion(v)));
      document.body.appendChild(el);
    }).catch(() => { /* sin conexión: ya se mirará */ });
  }
  versionNueva(true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) versionNueva(false); });

  /* ── Carga ──────────────────────────────────────────────── */
  // historico.json se pide a la vez que app.json y la web se pinta cuando están los dos (si el histórico falla, sin él):
  // así no se vuelve a pintar a mitad de las animaciones. Mientras, el esqueleto de carga (7l).
  const pHist = fetch('data/historico.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
  fetch('data/app.json', { cache: 'no-cache' }).then(r => r.json()).then(app => pHist.then(h => {
    A = app;
    hCargando = false;
    if (h) H = prepH(h);
    $('#sub').textContent = 'Hockey línea · ' + A.temporada;
    if (!location.hash && S.route) history.replaceState(null, '', S.route);
    prevRoute = location.hash;
    let introVista = false;
    try { introVista = sessionStorage.getItem(INTRO) === '1'; } catch (e) { /* sin almacenamiento */ }
    introVistaCarga = introVista || !esInicio(HASH_INICIAL);
    if (!introVistaCarga) abrirIntro();
    render();
    arrancarDirecto();
    cargarSemana();
  })).catch(() => { view.innerHTML = '<div class="loading">No se ha podido cargar la web. Prueba a recargar la página.</div>'; });
})();
