(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return document.querySelectorAll(s); };
  var fmt = function (n) { return Math.round(n).toLocaleString('ru-RU'); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  var isCatalog = document.body.classList.contains('page-catalog');

  /* ---------- язык ---------- */
  var lang = store.get('tms-lang') === 'uz' ? 'uz' : 'ru';
  var t = function (k) { var v = I18N[lang][k]; return v === undefined ? ('[' + k + ']') : v; };
  var tf = function (k, vars) { return t(k).replace(/\{(\w+)\}/g, function (_, n) { return vars[n]; }); };
  // русское склонение «позиция»: 1 позиция, 2–4 позиции, 5+ позиций
  var posWord = function (n) { var a = n % 10, b = n % 100; return (a === 1 && b !== 11) ? 'позиция' : (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? 'позиции' : 'позиций'; };
  var tfn = function (k, n, extra) { var s = tf(k, Object.assign({ n: n }, extra || {})); return lang === 'ru' ? s.replace(/(\d+) позиций/, function (_, d) { return d + ' ' + posWord(+d); }) : s; };

  function applyStatic() {
    document.documentElement.lang = lang;
    document.title = t(isCatalog ? 'cat_title' : 'title');
    $('meta[name=description]').setAttribute('content', t('desc'));
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    // заголовок по строкам: каждая строка в своей маске для поочерёдного появления
    $$('[data-i18n-lines]').forEach(function (el) {
      el.innerHTML = t(el.dataset.i18nLines).split('\n').map(function (l) { return '<span class="hero__line"><span>' + esc(l) + ' </span></span>'; }).join('');
    });
    $$('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.dataset.i18nPh); });
    $$('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    $$('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.lang === lang); });
  }
  function renderAll() {
    applyStatic();
    if ($('#cats')) renderCats();
    if ($('#topRows')) { renderTop(); var ts = $('[data-i18n=top_sub]'); if (ts) ts.textContent = tfn('top_sub', PRODUCTS.length - TOP_IDS.length); }
    if (isCatalog) { renderCatbar(); renderTypeSel(); renderRows(); renderHead(); }
    renderPicked();
    if ($('#calcForm')) buildFields();
  }
  function setLang(l) { lang = l; store.set('tms-lang', l); clearErrors(); renderAll(); }
  $$('.lang').forEach(function (g) {
    g.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (b && b.dataset.lang !== lang) setLang(b.dataset.lang);
    });
  });

  /* ---------- первый экран: вступление, параллакс, пауза вне экрана ---------- */
  var hero = $('#hero');
  if (hero) {
    var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    // после вступления смена языка не проигрывает анимацию заново
    setTimeout(function () { hero.classList.add('hero--done'); }, calm.matches ? 0 : 3200);
    // фон не анимируется, пока первый экран не виден
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { hero.classList.toggle('hero--paused', !e[0].isIntersecting); }).observe(hero);
    }
    // лёгкий параллакс только для мыши; на сенсорных экранах выключен
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !calm.matches) {
      var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
      var step = function () {
        cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
        hero.style.setProperty('--px', cx.toFixed(4)); hero.style.setProperty('--py', cy.toFixed(4));
        raf = (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) ? requestAnimationFrame(step) : 0;
      };
      var kick = function () { if (!raf) raf = requestAnimationFrame(step); };
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width * 2 - 1; ty = (e.clientY - r.top) / r.height * 2 - 1; kick();
      });
      hero.addEventListener('pointerleave', function () { tx = 0; ty = 0; kick(); });
    }
  }

  /* ---------- меню ---------- */
  var burger = $('#burger'), nav = $('#nav');
  function closeNav() { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('nav-open'); }
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open'); burger.setAttribute('aria-expanded', open); document.body.classList.toggle('nav-open', open);
    // слой меню начинается сразу под красной полосой, где бы она сейчас ни была
    var bar = $('.brandbar'); if (open && bar) nav.style.top = Math.max(0, bar.getBoundingClientRect().bottom) + 'px';
  });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') closeNav(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });
  $('#year').textContent = new Date().getFullYear();

  /* ---------- названия позиций ---------- */
  var LAT = { 'А': 'A', 'С': 'S', 'Г': 'G', 'О': 'O', 'Т': 'T', 'Б': 'B', 'П': 'P', 'п': 'p', 'с': 's', 'т': 't' };
  var tname = function (p) { return TYPES[p.type][lang]; };
  var pspec = function (p) { return p.spec.replace(/ мм$/, lang === 'uz' ? ' mm' : ' мм'); };
  var pname = function (p) { return tname(p) + ' ' + pspec(p) + ((p.wu === 'sheet' || p.wu === 'roll') ? ' · ' + plen(p) : ''); };
  var psteel = function (p) {
    if (lang !== 'uz') return p.steel;
    return p.steel.replace('оцинк.', 'sink.').replace(/[АСГОТБПпст]/g, function (c) { return LAT[c]; });
  };
  var plen = function (p) {
    if (p.wu === 'coil') return t('coil');
    if (p.wu === 'roll') return tf('roll_w', { w: p.len.replace(/\D*([\d,]+).*/, '$1') });
    return p.len + ' ' + t('unit_m');
  };
  var pweight = function (p) {
    if (p.w == null) return '—';
    var v = p.w >= 1000 ? (p.w / 1000).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + ' ' + t('t')
                        : (Math.round(p.w * 100) / 100).toString().replace('.', ',') + ' ' + t('kg');
    return v + t('per_' + p.wu);
  };
  var money = function (n) { return fmt(n) + ' ' + t('cur'); };
  var byId = function (id) { return PRODUCTS.filter(function (p) { return p.id == id; })[0]; };
  var inCat = function (c) { return PRODUCTS.filter(function (p) { return c === 'all' || p.cat === c; }); };

  // Контурные сечения проката: одна толщина линии, одна сетка 48×48
  var ICONS = {
    rebar:  '<circle cx="24" cy="24" r="10"/><path d="M24 10v4M24 34v4M10 24h4M34 24h4M14 14l3 3M31 31l3 3M34 14l-3 3M17 31l-3 3"/>',
    pipe:   '<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="9"/>',
    sheet:  '<path d="M6 26l22-10 14 6-22 10z"/><path d="M6 26v5l14 6v-5M42 22v5l-22 10"/>',
    beam:   '<path d="M10 10h28v6H27v16h11v6H10v-6h11V16H10z"/>',
    angle:  '<path d="M12 8h7v21h17v7H12z"/>',
  };

  /* ---------- главная: плитки категорий ---------- */
  function renderCats() {
    var html = CATEGORIES.map(function (c) {
      var list = inCat(c), min = Math.min.apply(null, list.map(function (p) { return p.pt; }));
      return '<li><a class="catcard" href="catalog.html?cat=' + c + '">' +
        '<span class="catcard__top"><span class="catcard__kind">' + t('kind_' + c) + '</span><span class="catcard__arr" aria-hidden="true">↗</span></span>' +
        '<svg viewBox="0 0 48 48" aria-hidden="true">' + ICONS[c] + '</svg>' +
        '<span class="catcard__name">' + t('cat_' + c) + '</span>' +
        '<span class="catcard__meta"><span>' + tfn('pos_n', list.length) + '</span><span>' + tf('from_price', { p: fmt(min) }) + '</span></span>' +
        '</a></li>';
    }).join('');
    html += '<li><a class="catcard catcard--all" href="catalog.html">' +
      '<span class="catcard__big">' + t('all_card_n') + '</span>' +
      '<span class="catcard__meta">' + tfn('all_card_sub', PRODUCTS.length) + '</span>' +
      '<span class="catcard__btn">' + tfn('all_card_btn', PRODUCTS.length) + ' →</span></a></li>';
    $('#cats').innerHTML = html;
  }

  /* ---------- главная: топ позиции (id из прайса) ---------- */
  var TOP_IDS = [2, 4, 85, 169, 158, 33, 116, 105];
  function renderTop() {
    var picked = getPicked();
    $('#topRows').innerHTML = TOP_IDS.map(byId).filter(Boolean).map(function (p) {
      var on = !!picked[p.id];
      return '<tr><td class="name"><b>' + esc(tname(p)) + '</b></td>' +
        '<td class="spec">' + esc(pspec(p)) + '</td>' +
        '<td class="steel">' + esc(psteel(p)) + '</td>' +
        '<td class="len">' + esc(plen(p)) + '</td>' +
        '<td class="num pu" data-l="' + esc(t('th_unit')) + '">' + (p.pu ? money(p.pu) : '—') + '</td>' +
        '<td class="num pt" data-l="' + esc(t('th_price')) + '">' + money(p.pt) + '</td>' +
        '<td class="act"><button class="add" type="button" data-id="' + p.id + '" aria-pressed="' + on + '" aria-label="' + esc(t('add_aria') + pname(p)) + '">' + (on ? t('added') : t('add')) + '</button></td></tr>';
    }).join('');
  }
  $('#topRows') && $('#topRows').addEventListener('click', function (e) {
    var b = e.target.closest('.add'); if (!b) return;
    togglePicked(b.dataset.id); renderTop(); renderPicked();
    var again = $('#topRows').querySelector('.add[data-id="' + b.dataset.id + '"]'); if (again) again.focus();
  });

  /* ---------- каталог ---------- */
  var params = new URLSearchParams(location.search);
  var state = { cat: 'all', type: 'all', q: '', sort: 'def' };
  if (isCatalog && CATEGORIES.indexOf(params.get('cat')) !== -1) state.cat = params.get('cat');
  if (isCatalog) {
    if (params.get('type') && TYPES[params.get('type')]) state.type = params.get('type');
    if (params.get('q')) state.q = params.get('q');
    if (['name', 'price-asc', 'price-desc'].indexOf(params.get('sort')) !== -1) state.sort = params.get('sort');
  }

  function renderHead() {
    var isAll = state.cat === 'all';
    $('#catTitle').textContent = isAll ? t('catalog_h') : t('cat_' + state.cat);
    document.title = isAll ? t('cat_title') : t('cat_' + state.cat) + ' — ' + t('cat_title');
    $('#crumbCat').textContent = isAll ? '' : t('cat_' + state.cat);
    $('#crumbSep').hidden = isAll; $('#crumbCat').hidden = isAll;
    $$('.catbar a').forEach(function (a) {
      if (a.dataset.cat === state.cat) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var bar = $('#catbar'), act = bar.querySelector('[aria-current]');
    if (act) bar.scrollTo({ left: Math.max(0, act.offsetLeft - (bar.clientWidth - act.offsetWidth) / 2), behavior: 'instant' });
  }
  function renderCatbar() {
    var all = [{ id: 'all', name: t('catalog_all') }].concat(CATEGORIES.map(function (c) { return { id: c, name: t('cat_' + c) }; }));
    $('#catbar').innerHTML = all.map(function (c) {
      return '<a href="catalog.html' + (c.id === 'all' ? '' : '?cat=' + c.id) + '" data-cat="' + c.id + '">' + c.name + '</a>';
    }).join('');
  }
  $('#catbar') && $('#catbar').addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    e.preventDefault();
    state.cat = a.dataset.cat; state.type = 'all';
    history.replaceState(null, '', a.getAttribute('href'));
    $('#catbar').classList.remove('is-open'); $('#catbarToggle').setAttribute('aria-expanded', 'false');
    renderTypeSel(); renderHead(); renderRows();
  });
  function renderTypeSel() {
    var types = [];
    inCat(state.cat).forEach(function (p) { if (types.indexOf(p.type) === -1) types.push(p.type); });
    var sel = $('#typeSel');
    sel.innerHTML = '<option value="all">' + t('filter_all') + '</option>' + types.map(function (k) {
      return '<option value="' + k + '">' + TYPES[k][lang] + '</option>';
    }).join('');
    sel.value = types.indexOf(state.type) === -1 ? 'all' : state.type;
    if (sel.value === 'all') state.type = 'all';
  }
  function renderRows() {
    var q = state.q.trim().toLowerCase().replace(/[х*]/g, 'x').replace(/(\d)\.(\d)/g, '$1,$2');
    var inScope = inCat(state.cat).filter(function (p) { return state.type === 'all' || p.type === state.type; });
    var list = inScope.filter(function (p) {
      return !q || (pname(p) + ' ' + psteel(p) + ' ' + p.len).toLowerCase().replace(/×/g, 'x').indexOf(q) !== -1;
    });
    // запрос есть, в категории пусто — ищем по всему каталогу и говорим об этом
    var widened = false;
    if (q && !list.length && (state.cat !== 'all' || state.type !== 'all')) {
      list = PRODUCTS.filter(function (p) { return (pname(p) + ' ' + psteel(p) + ' ' + p.len).toLowerCase().replace(/×/g, 'x').indexOf(q) !== -1; });
      widened = true;
    }
    list.sort(function (a, b) {
      if (state.sort === 'price-asc') return a.pt - b.pt;
      if (state.sort === 'price-desc') return b.pt - a.pt;
      if (state.sort === 'name') return pname(a).localeCompare(pname(b), lang, { numeric: true });
      return a.id - b.id;
    });
    var picked = getPicked();
    $('#rows').innerHTML = list.map(function (p) {
      var on = !!picked[p.id];
      return '<tr><td class="name"><b>' + esc(tname(p)) + '</b></td>' +
        '<td class="spec">' + esc(pspec(p)) + '</td>' +
        '<td class="steel">' + esc(psteel(p)) + '</td>' +
        '<td class="len">' + esc(plen(p)) + '</td>' +
        '<td class="num w" data-l="' + esc(t('th_weight')) + '">' + pweight(p) + '</td>' +
        '<td class="num pu" data-l="' + esc(t('th_unit')) + '">' + (p.pu ? money(p.pu) : '—') + '</td>' +
        '<td class="num pt" data-l="' + esc(t('th_price')) + '">' + money(p.pt) + '</td>' +
        '<td class="act"><button class="add" type="button" data-id="' + p.id + '" aria-pressed="' + on + '" aria-label="' + esc(t('add_aria') + pname(p)) + '">' + (on ? t('added') : t('add')) + '</button></td></tr>';
    }).join('');
    $('#empty').hidden = list.length > 0;
    $('#searchAll').hidden = !(q && !list.length) || (state.cat === 'all' && state.type === 'all');
    $('#shown').textContent = widened ? tf('shown_all', { n: list.length }) : tf('shown', { n: list.length, total: inScope.length });
    var u = new URLSearchParams();
    if (state.cat !== 'all') u.set('cat', state.cat);
    if (state.type !== 'all') u.set('type', state.type);
    if (state.q.trim()) u.set('q', state.q.trim());
    if (state.sort !== 'def') u.set('sort', state.sort);
    history.replaceState(null, '', 'catalog.html' + (u.toString() ? '?' + u : ''));
  }
  if (isCatalog) {
    $('#search').value = state.q; $('#sort').value = state.sort;
    $('#catbarToggle').addEventListener('click', function () {
      var open = $('#catbar').classList.toggle('is-open'); this.setAttribute('aria-expanded', open);
    });
    $('#filtersToggle').addEventListener('click', function () {
      var open = $('#tools').classList.toggle('is-open'); this.setAttribute('aria-expanded', open);
    });
    if (state.q || state.type !== 'all' || state.sort !== 'def') { $('#tools').classList.add('is-open'); $('#filtersToggle').setAttribute('aria-expanded', 'true'); }
    $('#typeSel').addEventListener('change', function (e) { state.type = e.target.value; renderRows(); });
    $('#search').addEventListener('input', function (e) { state.q = e.target.value; renderRows(); });
    $('#sort').addEventListener('change', function (e) { state.sort = e.target.value; renderRows(); });
    $('#searchAll').addEventListener('click', function () {
      state.cat = 'all'; state.type = 'all'; renderCatbar(); renderTypeSel(); renderHead(); renderRows();
    });
    $('#reset').addEventListener('click', function () {
      state.type = 'all'; state.q = ''; state.sort = 'def';
      $('#search').value = ''; $('#sort').value = 'def'; $('#typeSel').value = 'all';
      renderRows();
    });
    $('#rows').addEventListener('click', function (e) {
      var b = e.target.closest('.add'); if (!b) return;
      togglePicked(b.dataset.id);
      renderRows(); renderPicked();
      var again = $('#rows').querySelector('.add[data-id="' + b.dataset.id + '"]'); if (again) again.focus();
    });
  }

  /* ---------- заявка: выбранные позиции (общие для страниц) ---------- */
  function getPicked() { return store.get('tms-picked') || {}; }
  function setPicked(p) { store.set('tms-picked', p); }
  function togglePicked(id) { var p = getPicked(); if (p[id]) delete p[id]; else p[id] = true; setPicked(p); }
  function renderPicked() {
    var ids = Object.keys(getPicked()).filter(byId);
    $$('.cartCount').forEach(function (el) { el.textContent = ids.length; el.hidden = !ids.length; });
    if (!$('#picked')) return;
    $('#picked').hidden = !ids.length;
    $('#pickedList').innerHTML = ids.map(function (id) {
      return '<li><span>' + esc(pname(byId(id))) + '</span><button type="button" data-id="' + id + '" aria-label="' + esc(t('remove') + ': ' + pname(byId(id))) + '">×</button></li>';
    }).join('');
  }
  $('#pickedList') && $('#pickedList').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    togglePicked(b.dataset.id); if (isCatalog) renderRows(); if ($('#topRows')) renderTop(); renderPicked();
  });
  $('#pickedClear') && $('#pickedClear').addEventListener('click', function () { setPicked({}); if (isCatalog) renderRows(); if ($('#topRows')) renderTop(); renderPicked(); });

  /* ---------- калькулятор ---------- */
  // масса 1 шт, кг. Размеры в мм, плотность стали 7,85
  var CALC = {
    rebar:  { fields: [['d', 'f_d', 12], ['l', 'f_l_m', 11.7]], kg: function (v) { return v.d * v.d * 0.00617 * v.l; } },
    sheet:  { fields: [['t', 'f_t', 3], ['w', 'f_w', 1250], ['l', 'f_l_mm', 2500]], kg: function (v) { return v.t * v.w * v.l * 7.85 / 1e6; } },
    pipe:   { fields: [['d', 'f_d', 57], ['t', 'f_wall', 3], ['l', 'f_l_m', 6]], kg: function (v) { return (v.d - v.t) * v.t * 0.02466 * v.l; } },
    square: { fields: [['a', 'f_a', 20], ['l', 'f_l_m', 6]], kg: function (v) { return v.a * v.a * 7.85 / 1000 * v.l; } },
  };
  var cType = $('#cType'), cFields = $('#cFields'), calcOut = { text: '' }, priceTouched = false;
  // подбираем строку прайса по типу и первому размеру
  function priceMatch() {
    var v = {}; cFields.querySelectorAll('input').forEach(function (i) { v[i.dataset.k] = (i.value || '').replace('.', ','); });
    var ty = cType.value, p = null;
    if (ty === 'rebar') p = PRODUCTS.filter(function (x) { return x.type === 'rebar' && x.spec === '⌀' + v.d; })[0];
    if (ty === 'pipe') p = PRODUCTS.filter(function (x) { return x.type === 'esv' && x.spec.indexOf(v.d + '×' + v.t) === 0; })[0] ||
                           PRODUCTS.filter(function (x) { return x.type === 'esv' && x.spec.indexOf(v.d + '×') === 0; })[0];
    if (ty === 'sheet') p = PRODUCTS.filter(function (x) { return x.type === 'gk' && x.spec === v.t + ' мм'; })[0];
    return p || null;
  }
  function syncPrice() {
    var src = $('#cPriceSrc'); if (!src) return;
    if (priceTouched) { src.textContent = $('#cPrice').value ? t('calc_price_manual') : ''; return; }
    var p = priceMatch();
    if (p) { $('#cPrice').value = p.pt; src.textContent = tf('calc_price_from', { name: pname(p) }); }
    else { $('#cPrice').value = ''; src.textContent = ''; }
  }
  function buildFields() {
    var prev = {};
    cFields.querySelectorAll('input').forEach(function (i) { prev[i.dataset.type + i.dataset.k] = i.value; });
    cFields.innerHTML = CALC[cType.value].fields.map(function (f) {
      var key = cType.value + f[0], val = prev[key] !== undefined ? prev[key] : f[2];
      return '<label><span>' + t(f[1]) + '</span><input class="input" type="number" min="0" step="any" inputmode="decimal" data-k="' + f[0] + '" data-type="' + cType.value + '" value="' + val + '"></label>';
    }).join('');
    syncPrice(); calc();
  }
  function calc() {
    var def = CALC[cType.value], v = {}, parts = [];
    cFields.querySelectorAll('input').forEach(function (i) { v[i.dataset.k] = parseFloat(i.value) || 0; });
    var qty = Math.max(parseFloat($('#cQty').value) || 0, 0);
    var kg = def.kg(v) * qty, sum = kg / 1000 * (parseFloat($('#cPrice').value) || 0);
    var w = kg ? (kg >= 1000 ? (kg / 1000).toFixed(3).replace('.', ',') + ' ' + t('t') : kg.toFixed(1).replace('.', ',') + ' ' + t('kg')) : '—';
    $('#cWeight').textContent = w; $('#cSum').textContent = sum ? money(sum) : '—';
    cFields.querySelectorAll('label').forEach(function (l) { parts.push(l.querySelector('span').textContent + ' ' + l.querySelector('input').value); });
    calcOut.text = t('calc_note') + ': ' + cType.options[cType.selectedIndex].text + '; ' + parts.join(', ') + '; ' + t('calc_qty') + ' ' + $('#cQty').value + ' → ' + w;
    $('#calcToReq').disabled = !kg;
  }
  if (cType) {
    cType.addEventListener('change', buildFields);
    $('#calcForm').addEventListener('input', function (e) {
      if (e.target.id === 'cPrice') priceTouched = !!e.target.value;
      else if (e.target.closest('#cFields')) syncPrice();
      calc();
    });
    $('#calcForm').addEventListener('submit', function (e) { e.preventDefault(); });
    $('#calcToReq').addEventListener('click', function () {
      var c = $('#fComment');
      c.value = (c.value ? c.value + '\n' : '') + calcOut.text;
      $('#request').scrollIntoView({ behavior: 'smooth' });
      setTimeout(function () { c.focus({ preventScroll: true }); }, 400);
    });
  }

  /* ---------- телефон: маска +998 XX XXX-XX-XX ---------- */
  function formatPhone(raw) {
    var d = raw.replace(/\D/g, '');
    if (d.indexOf('998') === 0) d = d.slice(3);
    d = d.slice(0, 9);
    var out = '+998';
    if (d.length) out += ' ' + d.slice(0, 2);
    if (d.length > 2) out += ' ' + d.slice(2, 5);
    if (d.length > 5) out += '-' + d.slice(5, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    return out;
  }
  function bindPhone(input) {
    input.addEventListener('focus', function () { if (!input.value) input.value = '+998 '; });
    input.addEventListener('blur', function () { if (input.value.replace(/\D/g, '') === '998') input.value = ''; });
    input.addEventListener('input', function () { input.value = formatPhone(input.value); });
  }
  var phoneOk = function (v) { return v.replace(/\D/g, '').length === 12; };

  /* ---------- заявка ---------- */
  function showErr(input, errEl, msg) { input.setAttribute('aria-invalid', 'true'); errEl.textContent = msg; errEl.hidden = false; }
  function clearErrors() {
    $$('[aria-invalid]').forEach(function (i) { i.removeAttribute('aria-invalid'); });
    $$('.err').forEach(function (e) { e.hidden = true; e.textContent = ''; });
    $$('.form__ok').forEach(function (e) { e.hidden = true; });
  }
  function submitLead(lead, okEl) {
    // TODO: подключить отправку (Telegram-бот / почта / CRM). Сейчас заявка только логируется.
    console.log('Заявка', lead);
    okEl.innerHTML = '<b>' + esc(t('sent_h')) + '</b><p>' + esc(t('ok').replace('{name}', lead.name ? ', ' + lead.name : '').replace('{phone}', lead.phone)) + '</p>' +
      (lead.items.length ? '<p class="form__ok-items">' + esc(t('sent_items')) + '</p><ul>' + lead.items.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '') +
      '<button class="btn btn--outline btn--sm" type="button" id="sendAgain">' + esc(t('again')) + '</button>';
    okEl.hidden = false;
    form.classList.add('is-sent');
    okEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () { okEl.focus({ preventScroll: true }); }, 300);
    $('#sendAgain').addEventListener('click', function () { form.classList.remove('is-sent'); okEl.hidden = true; fName.focus(); });
  }
  var form = $('#form'), fName = $('#fName'), fPhone = $('#fPhone');
  bindPhone(fPhone);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    var bad = null;
    if (!fName.value.trim()) { showErr(fName, $('#nameErr'), t('err_name')); bad = bad || fName; }
    if (!phoneOk(fPhone.value)) { showErr(fPhone, $('#phoneErr'), t('err_phone')); bad = bad || fPhone; }
    if (bad) { bad.focus(); return; }
    submitLead({
      name: fName.value.trim(), phone: fPhone.value, comment: $('#fComment').value.trim(),
      items: Object.keys(getPicked()).filter(byId).map(function (id) { return pname(byId(id)); }), lang: lang,
    }, $('#formOk'));
    form.reset(); setPicked({}); if (isCatalog) renderRows(); if ($('#topRows')) renderTop(); renderPicked();
  });
  [fName, fPhone].forEach(function (i) {
    i.addEventListener('input', function () {
      i.removeAttribute('aria-invalid');
      (i === fName ? $('#nameErr') : $('#phoneErr')).hidden = true;
    });
  });

  renderAll();
})();
