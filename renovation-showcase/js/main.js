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

    const after = el("img");
    after.src = opts.after;
    after.alt = (opts.name || "") + " — na de verbouwing";
    after.loading = "lazy";

    const beforeWrap = el("div", "ba__before");
    const before = el("img");
    before.src = opts.before;
    before.alt = (opts.name || "") + " — voor de verbouwing";
    before.loading = "lazy";
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
  $("#heroSlider").appendChild(
    createBeforeAfter({
      before: CONTENT.hero.before,
      after: CONTENT.hero.after,
      name: "Het appartement",
      start: 55
    })
  );

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
    timeline.appendChild(node);
  });

  /* ruimtes */
  const roomsList = $("#roomsList");
  CONTENT.rooms.forEach((room, i) => {
    const section = el("article", "room reveal");
    section.id = "ruimte-" + room.id;

    const media = el("div", "room__media");
    media.appendChild(
      createBeforeAfter({
        before: room.before,
        after: room.after,
        name: room.name,
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
    const tabNames = Object.keys(room.tabs);
    tabNames.forEach((name, idx) => {
      const tab = el("button", "room__tab" + (idx === 0 ? " is-active" : ""), name);
      tab.setAttribute("role", "tab");
      tab.addEventListener("click", () => {
        $$(".room__tab", tabBar).forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        panel.textContent = room.tabs[name];
      });
      tabBar.appendChild(tab);
    });
    panel.textContent = room.tabs[tabNames[0]];

    info.append(tabBar, panel);
    section.append(media, info);
    roomsList.appendChild(section);
  });

  /* galerij */
  const galleryGrid = $("#galleryGrid");
  const phaseLabels = { voor: "Voor", tijdens: "Tijdens", na: "Na" };
  CONTENT.gallery.items.forEach((item, index) => {
    const fig = el("button", "gallery__item reveal");
    fig.dataset.phase = item.phase;
    fig.dataset.index = index;
    fig.setAttribute("aria-label", item.caption + " — groot bekijken");

    const img = el("img");
    img.src = item.src;
    img.alt = item.caption;
    img.loading = "lazy";

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
  let lbIndex = 0;

  function visibleGalleryIndexes() {
    return $$(".gallery__item").filter((n) => !n.classList.contains("is-hidden"))
      .map((n) => Number(n.dataset.index));
  }

  function openLightbox(index) {
    lbIndex = index;
    const item = CONTENT.gallery.items[index];
    lbImage.src = item.src;
    lbImage.alt = item.caption;
    lbCaption.textContent = item.caption;
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
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

  /* =========================================================================
     NAVIGATIE
     ========================================================================= */
  const nav = $("#nav");
  const navLinks = $("#navLinks");
  const burger = $("#navBurger");

  window.addEventListener("scroll", () => {
    nav.classList.toggle("is-solid", window.scrollY > 40);
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
