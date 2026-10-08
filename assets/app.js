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
  const box = (href, style, inner, tag = 'div') => href ? `<a class="blk" href="${href}" style="${style}">${inner}</a>` : `<${tag} style="${style}">${inner}</${tag}>`;
  const disc = (url, size, ring = '#FFFFFF', extra = '') => `<div class="disc" style="width:${size}px;height:${size}px;box-shadow:0 0 0 2px ${ring};${url ? `background-image:url('${esc(url)}');` : ''}${extra}"></div>`;
  const photo = (f, filter = 'grayscale(1)', pos = '50% 18%', extra = '') => f ? `<div class="ph" style="filter:${filter};background-image:url('${esc(f)}');background-position:${pos};${extra}"></div>` : '';
  const lab = (t, extra = '') => `<div class="lab" style="${extra}">${t}</div>`;
  const tableRows = (rows, dark = '#2A1416') => { const max = Math.max(3, ...rows.map(r => r.pts)); return rows.map(r => ({ puesto: r.puesto, equipo: r.equipo, crest: crest(r.equipo), pj: r.pj, v: r.v, e: r.e, d: r.d, pts: r.pts, dg: (r.gf - r.gc > 0 ? '+' : '') + (r.gf - r.gc), ptsPct: (r.pts / max * 100) + '%', weight: r.nuestro ? 800 : 500, bg: r.nuestro ? dark : 'transparent', bar: r.nuestro ? RED : '#6B6B70', nuestro: r.nuestro })); };

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
    const statCard = (x, titulo, valor, color, detalle) => box(hP(x.k), 'background:#18181B;border-radius:12px;overflow:hidden;display:grid;grid-template-columns:130px minmax(0,1fr);min-height:250px', `
        <div class="ini" style="background:#26262A;font-size:52px;color:#A6A6AD">${esc(ini(x.nombre, x.apellidos))}${photo(pf(x), 'grayscale(1)', '50% 20%')}</div>
        <div style="padding:20px 22px;display:flex;flex-direction:column">
          <div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#A6A6AD">${titulo}</div>
          <div style="${BS}font-weight:800;font-size:30px;line-height:1;margin-top:10px">${esc(corto(x))}</div>
          <div style="font-size:15px;color:#C9C9CE;margin-top:4px">#${esc(x.dorsal)} · ${esc(x.equipo)}</div>
          <div style="margin-top:auto;padding-top:16px;display:flex;align-items:end;gap:14px">
            <div style="${BS}font-weight:900;font-size:88px;line-height:.85;color:${color}">${valor}</div>
            <div style="font-size:15px;font-weight:600;padding-bottom:4px">${detalle}</div>
          </div>
        </div>`);
    const asisCard = asis ? statCard(asis, 'MÁS ASISTENCIAS DEL CLUB', asis.a, '#F4F4F5',
      `${asis.a === 1 ? 'asistencia' : 'asistencias'} · ${asis.g} ${asis.g === 1 ? 'gol' : 'goles'}<br>vs ${esc([...new Set(asis.rivales)].join(', '))}${empatan(asis, y => y.a === asis.a && y.g === asis.g)}`) : '';
    const sancCard = sanc ? statCard(sanc, 'MÁS SANCIONADO DEL CLUB', fmin(sanc.pim), '#FF8A3D',
      `de sanción · ${sanc.faltas} ${sanc.faltas === 1 ? 'falta' : 'faltas'}<br>vs ${esc([...new Set(sanc.rivales)].join(', '))}${empatan(sanc, y => y.pim === sanc.pim && y.faltas === sanc.faltas)}`)
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
    const porCard = por ? box(hP(por.k), `background:${RED};border-radius:12px;overflow:hidden;display:grid;grid-template-columns:140px minmax(0,1fr);min-height:250px`, `
        <div class="ini" style="background:#A9161E;font-size:56px;color:#fff">${esc(ini(por.nombre, por.apellidos))}${photo(pf(por), 'grayscale(1) contrast(1.1)', '50% 20%')}</div>
        <div style="padding:20px 22px;display:flex;flex-direction:column;gap:4px">
          <div style="font-size:14px;font-weight:700;letter-spacing:.12em">PORTERO DE LA SEMANA</div>
          <div style="${BS}font-weight:800;font-size:28px;line-height:1;margin-top:6px">${esc(corto(por))}</div>
          <div style="font-size:15px">#${esc(por.dorsal)} · ${esc(por.equipo)} vs ${esc(por.rival)}</div>
          <div style="margin-top:auto;padding-top:16px;display:flex;align-items:end;gap:16px;flex-wrap:wrap">
            <div style="${BS}font-weight:900;font-size:76px;line-height:.85">${dec(por.pct)}<span style="font-size:36px">%</span></div>
            <div style="font-size:15px;font-weight:600;padding-bottom:4px">${por.par} paradas<br>de ${por.tiros} tiros</div>
          </div>
        </div>`) : '';
    const figCard = fig ? box(hP(fig.k), 'background:#18181B;border-radius:12px;overflow:hidden;display:grid;grid-template-columns:130px minmax(0,1fr);min-height:250px', `
        <div class="ini" style="background:#26262A;font-size:52px;color:#A6A6AD">${esc(ini(fig.nombre, fig.apellidos))}${photo(pf(fig), 'grayscale(1)', '50% 20%')}</div>
        <div style="padding:20px 22px;display:flex;flex-direction:column">
          <div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#A6A6AD">GOLEADOR DEL CLUB</div>
          <div style="${BS}font-weight:800;font-size:30px;line-height:1;margin-top:10px">${esc(corto(fig))}</div>
          <div style="font-size:15px;color:#C9C9CE;margin-top:4px">#${esc(fig.dorsal)} · ${esc(fig.equipo)}</div>
          <div style="margin-top:auto;padding-top:16px;display:flex;align-items:end;gap:14px">
            <div style="${BS}font-weight:900;font-size:88px;line-height:.85;color:${RED}">${fig.g}</div>
            <div style="font-size:15px;font-weight:600;padding-bottom:4px">goles · ${fig.a} asist.<br>vs ${esc(fig.rival)}</div>
          </div>
        </div>`) : '';
    const proxHtml = proximos.map(p => `<div style="display:grid;grid-template-columns:1fr 84px 1fr;gap:6px;padding:12px 0;border-bottom:1px solid #26262A;align-items:center">
        <div style="display:flex;flex-direction:column;align-items:center;gap:5px">${disc(p.lc, 52)}<span style="${BS}font-weight:800;font-size:17px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(p.la)}</span></div>
        <div style="text-align:center"><div style="${BS}font-weight:800;font-size:22px;line-height:1">${esc(p.hora)}</div><div style="font-size:12px;color:#A6A6AD;margin-top:2px">${p.dia}</div>${p.derbi ? `<div style="display:inline-block;margin-top:5px;font-size:11px;font-weight:700;letter-spacing:.1em;padding:2px 6px;border-radius:3px;background:${RED}">DERBI</div>` : ''}</div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:5px">${disc(p.vc, 52)}<span style="${BS}font-weight:800;font-size:17px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(p.va)}</span></div>
      </div>`).join('');
    const tablas = w.ligas.map(l => `<div class="card" style="padding:20px 22px">
        ${box(hLg(l.id), 'display:flex;justify-content:space-between;align-items:baseline;width:100%;gap:8px', `<span style="${BS}font-weight:800;font-size:28px">${esc(l.nombre)}</span><span style="font-size:14px;color:#A6A6AD">Ver liga →</span>`)}
        <div style="display:flex;flex-direction:column;gap:2px;margin-top:12px">${tableRows(l.clasif).map(r => `
          <div class="fila-barra cinco" style="display:grid;grid-template-columns:24px 26px minmax(0,1fr) minmax(40px,120px) 34px;gap:10px;align-items:center;padding:6px 8px;border-radius:6px;background:${r.bg}">
            <span style="font-weight:700;font-size:15px;color:#A6A6AD;text-align:right">${r.puesto}</span>${disc(r.crest, 24)}
            <span style="font-weight:${r.weight};font-size:15px;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.equipo)}</span>
            <div class="barra" style="height:6px;background:#26262A;border-radius:3px;overflow:hidden"><div style="height:100%;width:${r.ptsPct};background:${r.bar}"></div></div>
            <span style="${BS}font-weight:800;font-size:20px;text-align:right">${r.pts}</span>
          </div>`).join('')}</div>
      </div>`).join('');
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
        <div class="card" style="padding:20px 22px">${lab('PRÓXIMOS PARTIDOS')}<div style="display:flex;flex-direction:column;margin-top:8px">${proxHtml}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:12px">${tablas}</div>`;
  }

  /* ── 2. Equipos ─────────────────────────────────────────── */
  function calTile(c, cal) {
    if (c.descanso) return `<div style="background:#18181B;border:1px solid #26262A;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;align-items:center;opacity:.5">
        <div style="display:flex;justify-content:space-between;width:100%;padding:8px 10px 0;font-size:12px;font-weight:700;color:#A6A6AD"><span>J${c.j}</span><span></span></div>
        <div style="width:64px;height:64px;border-radius:50%;background:#26262A;margin:8px 0 6px;box-shadow:0 0 0 2px #26262A"></div>
        <span style="${BS}font-weight:800;font-size:20px;letter-spacing:.04em;line-height:1;white-space:nowrap">DESCANSA</span>
        <div style="margin-top:10px;width:100%;padding:6px 0;text-align:center;background:#26262A;color:#A6A6AD;${BS}font-weight:800;font-size:20px;line-height:1">—</div></div>`;
    const played = !!c.resultado;
    // aplazado: sin jugar y con fecha posterior a la de una jornada siguiente
    const aplazado = !played && c.fecha && (cal || []).some(o => o.j > c.j && o.fecha && o.fecha < c.fecha);
    const col = played ? RES[c.r][1] : (aplazado ? '#FF8A3D' : (c.derbi ? RED : '#26262A'));
    return box(hM(c.mid), `background:#18181B;border:1px solid ${col};border-radius:10px;overflow:hidden;display:flex;flex-direction:column;align-items:center`, `
      <div style="display:flex;justify-content:space-between;width:100%;padding:8px 10px 0;font-size:12px;font-weight:700;color:#A6A6AD"><span>J${c.j}</span><span>${c.casa ? 'CASA' : 'FUERA'}</span></div>
      <div style="width:64px;height:64px;border-radius:50%;margin:8px 0 6px;box-shadow:0 0 0 2px #FFFFFF">${disc(crest(c.rival), 64, 'transparent')}</div>
      <span style="${BS}font-weight:800;font-size:20px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(abr(c.rival))}</span>
      ${aplazado ? '<span style="font-size:11px;font-weight:700;letter-spacing:.06em;color:#FF8A3D;margin-top:3px">APLAZADO</span>' : ''}
      <div style="margin-top:${aplazado ? 4 : 10}px;width:100%;padding:6px 0;text-align:center;background:${col};color:#FFFFFF;${BS}font-weight:800;font-size:20px;line-height:1">${played ? c.resultado.replace('-', '–') : fd(c.fecha).replace(/^\S+ /, '')}</div>`);
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
    const altas = e.altas.filter(a => J[a.k]).map(a => box(hP(a.k), 'display:flex;justify-content:space-between;gap:10px;width:100%;padding:9px 0;border-bottom:1px solid #26262A',
      `<span style="font-weight:700">#${esc(J[a.k].dorsal)} ${esc(corto(J[a.k]))}</span><span style="color:#A6A6AD;font-size:14px;text-align:right">${esc(a.desde ? 'de ' + a.desde : 'Nuevo')}</span>`)).join('');
    const bajas = e.bajas.map(b => `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:9px 0;border-bottom:1px solid #26262A;align-items:center">
        <div style="min-width:0"><div style="font-weight:700">#${esc(b.dorsal)} ${esc(corto(b))}</div><div style="color:#A6A6AD;font-size:14px">${esc(b.destino ? '→ ' + b.destino + (b.destinoLiga ? ' · ' + b.destinoLiga : '') : 'Sin equipo esta temporada')}</div></div>
        <div style="text-align:right"><div style="${BS}font-weight:800;font-size:22px;line-height:1">${b.pct != null ? dec(b.pct) + '%' : '—'}</div><div style="font-size:12px;color:#A6A6AD">de los puntos</div></div></div>`).join('');
    const h2h = e.h2h.filter(h => !ours(h.rival)).sort((a, b) => (b.v + b.e + b.d) - (a.v + a.e + a.d));
    const h2hHtml = h2h.map(h => `<div class="fila-barra" style="--c1:28px;display:grid;grid-template-columns:28px minmax(0,1fr) minmax(80px,280px) 90px;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid #26262A">
        ${disc(crest(h.rival), 26)}<span style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.rival)}</span>
        <div class="barra" style="display:flex;height:10px;border-radius:3px;overflow:hidden;background:#26262A"><div style="flex:${h.v};background:#1E8A4C"></div><div style="flex:${h.e};background:#8A8A8F"></div><div style="flex:${h.d};background:#55555B"></div></div>
        <span style="text-align:right;${BS}font-weight:800;font-size:20px">${h.v}-${h.e}-${h.d}</span></div>`).join('');
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
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px">${e.cal.map(c => calTile(c, e.cal)).join('')}</div>
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
          <div class="card" style="padding:18px 20px"><div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#3DD27E">ALTAS · ${e.altas.length}</div>${altas}</div>
          <div class="card" style="padding:18px 20px"><div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#FF5A52">BAJAS · ${e.bajas.length}</div>${bajas}</div>
        </div>
      </div>
      ${h2h.length ? `${lab('CARA A CARA CON LOS RIVALES DE LA LIGA · HISTÓRICO', 'margin:28px 0 10px')}
        <div class="card" style="padding:10px 20px">${h2hHtml}
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
      const rows = tableRows(L.clasif).map(r => `<div style="display:grid;grid-template-columns:26px 26px minmax(0,1fr) 30px 30px 30px 30px 44px 44px;gap:8px;align-items:center;padding:8px;border-radius:6px;background:${r.bg};font-size:15px">
          <span style="font-weight:700;color:#A6A6AD;text-align:right">${r.puesto}</span>${disc(r.crest, 24)}
          ${box(hT(r.equipo), `font-weight:${r.weight};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`, esc(r.equipo), 'span')}
          <span style="text-align:center">${r.pj}</span><span style="text-align:center">${r.v}</span><span style="text-align:center">${r.e}</span><span style="text-align:center">${r.d}</span><span style="text-align:center;color:#C9C9CE">${r.dg}</span>
          <span style="text-align:right;${BS}font-weight:800;font-size:22px">${r.pts}</span></div>`).join('');
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
      const ldr = (titulo, arr, f) => `<div class="card" style="padding:16px 18px">${lab(titulo, 'margin-bottom:6px')}${(arr || []).slice(0, 5).map(x => box(hP(kOf(x.nombre, x.apellidos)), `display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;padding:8px 6px;border-radius:6px;background:${x.nuestro ? '#2A1416' : 'transparent'}`, `
          ${disc(crest(x.equipo), 22)}<div style="min-width:0"><div style="font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">#${esc(x.dorsal)} ${esc(corto(x))}</div><div style="font-size:13px;color:#A6A6AD">${esc(x.equipo)}</div></div>
          <span style="${BS}font-weight:800;font-size:26px;color:${x.nuestro ? '#FF6B63' : '#F4F4F5'}">${esc(f(x))}</span>`)).join('')}</div>`;
      body = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:12px;margin-top:20px;align-items:start">
          <div class="card" style="padding:16px 18px;overflow-x:auto"><div style="min-width:480px">
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
          ${ldr('GOLEADORES', lid.goleadores, x => x.goles)}${ldr('ASISTENCIAS', lid.asistentes, x => x.asistencias)}${ldr('PORTEROS · % PARADAS', lid.porteros, x => dec(x.pct_paradas))}${lid.sancionados && lid.sancionados.length ? ldr('MÁS MINUTOS DE SANCIÓN', lid.sancionados, x => fmin(x.minutos)) : ''}</div>` : ''}`;
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
    const lin = (x, sub) => `<div style="padding:7px 0;border-bottom:1px solid #26262A"><div style="font-weight:600">${jn(x)}${x.portero ? ' <span style="font-size:12px;color:#A6A6AD">· portero</span>' : ''}${x.tag ? ` <span style="font-size:11px;font-weight:700;padding:1px 6px;border-radius:3px;background:${x.tag[2]};color:#0D0D0E;white-space:nowrap">${esc(x.tag[1])}</span>` : ''}</div><div style="font-size:12px;color:#A6A6AD">${sub}</div></div>`;
    const ab = orden.map(e => {
      const altas = (e.altas || []).map(x => { const t = tipoAlta(x, e.equipo, L.nombre); return lin(Object.assign({}, x, { tag: t }), (x.desde ? 'de ' + esc(x.desde) + (x.desdeLiga ? ' · ' + esc(x.desdeLiga) : '') : esc(x.nota || 'Nuevo')) + (x.stats ? ' · 25/26: ' + st(x.stats) : '')); }).join('') || '<div style="padding:7px 0;color:#A6A6AD;font-size:14px">Ninguna</div>';
      const bajas = (e.bajas || []).map(x => lin(x, x.destino ? '→ ' + esc(x.destino) + (x.destinoLiga ? ' · ' + esc(x.destinoLiga) : '') : esc(x.nota || 'Sin partidos esta temporada'))).join('') || '<div style="padding:7px 0;color:#A6A6AD;font-size:14px">Ninguna</div>';
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
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:4px 18px">
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
    const rook = rk.map(r => box(hP(r.k), `background:#18181B;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;border:2px solid ${r.nuestro ? RED : '#18181B'}`, `
          <div class="ini" style="aspect-ratio:4/5;background:#26262A;font-size:52px;color:#55555B">${esc(ini(r.nombre, r.apellidos))}${photo(r.foto)}
            <span style="position:absolute;left:8px;top:8px;font-size:11px;font-weight:700;letter-spacing:.1em;padding:3px 6px;border-radius:3px;background:${RED};color:#fff;font-family:'IBM Plex Sans Condensed',sans-serif">ROOKIE</span>
            <div style="position:absolute;right:8px;top:8px">${disc(crest(r.equipo), 36)}</div>
            <span style="position:absolute;left:10px;bottom:4px;${BS}font-weight:900;font-size:40px;line-height:1;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${esc(r.dorsal ?? '')}</span>
            <span style="position:absolute;right:10px;bottom:8px;${BS}font-weight:800;font-size:18px;line-height:1;white-space:nowrap;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${r.edad != null ? r.edad + ' años' : ''}</span>
          </div>
          <div style="padding:10px 12px;text-align:left"><div style="font-weight:700;font-size:15px;line-height:1.15">${esc(corto(r))}</div><div style="font-size:13px;color:#A6A6AD;margin-top:2px">${esc(abr(r.equipo))} · ${esc(r.cantera ? r.cantera.replace(/ en 20\d\d\/\d\d$/, '') : 'Primer año en la FMP')}</div></div>`)).join('');
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
      <div class="card" style="padding:6px 20px">${mov}</div>
      ${titulo2('ALTAS Y BAJAS · EQUIPO POR EQUIPO', 'Primero los nuestros')}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr));gap:12px;align-items:start">${ab}</div>
      ${renov ? `${titulo2('RENOVACIÓN DE PLANTILLAS', 'Puntos de 2025/26 que siguen en el equipo · caras nuevas')}<div class="card" style="padding:8px 18px">${renov}</div>` : ''}
      ${rk.length ? `${titulo2('ROOKIES DE LA LIGA · ' + rk.length, rk.filter(r => r.menor || r.edad < 18).length + ' menores de 18 · primero los de MADRIDPATINA')}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px">${rook}</div>` : ''}`;
  }

  /* ── 4. Partido ─────────────────────────────────────────── */
  function vPartido(mid) {
    const p = A.partidos[mid] || Object.values(A.partidos)[0];
    const side = (eq, gol, por, alin, staff) => { const camp = (alin || []).filter(x => !x.portero), filas = camp.length ? camp : gol;
      return `<div class="card" style="padding:18px 20px">
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
    return `<div style="margin-top:16px;background:#18181B;border-radius:14px;padding:clamp(20px,3vw,36px)">
        <div style="text-align:center;font-size:14px;font-weight:700;letter-spacing:.12em;color:#A6A6AD">${esc((p.ligaNombre + ' · Jornada ' + p.jornada + ' · ' + fd(p.fecha) + (p.hora ? ' · ' + p.hora : '')).toUpperCase())}</div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:clamp(12px,3vw,40px);align-items:center;margin-top:20px">
          ${team(p.local, hT(p.local))}
          <div style="${BS}font-weight:900;font-size:clamp(72px,12vw,150px);line-height:.85;font-variant-numeric:tabular-nums;white-space:nowrap">${p.gl}<span style="color:#55555B">–</span>${p.gv}</div>
          ${team(p.visitante, hT(p.visitante))}
        </div>
        ${hasTiros ? `<div style="max-width:640px;margin:28px auto 0">
          <div style="display:flex;justify-content:space-between;${BS}font-weight:800;font-size:28px;line-height:1"><span>${p.tl}</span><span class="lab" style="align-self:center">TIROS A PUERTA</span><span>${p.tv}</span></div>
          <div style="display:flex;gap:3px;height:10px;margin-top:8px"><div style="flex:${p.tl};background:${ours(p.local) ? RED : '#6B6B70'};border-radius:3px"></div><div style="flex:${p.tv};background:${ours(p.visitante) ? RED : '#6B6B70'};border-radius:3px"></div></div>
        </div>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:12px">${side(p.local, p.gol_l, p.por_l, p.alin_l, p.staff_l)}${side(p.visitante, p.gol_v, p.por_v, p.alin_v, p.staff_v)}</div>
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
          <span style="position:absolute;left:8px;bottom:6px;${BS}font-weight:900;font-size:40px;line-height:1;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${esc(p.dorsal || '')}</span>
          <span style="position:absolute;right:8px;top:8px;font-size:12px;font-weight:700;padding:3px 7px;border-radius:4px;background:${RED};color:#fff;font-family:'IBM Plex Sans Condensed',sans-serif">${esc('MP ' + (equiposDe(p).map(letraOf).join('·') || p.equipo.replace('MADRIDPATINA', '').trim()))}</span>
        </div>
        <div style="padding:10px 12px"><div style="font-weight:700;font-size:15px;line-height:1.15">${esc(corto(p))}</div><div style="font-size:13px;color:#A6A6AD;margin-top:2px">${stat}</div></div>`);
    }).join('');
    const seen = {};
    const rook = [].concat(...A.ligas.map(l => l.rookies)).filter(r => r.nuestro && !seen[r.k] && (seen[r.k] = 1)).filter(r => !fe || r.equipo === fe.nombre);
    const rookHtml = rook.map(r => box(hP(r.k), 'flex:none;width:150px;background:#121214;border-radius:10px;overflow:hidden', `
        <div class="ini" style="height:150px;background:#26262A;font-size:40px;color:#55555B">${esc(ini(r.nombre, r.apellidos))}${photo(r.foto || (J[r.k] && J[r.k].foto))}
          <span style="position:absolute;left:8px;top:8px;font-size:11px;font-weight:700;letter-spacing:.1em;padding:3px 6px;border-radius:3px;background:${RED};color:#fff;font-family:'IBM Plex Sans Condensed',sans-serif">ROOKIE</span>
          <span style="position:absolute;right:8px;bottom:4px;${BS}font-weight:900;font-size:34px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)">${esc(r.dorsal ?? '')}</span></div>
        <div style="padding:8px 10px"><div style="font-weight:700;font-size:14px;line-height:1.15">${esc(corto(r))}</div><div style="font-size:12px;color:#A6A6AD">${esc(abr(r.equipo) === 'MP' ? 'MADRIDPATINA' : abr(r.equipo))}${r.edad != null ? ' · ' + r.edad + ' años' : ''}</div></div>`)).join('');
    return `<div style="${BS}font-weight:900;font-size:clamp(48px,7vw,84px);line-height:.9;padding-top:32px">PLANTILLAS</div>
      ${rook.length ? `<div class="card" style="margin-top:20px;padding:16px 18px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#FF6B63">ROOKIES 2026/27 · ${rook.length}</span><span style="font-size:13px;color:#A6A6AD">Nuevos en el equipo esta temporada</span></div>
        <div style="display:flex;gap:12px;overflow-x:auto;margin-top:12px;padding-bottom:4px">${rookHtml}</div></div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:16px">${filtros}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:16px">${jugList}</div>${exJugadores(list, fe)}`;
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
    const temps = order.map(kk => { const s = p.temporadas[kk]; const g = s.goles || 0, a = s.asistencias || 0;
      return `<div style="display:grid;grid-template-columns:72px minmax(0,1fr) 120px;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid #26262A">
        <div><div style="${BS}font-weight:800;font-size:22px;line-height:1">${kk}</div><div style="font-size:13px;color:#A6A6AD">${s.pj} PJ${s.parcial ? ' · en curso' : (s.eqs ? ' · ' + esc(s.eqs.join(', ')) : '')}${s.pim ? ' · ' + fmin(s.pim) + ' de sanción' : ''}</div></div>
        <div style="display:flex;flex-direction:column;gap:4px"><div style="height:12px;border-radius:2px;background:${RED};width:${Math.max(2, g / max * 100)}%"></div><div style="height:12px;border-radius:2px;background:#8A8A8F;width:${Math.max(2, a / max * 100)}%"></div></div>
        <div style="display:flex;gap:12px;justify-content:flex-end;${BS}font-weight:800;font-size:28px;line-height:1"><span style="color:#FF6B63">${g}<span style="font-size:14px"> G</span></span><span>${a}<span style="font-size:14px"> A</span></span></div></div>`; }).join('');
    const partidos = p.partidos.map(x => box(hM(x.mid), 'background:#18181B;border-radius:10px;padding:14px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:12px', `
        ${disc(crest(x.rival), 48)}<div style="flex:1;min-width:0"><div style="font-size:13px;color:#A6A6AD">vs</div><span style="${BS}font-weight:800;font-size:22px;letter-spacing:.04em;line-height:1;white-space:nowrap">${esc(abr(x.rival))}</span></div>
        <div style="${BS}font-weight:800;font-size:24px;text-align:right">${x.pct != null ? dec(x.pct) + '%' : x.g + 'G ' + x.a + 'A'}</div>${x.pim ? `<div style="flex-basis:100%;margin-top:-6px;padding-left:60px;font-size:13px;font-weight:600;color:#A6A6AD">${fmin(x.pim)} de sanción</div>` : ''}`)).join('');
    return `<div style="margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;align-items:stretch">
        <div class="ini" style="background:linear-gradient(160deg,#D3202A 0%,#8E1219 100%);border-radius:14px;overflow:hidden;align-self:start;aspect-ratio:4/5;font-size:120px;color:#A9161E">
          ${esc(ini(p.nombre, p.apellidos))}${photo(p.foto, 'none', '50% 15%')}
          <span style="position:absolute;left:18px;bottom:8px;font-size:150px;line-height:.85;color:#fff;text-shadow:0 4px 18px rgba(0,0,0,.5)">${esc(p.dorsal || '')}</span>
        </div>
        <div style="grid-column:span 2;min-width:0;background:#18181B;border-radius:14px;padding:clamp(20px,3vw,32px);display:flex;flex-direction:column;gap:20px" class="fj">
          <div>
            ${t ? `<a href="${hEq(t.id)}" style="font-size:14px;font-weight:700;letter-spacing:.12em">${esc((p.equipo || '').toUpperCase() + ' · ' + t.liga.toUpperCase())}</a>` : `<div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:#FF6B63">${esc((p.equipo || '').toUpperCase())}</div>`}
            <div style="${BS}font-weight:900;font-size:clamp(44px,6vw,76px);line-height:.9;margin-top:6px">${esc(p.nombre.toUpperCase())}</div>
            <div style="${BS}font-weight:700;font-size:clamp(24px,3vw,36px);line-height:1;color:#A6A6AD">${esc(p.apellidos.toUpperCase())}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">${tags.map(tg => `<span style="font-size:13px;font-weight:700;letter-spacing:.06em;padding:4px 10px;border-radius:4px;background:#26262A">${tg}</span>`).join('')}</div>
          </div>
          ${car ? `<div style="display:flex;gap:10px;flex-wrap:wrap">${tile('Goles en el club', car.g, 'color:#FF6B63')}${tile('Asistencias', car.a)}${tile('Partidos', car.pj)}${tile('Temporadas', car.temporadas)}${tile('Sanción', fmin((car.pim || 0) + ((p.temporadas[A.temporada] || {}).pim || 0)))}</div>` : ''}
          <div>${lab('POR TEMPORADA', 'margin-bottom:12px')}${temps}</div>
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
        <div style="display:flex;gap:10px;align-items:flex-end;min-width:640px">${hi.seasons.map(se => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px">
            <div style="${BS}font-weight:800;font-size:15px;color:#C9C9CE;white-space:nowrap">${se.v}-${se.e}-${se.d}</div>
            <div style="display:flex;flex-direction:column-reverse;width:100%;max-width:56px;height:${se.h};border-radius:3px;overflow:hidden"><div style="flex:${se.v};background:#1E8A4C"></div><div style="flex:${se.e};background:#8A8A8F"></div><div style="flex:${se.d};background:#55555B"></div></div>
            <div style="font-size:12px;color:#A6A6AD;white-space:nowrap;text-align:center">${se.pj} PJ<br>${se.pct}</div>
            <div style="font-size:13px;font-weight:700;color:#A6A6AD;border-top:1px solid #3A3A40;padding-top:6px;width:100%;text-align:center;white-space:nowrap">${esc(se.t)}</div></div>`).join('')}</div>
        <div style="display:flex;gap:16px;font-size:13px;color:#A6A6AD;padding-top:14px;flex-wrap:wrap"><span><span style="color:#1E8A4C">■</span> Victoria</span><span><span style="color:#8A8A8F">■</span> Empate</span><span><span style="color:#55555B">■</span> Derrota</span><span>Altura = partidos jugados (sin derbis)</span></div>
      </div>
      ${hi.logros || ''}
      ${lab('RÉCORDS', 'margin:28px 0 10px')}
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:12px">${hi.records.map(rc => box(rc.href, `background:${rc.bg};border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:8px;min-height:170px`, `
          <div style="font-size:14px;font-weight:700;letter-spacing:.12em;color:${rc.kInk}">${rc.k}</div>
          <div style="${BS}font-weight:900;font-size:72px;line-height:.85">${rc.v}</div>
          <div style="margin-top:auto"><div style="font-weight:700">${esc(rc.who)}</div><div style="font-size:14px;color:${rc.subInk}">${esc(rc.sub)}</div></div>`)).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:12px;margin-top:28px;align-items:start">
        <div>${lab(hi.trTitle, 'margin-bottom:10px')}
          <div class="card" style="padding:6px 20px">${hi.tray.map(tr => box(tr.href, 'display:grid;grid-template-columns:44px minmax(0,1fr);gap:14px;align-items:center;width:100%;padding:14px 0;border-bottom:1px solid #26262A', `
              <span style="${BS}font-weight:900;font-size:44px;line-height:1;color:${RED}">${esc(tr.letra)}</span>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${tr.steps.map(st => `<div style="padding:8px 12px;border-radius:8px;background:${st.bg};min-width:110px"><div style="font-size:12px;font-weight:700;color:#A6A6AD">${esc(st.t)}</div><div style="display:flex;align-items:baseline;gap:6px"><span style="${BS}font-weight:900;font-size:30px;line-height:1">${st.p}</span><span style="font-size:13px;font-weight:600;color:#C9C9CE">${esc(st.c)}</span></div></div>`).join('')}</div>`)).join('')}</div>
        </div>
        <div>${lab('BALANCE CONTRA CADA CLUB', 'margin-bottom:10px')}
          <div class="card" style="padding:6px 20px">${hi.rivales.map(h => `<div class="fila-barra" style="--c1:26px;display:grid;grid-template-columns:26px minmax(0,1fr) minmax(60px,180px) 76px;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid #26262A">
              ${disc(h.crest || crest(h.rival), 24)}<span style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.rival)}</span>
              <div class="barra" style="display:flex;height:10px;border-radius:3px;overflow:hidden;background:#26262A"><div style="flex:${h.v};background:#1E8A4C"></div><div style="flex:${h.e};background:#8A8A8F"></div><div style="flex:${h.d};background:#55555B"></div></div>
              <span style="text-align:right;${BS}font-weight:800;font-size:20px">${h.v}-${h.e}-${h.d}</span></div>`).join('')}</div>
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
  const TOP = { jornada: 'jornada', equipo: 'equipos', liga: 'ligas', partido: 'ligas', jugadores: 'jugadores', jugador: 'jugadores', historico: 'legado', legado: 'legado', pretemporada: 'pretemporada' };
  const TITLES = { jornada: 'Jornada', equipo: 'Equipos', liga: 'Ligas', partido: 'Partido', jugadores: 'Jugadores', jugador: 'Jugador', historico: 'Legado', legado: 'Legado', pretemporada: 'Pretemporada' };
  let prevRoute = null, navReset = false, goingBack = false;
  function render() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const v = TOP[parts[0]] ? parts[0] : 'jornada';
    // Enlace viejo o mal copiado: a la lista, nunca a la ficha de otra persona ni a otro partido
    if (v === 'jugador' && !A.jugadores[parts[1]]) { history.replaceState(null, '', '#/jugadores'); prevRoute = location.hash; return render(); }
    if (v === 'liga' && parts[2] === 'llega') { history.replaceState(null, '', hPre(parts[1])); prevRoute = location.hash; return render(); }
    if (v === 'partido' && !A.partidos[parts[1]]) { history.replaceState(null, '', '#/jornada'); prevRoute = location.hash; return render(); }
    const nav = [['pretemporada', 'Pretemporada', hPre('club')], ['jornada', 'Jornada', '#/jornada'], ['equipos', 'Equipos', hEq(S.eq || A.equipos[0].id)], ['ligas', 'Ligas', hLg(S.lg || A.ligas[0].id)], ['jugadores', 'Jugadores', '#/jugadores'], ['legado', 'Legado', '#/legado']];
    $('#nav').innerHTML = nav.map(([k, l, h]) => `<a href="${h}" data-nav${TOP[v] === k ? ' aria-current="page"' : ''}>${l}</a>`).join('');
    // móvil: la misma navegación, abajo y con iconos (al alcance del pulgar)
    $('#tabbar').innerHTML = nav.map(([k, l, h]) => `<a href="${h}" data-nav${TOP[v] === k ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONO[k]}</svg><span>${l}</span></a>`).join('');
    let html;
    if (v === 'equipo') html = vEquipo(parts[1]);
    else if (v === 'liga') html = vLiga(parts[1], parts[2] === 'llega' ? 'llega' : null, parts[2] === 'j' ? parseInt(parts[3], 10) : null);
    else if (v === 'partido') html = vPartido(parts[1]);
    else if (v === 'jugadores') html = vJugadores(parts[1]);
    else if (v === 'jugador') html = vJugador(parts[1]);
    else if (v === 'historico' || v === 'legado') html = vHistorico();
    else if (v === 'pretemporada') html = vPretemporada(parts[1]);
    else html = vJornada(parts[1]);
    const back = S.hist.length && v !== 'jornada' ? '<a class="back" href="#" data-back>← Volver</a>' : '';
    const pie = `<footer class="pie"><span>MADRIDPATINA · Temporada ${esc(A.temporada)}</span><span>Datos: Federación Madrileña de Patinaje · actualizado ${fdc(A.actualizado).toLowerCase()}</span></footer>`;
    view.innerHTML = back + html + pie;
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
    render(); window.scrollTo(0, 0);
  });

  /* ── Carga ──────────────────────────────────────────────── */
  // historico.json se pide a la vez que app.json; hasta que llegue (o falle) Histórico dice «Cargando…»
  const pHist = fetch('data/historico.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
  fetch('data/app.json', { cache: 'no-cache' }).then(r => r.json()).then(app => {
    A = app;
    $('#sub').textContent = 'Hockey línea · ' + A.temporada;
    if (!location.hash && S.route) history.replaceState(null, '', S.route);
    prevRoute = location.hash;
    render();
    pHist.then(h => { hCargando = false; if (h) H = prepH(h); render(); });
  }).catch(() => { view.innerHTML = '<div class="loading">No se ha podido cargar la web (falta data/app.json).</div>'; });
})();
