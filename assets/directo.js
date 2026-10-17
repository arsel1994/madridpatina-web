/* MADRIDPATINA · capa "En directo" (sin dependencias).
   Uso:
     const live = MPDirecto.start({ url: '/api/directo', cadaMs: 15000, onSnap, onNuevo });
     live.stop();
   onSnap(snap, prevSnap)  → pintar estado/reloj/marcador base
   onNuevo(evento, snap)   → animar solo lo nuevo (gol → cortina + rodillo, falta → chip, etc.)
   onEstado({ ok, fallos }) → tras cada petición (añadido en la web: para «sin conexión · reintentando»)
   Contrato de snap: ver README §Contrato. */
(function (g) {
  function start(o) {
    const url = o.url, cada = o.cadaMs || 15000;
    const seen = new Set(); let prev = null, timer = null, fails = 0, first = true, stopped = false;
    async function tick() {
      if (stopped) return;
      if (document.hidden) return schedule(cada);            // pestaña oculta: no pedir
      try {
        const r = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        fails = 0;
        (data.partidos || [data]).forEach(snap => {
          const nuevos = (snap.eventos || []).filter(e => !seen.has(snap.idp + ':' + e.id));
          nuevos.forEach(e => seen.add(snap.idp + ':' + e.id));
          o.onSnap && o.onSnap(snap, prev && (prev.partidos || [prev]).find(p => p.idp === snap.idp));
          if (!first) nuevos.forEach(e => o.onNuevo && o.onNuevo(e, snap));   // al cargar a mitad de partido no se anima el pasado
        });
        prev = data; first = false;
        o.onEstado && o.onEstado({ ok: true, fallos: 0, datos: data });
        const algunoVivo = (data.partidos || [data]).some(p => p.estado === 'directo' || p.estado === 'descanso');
        schedule(algunoVivo ? cada : 60000);
      } catch (err) { fails++; o.onEstado && o.onEstado({ ok: false, fallos: fails }); schedule(Math.min(cada * Math.pow(2, fails), 120000)); }
    }
    function schedule(ms) { clearTimeout(timer); timer = setTimeout(tick, ms); }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(0); });
    tick();
    return { stop() { stopped = true; clearTimeout(timer); } };
  }
  // Reloj local entre actualizaciones: parte del reloj del snap y avanza en tiempo real mientras estado === 'directo'.
  function relojLocal(snap, recibidoEn) {
    const [m, s] = (snap.reloj || '00:00').split(':').map(Number);
    const extra = snap.estado === 'directo' ? (Date.now() - recibidoEn) / 1000 : 0;
    const t = Math.min(m * 60 + s + extra, (snap.duracion_periodo || 1200));
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  }
  // Cola de goles: una cortina cada vez (2,8 s) + 1,2 s para el rodillo.
  function colaGoles(mostrar) {
    const q = []; let busy = false;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function next() { if (busy || !q.length) return; busy = true; const e = q.shift();
      mostrar(e, reduce ? 0 : 2800).then(() => setTimeout(() => { busy = false; next(); }, reduce ? 0 : 1200)); }
    return e => { q.push(e); next(); };
  }
  g.MPDirecto = { start, relojLocal, colaGoles };
})(window);
