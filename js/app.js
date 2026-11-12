/* ============================================================================
 * app.js — INSCRIPCIONES · Jhonny Perdomo (07/11/2026)
 * ----------------------------------------------------------------------------
 * Una sola web; cada formulario encendido vive en su propia dirección:
 *   #            → formularios abiertos
 *   #<slug>      → el formulario (independiente)
 *   #mis         → Mis inscripciones (documento + últimos 4 del WhatsApp)
 *
 * Rendimiento (regla 13):
 *   · La definición del formulario, la lista y las residencias se leen DIRECTO
 *     de Firebase (/publico, lectura pública, ~150 ms) y quedan guardadas en el
 *     teléfono: la segunda apertura pinta al instante. Respaldo: pub.formDef.
 *   · El cupo restante llega EN VIVO (EventSource a /meta/form_n/<id>).
 *   · Fotos y archivos suben DE FONDO apenas se eligen (las fotos se comprimen
 *     en el teléfono); al inscribirse solo viaja el ID del archivo.
 *   · Inscribirse: botón ocupado + escudo desde el primer toque y un rid que
 *     se conserva mientras la respuesta no llegue (un reintento nunca duplica).
 *   · Nada de datos personales en Firebase ni en la dirección.
 *   · 11/11/2026: «¿Vives en <municipio>?» Sí/No (obligatorio) antes de la
 *     residencia, solo si la definición trae vf (bandera del CORE: web y CORE
 *     se suben en cualquier orden). Con No se salta la residencia. La
 *     residencia se busca escribiendo (sin tildes, en el teléfono, sin viajes).
 * ============================================================================ */
(function () {
  'use strict';
  var M = window.MARCA || {};
  var API = M.API_URL;
  var FB = String((M.FIREBASE && M.FIREBASE.databaseURL) || M.FB_RTDB || '').replace(/\/+$/, '');
  var app = document.getElementById('app');
  var IMG_MAX = 1600, ARCH_MAX = 2 * 1024 * 1024;

  /* ---------------------------------------------------------- utilidades */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function lsGet(k, d) { try { var v = localStorage.getItem(nsKey(k)); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(nsKey(k), JSON.stringify(v)); } catch (e) {} }
  function soloDig(s) { return String(s || '').replace(/\D/g, ''); }
  function toast(t, mal) {
    var v = $('.toast'); if (v) v.remove();
    var d = document.createElement('div'); d.className = 'toast' + (mal ? ' mal' : ''); d.textContent = t;
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 4200);
  }
  var I = {
    form: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    reloj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>',
    subir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
    cal: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    bajar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>',
    compartir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>'
  };

  /* Dispositivo: un id al azar, propio de este teléfono (tope antiabuso) */
  var DISP = lsGet('disp', '');
  if (!DISP) { DISP = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); lsSet('disp', DISP); }

  /* --------------------------------------------------------- medición */
  var TIEMPOS = [];
  function medir(n, t0) { TIEMPOS.push({ n: n, ms: Math.round(performance.now() - t0) }); if (TIEMPOS.length > 60) TIEMPOS.shift(); }
  window.INS_TIEMPOS = function () { return { pantalla: TIEMPOS.slice(), red: window.RED ? RED.medidas() : [] }; };

  /* ------------------------------------------------------------- red */
  function rid() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  async function api(accion, cuerpo, op) {
    op = op || {};
    var json = await RED.pedir(API, accion, {}, { metodo: 'POST', cuerpo: cuerpo || {}, rid: op.rid, fondo: op.fondo });
    if (!json || !json.ok) throw new Error((json && (json.error || json.msg)) || 'Error del servidor');
    var d = json.data !== undefined ? json.data : json;
    if (d && d.ok === false) { var e = new Error(d.msg || 'No se pudo completar'); e.respuesta = d; e.servidor = true; throw e; }
    return d;
  }
  async function fb(ruta, ms) {
    if (!FB) throw new Error('sin firebase');
    var ctrl = new AbortController(), t = setTimeout(function () { ctrl.abort(); }, ms || 4000);
    try {
      var r = await fetch(FB + '/' + ruta + '.json', { cache: 'no-store', signal: ctrl.signal });
      if (!r.ok) throw new Error('fb ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  /* Residencias: Firebase → caché del teléfono → CORE */
  var RESI = lsGet('resi', null), resiProm = null;
  function residencias() {
    if (resiProm) return resiProm;
    resiProm = fb('publico/residencias').then(function (r) {
      if (!Array.isArray(r) || !r.length) throw new Error('vacío');
      RESI = r; lsSet('resi', r); return r;
    }).catch(function () {
      return api('pub.residencias', {}).then(function (d) { var r = Array.isArray(d) ? d : (d && (d.items || d.residencias)) || []; if (r.length) { RESI = r; lsSet('resi', r); } return r; });
    }).catch(function () { return RESI || []; });
    return resiProm;
  }

  /* ------------------------------------------------------------ rutas */
  var VIVO = null;            // EventSource del cupo
  var GEN = 0;                // vista vigente
  function cortarVivo() { if (VIVO) { try { VIVO.close(); } catch (e) {} VIVO = null; } }
  function ruta() {
    GEN++; cortarVivo();
    if (window.RED) RED.nuevaVista();
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, '')).trim();
    window.scrollTo(0, 0);
    if (!h) return vistaLista();
    if (h === 'mis') return vistaMis();
    var m = h.match(/^c\/(JF[A-Z0-9]{8})$/);
    if (m) return vistaComprobanteGuardado(m[1]);
    return vistaForm(h.toLowerCase());
  }
  window.addEventListener('hashchange', ruta);

  /* ============================================================ LISTA */
  function abiertoDef(d) { return d && d.estado === 'ENCENDIDO' && !(d.cierreMs && Date.now() > d.cierreMs); }
  function tarjeta(d) {
    return '<a class="card fcard" href="#' + esc(d.slug) + '"><div class="ph">' + (d.imagen ? '<img src="' + esc(d.imagen) + '" alt="" loading="lazy" />' : I.form) + '</div>' +
      '<div class="in"><b>' + esc(d.nombre) + '</b>' + (d.cierre ? '<span class="chip">Cierra ' + esc(fechaCorta(d.cierre)) + '</span>' : '<span class="chip">Inscripciones abiertas</span>') + '</div></a>';
  }
  function pintarLista(todos) {
    var abiertos = Object.keys(todos || {}).map(function (k) { return todos[k]; }).filter(abiertoDef);
    abiertos.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    $('#lista').innerHTML = abiertos.length ? abiertos.map(tarjeta).join('') :
      '<div class="vacio" style="grid-column:1/-1">' + I.form + '<b>No hay inscripciones abiertas</b><span>Cuando abramos una jornada, la verás aquí.</span></div>';
  }
  function vistaLista() {
    var t0 = performance.now(), g = GEN;
    document.title = 'Inscripciones · ' + (M.CANDIDATO || '');
    app.innerHTML = '<h1 class="h1">Inscripciones abiertas</h1><p class="lead">Elige la jornada o actividad e inscríbete en un minuto.</p><div class="lista" id="lista">' +
      '<div class="skel" style="height:200px"></div><div class="skel" style="height:200px"></div></div>';
    var guardado = lsGet('forms', null);
    if (guardado) { pintarLista(guardado); medir('lista (guardada)', t0); }
    fb('publico/formularios').then(function (todos) {
      if (g !== GEN) return;
      todos = todos || {};
      /* Solo lo liviano queda guardado para la lista */
      var lig = {};
      Object.keys(todos).forEach(function (k) { var d = todos[k] || {}; lig[k] = { id: d.id, slug: d.slug || k, nombre: d.nombre, imagen: d.imagen, estado: d.estado, cierre: d.cierre, cierreMs: d.cierreMs, ts: d.ts }; });
      lsSet('forms', lig); pintarLista(lig); medir('lista (red)', t0);
    }).catch(function () {
      if (g !== GEN || guardado) return;
      $('#lista').innerHTML = '<div class="vacio" style="grid-column:1/-1">' + I.info + '<b>No pudimos cargar la lista</b><span>Abre el enlace que te enviaron o intenta de nuevo.</span></div>';
    });
  }

  /* ======================================================= FORMULARIO */
  var F = null;   // estado del formulario abierto
  function fijos(menores) {
    var s = menores ? ' del adulto responsable del(la) menor' : '';
    return [
      { k: 'documento', t: 'Documento' + s, d: 'Número, 5 a 10 dígitos' },
      { k: 'nombre', t: 'Nombre completo' + s, d: 'Nombre y apellido' },
      { k: 'whatsapp', t: 'WhatsApp' + s, d: 'Celular de 10 dígitos' },
      { k: 'residencia', t: 'Residencia', d: 'Barrio, vereda o conjunto' }
    ];
  }
  async function cargarDef(slug) {
    var guard = lsGet('def:' + slug, null);
    var red = fb('publico/formularios/' + slug).then(function (d) {
      if (!d || !d.id) throw new Error('no está');
      d.slug = d.slug || slug; lsSet('def:' + slug, d); return d;
    }).catch(function () {
      return api('pub.formDef', { slug: slug }).then(function (r) { var d = r.def; if (d) lsSet('def:' + slug, d); return d; });
    });
    return { guard: guard, red: red };
  }
  function vistaForm(slug) {
    var t0 = performance.now(), g = GEN;
    app.innerHTML = '<div class="card"><div class="skel" style="height:160px;border-radius:0"></div><div style="padding:16px"><div class="skel" style="height:24px;width:70%"></div></div></div>';
    cargarDef(slug).then(function (c) {
      var pintada = '';
      if (c.guard && abiertoDef(c.guard)) { pintarForm(c.guard); pintada = JSON.stringify(c.guard.campos) + c.guard.estado; medir('form (guardado)', t0); }
      c.red.then(function (d) {
        if (g !== GEN) return;
        if (!d) return sinForm('Este formulario no existe.');
        if (!abiertoDef(d)) return cerrado(d);
        /* Solo se repinta si cambió algo de la estructura y aún no se ha escrito nada */
        if (pintada && pintada === JSON.stringify(d.campos) + d.estado) { F.def = d; return; }
        if (pintada && F && F.tocado) { F.def = d; return; }
        pintarForm(d); medir('form (red)', t0);
      }).catch(function (e) {
        if (g !== GEN || pintada) return;
        sinForm(e && e.servidor ? e.message : 'No pudimos abrir el formulario. Revisa tu conexión e intenta de nuevo.');
      });
    });
  }
  function sinForm(msg) {
    app.innerHTML = '<div class="vacio">' + I.info + '<b>' + esc(msg) + '</b><a class="btn btn-q" href="#">Ver inscripciones abiertas</a></div>';
  }
  function cerrado(d) {
    document.title = d.nombre || 'Inscripciones';
    app.innerHTML = '<div class="card cabeza">' + (d.imagen ? '<img src="' + esc(d.imagen) + '" alt="" />' : '') +
      '<div class="in"><h1 class="h1">' + esc(d.nombre) + '</h1><div class="aviso warn">' + I.reloj + '<div>Las inscripciones de este formulario ya cerraron.</div></div></div></div>' +
      '<p class="pie"><a href="#mis">Ver mis inscripciones</a> · <a href="#">Otras inscripciones</a></p>';
  }

  function campoHtml(c) {
    var req = c.req ? ' <span class="req">*</span>' : '';
    var ay = c.ayuda ? '<small>' + esc(c.ayuda) + '</small>' : '';
    var id = 'c_' + c.id, inp = '';
    if (c.tipo === 'texto') inp = c.largo ? '<textarea class="input" id="' + id + '" rows="3" maxlength="' + (c.maxLen || 5000) + '"></textarea>' : '<input class="input" id="' + id + '" maxlength="' + (c.maxLen || 500) + '" autocomplete="off" />';
    else if (c.tipo === 'numero') inp = '<input class="input" id="' + id + '" inputmode="' + (c.entero ? 'numeric' : 'decimal') + '" autocomplete="off" placeholder="' + (c.min != null || c.max != null ? 'Entre ' + (c.min != null ? c.min : '…') + ' y ' + (c.max != null ? c.max : '…') : '') + '" />';
    else if (c.tipo === 'unica' || c.tipo === 'multiple') {
      var t = c.tipo === 'unica' ? 'radio' : 'checkbox';
      inp = '<div class="ops">' + (c.opciones || []).map(function (o) { return '<label class="op"><input type="' + t + '" name="' + esc(c.id) + '" value="' + esc(o) + '" /><span>' + esc(o) + '</span></label>'; }).join('') + '</div>';
      if (c.tipo === 'multiple' && (c.minSel || c.maxSel)) ay += '<small>' + (c.minSel ? 'Marca al menos ' + c.minSel : '') + (c.minSel && c.maxSel ? ' · ' : '') + (c.maxSel ? 'máximo ' + c.maxSel : '') + '</small>';
    }
    else if (c.tipo === 'fecha') inp = '<button type="button" class="input fechabtn vacio" id="' + id + '" data-v=""><span>Selecciona la fecha</span>' + I.cal + '</button>';
    else if (c.tipo === 'imagen' || c.tipo === 'archivo') {
      var acc = c.tipo === 'imagen' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp';
      inp = '<label class="archivo" id="' + id + '">' + I.subir + '<div class="tx"><b>' + (c.tipo === 'imagen' ? 'Tomar o subir foto' : 'Subir archivo') + '</b><span>' + (c.tipo === 'imagen' ? 'JPG o PNG' : 'Máximo 2 MB') + '</span></div>' +
        '<input type="file" accept="' + acc + '" hidden /></label>';
    }
    return '<div class="campo" data-campo="' + esc(c.id) + '"><span class="et">' + esc(c.etiqueta) + req + '</span>' + ay + inp + '<div class="err"></div></div>';
  }

  function pintarForm(d) {
    document.title = d.nombre + ' · Inscripciones';
    F = { def: d, archivos: {}, subiendo: {}, rid: null, enviando: false, tocado: false, ya: false };
    var fj = fijos(d.menores);
    app.innerHTML =
      '<div class="card cabeza">' + (d.imagen ? '<img src="' + esc(d.imagen) + '" alt="" />' : '') +
      '<div class="in"><h1 class="h1">' + esc(d.nombre) + '</h1>' +
      '<div class="cupo" id="cupo">' + (d.cierre ? '<span>Cierra el <b>' + esc(fechaCorta(d.cierre)) + '</b></span>' : '') + '</div></div></div>' +
      (d.menores ? '<div class="aviso info" style="margin-top:12px">' + I.info + '<div>Este registro es para <b>menores de edad</b>. Primero van los datos del adulto responsable y luego los del niño o la niña.</div></div>' : '') +
      '<form class="frm" id="frm" novalidate autocomplete="off">' +
      '<div class="campo" data-fijo="documento"><label for="f_doc">' + esc(fj[0].t) + ' <span class="req">*</span></label><input class="input" id="f_doc" inputmode="numeric" maxlength="10" placeholder="' + esc(fj[0].d) + '" /><div id="ya-aviso"></div><div class="err"></div></div>' +
      '<div class="campo" data-fijo="nombre"><label for="f_nom">' + esc(fj[1].t) + ' <span class="req">*</span></label><input class="input" id="f_nom" maxlength="120" autocapitalize="characters" placeholder="' + esc(fj[1].d) + '" /><div class="err"></div></div>' +
      '<div class="campo" data-fijo="whatsapp"><label for="f_wa">' + esc(fj[2].t) + ' <span class="req">*</span></label><input class="input" id="f_wa" inputmode="numeric" maxlength="10" placeholder="' + esc(fj[2].d) + '" /><div class="err"></div></div>' +
      (d.vf ? '<div class="campo" data-fijo="vf"><span class="et">¿Vives en ' + esc(M.MUNICIPIO || 'Flandes') + '? <span class="req">*</span></span>' +
        '<div class="ops sino"><label class="op"><input type="radio" name="f_vf" value="SI" /><span>Sí</span></label><label class="op"><input type="radio" name="f_vf" value="NO" /><span>No</span></label></div><div class="err"></div></div>' : '') +
      '<div class="campo" data-fijo="residencia"' + (d.vf ? ' hidden' : '') + '><label for="f_resq">' + esc(fj[3].t) + ' <span class="req">*</span></label>' +
        '<div class="combo"><input class="input" id="f_resq" role="combobox" aria-expanded="false" aria-controls="f_resl" aria-autocomplete="list" autocomplete="off" placeholder="Escribe para buscar tu barrio, vereda o conjunto" />' +
        '<input type="hidden" id="f_res" value="" /><ul class="combo-l" id="f_resl" role="listbox" hidden></ul></div><div class="err"></div></div>' +
      (d.campos || []).map(campoHtml).join('') +
      '<div class="trampa" aria-hidden="true"><label>Sitio web<input type="text" id="f_hp" tabindex="-1" autocomplete="off" /></label></div>' +
      '<label class="card ley"><input type="checkbox" id="f_ley" /><span>Autorizo el tratamiento de mis datos personales' + (d.menores ? ' y los del(la) menor' : '') + ' conforme a la Ley 1581 de 2012, para gestionar esta inscripción y contactarme sobre ella. <span class="req">*</span></span></label>' +
      '<div id="f_err"></div>' +
      '<button type="submit" class="btn btn-p btn-b" id="f_btn">Inscribirme</button>' +
      '</form><p class="pie"><a href="#mis">Mis inscripciones</a> · ' + esc(M.CANDIDATO || '') + '</p>';

    residencias();        // si no estaba guardada llega de fondo; si estaba, se revalida para la próxima vez
    comboResi();

    var frm = $('#frm');
    ['#f_doc', '#f_wa'].forEach(function (s) { $(s).addEventListener('input', function (e) { e.target.value = soloDig(e.target.value).slice(0, 10); }); });
    $('#f_nom').addEventListener('input', function (e) { var p = e.target.selectionStart; e.target.value = e.target.value.toUpperCase(); try { e.target.setSelectionRange(p, p); } catch (x) {} });
    frm.addEventListener('input', function (e) { F.tocado = true; limpiarErr(e.target); condiciones(); });
    frm.addEventListener('change', function (e) {
      F.tocado = true; limpiarErr(e.target);
      if (e.target.name === 'f_vf') { var rc = $('[data-fijo="residencia"]', frm); rc.hidden = e.target.value !== 'SI'; if (!rc.hidden) setTimeout(function () { $('#f_resq').focus(); }, 30); }
      condiciones();
    });
    $('#f_doc').addEventListener('blur', revisarYa);
    $$('.fechabtn', frm).forEach(function (b) {
      var c = campoDe(b.id.slice(2));
      b.onclick = function () {
        var anMin = c.min ? +c.min.slice(0, 4) : null, anMax = c.max ? +c.max.slice(0, 4) : null;
        abrirRueda(b.dataset.v, function (iso, txt) {
          b.dataset.v = iso; b.classList.remove('vacio'); b.firstChild.textContent = txt; F.tocado = true; limpiarErr(b); condiciones();
        }, { anioMin: anMin || undefined, anioMax: anMax || (new Date().getFullYear() + 1), titulo: c.etiqueta.length < 28 ? c.etiqueta : 'Fecha' });
      };
    });
    $$('.archivo', frm).forEach(function (lab) {
      var inp = $('input[type=file]', lab);
      inp.onchange = function () { if (inp.files && inp.files[0]) subirArchivo(campoDe(lab.id.slice(2)), inp.files[0], lab); inp.value = ''; };
    });
    frm.addEventListener('submit', function (e) { e.preventDefault(); enviar(); });
    condiciones();
    cupoVivo(d);
  }
  function campoDe(id) { return (F.def.campos || []).filter(function (c) { return c.id === id; })[0]; }

  /* Residencia con buscador: se escribe y se filtra la lista (sin tildes ni
     mayúsculas). Solo vale lo que está en la lista: el valor real va en
     #f_res y se llena al elegir (o al escribir el nombre exacto). */
  function sinTilde(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
  function comboResi() {
    var q = $('#f_resq'), val = $('#f_res'), ul = $('#f_resl'); if (!q) return;
    var act = -1, vis = [];
    var cerrar = function () { ul.hidden = true; q.setAttribute('aria-expanded', 'false'); act = -1; };
    var elegir = function (t) { val.value = t; q.value = t; cerrar(); limpiarErr(q); F.tocado = true; };
    var pintar = function () {
      var lista = RESI || [], k = sinTilde(q.value);
      vis = (k ? lista.filter(function (r) { return sinTilde(r).indexOf(k) >= 0; }) : lista).slice(0, 60);
      if (k) vis.sort(function (a, b) { return (sinTilde(a).indexOf(k) === 0 ? 0 : 1) - (sinTilde(b).indexOf(k) === 0 ? 0 : 1); });
      act = vis.length ? 0 : -1;
      ul.innerHTML = vis.length ? vis.map(function (r, i) { return '<li role="option" data-i="' + i + '"' + (i === act ? ' class="act"' : '') + '>' + esc(r) + '</li>'; }).join('')
        : '<li class="nada">' + (lista.length ? 'No aparece. Revisa cómo lo escribiste.' : 'Cargando la lista…') + '</li>';
      ul.hidden = false; q.setAttribute('aria-expanded', 'true');
    };
    var marcar = function () { $$('li', ul).forEach(function (li) { li.classList.toggle('act', +li.dataset.i === act); }); var a = $('li.act', ul); if (a) a.scrollIntoView({ block: 'nearest' }); };
    q.addEventListener('focus', pintar);
    q.addEventListener('input', function () {
      var k = sinTilde(q.value), exacto = (RESI || []).filter(function (r) { return sinTilde(r) === k; })[0];
      val.value = exacto || '';
      pintar();
    });
    q.addEventListener('keydown', function (e) {
      if (ul.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); act = Math.min(act + 1, vis.length - 1); marcar(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(act - 1, 0); marcar(); }
      else if (e.key === 'Enter') { if (act >= 0 && vis[act]) { e.preventDefault(); elegir(vis[act]); } }
      else if (e.key === 'Escape') cerrar();
    });
    /* pointerdown (no click): elige antes de que el blur cierre la lista */
    ul.addEventListener('pointerdown', function (e) { var li = e.target.closest('li[data-i]'); if (!li) return; e.preventDefault(); elegir(vis[+li.dataset.i]); });
    q.addEventListener('blur', function () { setTimeout(cerrar, 120); });
    /* Si la lista llega después de pintar (primera vez), se refresca sola */
    if (!RESI) residencias().then(function () { if (document.activeElement === q) pintar(); });
  }
  function limpiarErr(el) { var c = el && el.closest && el.closest('.campo'); if (c) { c.classList.remove('mal'); var e = $('.err', c); if (e) e.textContent = ''; } var g = $('#f_err'); if (g) g.innerHTML = ''; }
  function marcarErr(cont, msg) { if (!cont) return; cont.classList.add('mal'); var e = $('.err', cont); if (e) e.textContent = msg; }

  /* Condiciones en cadena (mismo algoritmo que PRIV y que el backend) */
  function condiciones() {
    var vis = {}, frm = $('#frm'); if (!frm) return vis;
    (F.def.campos || []).forEach(function (c) {
      var ver = true;
      if (c.cond) {
        if (!vis[c.cond.campo]) ver = false;
        else {
          var marc = $$('[name="' + CSS.escape(c.cond.campo) + '"]:checked', frm).map(function (x) { return x.value; });
          ver = marc.some(function (v) { return (c.cond.valores || []).indexOf(v) >= 0; });
        }
      }
      vis[c.id] = ver;
      var el = $('[data-campo="' + CSS.escape(c.id) + '"]', frm);
      if (el) el.hidden = !ver;
    });
    return vis;
  }

  /* Cupo EN VIVO: /meta/form_n/<id> (solo un número, sin datos de nadie) */
  function cupoVivo(d) {
    var pintar = function (n) {
      var box = $('#cupo'); if (!box) return;
      var cierre = d.cierre ? '<span>Cierra el <b>' + esc(fechaCorta(d.cierre)) + '</b></span>' : '';
      if (!d.cupo) { box.innerHTML = cierre; return; }
      var quedan = Math.max(0, d.cupo - (n || 0));
      var pct = Math.min(100, Math.round((n || 0) * 100 / d.cupo));
      box.innerHTML = '<span class="vivo">EN VIVO</span>' + (quedan ? '<span>Quedan <b>' + quedan.toLocaleString('es-CO') + '</b> de ' + Number(d.cupo).toLocaleString('es-CO') + ' cupos</span>' :
        '<span><b>Cupo lleno.</b> Si te inscribes quedas en lista de espera.</span>') + cierre + '<div class="barra"><i style="width:' + pct + '%"></i></div>';
      F.lleno = !quedan;
      var b = $('#f_btn'); if (b && !F.enviando) b.textContent = quedan ? 'Inscribirme' : 'Inscribirme en lista de espera';
    };
    if (!d.cupo || !FB) { pintar(0); return; }
    pintar(lsGet('n:' + d.id, 0));
    var url = FB + '/meta/form_n/' + encodeURIComponent(d.id) + '.json';
    if (window.EventSource) {
      try {
        VIVO = new EventSource(url);
        var on = function (ev) { try { var m = JSON.parse(ev.data); if (m && m.path === '/') { var n = +m.data || 0; lsSet('n:' + d.id, n); pintar(n); } } catch (e) {} };
        VIVO.addEventListener('put', on); VIVO.addEventListener('patch', on);
        return;
      } catch (e) {}
    }
    fb('meta/form_n/' + d.id).then(function (n) { pintar(+n || 0); }).catch(function () {});
  }

  /* ¿Ya inscrito? (solo avisa; NUNCA llena nombre ni WhatsApp) */
  var yaUlt = '';
  function revisarYa() {
    var doc = soloDig($('#f_doc').value), box = $('#ya-aviso');
    if (!/^\d{5,10}$/.test(doc) || doc === yaUlt || F.def.varios) return;
    yaUlt = doc;
    var g = GEN;
    api('pub.formYa', { id: F.def.id, documento: doc, disp: DISP }, { fondo: true }).then(function (r) {
      if (g !== GEN || soloDig($('#f_doc').value) !== doc) return;
      F.ya = !!(r && r.ya);
      box.innerHTML = F.ya ? '<div class="aviso warn" style="margin-top:4px">' + I.info + '<div><b>Ya estás inscrito</b> en este formulario con ese documento. Busca tu comprobante en <a href="#mis">Mis inscripciones</a>.</div></div>' : '';
    }).catch(function () {});
  }

  /* --------------------------------------------- archivos (de fondo) */
  function comprimir(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, IMG_MAX / Math.max(w, h));
        var cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        var q = 0.82, out = cv.toDataURL('image/jpeg', q);
        while (out.length * 0.75 > 1.5 * 1024 * 1024 && q > 0.4) { q -= 0.12; out = cv.toDataURL('image/jpeg', q); }
        res(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('No pudimos leer la foto. Prueba con otra.')); };
      img.src = url;
    });
  }
  function leerDataUrl(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(new Error('No pudimos leer el archivo.')); }; r.readAsDataURL(file); });
  }
  function subirArchivo(c, file, lab) {
    var cont = lab.closest('.campo'); limpiarErr(lab); F.tocado = true;
    if (c.tipo === 'archivo' && file.size > ARCH_MAX) { marcarErr(cont, 'El archivo pasa de 2 MB.'); return; }
    if (c.tipo === 'imagen' && !/^image\//.test(file.type)) { marcarErr(cont, 'Elige una foto (JPG o PNG).'); return; }
    var tx = $('.tx', lab);
    lab.classList.remove('listo'); lab.classList.add('subiendo');
    tx.innerHTML = '<b>' + esc(file.name) + '</b><span>Subiendo…</span>';
    var vieja = $('img', lab); if (vieja) vieja.remove();
    delete F.archivos[c.id];
    var t0 = performance.now(), yo = {};
    F.subiendo[c.id] = yo;
    var p = (c.tipo === 'imagen' ? comprimir(file) : leerDataUrl(file)).then(function (dataUrl) {
      if (c.tipo === 'imagen') { var im = new Image(); im.src = dataUrl; im.alt = ''; lab.insertBefore(im, tx); }
      var nombre = c.tipo === 'imagen' ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;
      return api('pub.formArchivo', { id: F.def.id, campo: c.id, dataUrl: dataUrl, nombre: nombre, disp: DISP });
    }).then(function (r) {
      if (F.subiendo[c.id] !== yo) return;
      F.archivos[c.id] = r.fid;
      lab.classList.remove('subiendo'); lab.classList.add('listo');
      tx.innerHTML = '<b>' + esc(r.nombre || file.name) + '</b><span>Listo · ' + r.kb + ' KB · toca para cambiarlo</span>';
      medir('archivo ' + c.id, t0);
    }).catch(function (e) {
      if (F.subiendo[c.id] !== yo) return;
      lab.classList.remove('subiendo');
      tx.innerHTML = '<b>' + (c.tipo === 'imagen' ? 'Tomar o subir foto' : 'Subir archivo') + '</b><span>Toca para intentar de nuevo</span>';
      var im = $('img', lab); if (im) im.remove();
      marcarErr(cont, e.message || 'No se pudo subir. Intenta de nuevo.');
    }).finally(function () { if (F.subiendo[c.id] === yo) delete F.subiendo[c.id]; });
    yo.p = p;
  }

  /* ---------------------------------------------------- validar y enviar */
  function leer() {
    var vis = condiciones(), frm = $('#frm'), resp = {}, arch = {}, errs = [];
    var doc = soloDig($('#f_doc').value), nom = $('#f_nom').value.replace(/\s+/g, ' ').trim().toUpperCase(), wa = soloDig($('#f_wa').value), res = $('#f_res').value;
    var vfEl = $('[name="f_vf"]:checked', frm), vf = F.def.vf ? (vfEl ? vfEl.value : '') : '';
    if (vf === 'NO') res = '';
    var fc = function (k) { return $('[data-fijo="' + k + '"]', frm); };
    if (!/^\d{5,10}$/.test(doc)) errs.push([fc('documento'), 'El documento debe tener de 5 a 10 dígitos.']);
    if (nom.split(' ').length < 2) errs.push([fc('nombre'), 'Escribe el nombre completo (nombre y apellido).']);
    if (!/^3\d{9}$/.test(wa)) errs.push([fc('whatsapp'), 'Escribe un celular de 10 dígitos que empiece por 3.']);
    if (F.def.vf && !vf) errs.push([fc('vf'), 'Cuéntanos si vives en ' + (M.MUNICIPIO || 'Flandes') + '.']);
    else if (vf !== 'NO' && !res) errs.push([fc('residencia'), $('#f_resq').value.trim() ? 'Elige tu barrio, vereda o conjunto de la lista.' : 'Escribe y elige tu barrio, vereda o conjunto.']);
    (F.def.campos || []).forEach(function (c) {
      if (!vis[c.id]) return;
      var cont = $('[data-campo="' + CSS.escape(c.id) + '"]', frm), el = $('#c_' + c.id, frm), v;
      if (c.tipo === 'texto') { v = el.value.trim(); if (!v) { if (c.req) errs.push([cont, 'Esta pregunta es obligatoria.']); return; } if (c.minLen && v.length < c.minLen) errs.push([cont, 'Mínimo ' + c.minLen + ' caracteres.']); resp[c.id] = v; }
      else if (c.tipo === 'numero') {
        v = el.value.trim(); if (!v) { if (c.req) errs.push([cont, 'Esta pregunta es obligatoria.']); return; }
        var n = Number(v.replace(',', '.'));
        if (!isFinite(n)) errs.push([cont, 'Escribe un número.']);
        else if (c.entero && Math.floor(n) !== n) errs.push([cont, 'Debe ser un número entero.']);
        else if (c.min != null && n < c.min) errs.push([cont, 'El mínimo es ' + c.min + '.']);
        else if (c.max != null && n > c.max) errs.push([cont, 'El máximo es ' + c.max + '.']);
        resp[c.id] = v;
      }
      else if (c.tipo === 'unica') { var u = $('[name="' + CSS.escape(c.id) + '"]:checked', frm); if (!u) { if (c.req) errs.push([cont, 'Elige una opción.']); return; } resp[c.id] = u.value; }
      else if (c.tipo === 'multiple') {
        var arr = $$('[name="' + CSS.escape(c.id) + '"]:checked', frm).map(function (x) { return x.value; });
        if (!arr.length) { if (c.req) errs.push([cont, 'Marca al menos una opción.']); return; }
        if (c.minSel && arr.length < c.minSel) errs.push([cont, 'Marca al menos ' + c.minSel + '.']);
        if (c.maxSel && arr.length > c.maxSel) errs.push([cont, 'Marca máximo ' + c.maxSel + '.']);
        resp[c.id] = arr;
      }
      else if (c.tipo === 'fecha') {
        v = el.dataset.v; if (!v) { if (c.req) errs.push([cont, 'Elige la fecha.']); return; }
        if (c.min && v < c.min) errs.push([cont, 'La fecha es anterior a la permitida.']);
        if (c.max && v > c.max) errs.push([cont, 'La fecha es posterior a la permitida.']);
        resp[c.id] = v;
      }
      else if (c.tipo === 'imagen' || c.tipo === 'archivo') {
        if (F.archivos[c.id]) arch[c.id] = F.archivos[c.id];
        else if (!F.subiendo[c.id] && c.req) errs.push([cont, 'Adjunta ' + (c.tipo === 'imagen' ? 'la foto.' : 'el archivo.')]);
      }
    });
    if (!$('#f_ley').checked) errs.push([$('.ley', frm), 'Debes autorizar el tratamiento de datos para inscribirte.']);
    return { errs: errs, cuerpo: { id: F.def.id, documento: doc, nombre: nom, whatsapp: wa, residencia: res, vf: vf || undefined, respuestas: resp, archivos: arch, autoriza: $('#f_ley').checked, hp: $('#f_hp').value, disp: DISP } };
  }
  function errGeneral(msg) { var g = $('#f_err'); if (g) g.innerHTML = '<div class="aviso mal">' + I.info + '<div>' + esc(msg) + '</div></div>'; }
  async function enviar() {
    if (F.enviando) return;                       // escudo: un solo envío
    var btn = $('#f_btn');
    F.enviando = true; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Enviando…';
    var t0 = performance.now(), g = GEN, def = F.def;
    var listo = function () { F.enviando = false; if (btn.isConnected) { btn.disabled = false; btn.textContent = F.lleno ? 'Inscribirme en lista de espera' : 'Inscribirme'; } };
    try {
      /* Si hay archivos subiendo, se esperan (no se reenvían) */
      var pend = Object.keys(F.subiendo).map(function (k) { return F.subiendo[k].p; });
      if (pend.length) { btn.innerHTML = '<span class="spin"></span> Terminando de subir…'; await Promise.all(pend.map(function (p) { return p.catch(function () {}); })); btn.innerHTML = '<span class="spin"></span> Enviando…'; }
      var l = leer();
      if (l.errs.length) {
        l.errs.forEach(function (e) { marcarErr(e[0], e[1]); });
        var pri = l.errs[0][0]; if (pri) pri.scrollIntoView({ behavior: 'smooth', block: 'center' });
        errGeneral(l.errs.length === 1 ? 'Revisa el campo marcado.' : 'Revisa los ' + l.errs.length + ' campos marcados.');
        return listo();
      }
      if (!F.rid) F.rid = rid();                  // el mismo rid hasta que el servidor conteste
      var r = await api('pub.formInscribir', l.cuerpo, { rid: F.rid });
      F.rid = null;
      if (g !== GEN) return;
      medir('inscribir', t0);
      var comp = { codigo: r.codigo, estado: r.estado, posicion: r.posicion, fecha: r.fecha, nombre: r.nombre || l.cuerpo.nombre, documento: l.cuerpo.documento,
                   form: { nombre: def.nombre, slug: def.slug, imagen: def.imagen } };
      if (!r.trampa) guardarComp(comp);
      F.enviando = false;
      vistaComprobante(comp, true);
    } catch (e) {
      if (e && e.servidor) F.rid = null;          // el servidor contestó: nada quedó escrito
      if (g !== GEN) return;
      if (e && e.respuesta && e.respuesta.ya) {
        $('#ya-aviso').innerHTML = '<div class="aviso warn" style="margin-top:4px">' + I.info + '<div><b>Ya estás inscrito</b> en este formulario. Busca tu comprobante en <a href="#mis">Mis inscripciones</a>.</div></div>';
        marcarErr($('[data-fijo="documento"]'), '');
        $('[data-fijo="documento"]').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      errGeneral(e && e.servidor ? e.message : 'No hay conexión. Toca "Inscribirme" otra vez: no se duplicará tu inscripción.');
      listo();
    }
  }

  /* ======================================================= COMPROBANTE */
  function guardarComp(c) {
    var l = lsGet('comps', []).filter(function (x) { return x.codigo !== c.codigo; });
    l.unshift(c); lsSet('comps', l.slice(0, 30));
  }
  function qrSvg(texto) {
    var q = qrcode(0, 'M'); q.addData(texto); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }
  function qrMatriz(texto) { var q = qrcode(0, 'M'); q.addData(texto); q.make(); return q; }
  function vistaComprobanteGuardado(codigo) {
    var c = lsGet('comps', []).filter(function (x) { return x.codigo === codigo; })[0];
    if (!c) { location.hash = '#mis'; return; }
    vistaComprobante(c, false);
  }
  function vistaComprobante(c, nuevo) {
    var espera = c.estado === 'ESPERA';
    if (nuevo && location.hash !== '#c/' + c.codigo) { history.replaceState(null, '', '#c/' + c.codigo); }
    document.title = 'Comprobante ' + c.codigo;
    app.innerHTML = '<div class="card comp">' +
      '<div class="ok' + (espera ? ' espera' : '') + '">' + (espera ? I.reloj : I.ok) + '</div>' +
      '<h2>' + (espera ? 'Quedaste en lista de espera' : (nuevo ? '¡Inscripción lista!' : 'Tu comprobante')) + '</h2>' +
      '<div class="datos"><b>' + esc(c.form.nombre) + '</b><br>' + esc(c.nombre) + (c.documento ? ' · Doc. ' + esc(enmascarar(c.documento)) : '') + '</div>' +
      (espera && c.posicion ? '<div class="chip">Posición ' + c.posicion + ' en la lista de espera</div>' : '') +
      '<div class="qr">' + qrSvg(c.codigo) + '</div><div class="codigo">' + esc(c.codigo) + '</div>' +
      '<div class="datos">Muestra este QR el día de la jornada.' + (c.fecha ? '<br>Inscrito el ' + esc(fechaLarga(c.fecha)) : '') + '</div>' +
      '<div class="acciones"><button class="btn btn-q" id="b-png">' + I.bajar + ' Descargar</button><button class="btn btn-wa" id="b-wa">' + I.wa + ' WhatsApp</button></div>' +
      (navigator.share ? '<button class="btn btn-q btn-b" id="b-sh" style="max-width:420px">' + I.compartir + ' Compartir imagen</button>' : '') +
      '</div><p class="pie"><a href="#mis">Mis inscripciones</a> · <a href="#">Otras inscripciones</a></p>';
    $('#b-png').onclick = function () { imagenComp(c).then(function (blob) { descargar(blob, 'comprobante-' + c.codigo + '.png'); }).catch(function () { toast('No se pudo crear la imagen', true); }); };
    $('#b-wa').onclick = function () {
      var url = location.origin + location.pathname + '#mis';
      var txt = 'Mi comprobante de inscripción a *' + c.form.nombre + '*\nCódigo: *' + c.codigo + '*' + (espera ? ' (lista de espera)' : '') + '\nConsúltalo aquí: ' + url;
      window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
    };
    var sh = $('#b-sh');
    if (sh) sh.onclick = function () {
      imagenComp(c).then(function (blob) {
        var f = new File([blob], 'comprobante-' + c.codigo + '.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: 'Comprobante ' + c.codigo, text: c.form.nombre + ' · ' + c.codigo });
        descargar(blob, f.name);
      }).catch(function (e) { if (!e || e.name !== 'AbortError') toast('No se pudo compartir', true); });
    };
  }
  function enmascarar(doc) { doc = String(doc); return doc.length > 4 ? '•••' + doc.slice(-4) : doc; }
  function descargar(blob, nombre) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  /* Imagen PNG del comprobante (todo en el teléfono, sin viajes) */
  function imagenComp(c) {
    return new Promise(function (res, rej) {
      var W = 720, H = 1040, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var x = cv.getContext('2d'), azul = M.COLOR || '#007BFF', espera = c.estado === 'ESPERA';
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      var gr = x.createLinearGradient(0, 0, W, 170); gr.addColorStop(0, azul); gr.addColorStop(1, '#0056B3');
      x.fillStyle = gr; x.fillRect(0, 0, W, 170);
      var logo = new Image();
      var seguir = function () {
        try { if (logo.complete && logo.naturalWidth) { x.save(); redondo(x, 40, 45, 80, 80, 18); x.clip(); x.drawImage(logo, 40, 45, 80, 80); x.restore(); } } catch (e) {}
        x.fillStyle = '#fff'; x.font = '800 30px Sora, system-ui, sans-serif'; x.fillText('Comprobante de inscripción', 140, 82);
        x.font = '500 22px system-ui, sans-serif'; x.fillText(M.CANDIDATO || '', 140, 116);
        x.fillStyle = '#14223B'; x.textAlign = 'center';
        x.font = '800 32px Sora, system-ui, sans-serif'; lineas(x, c.form.nombre, W / 2, 238, W - 100, 40, 2);
        x.font = '600 24px system-ui, sans-serif'; x.fillStyle = '#5B6B84'; x.fillText(c.nombre, W / 2, 330);
        if (espera) { x.fillStyle = '#B45309'; x.font = '800 22px system-ui, sans-serif'; x.fillText('LISTA DE ESPERA' + (c.posicion ? ' · POSICIÓN ' + c.posicion : ''), W / 2, 366); }
        var q = qrMatriz(c.codigo), n = q.getModuleCount(), lado = 440, cel = Math.floor(lado / (n + 4)), real = cel * (n + 4), ox = (W - real) / 2, oy = 390;
        x.fillStyle = '#fff'; x.fillRect(ox, oy, real, real); x.fillStyle = '#000';
        for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(ox + (k + 2) * cel, oy + (r + 2) * cel, cel, cel);
        x.fillStyle = '#14223B'; x.font = '800 40px Sora, system-ui, monospace'; x.fillText(c.codigo.split('').join(' '), W / 2, oy + real + 62);
        x.fillStyle = '#5B6B84'; x.font = '500 22px system-ui, sans-serif';
        x.fillText('Muestra este QR el día de la jornada', W / 2, oy + real + 108);
        if (c.fecha) x.fillText('Inscrito el ' + fechaLarga(c.fecha), W / 2, oy + real + 142);
        cv.toBlob(function (b) { b ? res(b) : rej(new Error('png')); }, 'image/png');
      };
      logo.onload = seguir; logo.onerror = seguir; logo.src = 'img/logo-192.png';
    });
  }
  function redondo(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function lineas(x, t, cx, y, ancho, alto, max) {
    var pal = String(t).split(' '), l = '', n = 0;
    for (var i = 0; i < pal.length; i++) {
      var p = l ? l + ' ' + pal[i] : pal[i];
      if (x.measureText(p).width > ancho && l) { x.fillText(l, cx, y + n * alto); n++; l = pal[i]; if (n >= max - 1) { l = pal.slice(i).join(' '); break; } }
      else l = p;
    }
    x.fillText(l.length > 40 ? l.slice(0, 38) + '…' : l, cx, y + n * alto);
  }

  /* ================================================== MIS INSCRIPCIONES */
  function filaMia(c, local) {
    var est = c.asistio ? 'ASISTIO' : c.estado;
    var et = { INSCRITO: 'Inscrito', ESPERA: 'Lista de espera', ASISTIO: 'Asistió' }[est] || est;
    return '<a class="card mia" href="#c/' + esc(c.codigo) + '" data-cod="' + esc(c.codigo) + '">' +
      (c.form.imagen ? '<img src="' + esc(c.form.imagen) + '" alt="" loading="lazy" />' : '<div class="ph">' + I.form + '</div>') +
      '<div class="tx"><b>' + esc(c.form.nombre) + '</b><span>' + esc(c.codigo) + (c.fecha ? ' · ' + esc(fechaCorta(c.fecha)) : '') + '</span><span class="est est-' + esc(est) + '">' + esc(et) + '</span></div></a>';
  }
  function vistaMis() {
    document.title = 'Mis inscripciones';
    var locales = lsGet('comps', []);
    app.innerHTML = '<h1 class="h1">Mis inscripciones</h1><p class="lead">Consulta tus comprobantes con tu documento y los últimos 4 dígitos de tu WhatsApp.</p>' +
      '<form class="card frm" id="mis-frm" style="padding:14px;margin-top:0" novalidate>' +
      '<div class="campo" style="border:0;padding:0"><label for="m_doc">Documento</label><input class="input" id="m_doc" inputmode="numeric" maxlength="10" placeholder="Número de documento" /></div>' +
      '<div class="campo" style="border:0;padding:0"><label for="m_u4">Últimos 4 dígitos de tu WhatsApp</label><input class="input" id="m_u4" inputmode="numeric" maxlength="4" placeholder="••••" /></div>' +
      '<div id="m_err"></div><button class="btn btn-p btn-b" id="m_btn">Consultar</button></form>' +
      '<div id="mis-res" style="display:grid;gap:10px;margin-top:16px">' +
      (locales.length ? '<p class="lead" style="margin:0">Guardadas en este teléfono</p>' + locales.map(function (c) { return filaMia(c, true); }).join('') : '') + '</div>';
    ['#m_doc', '#m_u4'].forEach(function (s) { $(s).addEventListener('input', function (e) { e.target.value = soloDig(e.target.value); $('#m_err').innerHTML = ''; }); });
    var ocupado = false;
    $('#mis-frm').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (ocupado) return;
      var doc = soloDig($('#m_doc').value), u4 = soloDig($('#m_u4').value), err = $('#m_err');
      if (!/^\d{5,10}$/.test(doc) || !/^\d{4}$/.test(u4)) { err.innerHTML = '<div class="aviso mal">' + I.info + '<div>Escribe tu documento y los 4 últimos dígitos de tu WhatsApp.</div></div>'; return; }
      var b = $('#m_btn'), g = GEN, t0 = performance.now(); ocupado = true; b.disabled = true; b.innerHTML = '<span class="spin"></span> Consultando…';
      try {
        var r = await api('pub.formMias', { documento: doc, ult4: u4, disp: DISP });
        if (g !== GEN) return;
        medir('mis', t0);
        var items = (r.items || []).map(function (it) { var c = { codigo: it.codigo, estado: it.estado, asistio: it.asistio, fecha: it.fecha, nombre: it.nombre, documento: doc, form: it.form }; guardarComp(c); return c; });
        $('#mis-res').innerHTML = items.length ? items.map(function (c) { return filaMia(c); }).join('') :
          '<div class="vacio">' + I.form + '<b>No encontramos inscripciones</b><span>Revisa el documento y los 4 dígitos del WhatsApp con el que te inscribiste.</span></div>';
      } catch (x) {
        if (g !== GEN) return;
        err.innerHTML = '<div class="aviso mal">' + I.info + '<div>' + esc(x.servidor ? x.message : 'No hay conexión. Intenta de nuevo.') + '</div></div>';
      } finally { ocupado = false; if (b.isConnected) { b.disabled = false; b.textContent = 'Consultar'; } }
    });
  }

  /* ---------------------------------------------------------- fechas */
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var MESESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function partes(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/); return m ? { a: +m[1], m: +m[2] - 1, d: +m[3], h: m[4] != null ? +m[4] : null, mi: +m[5] || 0 } : null; }
  function hora(p) { if (p.h == null) return ''; var h = p.h % 12 || 12; return ' · ' + h + ':' + String(p.mi).padStart(2, '0') + (p.h < 12 ? ' a. m.' : ' p. m.'); }
  function fechaCorta(s) { var p = partes(s); return p ? p.d + ' ' + MESES[p.m] + (p.a !== new Date().getFullYear() ? ' ' + p.a : '') + hora(p) : String(s || ''); }
  function fechaLarga(s) { var p = partes(s); return p ? p.d + ' de ' + MESESL[p.m] + ' de ' + p.a + hora(p) : String(s || ''); }

  /* ------------------------------------------- versión y service worker
     Modo fresco (regla 17): SW con updateViaCache 'none' + update() al
     cargar; cuando uno nuevo toma el control se recarga UNA vez por versión
     (freno en sessionStorage). version.js siempre de la red. */
  var verEnVuelo = false;
  async function recargarVersion(v) {
    try { var k = nsKey('recarga_' + v); if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) {}
    if (F && F.tocado && !F.enviando && $('#frm')) return;   // no se pierde lo escrito: entra en la próxima apertura
    try {
      var c = navigator.serviceWorker && navigator.serviceWorker.controller;
      if (c) await new Promise(function (res) { var ch = new MessageChannel(); ch.port1.onmessage = function () { res(); }; c.postMessage({ tipo: 'version', v: v }, [ch.port2]); setTimeout(res, 1500); });
      else { var ks = await caches.keys(); await Promise.all(ks.filter(nsCacheMia).map(function (k) { return caches.delete(k); })); }
    } catch (e) {}
    location.reload();
  }
  async function revisarVersion() {
    if (verEnVuelo) return; verEnVuelo = true;
    try {
      var r = await fetch('./js/version.js?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      var m = (await r.text()).match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
      if (m && window.APP_VERSION && m[1] !== window.APP_VERSION) recargarVersion(m[1]);
    } catch (e) {} finally { verEnVuelo = false; }
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) revisarVersion(); });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) { try { reg.update(); } catch (e) {} }).catch(function () {});
    });
    var habiaControl = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!habiaControl) { habiaControl = true; return; }   // primera instalación: no recarga
      recargarVersion(window.APP_VERSION + '+sw');
    });
  }
  /* El backend nuevo desplegado no recarga encima de un formulario a medio llenar */
  window.RED_NO_RECARGAR = function () { return !!(F && F.tocado && $('#frm')); };

  /* ------------------------------------------------------------ inicio */
  ruta();
  setTimeout(revisarVersion, 1200);
})();
