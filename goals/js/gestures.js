/* =====================================================================
   GOALS — touch
   =====================================================================
   The three gestures the app uses, in one place. All of them are
   additions: every one has a button, a tab or a menu that does the same
   thing, because a gesture nobody discovers is not a feature.

   Pointer events throughout, so a mouse, a finger and a pencil take the
   same path. Vertical movement always wins — the page must never fight
   you for a scroll.
   ===================================================================== */

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------
   Swipe across an area — tabs, weeks, months
   --------------------------------------------------------------- */
export function swipeArea(element, { onLeft, onRight, threshold = 60 } = {}) {
  let startX = 0, startY = 0, tracking = false, decided = false, horizontal = false;

  const down = event => {
    if (event.pointerType === "mouse") return;          // a mouse has buttons
    if (event.target.closest("input, textarea, select, .chart, .quick, .swipe")) return;
    startX = event.clientX;
    startY = event.clientY;
    tracking = true;
    decided = false;
    horizontal = false;
  };

  const move = event => {
    if (!tracking) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    /* Decide once, early: a scroll stays a scroll. */
    if (!decided && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      decided = true;
      horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
    }
    if (decided && !horizontal) tracking = false;
  };

  const up = event => {
    if (!tracking || !horizontal) { tracking = false; return; }
    const dx = event.clientX - startX;
    tracking = false;
    if (Math.abs(dx) < threshold) return;
    if (dx < 0 && onLeft) onLeft();
    if (dx > 0 && onRight) onRight();
  };

  element.addEventListener("pointerdown", down, { passive: true });
  element.addEventListener("pointermove", move, { passive: true });
  element.addEventListener("pointerup", up, { passive: true });
  element.addEventListener("pointercancel", () => { tracking = false; }, { passive: true });

  return () => {
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", up);
  };
}

/* ---------------------------------------------------------------
   Drag a sheet down to close it
   --------------------------------------------------------------- */
export function dragToDismiss(sheet, close) {
  const handle = sheet.querySelector(".sheet__grip") || sheet.querySelector(".sheet__head");
  if (!handle) return;

  let startY = 0, offset = 0, dragging = false;

  const down = event => {
    if (event.target.closest("button, a, input")) return;
    startY = event.clientY;
    dragging = true;
    offset = 0;
    sheet.style.transition = "none";
    handle.setPointerCapture?.(event.pointerId);
  };

  const move = event => {
    if (!dragging) return;
    offset = Math.max(0, event.clientY - startY);
    sheet.style.transform = `translateY(${offset}px)`;
    /* The backdrop lightens as the sheet leaves, so it feels attached. */
    const backdrop = sheet.parentElement;
    if (backdrop) backdrop.style.opacity = String(Math.max(0.25, 1 - offset / 400));
  };

  const up = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = "";
    const backdrop = sheet.parentElement;

    if (offset > 110) {
      sheet.style.transform = `translateY(${sheet.offsetHeight}px)`;
      if (backdrop) backdrop.style.opacity = "0";
      setTimeout(() => close(null), reduced() ? 0 : 180);
      return;
    }

    sheet.style.transform = "";
    if (backdrop) backdrop.style.opacity = "";
  };

  handle.addEventListener("pointerdown", down);
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", up);
  handle.addEventListener("pointercancel", up);
}

/* ---------------------------------------------------------------
   Swipe a row aside for its actions
   ---------------------------------------------------------------
   Markup:  .swipe > .swipe__actions + .swipe__content
   The same actions stay reachable by opening the row itself, so this
   is a shortcut and never the only way through.
   --------------------------------------------------------------- */
export function swipeRows(root) {
  let open = null;

  const closeOpen = () => {
    if (!open) return;
    open.style.transform = "";
    open.parentElement.classList.remove("is-open");
    open = null;
  };

  root.addEventListener("pointerdown", event => {
    /* A press on the revealed action is that action's own business —
       closing the row here would move the button out from under the
       finger before the tap landed. */
    if (event.target.closest(".swipe__actions")) return;

    const content = event.target.closest(".swipe__content");
    if (!content) { closeOpen(); return; }
    if (open && open !== content) closeOpen();

    const row = content.parentElement;
    const width = row.querySelector(".swipe__actions")?.offsetWidth || 88;
    const startX = event.clientX, startY = event.clientY;
    const base = open === content ? -width : 0;
    let decided = false, horizontal = false, offset = base;

    const move = moveEvent => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (!decided && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        decided = true;
        horizontal = Math.abs(dx) > Math.abs(dy);
        if (horizontal) content.style.transition = "none";
      }
      if (!decided || !horizontal) return;

      offset = Math.min(0, Math.max(-width - 24, base + dx));
      content.style.transform = `translateX(${offset}px)`;
    };

    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      content.style.transition = "";
      if (!decided || !horizontal) return;

      if (offset < -width / 2) {
        content.style.transform = `translateX(${-width}px)`;
        row.classList.add("is-open");
        open = content;
      } else {
        content.style.transform = "";
        row.classList.remove("is-open");
        if (open === content) open = null;
      }
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", finish, { passive: true });
    window.addEventListener("pointercancel", finish, { passive: true });
  }, { passive: true });

  /* An action closes the row it came from. */
  root.addEventListener("click", event => {
    if (event.target.closest(".swipe__actions")) closeOpen();
  });

  return closeOpen;
}

/* A row wrapped with its actions. */
export function swipeRow(content, actions) {
  return `
    <div class="swipe">
      <div class="swipe__actions">${actions}</div>
      <div class="swipe__content">${content}</div>
    </div>`;
}
