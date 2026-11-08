/* 313 Mods store front end. Reads the catalogue from the Tebex Headless API and sends buyers to the Tebex checkout. */
(function () {
  'use strict';

  var C = window.SITE_CONFIG;
  var I = window.I18N;
  var API = C.apiBase;
  var ACC = API + '/accounts/' + encodeURIComponent(C.publicToken);
  var KEYS = { basket: '313mods.basket', lang: '313mods.lang', code: '313mods.code' };

  var state = {
    lang: 'en',
    cats: null,
    pkgs: [],
    byIdent: {},
    byId: {},
    loading: true,
    error: null,
    basket: null,
    basketLoading: false,
    view: { name: 'home' },
    slide: 0,
    pendingAdd: null
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Storage ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- Language ---------- */
  function detectLang() {
    var saved = lsGet(KEYS.lang);
    if (saved && I[saved]) return saved;
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i] || '').slice(0, 2).toLowerCase();
      if (I[code]) return code;
    }
    return 'en';
  }
  function t(key, vars) {
    var s = (I[state.lang] || {})[key];
    if (s == null) s = I.en[key];
    if (s == null) return key;
    if (vars) s = String(s).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
    return s;
  }
  function count(n, one, many) { return n === 1 ? t(one) : t(many, { n: n }); }

  /* ---------- Formatting ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(v, cur) {
    var locale = { en: 'en-US', es: 'es', pt: 'pt-BR' }[state.lang] || 'en-US';
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency: cur || 'USD' }).format(Number(v) || 0); }
    catch (e) { return '$' + (Number(v) || 0).toFixed(2); }
  }
  function isFree(p) { return Number(p.total_price) === 0; }
  function priceHtml(p) {
    if (isFree(p)) return esc(t('card.free'));
    var html = esc(money(p.total_price, p.currency));
    if (Number(p.discount) > 0) html += ' <s>' + esc(money(Number(p.total_price) + Number(p.discount), p.currency)) + '</s>';
    return html;
  }
  function plainText(html) {
    var doc = new DOMParser().parseFromString('<div>' + (html || '') + '</div>', 'text/html');
    return doc.body.textContent || '';
  }

  /* ---------- Catalogue helpers ---------- */
  function roleOf(cat) {
    var name = (cat.name || '') + ' ' + (cat.slug || '');
    var roles = C.categoryRoles || {};
    for (var r in roles) if (roles[r].test(name)) return r;
    return null;
  }
  function findCategory(role) {
    if (!state.cats) return null;
    for (var i = 0; i < state.cats.length; i++) if (roleOf(state.cats[i]) === role && state.cats[i].packages.length) return state.cats[i];
    return null;
  }
  function compat(p) {
    var txt = (p.name || '') + ' ' + plainText(p.description);
    return { fivem: C.compatibility.fivem.test(txt), story: C.compatibility.story.test(txt) };
  }
  function chipsHtml(p) {
    var c = compat(p), out = '';
    if (c.fivem) out += '<span>' + esc(t('compat.fivem')) + '</span>';
    if (c.story) out += '<span>' + esc(t('compat.story')) + '</span>';
    return out;
  }
  function inBasket(id) {
    var b = state.basket;
    if (!b || !b.packages) return false;
    for (var i = 0; i < b.packages.length; i++) if (b.packages[i].id === id) return true;
    return false;
  }
  function basketCount() {
    var b = state.basket, n = 0;
    if (b && b.packages) b.packages.forEach(function (p) { n += (p.in_basket && p.in_basket.quantity) || 1; });
    return n;
  }

  /* ---------- Icons ---------- */
  var ICONS = {
    clothing: '<svg viewBox="0 0 120 90" aria-hidden="true"><path fill="rgba(155,107,255,.1)" stroke="#C4A6FF" stroke-width="2" stroke-linejoin="round" d="M42 12 Q60 0 78 12 L98 20 L114 46 L102 54 L92 40 V86 H28 V40 L18 54 L6 46 L22 20 Z"/><path fill="none" stroke="#C4A6FF" stroke-width="2" stroke-linecap="round" d="M46 14 Q60 32 74 14 M55 25 V40 M65 25 V40 M42 62 H78 L74 76 H46 Z"/></svg>',
    weapons: '<svg viewBox="0 0 120 90" aria-hidden="true"><path fill="rgba(155,107,255,.1)" stroke="#C4A6FF" stroke-width="2" stroke-linejoin="round" d="M12 28 H102 L108 33 V44 H62 L58 49 H50 L45 72 L43 82 H27 L31 60 L35 44 H12 Z"/><path fill="none" stroke="#C4A6FF" stroke-width="2" stroke-linecap="round" d="M50 49 Q50 60 61 57 M80 32 V40 M85 32 V40 M90 32 V40"/></svg>',
    packs: '<svg viewBox="0 0 120 90" aria-hidden="true"><path fill="rgba(155,107,255,.1)" stroke="#C4A6FF" stroke-width="2" stroke-linejoin="round" d="M60 6 L104 24 V66 L60 84 L16 66 V24 Z"/><path fill="none" stroke="#C4A6FF" stroke-width="2" stroke-linejoin="round" d="M16 24 L60 42 L104 24 M60 42 V84 M38 15 L82 33 V46"/></svg>'
  };
  function iconFor(cat) { return ICONS[roleOf(cat)] || ICONS.clothing; }

  /* ---------- Description sanitising ---------- */
  var ALLOWED = { P: 1, BR: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, UL: 1, OL: 1, LI: 1, A: 1, H2: 1, H3: 1, H4: 1, CODE: 1, BLOCKQUOTE: 1, HR: 1, SMALL: 1 };
  var DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, TEMPLATE: 1, NOSCRIPT: 1, FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1 };
  var URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
  function prettify(html) {
    // Tebex descriptions often carry Discord-style markdown; show it as real formatting.
    return String(html || '')
      .replace(/\*\*([^*<]+?)\s*\*\*/g, '<strong>$1</strong>')
      .replace(/<p>\s*-#\s*/g, '<p class="sub">')
      .replace(/`([^`<]+)`/g, '<code>$1</code>');
  }
  function appendText(dst, text, inLink) {
    if (inLink) { dst.appendChild(document.createTextNode(text)); return; }
    var last = 0, m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(text))) {
      if (m.index > last) dst.appendChild(document.createTextNode(text.slice(last, m.index)));
      var a = document.createElement('a');
      a.href = m[1]; a.target = '_blank'; a.rel = 'noopener nofollow'; a.textContent = m[1];
      dst.appendChild(a);
      last = m.index + m[1].length;
    }
    if (last < text.length) dst.appendChild(document.createTextNode(text.slice(last)));
  }
  function walk(src, dst, inLink) {
    Array.prototype.forEach.call(src.childNodes, function (n) {
      if (n.nodeType === 3) { appendText(dst, n.nodeValue, inLink); return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName;
      if (DROP[tag]) return;
      if (!ALLOWED[tag]) { walk(n, dst, inLink); return; }
      var el = document.createElement(tag.toLowerCase());
      if (tag === 'A') {
        var href = n.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href)) { el.href = href; el.target = '_blank'; el.rel = 'noopener nofollow'; }
      }
      if (tag === 'P' && n.getAttribute('class') === 'sub') el.className = 'sub';
      walk(n, el, inLink || tag === 'A');
      dst.appendChild(el);
    });
  }
  function renderDescription(html, target) {
    var doc = new DOMParser().parseFromString('<div>' + prettify(html) + '</div>', 'text/html');
    target.textContent = '';
    walk(doc.body.firstChild, target, false);
  }

  /* ---------- API ---------- */
  function api(url, opts) {
    opts = opts || {};
    var init = { method: opts.method || 'GET', headers: { Accept: 'application/json' } };
    if (opts.body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(url, init).then(function (r) {
      return r.text().then(function (txt) {
        var j = null;
        try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
        if (!r.ok) {
          var err = new Error((j && (j.detail || j.title || j.message)) || ('HTTP ' + r.status));
          err.status = r.status; err.body = j;
          throw err;
        }
        return j;
      });
    });
  }

  function loadStore() {
    state.loading = true; state.error = null;
    render();
    return api(ACC + '/categories?includePackages=1').then(function (j) {
      var cats = (j && j.data) || [];
      var byOrder = function (a, b) { return (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name)); };
      cats.sort(byOrder);
      state.pkgs = []; state.byIdent = {}; state.byId = {};
      cats.forEach(function (c) {
        c.packages = (c.packages || []).slice().sort(byOrder);
        c.packages.forEach(function (p) {
          p._cat = c;
          if (!state.byId[p.id]) state.pkgs.push(p);
          state.byIdent[p.ident] = p; state.byId[p.id] = p;
        });
      });
      state.cats = cats;
      state.loading = false;
      renderNav();
      render();
    }).catch(function (e) {
      state.loading = false; state.error = e;
      render();
    });
  }

  /* ---------- Basket ---------- */
  function siteUrl() { return location.origin + location.pathname; }
  function isAuthed() { return !!(state.basket && state.basket.username); }

  function loadBasket() {
    var ident = lsGet(KEYS.basket);
    if (!ident) { state.basket = null; updateCount(); return Promise.resolve(null); }
    return api(ACC + '/baskets/' + encodeURIComponent(ident)).then(function (j) {
      var d = j && j.data;
      if (!d || d.complete) { lsSet(KEYS.basket, null); state.basket = null; }
      else state.basket = d;
      updateCount();
      return state.basket;
    }).catch(function (e) {
      if (e.status >= 400 && e.status < 500) { lsSet(KEYS.basket, null); state.basket = null; updateCount(); return null; }
      throw e;
    });
  }
  function createBasket() {
    var base = siteUrl();
    return api(ACC + '/baskets', {
      method: 'POST',
      body: { complete_url: base + '#/thanks', cancel_url: base, complete_auto_redirect: true }
    }).then(function (j) {
      state.basket = j.data;
      lsSet(KEYS.basket, j.data.ident);
      return j.data;
    });
  }
  function ensureBasket() { return state.basket ? Promise.resolve(state.basket) : createBasket(); }

  function login(pendingIdent) {
    toast(t('toast.login'));
    ensureBasket().then(function (b) {
      var ret = siteUrl() + (pendingIdent ? '?add=' + encodeURIComponent(pendingIdent) : '?basket=1');
      return api(ACC + '/baskets/' + encodeURIComponent(b.ident) + '/auth?returnUrl=' + encodeURIComponent(ret));
    }).then(function (links) {
      var list = Array.isArray(links) ? links : (links && links.data) || [];
      var link = list[0];
      if (!link || !link.url) throw new Error('No login link');
      location.href = link.url;
    }).catch(fail);
  }

  function addPackage(ident, btn) {
    if (!isAuthed()) { openBasket(ident); return; }
    var p = state.byIdent[ident];
    if (p && inBasket(p.id)) { openBasket(); return; }
    busy(btn, true);
    api(API + '/baskets/' + encodeURIComponent(state.basket.ident) + '/packages', {
      method: 'POST', body: { package_id: ident, quantity: 1 }
    }).then(function (j) {
      if (j && j.data) state.basket = j.data;
      afterBasketChange();
      toast(t('toast.added'));
      bump();
    }).catch(function (e) {
      if (/log ?in/i.test(e.message)) { state.basket.username = null; openBasket(ident); }
      else fail(e);
    }).then(function () { busy(btn, false); });
  }

  function removePackage(id) {
    var p = state.byId[id];
    api(API + '/baskets/' + encodeURIComponent(state.basket.ident) + '/packages/remove', {
      method: 'POST', body: { package_id: p ? p.ident : String(id) }
    }).then(function (j) {
      if (j && j.data) state.basket = j.data;
      afterBasketChange();
      toast(t('toast.removed'));
    }).catch(fail);
  }

  function applyCreatorCode(code) {
    code = String(code || '').trim();
    if (!code || !state.basket) return Promise.resolve(false);
    return api(ACC + '/baskets/' + encodeURIComponent(state.basket.ident) + '/creator-codes', {
      method: 'POST', body: { creator_code: code }
    }).then(function (j) {
      if (j && j.success === false) throw new Error(j.message || 'bad code');
      lsSet(KEYS.code, null);
      return loadBasket().then(function () { afterBasketChange(); toast(t('toast.code_ok')); return true; });
    }).catch(function () { toast(t('toast.code_bad')); return false; });
  }

  function afterBasketChange() {
    updateCount();
    refreshAddButtons();
    if (!$('#basket').hidden) renderBasket();
  }

  /* ---------- Header ---------- */
  function renderNav() {
    var links = [{ href: '#/', label: t('nav.home'), key: 'home' }];
    (state.cats || []).forEach(function (c) {
      if (!c.parent && c.packages.length) links.push({ href: '#/category/' + c.id, label: c.name, key: 'cat-' + c.id });
    });
    var current = state.view.name === 'category' ? 'cat-' + state.view.id : (state.view.name === 'home' ? 'home' : '');
    var html = links.map(function (l) {
      return '<a href="' + l.href + '"' + (l.key === current ? ' class="on" aria-current="page"' : '') + '>' + esc(l.label) + '</a>';
    }).join('');
    $('#nav').innerHTML = html;
    $('#m-nav').innerHTML = html;
  }
  function renderTicker() {
    var msgs = t('ticker');
    if (!Array.isArray(msgs)) msgs = [];
    var one = msgs.map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('');
    $('#ticker').innerHTML = one + one;
  }
  function updateCount() { $('#cart-count').textContent = String(basketCount()); }
  function bump() {
    var b = $('#cart-btn');
    b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
  }
  function applyStaticText() {
    document.documentElement.lang = state.lang;
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $('#lang-select').value = state.lang;
    $('#lang-select-m').value = state.lang;
  }

  /* ---------- Views ---------- */
  function heroHtml() {
    var slides = C.slides || [];
    var out = '<section class="hero" aria-roledescription="carousel" aria-label="313 Mods">';
    slides.forEach(function (s, i) {
      var k = 'hero.' + s.key + '.';
      var cta = '', second = '';
      if (s.target === 'all') {
        cta = '<button type="button" class="btn" data-scroll="products">' + esc(t(k + 'cta')) + '</button>';
        second = '<a class="btn-2" href="' + esc(C.discordUrl) + '" target="_blank" rel="noopener">' + esc(t('hero.discord')) + '</a>';
      } else {
        var cat = findCategory(s.target);
        if (cat) cta = '<a class="btn" href="#/category/' + cat.id + '">' + esc(t(k + 'cta')) + '</a>';
        else if (state.cats) cta = '<a class="btn-2" href="' + esc(C.discordUrl) + '" target="_blank" rel="noopener">' + esc(t('hero.soon')) + '</a>';
      }
      var hTag = i === 0 && state.view.name === 'home' ? 'h1' : 'h2';
      out += '<div class="slide' + (i === state.slide ? ' on' : '') + '" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' / ' + slides.length + '"' + (i === state.slide ? '' : ' aria-hidden="true"') + '>' +
        '<img class="bg" src="' + esc(s.image) + '.webp" srcset="' + esc(s.image) + '-960.webp 960w, ' + esc(s.image) + '.webp 1920w" sizes="(max-width: 760px) 100vw, 1240px" alt="" ' + (i === 0 ? 'fetchpriority="high"' : 'loading="lazy"') + '>' +
        '<div class="slide-copy"><p class="tag">' + esc(t(k + 'tag')) + '</p>' +
        '<' + hTag + '>' + esc(t(k + 'title')) + ' <span>' + esc(t(k + 'accent')) + '</span></' + hTag + '>' +
        '<p class="slide-sub">' + esc(t(k + 'sub')) + '</p>' +
        '<div class="slide-cta">' + cta + second + '</div></div></div>';
    });
    out += '<span class="hud-c tl"></span><span class="hud-c tr"></span><span class="hud-c bl"></span><span class="hud-c br"></span>' +
      '<div class="read" aria-hidden="true"><span>313 // CREW</span><span>DROP 01</span><span>ONLINE</span></div>' +
      '<span class="radar" aria-hidden="true"><i></i></span>';
    if (slides.length > 1) {
      out += '<div class="hero-ctrl"><button type="button" class="arrow" data-slide="prev" aria-label="' + esc(t('hero.prev')) + '">‹</button><div class="dots">';
      slides.forEach(function (s, i) {
        out += '<button type="button" data-slide="' + i + '" aria-label="' + (i + 1) + ' / ' + slides.length + '"' + (i === state.slide ? ' aria-current="true"' : '') + '></button>';
      });
      out += '</div><button type="button" class="arrow" data-slide="next" aria-label="' + esc(t('hero.next')) + '">›</button></div>';
    }
    return out + '</section>';
  }

  function cardHtml(p) {
    var free = isFree(p), inB = inBasket(p.id);
    var img = p.image
      ? '<img src="' + esc(p.image) + '" alt="" loading="lazy" decoding="async">'
      : iconFor(p._cat);
    var badge = free ? '<span class="badge free">' + esc(t('card.free')) + '</span>'
      : (Number(p.discount) > 0 ? '<span class="badge">−' + Math.round(Number(p.discount) / (Number(p.total_price) + Number(p.discount)) * 100) + '%</span>' : '');
    var addLabel = inB ? t('card.in') : (free ? t('card.get') : t('card.add'));
    return '<article class="card">' +
      '<button type="button" class="card-img" data-open="' + p.id + '" aria-label="' + esc(t('card.view') + ': ' + p.name) + '">' + img + badge +
      '<span class="chips">' + chipsHtml(p) + '</span></button>' +
      '<div class="card-body"><h3><button type="button" data-open="' + p.id + '">' + esc(p.name) + '</button></h3>' +
      '<p class="card-cat">' + esc(p._cat ? p._cat.name : '') + '</p>' +
      '<div class="price">' + priceHtml(p) + '</div>' +
      '<div class="card-btns"><button type="button" class="btn-view" data-open="' + p.id + '">' + esc(t('card.view')) + '</button>' +
      '<button type="button" class="btn-add' + (inB ? ' in' : '') + '" data-add="' + esc(p.ident) + '">' + esc(addLabel) + '</button></div></div>' +
      '</article>';
  }

  function skeletonCards(n) { var s = ''; for (var i = 0; i < n; i++) s += '<div class="card skel" aria-hidden="true"></div>'; return s; }

  function errorHtml() {
    return '<div class="wrap state"><p>' + esc(t('error.load')) + '</p><button type="button" class="btn" data-retry>' + esc(t('error.retry')) + '</button></div>';
  }

  function homeHtml() {
    var html = '<div class="wrap">' + heroHtml();
    var cats = (state.cats || []).filter(function (c) { return c.packages.length; });
    if (state.loading) {
      html += '<div class="cats"><div class="cat skel"></div><div class="cat skel"></div><div class="cat skel"></div></div>';
    } else if (cats.length) {
      html += '<div class="sec-h"><h2>' + esc(t('cats.title')) + '</h2></div><div class="cats">' + cats.map(function (c) {
        return '<a class="cat" href="#/category/' + c.id + '">' + iconFor(c) + '<span><b>' + esc(c.name) + '</b><small>' +
          esc(count(c.packages.length, 'cats.count1', 'cats.count')) + '</small></span><span class="go" aria-hidden="true">→</span></a>';
      }).join('') + '</div>';
    }
    html += '<section id="products" aria-labelledby="drop-h"><div class="sec-h"><h2 id="drop-h">' + esc(t('drop.title')) + '</h2>' +
      (state.pkgs.length > C.newDropLimit ? '<a href="#/all">' + esc(t('drop.all')) + ' →</a>' : '') + '</div><div class="grid">';
    if (state.loading) html += skeletonCards(4);
    else {
      var newest = state.pkgs.slice().sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); }).slice(0, C.newDropLimit);
      html += newest.map(cardHtml).join('');
    }
    html += '</div></section>';
    html += '<div class="info">' + [1, 2, 3, 4].map(function (n) {
      return '<div><b>' + esc(t('info.' + n + '.t')) + '</b><span>' + esc(t('info.' + n + '.d')) + '</span></div>';
    }).join('') + '</div>';
    var saved = lsGet(KEYS.code) || '';
    html += '<form class="code-box" id="home-code"><div><h2>' + esc(t('code.title')) + '</h2><p>' + esc(t('code.text')) + '</p></div>' +
      '<div class="field"><label class="sr" for="home-code-in">' + esc(t('code.ph')) + '</label><input class="input" id="home-code-in" name="code" autocomplete="off" maxlength="40" placeholder="' + esc(t('code.ph')) + '" value="' + esc(saved) + '">' +
      '<button type="submit" class="btn-2">' + esc(t('code.apply')) + '</button></div><p class="note-ok" id="home-code-ok" hidden></p></form>';
    return html + '</div>';
  }

  function listHtml(title, sub, pkgs, back) {
    var html = '<div class="wrap"><div class="page-h">' + (back ? '<a href="#/all">← ' + esc(t('cat.back')) + '</a>' : '') +
      '<h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>';
    html += '<div class="sec-h"><h2>' + esc(count(pkgs.length, 'cats.count1', 'cats.count')) + '</h2></div>';
    if (!pkgs.length) html += '<p class="empty">' + esc(t('cat.empty')) + '</p>';
    else html += '<div class="grid">' + pkgs.map(cardHtml).join('') + '</div>';
    return html + '</div>';
  }

  function thanksHtml() {
    return '<div class="wrap"><div class="thanks"><p class="tag">313 Mods</p><h1>' + esc(t('thanks.title')) + '</h1><p>' + esc(t('thanks.text')) +
      '</p><p>' + esc(t('thanks.help')) + '</p><div class="slide-cta"><a class="btn" href="#/">' + esc(t('thanks.back')) +
      '</a><a class="btn-2" href="' + esc(C.discordUrl) + '" target="_blank" rel="noopener">Discord</a></div></div></div>';
  }

  function render() {
    var v = state.view, html, title = C.storeName + ' | FiveM Clothing & Weapons';
    if (state.error && v.name !== 'thanks') html = errorHtml();
    else if (v.name === 'thanks') html = thanksHtml();
    else if (v.name === 'category') {
      if (state.loading) html = '<div class="wrap"><div class="page-h"><h1>&nbsp;</h1></div><div class="grid">' + skeletonCards(4) + '</div></div>';
      else {
        var cat = (state.cats || []).filter(function (c) { return String(c.id) === String(v.id); })[0];
        if (!cat) { location.replace('#/'); return; }
        html = listHtml(cat.name, plainText(cat.description).trim(), cat.packages, true);
        title = cat.name + ' | ' + C.storeName;
      }
    } else if (v.name === 'all') {
      html = state.loading ? '<div class="wrap"><div class="grid">' + skeletonCards(8) + '</div></div>' : listHtml(t('cat.back'), '', state.pkgs, false);
    } else html = homeHtml();
    $('#view').innerHTML = html;
    document.title = title;
    renderNav();
    startCarousel();
  }

  /* ---------- Carousel ---------- */
  var timer = null, paused = false;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function showSlide(i) {
    var slides = $$('.hero .slide');
    if (!slides.length) return;
    state.slide = (i + slides.length) % slides.length;
    slides.forEach(function (s, k) {
      var on = k === state.slide;
      s.classList.toggle('on', on);
      if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
    });
    $$('.hero .dots button').forEach(function (d, k) {
      if (k === state.slide) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
    });
  }
  function startCarousel() {
    clearInterval(timer);
    var hero = $('.hero');
    if (!hero || reduced || (C.slides || []).length < 2) return;
    hero.addEventListener('mouseenter', function () { paused = true; });
    hero.addEventListener('mouseleave', function () { paused = false; });
    hero.addEventListener('focusin', function () { paused = true; });
    hero.addEventListener('focusout', function () { paused = false; });
    timer = setInterval(function () { if (!paused && !document.hidden) showSlide(state.slide + 1); }, 7000);
  }

  /* ---------- Package sheet ---------- */
  var lastFocus = null;
  function lock(on) { document.body.classList.toggle('locked', on); }

  function openPackage(id) {
    var p = state.byId[id];
    var sheet = $('#pkg');
    if (!p) return;
    var media = (p.media || []).filter(function (m) { return m.type === 'image' && m.url; });
    if (!media.length && p.image) media = [{ url: p.image }];
    var videos = (p.media || []).filter(function (m) { return m.type === 'video' && m.url; });
    var free = isFree(p), inB = inBasket(p.id);
    var main = media[0] ? '<img id="pkg-main" src="' + esc(media[0].url) + '" alt="' + esc(p.name) + '">' : iconFor(p._cat);
    var thumbs = media.length > 1 ? '<div class="thumbs">' + media.map(function (m, i) {
      return '<button type="button" data-thumb="' + esc(m.url) + '"' + (i === 0 ? ' aria-current="true"' : '') + ' aria-label="' + (i + 1) + ' / ' + media.length + '"><img src="' + esc(m.url) + '" alt="" loading="lazy"></button>';
    }).join('') + '</div>' : '';
    var vids = videos.map(function (v) { return '<a class="btn-2" href="' + esc(v.url) + '" target="_blank" rel="noopener">▶ Video</a>'; }).join(' ');
    var chips = chipsHtml(p);
    var label = inB ? t('pkg.in') : (free ? t('pkg.get') : t('pkg.add') + ' · ' + money(p.total_price, p.currency));
    sheet.innerHTML =
      '<div class="sheet-grid"><div class="sheet-media"><div class="sheet-main-img">' + main + '</div>' + thumbs + (vids ? '<div style="padding:0 10px 10px">' + vids + '</div>' : '') + '</div>' +
      '<div class="sheet-info"><div class="sheet-top"><div><p class="tag">' + esc(p._cat ? p._cat.name : '') + '</p><h2 id="pkg-name">' + esc(p.name) + '</h2></div>' +
      '<button type="button" class="x" data-close-pkg aria-label="' + esc(t('pkg.close')) + '">✕</button></div>' +
      (chips ? '<div class="chips-inline">' + chips + '</div>' : '') +
      '<div class="big-price">' + priceHtml(p) + '</div>' +
      '<div class="desc" id="pkg-desc"></div>' +
      '<div class="sheet-cta"><button type="button" class="btn btn-full' + (inB ? ' in' : '') + '" data-add="' + esc(p.ident) + '" data-big="1">' + esc(label) + '</button>' +
      '<p class="small-note">' + esc(t('pkg.delivery')) + '</p></div></div></div>';
    renderDescription(p.description, $('#pkg-desc'));
    if (sheet.hidden) lastFocus = document.activeElement;
    $('#pkg-overlay').hidden = false;
    sheet.hidden = false;
    lock(true);
    $('.x', sheet).focus();
    document.title = p.name + ' | ' + C.storeName;
  }
  function closePackage(fromRoute) {
    if ($('#pkg').hidden) return;
    $('#pkg').hidden = true;
    $('#pkg-overlay').hidden = true;
    if ($('#basket').hidden) lock(false);
    if (!fromRoute) {
      if (state.cameFromList) history.back();
      else location.hash = state.view.name === 'category' ? '#/category/' + state.view.id : '#/';
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------- Basket drawer ---------- */
  var basketReturnFocus = null;
  function openBasket(pendingIdent) {
    state.pendingAdd = pendingIdent || null;
    var d = $('#basket');
    if (d.hidden) basketReturnFocus = document.activeElement;
    d.hidden = false;
    $('#pkg-overlay').hidden = false;
    lock(true);
    renderBasket();
    var close = $('.x', d);
    if (close) close.focus();
  }
  function closeBasket() {
    var d = $('#basket');
    if (d.hidden) return;
    d.hidden = true;
    if ($('#pkg').hidden) { $('#pkg-overlay').hidden = true; lock(false); }
    if (basketReturnFocus && basketReturnFocus.focus) basketReturnFocus.focus();
  }
  function renderBasket() {
    var d = $('#basket'), b = state.basket, n = basketCount();
    var top = '<div class="drawer-top"><div><h2 id="basket-h">' + esc(t('basket.title')) + '</h2><small>' + esc(count(n, 'basket.items1', 'basket.items')) + '</small></div>' +
      '<button type="button" class="x" data-close-basket aria-label="' + esc(t('basket.close')) + '">✕</button></div>';
    var body = '', foot = '';
    if (state.basketLoading) body = '<p class="small-note">' + esc(t('basket.loading')) + '</p>';
    else if (!isAuthed()) {
      body = '<div class="login-box"><h3>' + esc(t('basket.login.t')) + '</h3><p>' + esc(t('basket.login.d')) + '</p>' +
        '<button type="button" class="btn btn-full" data-login="' + esc(state.pendingAdd || '') + '">' + esc(t('basket.login.btn')) + '</button></div>';
    } else {
      body = '<div class="acct"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 12.5 L9.5 18 L20 6.5"/></svg><span>' +
        t('basket.as', { u: '<b>' + esc(b.username) + '</b>' }) + '</span></div>';
      if (!n) {
        body += '<div class="drawer-empty"><p>' + esc(t('basket.empty')) + '</p><a class="btn-2" href="#/all" data-close-basket>' + esc(t('basket.browse')) + '</a></div>';
      } else {
        body += b.packages.map(function (bp) {
          var p = state.byId[bp.id] || {};
          var img = bp.image || p.image;
          var price = bp.in_basket && bp.in_basket.price != null ? bp.in_basket.price : p.total_price;
          return '<div class="item"><span class="th">' + (img ? '<img src="' + esc(img) + '" alt="">' : '') + '</span>' +
            '<span><b>' + esc(bp.name || p.name) + '</b><small>' + esc(p._cat ? p._cat.name : '') + (bp.in_basket && bp.in_basket.quantity > 1 ? ' · ×' + bp.in_basket.quantity : '') + '</small></span>' +
            '<span class="ip">' + esc(Number(price) === 0 ? t('card.free') : money(price, b.currency)) +
            '<button type="button" class="rm" data-remove="' + bp.id + '">' + esc(t('basket.remove')) + '</button></span></div>';
        }).join('');
        if (b.creator_code) body += '<p class="code-on">' + esc(t('basket.code.on', { c: b.creator_code })) + '</p>';
        else body += '<form class="field" id="basket-code"><label class="sr" for="basket-code-in">' + esc(t('basket.code.ph')) + '</label><input class="input" id="basket-code-in" autocomplete="off" maxlength="40" placeholder="' + esc(t('basket.code.ph')) + '" value="' + esc(lsGet(KEYS.code) || '') + '"><button type="submit" class="btn-2">' + esc(t('basket.code.apply')) + '</button></form>';
        body += '<dl class="sum"><dt>' + esc(t('basket.subtotal')) + '</dt><dd>' + esc(money(b.base_price, b.currency)) + '</dd>' +
          (Number(b.sales_tax) > 0 ? '<dt>' + esc(t('basket.tax')) + '</dt><dd>' + esc(money(b.sales_tax, b.currency)) + '</dd>' : '') +
          '<dt class="tot">' + esc(t('basket.total')) + '</dt><dd class="tot">' + esc(money(b.total_price, b.currency)) + '</dd></dl>';
        var checkout = b.links && b.links.checkout;
        foot = '<div class="drawer-foot">' + (checkout
          ? '<a class="btn btn-full" href="' + esc(checkout) + '">' + esc(t('basket.checkout')) + ' · ' + esc(money(b.total_price, b.currency)) + '</a>'
          : '<button type="button" class="btn btn-full" disabled>' + esc(t('basket.checkout')) + '</button>') +
          (Number(b.sales_tax) > 0 ? '' : '<p class="small-note">' + esc(t('basket.taxnote')) + '</p>') +
          '<p class="small-note">' + esc(t('basket.secure')) + '</p></div>';
      }
    }
    d.innerHTML = top + '<div class="drawer-body">' + body + '</div>' + foot;
  }

  function refreshAddButtons() {
    $$('[data-add]').forEach(function (btn) {
      var p = state.byIdent[btn.getAttribute('data-add')];
      if (!p) return;
      var inB = inBasket(p.id), big = btn.hasAttribute('data-big');
      btn.classList.toggle('in', inB);
      btn.textContent = inB ? t(big ? 'pkg.in' : 'card.in')
        : (isFree(p) ? t(big ? 'pkg.get' : 'card.get') : (big ? t('pkg.add') + ' · ' + money(p.total_price, p.currency) : t('card.add')));
    });
  }

  /* ---------- Feedback ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }
  function fail(e) { if (window.console) console.error(e); toast(t('toast.error')); }
  function busy(btn, on) { if (btn) btn.disabled = on; }

  /* ---------- Routing ---------- */
  function parseHash() {
    var h = location.hash.replace(/^#/, '');
    var m;
    if ((m = h.match(/^\/package\/(\d+)/))) return { name: 'package', id: Number(m[1]) };
    if ((m = h.match(/^\/category\/(\d+)/))) return { name: 'category', id: Number(m[1]) };
    if (h === '/all') return { name: 'all' };
    if (h === '/thanks') return { name: 'thanks' };
    return { name: 'home' };
  }
  function route() {
    var r = parseHash();
    if (r.name === 'package') {
      if (!state.viewRendered) { state.view = { name: 'home' }; render(); state.viewRendered = true; }
      if (state.loading) { state.openWhenReady = r.id; return; }
      openPackage(r.id);
      return;
    }
    closePackage(true);
    state.cameFromList = false;
    if (r.name === 'thanks') { lsSet(KEYS.basket, null); state.basket = null; updateCount(); }
    var changed = JSON.stringify(r) !== JSON.stringify(state.view) || !state.viewRendered;
    state.view = r;
    if (changed) { render(); state.viewRendered = true; window.scrollTo(0, 0); }
  }

  /* ---------- Events ---------- */
  document.addEventListener('click', function (e) {
    var el;
    if ((el = e.target.closest('[data-open]'))) {
      state.cameFromList = true;
      location.hash = '#/package/' + el.getAttribute('data-open');
      return;
    }
    if ((el = e.target.closest('[data-add]'))) { addPackage(el.getAttribute('data-add'), el); return; }
    if ((el = e.target.closest('[data-remove]'))) { removePackage(Number(el.getAttribute('data-remove'))); return; }
    if ((el = e.target.closest('[data-login]'))) { login(el.getAttribute('data-login') || null); return; }
    if ((el = e.target.closest('[data-close-pkg]'))) { closePackage(false); return; }
    if ((el = e.target.closest('[data-close-basket]'))) { closeBasket(); return; }
    if ((el = e.target.closest('[data-thumb]'))) {
      var main = $('#pkg-main');
      if (main) main.src = el.getAttribute('data-thumb');
      $$('.thumbs button').forEach(function (b) { b.removeAttribute('aria-current'); });
      el.setAttribute('aria-current', 'true');
      return;
    }
    if ((el = e.target.closest('[data-slide]'))) {
      var v = el.getAttribute('data-slide');
      showSlide(v === 'prev' ? state.slide - 1 : v === 'next' ? state.slide + 1 : Number(v));
      return;
    }
    if ((el = e.target.closest('[data-scroll]'))) {
      var target = document.getElementById(el.getAttribute('data-scroll'));
      if (target) target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if ((el = e.target.closest('[data-retry]'))) { loadStore(); return; }
    if (e.target.id === 'pkg-overlay') { if (!$('#basket').hidden) closeBasket(); else closePackage(false); }
  });

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.id === 'home-code') {
      e.preventDefault();
      var code = $('#home-code-in').value.trim();
      if (!code) return;
      lsSet(KEYS.code, code);
      if (isAuthed()) applyCreatorCode(code);
      else { var ok = $('#home-code-ok'); ok.textContent = t('code.saved'); ok.hidden = false; }
    } else if (f.id === 'basket-code') {
      e.preventDefault();
      applyCreatorCode($('#basket-code-in').value);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!$('#basket').hidden) closeBasket();
    else if (!$('#pkg').hidden) closePackage(false);
  });

  $('#cart-btn').addEventListener('click', function () { openBasket(); });
  $('#burger').addEventListener('click', function () {
    var m = $('#mobile-menu'), open = m.hidden;
    m.hidden = !open;
    this.setAttribute('aria-expanded', String(open));
  });
  $('#m-nav').addEventListener('click', function (e) {
    if (e.target.closest('a')) { $('#mobile-menu').hidden = true; $('#burger').setAttribute('aria-expanded', 'false'); }
  });
  ['#lang-select', '#lang-select-m'].forEach(function (sel) {
    $(sel).addEventListener('change', function () {
      state.lang = this.value; lsSet(KEYS.lang, state.lang);
      applyStaticText(); renderTicker(); render();
      if (!$('#basket').hidden) renderBasket();
      var r = parseHash(); if (r.name === 'package') openPackage(r.id);
    });
  });
  window.addEventListener('hashchange', route);

  /* ---------- Start ---------- */
  function handleReturnFromLogin() {
    var params = new URLSearchParams(location.search);
    var add = params.get('add'), openB = params.get('basket');
    if (!add && !openB) return;
    history.replaceState(null, '', siteUrl() + location.hash);
    if (!isAuthed()) { if (openB || add) openBasket(add); return; }
    var saved = lsGet(KEYS.code);
    var next = saved && !state.basket.creator_code ? applyCreatorCode(saved) : Promise.resolve();
    next.then(function () {
      if (add) { addPackage(add, null); }
      openBasket();
    });
  }

  state.lang = detectLang();
  ['#discord-head', '#discord-menu', '#discord-foot'].forEach(function (s) { $(s).href = C.discordUrl; });
  $('#year').textContent = String(new Date().getFullYear());
  applyStaticText();
  renderTicker();
  route();
  loadStore().then(function () {
    if (state.openWhenReady) { var id = state.openWhenReady; state.openWhenReady = null; openPackage(id); }
    refreshAddButtons();
  });
  state.basketLoading = true;
  loadBasket().catch(function () { return null; }).then(function () {
    state.basketLoading = false;
    refreshAddButtons();
    handleReturnFromLogin();
  });
})();
