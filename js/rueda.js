/* ============================================================
   rueda.js — INSCRIPCIONES · rueda de fecha (estilo iOS)
   Copia fiel de abrirRuedaFecha de PRIV (mismas lecciones):
     · el picker se muestra ANTES de construir las columnas;
     · las columnas se LEEN antes de cerrarlo.
   Aquí siempre lleva rueda de AÑO (fechas de nacimiento, etc.).
   abrirRueda(iso, onOk(iso, texto), {anioMin, anioMax})
   ============================================================ */
(function () {
  'use strict';
  var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var H = 42;
  var S = { anio: 0, meses: [], dias: [], anios: [], ov: null };
  function q(s, r) { return (r || S.ov).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || S.ov).querySelectorAll(s)); }
  function cap(s) { return s[0].toUpperCase() + s.slice(1); }
  function diasMes(m, a) { return new Date(a, m + 1, 0).getDate(); }
  function sel(col) { return Math.max(0, Math.round(col.scrollTop / H)); }
  function marcar(col) { var i = sel(col); qa('.iosp-item', col).forEach(function (el) { el.classList.toggle('sel', +el.dataset.i === i); }); }

  function col(el, items, ini, onSettle) {
    el.innerHTML = '<div class="iosp-pad"></div>' + items.map(function (t, i) { return '<div class="iosp-item" data-i="' + i + '">' + t + '</div>'; }).join('') + '<div class="iosp-pad"></div>';
    el.scrollTop = Math.max(0, ini) * H;
    marcar(el);
    var to = null;
    el.onscroll = function () {
      marcar(el);
      if (to) clearTimeout(to);
      to = setTimeout(function () { var i = sel(el); el.scrollTo({ top: i * H, behavior: 'smooth' }); if (onSettle) onSettle(i); }, 90);
    };
    qa('.iosp-item', el).forEach(function (it) {
      it.onclick = function () { var i = +it.dataset.i; el.scrollTop = i * H; marcar(el); if (onSettle) onSettle(i); };
    });
  }
  function diasArr(m) { var out = []; for (var d = 1; d <= diasMes(m, S.anio); d++) out.push(d); return out; }
  function rehacerDias(mesPos) {
    var m = S.meses[Math.min(mesPos, 11)];
    var cur = S.dias[Math.min(sel(q('#iosp-dia')), S.dias.length - 1)];
    S.dias = diasArr(m);
    col(q('#iosp-dia'), S.dias.map(String), Math.max(0, Math.min(S.dias.indexOf(cur) < 0 ? S.dias.length - 1 : S.dias.indexOf(cur), S.dias.length - 1)));
  }
  function empujar(id, d) {
    var el = q('#' + id); var n = qa('.iosp-item', el).length;
    var i = Math.min(Math.max(sel(el) + d, 0), n - 1);
    el.scrollTop = i * H; marcar(el);
    if (id === 'iosp-anio') { S.anio = S.anios[i]; rehacerDias(sel(q('#iosp-mes'))); }
    if (id === 'iosp-mes') rehacerDias(i);
  }

  window.abrirRueda = function (iso, onOk, opts) {
    opts = opts || {};
    var hoy = new Date(), d = null;
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (!d || isNaN(d.getTime())) d = hoy;
    var desde = opts.anioMin || (hoy.getFullYear() - 100), hasta = opts.anioMax || hoy.getFullYear();
    S.anios = []; for (var y = hasta; y >= desde; y--) S.anios.push(y);   // recientes arriba
    S.anio = Math.max(desde, Math.min(hasta, d.getFullYear()));
    S.meses = [0,1,2,3,4,5,6,7,8,9,10,11];
    var flechas = function (dir, s) {
      return '<div class="iosp-nav"><button type="button" class="iosp-arrow" data-col="iosp-dia" data-d="' + dir + '" aria-label="Día">' + s + '</button>' +
        '<button type="button" class="iosp-arrow" data-col="iosp-mes" data-d="' + dir + '" aria-label="Mes">' + s + '</button>' +
        '<button type="button" class="iosp-arrow" data-col="iosp-anio" data-d="' + dir + '" aria-label="Año">' + s + '</button></div>';
    };
    var ov = document.createElement('div');
    ov.className = 'iosp-overlay';
    ov.innerHTML = '<div class="iosp-card" role="dialog" aria-label="Elegir fecha"><div class="iosp-head">' +
      '<button type="button" class="iosp-btn" id="iosp-cancel">Cancelar</button><span class="iosp-year">' + (opts.titulo || 'Fecha') + '</span>' +
      '<button type="button" class="iosp-btn ok" id="iosp-ok">Listo</button></div>' + flechas(-1, '▲') +
      '<div class="iosp-wheels"><div class="iosp-highlight"></div><div class="iosp-col" id="iosp-dia"></div><div class="iosp-col" id="iosp-mes"></div><div class="iosp-col" id="iosp-anio"></div></div>' +
      flechas(1, '▼') + '</div>';
    document.body.appendChild(ov);   // visible ANTES de construir
    S.ov = ov;
    S.dias = diasArr(d.getMonth());
    col(q('#iosp-dia'), S.dias.map(String), d.getDate() - 1);
    col(q('#iosp-mes'), S.meses.map(function (x) { return cap(MESES[x]); }), d.getMonth(), rehacerDias);
    col(q('#iosp-anio'), S.anios.map(String), S.anios.indexOf(S.anio), function (pos) { S.anio = S.anios[pos]; rehacerDias(sel(q('#iosp-mes'))); });
    var cerrar = function () { document.removeEventListener('keydown', esc); ov.remove(); };
    var esc = function (e) { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', esc);
    ov.onclick = function (e) { if (e.target === ov) cerrar(); };
    q('#iosp-cancel').onclick = cerrar;
    qa('.iosp-arrow').forEach(function (b) { b.onclick = function () { empujar(b.dataset.col, +b.dataset.d); }; });
    q('#iosp-ok').onclick = function () {
      var mes = S.meses[Math.min(sel(q('#iosp-mes')), 11)];
      var dd = S.dias[Math.min(sel(q('#iosp-dia')), S.dias.length - 1)];
      var yy = S.anios[Math.min(sel(q('#iosp-anio')), S.anios.length - 1)];
      cerrar();
      var p = function (n) { return String(n).padStart(2, '0'); };
      if (onOk) onOk(yy + '-' + p(mes + 1) + '-' + p(dd), dd + ' de ' + MESES[mes] + ' de ' + yy);
    };
  };
})();
