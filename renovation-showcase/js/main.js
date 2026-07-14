/* =========================================================================
   MAIN.JS — bouwt de pagina op vanuit content.js en regelt alle interactie
   (voor/na-schuiven, tabs, hotspots, galerij, lightbox, animaties).
   Hier hoef je normaal gesproken niets aan te passen.
   ========================================================================= */

(function () {
  "use strict";

  /* ---------- hulpjes ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function get(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* Vangnet: als een foto ontbreekt (bijv. verkeerde bestandsnaam) tonen we
     een nette beige placeholder met het bijschrift, geen kapot icoontje. */
  function fallbackFor(label) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100">' +
      '<rect width="1600" height="1100" fill="#efe8db"/>' +
      '<text x="800" y="530" text-anchor="middle" font-family="Georgia,serif" font-size="52" fill="#a4937c">' +
      String(label || "Foto").replace(/[<>&]/g, "") + "</text>" +
      '<text x="800" y="600" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" fill="#a4937c">foto volgt nog</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function guardImg(img, label) {
    img.addEventListener("error", () => {
      if (img.dataset.fallback) return;
      img.dataset.fallback = "1";
      img.src = fallbackFor(label);
    }, { once: false });
    return img;
  }

  /* ---------- teksten uit content.js in de pagina zetten ---------- */
  $$("[data-content]").forEach((node) => {
    const value = get(CONTENT, node.dataset.content);
    if (value != null) node.textContent = value;
  });
  $("#navInsta").href = CONTENT.site.instagram.url;
  $("#footerInsta").href = CONTENT.site.instagram.url;

  /* =========================================================================
     VOOR/NA-SCHUIF
     ========================================================================= */
  function createBeforeAfter(opts) {
    const root = el("div", "ba");
    root.style.setProperty("--pos", "50%");
    if (opts.aspect) root.style.aspectRatio = opts.aspect;

    const after = el("img");
    after.src = opts.after;
    after.alt = (opts.name || "") + " — na de verbouwing";
    after.loading = opts.eager ? "eager" : "lazy";
    if (opts.eager) after.fetchPriority = "high";
    guardImg(after, (opts.name || "") + " — na");

    const beforeWrap = el("div", "ba__before");
    const before = el("img");
    before.src = opts.before;
    before.alt = (opts.name || "") + " — voor de verbouwing";
    before.loading = opts.eager ? "eager" : "lazy";
    if (opts.eager) before.fetchPriority = "high";
    guardImg(before, (opts.name || "") + " — voor");
    beforeWrap.appendChild(before);

    const divider = el("div", "ba__divider");
    const handle = el("button", "ba__handle");
    handle.innerHTML = "&#8249;&#8250;";
    handle.setAttribute("role", "slider");
    handle.setAttribute("aria-label", "Vergelijk voor en na");
    handle.setAttribute("aria-valuemin", "0");
    handle.setAttribute("aria-valuemax", "100");
    handle.setAttribute("aria-valuenow", "50");

    const labelBefore = el("span", "ba__label ba__label--before", "Voor");
    const labelAfter = el("span", "ba__label ba__label--after", "Na");

    root.append(after, beforeWrap, divider, labelBefore, labelAfter, handle);

    let pos = 50;
    const hotspotNodes = [];

    function setPos(next) {
      pos = Math.max(0, Math.min(100, next));
      root.style.setProperty("--pos", pos + "%");
      handle.setAttribute("aria-valuenow", String(Math.round(pos)));
      labelBefore.classList.toggle("is-hidden", pos < 14);
      labelAfter.classList.toggle("is-hidden", pos > 86);
      // hotspots horen bij de NA-foto: verberg ze zolang de VOOR-laag eroverheen ligt
      hotspotNodes.forEach(({ dot, card, x }) => {
        const covered = pos > x;
        dot.classList.toggle("is-covered", covered);
        if (covered) card.hidden = true;
      });
    }

    function posFromEvent(e) {
      const rect = root.getBoundingClientRect();
      return ((e.clientX - rect.left) / rect.width) * 100;
    }

    let dragging = false;
    root.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".hotspot") || e.target.closest(".hotspot__card")) return;
      dragging = true;
      root.classList.add("is-dragging");
      root.setPointerCapture(e.pointerId);
      setPos(posFromEvent(e));
    });
    root.addEventListener("pointermove", (e) => {
      if (dragging) setPos(posFromEvent(e));
    });
    ["pointerup", "pointercancel"].forEach((type) =>
      root.addEventListener(type, () => {
        dragging = false;
        root.classList.remove("is-dragging");
      })
    );
    handle.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { setPos(pos - 4); e.preventDefault(); }
      if (e.key === "ArrowRight") { setPos(pos + 4); e.preventDefault(); }
      if (e.key === "Home") { setPos(0); e.preventDefault(); }
      if (e.key === "End") { setPos(100); e.preventDefault(); }
    });

    /* hotspots (klikbare stipjes met uitleg) */
    (opts.hotspots || []).forEach((spot) => {
      const dot = el("button", "hotspot", "+");
      dot.style.left = spot.x + "%";
      dot.style.top = spot.y + "%";
      dot.setAttribute("aria-label", "Meer over: " + spot.title);

      const card = el("div", "hotspot__card");
      card.hidden = true;
      card.style.left = Math.max(18, Math.min(82, spot.x)) + "%";
      card.style.top = spot.y + "%";
      card.appendChild(el("h4", null, spot.title));
      card.appendChild(el("p", null, spot.text));

      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasHidden = card.hidden;
        root.querySelectorAll(".hotspot__card").forEach((c) => (c.hidden = true));
        card.hidden = !wasHidden;
      });

      root.append(dot, card);
      hotspotNodes.push({ dot, card, x: spot.x });
    });

    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) {
        root.querySelectorAll(".hotspot__card").forEach((c) => (c.hidden = true));
      }
    });

    setPos(opts.start != null ? opts.start : 50);
    return root;
  }

  /* =========================================================================
     PAGINA OPBOUWEN
     ========================================================================= */

  /* hero */
  const heroSection = $(".hero");
  const heroBa = createBeforeAfter({
    before: CONTENT.hero.before,
    after: CONTENT.hero.after,
    name: "Het appartement",
    start: 55,
    eager: true
  });
  $("#heroSlider").appendChild(heroBa);
  /* de sleep-hint verdwijnt zodra er voor het eerst geschoven is */
  heroBa.addEventListener("pointerdown", () => heroSection.classList.add("has-interacted"), { once: true });

  /* verhaal */
  const storyText = $("#storyText");
  CONTENT.story.paragraphs.forEach((p) => storyText.appendChild(el("p", null, p)));

  /* cijfers */
  const statsGrid = $("#statsGrid");
  CONTENT.stats.forEach((stat) => {
    const card = el("div", "stat reveal");
    const value = el("div", "stat__value", "0");
    value.dataset.target = stat.value;
    value.dataset.suffix = stat.suffix || "";
    value.dataset.noformat = stat.noFormat ? "1" : "";
    card.appendChild(value);
    card.appendChild(el("div", "stat__label", stat.label));
    statsGrid.appendChild(card);
  });

  /* tijdlijn */
  const timeline = $("#timeline");
  CONTENT.timeline.items.forEach((item) => {
    const node = el("div", "timeline__item reveal");
    node.appendChild(el("p", "timeline__period", item.period));
    node.appendChild(el("h3", null, item.title));
    node.appendChild(el("p", null, item.text));
    if (item.image) {
      const img = el("img", "timeline__img");
      img.src = item.image;
      img.alt = item.title;
      img.loading = "lazy";
      guardImg(img, item.title);
      node.appendChild(img);
    }
    timeline.appendChild(node);
  });

  /* =========================================================================
     PLATTEGROND — schuifbaar tussen oude en nieuwe indeling,
     kamers klikbaar in beide lagen
     ========================================================================= */
  (function buildFloorPlan() {
    const cfg = CONTENT.floorplan;
    if (!cfg) return;
    const wrap = $("#floorplanWrap");

    const root = el("div", "plan");
    root.style.setProperty("--pos", "50%");
    if (cfg.aspect) root.style.aspectRatio = cfg.aspect;

    function makeLayer(cls, rooms) {
      const layer = el("div", "plan__layer " + cls);
      rooms.forEach((r) => {
        /* met "room" klikbaar; zonder (bijv. kasten) alleen decoratie */
        const node = r.room
          ? el("button", "plan__room")
          : el("div", "plan__room plan__room--static");
        node.style.left = r.x + "%";
        node.style.top = r.y + "%";
        node.style.width = r.w + "%";
        node.style.height = r.h + "%";
        node.appendChild(el("span", null, r.label));
        if (r.room) {
          node.setAttribute("aria-label", "Ga naar " + r.label);
          node.addEventListener("click", () => {
            const target = document.getElementById("ruimte-" + r.room);
            if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        }
        layer.appendChild(node);
      });
      return layer;
    }

    const layerAfter = makeLayer("plan__layer--na", cfg.after);
    const layerBefore = makeLayer("plan__layer--voor", cfg.before);

    const divider = el("div", "ba__divider");
    const handle = el("button", "ba__handle plan__handle");
    handle.innerHTML = "&#8249;&#8250;";
    handle.setAttribute("role", "slider");
    handle.setAttribute("aria-label", "Vergelijk oude en nieuwe indeling");
    handle.setAttribute("aria-valuemin", "0");
    handle.setAttribute("aria-valuemax", "100");
    handle.setAttribute("aria-valuenow", "50");
    const labelBefore = el("span", "ba__label ba__label--before", cfg.labelBefore);
    const labelAfter = el("span", "ba__label ba__label--after", cfg.labelAfter);

    root.append(layerAfter, layerBefore, divider, labelBefore, labelAfter, handle);
    wrap.appendChild(root);
    if (cfg.note) wrap.appendChild(el("p", "plan__note", cfg.note));

    let pos = 50;
    function setPos(next) {
      pos = Math.max(0, Math.min(100, next));
      root.style.setProperty("--pos", pos + "%");
      handle.setAttribute("aria-valuenow", String(Math.round(pos)));
      labelBefore.classList.toggle("is-hidden", pos < 22);
      labelAfter.classList.toggle("is-hidden", pos > 78);
    }

    /* slepen alleen via de knop, zodat de kamers klikbaar blijven */
    let dragging = false;
    handle.addEventListener("pointerdown", (e) => {
      dragging = true;
      root.classList.add("is-dragging");
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const rect = root.getBoundingClientRect();
      setPos(((e.clientX - rect.left) / rect.width) * 100);
    });
    ["pointerup", "pointercancel"].forEach((type) =>
      handle.addEventListener(type, () => {
        dragging = false;
        root.classList.remove("is-dragging");
      })
    );
    handle.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { setPos(pos - 4); e.preventDefault(); }
      if (e.key === "ArrowRight") { setPos(pos + 4); e.preventDefault(); }
      if (e.key === "Home") { setPos(0); e.preventDefault(); }
      if (e.key === "End") { setPos(100); e.preventDefault(); }
    });

    setPos(50);
  })();

  /* ruimtes */
  const roomsList = $("#roomsList");
  CONTENT.rooms.forEach((room, i) => {
    const section = el("article", "room reveal");
    section.id = "ruimte-" + room.id;

    const media = el("div", "room__media");
    /* staande foto's krijgen een smallere, gecentreerde schuif */
    if (room.aspect) {
      const parts = String(room.aspect).split("/").map(Number);
      if (parts.length === 2 && parts[0] < parts[1]) media.classList.add("room__media--portrait");
    }
    media.appendChild(
      createBeforeAfter({
        before: room.before,
        after: room.after,
        name: room.name,
        aspect: room.aspect,
        hotspots: room.hotspots
      })
    );

    const info = el("div", "room__info");
    info.appendChild(el("p", "room__index", String(i + 1).padStart(2, "0") + " / " + String(CONTENT.rooms.length).padStart(2, "0")));
    info.appendChild(el("h3", null, room.name));
    info.appendChild(el("p", "room__tagline", room.tagline));

    const tabBar = el("div", "room__tabs");
    tabBar.setAttribute("role", "tablist");
    const panel = el("div", "room__panel");
    panel.setAttribute("role", "tabpanel");
    const tabNames = Object.keys(room.tabs);
    tabNames.forEach((name, idx) => {
      const tab = el("button", "room__tab" + (idx === 0 ? " is-active" : ""), name);
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", idx === 0 ? "true" : "false");
      tab.addEventListener("click", () => {
        $$(".room__tab", tabBar).forEach((t) => {
          t.classList.remove("is-active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("is-active");
        tab.setAttribute("aria-selected", "true");
        panel.textContent = room.tabs[name];
      });
      tabBar.appendChild(tab);
    });
    panel.textContent = room.tabs[tabNames[0]];

    info.append(tabBar, panel);
    section.append(media, info);
    roomsList.appendChild(section);
  });

  /* de verbouwing in cijfers */
  const funStatsGrid = $("#funStatsGrid");
  CONTENT.funStats.items.forEach((stat, i) => {
    const card = el("div", "funstat reveal");
    card.style.transitionDelay = (i % 4) * 70 + "ms";
    const value = el("div", "stat__value funstat__value", "0");
    value.dataset.target = stat.value;
    value.dataset.suffix = stat.suffix || "";
    value.dataset.noformat = stat.noFormat ? "1" : "";
    card.appendChild(value);
    card.appendChild(el("div", "funstat__label", stat.label));
    funStatsGrid.appendChild(card);
  });

  /* instagram-posts in de footer */
  const instaPosts = $("#instaPosts");
  CONTENT.instaPosts.items.forEach((post, i) => {
    const link = el("a", "insta-post reveal");
    link.style.transitionDelay = (i % 4) * 70 + "ms";
    link.href = post.url;
    link.target = "_blank";
    link.rel = "noopener";
    const img = el("img");
    img.src = post.image;
    img.alt = post.caption;
    img.loading = "lazy";
    guardImg(img, post.caption);
    const caption = el("span", "insta-post__caption", post.caption);
    const icon = el("span", "insta-post__icon");
    icon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/></svg>';
    link.append(img, icon, caption);
    instaPosts.appendChild(link);
  });

  /* galerij */
  const galleryGrid = $("#galleryGrid");
  const phaseLabels = { voor: "Voor", tijdens: "Tijdens", na: "Na" };
  CONTENT.gallery.items.forEach((item, index) => {
    const fig = el("button", "gallery__item reveal");
    fig.style.transitionDelay = (index % 3) * 70 + "ms";
    fig.dataset.phase = item.phase;
    fig.dataset.index = index;
    fig.setAttribute("aria-label", item.caption + " — groot bekijken");

    const img = el("img");
    img.src = item.src;
    img.alt = item.caption;
    img.loading = "lazy";
    guardImg(img, item.caption);

    const tag = el("span", "phase-tag", phaseLabels[item.phase] || item.phase);
    const caption = el("figcaption", null, item.caption);
    fig.append(img, tag, caption);
    fig.addEventListener("click", () => openLightbox(index));
    galleryGrid.appendChild(fig);
  });

  $("#galleryFilters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    $$("#galleryFilters .chip").forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    const filter = chip.dataset.filter;
    $$(".gallery__item").forEach((item) => {
      item.classList.toggle("is-hidden", filter !== "alles" && item.dataset.phase !== filter);
    });
  });

  /* =========================================================================
     LIGHTBOX
     ========================================================================= */
  const lightbox = $("#lightbox");
  const lbImage = $("#lbImage");
  const lbCaption = $("#lbCaption");
  const lbCount = el("p", "lightbox__count");
  $(".lightbox__figure").appendChild(lbCount);
  guardImg(lbImage, "Foto");
  let lbIndex = 0;
  let lbLastFocus = null;

  function visibleGalleryIndexes() {
    return $$(".gallery__item").filter((n) => !n.classList.contains("is-hidden"))
      .map((n) => Number(n.dataset.index));
  }

  function openLightbox(index) {
    if (!lightbox.classList.contains("is-open")) lbLastFocus = document.activeElement;
    lbIndex = index;
    const item = CONTENT.gallery.items[index];
    delete lbImage.dataset.fallback;
    lbImage.src = item.src;
    lbImage.alt = item.caption;
    lbCaption.textContent = item.caption;
    const visible = visibleGalleryIndexes();
    lbCount.textContent = (visible.indexOf(index) + 1) + " / " + visible.length;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $("#lbClose").focus({ preventScroll: true });
    /* buurfoto's alvast laden zodat bladeren direct voelt */
    [1, -1].forEach((dir) => {
      const cur = visible.indexOf(index);
      const nb = visible[(cur + dir + visible.length) % visible.length];
      if (nb != null && nb !== index) { const pre = new Image(); pre.src = CONTENT.gallery.items[nb].src; }
    });
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lbLastFocus && lbLastFocus.focus) lbLastFocus.focus({ preventScroll: true });
  }

  function stepLightbox(dir) {
    const visible = visibleGalleryIndexes();
    if (!visible.length) return;
    const current = visible.indexOf(lbIndex);
    const next = visible[(current + dir + visible.length) % visible.length];
    openLightbox(next);
  }

  $("#lbClose").addEventListener("click", closeLightbox);
  $("#lbPrev").addEventListener("click", () => stepLightbox(-1));
  $("#lbNext").addEventListener("click", () => stepLightbox(1));
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });
  /* vegen op mobiel: links/rechts bladert, omlaag vegen sluit */
  let swipeX = null, swipeY = null;
  lightbox.addEventListener("pointerdown", (e) => { swipeX = e.clientX; swipeY = e.clientY; });
  lightbox.addEventListener("pointerup", (e) => {
    if (swipeX == null) return;
    const dx = e.clientX - swipeX;
    const dy = e.clientY - swipeY;
    swipeX = swipeY = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) stepLightbox(dx < 0 ? 1 : -1);
    else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) closeLightbox();
  });

  /* =========================================================================
     NAVIGATIE
     ========================================================================= */
  const nav = $("#nav");
  const navLinks = $("#navLinks");
  const burger = $("#navBurger");

  window.addEventListener("scroll", () => {
    nav.classList.toggle("is-solid", window.scrollY > 40);
  }, { passive: true });

  /* markeer in het menu bij welke sectie je bent */
  const sectionForLink = {};
  $$(".nav__links a[href^='#']").forEach((a) => {
    const target = document.getElementById(a.getAttribute("href").slice(1));
    if (target) sectionForLink[target.id] = a;
  });
  const navSpy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      $$(".nav__links a").forEach((a) => a.classList.remove("is-active"));
      const link = sectionForLink[entry.target.id];
      if (link) link.classList.add("is-active");
    });
  }, { rootMargin: "-35% 0px -55% 0px" });
  Object.keys(sectionForLink).forEach((id) => navSpy.observe(document.getElementById(id)));

  /* terug-naar-boven-knop */
  const toTop = el("button", "to-top", "↑");
  toTop.setAttribute("aria-label", "Terug naar boven");
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  document.body.appendChild(toTop);
  window.addEventListener("scroll", () => {
    toTop.classList.toggle("is-visible", window.scrollY > 900);
  }, { passive: true });

  burger.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    nav.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", String(open));
  });
  navLinks.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      navLinks.classList.remove("is-open");
      nav.classList.remove("menu-open");
      burger.setAttribute("aria-expanded", "false");
    }
  });

  /* =========================================================================
     REVEAL-ANIMATIES + TELLERS
     ========================================================================= */
  function animateCount(node) {
    const target = Number(node.dataset.target);
    const suffix = node.dataset.suffix;
    const noFormat = node.dataset.noformat === "1";
    const duration = 1400;
    const startTime = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(target * eased);
      node.textContent = (noFormat ? String(value) : value.toLocaleString("nl-NL")) + suffix;
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      $$(".stat__value", entry.target).forEach(animateCount);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });

  $$(".reveal").forEach((node) => observer.observe(node));
})();
