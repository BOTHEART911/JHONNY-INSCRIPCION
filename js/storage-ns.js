/* ============================================================
   storage-ns.js — INSCRIPCIONES · prefijo de almacenamiento
   Todas las apps de la campaña viven en el mismo origen
   (botheart911.github.io): sin prefijo se pisarían. El prefijo
   sale de marca.js (MARCA.STORAGE_NS); aquí no se edita nada.
   ============================================================ */
(function (raiz) {
  'use strict';
  var STORAGE_NS = (raiz.MARCA && raiz.MARCA.STORAGE_NS) || 'jp';
  var CACHE_SLUG = 'ins';
  raiz.STORAGE_NS = STORAGE_NS;
  raiz.CACHE_SLUG = CACHE_SLUG;
  raiz.nsKey = function (base) { return STORAGE_NS + ':ins:' + base; };
  raiz.nsCachePrefijo = function () { return STORAGE_NS + '-' + CACHE_SLUG + '-'; };
  raiz.nsCacheMia = function (k) { return String(k).indexOf(STORAGE_NS + '-' + CACHE_SLUG + '-') === 0; };
})(typeof self !== 'undefined' ? self : this);
