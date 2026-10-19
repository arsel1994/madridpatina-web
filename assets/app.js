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
  const RES = { V: ['VICTORIA', '#1E8A4C'], E: ['EMPATE', '#8A8A8F'], D: ['DERROTA', '#55555B'] };
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
  const fdc = s => { if (!s) return '—'; const [, m, d] = s.split('-').map(Number); return d + ' ' + MES[m - 1]; };
  const dec = v => String(v).replace('.', ',');

  /* ── Estado: URL + localStorage (mp-nav-v1) ─────────────── */
  const KEY = 'mp-nav-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
  const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const S = Object.assign({ eq: null, lg: null, hist: [] }, load());
  if (!Array.isArray(S.hist)) S.hist = [];
  let A = null, H = null, hCargando = true;

  /* ── Utilidades de datos (idénticas al prototipo) ───────── */
  const ours = n => /^MADRIDPATINA/.test(n || '');
  // Escudo por nombre exacto; si no está (equipos de otras temporadas: LAS ROZAS B, KAMIKAZES C…), el de otro equipo del mismo club
  const clubDe = n => (n || '').replace(/ [A-Z]$/, '');
  let porClub = null;
  const crest = n => (A.crests[n] && A.crests[n].e) || (ours(n) ? 'escudos/badge/madridpatina.png'
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
  const rolDe = p => p.portero ? 'Portero' : p.capitan ? 'Capitán' : p.asistente ? 'Asistente' : 'Jugador';
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
  const disc = (url, size, ring = '#FFFFFF', extra = '') => `<div class="disc" style="width:${size}px;height:${size}px;box-shadow:0 0 0 2px ${ring};${url ? `background-image:url('${esc(url)}');` : ''}${extra}"></div>`;
  const photo = (f, filter = 'grayscale(1)', pos = '50% 18%', extra = '', attrs = '') => f ? `<div class="ph"${attrs} style="filter:${filter};background-image:url('${esc(f)}');background-position:${pos};${extra}"></div>` : '';
  const lab = (t, extra = '') => `<div class="lab" style="${extra}">${t}</div>`;
  // 7h · cada fila parte del puesto de la semana anterior y se recoloca; ▲n / ▼n con los puestos ganados o perdidos
  const antesDe = (ligaId, wi) => { const sm = A.semanas[wi + 1], l = sm && sm.ligas.find(x => x.id === ligaId); return l ? Object.fromEntries(l.clasif.map(r => [r.equipo, r.puesto])) : {}; };
  const swapA = d => d ? ' data-anim="mpSwap .9s .3s cubic-bezier(.5,0,.2,1)"' : '';
  const swapS = (d, r, gap) => `position:relative;z-index:${r.nuestro ? 3 : d ? 2 : 1};${d ? `--dy:calc(${d} * (100% + ${gap}px));` : ''}`;
  const flecha = d => d ? `<span data-anim="mpArrow .3s 1.2s" style="flex:none;font-size:11px;font-weight:800;color:${d > 0 ? '#3DD27E' : '#FF5A52'}">${d > 0 ? '▲' + d : '▼' + -d}</span>` : '';
  // 7n · barra V/E/D por tramos (victorias → empates → derrotas) y el balance al final; filas en cascada
  const tramos = (h, i) => { const b0 = 150 + Math.min(i, 10) * 90;
    return { fila: ` data-anim="mpUp .35s ${b0}ms"`, bal: ` data-anim="mpFade .3s ${b0 + 1150}ms"`,
      barra: `<div data-anim="mpWipe .35s ${b0 + 200}ms" style="flex:${h.v};background:#1E8A4C;transform-origin:left"></div><div data-anim="mpWipe .25s ${b0 + 550}ms" style="flex:${h.e};background:#8A8A8F;transform-origin:left"></div><div data-anim="mpWipe .35s ${b0 + 800}ms" style="flex:${h.d};background:#55555B;transform-origin:left"></div>` }; };
  // 7p · cifras que giran como un rodillo, dígito a dígito (alto de línea .85em, como el resto de cifras grandes)
  const rodarCifra = (v, ms) => String(v).split('').map(ch => /\d/.test(ch)
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
    const bal = { pj: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0 };
    const nexts = [], mids = [];
    const cards = A.equipos.map(e => {
      const L = lgOf(e.ligaId);
      const m = e.cal.find(c => c.fecha && c.fecha >= w.desde && c.fecha <= w.hasta && c.resultado);
      const nx = e.cal.filter(c => c.fecha && c.fecha > w.hasta && !c.descanso && !c.resultado)
        .sort((a, b) => (a.fecha + (a.hora || '')) < (b.fecha + (b.hora || '')) ? -1 : 1)[0];
      const wn = w.nuestros.find(n => n.equipo === e.nombre);
      const lj = L.jornadas.find(j => j.desde && j.desde <= w.hasta && j.hasta >= w.desde);
      const ce = lj && e.cal.find(c => c.j === lj.n);
      const cl = wn ? wn.clasificacion : { puesto: e.clas ? e.clas.puesto : '-', de: L.clasif.length, pts: e.clas ? e.clas.pts : 0 };
      let gn = null, gr = null;
      if (m) { [gn, gr] = m.resultado.split('-').map(Number); bal.pj++; bal[m.r.toLowerCase()]++; bal.gf += gn; bal.gc += gr; if (m.mid) mids.push(m.mid); }
      if (nx) nexts.push({ e, nx });
      const r = m ? RES[m.r] : [(wn && wn.descansa) || (ce && ce.descanso) ? 'DESCANSA' : 'SIN PARTIDO', '#2E2E33'];
      const dots = Array.from({ length: cl.de || 0 }, (_, i) => `<div style="flex:1;height:8px;border-radius:2px;background:${i + 1 === cl.puesto ? RED : '#2E2E33'}"></div>`).join('');
      return `<div class="card" style="overflow:hidden;display:flex;flex-direction:column">
        ${box(hEq(e.id), 'display:flex;align-items:center;justify-content:space-between;padding:16px 18px 0;gap:8px', `
          <div style="display:flex;align-items:baseline;gap:10px;min-width:0"><span style="${BS}font-weight:900;font-size:44px;line-height:1;color:${RED}">${letraOf(e)}</span><span style="font-size:14px;font-weight:600;color:#A6A6AD">${esc(e.cantera ? tituloOf(e) + ' · ' + L.corto : L.corto)}</span></div>
          <span style="flex:none;font-size:13px;font-weight:700;letter-spacing:.06em;padding:4px 9px;border-radius:4px;background:${r[1]};color:#fff">${r[0]}</span>`)}
        ${box(m && m.mid ? hM(m.mid) : hEq(e.id), `padding:12px 18px 14px;${BS}font-weight:800;font-size:80px;line-height:.9;letter-spacing:-.01em;font-variant-numeric:tabular-nums;color:${m ? '#F4F4F5' : '#3A3A40'}`, m ? gn + '–' + gr : '—')}
        <div style="display:flex;align-items:center;gap:10px;padding:0 18px 16px;min-height:52px">
          ${m ? `${disc(crest(m.rival), 32)}<div style="min-width:0"><div style="font-weight:700;font-size:15px;letter-spacing:.02em">${esc(m.rival)}</div><div style="font-size:13px;color:#A6A6AD">${(m.casa ? 'En casa' : 'Fuera') + ' · ' + fd(m.fecha)}</div></div>` : ''}
        </div>
        <div style="padding:14px 18px;border-top:1px solid #26262A">
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#A6A6AD;font-weight:600"><span>Clasificación</span><span style="color:#F4F4F5">${cl.puesto}º de ${cl.de} · ${cl.pts} pts</span></div>
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
      p[pk].forEach(x => { if (x.tiros >= 10 && (!por || x.pct > por.pct)) por = Object.assign({}, x, { equipo: p[s], rival: p[o] }); });
      p[g].forEach(x => { if (!fig || x.g > fig.g || (x.g === fig.g && x.a > fig.a)) fig = Object.assign({}, x, { equipo: p[s], rival: p[o] }); });
    }); });
    // Más asistencias y más sancionado del club en la semana (sumando si un jugador juega más de un partido)
    const tot = {};
    mids.forEach(mid => { const p = A.partidos[mid]; [['local', 'alin_l', 'visitante'], ['visitante', 'alin_v', 'local']].forEach(([s, al, o]) => {
      if (!ours(p[s])) return;
      (p[al] || []).forEach(x => { const t = tot[x.k] || (tot[x.k] = Object.assign({}, x, { g: 0, a: 0, pim: 0, faltas: 0, equipo: p[s], rivales: [] }));
        t.g += x.g || 0; t.a += x.a || 0; t.pim += x.pim || 0; t.rivales.push(p[o]);
        t.faltas += (p.ev || []).filter(e => e.tipo === 'falta' && e.jugador && e.jugador.k === x.k).length; });
    }); });
    const asis = Object.values(tot).filter(x => x.a).sort((a, b) => b.a - a.a || b.g - a.g)[0];
    const sanc = Object.values(tot).filter(x => x.pim).sort((a, b) => b.pim - a.pim || b.faltas - a.faltas)[0];
    const empatan = (x, igual) => { const o = Object.values(tot).filter(y => y.k !== x.k && igual(y)).map(y => esc(corto(y)));
      return o.length ? `<br><span style="font-size:13px;font-weight:500;color:#A6A6AD">Empata con ${o.join(', ')}</span>` : ''; };
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
      const g = base.length ? (i * 3) % base.length : 0; base = base.slice(g).concat(base.slice(0, g)).slice(0, 8);
      const tira = base.concat(base, base, [x]);
      const item = j => `<div class="ini rod-item" style="background:${o.photoBg};font-size:48px;color:${o.iniInk}">${esc(ini(j.nombre, j.apellidos))}${pf(j) ? `<div class="ph" data-anim="mpReelBlur ${dur}ms" style="background-image:url('${esc(pf(j))}');background-position:50% 20%;filter:grayscale(1)"></div>` : ''}</div>`;
      return box(hP(x.k), `background:${o.bg};border-radius:12px;overflow:hidden;display:grid;grid-template-columns:${o.colW}px minmax(0,1fr);min-height:250px`, `
        <div class="rod-foto" style="background:${o.photoBg}"><div class="rod-tira" data-anim="mpReel ${dur}ms cubic-bezier(.12,.55,.18,1)">${tira.map(item).join('')}</div>
          <div class="rod-sombra" data-anim="mpFade .5s ${dur}ms reverse"></div><div class="rod-flash" data-anim="mpLand .6s ${dur}ms"></div></div>
        <div style="padding:20px 22px;display:flex;flex-direction:column;min-width:0">
          <div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:${o.titInk}">${o.titulo}</div>
          <div class="rod-txt"><div style="${BS}font-weight:800;font-size:${o.nameFs}px;line-height:1;margin-top:10px">${esc(corto(x))}</div><div style="font-size:15px;color:${o.subInk};margin-top:4px">${o.sub}</div></div>
          <div class="rod-num" style="margin-top:auto;padding-top:16px;display:flex;align-items:end;gap:${o.gap}px;flex-wrap:wrap">
            <div style="${BS}font-weight:900;font-size:${o.valFs}px;line-height:.85;color:${o.valInk};white-space:nowrap"><span data-cuenta="${o.valor}" data-fmt="${o.fmt}">${o.texto}</span>${o.suf ? `<span style="font-size:36px">${o.suf}</span>` : ''}</div>
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
      .filter(p => !seen[p.k] && (seen[p.k] = 1)).sort((a, b) => a.s < b.s ? -1 : 1).slice(0, 5);
    const [y1, m1, d1] = w.desde.split('-').map(Number), [y2, m2, d2] = w.hasta.split('-').map(Number);
    const older = A.semanas[wi + 1], newer = A.semanas[wi - 1];
    const arrow = (sem, ch) => sem ? `<a class="blk" href="${hJor(sem.id)}" style="width:32px;height:32px;display:grid;place-items:center;border:1px solid #3A3A40;border-radius:6px;color:#F4F4F5">${ch}</a>`
      : `<span style="width:32px;height:32px;display:grid;place-items:center;border:1px solid #3A3A40;border-radius:6px;color:#3A3A40">${ch}</span>`;
    const kpi = (k, v, ink = '') => `<div><div style="font-size:14px;color:#A6A6AD;font-weight:600">${k}</div><div style="${BS}font-weight:800;font-size:56px;line-height:1;${ink}">${v}</div></div>`;
    const gfPct = bal.gf + bal.gc ? (bal.gf / (bal.gf + bal.gc) * 100) + '%' : '0%';
    const porCard = por ? mejor({ x: por, porteros: true, titulo: 'PORTERO DE LA SEMANA', valor: por.pct, fmt: 'pct', texto: dec(por.pct), suf: '%',
      detalle: `${por.par} paradas<br>de ${por.tiros} tiros`, valInk: '#FFFFFF', bg: RED, photoBg: '#A9161E', iniInk: '#FFFFFF', titInk: '#FFFFFF', subInk: '#FFFFFF',
      sub: `#${esc(por.dorsal)} · ${esc(por.equipo)} vs ${esc(por.rival)}`, colW: 140, nameFs: 28, valFs: 76, gap: 16 }) : '';
    const figCard = fig ? mejor({ x: fig, titulo: 'GOLEADOR DEL CLUB', valor: fig.g, fmt: 'int', texto: fig.g, detalle: `goles · ${fig.a} asist.<br>vs ${esc(fig.rival)}`,
      valInk: RED, bg: '#18181B', photoBg: '#26262A', iniInk: '#A6A6AD', titInk: '#A6A6AD', subInk: '#C9C9CE', sub: `#${esc(fig.dorsal)} · ${esc(fig.equipo)}`, colW: 130, nameFs: 30, valFs: 88, gap: 14 }) : '';
    const proxHtml = proximos.map((p, i) => `<div class="prox-fila" style="display:grid;grid-template-columns:1fr 84px 1fr;gap:6px;padding:12px 0;border-bottom:1px solid #26262A;align-items:center">
        <div data-anim="mpInL .55s cubic-bezier(.3,1.3,.5,1) ${i * 160}ms" style="display:flex;flex-direction:column;align-items:center;gap:5px">${disc(p.lc, 52)}<span style="${BS}font-weight:800;font-size:17px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(p.la)}</span></div>
        <div data-anim="mpCrash .45s cubic-bezier(.3,1.4,.5,1) ${420 + i * 160}ms" style="text-align:center"><div style="${BS}font-weight:800;font-size:22px;line-height:1">${esc(p.hora)}</div><div style="font-size:12px;color:#A6A6AD;margin-top:2px">${p.dia}</div>${p.derbi ? `<div style="display:inline-block;margin-top:5px;font-size:11px;font-weight:700;letter-spacing:.1em;padding:2px 6px;border-radius:3px;background:${RED}">DERBI</div>` : ''}</div>
        <div data-anim="mpInR .55s cubic-bezier(.3,1.3,.5,1) ${i * 160}ms" style="display:flex;flex-direction:column;align-items:center;gap:5px">${disc(p.vc, 52)}<span style="${BS}font-weight:800;font-size:17px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(p.va)}</span></div>
      </div>`).join('');
    const tablas = w.ligas.map(l => { const antes = antesDe(l.id, wi); return `<div class="card" style="padding:20px 22px">
        ${box(hLg(l.id), 'display:flex;justify-content:space-between;align-items:baseline;width:100%;gap:8px', `<span style="${BS}font-weight:800;font-size:28px">${esc(l.nombre)}</span><span style="font-size:14px;color:#A6A6AD">Ver liga →</span>`)}
        <div data-grupo style="display:flex;flex-direction:column;gap:2px;margin-top:12px">${tableRows(l.clasif).map(r => { const d = antes[r.equipo] ? antes[r.equipo] - r.puesto : 0; return `
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
          <div style="${BS}font-weight:900;font-size:clamp(64px,10vw,120px);line-height:.85;letter-spacing:-.01em;margin-top:14px">SEMANA <span style="color:${RED}">${esc(w.id.split('S')[1])}</span></div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
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
      ${aplazado ? '<span style="font-size:11px;font-weight:700;letter-spacing:.06em;color:#FF8A3D;margin-top:3px">APLAZADO</span>' : ''}
      <div style="position:relative;margin-top:${aplazado ? 4 : 10}px;width:100%;padding:6px 0;text-align:center;background:#26262A;color:#FFFFFF;${BS}font-weight:800;font-size:20px;line-height:1">
        <div data-anim="mpWipe .4s ${350 + i * 70}ms" style="position:absolute;inset:0;background:${col};transform-origin:left"></div><span style="position:relative">${played ? c.resultado.replace('-', '–') : fd(c.fecha).replace(/^\S+ /, '')}</span></div>`, 'div', ' ' + FLIP(i));
  }
  function playerCard(k) {
    const p = A.jugadores[k]; const t = p.temporadas['2025/26'], t7 = p.temporadas['2026/27'];
    const stat = t ? t.goles + ' G · ' + t.asistencias + ' A en ' + t.pj + ' PJ' : (t7 && t7.pj ? t7.goles + ' G · ' + t7.asistencias + ' A este año' : 'Sin datos previos');
    return box(hP(k), 'background:#18181B;border-radius:10px;overflow:hidden;display:flex;flex-direction:column', `
      <div class="ini" style="aspect-ratio:4/5;background:#26262A;font-size:48px;color:#55555B">${esc(ini(p.nombre, p.apellidos))}${photo(p.foto)}<span style="position:absolute;left:8px;bottom:6px;${BS}font-weight:900;font-size:40px;line-height:1;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${esc(p.dorsal || '')}</span></div>
      <div style="padding:10px 12px"><div style="font-weight:700;font-size:15px;line-height:1.15">${esc(corto(p))}</div><div style="font-size:13px;color:#A6A6AD;margin-top:2px">${stat}</div></div>`);
  }
  function vEquipo(id) {
    const e = A.equipos.find(x => x.id === id) || A.equipos[0], L = lgOf(e.ligaId), J = A.jugadores;
    S.eq = e.id;
    const c = e.clas || { puesto: '-', pts: 0, pj: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0 };
    const tabs = A.equipos.map(x => `<a class="blk" href="${hEq(x.id)}" style="padding:10px 18px;border-radius:8px;background:${x.id === e.id ? RED : '#18181B'};color:${x.id === e.id ? '#FFFFFF' : '#C9C9CE'};${BS}font-weight:800;font-size:22px;letter-spacing:.02em">${x.cantera ? tituloOf(x) : x.id}</a>`).join('');
    const sub = [e.proc, e.edad ? 'Edad media ' + dec(e.edad) : null].filter(Boolean).join(' · ') || L.nombre;
    const tiles = [['Puesto', c.puesto + 'º/' + L.clasif.length, RED], ['Puntos', c.pts], ['PJ', c.pj], ['V-E-D', c.v + '-' + c.e + '-' + c.d], ['Goles', c.gf + ':' + c.gc]]
      .map(([k, v, ink]) => `<div style="padding:12px 16px;background:#121214;border-radius:8px;min-width:96px"><div style="font-size:13px;color:#A6A6AD;font-weight:600">${k}</div><div style="${BS}font-weight:800;font-size:36px;line-height:1;color:${ink || '#F4F4F5'}">${v}</div></div>`).join('');
    const clave = e.clave.filter(k => J[k]).map(playerCard).join('');
    // 7j · altas desde la izquierda (borde verde) y bajas hacia la derecha (borde rojo), en cascada
    const altas = e.altas.filter(a => J[a.k]).map((a, i) => box(hP(a.k), 'display:flex;justify-content:space-between;gap:10px;width:100%;padding:9px 0 9px 10px;border-bottom:1px solid #26262A;box-shadow:inset 3px 0 0 #3DD27E',
      `<span style="font-weight:700">#${esc(J[a.k].dorsal)} ${esc(corto(J[a.k]))}</span><span style="color:#A6A6AD;font-size:14px;text-align:right">${esc(a.desde ? 'de ' + a.desde : 'Nuevo')}</span>`, 'div', ` data-anim="mpInL .45s cubic-bezier(.2,.8,.2,1) ${150 + i * 110}ms"`)).join('');
    const bajas = e.bajas.map((b, i) => `<div data-anim="mpInR .45s cubic-bezier(.2,.8,.2,1) ${250 + i * 110}ms" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:9px 10px 9px 0;border-bottom:1px solid #26262A;box-shadow:inset -3px 0 0 #FF5A52;align-items:center">
        <div style="min-width:0"><div style="font-weight:700">#${esc(b.dorsal)} ${esc(corto(b))}</div><div style="color:#A6A6AD;font-size:14px">${esc(b.destino ? '→ ' + b.destino + (b.destinoLiga ? ' · ' + b.destinoLiga : '') : 'Sin equipo esta temporada')}</div></div>
        <div style="text-align:right"><div style="${BS}font-weight:800;font-size:22px;line-height:1">${b.pct != null ? dec(b.pct) + '%' : '—'}</div><div style="font-size:12px;color:#A6A6AD">de los puntos</div></div></div>`).join('');
    const h2h = e.h2h.filter(h => !ours(h.rival)).sort((a, b) => (b.v + b.e + b.d) - (a.v + a.e + a.d));
    const h2hHtml = h2h.map((h, i) => { const t = tramos(h, i); return `<div class="fila-barra"${t.fila} style="--c1:28px;display:grid;grid-template-columns:28px minmax(0,1fr) minmax(80px,280px) 90px;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid #26262A">
        ${disc(crest(h.rival), 26)}<span style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.rival)}</span>
        <div class="barra" style="display:flex;height:10px;border-radius:3px;overflow:hidden;background:#26262A">${t.barra}</div>
        <span${t.bal} style="text-align:right;${BS}font-weight:800;font-size:20px">${h.v}-${h.e}-${h.d}</span></div>`; }).join('');
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:28px">${tabs}</div>
      <div style="margin-top:16px;border-radius:14px;overflow:hidden;background:#18181B">
        <div style="display:flex;flex-wrap:wrap;align-items:stretch">
          <div style="background:${e.kit[0]};color:${e.kit[1]};padding:24px 28px;min-width:200px;display:flex;flex-direction:column;justify-content:space-between;gap:12px">
            <img src="escudos/badge/madridpatina.png" alt="" style="width:52px;height:52px;object-fit:contain;border-radius:50%;box-shadow:0 0 0 2px #FFFFFF">
            <div style="${BS}font-weight:900;font-size:120px;line-height:.8">${letraOf(e)}</div>
          </div>
          <div style="flex:1;min-width:260px;padding:24px 28px;display:flex;flex-direction:column;gap:18px">
            <div>
              ${lab(esc(e.liga.toUpperCase()))}
              <div style="${BS}font-weight:900;font-size:clamp(40px,6vw,64px);line-height:.95">${esc(tituloOf(e).toUpperCase())}</div>
              <div style="font-size:15px;color:#C9C9CE;margin-top:6px">${esc(sub)}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:10px">${tiles}</div>
          </div>
        </div>
      </div>
      ${lab('CALENDARIO · ' + e.cal.length + ' JORNADAS', 'margin:28px 0 10px')}
      <div class="cal-grid" data-grupo style="display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px">${e.cal.map((c, i) => calTile(c, e.cal, i)).join('')}</div>
      ${(() => { const jug = e.cal.filter(c => c.mid && A.partidos[c.mid]).reverse();
        return jug.length ? `${lab('PARTIDOS JUGADOS · ' + A.temporada + ' · ' + jug.length, 'margin:28px 0 10px')}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr));gap:12px;align-items:start">${jug.map(c => { const r = RES[c.r] || ['', '#2E2E33'];
          return `<div class="card" style="overflow:hidden">
            ${box(hM(c.mid), 'display:flex;align-items:center;gap:12px;padding:14px 18px', `${disc(crest(c.rival), 36)}
              <div style="flex:1;min-width:0"><div style="font-size:13px;color:#A6A6AD;font-weight:600">J${c.j} · ${c.casa ? 'En casa' : 'Fuera'} · ${fd(c.fecha)}</div><div style="font-weight:700;font-size:15px">${esc(c.rival)}</div></div>
              <div style="text-align:right"><div style="${BS}font-weight:800;font-size:32px;line-height:1">${esc((c.resultado || '').replace('-', '–'))}</div><div style="font-size:11px;font-weight:700;letter-spacing:.06em;padding:2px 6px;border-radius:3px;background:${r[1]};color:#fff;margin-top:4px;display:inline-block">${r[0]}</div></div>`)}
            ${actaMini(A.partidos[c.mid], e.nombre)}</div>`; }).join('')}</div>` : ''; })()}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:12px;margin-top:28px">
        <div>${lab('JUGADORES CLAVE · 2025/26', 'margin-bottom:10px')}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">${clave}</div></div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="card" data-grupo style="padding:18px 20px"><div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#3DD27E">ALTAS · ${e.altas.length}</div>${altas}</div>
          <div class="card" data-grupo style="padding:18px 20px"><div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#FF5A52">BAJAS · ${e.bajas.length}</div>${bajas}</div>
        </div>
      </div>
      ${h2h.length ? `${lab('CARA A CARA CON LOS RIVALES DE LA LIGA · HISTÓRICO', 'margin:28px 0 10px')}
        <div class="card" data-grupo style="padding:10px 20px">${h2hHtml}
          <div style="display:flex;gap:16px;font-size:13px;color:#A6A6AD;padding:10px 0 6px"><span>■ <span style="color:#3DD27E">Victorias</span></span><span>■ Empates</span><span>■ Derrotas</span></div></div>` : ''}`;
  }

  /* ── 3. Ligas ───────────────────────────────────────────── */
  function vLiga(id, sub, jn) {
    const L = lgOf(id) || A.ligas[0];
    S.lg = L.id;
    const jsel = jn && jn >= 1 && jn <= L.total ? jn : L.ultima;
    const J0 = L.jornadas.find(j => j.n === jsel) || { partidos: [] };
    const hasPre = !!L.pre, lt = 'tabla';
    const tabs = A.ligas.map(l => `<a class="blk" href="${hLg(l.id)}" style="padding:10px 18px;border-radius:8px;background:${l.id === L.id ? RED : '#18181B'};color:${l.id === L.id ? '#FFFFFF' : '#C9C9CE'};font-weight:700;font-size:15px;white-space:nowrap">${esc(l.nombre)}</a>`).join('');
    const subs = [['tabla', 'Clasificación y jornadas', hLg(L.id)]].concat(hasPre ? [['llega', 'Pretemporada', hPre(L.id)]] : [])
      .map(([k, l, h]) => `<a class="blk" href="${h}" style="padding:12px 16px;font-weight:700;font-size:15px;white-space:nowrap;color:${lt === k ? '#F4F4F5' : '#A6A6AD'};border-bottom:3px solid ${lt === k ? RED : 'transparent'};margin-bottom:-1px">${l}</a>`).join('');
    let body;
    if (lt === 'tabla') {
      const antes = antesDe(L.id, 0);
      const rows = tableRows(L.clasif).map(r => { const d = antes[r.equipo] ? antes[r.equipo] - r.puesto : 0; return `<div${swapA(d)} style="${swapS(d, r, 0)}display:grid;grid-template-columns:26px 26px minmax(0,1fr) 30px 30px 30px 30px 44px 44px;gap:8px;align-items:center;padding:8px;border-radius:6px;background:${r.bg};font-size:15px">
          <span style="font-weight:700;color:#A6A6AD;text-align:right">${r.puesto}</span>${disc(r.crest, 24)}
          <span style="display:flex;align-items:center;gap:6px;min-width:0">${box(hT(r.equipo), `min-width:0;font-weight:${r.weight};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`, esc(r.equipo), 'span')}${flecha(d)}</span>
          <span style="text-align:center">${r.pj}</span><span style="text-align:center">${r.v}</span><span style="text-align:center">${r.e}</span><span style="text-align:center">${r.d}</span><span style="text-align:center;color:#C9C9CE">${r.dg}</span>
          <span style="text-align:right;${BS}font-weight:800;font-size:22px">${r.pts}</span></div>`; }).join('');
      // todas las jornadas se abren: las jugadas con resultado y las que faltan con su fecha y hora
      const strip = Array.from({ length: L.total }, (_, i) => { const n = i + 1, has = L.jornadas.some(j => j.n === n);
        const st = `flex:none;width:40px;height:40px;border-radius:6px;display:grid;place-items:center;${BS}font-weight:800;font-size:18px;background:${n === jsel ? RED : (has ? '#26262A' : 'transparent')};color:${n === jsel || has ? '#F4F4F5' : '#A6A6AD'};border:1px solid ${n === jsel ? RED : '#26262A'}`;
        return `<a class="blk" href="${hLg(L.id, 'j/' + n)}" style="${st}">${n}</a>`; }).join('');
      const partidos = J0.partidos.map(m => box(hM(m.mid), `display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;width:100%;padding:12px 8px;border-radius:8px;background:${m.nuestro ? '#2A1416' : 'transparent'};border-bottom:1px solid #26262A`, `
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px"><span style="${BS}font-weight:800;font-size:19px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(abr(m.local))}</span>${disc(crest(m.local), 44)}</div>
          <span style="text-align:center;${BS}font-weight:800;font-size:28px;line-height:1;min-width:70px;white-space:nowrap">${m.gl != null ? m.gl + '–' + m.gv : fd(m.fecha)}</span>
          <div style="display:flex;align-items:center;gap:10px">${disc(crest(m.visitante), 44)}<span style="${BS}font-weight:800;font-size:19px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(abr(m.visitante))}</span></div>`)).join('')
        + (L.cal || []).filter(c => c.j === jsel && c.gl == null && !J0.partidos.some(m => m.local === c.local && m.visitante === c.visitante))
          .sort((a, b) => ((a.fecha || '9') + (a.hora || '')) < ((b.fecha || '9') + (b.hora || '')) ? -1 : 1)
          .map(c => `<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;width:100%;padding:12px 8px;border-radius:8px;background:${ours(c.local) || ours(c.visitante) ? '#2A1416' : 'transparent'};border-bottom:1px solid #26262A">
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px"><span style="${BS}font-weight:800;font-size:19px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(abr(c.local))}</span>${disc(crest(c.local), 44)}</div>
          <span style="text-align:center;min-width:70px;line-height:1.15"><span style="display:block;${BS}font-weight:800;font-size:17px;white-space:nowrap">${c.fecha ? esc(fd(c.fecha)) : 'Fecha por fijar'}</span><span style="font-size:13px;color:#A6A6AD;white-space:nowrap">${esc(c.hora || 'hora por fijar')}</span></span>
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
          <div class="card" style="padding:16px 18px;overflow-x:auto"><div data-grupo style="min-width:480px">
            <div style="display:grid;grid-template-columns:26px 26px minmax(0,1fr) 30px 30px 30px 30px 44px 44px;gap:8px;font-size:13px;font-weight:700;color:#A6A6AD;padding:4px 8px 8px;border-bottom:1px solid #26262A">
              <span></span><span></span><span>Equipo</span><span style="text-align:center">PJ</span><span style="text-align:center">V</span><span style="text-align:center">E</span><span style="text-align:center">D</span><span style="text-align:center">DG</span><span style="text-align:right">PTS</span></div>
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
        <div style="${BS}font-weight:900;font-size:clamp(48px,7vw,84px);line-height:.9">${esc(L.nombre)}</div>
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
    if (x.desde && ours(x.desde) && ours(equipo)) { const de = mpLbl(x.desde, x.desdeLiga), a = mpLbl(equipo, liga); return mpRango(a) < mpRango(de) ? ['sube', '↑ sube de ' + de, '#3DD27E'] : ['baja', '↓ baja de ' + de, '#FF8A3D']; }
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
  function tablero() {
    const sen = A.equipos.filter(e => !e.cantera), ids = sen.map(e => e.id), OUT = sen.length, moves = [];
    const nom = (a, b) => ((a || '').split(' ')[0] + ' ' + (b || '').split(' ')[0]).trim();
    sen.forEach((e, di) => (e.altas || []).forEach(a => { const j = A.jugadores[a.k] || {};
      const from = a.desde && ours(a.desde) ? ids.indexOf(a.desde.split(' ').pop()) : a.desde ? OUT : -1;
      if (from >= 0) moves.push({ from, to: di, nombre: nom(j.nombre, j.apellidos), foto: j.foto, tipo: from === OUT ? 'in' : 'int' }); }));
    sen.forEach((e, fi) => (e.bajas || []).forEach(b => { if (b.destino && !ours(b.destino)) moves.push({ from: fi, to: OUT, nombre: nom(b.nombre, b.apellidos), foto: b.foto, tipo: 'out' }); }));
    if (!moves.length) return '';
    const BW = anchoUtil(16), NARROW = BW < 760;
    const dep = {}, arr = {}; moves.forEach(m => { dep[m.from] = (dep[m.from] || 0) + 1; arr[m.to] = (arr[m.to] || 0) + 1; });
    const cols = sen.map(e => ({ t: 'MP ' + e.id, sub: e.liga.replace(/^Liga\s+/i, ''), c: 'escudos/badge/madridpatina.png' })).concat([{ t: 'OTROS CLUBES', sub: '', c: '' }]);
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
    return `${lab('MOVIMIENTOS ENTRE EQUIPOS · ' + moves.length, 'margin:28px 0 10px')}
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
      html = `<div class="tira${k === 0 ? ' t0' : ''}" style="--a:${ANG[k].toFixed(2)}deg;--dIn:${k * 14}ms;--dOut:${(N - k) * 8}ms"><div class="recorte" style="border-radius:${rad}">${papel(W - (k + 1) * w)}<div class="sombra" style="background:linear-gradient(to left,rgba(0,0,0,${sh(k)}),rgba(0,0,0,${sh(k + 1)}))"></div>${k === 0 ? '<div class="muesca" style="right:-8px"></div>' : ''}${k === N - 1 ? '<div class="muesca" style="left:-8px"></div>' : ''}</div>${html}</div>`;
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
        <div class="reverso"><div style="width:84px;height:84px;border-radius:50%;box-shadow:0 0 0 3px #FFFFFF;background:url('escudos/badge/madridpatina.png') center/contain no-repeat"></div><div style="${BS}font-weight:900;font-size:26px;letter-spacing:.06em;color:#FFFFFF">↩ DE VUELTA</div></div>
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
    const vistos = new Set(), out = [];
    A.equipos.filter(e => !e.cantera && (!fe || e.id === fe.id)).forEach(e => (e.bajas || []).forEach(b => {
      if (b.destino || b.estado === 'otro_rol') return;
      const k = (b.nombre + ' ' + b.apellidos).toLowerCase(); if (vistos.has(k)) return; vistos.add(k);
      const hj = H && H.byTok[H.tok(b.nombre + ' ' + b.apellidos)];
      if (hj && hj.adulto === false) return;
      out.push({ e, b, yrs: hj ? new Set(hj.temporadas.filter(t => ours(t.equipo)).map(t => t.temporada)).size : 0, pct: b.pct || 0 });
    }));
    return out.sort((x, y) => y.pct - x.pct).slice(0, 5);
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
        <div><div style="font-weight:700;font-size:15px;line-height:1.15;color:#F4F4F5">${esc(corto(b))}</div><div style="font-size:12px;color:#A6A6AD">Visto por última vez: ${prev} · MP ${esc(m.e.id)}</div></div>
        <div style="display:flex;align-items:baseline;gap:6px"><span style="${BS}font-weight:900;font-size:30px;line-height:1;color:#F4F4F5">${dec(m.pct)}%</span><span style="font-size:11px;font-weight:600;color:#A6A6AD;line-height:1.2">de los puntos de su equipo en ${prev.slice(2)}</span></div>
        ${m.yrs ? `<div style="font-size:12px;color:#8A8A8F">${m.yrs} ${m.yrs === 1 ? 'temporada' : 'temporadas'} en MP</div>` : ''}
      </div></div></div>`;
  }
  // los dos cromos de Pretemporada (también en Jugadores, bajo la franja de rookies); en el móvil, carrusel
  function seccionCromos(fe) {
    const vu = vuelven(fe), sb = H ? seBusca(fe) : [];
    if (!vu.length && !sb.length) return '';
    return `<div style="--fondo:#0D0D0E">
      ${vu.length ? `${lab('BILLETE DE VUELTA · ' + vu.length, 'margin:28px 0 2px;color:#3DD27E')}<div style="font-size:13px;color:#A6A6AD">Vuelven a MADRIDPATINA tras un tiempo fuera</div><div class="cromos">${vu.map(billete).join('')}</div>` : ''}
      ${sb.length ? `${lab('SE BUSCA · ' + sb.length, 'margin:20px 0 2px;color:#FF5A52')}<div style="font-size:13px;color:#A6A6AD">Estaban la temporada pasada y aún no han jugado esta. ¡Os esperamos!</div><div class="cromos">${sb.map(buscado).join('')}</div>` : ''}
    </div>`;
  }
  function movimientosClub() {
    const G = { interno: [], vuelven: [], llegan: [], debutan: [], seVan: [], rol: [], pendientes: [] }, vistos = new Set();
    A.ligas.filter(l => l.pre).forEach(L => L.pre.equipos.filter(e => e.nuestro).forEach(e => {
      const yo = mpLbl(e.equipo, L.nombre);
      (e.altas || []).forEach(x => { const t = tipoAlta(x, e.equipo, L.nombre)[0];
        if (t === 'sube' || t === 'baja') { if (!vistos.has(x.k)) { vistos.add(x.k); G.interno.push({ x, de: mpLbl(x.desde, x.desdeLiga), a: yo, t, nota: x.nota }); } }
        else if (t === 'vuelve') G.vuelven.push({ x, a: yo });
        else if (t === 'fuera') G.llegan.push({ x, a: yo });
        else G.debutan.push({ x, a: yo }); });
      (e.bajas || []).forEach(x => {
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
    const G = movimientosClub();
    const jn = x => { const t = `${x.dorsal ? '<span style="color:#A6A6AD">#' + esc(x.dorsal) + '</span> ' : ''}${esc(corto(x))}`; return A.jugadores[x.k] ? `<a href="${hP(x.k)}">${t}</a>` : t; };
    const st = s2 => s2 && s2.pj ? ` · 25/26: ${s2.pj} PJ · ${s2.goles} G ${s2.asistencias} A` : '';
    const fila = (izq, dcha) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid #26262A"><div style="min-width:0">${izq}</div><div style="text-align:right">${dcha}</div></div>`;
    const chip = (t, c) => `<span style="font-size:12px;font-weight:700;padding:3px 8px;border-radius:4px;background:${c};color:#0D0D0E;white-space:nowrap">${t}</span>`;
    const bloque = (titulo, color, filas, nota) => filas.length ? `<div class="card" style="padding:16px 20px">
        <div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:${color}">${titulo} · ${filas.length}</div>${nota ? `<div style="font-size:13px;color:#A6A6AD;margin-top:2px">${nota}</div>` : ''}${filas.join('')}</div>` : '';
    const interno = G.interno.map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div><div style="font-size:12px;color:#A6A6AD">${esc(m.nota || '')}${st(m.x.stats)}</div>`,
      `<span style="${BS}font-weight:800;font-size:18px;white-space:nowrap">${esc(m.de)} <span style="color:${m.t === 'sube' ? '#3DD27E' : '#FF8A3D'}">${m.t === 'sube' ? '↑' : '↓'}</span> ${esc(m.a)}</span>`));
    const vuelven = G.vuelven.map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div><div style="font-size:12px;color:#A6A6AD">${esc((m.x.nota || '').replace(/^Vuelve:\s*/, 'Su última temporada: '))}</div>`, chip(m.a, '#6FB7FF')));
    const llegan = G.llegan.map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div><div style="font-size:12px;color:#A6A6AD">de ${esc(m.x.desde)}${m.x.desdeLiga ? ' · ' + esc(m.x.desdeLiga) : ''}${st(m.x.stats)}</div>`, chip(m.a, '#C9A7F5')));
    const debutan = G.debutan.map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div><div style="font-size:12px;color:#A6A6AD">${esc(m.x.nota || 'Primer año')}</div>`, chip(m.a, '#FF6B63')));
    const seVan = G.seVan.map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div><div style="font-size:12px;color:#A6A6AD">→ ${esc(m.x.destino)}${m.x.destinoLiga ? ' · ' + esc(m.x.destinoLiga) : ''}</div>`, chip(m.de, '#3A3A40').replace('color:#0D0D0E', 'color:#F4F4F5')));
    const rol = G.rol.map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div><div style="font-size:12px;color:#A6A6AD">${esc(m.x.nota || '')}</div>`, chip(m.de, '#3A3A40').replace('color:#0D0D0E', 'color:#F4F4F5')));
    const pend = G.pendientes.map(m => fila(`<div style="font-weight:700">${jn(m.x)}</div>`, chip(m.de, '#3A3A40').replace('color:#0D0D0E', 'color:#F4F4F5')));
    const kpis = [['Cambian de equipo', G.interno.length, '#3DD27E'], ['Vuelven', G.vuelven.length, '#6FB7FF'], ['Llegan de otros clubes', G.llegan.length, '#C9A7F5'],
      ['Debutan', G.debutan.length, '#FF6B63'], ['Se van a otros clubes', G.seVan.length, '#A6A6AD']]
      .map(([k, v, ink]) => `<div style="padding:14px 18px;background:#18181B;border-radius:10px;min-width:120px"><div style="font-size:14px;color:#A6A6AD;font-weight:600">${k}</div><div style="${BS}font-weight:800;font-size:48px;line-height:1;color:${ink}">${v}</div></div>`).join('');
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:28px">${tabs}</div>
      <div style="margin-top:24px"><div class="lab" style="color:#FF6B63">PRETEMPORADA ${esc(A.temporada)}</div><div style="${BS}font-weight:900;font-size:clamp(44px,6.5vw,80px);line-height:.9;margin-top:6px">Nuestro club</div></div>
      <div style="font-size:15px;line-height:1.5;color:#C9C9CE;margin-top:12px;max-width:860px">Quién sube o baja entre nuestros equipos, quién vuelve, quién llega de otro club y quién debuta, en todas las ligas en las que jugamos.</div>
      <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap">${kpis}</div>
      ${tablero()}
      ${seccionCromos(null)}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:24px;align-items:start">
        ${bloque('CAMBIAN DE EQUIPO DENTRO DEL CLUB', '#3DD27E', interno, '↑ sube a un equipo de más nivel · ↓ baja')}
        ${bloque('VUELVEN', '#6FB7FF', vuelven, 'No jugaron la temporada pasada y vuelven este año')}
        ${bloque('LLEGAN DE OTROS CLUBES', '#C9A7F5', llegan)}
        ${bloque('DEBUTAN', '#FF6B63', debutan, 'Su primer año en la competición')}
        ${bloque('SE VAN A OTROS CLUBES', '#A6A6AD', seVan)}
        ${bloque('CAMBIAN DE PAPEL', '#A6A6AD', rol)}
        ${bloque('AÚN NO HAN JUGADO ESTA TEMPORADA', '#55555B', pend, 'Estaban la temporada pasada; pueden volver en cualquier jornada')}
      </div>`;
  }

  /* ── Pretemporada: cómo llega cada liga en la que jugamos (todos los equipos y jugadores) ── */
  function vPretemporada(id) {
    const ls = A.ligas.filter(l => l.pre);
    if (!ls.length) return '<div class="loading">Sin datos de pretemporada.</div>';
    const tabClub = `<a class="blk" href="${hPre('club')}" style="padding:10px 18px;border-radius:8px;background:${!id || id === 'club' ? RED : '#18181B'};color:${!id || id === 'club' ? '#FFFFFF' : '#C9C9CE'};font-weight:700;font-size:15px;white-space:nowrap">MADRIDPATINA</a>`;
    if (!id || id === 'club') return vPretemporadaClub(tabClub + ls.map(l => `<a class="blk" href="${hPre(l.id)}" style="padding:10px 18px;border-radius:8px;background:#18181B;color:#C9C9CE;font-weight:700;font-size:15px;white-space:nowrap">${esc(l.nombre)}</a>`).join(''));
    const L = ls.find(l => l.id === id) || ls[0];
    S.lg = L.id;
    const P = L.pre;
    const T = { baja: ['↓', '#FF8A3D', 'BAJA'], sube: ['↑', '#3DD27E', 'SUBE'], nuevo: ['★', RED, 'NUEVO'], viene: ['→', '#6B6B70', 'VIENE'], sigue: ['', '#3A3A40', 'SIGUE'] };
    const tabs = tabClub + ls.map(l => `<a class="blk" href="${hPre(l.id)}" style="padding:10px 18px;border-radius:8px;background:${l.id === L.id ? RED : '#18181B'};color:${l.id === L.id ? '#FFFFFF' : '#C9C9CE'};font-weight:700;font-size:15px;white-space:nowrap">${esc(l.nombre)}</a>`).join('');
    // jugador: enlace a su ficha si es de los nuestros
    const jn = x => { const t = `${x.dorsal ? '<span style="color:#A6A6AD">#' + esc(x.dorsal) + '</span> ' : ''}${esc(corto(x))}`; return A.jugadores[x.k] ? `<a href="${hP(x.k)}">${t}</a>` : t; };
    const st = s2 => s2 && s2.pj ? `${s2.pj} PJ · ${s2.goles} G ${s2.asistencias} A` : '';
    const tag = e => { const t = T[e.tipo] || T.sigue; return e.tipo === 'sigue' ? '' : ` <span style="font-size:11px;font-weight:700;letter-spacing:.06em;padding:2px 6px;border-radius:3px;background:${t[1]};color:#fff;vertical-align:2px">${t[2]}</span>`; };
    const eqs = P.equipos.slice().sort((a, b) => (a.fuerza ? a.fuerza.puesto : 99) - (b.fuerza ? b.fuerza.puesto : 99));
    const nA = P.equipos.reduce((n, e) => n + (e.altas || []).length, 0), nB = P.equipos.reduce((n, e) => n + (e.bajas || []).length, 0);
    const kpis = [['Equipos', P.equipos.length, '#F4F4F5'], ['Llegan de otra liga o son nuevos', P.equipos.filter(e => e.tipo !== 'sigue').length, '#3DD27E'],
      ['Altas', nA, '#F4F4F5'], ['Bajas', nB, '#A6A6AD']].concat(L.rookies.length ? [['Rookies', L.rookies.length, '#FF6B63']] : [])
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
    // 3) Cómo llegan los equipos
    const item = e => box(hT(e.equipo), 'display:flex;flex-direction:column;align-items:center;gap:4px;width:64px', `
        <div style="position:relative">${disc(crest(e.equipo), 52, e.nuestro ? RED : '#FFFFFF')}${T[e.tipo] && e.tipo !== 'sigue' ? `<span style="position:absolute;right:-6px;top:-6px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:900;background:${T[e.tipo][1]};color:#fff">${T[e.tipo][0]}</span>` : ''}</div>
        <span style="${BS}font-weight:800;font-size:15px;white-space:nowrap">${esc(abr(e.equipo))}</span>
        <span style="font-size:11px;color:#A6A6AD;white-space:nowrap">${esc(((e.detalle || '').match(/(\d+)º/) || [])[1] ? (e.detalle.match(/(\d+)º/)[1] + 'º en 25/26') : (e.tipo === 'nuevo' ? 'nuevo' : ''))}</span>`, 'div');
    const grupos = [['sube', 'SUBEN'], ['baja', 'BAJAN'], ['nuevo', 'NUEVOS'], ['viene', 'VIENEN DE OTRA LIGA O CATEGORÍA'], ['sigue', 'SIGUEN']]
      .map(([t, k]) => [k, P.equipos.filter(e => e.tipo === t)]).filter(([, l]) => l.length);
    const fuera = (P.fuera || []).map(f => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:84px;opacity:.5;text-align:center">${disc(f.escudo || crest(f.equipo), 52, '#55555B')}<span style="${BS}font-weight:800;font-size:15px;white-space:nowrap">${esc(abr(f.equipo))}</span><span style="font-size:11px;line-height:1.25;color:#A6A6AD">${esc(f.que_paso || '')}</span></div>`).join('');
    const mov = grupos.map(([k, l]) => `<div style="display:grid;grid-template-columns:minmax(0,150px) minmax(0,1fr);gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid #26262A">
        <div style="font-size:12px;font-weight:700;letter-spacing:.1em;color:#A6A6AD">${k} · ${l.length}</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap">${l.map(item).join('')}</div></div>`).join('')
      + (fuera ? `<div style="display:grid;grid-template-columns:minmax(0,150px) minmax(0,1fr);gap:14px;align-items:center;padding:10px 0"><div style="font-size:12px;font-weight:700;letter-spacing:.1em;color:#55555B">YA NO ESTÁN</div><div style="display:flex;gap:14px;flex-wrap:wrap">${fuera}</div></div>` : '');
    // 4) Altas y bajas, equipo por equipo (los nuestros primero)
    const orden = P.equipos.slice().sort((a, b) => (b.nuestro - a.nuestro) || ((a.fuerza || {}).puesto - (b.fuerza || {}).puesto));
    const lin = (x, sub, dir, i) => { const al = dir === 'alta';
      return `<div data-anim="${al ? 'mpInL' : 'mpInR'} .45s cubic-bezier(.2,.8,.2,1) ${(al ? 150 : 250) + i * 110}ms" style="padding:${al ? '7px 0 7px 10px' : '7px 10px 7px 0'};border-bottom:1px solid #26262A;box-shadow:inset ${al ? '3px' : '-3px'} 0 0 ${al ? '#3DD27E' : '#FF5A52'}"><div style="font-weight:600">${jn(x)}${x.portero ? ' <span style="font-size:12px;color:#A6A6AD">· portero</span>' : ''}${x.tag ? ` <span style="font-size:11px;font-weight:700;padding:1px 6px;border-radius:3px;background:${x.tag[2]};color:#0D0D0E;white-space:nowrap">${esc(x.tag[1])}</span>` : ''}</div><div style="font-size:12px;color:#A6A6AD">${sub}</div></div>`; };
    const ab = orden.map(e => {
      const altas = (e.altas || []).map((x, i) => { const t = tipoAlta(x, e.equipo, L.nombre); return lin(Object.assign({}, x, { tag: t }), (x.desde ? 'de ' + esc(x.desde) + (x.desdeLiga ? ' · ' + esc(x.desdeLiga) : '') : esc(x.nota || 'Nuevo')) + (x.stats ? ' · 25/26: ' + st(x.stats) : ''), 'alta', i); }).join('') || '<div style="padding:7px 0;color:#A6A6AD;font-size:14px">Ninguna</div>';
      const bajas = (e.bajas || []).map((x, i) => lin(x, x.destino ? '→ ' + esc(x.destino) + (x.destinoLiga ? ' · ' + esc(x.destinoLiga) : '') : esc(x.nota || 'Sin partidos esta temporada'), 'baja', i)).join('') || '<div style="padding:7px 0;color:#A6A6AD;font-size:14px">Ninguna</div>';
      const gk = (e.porteros || []).map(g => `${jn(g)} <span style="color:#A6A6AD">${g.pct != null ? dec(g.pct) + '%' : 'sin historial'}</span>`).join(' · ');
      const clave = (e.clave || []).slice(0, 3).map(x => `${jn(x)} <span style="color:#A6A6AD">${dec(x.ritmo)}</span>`).join(' · ');
      return `<div class="card" style="padding:16px 18px;border:1px solid ${e.nuestro ? RED : '#18181B'}">
        <div style="display:flex;align-items:center;gap:12px">${disc(crest(e.equipo), 36)}<div style="min-width:0;flex:1">
          <div style="font-weight:800;font-size:17px;color:${e.nuestro ? '#FF6B63' : '#F4F4F5'}">${esc(e.equipo)}${tag(e)}</div>
          <div style="font-size:12px;color:#A6A6AD">${esc(e.sinp ? 'Aún no ha jugado esta temporada' : (e.detalle || ''))}</div></div>
          <div style="text-align:right"><div style="${BS}font-weight:900;font-size:28px;line-height:1">${e.fuerza ? e.fuerza.puesto + 'º' : ''}</div><div style="font-size:11px;color:#A6A6AD">en fuerza</div></div></div>
        ${clave ? `<div style="font-size:13px;margin-top:10px"><span style="color:#A6A6AD;font-weight:700">Peligro:</span> ${clave}</div>` : ''}
        ${gk ? `<div style="font-size:13px;margin-top:4px"><span style="color:#A6A6AD;font-weight:700">Portería:</span> ${gk}</div>` : ''}
        <details${e.nuestro ? ' open' : ''} style="margin-top:10px"><summary style="cursor:pointer;font-weight:700;font-size:14px;color:#C9C9CE;padding:6px 0">Altas ${(e.altas || []).length} · Bajas ${(e.bajas || []).length}</summary>
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
          <span style="text-align:right;font-size:13px;color:#C9C9CE;white-space:nowrap">+${e.p.nuevos} nuevos</span></div>`; }).join('');
    const rk = L.rookies.slice().sort((a, b) => (b.nuestro - a.nuestro) || ((a.edad || 99) - (b.edad || 99)));
    const rook = rk.map((r, i) => box(hP(r.k), `background:#18181B;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;border:2px solid ${r.nuestro ? RED : '#18181B'};--brillo:${(i % 6) * 0.5}s`, `
          <div class="ini" style="aspect-ratio:4/5;background:#26262A;font-size:52px;color:#55555B">${esc(ini(r.nombre, r.apellidos))}${photo(r.foto)}
            <span style="position:absolute;left:8px;top:8px;font-size:11px;font-weight:700;letter-spacing:.1em;padding:3px 6px;border-radius:3px;background:${RED};color:#fff;font-family:'IBM Plex Sans Condensed',sans-serif">ROOKIE</span>
            <div style="position:absolute;right:8px;top:8px">${disc(crest(r.equipo), 36)}</div>
            <span style="position:absolute;left:10px;bottom:4px;${BS}font-weight:900;font-size:40px;line-height:1;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${esc(r.dorsal ?? '')}</span>
            <span style="position:absolute;right:10px;bottom:8px;${BS}font-weight:800;font-size:18px;line-height:1;white-space:nowrap;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${r.edad != null ? r.edad + ' años' : ''}</span>
          </div>
          <div style="padding:10px 12px;text-align:left"><div style="font-weight:700;font-size:15px;line-height:1.15">${esc(corto(r))}</div><div style="font-size:13px;color:#A6A6AD;margin-top:2px">${esc(abr(r.equipo))} · ${esc(r.cantera ? r.cantera.replace(/ en 20\d\d\/\d\d$/, '') : 'Primer año en la FMP')}</div></div>`, 'div', ' data-cromo')).join('');
    const titulo2 = (t, nota) => `<div style="display:flex;justify-content:space-between;align-items:baseline;margin:32px 0 10px;gap:8px;flex-wrap:wrap"><span class="lab">${t}</span>${nota ? `<span style="font-size:13px;color:#A6A6AD">${nota}</span>` : ''}</div>`;
    return `<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:28px">${tabs}</div>
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px;margin-top:24px">
        <div><div class="lab" style="color:#FF6B63">PRETEMPORADA ${esc(A.temporada)}</div><div style="${BS}font-weight:900;font-size:clamp(44px,6.5vw,80px);line-height:.9;margin-top:6px">${esc(L.nombre)}</div></div>
      </div>
      ${P.contexto && P.contexto.length ? `<div style="font-size:15px;line-height:1.5;color:#C9C9CE;margin-top:12px;max-width:860px">${P.contexto.map(esc).join(' ')}</div>` : ''}
      <div style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap">${kpis}</div>
      ${titulo2('FUERZA DE CADA PLANTILLA · PRONÓSTICO', 'Puntos (goles + asistencias) de sus jugadores la temporada pasada, ajustados al nivel')}
      <div class="card" style="padding:8px 12px">${fuerza}
        <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:#A6A6AD;padding:10px 8px 6px"><span><span style="color:#C9C9CE">■</span> ya han jugado este año</span><span><span style="color:#55555B">■</span> de su plantilla 2025/26 que aún no han jugado (cuentan la mitad)</span></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:12px;align-items:start">
        <div>${titulo2('JUGADORES MÁS PELIGROSOS', 'Puntos por partido en 2025/26 y 2024/25')}<div class="card" style="padding:6px 14px">${pel || '<div style="padding:12px 0;color:#A6A6AD">Sin datos todavía.</div>'}</div></div>
        <div>${titulo2('PORTEROS MÁS FIABLES', '% de paradas en 2025/26 y 2024/25')}<div class="card" style="padding:6px 14px">${gks || '<div style="padding:12px 0;color:#A6A6AD">Sin datos todavía.</div>'}</div></div>
      </div>
      ${titulo2('CÓMO LLEGAN LOS EQUIPOS', 'Debajo, su puesto en 2025/26')}
      <div class="card" style="padding:6px 20px">${escalera(L)}${mov}</div>
      ${titulo2('ALTAS Y BAJAS · EQUIPO POR EQUIPO', 'Primero los nuestros')}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr));gap:12px;align-items:start">${ab}</div>
      ${renov ? `${titulo2('RENOVACIÓN DE PLANTILLAS', 'Puntos de 2025/26 que siguen en el equipo · caras nuevas')}<div class="card" style="padding:8px 18px">${renov}</div>` : ''}
      ${rk.length ? `${titulo2('ROOKIES DE LA LIGA · ' + rk.length, rk.filter(r => r.menor || r.edad < 18).length + ' menores de 18 · primero los de MADRIDPATINA')}
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
        <div style="font-size:13px;font-weight:700;color:#A6A6AD;padding:16px 0 6px">Portería</div>
        ${por.map(x => box(hP(x.k), 'display:block;width:100%;padding:8px 0', `
          <div style="display:flex;justify-content:space-between;gap:8px"><span style="font-weight:600"><span style="color:#A6A6AD">#${esc(x.dorsal)}</span> ${esc(corto(x))}</span><span style="${BS}font-weight:800;font-size:22px">${x.pct != null ? dec(x.pct) + '%' : '—'}</span></div>
          <div style="height:8px;border-radius:3px;background:#26262A;overflow:hidden;margin-top:6px"><div style="height:100%;width:${(x.pct || 0)}%;background:${RED}"></div></div>
          <div style="font-size:13px;color:#A6A6AD;margin-top:4px">${x.par} paradas de ${x.tiros} tiros</div>`)).join('')}
        ${staff && staff.length ? `<div style="font-size:13px;font-weight:700;color:#A6A6AD;padding:16px 0 6px">Cuerpo técnico</div><div style="font-size:15px;line-height:1.6">${staff.map(esc).join('<br>')}</div>` : ''}
      </div>`; };
    const PER = { P1: '1ª PARTE', P2: '2ª PARTE' };
    const TIPO = { gol: ['GOL', '#FF6B63'], falta: ['FALTA', '#F4F4F5'], tiempo_muerto: ['TIEMPO MUERTO', '#A6A6AD'], cambio_portero: ['CAMBIO DE PORTERO', '#A6A6AD'] };
    const evRow = e => { const eqn = e.lado === 'local' ? p.local : e.lado === 'visitante' ? p.visitante : ''; const T = TIPO[e.tipo] || [e.tipo, '#A6A6AD'];
      const txt = e.tipo === 'gol' ? quienTxt(e.jugador) + (e.asistencia ? ` <span style="color:#A6A6AD">· asist. ${quienTxt(e.asistencia)}</span>` : '')
        : e.tipo === 'falta' ? quienTxt(e.jugador) + ` <span style="color:#A6A6AD">· ${e.falta ? esc(e.falta) + ' · ' : ''}${fmin(e.minutos)}</span>`
        : e.tipo === 'cambio_portero' && e.jugador ? 'entra ' + quienTxt(e.jugador) : '';
      return `<div style="display:grid;grid-template-columns:50px 24px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px;border-radius:6px;background:${ours(eqn) ? '#2A1416' : 'transparent'}">
        <span style="${BS}font-weight:800;font-size:18px;color:#A6A6AD;font-variant-numeric:tabular-nums">${esc(e.minuto || '')}</span>${disc(crest(eqn), 22)}
        <div style="min-width:0;font-size:15px;line-height:1.35"><span style="font-size:12px;font-weight:700;letter-spacing:.08em;color:${T[1]}">${T[0]}</span> ${txt}</div>
        <span style="${BS}font-weight:800;font-size:22px">${e.tipo === 'gol' && e.marcador ? esc(e.marcador.replace('-', '–')) : ''}</span></div>`; };
    const eventos = [...new Set((p.ev || []).map(e => e.periodo))].map(g => lab(PER[g] || g, 'margin:16px 0 4px') + p.ev.filter(e => e.periodo === g).map(evRow).join('')).join('');
    const info = [p.pista ? ['Pista', p.pista] : null, p.arb && p.arb.length ? [p.arb.length > 1 ? 'Árbitros' : 'Árbitro', p.arb.join(' · ')] : null].filter(Boolean);
    const team = (name, href) => box(href, 'display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center', `
        <div class="disc" style="width:clamp(56px,8vw,96px);height:clamp(56px,8vw,96px);box-shadow:0 0 0 2px #FFFFFF;${crest(name) ? `background-image:url('${esc(crest(name))}')` : ''}"></div>
        <span style="${BS}font-weight:800;font-size:clamp(20px,3vw,32px);line-height:1;color:${ours(name) ? '#FF6B63' : '#F4F4F5'}"><span class="nm-largo">${esc(name)}</span><span class="nm-corto">${esc(abr(name))}</span></span>`);
    const hasTiros = p.tl != null && p.tv != null;
    // rodillo de tragaperras: columna 0…n que sube hasta el resultado (mismo alto de línea que el marcador, .85em)
    const rodillo = (n, dur) => n == null || n === '' ? esc(n ?? '') : `<span style="display:inline-block;height:.85em;overflow:hidden;vertical-align:top"><span data-anim="mpRoll ${dur} .2s cubic-bezier(.2,.9,.25,1.08)" style="display:block;--to:${(-n * 0.85).toFixed(3)}em">${Array.from({ length: +n + 1 }, (_, i) => `<span style="display:block;height:.85em;text-align:center">${i}</span>`).join('')}</span></span>`;
    return `<div style="margin-top:16px;background:#18181B;border-radius:14px;padding:clamp(20px,3vw,36px)">
        <div style="text-align:center;font-size:14px;font-weight:700;letter-spacing:.12em;color:#A6A6AD">${esc((p.ligaNombre + ' · Jornada ' + p.jornada + ' · ' + fd(p.fecha) + (p.hora ? ' · ' + p.hora : '')).toUpperCase())}</div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:clamp(12px,3vw,40px);align-items:center;margin-top:20px">
          ${team(p.local, hT(p.local))}
          <div style="${BS}font-weight:900;font-size:clamp(72px,12vw,150px);line-height:.85;font-variant-numeric:tabular-nums;white-space:nowrap" data-grupo>${rodillo(p.gl, '1.1s')}<span style="color:#55555B">–</span>${rodillo(p.gv, '1.3s')}</div>
          ${team(p.visitante, hT(p.visitante))}
        </div>
        ${p.nuestro && p.idp ? `<div style="display:flex;justify-content:center;margin-top:22px"><a class="dv-alin" href="#/directo/${encodeURIComponent(p.idp)}/resumen" title="El partido contado otra vez desde el acta: pista, alineaciones, goles, faltas, penaltis y resumen final">▶ Ver resumen</a></div>` : ''}
        ${hasTiros ? `<div style="max-width:640px;margin:28px auto 0">
          <div style="display:flex;justify-content:space-between;${BS}font-weight:800;font-size:28px;line-height:1"><span>${p.tl}</span><span class="lab" style="align-self:center">TIROS A PUERTA</span><span>${p.tv}</span></div>
          <div style="display:flex;gap:3px;height:10px;margin-top:8px" data-grupo data-espera="1300"><div data-anim="mpWipe .6s" style="flex:${p.tl};background:${ours(p.local) ? RED : '#6B6B70'};border-radius:3px;transform-origin:right"></div><div data-anim="mpWipe .6s" style="flex:${p.tv};background:${ours(p.visitante) ? RED : '#6B6B70'};border-radius:3px;transform-origin:left"></div></div>
        </div>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:12px" data-grupo data-espera="1700">${side(p.local, p.gol_l, p.por_l, p.alin_l, p.staff_l, 0)}${side(p.visitante, p.gol_v, p.por_v, p.alin_v, p.staff_v, 100)}</div>
      ${info.length || eventos ? `<div class="card" style="margin-top:12px;padding:18px 20px">
        ${info.length ? `<div style="display:flex;gap:12px 32px;flex-wrap:wrap">${info.map(([k, v]) => `<div><div style="font-size:13px;font-weight:700;color:#A6A6AD">${k}</div><div style="font-weight:600;font-size:16px">${esc(v)}</div></div>`).join('')}</div>` : ''}
        ${eventos ? `<div style="margin-top:${info.length ? 20 : 0}px">${lab('EVENTOS DEL PARTIDO')}<div style="font-size:13px;color:#A6A6AD;margin-top:4px">Minuto del acta: el reloj va hacia atrás (tiempo que queda de la parte).</div>${eventos}</div>` : ''}
      </div>` : ''}`;
  }

  /* ── 5. Jugadores ───────────────────────────────────────── */
  function vJugadores(fid) {
    const J = A.jugadores;
    const list = Object.values(J).filter(p => p.equipo && ours(p.equipo));
    const teams = A.equipos.filter(e => list.some(p => enEquipo(p, e)));
    const fe = teams.find(e => e.id === fid);
    const jf = fe ? fe.id : 'todos';
    const pts = p => { const t = p.temporadas['2025/26'] || {}, t7 = p.temporadas['2026/27'] || {}; return (t7.goles || 0) * 3 + (t7.asistencias || 0) * 3 + (t.goles || 0) + (t.asistencias || 0); };
    const filtros = [['todos', 'Todos', '#/jugadores']].concat(teams.map(e => [e.id, tituloOf(e), '#/jugadores/' + e.id]))
      .map(([k, l, h]) => `<a class="blk" href="${h}" style="padding:8px 16px;border-radius:999px;background:${jf === k ? RED : '#18181B'};color:${jf === k ? '#FFFFFF' : '#C9C9CE'};font-weight:700;font-size:15px">${l}</a>`).join('');
    const jugList = list.filter(p => !fe || enEquipo(p, fe)).sort((a, b) => a.equipo === b.equipo ? pts(b) - pts(a) : (a.equipo < b.equipo ? -1 : 1)).map(p => {
      const stat = rolDe(p);
      return box(hP(p.k), 'background:#18181B;border-radius:10px;overflow:hidden;display:flex;flex-direction:column', `
        <div class="ini" style="aspect-ratio:4/5;background:#26262A;font-size:48px;color:#55555B">${esc(ini(p.nombre, p.apellidos))}${photo(p.foto)}
          <span class="dors" style="position:absolute;left:8px;bottom:6px;${BS}font-weight:900;font-size:40px;line-height:1;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${esc(p.dorsal || '')}</span>
          <span class="chapa" style="position:absolute;right:8px;top:8px;font-size:12px;font-weight:700;padding:3px 7px;border-radius:4px;background:${RED};color:#fff;font-family:'IBM Plex Sans Condensed',sans-serif">${esc('MP ' + (equiposDe(p).map(letraOf).join('·') || p.equipo.replace('MADRIDPATINA', '').trim()))}</span>
        </div>
        <div class="pie-cromo" style="padding:10px 12px"><div style="font-weight:700;font-size:15px;line-height:1.15">${esc(corto(p))}</div><div style="font-size:13px;color:#A6A6AD;margin-top:2px">${stat}</div></div>`);
    }).join('');
    const seen = {};
    const rook = [].concat(...A.ligas.map(l => l.rookies)).filter(r => r.nuestro && !seen[r.k] && (seen[r.k] = 1)).filter(r => !fe || r.equipo === fe.nombre);
    const rookHtml = rook.map((r, i) => box(hP(r.k), `flex:none;width:150px;background:#121214;border-radius:10px;overflow:hidden;--brillo:${(i % 6) * 0.5}s`, `
        <div class="ini" style="height:150px;background:#26262A;font-size:40px;color:#55555B">${esc(ini(r.nombre, r.apellidos))}${photo(r.foto || (J[r.k] && J[r.k].foto))}
          <span style="position:absolute;left:8px;top:8px;font-size:11px;font-weight:700;letter-spacing:.1em;padding:3px 6px;border-radius:3px;background:${RED};color:#fff;font-family:'IBM Plex Sans Condensed',sans-serif">ROOKIE</span>
          <span style="position:absolute;right:8px;bottom:4px;${BS}font-weight:900;font-size:34px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${esc(r.dorsal ?? '')}</span></div>
        <div style="padding:8px 10px"><div style="font-weight:700;font-size:14px;line-height:1.15">${esc(corto(r))}</div><div style="font-size:12px;color:#A6A6AD">${esc(abr(r.equipo) === 'MP' ? 'MADRIDPATINA' : abr(r.equipo))}${r.edad != null ? ' · ' + r.edad + ' años' : ''}</div></div>`, 'div', ' data-cromo')).join('');
    return `<div style="${BS}font-weight:900;font-size:clamp(48px,7vw,84px);line-height:.9;padding-top:32px">PLANTILLAS</div>
      ${rook.length ? `<div class="card" style="margin-top:20px;padding:16px 18px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#FF6B63">ROOKIES 2026/27 · ${rook.length}</span><span style="font-size:13px;color:#A6A6AD">Nuevos en el equipo esta temporada</span></div>
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
    const ex = H.jugadores.filter(j => !cur.has(j.tok) && j.temporadas.some(t => !cant(t)) && j.adulto !== false)
      .map(j => { const ult = j.temporadas.map(t => t.temporada).sort().pop();
        return Object.assign({}, j, { ult, eqs: [...new Set(j.temporadas.filter(t => t.temporada === ult).map(t => t.equipo.replace('MADRIDPATINA', 'MP')))] }); })
      .sort((a, b) => (a.ult < b.ult ? 1 : a.ult > b.ult ? -1 : b.carrera.pj - a.carrera.pj));
    if (!ex.length) return '';
    const otro = ex.filter(j => j.ahora && j.ahora.length), fuera = ex.filter(j => !(j.ahora && j.ahora.length));
    const fila = (j, dcha) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #26262A">
        <div style="min-width:0"><div style="font-weight:700">${esc(j.nombre)}</div><div style="font-size:13px;color:#A6A6AD">${esc(j.eqs.join(', '))} hasta ${esc(j.ult)} · ${j.carrera.pj} PJ · ${j.carrera.g} G ${j.carrera.a} A</div></div>${dcha}</div>`;
    const ahora = j => `<div style="display:flex;align-items:center;gap:8px">${disc(crest(j.ahora[0].equipo), 28)}<div style="text-align:right"><div style="font-weight:700;font-size:14px">${esc(j.ahora.map(a => a.equipo).join(', '))}</div><div style="font-size:12px;color:#A6A6AD">${esc(titulo(j.ahora[0].liga))}</div></div></div>`;
    const recientes = fuera.filter(j => j.ult >= '2023/24'), antes = fuera.filter(j => j.ult < '2023/24');
    return `${lab('EXJUGADORES · ' + ex.length, 'margin:36px 0 4px')}
      <div style="font-size:14px;color:#A6A6AD;margin-bottom:12px">Jugaron con MADRIDPATINA y esta temporada no están en nuestras plantillas.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;align-items:start">
        <div class="card" style="padding:16px 20px"><div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#FF6B63">AHORA EN OTRO EQUIPO · ${otro.length}</div>
          ${otro.map(j => fila(j, ahora(j))).join('') || '<div style="padding:10px 0;color:#A6A6AD">Nadie por ahora.</div>'}</div>
        <div class="card" style="padding:16px 20px"><div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#A6A6AD">SIN PARTIDOS EN ${esc(A.temporada)} · ${fuera.length}</div>
          ${recientes.map(j => fila(j, '')).join('')}
          ${antes.length ? `<details style="margin-top:6px"><summary style="cursor:pointer;color:#C9C9CE;font-weight:600;padding:10px 0">Ver ${antes.length} de temporadas anteriores</summary>${antes.map(j => fila(j, '')).join('')}</details>` : ''}</div>
      </div>`;
  }

  /* ── 6. Ficha de jugador ────────────────────────────────── */
  function vJugador(k) {
    let p = A.jugadores[k] || Object.values(A.jugadores)[0];
    const hj = H && H.byTok[H.tok(p.nombre + ' ' + p.apellidos)];
    const TS = Object.assign({}, p.temporadas);
    if (hj) { const agg = {}; hj.temporadas.forEach(t => { const a = agg[t.temporada] || (agg[t.temporada] = { pj: 0, goles: 0, asistencias: 0, pim: 0, eqs: [] }); a.pj += t.pj; a.goles += t.g; a.asistencias += t.a; a.pim += t.pim || 0; const l = t.equipo.replace('MADRIDPATINA', 'MP'); if (!a.eqs.includes(l)) a.eqs.push(l); }); Object.keys(agg).forEach(t => { TS[t] = agg[t]; }); }
    p = Object.assign({}, p, { temporadas: TS });
    const order = Object.keys(TS).sort().filter(t => TS[t] && (TS[t].pj || t === A.temporada));
    const max = Math.max(1, ...order.map(t => Math.max(TS[t].goles || 0, TS[t].asistencias || 0)));
    const car = hj ? hj.carrera : null;
    const t = equiposDe(p)[0] || teamOf(p.equipo);
    const tags = [rolDe(p).toUpperCase(), p.edad ? p.edad + ' AÑOS' : null, p.rookie ? 'DEBUTANTE' : null].filter(Boolean);
    const tile = (k2, v, ink = '') => `<div style="padding:12px 16px;background:#121214;border-radius:8px"><div style="font-size:13px;color:#A6A6AD;font-weight:600">${k2}</div><div style="${BS}font-weight:900;font-size:48px;line-height:1;${ink}">${v}</div></div>`;
    const temps = order.map((kk, ti) => { const s = p.temporadas[kk]; const g = s.goles || 0, a = s.asistencias || 0;
      return `<div style="display:grid;grid-template-columns:72px minmax(0,1fr) 120px;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid #26262A">
        <div><div style="${BS}font-weight:800;font-size:22px;line-height:1">${kk}</div><div style="font-size:13px;color:#A6A6AD">${s.pj} PJ${s.parcial ? ' · en curso' : (s.eqs ? ' · ' + esc(s.eqs.join(', ')) : '')}${s.pim ? ' · ' + fmin(s.pim) + ' de sanción' : ''}</div></div>
        <div style="display:flex;flex-direction:column;gap:4px"><div data-anim="mpWipe .6s cubic-bezier(.2,.8,.2,1) ${ti * 150}ms" style="height:12px;border-radius:2px;background:${RED};width:${Math.max(2, g / max * 100)}%;transform-origin:left"></div><div data-anim="mpWipe .6s cubic-bezier(.2,.8,.2,1) ${ti * 150 + 80}ms" style="height:12px;border-radius:2px;background:#8A8A8F;width:${Math.max(2, a / max * 100)}%;transform-origin:left"></div></div>
        <div style="display:flex;gap:12px;justify-content:flex-end;${BS}font-weight:800;font-size:28px;line-height:1"><span style="color:#FF6B63">${g}<span style="font-size:14px"> G</span></span><span>${a}<span style="font-size:14px"> A</span></span></div></div>`; }).join('');
    const partidos = p.partidos.map(x => box(hM(x.mid), 'background:#18181B;border-radius:10px;padding:14px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:12px', `
        ${disc(crest(x.rival), 48)}<div style="flex:1;min-width:0"><div style="font-size:13px;color:#A6A6AD">vs</div><span style="${BS}font-weight:800;font-size:22px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(abr(x.rival))}</span></div>
        <div style="${BS}font-weight:800;font-size:24px;text-align:right">${x.pct != null ? dec(x.pct) + '%' : x.g + 'G ' + x.a + 'A'}</div>${x.pim ? `<div style="flex-basis:100%;margin-top:-6px;padding-left:60px;font-size:13px;font-weight:600;color:#A6A6AD">${fmin(x.pim)} de sanción</div>` : ''}`)).join('');
    return `<div style="margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;align-items:stretch">
        <div class="ini ficha-foto" data-grupo style="background:linear-gradient(160deg,#D3202A 0%,#8E1219 100%);border-radius:14px;overflow:hidden;align-self:start;aspect-ratio:4/5;font-size:120px;color:#A9161E">
          <span data-anim="mpReveal .01s .45s">${esc(ini(p.nombre, p.apellidos))}</span>${photo(p.foto, 'none', '50% 15%', '', ' data-anim="mpReveal .01s .45s"')}
          <div data-anim="mpRedWipe .9s cubic-bezier(.7,0,.3,1)" style="position:absolute;inset:0;background:#D3202A;z-index:2"></div>
          <span data-anim="mpScale .5s .7s cubic-bezier(.2,.8,.2,1)" style="position:absolute;left:18px;bottom:8px;z-index:3;font-size:150px;line-height:.85;color:#fff;text-shadow:0 4px 18px rgba(0,0,0,.5);transform-origin:left bottom">${esc(p.dorsal || '')}</span>
        </div>
        <div style="grid-column:span 2;min-width:0;background:#18181B;border-radius:14px;padding:clamp(20px,3vw,32px);display:flex;flex-direction:column;gap:20px" class="fj">
          <div data-anim="mpUp .4s cubic-bezier(.2,.8,.2,1) .5s">
            ${t ? `<a href="${hEq(t.id)}" style="font-size:14px;font-weight:700;letter-spacing:.12em">${esc((p.equipo || '').toUpperCase() + ' · ' + t.liga.toUpperCase())}</a>` : `<div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#FF6B63">${esc((p.equipo || '').toUpperCase())}</div>`}
            <div style="${BS}font-weight:900;font-size:clamp(44px,6vw,76px);line-height:.9;margin-top:6px">${esc(p.nombre.toUpperCase())}</div>
            <div style="${BS}font-weight:700;font-size:clamp(24px,3vw,36px);line-height:1;color:#A6A6AD">${esc(p.apellidos.toUpperCase())}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">${tags.map(tg => `<span style="font-size:13px;font-weight:700;letter-spacing:.06em;padding:4px 10px;border-radius:4px;background:#26262A">${tg}</span>`).join('')}</div>
          </div>
          ${car ? `<div data-anim="mpUp .4s cubic-bezier(.2,.8,.2,1) .6s" style="display:flex;gap:10px;flex-wrap:wrap">${tile('Goles en el club', car.g, 'color:#FF6B63')}${tile('Asistencias', car.a)}${tile('Partidos', car.pj)}${tile('Temporadas', car.temporadas)}${tile('Sanción', fmin((car.pim || 0) + ((p.temporadas[A.temporada] || {}).pim || 0)))}</div>` : ''}
          <div data-grupo data-espera="900">${lab('POR TEMPORADA', 'margin-bottom:12px')}${temps}</div>
        </div>
      </div>
      ${p.partidos.length ? `${lab('PARTIDOS 2026/27', 'margin:28px 0 10px')}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">${partidos}</div>` : ''}`;
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
            steps: cs.sort((a, b) => a.temporada < b.temporada ? -1 : 1).map(c => ({ t: c.temporada.replace('20', ''), p: c.puesto + 'º', c: (c.liga || '').replace(/^(LIGA|TORNEO)\s+/i, '').replace(/PRIMAVERA /i, 'Prim. ').replace(/GRUPO /i, 'gr. ').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()), bg: c.actual ? '#2A1416' : '#121214' })) }; }),
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
        <div style="${BS}font-weight:900;font-size:clamp(48px,7vw,84px);line-height:.9">LEGADO</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
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

  // Logros del legado: títulos y podios de los equipos, e hitos de los jugadores (hasta la temporada pasada)
  function logros(lbl) {
    const liga = l => titulo((l || '').replace(/^(LIGA|TORNEO)\s+/i, ''));
    const curK = {}; Object.values(A.jugadores).forEach(x => { curK[H.tok(x.nombre + ' ' + x.apellidos)] = x.k; });
    // solo grupos que deciden el título: fuera los de permanencia/descenso y los grupos bajos de una fase final
    const decide = c => { const g = (c.grupo || '') + ' ' + (c.liga || '');
      return !/DESCENSO|PERMANENCIA/i.test(g) && !/split_(mid|bottom)/.test(c.fase || '')
        && !(/FASE FINAL|FASE 2/i.test(g) && /(GRUPO|GR)\s*([2-9]|[B-Z])\b|\([2-9]\)/i.test(g)); };
    const podio = H.clasificaciones.filter(c => c.puesto && c.puesto <= 3 && decide(c))
      .sort((a, b) => a.puesto - b.puesto || (a.temporada < b.temporada ? 1 : -1));
    const hitos = [
      ['100', 'GOLES CON EL CLUB', j => j.carrera.g >= 100, j => j.carrera.g, ' G'],
      ['100', 'PARTIDOS CON EL CLUB', j => j.carrera.pj >= 100, j => j.carrera.pj, ' PJ'],
      ['50', 'ASISTENCIAS CON EL CLUB', j => j.carrera.a >= 50, j => j.carrera.a, ' A'],
      ['3', 'GOLES EN UN PARTIDO · HAT-TRICKS', j => j.carrera.hattricks > 0, j => j.carrera.hattricks, ''],
      ['7', 'TEMPORADAS O MÁS EN EL CLUB', j => j.carrera.temporadas >= 7, j => j.carrera.temporadas, ' temp.'],
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
  const TOP = { directo: 'jornada', jornada: 'jornada', equipo: 'equipos', liga: 'ligas', partido: 'ligas', jugadores: 'jugadores', jugador: 'jugadores', historico: 'legado', legado: 'legado', pretemporada: 'pretemporada' };
  const TITLES = { directo: 'En directo', jornada: 'Jornada', equipo: 'Equipos', liga: 'Ligas', partido: 'Partido', jugadores: 'Jugadores', jugador: 'Jugador', historico: 'Legado', legado: 'Legado', pretemporada: 'Pretemporada' };
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
    const nav = [['pretemporada', 'Pretemporada', hPre('club')], ['jornada', 'Jornada', '#/jornada'], ['equipos', 'Equipos', hEq(S.eq || A.equipos[0].id)], ['ligas', 'Ligas', hLg(S.lg || A.ligas[0].id)], ['jugadores', 'Jugadores', '#/jugadores'], ['legado', 'Legado', '#/legado']];
    $('#nav').innerHTML = '<span class="pildora" aria-hidden="true"></span>' + nav.map(([k, l, h]) => `<a href="${h}" data-nav${TOP[v] === k ? ' aria-current="page"' : ''}>${l}</a>`).join('');
    // móvil: la misma navegación, abajo y con iconos (al alcance del pulgar)
    $('#tabbar').innerHTML = nav.map(([k, l, h]) => `<a href="${h}" data-nav${TOP[v] === k ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONO[k]}</svg><span>${l}</span></a>`).join('');
    pildora(true);
    if (secAntes && secAntes !== TOP[v]) { const ic = $('#tabbar a[aria-current] svg'); if (ic) ic.style.animation = 'mpBounce .45s both'; }
    secAntes = TOP[v];
    let html;
    if (v === 'equipo') html = vEquipo(parts[1]);
    else if (v === 'liga') html = vLiga(parts[1], parts[2] === 'llega' ? 'llega' : null, parts[2] === 'j' ? parseInt(parts[3], 10) : null);
    else if (v === 'partido') html = vPartido(parts[1]);
    else if (v === 'jugadores') html = vJugadores(parts[1]);
    else if (v === 'jugador') html = vJugador(parts[1]);
    else if (v === 'historico' || v === 'legado') html = vHistorico();
    else if (v === 'pretemporada') html = vPretemporada(parts[1]);
    else if (v === 'directo') html = vDirecto(parts[1], parts[2]);
    else html = vJornada(parts[1]);
    const back = S.hist.length && v !== 'jornada' ? '<a class="back" href="#" data-back>← Volver</a>' : '';
    const pie = `<footer class="pie"><span>MADRIDPATINA · Temporada ${esc(A.temporada)}</span><span>Datos: Federación Madrileña de Patinaje · actualizado ${fdc(A.actualizado).toLowerCase()}</span></footer>`;
    view.innerHTML = back + html + pie;
    // el contenido que no trae su propia animación entra con fundido + subida, en cascada de 60 ms
    let k = 0;
    [...view.children].forEach(ch => {
      if (ch.tagName === 'FOOTER' || ch.matches('[data-anim],[data-ola]') || ch.querySelector('[data-anim],[data-ola]')) return;
      ch.dataset.anim = 'mpUp .4s cubic-bezier(.2,.8,.2,1)'; ch.dataset.espera = Math.min(k++, 8) * 60;
    });
    ola(view);
    rodillos(view);
    billetes(view);
    // con la intro delante, la web se anima al cerrarla
    if (introEl) animarAlCerrar = true; else animar(view);
    document.title = 'MADRIDPATINA · ' + TITLES[v];
    save({ route: location.hash, eq: S.eq, lg: S.lg, hist: S.hist.slice(-10) });
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-nav]')) navReset = true;
    const b = e.target.closest('[data-back]');
    if (b) { e.preventDefault(); const prev = S.hist.pop(); goingBack = true; location.hash = prev || '#/jornada'; }
  });
  window.addEventListener('hashchange', () => {
    if (navReset) S.hist = [];
    else if (!goingBack && prevRoute && prevRoute !== location.hash) S.hist = S.hist.concat([prevRoute]).slice(-10);
    navReset = goingBack = false; prevRoute = location.hash;
    window.scrollTo(0, 0); render();
  });

  /* ── Intro «Focos» (handoff_animaciones §1) ─────────────────────────────────────────────────
     Todos los partidos nuestros pendientes desde el primero que queda hasta el domingo de esa semana, con su cuenta
     atrás (días · horas · min, cada minuto). Una vez por sesión; se cierra con ✕, ENTRAR, Esc o deslizando hacia
     arriba, y el escudo de la cabecera la vuelve a abrir. No está en el menú. */
  const INTRO = 'mp-intro-visto';
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
  document.querySelector('.brand img').addEventListener('click', () => abrirIntro());

  document.addEventListener('animationend', e => {
    if (e.animationName !== 'mpReel') return;
    const card = e.target.closest('[data-rodillo]');
    if (!card || card.classList.contains('parado')) return;
    card.classList.add('parado');
    const n = card.querySelector('[data-cuenta]');
    if (!n) return;
    const fin = +n.dataset.cuenta, t = n.dataset.fmt;
    const fmt = t === 'pct' ? v => (v === fin ? dec(fin) : dec(v.toFixed(1))) : t === 'min' ? v => fmin(v === fin ? fin : Math.round(v * 2) / 2) : v => String(Math.round(v));
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
    RJ: 'Retraso en el juego', SR: 'Stick roto', PP: 'Penalización de partido', EX: 'Exclusión' };
  const motivoFalta = e => (e.falta_tipo && FALTA_TXT[e.falta_tipo] ? FALTA_TXT[e.falta_tipo] + ' (' + e.falta_tipo + ')' : 'Exclusión');
  const minFuera = m => (m % 1 ? fmin(m) : m + ' min');
  const segs = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const ordinal = p => (p ? p + 'ª' : '');
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
  // gol en superioridad (el rival con una exclusión en curso) o a portería vacía (el que encaja había sacado al portero)
  function situacionGol(g, evs, dur) {
    if (!dur || g.t == null) return '';
    const tg = segs(g.t), antes = c => c.periodo < g.periodo || (c.periodo === g.periodo && segs(c.t) <= tg);
    const cambios = evs.filter(c => c.tipo === 'CAMBIO DE PORTERO' && c.lado !== g.lado && c.t != null && antes(c));
    if (cambios.length && cambios[cambios.length - 1].nota === 'Portero fuera') return 'Portería vacía';
    const pp = evs.some(f => f.tipo === 'FALTA' && f.lado !== g.lado && f.periodo === g.periodo && f.t != null && tg >= segs(f.t) && tg < segs(f.t) + (f.min_sancion || 2) * 60);
    return pp ? 'En superioridad' : '';
  }
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
    let tit, sub;
    if (e.tipo === 'GOL') {
      tit = quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador);
      sub = [e.asist_dorsal || e.asist_jugador ? 'Asist. ' + quienD(ctx, l, e.asist_dorsal, e.asist_corto, e.asist_jugador) : 'Sin asistencia', situacionGol(e, ctx.sn.eventos, ctx.dur)].filter(Boolean).join(' · ');
    } else if (e.tipo === 'FALTA') {
      tit = quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador); t[0] = fmin(e.min_sancion || 2);
      sub = motivoFalta(e) + ' · ' + minFuera(e.min_sancion || 2) + ' fuera';
    } else if (e.tipo === 'TIEMPO MUERTO') { tit = 'Tiempo muerto'; sub = nom; }
    else if (e.tipo === 'CAMBIO DE PORTERO') {
      if (e.nota === 'Portero fuera') { tit = 'Portero fuera' + (e.dorsal ? ' · ' + quienD(ctx, l, e.dorsal, e.sale_corto || e.jugador_corto, e.sale) : ''); sub = nom + ' · juega con 5 de pista'; }
      else { tit = 'Entra ' + quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador); sub = [e.sale ? 'Sale ' + (e.sale_corto || e.sale) : '', nom].filter(Boolean).join(' · '); }
    } else { tit = e.tipo.charAt(0) + e.tipo.slice(1).toLowerCase(); sub = nom; }
    const c = crest(nom), bg = (A.crests[nom] && A.crests[nom].bg) || 'transparent';
    return `<div class="dv-fila${e.tipo === 'GOL' && ctx.mp[l] ? ' mp' : ''}" style="${animDe(e.id, 'mpUp .45s cubic-bezier(.2,.8,.2,1) both')}">
      <span class="t">${esc(ordinal(e.periodo) + (e.t ? ' ' + e.t : ''))}</span><span class="tag" style="background:${t[1]};color:${t[2]}">${esc(t[0])}</span>
      <div style="min-width:0"><div class="tit">${esc(tit)}</div><div class="sub">${esc(sub)}</div></div>
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
  /* ── 9c · Exclusiones en curso y situación en pista ──────────────────────────────────────────
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

  /* ── 9h · En juego: tiros, paradas, minutos de exclusión y goles en superioridad (goles/ocasiones) ── */
  function datosJuego(ctx) {
    const { sn } = ctx, filas = [];
    const sumP = (l, f) => sn.porteros.filter(p => p.lado === l).reduce((a, p) => a + f(p), 0);
    if (sn.tiros) {
      filas.push(['TIROS A PUERTA', sn.tiros.l, sn.tiros.v, sn.tiros.l, sn.tiros.v]);
      const pl = sumP('L', p => (p.tiros || 0) - (p.gc || 0)), pv = sumP('V', p => (p.tiros || 0) - (p.gc || 0));
      filas.push(['PARADAS', pl, pv, pl, pv]);
    }
    const ex = l => sn.eventos.filter(e => e.tipo === 'FALTA' && e.lado === l).reduce((a, e) => a + (e.min_sancion || 2), 0);
    filas.push(['MIN. EXCLUSIÓN', fmin(ex('L')), fmin(ex('V')), ex('L'), ex('V')]);
    if (ctx.dur) {
      const ppG = l => sn.eventos.filter(e => e.tipo === 'GOL' && e.lado === l && situacionGol(e, sn.eventos, ctx.dur) === 'En superioridad').length;
      const ppO = l => sn.eventos.filter(e => e.tipo === 'FALTA' && e.lado !== l).length;
      filas.push(['GOLES EN SUPERIORIDAD', ppG('L') + '/' + ppO('L'), ppG('V') + '/' + ppO('V'), ppG('L'), ppG('V')]);
    }
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
  const ordenPl = pl => pl.slice().sort((a, b) => ((b.rol === 'P') - (a.rol === 'P')) || ((+a.dorsal || 99) - (+b.dorsal || 99)));
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
    const nos = ctx.mp.L ? 'L' : ctx.mp.V ? 'V' : null, riv = nos === 'L' ? 'V' : 'L';
    if (!nos || !P[nos] || !P[nos].length) return false;
    const mps = ordenPl(P[nos]).map(j => { const p = jugadorDe(ctx, nos, j.id_player, j.dorsal); return { j, foto: (p && p.foto) || '', ini: p ? ini(p.nombre, p.apellidos) : iniDe(j.jugador_corto || j.jugador) }; });
    const rivs = P[riv] ? ordenPl(P[riv]) : [];
    const estr = innerWidth < 640 || innerWidth / Math.max(1, innerHeight) < .8;
    const liga = ((sn.liga || '') + (sn.jornada ? ' · J' + sn.jornada : '')).toUpperCase();
    const escB = (l, cls) => { const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent'; return `<i class="${cls}" style="box-shadow:0 0 0 3px ${ctx.mp[l] ? RED : '#FFFFFF'};background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}"></i>`; };
    const el = document.createElement('div');
    el.className = 'escena esc-pres' + (estr ? ' estr' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Alineación de ' + ctx.nombre[nos]);
    el.innerHTML = `<div class="foco a"></div><div class="foco b"></div><div class="ep-stage"></div>
      <div class="esc-top"><div class="l">PRESENTACIÓN · ${esc(liga)}</div><div class="r">${sn.pista ? `<div class="pista"><i></i><span>PISTA</span><b>${esc(pistaBonita(sn.pista))}</b></div>` : ''}<button type="button" class="esc-saltar" data-esc-cierra>Saltar ›</button></div></div>`;
    document.body.appendChild(el);
    document.documentElement.style.overflow = 'hidden';
    const stage = el.querySelector('.ep-stage'), timers = [], luego = (ms, f) => timers.push(setTimeout(f, ms));
    const cuando = [fechaLarga(sn), sn.hora].filter(Boolean).join(' · ');
    // 1 · título
    stage.innerHTML = `<div class="pr-tit">${escB(nos, 'e0')}<div class="k">ALINEACIÓN</div><div class="n">${esc(ctx.nombre[nos])}</div><div class="bar"></div><div class="s">${esc([liga, cuando].filter(Boolean).join(' · '))}</div></div>`;
    // 2 · nuestros, uno a uno
    let t = 1600;
    luego(t, () => {
      stage.innerHTML = `<div class="pr-mp"><div class="pr-hero"></div><div class="pr-rej">${mps.map(x => `<div>${x.foto ? `<div class="f" style="background-image:url('${esc(x.foto)}')"></div>` : `<div class="i">${esc(x.ini)}</div>`}<div class="d">${esc(x.j.dorsal)}</div></div>`).join('')}</div></div>`;
    });
    mps.forEach((x, k) => luego(t + k * 1250, () => {
      const hero = stage.querySelector('.pr-hero'), celdas = [...stage.querySelectorAll('.pr-rej > div')];
      if (!hero) return;
      const r = ROL_TXT[x.j.rol] || ['JUGADOR', '#26262A', '#F4F4F5'];
      hero.innerHTML = `<div class="pr-big"><span>${esc(x.j.dorsal)}</span></div>
        <div class="pr-foto">${x.foto ? `<div class="f" style="background-image:url('${esc(x.foto)}')"></div>` : `<div class="i">${esc(x.ini)}</div>`}<div class="d">${esc(x.j.dorsal)}</div></div>
        <div class="pr-nom"><div class="rol" style="background:${r[1]};color:${r[2]}">${r[0]}</div><div class="nm">${esc(x.j.nombre || '')}</div><div class="ap">${esc((x.j.apellido || x.j.jugador_corto || '').toUpperCase())}</div>
          <div class="cnt">${p2(k + 1)} / ${p2(mps.length)}</div></div>`;
      celdas.forEach((cl, q) => { cl.classList.toggle('on', q <= k); cl.classList.toggle('cur', q === k); });
    }));
    t += mps.length * 1250;
    // 3 · rival en lista
    if (rivs.length) {
      luego(t, () => {
        const pos = j => (j.rol === 'P' ? 'POR' : j.rol === 'C' ? 'CAP' : j.rol === 'A' ? 'ASIS' : '');
        stage.innerHTML = `<div class="pr-riv"><div class="cab">${escB(riv, 'e1')}<div class="k">RIVAL</div><div class="n">${esc(ctx.nombre[riv])}</div></div>
          <div class="lista">${rivs.map((j, q) => `<div class="j" style="animation-delay:${(0.35 + q * 0.09).toFixed(2)}s"><b>${esc(j.dorsal)}</b><span>${esc(quienD(ctx, riv, j.dorsal, j.jugador_corto, j.jugador).replace(/^#\d+\s+/, ''))}</span><em>${pos(j)}</em></div>`).join('')}</div></div>`;
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
  function escenaPista(sn) {
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
      el.className = 'escena esc-pista'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'La pista: ' + key);
      el.innerHTML = `<div class="ep-mapa"></div><div class="ep-vig"></div><div class="ep-cam"><i></i><i></i><i></i><i></i></div>
        <div class="ep-hud"><span>${esc(cuando)}</span><b data-coord></b></div><button type="button" class="esc-saltar" data-esc-cierra>Saltar ›</button>
        <div class="ep-card"><div class="ep-k">PISTA</div><div class="ep-n">${key.split(' ').map((w, i) => `<span style="animation-delay:${(0.12 + i * 0.07).toFixed(2)}s">${esc(w)}</span>`).join(' ')}</div><div class="ep-s">${esc(lugarPista(v.display))}</div><div class="ep-bar"></div></div>`;
      document.body.appendChild(el);
      document.documentElement.style.overflow = 'hidden';
      const map = L.map(el.querySelector('.ep-mapa'), { zoomControl: false, attributionControl: true, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, zoomSnap: 0 });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
      const fmtC = ll => Math.abs(ll.lat).toFixed(4) + ' N · ' + Math.abs(ll.lng).toFixed(4) + ' O', coord = el.querySelector('[data-coord]');
      map.on('move', () => { coord.textContent = fmtC(map.getCenter()); });
      const target = [v.lat, v.lon], timers = [], luego = (ms, f) => timers.push(setTimeout(f, MOV ? ms : 0));
      map.setView(MOV ? [40.50, -3.72] : target, MOV ? (innerWidth < 600 ? 7.6 : 8.6) : 16, { animate: false });
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
      luego(1900, () => { const m = el.querySelector('[data-mlbl]'); if (m) m.style.opacity = 0; if (MOV) map.flyTo(target, 16, { duration: 3.8, easeLinearity: 0.2 }); });
      luego(5800, () => {   // pin con onda, el pin queda por encima de la tarjeta y el nombre entra
        L.marker(target, { interactive: false, icon: L.divIcon({ className: '', html: '<div class="ep-pin"><em></em><em></em><span></span></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(map);
        map.panBy([0, Math.round(innerHeight * 0.16)], { animate: MOV, duration: .6 });
        el.querySelector('.ep-cam').style.opacity = 0; el.querySelector('.ep-card').classList.add('on');
      });
      timers.push(setTimeout(cerrar, MOV ? 9800 : 3000));
      return true;
    }).catch(() => { ESC.cargando = false; return false; });
  }
  // en la previa, o la primera vez que se abre el partido en esta sesión
  function pistaSiToca(sn) {
    if (!sn || !sn.pista) return;
    const k = 'mp-pista-' + sn.idp;
    let visto = false;
    try { visto = sessionStorage.getItem(k) === '1'; } catch (e) { /* sin almacenamiento */ }
    if (visto && sn.estado !== 'previa') return;
    try { sessionStorage.setItem(k, '1'); } catch (e) { /* sin almacenamiento */ }
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
    setTimeout(() => { DV.listo = true; const c2 = ctxDirecto(snapDV() || sn); pintarSituacion(c2); pistaSiToca(c2.sn); presentarSiToca(c2); }, 0);
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
        <div class="dv-lista"><div class="dv-lcab"><span>MINUTO A MINUTO</span><span data-dv="lcab">${cabLista(sn).replace(/^<span[^>]*>|<\/span>$/g, '')}</span></div>
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
    : e.tipo === 'TANDA' ? e.nuevos.length * T_TIRO + (e.ganador ? T_GANA : 500) : DUR_CORTA);
  const iniDe = n => (n || '').replace(/\./g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  function escenaGolHtml(ctx, e) {
    const l = e.lado, estr = innerWidth < 640 || innerWidth / Math.max(1, innerHeight) < .8 ? ' estr' : '';
    const parte = ordinal(e.periodo) + (e.t ? ' · ' + e.t : ''), marc = e.marcador ? ctx.abr.L + ' ' + e.marcador.replace('-', '–') + ' ' + ctx.abr.V : '';
    const quien = quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador), hayA = !!(e.asist_dorsal || e.asist_jugador);
    const asWho = hayA ? quienD(ctx, l, e.asist_dorsal, e.asist_corto, e.asist_jugador) : '';
    if (!ctx.mp[l]) {
      const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent';
      const sub = [hayA ? 'Asist. ' + asWho : 'Sin asistencia', parte, marc].filter(Boolean).join(' · ');
      return `<div class="esc-gol riv${estr}" role="status" aria-label="Gol de ${esc(ctx.abr[l])}"><div class="eg-cortina"><div class="eg-esc" style="background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}"></div>
        <div class="eg-tx"><div class="eg-gol">GOL</div><div class="eg-quien">${esc(quien)}</div><div class="eg-sub">${esc(sub)}</div></div></div></div>`;
    }
    const foto = (p, nombre) => (p && p.foto ? `<div class="f" style="background-image:url('${esc(p.foto)}')"></div>` : `<div class="i">${esc(p ? ini(p.nombre, p.apellidos) : iniDe(nombre))}</div>`);
    const s1 = jugadorDe(ctx, l, e.id_player, e.dorsal), a1 = hayA ? jugadorDe(ctx, l, e.assist_id_player, e.asist_dorsal) : null;
    const nota = situacionGol(e, ctx.sn.eventos, ctx.dur);
    return `<div class="esc-gol${estr}" role="status" aria-label="Gol de ${esc(ctx.abr[l])}"><div class="eg-cortina">
      <div class="eg-fotos${hayA ? ' con-a' : ''}">
        ${hayA ? `<div class="eg-as">${foto(a1, e.asist_corto || e.asist_jugador)}<div class="tag">ASIST.</div><div class="d">${esc(e.asist_dorsal || '')}</div></div>` : ''}
        <div class="eg-sc">${foto(s1, e.jugador_corto || e.jugador)}<div class="d">${esc(e.dorsal || '')}</div></div>
      </div>
      <div class="eg-tx"><div class="eg-gol">GOL</div><div class="eg-quien">${esc(quien)}</div>${hayA ? `<div class="eg-asis">Asistencia de <b>${esc(asWho)}</b></div>` : ''}
        <div class="eg-chips">${[parte, marc, nota.toUpperCase()].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div></div>
    </div></div>`;
  }

  /* ── 10f · Falta a pantalla completa ────────────────────────────────────────────────────────────────────────────
     Foto del sancionado en blanco y negro (la única escena en B/N) y caen 6 barrotes con rebote y 2 travesaños; rival sin
     foto: su escudo entre rejas. «EXCLUSIÓN · equipo», cuenta atrás grande (la sanción, corriendo deprisa) con barra naranja,
     nombre y «Motivo (COD)». Sin candado. */
  function escenaFaltaHtml(ctx, e) {
    const l = e.lado, estr = innerWidth < 640 || innerWidth / Math.max(1, innerHeight) < .8 ? ' estr' : '';
    let dentro;
    if (ctx.mp[l]) { const p = jugadorDe(ctx, l, e.id_player, e.dorsal); dentro = p && p.foto ? `<div class="f" style="background-image:url('${esc(p.foto)}')"></div>` : `<div class="i">${esc(p ? ini(p.nombre, p.apellidos) : iniDe(e.jugador_corto || e.jugador))}</div>`; }
    else { const n = ctx.nombre[l], c = crest(n), bg = (A.crests[n] && A.crests[n].bg) || 'transparent'; dentro = `<div class="e" style="background-color:${bg};${c ? `background-image:url('${esc(c)}')` : ''}"></div>`; }
    const sub = [motivoFalta(e), ordinal(e.periodo) + (e.t ? ' · ' + e.t : '')].filter(Boolean).join(' · ');
    return `<div class="esc-falta${estr}" role="status" aria-label="Exclusión de ${esc(ctx.abr[l])}">
      <div class="ef-foto"><div class="ef-caja">${dentro}<div class="velo"></div>
        <div class="ef-rejas">${[0, 1, 2, 3, 4, 5].map(k => `<i style="animation-delay:${(0.45 + k * 0.07).toFixed(2)}s"></i>`).join('')}</div>
        <div class="ef-trav a"></div><div class="ef-trav b"></div><div class="d">${esc(e.dorsal || '')}</div></div></div>
      <div class="ef-tx"><div class="ef-pill">EXCLUSIÓN · ${esc(ctx.abr[l])}</div><div class="ef-reloj">${mmssD((e.min_sancion || 2) * 60)}</div><div class="ef-barra"><i></i></div>
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
    const goles = sn.eventos.filter(e => e.tipo === 'GOL').map((e, q) => {
      const l = e.lado, mp = ctx.mp[l], hayA = !!(e.asist_dorsal || e.asist_jugador);
      let ph;
      if (mp) { const s1 = jugadorDe(ctx, l, e.id_player, e.dorsal), a1 = hayA ? jugadorDe(ctx, l, e.assist_id_player, e.asist_dorsal) : null;
        ph = `${hayA ? `<div class="a" ${fotoB(a1, e.asist_corto || e.asist_jugador)}</div>` : ''}<div class="s" ${fotoB(s1, e.jugador_corto || e.jugador)}</div>`; }
      else ph = `<div class="e" style="${escR(l)}"></div>`;
      const sub = [hayA ? 'Asist. ' + quienD(ctx, l, e.asist_dorsal, e.asist_corto, e.asist_jugador) : 'Sin asistencia', situacionGol(e, sn.eventos, ctx.dur)].filter(Boolean).join(' · ');
      return `<div class="er-gol${mp ? ' mp' : ''}" style="animation-delay:${(0.7 + q * 0.12).toFixed(2)}s"><span class="t">${esc(ordinal(e.periodo) + ' ' + (e.t || ''))}</span><div class="erf">${ph}</div>
        <div class="q"><b>${esc(quienD(ctx, l, e.dorsal, e.jugador_corto, e.jugador))}</b><span>${esc(sub)}</span></div><span class="m">${esc((e.marcador || '').replace('-', '–'))}</span></div>`;
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
        ${sn.pista ? `<div class="er-pista"><i></i>${esc(pistaBonita(sn.pista))}</div>` : ''}</div>
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
  window.addEventListener('hashchange', () => { if (ESC.abierta) ESC.abierta.cerrar(); });
  document.addEventListener('click', e => { if (!e.target.closest('[data-ver-resumen]')) return; const S = RSM.final || LIVE.snaps[DV.idp]; if (S) escenaResumen(ctxDirecto(Object.assign({}, S, { _resumen: true }))); });

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
      if (e.tipo === 'GOL' || e.tipo === 'FALTA') {   // 10c / 10f: a pantalla completa; se puede tocar para cerrarla antes
        const mostrar = () => {
          if (gen !== DV.gen) return fin();
          tmp.innerHTML = e.tipo === 'GOL' ? escenaGolHtml(ctx, e) : escenaFaltaHtml(ctx, e);
          const el = tmp.firstElementChild; document.body.appendChild(el);
          let hecho = false, tic = null;
          if (e.tipo === 'FALTA') {   // la sanción corre deprisa (×4) desde el segundo 1,6, para que se vea el reloj bajar
            const total = (e.min_sancion || 2) * 60, t0 = Date.now(), r = el.querySelector('.ef-reloj'), b = el.querySelector('.ef-barra i');
            tic = setInterval(() => { const rem = Math.max(0, total - Math.max(0, Date.now() - t0 - 1600) / 1000 * 4); r.textContent = mmssD(rem); b.style.width = (rem / total * 100).toFixed(1) + '%'; }, 100);
            setTimeout(() => el.classList.add('sale'), dur - 350);
          }
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
    nuevos.forEach(e => { const anuncia = e.tipo === 'GOL' || e.tipo === 'FALTA';
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
      d.innerHTML = `<b>${falta ? 'EXCLUSIÓN ' + esc(fmin(e.min_sancion || 2)) : 'GOL'}</b><strong>${esc(ctx.abr[e.lado])}</strong><span>${esc(quienD(ctx, e.lado, e.dorsal, e.jugador_corto, e.jugador))}</span>`;
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
    introVistaCarga = introVista;
    if (!introVista) abrirIntro();
    render();
    arrancarDirecto();
    cargarSemana();
  })).catch(() => { view.innerHTML = '<div class="loading">No se ha podido cargar la web (falta data/app.json).</div>'; });
})();
