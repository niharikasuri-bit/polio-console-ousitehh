/**
 * Polio Vaccination :: Form Configurator
 * Interactive mock driven by window.DIGIT_MODULE (see data.js).
 * No backend — all edits mutate the in-memory module object.
 */
(function () {
  "use strict";

  const MODULE = window.DIGIT_MODULE;

  // Transient drag-to-reorder state — not part of `state` since it doesn't
  // need to survive a re-render or be inspected anywhere else.
  let draggedFieldId = null;

  const state = {
    activeNav: "flows", // 'flows' | 'form-elements' | 'roles'
    expanded: new Set(["vaccination-location"]),
    search: "",
    activeScreenId: "select-vaccination-location",
    activeElementId: null, // set when drilled into an element's properties view
    fieldTab: "elements", // 'elements' | 'logic', within the element properties view
    activeStateSubId: null, // set when drilled into one of a dynamic element's states
    stateSubTab: "elements", // 'elements' | 'logic', within that state's own properties view
  };

  // ---------- helpers ----------

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function flatScreens() {
    return MODULE.categories.flatMap((cat) =>
      cat.screens.map((s) => ({ ...s, _catKey: cat.key, _catLabel: cat.label }))
    );
  }

  function findScreen(id) {
    for (const cat of MODULE.categories) {
      const s = cat.screens.find((s) => s.id === id);
      if (s) return s;
    }
    return null;
  }

  function categoryOf(screenId) {
    return MODULE.categories.find((c) => c.screens.some((s) => s.id === screenId));
  }

  // A flow item's tabs: every screen in its category sharing the same `item`.
  function tabsOf(screenId) {
    const cat = categoryOf(screenId);
    const screen = findScreen(screenId);
    return cat && screen ? cat.screens.filter((s) => s.item === screen.item) : [];
  }

  // The Flows panel lists flow items, not screens — one entry per distinct
  // `item`, opening on its first tab.
  function flowItemsOf(cat) {
    const items = [];
    cat.screens.forEach((s) => {
      if (!items.some((it) => it.name === s.item)) items.push({ name: s.item, firstScreenId: s.id });
    });
    return items;
  }

  function badgeClasses(badge) {
    switch (badge) {
      case "Locked":
        return "bg-gray-100 text-gray-500";
      case "Fully Configurable":
        return "bg-emerald-50 text-emerald-700";
      default: // Partially Configurable
        return "bg-amber-50 text-amber-700";
    }
  }

  function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.remove("opacity-0", "translate-y-2");
    el.classList.add("opacity-100", "translate-y-0");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.classList.add("opacity-0", "translate-y-2");
      el.classList.remove("opacity-100", "translate-y-0");
    }, 2200);
  }

  // ---------- Flows panel ----------

  function matchesSearch(item) {
    if (!state.search) return true;
    return item.name.toLowerCase().includes(state.search.toLowerCase());
  }

  function renderFlowsPanel() {
    const root = document.getElementById("flows-panel");
    if (state.activeNav !== "flows") {
      root.innerHTML = "";
      return;
    }

    const term = state.search.trim();
    const groups = MODULE.categories.map((cat) => {
      const items = flowItemsOf(cat).filter(matchesSearch);
      return { ...cat, items };
    });

    const anyFilter = term.length > 0;

    const groupsHtml = groups
      .filter((g) => !anyFilter || g.items.length > 0)
      .map((g) => {
        const isOpen = anyFilter ? true : state.expanded.has(g.key);
        const activeItem = findScreen(state.activeScreenId)?.item;
        const activeCat = categoryOf(state.activeScreenId)?.key;
        const itemsHtml = g.items
          .map((it) => {
            const active = g.key === activeCat && it.name === activeItem;
            return `
              <button
                type="button"
                data-screen-id="${escapeHtml(it.firstScreenId)}"
                class="flow-item w-full text-left px-4 py-3 text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                  active ? "bg-blue-50 text-[#c2410c] font-medium" : "text-gray-700 hover:bg-gray-50"
                }"
              >${escapeHtml(it.name)}</button>`;
          })
          .join("");

        return `
          <div class="flow-category">
            <button
              type="button"
              data-cat-key="${escapeHtml(g.key)}"
              class="cat-toggle w-full flex items-center justify-between px-1 py-2 text-[15px] font-semibold text-[#191D88]"
            >
              <span>${escapeHtml(g.label)}</span>
              <svg class="w-4 h-4 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}" viewBox="0 0 20 20" fill="none">
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="border border-gray-200 rounded-md overflow-hidden mb-3 ${isOpen ? "" : "hidden"}">
              ${itemsHtml || `<div class="px-4 py-3 text-sm text-gray-400">No screens</div>`}
            </div>
          </div>`;
      })
      .join("");

    root.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-800">Flows</h2>
        <button id="close-flows" type="button" class="text-gray-400 hover:text-gray-600" aria-label="Close flows panel">
          <svg class="w-5 h-5" viewBox="0 0 20 20" fill="none"><path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="relative mb-4">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M17 17L13.5 13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input id="flow-search" type="text" value="${escapeHtml(state.search)}" placeholder="Flows"
          class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c]"/>
      </div>
      ${groupsHtml}
    `;

    document.getElementById("flow-search").addEventListener("input", (e) => {
      state.search = e.target.value;
      renderFlowsPanel();
    });
    document.getElementById("close-flows").addEventListener("click", () => {
      state.activeNav = null;
      render();
    });
    root.querySelectorAll(".cat-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.catKey;
        if (state.expanded.has(key)) state.expanded.delete(key);
        else state.expanded.add(key);
        renderFlowsPanel();
      });
    });
    root.querySelectorAll(".flow-item").forEach((btn) => {
      btn.addEventListener("click", () => selectScreen(btn.dataset.screenId));
    });
  }

  function selectScreen(id) {
    const previousScreen = findScreen(state.activeScreenId);
    if (previousScreen) resetStatePreviews(previousScreen, null);
    state.activeScreenId = id;
    state.activeElementId = null;
    state.activeStateSubId = null;
    const cat = categoryOf(id);
    if (cat) state.expanded.add(cat.key);
    render();
  }

  // ---------- Tabs + canvas ----------

  // Fixed tabs: one per screen of the active flow item (a flow item can have
  // one tab or several). Not closable.
  function renderTabs() {
    const root = document.getElementById("tabs-row");
    const tabs = tabsOf(state.activeScreenId);
    if (!tabs.length) {
      root.innerHTML = "";
      return;
    }
    root.setAttribute("role", "tablist");
    root.setAttribute("aria-label", tabs[0].item);
    root.innerHTML = tabs
      .map((s) => {
        const active = s.id === state.activeScreenId;
        return `
          <button type="button" role="tab" aria-selected="${active}" data-tab-id="${escapeHtml(s.id)}"
            class="tab-pill px-3 py-2 -mb-[9px] text-sm whitespace-nowrap border-b-2 ${
              active ? "border-[#c2410c] text-[#c2410c] font-medium" : "border-transparent text-gray-500 hover:text-gray-700"
            }">${escapeHtml(s.name)}</button>`;
      })
      .join("");

    root.querySelectorAll(".tab-pill").forEach((el) => {
      el.addEventListener("click", () => selectScreen(el.dataset.tabId));
    });
  }

  // Every element rendered in the phone preview is clickable — it opens the
  // same properties drawer as clicking its card in the side panel (see the
  // ".canvas-el" wiring in renderCanvas).
  const CANVAS_EL_CLASS = "canvas-el cursor-pointer hover:ring-2 hover:ring-[#191D88]/40 transition-shadow";
  const canvasElAttr = (el) => `data-canvas-el-id="${escapeHtml(el.id)}"`;

  // Marks text that will be replaced by real record data at runtime (a
  // beneficiary's actual name, address, age...) — a dashed underline,
  // distinct from a label/heading, which is the static text an admin
  // configures and that always shows as-is in the real app.
  // Not italic — italics hurt legibility/accessibility for a lot of readers.
  // The dashed underline alone is the "this is placeholder data" signal, and
  // text-gray-600 keeps ~7:1 contrast on white (passes WCAG AA/AAA), unlike
  // the lighter gray-400 this used to be.
  const dynamicValue = (text) =>
    `<span class="text-gray-600 border-b border-dashed border-gray-400 inline-block min-w-[3rem]">${escapeHtml(
      text || ""
    )}</span>`;

  // Same placeholder marker inside the APK preview, but in the text's own
  // colour (a teal heading stays teal) — styled by .dyn in apk.css.
  const dyn = (text) => `<span class="dyn">${escapeHtml(text || "")}</span>`;

  // The screen currently in the phone preview — buttons need it to work out
  // whether a state they depend on (e.g. "Not Found" for Create) is active.
  let previewScreen = null;

  // Polio app artwork (copied from polio-app/app.js).
  const APK_ICON = {
    back: '<svg viewBox="0 0 8 10" aria-hidden="true"><path d="M7 0v10L0 5z" fill="currentColor"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M9.2 9.2a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.5-2.8 4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.2" fill="currentColor"/></svg>',
    person: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08a7.2 7.2 0 0 1-6 3.22z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="2"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    caret: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>',
    "add-circle": '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>',
    check: '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="3"/><path d="m14 24.5 7 7 13-14" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>',
    outdoor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22.17 9.17c0-3.91-3.19-7.06-7.11-7-3.83.06-6.99 3.37-6.88 7.19.09 3.38 2.58 6.16 5.83 6.7V20H6v-3h1v-4c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v4h1v5h16v-2h-3v-3.88c3.47-.41 6.17-3.36 6.17-6.95zM4.5 11c.83 0 1.5-.67 1.5-1.5S5.33 8 4.5 8 3 8.67 3 9.5 3.67 11 4.5 11z"/></svg>',
    groups: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58C.48 14.9 0 15.62 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85-.85-.37-1.79-.58-2.78-.58-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/></svg>',
    tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gps: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="m4.8 8.2 2.2 2.2 4.2-4.6" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11z"/></svg>',
    notFound: '<svg class="empty-art" viewBox="0 0 160 124" fill="none" aria-hidden="true">'
      + '<ellipse cx="80" cy="114" rx="52" ry="5" fill="#D6D5D4"/>'
      + '<circle cx="80" cy="60" r="50" fill="#DEEFFF"/>'
      + '<path d="M38 52h16M30 60h10M120 40h14M126 48h8" stroke="#B1C9D6" stroke-width="3" stroke-linecap="round"/>'
      + '<path d="M70 26c-12.2 0-22 9.4-22 21.1C48 63.2 70 86 70 86s22-22.8 22-38.9C92 35.4 82.2 26 70 26z" fill="#0B4B66"/>'
      + '<circle cx="70" cy="47" r="8" fill="#fff"/>'
      + '<circle cx="102" cy="74" r="17" fill="#fff" stroke="#C84C0E" stroke-width="5"/>'
      + '<path d="m114.5 86.5 12 12" stroke="#C84C0E" stroke-width="7" stroke-linecap="round"/>'
      + '<path d="M97 69.5a5 5 0 1 1 7.2 4.5c-1.5.8-2.2 1.8-2.2 3.3" stroke="#0B4B66" stroke-width="3" stroke-linecap="round"/>'
      + '<circle cx="102" cy="82.6" r="1.9" fill="#0B4B66"/>'
      + '</svg>',
  };

  function searchbarPill(el) {
    return `
      <div class="${CANVAS_EL_CLASS} flex-1 min-w-0 h-10 flex items-center gap-2 border border-gray-300 rounded-md px-3 bg-white" ${canvasElAttr(
        el
      )}>
        <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M17 17L13.5 13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <span class="text-xs text-gray-400 truncate">${escapeHtml(el.placeholder)}</span>
      </div>`;
  }

  function buttonIcon(name) {
    switch (name) {
      case "filter":
        return `<svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none"><path d="M3 4h14l-5.25 6.12V16l-3.5-1.75v-4.13L3 4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
      case "download":
        return `<svg class="w-4 h-4" viewBox="0 0 20 20" fill="none"><path d="M10 3v9m0 0l-3-3m3 3l3-3M4 14v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      case "person-add":
        return `<svg class="w-4 h-4" viewBox="0 0 20 20" fill="none"><circle cx="8" cy="7" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M15.5 6v4M13.5 8h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
      case "qr":
        return `<svg class="w-4 h-4" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="5" height="5" stroke="currentColor" stroke-width="1.4"/><rect x="12" y="3" width="5" height="5" stroke="currentColor" stroke-width="1.4"/><rect x="3" y="12" width="5" height="5" stroke="currentColor" stroke-width="1.4"/><path d="M12 12h2v2h-2zM16 12h1M12 16h1M15 16h2v1h-2z" fill="currentColor"/></svg>`;
      case "edit":
        return `<svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none"><path d="M13.5 3.5l3 3-9 9-3.5.5.5-3.5 9-9z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      case "add-circle":
        return `<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="9"/><path d="M10 6v8M6 10h8" stroke="white" stroke-width="1.6" stroke-linecap="round"/></svg>`;
      default:
        return "";
    }
  }

  // APK buttons: primary (filled orange) or secondary (white, orange border).
  // A button tied to a state (enabledInState, e.g. Create — only usable once
  // a search finds nothing) shows faded unless that state is being previewed.
  function isButtonDisabled(el) {
    if (!el.enabledInState || !previewScreen) return false;
    const holder = previewScreen.elements.find((x) => x.id === el.enabledInState.holder);
    return !(holder && holder.visible && holder.activeStateId === el.enabledInState.state);
  }

  function buttonMarkup(el) {
    const style = el.style === "primary" ? "btn-primary" : "btn-secondary";
    return `<div class="${CANVAS_EL_CLASS} btn ${style} ${isButtonDisabled(el) ? "is-disabled" : ""}" ${canvasElAttr(el)}>${
      APK_ICON[el.icon] || ""
    }${escapeHtml(el.text)}</div>`;
  }

  // Standalone (non-inline) buttons are pinned in the phone's bottom footer,
  // not the scrolling content area. Inline buttons (e.g. Filter, merged next
  // to a searchbar) and contextual buttons (e.g. an "Open" action next to a
  // result row, not a full-width page action) stay with the content instead.
  function isFooterButton(el) {
    return el.type === "button" && !el.inlineWithSearch && !el.contextual;
  }

  // A dynamic element with `states` (e.g. Delivery Status) can gate other
  // elements — usually buttons — to only its currently-active state. Any
  // button referenced by ANY state is "controlled": it only renders while
  // the state that lists it is the active one. With no active state (the
  // default, uncluttered view), every controlled button stays hidden.
  // Normalizes a state's controlled elements to [{id, required}], regardless
  // of which of the two shapes it was authored with:
  // - `elementIds: [...]` (legacy/simple — e.g. Delivery Status's buttons):
  //   flat list, always required, all-or-nothing per state.
  // - `elements: [{id, required}, ...]` (e.g. Search Results): per-element
  //   control — required ones always show when the state is active,
  //   optional ones can be toggled off via elementOverrides.
  function stateElementEntries(s) {
    if (s.elements) return s.elements;
    return (s.elementIds || []).map((id) => ({ id, required: true }));
  }

  function computeStateGating(screen) {
    const controlledIds = new Set();
    const allowedIds = new Set();
    screen.elements.forEach((el) => {
      if (!el.states) return;
      el.states.forEach((s) => stateElementEntries(s).forEach((entry) => controlledIds.add(entry.id)));
      if (!el.visible) return; // a hidden dynamic element grants nothing, regardless of activeStateId
      const active = el.activeStateId && el.states.find((s) => s.id === el.activeStateId);
      if (!active) return;
      const overrides = active.elementOverrides || {};
      stateElementEntries(active).forEach((entry) => {
        if (entry.required || overrides[entry.id] !== false) allowedIds.add(entry.id);
      });
    });
    return { controlledIds, allowedIds };
  }

  // Clears any active state preview on a screen's states-driven elements
  // (e.g. Delivery Status) — collapsing back to the generic default tag —
  // except the one given (if any). Returns whether anything actually
  // changed, so callers know whether a re-render is needed.
  function resetStatePreviews(screen, exceptElId) {
    let changed = false;
    screen.elements.forEach((el) => {
      if (el.states && el.id !== exceptElId && el.activeStateId) {
        el.activeStateId = null;
        changed = true;
      }
    });
    return changed;
  }

  function isEffectivelyVisible(el, gating) {
    if (gating.controlledIds.has(el.id)) return el.visible && gating.allowedIds.has(el.id);
    return el.visible;
  }

  // Same idea as resetStatePreviews, but for a "replaces" pair (e.g.
  // "Download Beneficiary IDs" swapped in for "Register New Beneficiary")
  // — clicking on anything else in the UI puts the pair back to its
  // default (the replacer hidden, the replaced one showing again).
  function resetReplacePreviews(screen, exceptElId) {
    let changed = false;
    screen.elements.forEach((el) => {
      if (!el.replaces) return;
      if (el.id === exceptElId || el.replaces === exceptElId) return; // this pair is what was just clicked — leave it
      if (el.visible) {
        el.visible = false;
        const replaced = screen.elements.find((x) => x.id === el.replaces);
        if (replaced) replaced.visible = true;
        changed = true;
      }
    });
    return changed;
  }

  // Same idea again, but for a "peek" element (el.peek) — no toggle of its
  // own, hidden by default, with nothing else it swaps places with (e.g.
  // the Low Beneficiary ID popup). Clicking on anything else puts it back
  // to hidden.
  function resetPeekPreviews(screen, exceptElId) {
    let changed = false;
    screen.elements.forEach((el) => {
      if (!el.peek || el.id === exceptElId) return;
      if (el.visible) {
        el.visible = false;
        changed = true;
      }
    });
    return changed;
  }

  // Clicking any element (in Page Properties or the canvas) should let you
  // see it in context: if it's already showing (not gated, or its owning
  // state is active), leave the preview alone — for buttons it'll just get
  // highlighted. If it's gated by a state that isn't active — a button, a
  // whole result card, anything — switch to the first state that includes
  // it so it actually appears. Returns whether any state preview changed.
  function revealElementInPreview(screen, targetEl, { fromCanvas = false } = {}) {
    // Clicking on anything else resets any "replaces" pair (e.g. Download
    // Beneficiary IDs / Register New Beneficiary) and any "peek" element
    // (e.g. a popup) back to their defaults — same idea as clearing an
    // unrelated state preview below.
    const replaceReset = resetReplacePreviews(screen, targetEl.id);
    const peekReset = resetPeekPreviews(screen, targetEl.id);

    // e.g. "Download Beneficiary IDs" also opens its alert popup — but only
    // when actually clicked in the live preview itself. Clicking its card
    // in Page Properties should just reveal/swap the button, the way every
    // other card click does, without also popping the alert open.
    let popupOpened = false;
    if (fromCanvas && targetEl.triggersPopup) {
      const popup = screen.elements.find((x) => x.id === targetEl.triggersPopup);
      if (popup && !popup.visible) {
        popup.visible = true;
        popupOpened = true;
      }
    }

    // A button that explicitly "replaces" another (e.g. "Download
    // Beneficiary IDs" vs. "Register New Beneficiary") isn't gated by a
    // states group — clicking whichever one of the pair is currently
    // hidden reveals it and hides its counterpart in its place.
    if (!targetEl.visible) {
      if (targetEl.replaces) {
        targetEl.visible = true;
        const replaced = screen.elements.find((x) => x.id === targetEl.replaces);
        if (replaced) replaced.visible = false;
        resetStatePreviews(screen, null); // none of these are gated by a states group — clear any unrelated one
        return true;
      }
      const replacer = screen.elements.find((x) => x.replaces === targetEl.id && x.visible);
      if (replacer) {
        targetEl.visible = true;
        replacer.visible = false;
        resetStatePreviews(screen, null);
        return true;
      }
      // A "peek" element has nothing to swap with — clicking it just
      // reveals it on its own.
      if (targetEl.peek) {
        targetEl.visible = true;
        resetStatePreviews(screen, null);
        return true;
      }
    }
    const gating = computeStateGating(screen);
    if (!gating.controlledIds.has(targetEl.id)) {
      return resetStatePreviews(screen, null) || replaceReset || peekReset || popupOpened; // not gated — clear any unrelated preview
    }
    if (isEffectivelyVisible(targetEl, gating)) return replaceReset || peekReset || popupOpened; // already showing under the current preview
    for (const el of screen.elements) {
      if (!el.states) continue;
      const owningState = el.states.find((s) => stateElementEntries(s).some((entry) => entry.id === targetEl.id));
      if (owningState) {
        resetStatePreviews(screen, el.id);
        el.activeStateId = owningState.id;
        return true;
      }
    }
    return replaceReset || peekReset || popupOpened;
  }

  // Shared by both click entry points (Page Properties cards and the
  // canvas): clicking a states-holder itself (e.g. Delivery Status) must
  // never clear its own preview, but clicking anything else should reveal
  // it if some other state is hiding it, or clear an unrelated preview
  // otherwise. Returns whether any state preview changed.
  function handleElementPreviewClick(screen, clickedEl, opts) {
    if (!clickedEl) return false;
    if (clickedEl.states) return resetStatePreviews(screen, clickedEl.id);
    return revealElementInPreview(screen, clickedEl, opts);
  }

  // Which card should Page Properties scroll to for a given clicked
  // element? If it's a states-holder itself (e.g. Delivery Status), its own
  // card. If it's gated by one (e.g. Redose, only shown under a state),
  // the owning states-holder's card — that's the useful context, not the
  // button buried in a "Buttons" group further down. Otherwise, its own.
  function scrollTargetIdFor(screen, clickedEl) {
    if (clickedEl.states) return clickedEl.id;
    for (const el of screen.elements) {
      if (el.states && el.states.some((s) => stateElementEntries(s).some((entry) => entry.id === clickedEl.id))) return el.id;
    }
    return clickedEl.id;
  }

  // Scrolls Page Properties so the given element's card is in view —
  // clicking something in the phone preview shouldn't leave you hunting
  // for it in a long list.
  function scrollPropertiesToElement(elId) {
    const node = document.querySelector(`#properties-panel [data-el-card-id="${elId}"]`);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Briefly rings the given element in the canvas — used so clicking a
  // button (or anything else) in Page Properties visibly points at it.
  function highlightCanvasElement(elId) {
    const node = document.querySelector(`#canvas [data-canvas-el-id="${elId}"]`);
    if (!node) return;
    node.classList.add("ring-2", "ring-[#c2410c]", "ring-offset-2");
    clearTimeout(highlightCanvasElement._timer);
    highlightCanvasElement._timer = setTimeout(() => {
      node.classList.remove("ring-2", "ring-[#c2410c]", "ring-offset-2");
    }, 1600);
  }

  // Two independently-configurable caption values shown on one line,
  // separated by "|" (e.g. Gender | Age) — each stays its own clickable
  // element in the canvas, not merged into a single one.
  function captionPairMarkup(a, b) {
    const valueSpan = (el) =>
      `<span class="${CANVAS_EL_CLASS} rounded-md" ${canvasElAttr(el)}>${dynamicValue(el.value || el.label)}</span>`;
    return `<div class="flex items-center gap-1.5 text-sm text-gray-500 mb-3">${valueSpan(a)}<span class="text-gray-300">|</span>${valueSpan(
      b
    )}</div>`;
  }

  // Renders a flat run of elements, merging:
  // - a heading-style text template with an immediately-following
  //   "inlineWithText" button (e.g. a member name + its "Edit" action)
  // - two consecutive caption text templates flagged "joinNext" onto one
  //   line (e.g. Gender | Age — still two separate configurable elements)
  // Used both for top-level content and for an inner card's contents.
  function renderElementSequence(items) {
    let html = "";
    let i = 0;
    while (i < items.length) {
      const el = items[i];
      const next = items[i + 1];
      if (el.type === "textTemplate" && next && next.type === "button" && next.inlineWithText) {
        html += `<div class="flex items-center justify-between gap-2 mb-2">${elementHtml(el)}${buttonMarkup(next, {
          inline: true,
        })}</div>`;
        i += 2;
        continue;
      }
      if (el.type === "textTemplate" && el.joinNext && next && next.type === "textTemplate") {
        html += captionPairMarkup(el, next);
        i += 2;
        continue;
      }
      html += elementHtml(el);
      i += 1;
    }
    return html;
  }

  // A nested gray "member card" inside an outer white card — groups a run
  // of consecutive innerCard elements together.
  function renderInnerCardGroups(items) {
    let html = "";
    let i = 0;
    while (i < items.length) {
      const el = items[i];
      if (el.innerCard) {
        const group = [];
        while (i < items.length && items[i].innerCard) {
          group.push(items[i]);
          i += 1;
        }
        html += `<div class="bg-[#F2F2F2] rounded-lg p-4 mb-3 [&>*:last-child]:mb-0">${renderElementSequence(group)}</div>`;
        continue;
      }
      // Collect a run of consecutive non-innerCard elements together (not
      // one at a time) so pairing logic in renderElementSequence — e.g. a
      // heading + its button — can actually see the next sibling.
      const run = [];
      while (i < items.length && !items[i].innerCard) {
        run.push(items[i]);
        i += 1;
      }
      html += renderElementSequence(run);
    }
    return html;
  }

  // Renders a screen's visible, non-footer elements. Content sits directly on
  // the page background — things that get their own container are: a
  // searchbar (its own pill, optionally merged with an inline Filter button),
  // any run of consecutive form fields (grouped into one shared card), and
  // any run of consecutive "outerCard" elements (grouped into one shared
  // white card, which can itself contain a nested "innerCard" group).
  function renderElementsHtml(elements, gating) {
    // A button that belongs to a popup (el.popupId) renders inside that
    // popup's own overlay card, not in the normal scrolling content.
    // Location tags render above the page heading (see renderCanvas); a
    // success panel's buttons render inside that panel.
    const visible = elements.filter(
      (el) =>
        isEffectivelyVisible(el, gating) && !isFooterButton(el) && !el.popupId && !el.panelId && el.type !== "locationTag"
    );
    let html = "";
    let i = 0;
    while (i < visible.length) {
      const el = visible[i];
      const next = visible[i + 1];

      if (el.outerCard) {
        const group = [];
        while (i < visible.length && visible[i].outerCard) {
          group.push(visible[i]);
          i += 1;
        }
        html += `<div class="bg-white rounded-xl shadow-sm p-5 mb-4 [&>*:last-child]:mb-0">${renderInnerCardGroups(
          group
        )}</div>`;
        continue;
      }

      if (el.type === "searchbar" && next && next.type === "button" && next.inlineWithSearch) {
        html += `<div class="flex items-center gap-2 mb-4">${searchbarPill(el)}${buttonMarkup(next, { inline: true })}</div>`;
        i += 2;
        continue;
      }

      if (el.type === "metricTotal" || el.type === "metricGender") {
        const group = [];
        while (i < visible.length && (visible[i].type === "metricTotal" || visible[i].type === "metricGender")) {
          group.push(visible[i]);
          i += 1;
        }
        html += `<div class="card">${group.map(elementHtml).join("")}</div>`;
        continue;
      }

      if (el.type === "checkItem") {
        const group = [];
        while (i < visible.length && visible[i].type === "checkItem") {
          group.push(visible[i]);
          i += 1;
        }
        html += `<div class="card"><div class="checklist">${group.map(elementHtml).join("")}</div></div>`;
        continue;
      }

      if (el.type === "field") {
        const group = [];
        while (i < visible.length && visible[i].type === "field") {
          group.push(visible[i]);
          i += 1;
        }
        html += `<div class="card">${group.map(fieldInnerHtml).join("")}</div>`;
        continue;
      }

      html += elementHtml(el);
      i += 1;
    }
    return html;
  }

  function elementHtml(el) {
    switch (el.type) {
      case "searchbar":
        return `<div class="${CANVAS_EL_CLASS} search" ${canvasElAttr(el)}>${APK_ICON.search}<div class="input">${escapeHtml(
          el.placeholder
        )}</div></div>`;
      case "resultGroup":
        // A placeholder card — not a small tag/pill, since this stands in
        // for a whole content section, not a single value — representing
        // the states-driven element in the default/uncluttered view. Once
        // a specific result state is being previewed, the real content it
        // gates (the found result, the empty state, etc.) takes over
        // instead, so the card steps aside.
        if (el.activeStateId) return "";
        return `<div class="${CANVAS_EL_CLASS} result-placeholder" ${canvasElAttr(el)}>${dyn(el.label)}</div>`;
      case "emptyState":
        return `
          <div class="${CANVAS_EL_CLASS} empty" ${canvasElAttr(el)}>
            ${APK_ICON.notFound}
            <h3>${escapeHtml(el.title)}</h3>
            <p>${escapeHtml(el.message)}</p>
          </div>`;
      case "button":
        return buttonMarkup(el);
      case "list":
        return `
          <div class="${CANVAS_EL_CLASS} bg-white border border-gray-200 rounded-md overflow-hidden mb-3" ${canvasElAttr(el)}>
            ${el.items
              .map(
                (it) => `
              <div class="px-3 py-2.5 border-b border-gray-100 last:border-b-0">
                <div class="text-sm text-gray-800">${escapeHtml(it.title)}</div>
                <div class="text-xs text-gray-500">${escapeHtml(it.subtitle)}</div>
              </div>`
              )
              .join("")}
          </div>`;
      case "field":
        // Lone field rendered outside a group (defensive fallback — normally
        // renderElementsHtml groups consecutive fields into one shared card).
        return `<div class="bg-white rounded-xl shadow-sm p-4 mb-4">${fieldInnerHtml(el)}</div>`;
      case "card":
        return `
          <div class="${CANVAS_EL_CLASS} bg-white border border-gray-200 rounded-md p-3 mb-3" ${canvasElAttr(el)}>
            <div class="text-sm font-medium text-gray-800">${dynamicValue(el.title)}</div>
            <div class="text-xs text-gray-500">${dynamicValue(el.subtitle)}</div>
          </div>`;
      case "success":
        return `
          <div class="${CANVAS_EL_CLASS} flex flex-col items-center text-center py-8 rounded-md" ${canvasElAttr(el)}>
            <div class="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <svg class="w-7 h-7 text-emerald-600" viewBox="0 0 24 24" fill="none"><path d="M5 12.5L9.5 17L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="text-sm font-medium text-[#191D88]">${escapeHtml(el.message)}</div>
          </div>`;
      case "textTemplate":
        // A heading/caption/plain textTemplate has no separate static label
        // — the whole line IS the dynamic value (a placeholder for the real
        // beneficiary's name, age, etc.), so the whole thing gets the marker.
        if (el.variant === "heading") {
          return `<div class="${CANVAS_EL_CLASS} text-base font-semibold text-gray-800 rounded-md" ${canvasElAttr(
            el
          )}>${dynamicValue(el.value || el.label)}</div>`;
        }
        if (el.variant === "caption") {
          return `<div class="${CANVAS_EL_CLASS} text-sm text-gray-500 mb-3 rounded-md" ${canvasElAttr(el)}>${dynamicValue(
            el.value || el.label
          )}</div>`;
        }
        if (el.variant === "plain") {
          return `<div class="${CANVAS_EL_CLASS} text-sm text-gray-700 mb-1.5 rounded-md" ${canvasElAttr(el)}>${dynamicValue(
            el.value || el.label
          )}</div>`;
        }
        return `
          <div class="${CANVAS_EL_CLASS} mb-3 rounded-md" ${canvasElAttr(el)}>
            <div class="text-xs text-gray-500 mb-0.5">${escapeHtml(el.label)}</div>
            <div class="text-sm font-medium text-gray-800">${dynamicValue(el.value || "")}</div>
          </div>`;
      case "labelPairList":
        return `
          <div class="${CANVAS_EL_CLASS} card" ${canvasElAttr(el)}>
            <dl class="pairs">
              ${(el.pairs || [])
                .filter((p) => p.enabled !== false)
                .map((p) => `<div class="pair"><dt>${escapeHtml(p.label)}</dt><dd>${dyn(p.value)}</dd></div>`)
                .join("")}
            </dl>
          </div>`;
      case "locationTag":
        // Part of the screen's chrome, not a configurable element — not
        // clickable and not listed in Page Properties.
        return `<div class="tag">${APK_ICON.person}<span>${dyn(el.value)}</span></div>`;
      case "optionCard":
        return `
          <div class="${CANVAS_EL_CLASS} option-card" ${canvasElAttr(el)}>
            ${APK_ICON[el.icon] || ""}
            <span><span class="option-title">${escapeHtml(el.title)}</span><span class="option-sub">${escapeHtml(el.description)}</span></span>
          </div>`;
      case "locationCard":
        return `
          <div class="${CANVAS_EL_CLASS} loc-card" ${canvasElAttr(el)}>
            <div class="loc-head">
              <h3 class="loc-name">${dyn(el.value)}</h3>
              ${el.badge ? `<span class="recent-badge">${escapeHtml(el.badge)}</span>` : ""}
            </div>
            <dl class="loc-rows">
              ${(el.pairs || [])
                .filter((p) => p.enabled !== false)
                .map((p) => `<div><dt>${escapeHtml(p.label)}</dt><dd>${dyn(p.value)}</dd></div>`)
                .join("")}
            </dl>
            <div class="btn btn-secondary loc-select">${escapeHtml(el.buttonText)}</div>
          </div>`;
      case "searchMeta":
        return `<p class="${CANVAS_EL_CLASS} search-meta" ${canvasElAttr(el)}>${dyn(el.value)}</p>`;
      case "sectionTitle":
        // Fixed heading, like the location tag — not a configurable element.
        return `<h2 class="section-title">${escapeHtml(el.text)}</h2>`;
      case "metricTotal":
        return `
          <div class="${CANVAS_EL_CLASS} metric-total" ${canvasElAttr(el)}>
            <p class="metric-value">${dyn(el.value)}</p>
            <p class="metric-label">${escapeHtml(el.text)}</p>
          </div>`;
      case "metricGender":
        return `
          <div class="${CANVAS_EL_CLASS} chips" ${canvasElAttr(el)}>
            ${(el.pairs || [])
              .filter((p) => p.enabled !== false)
              .map((p) => `<div class="chip"><b>${dyn(p.value)}</b>${escapeHtml(p.label)}</div>`)
              .join("")}
          </div>`;
      case "checkItem":
        // Always ticked and read-only — the vaccinator confirms, not edits.
        // Consecutive items share one card (see renderElementsHtml).
        return `<div class="${CANVAS_EL_CLASS} checkbox" ${canvasElAttr(el)}><span class="box">${APK_ICON.tick}</span>${escapeHtml(
          el.label
        )}</div>`;
      case "successPanel": {
        // The page heading sits inside the green panel, the description in the
        // white card below it, then the panel's own buttons (panelId).
        const panelButtons = (previewScreen ? previewScreen.elements : []).filter(
          (b) => b.type === "button" && b.panelId === el.id && b.visible
        );
        return `
          <div class="card">
            <div class="${CANVAS_EL_CLASS} success-panel" ${canvasElAttr(el)}>
              ${APK_ICON.check}
              <h1 class="success-title">${escapeHtml(previewScreen ? previewScreen.pageHeading : "")}</h1>
            </div>
            <p class="success-desc">${escapeHtml(previewScreen ? previewScreen.pageDescription : "")}</p>
            ${panelButtons.length ? `<div class="panel-actions">${panelButtons.map(buttonMarkup).join("")}</div>` : ""}
          </div>`;
      }
      case "labelValueRow":
        // Same "bold label, plain value" row as labelPairList, but as its
        // own independently-configurable element (e.g. "Member in House").
        // Label = static text an admin configures; value = dynamic data.
        return `
          <div class="${CANVAS_EL_CLASS} flex items-center justify-between mb-2 rounded-md" ${canvasElAttr(el)}>
            <span class="text-sm font-bold text-gray-900">${escapeHtml(el.label)}</span>
            <span class="text-sm text-gray-700">${dynamicValue(el.value || "")}</span>
          </div>`;
      case "tag": {
        // A states-driven tag (e.g. Delivery Status) shows its generic label
        // by default (no state selected — uncluttered) or the active
        // state's own name + color once one's picked for preview.
        const active = el.states && el.activeStateId ? el.states.find((s) => s.id === el.activeStateId) : null;
        const displayText = active ? active.name : el.value || el.label;
        const tagStyle = active ? active.tagStyle : el.tagStyle;
        const shape = tagStyle === "id" ? "rounded-lg" : "rounded-full";
        const weight = tagStyle === "id" ? "font-bold" : "font-medium";
        // Dashed underline signals "this is dynamic" (not italic — same
        // accessibility reasoning as dynamicValue) — only on the generic
        // default, though. Once a specific state is actively being
        // previewed, its name is the literal, exact text that would show
        // (an admin authored it) — the underline would wrongly imply that
        // text itself is a placeholder, when really the dynamism is just
        // *which* state applies. It's on an inner span around just the
        // text, not the pill's own edge — a border-b on the pill itself
        // sits under the padding, not the text, and reads as a shape accent
        // rather than an underline. A fixed gray-500 border also renders
        // reliably against every pill color, unlike a `border-current`
        // opacity modifier, which Tailwind doesn't reliably generate.
        const text = active
          ? escapeHtml(displayText)
          : `<span class="border-b border-dashed border-gray-500 pb-0.5">${escapeHtml(displayText)}</span>`;
        return `
          <div class="${CANVAS_EL_CLASS} block w-fit mb-3 ${shape}" ${canvasElAttr(el)}>
            <span class="inline-block text-xs ${weight} px-2.5 py-1 ${shape} ${tagColorClasses(tagStyle)}">${text}</span>
          </div>`;
      }
      case "table": {
        const columns = (el.columns || []).filter((c) => c.enabled !== false);
        const rows = el.rows && el.rows.length ? el.rows : [columns.map(() => "")];
        return `
          <div class="${CANVAS_EL_CLASS} border border-gray-200 rounded-md overflow-hidden mb-3" ${canvasElAttr(el)}>
            <div class="overflow-x-auto">
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="bg-gray-100">
                    ${columns
                      .map(
                        (c) =>
                          `<th class="text-left font-bold text-[#191D88] px-3 py-2 whitespace-nowrap">${escapeHtml(c.label)}</th>`
                      )
                      .join("")}
                  </tr>
                </thead>
                <tbody>
                  ${rows
                    .map(
                      (row) => `
                    <tr class="border-t border-gray-100">
                      ${row.map((cell) => `<td class="px-3 py-3 text-gray-400 whitespace-nowrap">${escapeHtml(cell)}</td>`).join("")}
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
            <div class="flex items-center justify-center gap-2 py-1.5 bg-gray-50 border-t border-gray-100 text-gray-300">
              <svg class="w-3 h-3" viewBox="0 0 20 20" fill="none"><path d="M12 4L6 10L12 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div class="h-1.5 w-16 rounded-full bg-gray-200"></div>
              <svg class="w-3 h-3" viewBox="0 0 20 20" fill="none"><path d="M8 4L14 10L8 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>`;
      }
      default:
        return "";
    }
  }

  function tagColorClasses(style) {
    switch (style) {
      case "success":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "danger":
        return "bg-red-50 text-red-700 border border-red-200";
      case "warning":
        return "bg-amber-50 text-amber-700 border border-amber-200";
      case "info":
        return "bg-blue-50 text-blue-700 border border-blue-200";
      case "id":
        // Cream background, navy text, less rounded — matches the
        // "Beneficiary ID" tag's distinct look (an identifier, not a status).
        return "bg-amber-50 text-[#191D88] border border-amber-100";
      default:
        // Slightly more visible than gray-100 (which nearly disappeared
        // against the card's own #F2F2F2 background) while keeping the
        // slate-700-on-slate-200 contrast well above WCAG AA.
        return "bg-slate-200 text-slate-700 border border-slate-300";
    }
  }

  // A form field as the polio app draws it — label above, square input.
  // Values are blank: whatever the vaccinator types is runtime data.
  function fieldInnerHtml(el) {
    let control;
    switch (el.inputType) {
      case "select":
        control = `<div class="input">Select${APK_ICON.caret}</div>`;
        break;
      case "gps":
        control = `<div class="input readonly">${dyn(el.placeholder || "Latitude, longitude")}</div><p class="gps">${APK_ICON.gps}Captured automatically</p>`;
        break;
      case "dobAge":
        control = `
          <div class="secondary-container">
            <span class="field-label">Date of birth</span>
            <div class="input"><span></span>${APK_ICON.calendar}</div>
            <p class="or-divider">(or)</p>
            <span class="field-label">Age</span>
            <div class="age-grid"><div class="input">Years</div><div class="input">Months</div></div>
          </div>`;
        break;
      case "toggle":
        control = `<div class="secondary-container toggles">${(el.options || [])
          .map((o) => `<div class="toggle-opt">${escapeHtml(o)}</div>`)
          .join("")}</div>`;
        break;
      default:
        control = `<div class="input">${escapeHtml(el.placeholder || "")}</div>`;
    }
    return `
      <div class="${CANVAS_EL_CLASS} field" ${canvasElAttr(el)}>
        <span class="field-label">${escapeHtml(el.label)}${el.required ? '<span class="req">*</span>' : ""}</span>
        ${control}
        ${el.helpTextEnabled && el.helpText ? `<p class="field-help">${escapeHtml(el.helpText)}</p>` : ""}
      </div>`;
  }

  // The APK screen is drawn at the app's real 360 x 720 size, then zoomed to
  // fit inside the phone frame both ways — so on a short window the whole
  // screen, footer CTA included, stays visible instead of being cut off.
  function fitApkToFrame() {
    const frame = document.querySelector("#canvas .phone-frame");
    const apk = document.getElementById("apk-screen");
    if (frame && apk) apk.style.zoom = String(Math.min(frame.clientWidth / 360, frame.clientHeight / 720));
  }

  function renderCanvas() {
    const canvasEl = document.getElementById("canvas");
    const screen = findScreen(state.activeScreenId);
    if (!screen) {
      canvasEl.innerHTML = `<div class="text-sm text-gray-400 py-24 text-center">Select a screen from Flows to preview it here.</div>`;
      return;
    }

    const gating = computeStateGating(screen);

    // The "default preview" caption only makes sense while every dynamic
    // element is actually showing its default — hide it the moment any
    // state is being actively previewed (e.g. a specific Delivery Status).
    const isPreviewingAState = screen.elements.some((el) => el.states && el.activeStateId);
    const captionEl = document.getElementById("default-preview-caption");
    if (captionEl) captionEl.classList.toggle("hidden", isPreviewingAState);

    previewScreen = screen;
    const tags = screen.elements.filter((el) => el.type === "locationTag" && isEffectivelyVisible(el, gating));
    canvasEl.innerHTML = `
      <div class="phone-frame relative rounded-[2rem] border-[10px] border-black bg-black shadow-xl overflow-hidden">
        <div class="apk" id="apk-screen">
          <div class="status-bar"></div>
          <div class="app-bar">
            <span class="back-btn">${APK_ICON.back}Back</span>
            ${screen.pageHelp === false ? "" : `<span class="help-btn">Help${APK_ICON.help}</span>`}
          </div>
          <div class="body">
            ${tags.map(elementHtml).join("")}
            ${
              screen.hideHeading
                ? ""
                : `<h1 class="page-title">${escapeHtml(screen.pageHeading)}</h1>${
                    screen.pageDescription ? `<p class="page-desc">${escapeHtml(screen.pageDescription)}</p>` : ""
                  }`
            }
            ${renderElementsHtml(screen.elements, gating)}
          </div>
          ${renderFooterHtml(screen.elements, gating)}
          ${renderPopupOverlayHtml(screen.elements, gating)}
        </div>
      </div>`;
    fitApkToFrame();

    canvasEl.querySelectorAll(".canvas-el").forEach((node) => {
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        const clickedEl = screen.elements.find((x) => x.id === node.dataset.canvasElId);
        // A gated element (a button, a whole result card, anything) is only
        // visible because some state is active — blindly resetting previews
        // here would immediately hide the very thing just clicked.
        const changed = handleElementPreviewClick(screen, clickedEl, { fromCanvas: true });
        state.activeElementId = node.dataset.canvasElId;
        state.fieldTab = "elements";
        // A tag (or any states-driven element) showing a specific type in
        // the preview — e.g. Delivery Status reading "Administered
        // Successfully" — should take you straight to that type's own
        // properties, not just back to the plain list.
        if (clickedEl && clickedEl.states && clickedEl.activeStateId) {
          state.activeStateSubId = clickedEl.activeStateId;
          state.stateSubTab = "elements";
        }
        renderPropertiesPanel();
        if (changed) renderCanvas();
        // If a drawer opened instead of the main list, there's no card to
        // scroll to — this is a harmless no-op in that case.
        if (clickedEl) scrollPropertiesToElement(scrollTargetIdFor(screen, clickedEl));
      });
    });

    // The cross on the popup card itself minimizes the preview — same
    // reset as clicking the backdrop, but without needing to click outside
    // the card. Stops the click from also bubbling to the card's own
    // ".canvas-el" handler (which would otherwise open its properties).
    canvasEl.querySelectorAll(".popup-close").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        resetPeekPreviews(screen, null);
        renderPropertiesPanel();
        renderCanvas();
      });
    });

    // The dark backdrop behind a popup covers the whole frame, so it's the
    // only thing left to click once one is showing — clicking it (not the
    // card on top of it) dismisses the popup, same as clicking any other
    // element does from Page Properties.
    canvasEl.querySelectorAll("[data-popup-backdrop]").forEach((node) => {
      node.addEventListener("click", (e) => {
        if (e.target !== node) return; // a click on the card itself bubbles here too — ignore it
        const popupEl = screen.elements.find((x) => x.id === node.dataset.popupBackdrop);
        if (popupEl) resetPeekPreviews(screen, null);
        renderPropertiesPanel();
        renderCanvas();
      });
    });
  }

  function renderFooterHtml(elements, gating) {
    // Same as above — a popup's own buttons stay out of the page footer.
    const footerButtons = elements.filter((el) => isEffectivelyVisible(el, gating) && isFooterButton(el) && !el.popupId);
    if (!footerButtons.length) return "";
    return `<div class="footer">${footerButtons.map((el) => buttonMarkup(el)).join("")}</div>`;
  }

  // A popup renders as an overlay on top of the whole phone frame — not
  // inline in the scrollable content like every other element — so it gets
  // its own layer here instead of a case in elementHtml. Clicking the card
  // still opens the same Element properties as any other canvas element.
  // The backdrop itself (data-popup-backdrop) covers everything behind it,
  // so it also needs its own click-to-dismiss wiring — otherwise there's
  // no way to get back to any other element in the canvas once it's shown.
  function renderPopupOverlayHtml(elements, gating) {
    const popups = elements.filter((el) => el.type === "popup" && isEffectivelyVisible(el, gating));
    if (!popups.length) return "";
    return popups
      .map((el) => {
        const buttons = elements.filter(
          (b) => b.type === "button" && b.popupId === el.id && isEffectivelyVisible(b, gating)
        );
        return `
        <div class="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-6" data-popup-backdrop="${escapeHtml(
          el.id
        )}">
          <div class="${CANVAS_EL_CLASS} relative bg-white rounded-xl shadow-xl p-4 pt-6 w-full max-w-[240px]" ${canvasElAttr(el)}>
            <button type="button" class="popup-close absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600" data-popup-close="${escapeHtml(
              el.id
            )}" aria-label="Minimize preview">
              <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </button>
            <div class="text-sm font-bold text-[#191D88] mb-1.5">${escapeHtml(el.title)}</div>
            ${
              el.filterOptions
                ? `<div class="text-left mb-3">
                    ${el.filterOptions
                      .filter((opt) => opt.enabled !== false)
                      .map(
                        (opt) => `
                      <label class="flex items-center gap-2 text-xs text-gray-700 py-1">
                        <input type="checkbox" class="w-3.5 h-3.5 rounded border-gray-300 text-[#c2410c] focus:ring-0"/>
                        ${escapeHtml(opt.label)}
                      </label>`
                      )
                      .join("")}
                  </div>`
                : `<div class="text-xs text-gray-500 leading-snug ${buttons.length ? "mb-3" : ""}">${escapeHtml(
                    el.message
                  )}</div>`
            }
            ${buttons.map((b) => buttonMarkup(b)).join("")}
          </div>
        </div>`;
      })
      .join("");
  }

  function stepScreen(delta) {
    const flat = flatScreens();
    const idx = flat.findIndex((s) => s.id === state.activeScreenId);
    if (idx === -1) return;
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= flat.length) return;
    selectScreen(flat[nextIdx].id);
  }

  function renderNavArrows() {
    const flat = flatScreens();
    const idx = flat.findIndex((s) => s.id === state.activeScreenId);
    const prevBtn = document.getElementById("nav-prev");
    const nextBtn = document.getElementById("nav-next");
    prevBtn.disabled = idx <= 0;
    nextBtn.disabled = idx === -1 || idx >= flat.length - 1;
    prevBtn.classList.toggle("opacity-30", prevBtn.disabled);
    nextBtn.classList.toggle("opacity-30", nextBtn.disabled);
  }

  // ---------- Page Properties panel ----------

  const TOGGLE_ON = "#c2410c";
  const TOGGLE_OFF = "#d1d5db"; // gray-300

  // Generic on/off switch, styled directly in JS (background-color + knob
  // transform only) instead of a CSS peer-checked switch — avoids relying on
  // sibling/pseudo-class state and guarantees off = gray, on = orange, with
  // no layout reflow.
  function toggleButtonHtml({ checked, disabled = false, dataset = {}, className = "" }) {
    const datasetAttrs = Object.entries(dataset)
      .map(([k, v]) => `data-${k}="${escapeHtml(v)}"`)
      .join(" ");
    return `
      <button type="button" ${datasetAttrs} ${disabled ? "disabled" : ""}
        role="switch" aria-checked="${checked ? "true" : "false"}"
        class="${className} relative inline-flex w-9 h-5 rounded-full flex-shrink-0 transition-colors ${
          disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
        }"
        style="background-color:${checked ? TOGGLE_ON : TOGGLE_OFF};">
        <span class="toggle-knob absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style="transform:translateX(${checked ? "16px" : "0px"});"></span>
      </button>`;
  }

  // Buttons group under a named category (e.g. "General actions") when a
  // button has ctaGroup set — a nested sub-heading per group, each with its
  // own button cards, rather than one flat list. Buttons without a
  // ctaGroup just render plainly after any named groups.
  function renderButtonGroups(screen, buttonEls) {
    const groups = new Map();
    const ungrouped = [];
    buttonEls.forEach((el) => {
      if (!el.ctaGroup) {
        ungrouped.push(el);
        return;
      }
      if (!groups.has(el.ctaGroup)) groups.set(el.ctaGroup, []);
      groups.get(el.ctaGroup).push(el);
    });

    // Alternating pattern: the panel itself is white, so the group
    // container is gray (FAFAFA) — and its button cards inside go white,
    // same rhythm as "Types of Delivery Status" one level further in.
    let html = "";
    groups.forEach((els, groupName) => {
      html += `
        <div class="border border-gray-200 rounded-md p-3 mb-3 bg-[#FAFAFA]">
          <div class="text-sm font-bold text-gray-700 mb-2">${escapeHtml(groupName)}</div>
          ${els.map((el) => elementCardHtml(screen, el, { bg: "bg-white" })).join("")}
        </div>`;
    });
    html += ungrouped.map((el) => elementCardHtml(screen, el)).join("");
    return html;
  }

  // Every non-button element (field or otherwise) gets the same clickable
  // card: a toggle plus a label, no inline editing on the card itself, no
  // grouping/categorization. Clicking anywhere on the card except the toggle
  // opens the Element/Field properties view — this works regardless of
  // whether the toggle is on, off, or disabled, and regardless of the
  // screen's or element's configurable/badge state (e.g. Partially
  // Configurable screens get the same drawer as Fully Configurable ones).
  function elementCardHtml(screen, el, { bg = "bg-[#FAFAFA]" } = {}) {
    const locked = screen.badge === "Locked" || !el.configurable;
    // Buttons are always present on their screen — no visibility switch,
    // just the label — but they still open the same drawer on click. Search
    // Results is likewise always present (exactly one of its types applies
    // per search, there's no "off" state for the group itself). A search
    // bar is core to the screen it's on — always shown, same as a button.
    // A few structural template-text elements (e.g. Household Details,
    // Name) are marked noToggle for the same reason — always shown.
    const showToggle =
      el.type !== "button" &&
      el.type !== "resultGroup" &&
      el.type !== "popup" &&
      el.type !== "searchbar" &&
      el.type !== "successPanel" &&
      !el.noToggle;
    // Only form fields are reorderable — that's what "shuffling" means on a
    // form screen. Dragging is disabled on locked/non-configurable fields.
    const draggable = el.type === "field" && !locked;
    return `
      <div class="element-card border border-gray-200 rounded-md px-3 py-3 mb-2 ${bg} transition-colors ${
        el.states ? "" : "cursor-pointer hover:border-[#191D88]/50"
      }" data-el-card-id="${escapeHtml(el.id)}" ${
      draggable ? `draggable="true" data-drag-field-id="${escapeHtml(el.id)}"` : ""
    }>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            ${
              draggable
                ? `<svg class="drag-handle w-3.5 h-4 text-gray-300 flex-shrink-0 cursor-grab active:cursor-grabbing" viewBox="0 0 12 20" fill="currentColor" title="Drag to reorder">
                    <circle cx="3" cy="3" r="1.4"/><circle cx="9" cy="3" r="1.4"/>
                    <circle cx="3" cy="10" r="1.4"/><circle cx="9" cy="10" r="1.4"/>
                    <circle cx="3" cy="17" r="1.4"/><circle cx="9" cy="17" r="1.4"/>
                  </svg>`
                : ""
            }
            <div class="flex flex-col">
              <span class="text-sm font-bold text-gray-900 flex items-center gap-2">
                ${escapeHtml(el.label)}
              </span>
              ${
                el.type !== "button"
                  ? `<span class="inline-block w-fit text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 mt-1">${escapeHtml(
                      elementTypeLabel(el)
                    )}</span>`
                  : ""
              }
            </div>
          </div>
          ${
            showToggle
              ? `
          <div class="flex items-center gap-2">
            <button type="button" data-el-id="${escapeHtml(el.id)}" ${locked ? "disabled" : ""}
              role="switch" aria-checked="${el.visible ? "true" : "false"}" aria-label="Show ${escapeHtml(el.label)}"
              class="prop-toggle relative inline-flex w-9 h-5 rounded-full flex-shrink-0 transition-colors ${
                locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
              }"
              style="background-color:${el.visible ? TOGGLE_ON : TOGGLE_OFF};">
              <span class="toggle-knob absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                style="transform:translateX(${el.visible ? "16px" : "0px"});"></span>
            </button>
          </div>`
              : ""
          }
        </div>
        ${el.states && el.visible ? statesEditorHtml(el) : ""}
      </div>`;
  }

  function fieldTypeLabel(el) {
    if (el.fieldType) return el.fieldType;
    return { text: "Text", number: "Number", select: "Dropdown" }[el.inputType] || "Text";
  }

  // The template/interaction type shown in the drawer's "Type" box and, for
  // non-button elements, as a caption on the card in the side panel.
  function elementTypeLabel(el) {
    // A button's "Type" is its style — Primary or Secondary ("outline" and
    // "tertiary" both read as the lower-emphasis, Secondary look) — not
    // its functional elementType (e.g. "QR Scan", "Action popup").
    if (el.type === "button") return el.style === "outline" || el.style === "tertiary" ? "Secondary Button" : "Primary Button";
    if (el.elementType) return el.elementType;
    if (el.type === "field") return fieldTypeLabel(el);
    return (
      {
        searchbar: "Search Bar",
        button: "Button",
        emptyState: "Empty state",
        list: "Table",
        card: "Template text",
        success: "Success Message",
        textTemplate: "Template text",
        labelPairList: "Template text",
        labelValueRow: "Template text",
        tag: "Template tag",
        table: "Table",
        resultGroup: "Template card",
        popup: "Popup",
        locationTag: "Location tag",
        optionCard: "Option card",
        locationCard: "Template card",
        searchMeta: "Template text",
        sectionTitle: "Section heading",
        metricTotal: "Count",
        metricGender: "Count chips",
        checkItem: "Checkbox",
        successPanel: "Panel card",
      }[el.type] || "Element"
    );
  }

  // Small text/textarea field used inside the Elements tab, wired generically
  // by data-field name (see wireElementsTab) rather than one-off ids per type.
  // Dynamic values (populated from the real record at runtime) don't get one
  // of these at all — there's nothing an admin can edit, so callers simply
  // don't render a field for them (see the "value" cases in renderElementsTab).
  function inputField(labelText, field, value, { area = false } = {}) {
    const inputHtml = area
      ? `<textarea data-field="${field}" rows="2"
          class="elem-input w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30">${escapeHtml(
            value || ""
          )}</textarea>`
      : `<input type="text" data-field="${field}" value="${escapeHtml(value || "")}"
          class="elem-input w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30"/>`;
    return `
      <div class="border border-gray-200 rounded-md px-3 py-3 mb-3 bg-[#FAFAFA]">
        <label class="block text-sm text-gray-700 mb-1.5">${escapeHtml(labelText)}</label>
        ${inputHtml}
      </div>`;
  }

  function renderElementDetailView(root, screen, el) {
    if (el.states) {
      const activeState = state.activeStateSubId && el.states.find((s) => s.id === state.activeStateSubId);
      if (activeState) {
        renderStateDetailView(root, screen, el, activeState);
        return;
      }
      // A states-driven element's own card already shows its types list
      // inline in the main Page Properties list (see elementCardHtml) — it
      // has no separate drawer of its own. Landing here otherwise means a
      // stale/invalid activeStateSubId; bounce back to the main list.
      state.activeElementId = null;
      state.activeStateSubId = null;
      renderPropertiesPanel();
      return;
    }

    const tab = state.fieldTab === "logic" ? "logic" : "elements";
    const title =
      { field: "Field properties", button: "Button properties", popup: "Popup properties" }[el.type] || "Element properties";

    root.innerHTML = `
      <button id="back-to-page-props" type="button"
        class="flex items-center gap-1.5 border border-[#c2410c] text-[#c2410c] rounded-md px-3 py-1.5 text-sm font-medium mb-4 hover:bg-orange-50">
        <svg class="w-3 h-3" viewBox="0 0 20 20" fill="none"><path d="M12 4L6 10L12 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Back to page properties
      </button>

      <div class="flex items-center gap-1.5 mb-4">
        <h2 class="text-base font-semibold text-[#191D88]">${title}</h2>
        <svg class="w-3.5 h-3.5 text-gray-400" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.3"/><path d="M10 9v5M10 6.5v.01" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      </div>

      <div class="flex border border-gray-300 rounded-md overflow-hidden mb-4">
        <button data-tab="elements" class="field-tab flex-1 py-2 text-sm font-medium transition-colors ${
          tab === "elements" ? "bg-[#c2410c] text-white" : "bg-white text-gray-600"
        }">Elements</button>
        <button data-tab="logic" class="field-tab flex-1 py-2 text-sm font-medium transition-colors ${
          tab === "logic" ? "bg-[#c2410c] text-white" : "bg-white text-gray-600"
        }">Logic</button>
      </div>

      ${tab === "elements" ? renderElementsTab(screen, el) : renderLogicTab(el)}
    `;

    document.getElementById("back-to-page-props").addEventListener("click", () => {
      state.activeElementId = null;
      state.activeStateSubId = null;
      renderPropertiesPanel();
    });
    root.querySelectorAll(".field-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.fieldTab = btn.dataset.tab;
        renderPropertiesPanel();
      });
    });

    if (tab === "elements") wireElementsTab(root, screen, el);
  }

  // ---------- A single state's own properties (label + conditional logic) ----------

  function renderStateDetailView(root, screen, parentEl, s) {
    const tab = state.stateSubTab === "logic" ? "logic" : "elements";

    root.innerHTML = `
      <button id="back-to-states-list" type="button"
        class="flex items-center gap-1.5 border border-[#c2410c] text-[#c2410c] rounded-md px-3 py-1.5 text-sm font-medium mb-4 hover:bg-orange-50">
        <svg class="w-3 h-3" viewBox="0 0 20 20" fill="none"><path d="M12 4L6 10L12 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Back to page properties
      </button>

      <div class="flex items-center gap-1.5 mb-4">
        <h2 class="text-base font-semibold text-[#191D88]">Element properties</h2>
      </div>

      <div class="flex border border-gray-300 rounded-md overflow-hidden mb-4">
        <button data-sub-tab="elements" class="state-sub-tab flex-1 py-2 text-sm font-medium transition-colors ${
          tab === "elements" ? "bg-[#c2410c] text-white" : "bg-white text-gray-600"
        }">Elements</button>
        <button data-sub-tab="logic" class="state-sub-tab flex-1 py-2 text-sm font-medium transition-colors ${
          tab === "logic" ? "bg-[#c2410c] text-white" : "bg-white text-gray-600"
        }">Logic</button>
      </div>

      ${tab === "elements" ? renderStateElementsTab(screen, s) : renderStateLogicTab(s)}
    `;

    document.getElementById("back-to-states-list").addEventListener("click", () => {
      state.activeStateSubId = null;
      renderPropertiesPanel();
    });
    root.querySelectorAll(".state-sub-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.stateSubTab = btn.dataset.subTab;
        renderPropertiesPanel();
      });
    });

    // Logic tab is read-only (a preview, not an editor) — nothing to wire.
    if (tab === "elements") wireStateElementsTab(root, screen, s);
  }

  // Two shapes of "elements" tab, depending on how this state was authored:
  //  - New format (state.elements is set, e.g. Search Results): show the
  //    list of elements this state brings into the preview, each as a card
  //    matching the main list's style. Required elements (always shown when
  //    this state is active) render with no toggle at all; optional ones get
  //    a toggle so the admin can decide whether they show up.
  //  - Legacy format (state.elementIds, e.g. Delivery Status): keep the
  //    existing rename-the-label input — there's nothing to individually
  //    toggle, the whole point is picking the tag's own text.
  // CTAs (buttons) always come along with a type when it's active — they're
  // not something to individually show/hide, so they're left out of this
  // list entirely, required or not.
  function nonButtonStateEntries(screen, s) {
    return stateElementEntries(s).filter((entry) => {
      const el = screen.elements.find((e) => e.id === entry.id);
      return !el || el.type !== "button";
    });
  }

  function renderStateElementsTab(screen, s) {
    if (s.elements) {
      const entries = nonButtonStateEntries(screen, s);
      // e.g. First-time User — nothing below the search box at all.
      if (!entries.length) return infoNote("This type shows nothing below the search bar.");
      // A type with exactly one non-CTA element (e.g. "No Beneficiary" only
      // brings in "Beneficiary Not Found") has nothing to pick between —
      // skip straight to that element's own label/description fields
      // instead of showing a one-row list first.
      if (entries.length === 1) {
        const onlyEl = screen.elements.find((e) => e.id === entries[0].id);
        if (onlyEl) return renderElementsTab(screen, onlyEl);
      }
      const overrides = s.elementOverrides || (s.elementOverrides = {});
      return `
        <p class="text-xs text-gray-500 mb-4 leading-snug">These are the elements shown in the preview whenever this type is the active one. Required elements are always shown; the rest can be switched off.</p>
        ${entries
          .map((entry) => {
            const el = screen.elements.find((e) => e.id === entry.id);
            const checked = overrides[entry.id] !== false;
            const label = el ? el.label : entry.id;
            // A table's row keeps the exact same FAFAFA card as every
            // other entry — the nested white checkbox box sits inside it,
            // same as under "Coordinates" etc. Needs its own top margin
            // when shown — the header row has no bottom margin otherwise,
            // so the box would sit flush against it.
            const isTable = el && el.type === "table";
            return `
              <div class="border border-gray-200 rounded-md px-3 py-3 mb-2 bg-[#FAFAFA]">
                <div class="flex items-center justify-between gap-2 ${isTable && checked ? "mb-3" : ""}">
                  <span class="text-sm font-bold text-gray-900">${escapeHtml(label)}</span>
                  ${
                    entry.required
                      ? ""
                      : toggleButtonHtml({
                          checked,
                          dataset: { stateElToggleId: entry.id },
                          className: "state-el-toggle",
                        })
                  }
                </div>
                ${isTable && checked ? tableColumnsGreyBoxHtml(el) : ""}
              </div>`;
          })
          .join("")}`;
    }

    return `
      <p class="text-xs text-gray-500 mb-4 leading-snug">This is the label shown in the preview whenever this type is the active one.</p>
      <div class="border border-gray-200 rounded-md px-3 py-3 mb-3 bg-[#FAFAFA]">
        <label class="block text-sm text-gray-700 mb-1.5">Label</label>
        <input id="state-label-input" type="text" value="${escapeHtml(s.name)}"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30"/>
      </div>`;
  }

  function wireStateElementsTab(root, screen, s) {
    if (s.elements) {
      const entries = nonButtonStateEntries(screen, s);
      if (entries.length === 1) {
        const onlyEl = screen.elements.find((e) => e.id === entries[0].id);
        if (onlyEl) wireElementsTab(root, screen, onlyEl);
        return;
      }
      // A row with more than one element listed is a plain show/hide row —
      // only its toggle does anything.
      root.querySelectorAll(".state-el-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
          const entryId = btn.dataset.stateElToggleId;
          const overrides = s.elementOverrides || (s.elementOverrides = {});
          const currentlyOn = overrides[entryId] !== false;
          overrides[entryId] = !currentlyOn;
          renderPropertiesPanel();
          renderCanvas();
        });
      });
      // A table's column checkboxes are nested right in its own grey box
      // (see tableColumnsGreyBoxHtml) — no separate drawer to wire.
      root.querySelectorAll(".table-col-toggle").forEach((row) => {
        row.addEventListener("click", () => {
          const tableEl = screen.elements.find((x) => x.id === row.dataset.tableId);
          const col = tableEl && (tableEl.columns || [])[Number(row.dataset.colIdx)];
          if (!col || !toggleTableColumn(tableEl, col)) return;
          renderPropertiesPanel();
          renderCanvas();
        });
      });
      return;
    }
    const labelInput = document.getElementById("state-label-input");
    if (labelInput) {
      labelInput.addEventListener("input", (e) => {
        s.name = e.target.value;
        renderCanvas(); // this state is the one being previewed, so update live
      });
    }
  }

  // A single read-only value in the condition grid below — this tab is a
  // preview of each type's existing logic, not an editor, so everything
  // here is plain display, not an input.
  // A rounded, bold-blue pill for a value inside a logic sentence — plain
  // display (not an input), matching the reference's "If [Gender] on page
  // [Individual details] equals [Yes]" look.
  function logicPill(text) {
    return `<span class="inline-block bg-blue-50 text-[#191D88] text-sm font-bold rounded-full px-2.5 py-1">${escapeHtml(
      text || "—"
    )}</span>`;
  }

  // One condition, read as a sentence — "If [Field] on page [Page]
  // [operator] [Value]" — instead of a form-style grid, matching the
  // reference exactly. Not every field comes from a page someone fills in
  // though — a count like "Beneficiary ID" comes from MDMS master data, so
  // that segment swaps to "from [source]" (cond.source) instead of "on
  // page [page]" when there's no page to point at.
  function conditionRowHtml(cond) {
    return `
      <div class="border border-gray-200 rounded-md px-3 py-3 mb-2 bg-[#FAFAFA] flex items-center flex-wrap gap-1.5 text-sm text-gray-700">
        <span>If</span>
        ${logicPill(cond.field)}
        ${
          cond.page
            ? `<span>on page</span>${logicPill(cond.page)}`
            : cond.source
            ? `<span>from</span>${logicPill(cond.source)}`
            : ""
        }
        <span>${escapeHtml(cond.operator || "")}</span>
        ${logicPill(cond.value)}
      </div>`;
  }

  // One logic block, read as a sentence — "Shows [X] when: [conditions]" —
  // shared by states (Delivery Status, etc.) and by plain buttons that have
  // their own conditional logic (e.g. which of two CTAs shows, or which
  // flow a CTA leads into).
  function renderLogicPreview(logic) {
    const { conditions, connector, thenShow } = logic;
    return `
      <div class="flex items-center flex-wrap gap-1.5 text-sm mb-4">
        <span class="font-bold text-gray-900">Shows</span>
        ${logicPill(thenShow)}
        <span class="font-bold text-gray-900">when:</span>
      </div>
      <div>
        ${conditions
          .map(
            (c, idx) =>
              conditionRowHtml(c) +
              (idx < conditions.length - 1
                ? `<div class="flex justify-center my-1">
                    <span class="text-xs font-semibold text-amber-700 bg-amber-50 rounded-full px-3 py-1">${escapeHtml(
                      connector
                    )}</span>
                  </div>`
                : "")
          )
          .join("")}
      </div>`;
  }

  function renderStateLogicTab(s) {
    if (!s.logic) {
      return `<div class="text-xs text-gray-400 bg-[#FAFAFA] border border-gray-200 rounded-md px-3 py-3">No logic defined for this type.</div>`;
    }
    return renderLogicPreview(s.logic);
  }

  // Elements tab content is type-aware: fields get the full Field type /
  // Label / Help text / Tooltip treatment; everything else gets whatever
  // properties actually apply to that element type.
  // "Types of X" editor for a states-driven dynamic element (e.g. Delivery
  // Status). Clicking a type previews it in the canvas — including which
  // buttons that state shows — without needing real data. "Show default"
  // clears back to the generic, uncluttered view.
  // Nested inline in the element's own card in the main Page Properties
  // list (see elementCardHtml) — not behind a click-through drawer. Rows
  // carry data-parent-id since this renders inside a .map() over every
  // element on the screen, so the click wiring (in renderPropertiesPanel)
  // knows which element each row belongs to.
  function statesEditorHtml(el) {
    return `
      <div class="mt-3 border border-gray-200 rounded-md p-3 bg-white">
        <div class="text-sm font-bold text-gray-700 mb-2">Types of ${escapeHtml(el.label)}</div>
        <div class="flex items-start gap-2 bg-blue-50 text-blue-700 text-xs rounded-md p-2.5 mb-2 leading-snug">
          <svg class="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" fill="currentColor"/><path d="M10 9v5M10 6.5v.01" stroke="white" stroke-width="1.6" stroke-linecap="round"/></svg>
          <span>${escapeHtml(el.infoText || `Choose which ${el.label.toLowerCase()} type shows in the preview.`)}</span>
        </div>
        ${el.states
          .map((s) => {
            // Require el.visible too — a type can't be "previewing" if the
            // whole element is toggled off, even if activeStateId is stale.
            const isActive = el.visible && el.activeStateId === s.id;
            // Open eye = currently previewing; closed eye = click to preview.
            // Lashed eye, filled pupil (open = visible) vs. just the closed
            // lashed lid (invisible) — matching the reference icon set.
            const eyeIcon = isActive
              ? `<svg class="w-4 h-4" viewBox="0 0 20 16" fill="none">
                  <path d="M4 4.5L3 2.2M7.3 2.8L6.7 0.6M10 2.2L10 0M12.7 2.8L13.3 0.6M16 4.5L17 2.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                  <path d="M2 9C4 5 7 3 10 3s6 2 8 6c-2 4-5 6-8 6s-6-2-8-6z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>
                  <circle cx="10" cy="9" r="2.6" fill="currentColor"/>
                </svg>`
              : `<svg class="w-4 h-4" viewBox="0 0 20 16" fill="none">
                  <path d="M2 8c2 3 5 4.5 8 4.5s6-1.5 8-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M4 11.5L3 13.8M7.3 13L6.7 15.2M10 13.5L10 16M12.7 13L13.3 15.2M16 11.5L17 13.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                </svg>`;
            return `
          <button type="button" data-parent-id="${escapeHtml(el.id)}" data-state-id="${escapeHtml(s.id)}"
            class="state-row w-full text-left flex items-center gap-2 border rounded-md pl-3 pr-1.5 py-1.5 mb-1.5 text-sm font-medium transition-colors ${
              // Hovering the row gives it a slightly darker bg; hovering the
              // eye instead lights up only the eye box, never both at once.
              isActive
                ? "border-[#c2410c] bg-orange-50 text-[#c2410c] hover:bg-orange-100 [&:has(.state-eye:hover)]:!bg-orange-50"
                : "border-gray-200 bg-[#FAFAFA] text-gray-700 hover:bg-orange-50 [&:has(.state-eye:hover)]:!bg-[#FAFAFA]"
            }">
            <!-- Long names wrap onto a second line rather than truncating -->
            <span class="flex-1 min-w-0 break-words">${escapeHtml(s.name)}</span>
            <!-- Eye is its own small boxed button so it reads as a separate,
                 preview-only control rather than part of the row -->
            <span role="button" tabindex="0" data-parent-id="${escapeHtml(el.id)}" data-state-id="${escapeHtml(s.id)}"
              class="state-eye ${
                isActive
                  ? "text-[#9a3412] border-[#c2410c] bg-white hover:bg-orange-100"
                  : "text-gray-400 border-gray-200 bg-white hover:bg-orange-50 hover:text-[#c2410c]"
              } flex-shrink-0 w-7 h-7 flex items-center justify-center border rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c2410c]/40" aria-label="${
              isActive ? "Previewing — click to stop previewing" : "Preview this type"
            }" title="${isActive ? "Stop previewing" : "Preview"}">${eyeIcon}</span>
          </button>`;
          })
          .join("")}
      </div>`;
  }

  // A label/value pair's value is dynamic (sourced from data), but the
  // admin can still switch each pair on/off — e.g. hide "Member Count"
  // without touching "Household Head".
  function labelPairsSectionHtml(el) {
    return (el.pairs || [])
      .map(
        (pair, idx) => `
        <div class="border border-gray-200 rounded-md px-3 py-3 mb-2 bg-[#FAFAFA] flex items-center justify-between gap-2">
          <span class="text-sm font-bold text-gray-900">${escapeHtml(pair.label)}</span>
          ${toggleButtonHtml({
            checked: pair.enabled !== false,
            dataset: { pairIdx: idx },
            className: "label-pair-toggle",
          })}
        </div>`
      )
      .join("");
  }

  // A table always needs at least one visible column — refuses to turn
  // off the last one still enabled. Returns whether the flip went through.
  function toggleTableColumn(tableEl, col) {
    const currentlyOn = col.enabled !== false;
    if (currentlyOn) {
      const enabledCount = (tableEl.columns || []).filter((c) => c.enabled !== false).length;
      if (enabledCount <= 1) return false;
    }
    col.enabled = !currentlyOn;
    return true;
  }

  // One column row, shared everywhere a table's columns show up. "Grey"
  // means #FAFAFA specifically, not a darker gray-200/300 — the contrast
  // is FAFAFA (unchecked row + its checkbox) against the white wrapping
  // box (see tableColumnsGreyBoxHtml), not against each other.
  function tableColumnRowHtml(tableEl, col, idx) {
    const checked = col.enabled !== false;
    return `
      <div class="table-col-toggle flex items-center gap-2.5 border rounded-lg px-3 py-2.5 mb-2 last:mb-0 cursor-pointer transition-colors ${
        checked ? "border-[#c2410c] bg-orange-50" : "border-gray-200 bg-[#FAFAFA]"
      }" data-table-id="${escapeHtml(tableEl.id)}" data-col-idx="${idx}">
        <span class="w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center ${
          checked ? "bg-white border-[#c2410c]" : "bg-white border-gray-300"
        }">
          ${
            checked
              ? `<svg class="w-3 h-3 text-[#c2410c]" viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
              : ""
          }
        </span>
        <span class="text-sm font-medium text-gray-800">${escapeHtml(col.label)}</span>
      </div>`;
  }

  // The white box holding a table's column rows — the header (label +
  // toggle) lives outside this, in whatever card is showing the table
  // itself (a state's FAFAFA row, or the table's own header).
  function tableColumnsGreyBoxHtml(el) {
    return `
      <div class="border border-gray-200 rounded-md p-2 bg-white">
        ${(el.columns || []).map((col, idx) => tableColumnRowHtml(el, col, idx)).join("")}
      </div>`;
  }

  // A table's own card: its label + a master visibility switch, then the
  // white box of column checkboxes. Rows themselves are sourced from data
  // and aren't editable. Wrapped in the same FAFAFA card the nested,
  // in-a-state's-element-list version already sits inside (that one's
  // fine as-is — don't touch it) — clicking the table individually should
  // land on this exact look too.
  function tableColumnsSectionHtml(el) {
    return `
      <div class="border border-gray-200 rounded-md px-3 py-3 mb-3 bg-[#FAFAFA]">
        <div class="flex items-center justify-between ${el.visible ? "mb-3" : ""}">
          <span class="text-sm font-bold text-gray-900">${escapeHtml(el.label)}</span>
          ${toggleButtonHtml({ checked: !!el.visible, className: "table-visible-toggle" })}
        </div>
        ${el.visible ? tableColumnsGreyBoxHtml(el) : ""}
      </div>`;
  }

  function typeBoxHtml(el) {
    return `
      <div class="border border-gray-200 rounded-md px-3 py-3 mb-3 bg-[#FAFAFA]">
        <div class="text-xs text-gray-500 mb-1.5">Type</div>
        <div class="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-100 text-gray-400">${escapeHtml(
          elementTypeLabel(el)
        )}</div>
      </div>`;
  }

  // A filter popup's options are just switched on/off, not edited as text
  // — there's no free-form label to write, only which checkboxes show up.
  function filterOptionsSectionHtml(el) {
    return `
      <div class="flex items-center gap-1.5 mb-2 mt-1">
        <span class="text-sm font-semibold text-[#191D88]">Popup content</span>
      </div>
      ${el.filterOptions
        .map(
          (opt, idx) => `
          <div class="border border-gray-200 rounded-md px-3 py-3 mb-2 bg-[#FAFAFA] flex items-center justify-between gap-2">
            <span class="text-sm font-bold text-gray-900">${escapeHtml(opt.label)}</span>
            ${toggleButtonHtml({
              checked: opt.enabled !== false,
              dataset: { filterOptionIdx: idx },
              className: "filter-option-toggle",
            })}
          </div>`
        )
        .join("")}`;
  }

  // A popup's own action buttons don't get their own editable label (see
  // the "button" case below) — instead, their text is edited right here,
  // from inside the popup's own properties, one input per button.
  function popupButtonsSectionHtml(screen, popupEl) {
    const buttons = screen.elements.filter((b) => b.type === "button" && b.popupId === popupEl.id);
    if (!buttons.length) return "";
    return `
      <div class="flex items-center gap-1.5 mb-2 mt-1">
        <span class="text-sm font-semibold text-[#191D88]">Popup buttons</span>
      </div>
      ${buttons
        .map(
          (b) => `
          <div class="border border-gray-200 rounded-md px-3 py-3 mb-3 bg-[#FAFAFA]">
            <label class="block text-sm text-gray-700 mb-1.5">${escapeHtml(b.label)}</label>
            <input type="text" data-popup-btn-id="${escapeHtml(b.id)}" value="${escapeHtml(b.text || "")}"
              class="popup-btn-input w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30"/>
          </div>`
        )
        .join("")}`;
  }

  function infoNote(text) {
    return `<div class="text-xs text-gray-500 bg-[#FAFAFA] border border-gray-200 rounded-md px-3 py-3">${escapeHtml(text)}</div>`;
  }

  function renderElementsTab(screen, el) {
    if (el.type === "field") {
      return `
        <p class="text-xs text-gray-500 mb-4 leading-snug">In Elements you can edit form labels, heading and fields. You can customize each field's name, type, and behaviour to match your campaign needs.</p>

        ${typeBoxHtml(el)}

        ${inputField("Label", "label", el.label)}

        <div class="border border-gray-200 rounded-md px-3 py-3 mb-3 bg-[#FAFAFA]">
          <div class="flex items-center justify-between ${el.helpTextEnabled ? "mb-2" : ""}">
            <span class="text-sm font-bold text-[#191D88]">Help text</span>
            ${toggleButtonHtml({ checked: !!el.helpTextEnabled, dataset: { toggle: "helpTextEnabled" }, className: "field-toggle" })}
          </div>
          ${
            el.helpTextEnabled
              ? `<textarea data-field="helpText" rows="2"
                  class="elem-input w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30">${escapeHtml(
                    el.helpText || ""
                  )}</textarea>`
              : ""
          }
        </div>

        <div class="border border-gray-200 rounded-md px-3 py-3 mb-3 bg-[#FAFAFA]">
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold text-[#191D88]">Tooltip</span>
            ${toggleButtonHtml({ checked: !!el.tooltipEnabled, dataset: { toggle: "tooltipEnabled" }, className: "field-toggle" })}
          </div>
        </div>
      `;
    }

    let body = "";
    switch (el.type) {
      case "button":
        // A popup's own action buttons (e.g. "Download ID" / "Skip") are
        // fixed to that popup — their label isn't admin-editable, unlike a
        // regular page button's. Its style (Primary/Secondary) already
        // shows in the "Type" box above (see elementTypeLabel).
        body = el.popupId
          ? `<div class="text-xs text-gray-400 bg-[#FAFAFA] border border-gray-200 rounded-md px-3 py-3">This button's label isn't editable here.</div>`
          : inputField("Button label", "text", el.text);
        break;
      case "searchbar":
        body = inputField("Placeholder", "placeholder", el.placeholder);
        break;
      case "emptyState":
        body = inputField("Title", "title", el.title) + inputField("Description", "message", el.message, { area: true });
        break;
      case "popup":
        // A filter popup has nothing to write — just which options show up
        // as checkboxes, so it gets enable/disable toggles instead of the
        // usual Title/Description text fields.
        body = el.filterOptions
          ? filterOptionsSectionHtml(el) + popupButtonsSectionHtml(screen, el)
          : `<div class="flex items-center gap-1.5 mb-2 mt-1">
              <span class="text-sm font-semibold text-[#191D88]">Popup content</span>
            </div>` +
            inputField("Title", "title", el.title) +
            inputField("Description", "message", el.message, { area: true }) +
            popupButtonsSectionHtml(screen, el);
        break;
      case "success":
        body = inputField("Message", "message", el.message, { area: true });
        break;
      case "card":
        // Title/subtitle here are dynamic (a specific beneficiary's name and
        // ID) — nothing an admin can edit, so no field is shown for them.
        body = "";
        break;
      case "textTemplate":
        body = "";
        break;
      case "labelValueRow":
        // Label is static config text (editable); the value is dynamic, so
        // it doesn't get a field at all.
        body = inputField("Label", "label", el.label);
        break;
      case "tag":
        // A states-driven tag never reaches this generic tab — its card in
        // the main list shows the types list inline (see elementCardHtml).
        body = "";
        break;
      case "labelPairList":
        // Each pair's value is dynamic (sourced from data), but which
        // pairs show up at all can still be switched on/off.
        body = labelPairsSectionHtml(el);
        break;
      case "table":
        // Rows are sourced from data (not editable), but the table itself
        // and each column can be switched on/off.
        body = tableColumnsSectionHtml(el);
        break;
      case "list":
        body = `<div class="text-xs text-gray-400 bg-[#FAFAFA] border border-gray-200 rounded-md px-3 py-3">Items are sourced from data — not editable here.</div>`;
        break;
      case "locationTag":
      case "searchMeta":
        body = infoNote("This value is filled in from data at runtime — not editable here.");
        break;
      case "optionCard":
        body = inputField("Title", "title", el.title) + inputField("Description", "description", el.description, { area: true });
        break;
      case "locationCard":
        // Name and row values are the real location's data; the row labels
        // can be switched on/off and the badge/button wording edited.
        body =
          (el.badge !== undefined ? inputField("Badge", "badge", el.badge) : "") +
          labelPairsSectionHtml(el) +
          inputField("Button label", "buttonText", el.buttonText);
        break;
      case "metricTotal":
        body = inputField("Label", "text", el.text);
        break;
      case "metricGender":
        body = labelPairsSectionHtml(el);
        break;
      case "checkItem":
        body = inputField("Label", "label", el.label);
        break;
      case "successPanel":
        body = infoNote("Shows this page's heading and description. Its buttons are listed under Buttons.");
        break;
    }
    return `<p class="text-xs text-gray-500 mb-4 leading-snug">Edit this element's content below.</p>${typeBoxHtml(el)}${body}`;
  }

  // A plain element's (mainly a button's) own Logic tab — read-only preview,
  // same pill-sentence style as a state's Logic tab. A button can carry a
  // single logic block (e.g. "Download Beneficiary IDs" only shows under
  // one condition) or an array of them (e.g. one CTA that leads to a
  // different flow depending on which branch's conditions match).
  function renderLogicTab(el) {
    if (!el.logic) {
      return `<div class="text-xs text-gray-400 bg-[#FAFAFA] border border-gray-200 rounded-md px-3 py-3">No logic defined for this element.</div>`;
    }
    const blocks = Array.isArray(el.logic) ? el.logic : [el.logic];
    return blocks
      .map(
        (logic, idx) =>
          renderLogicPreview(logic) +
          (idx < blocks.length - 1
            ? `<div class="flex justify-center my-2">
                <span class="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-3 py-1">Otherwise</span>
              </div>`
            : "")
      )
      .join("");
  }

  function wireElementsTab(root, screen, el) {
    root.querySelectorAll(".elem-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        el[e.target.dataset.field] = e.target.value;
        // A button's card in the Buttons list shows its label, so keep the
        // label in step with the text the admin types.
        if (el.type === "button" && e.target.dataset.field === "text") el.label = e.target.value;
        renderCanvas();
      });
    });
    root.querySelectorAll(".field-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        el[btn.dataset.toggle] = !el[btn.dataset.toggle];
        renderPropertiesPanel(); // re-render so e.g. the help-text textarea shows/hides
        renderCanvas();
      });
    });
    // Each input here edits a different element (one of the popup's own
    // buttons), not `el` (the popup) itself.
    root.querySelectorAll(".popup-btn-input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const btnEl = screen.elements.find((x) => x.id === e.target.dataset.popupBtnId);
        if (!btnEl) return;
        btnEl.text = e.target.value;
        btnEl.label = e.target.value;
        renderCanvas();
      });
    });
    root.querySelectorAll(".filter-option-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const opt = el.filterOptions[Number(btn.dataset.filterOptionIdx)];
        if (!opt) return;
        opt.enabled = opt.enabled === false; // flip, defaulting to "was on" the first time
        renderPropertiesPanel();
        renderCanvas();
      });
    });
    root.querySelectorAll(".label-pair-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pair = (el.pairs || [])[Number(btn.dataset.pairIdx)];
        if (!pair) return;
        pair.enabled = pair.enabled === false;
        renderPropertiesPanel();
        renderCanvas();
      });
    });
    root.querySelectorAll(".table-visible-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        el.visible = !el.visible;
        renderPropertiesPanel(); // re-render so the outer card's own toggle stays in sync
        renderCanvas();
      });
    });
    root.querySelectorAll(".table-col-toggle").forEach((row) => {
      row.addEventListener("click", () => {
        const col = (el.columns || [])[Number(row.dataset.colIdx)];
        if (!col || !toggleTableColumn(el, col)) return;
        renderPropertiesPanel();
        renderCanvas();
      });
    });
  }

  function renderPropertiesPanel() {
    const root = document.getElementById("properties-panel");
    const screen = findScreen(state.activeScreenId);
    if (!screen) {
      root.innerHTML = `<div class="text-sm text-gray-400">No screen selected.</div>`;
      return;
    }

    if (state.activeElementId) {
      const activeEl = screen.elements.find((e) => e.id === state.activeElementId);
      if (activeEl) {
        renderElementDetailView(root, screen, activeEl);
        return;
      }
      state.activeElementId = null; // stale reference (e.g. screen changed) — fall through
    }

    const locked = screen.badge === "Locked";
    const gating = computeStateGating(screen);
    // A button gated by a "resultGroup" (e.g. "Open", only shown under
    // Search Results' found states) is entirely contextual to that
    // group's own "Types of X" list — unlike Delivery Status's gated
    // buttons (a "tag"), which are deliberately still managed from the
    // main Buttons section, "Open" doesn't need a second entry there too.
    const resultGroupGatedButtonIds = new Set();
    screen.elements.forEach((holder) => {
      if (holder.type !== "resultGroup" || !holder.states) return;
      holder.states.forEach((s) =>
        stateElementEntries(s).forEach((entry) => resultGroupGatedButtonIds.add(entry.id))
      );
    });
    // A button that belongs to a popup (el.popupId) is likewise managed
    // from inside that popup's own card (see popupButtonsHtml).
    const buttonEls = screen.elements.filter(
      (el) => el.type === "button" && !el.popupId && !resultGroupGatedButtonIds.has(el.id)
    );
    const popupEls = screen.elements.filter((el) => el.type === "popup");
    // An element already reachable through a states-holder's own "Types
    // of X" list (e.g. every element under Search Results) doesn't need a
    // second, standalone card here too — that would just be the same
    // element listed twice. Popups get their own section below, same as
    // buttons, so they're excluded here too.
    const nonButtonEls = screen.elements.filter(
      (el) =>
        el.type !== "button" &&
        el.type !== "popup" &&
        el.type !== "locationTag" &&
        el.type !== "sectionTitle" &&
        !gating.controlledIds.has(el.id)
    );
    const buttonsHtml = renderButtonGroups(screen, buttonEls);
    // A screen with any form fields is a "form screen" — label the section
    // accordingly instead of the generic "General Elements".
    const isFormScreen = screen.elements.some((el) => el.type === "field");
    const elementsSectionLabel = isFormScreen ? "Form Elements" : "General Elements";

    root.innerHTML = `
      <h2 class="text-lg font-semibold text-[#191D88] mb-3">Page Properties</h2>
      <div class="inline-block text-xs font-medium px-2.5 py-1 rounded-md mb-5 ${badgeClasses(screen.badge)}">${escapeHtml(screen.badge)}</div>

      <label class="block text-sm text-gray-600 mb-1">Page Heading</label>
      <input id="prop-heading" type="text" value="${escapeHtml(screen.pageHeading)}" ${locked ? "disabled" : ""}
        class="w-full mb-4 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30 disabled:bg-gray-50 disabled:text-gray-400"/>

      <label class="block text-sm text-gray-600 mb-1">Page Description</label>
      <textarea id="prop-description" rows="3" ${locked ? "disabled" : ""}
        class="w-full mb-5 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30 disabled:bg-gray-50 disabled:text-gray-400">${escapeHtml(screen.pageDescription)}</textarea>

      ${locked ? `<div class="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 mb-3">This screen is locked and can't be edited.</div>` : ""}

      <div class="flex items-center gap-1.5 mb-3">
        <span class="text-sm font-semibold text-[#191D88]">${elementsSectionLabel}</span>
        <svg class="w-3.5 h-3.5 text-gray-400" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.3"/><path d="M10 9v5M10 6.5v.01" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      </div>
      ${
        nonButtonEls.length
          ? nonButtonEls.map((el) => elementCardHtml(screen, el)).join("")
          : `<div class="text-xs text-gray-400 mb-3">No ${elementsSectionLabel.toLowerCase()} on this screen.</div>`
      }

      ${
        popupEls.length
          ? `
        <div class="flex items-center gap-1.5 mb-3 mt-5">
          <span class="text-sm font-semibold text-[#191D88]">Popups</span>
          <svg class="w-3.5 h-3.5 text-gray-400" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.3"/><path d="M10 9v5M10 6.5v.01" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </div>
        ${popupEls.map((el) => elementCardHtml(screen, el)).join("")}
        `
          : ""
      }

      ${
        buttonEls.length
          ? `
        <div class="flex items-center gap-1.5 mb-3 mt-5">
          <span class="text-sm font-semibold text-[#191D88]">Buttons</span>
          <svg class="w-3.5 h-3.5 text-gray-400" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.3"/><path d="M10 9v5M10 6.5v.01" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </div>
        ${buttonsHtml}
        `
          : ""
      }
    `;

    document.getElementById("prop-heading").addEventListener("input", (e) => {
      screen.pageHeading = e.target.value;
      renderCanvas();
    });
    document.getElementById("prop-description").addEventListener("input", (e) => {
      screen.pageDescription = e.target.value;
      renderCanvas();
    });
    root.querySelectorAll(".prop-toggle").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const el = screen.elements.find((x) => x.id === btn.dataset.elId);
        el.visible = !el.visible;
        // Turning the whole element off while a type was being previewed
        // left a stale "Previewing" row showing even though nothing
        // actually renders — clear it so the UI can't say both at once.
        if (el.states && !el.visible) el.activeStateId = null;
        // Some buttons take the place of another rather than showing
        // alongside it (e.g. "Download Beneficiary IDs" replaces "Register
        // New Beneficiary") — switching this one on hides the other, and
        // switching it back off restores it.
        if (el.replaces) {
          const replaced = screen.elements.find((x) => x.id === el.replaces);
          if (replaced) replaced.visible = !el.visible;
        }
        renderPropertiesPanel(); // full re-render so the card's "Hidden" badge updates too
        renderCanvas();
      });
    });
    root.querySelectorAll(".element-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        // Let the toggle/drag/nested state-row handle their own interaction;
        // don't also open the detail view.
        if (e.target.closest(".prop-toggle") || e.target.closest(".drag-handle") || e.target.closest(".state-row")) return;
        const clickedEl = screen.elements.find((x) => x.id === card.dataset.elCardId);
        if (clickedEl && clickedEl.states) return; // states-driven — its types list is already inline, nothing else to open
        // Reveal it in the preview if a state is hiding it (a button, a
        // whole result card, anything), or leave things be if it's already
        // showing — either way, highlight it after render.
        if (clickedEl) revealElementInPreview(screen, clickedEl);
        state.activeElementId = card.dataset.elCardId;
        state.fieldTab = "elements";
        renderPropertiesPanel();
        renderCanvas();
        if (clickedEl) highlightCanvasElement(clickedEl.id);
      });
    });
    root.querySelectorAll(".state-row[data-parent-id]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const parentEl = screen.elements.find((x) => x.id === btn.dataset.parentId);
        if (!parentEl) return;
        resetStatePreviews(screen, parentEl.id); // only one active preview on screen at a time
        // Selecting a type previews it live AND opens its own properties
        // (rename it, define the logic for when it applies) — both at once.
        parentEl.activeStateId = btn.dataset.stateId;
        state.activeElementId = parentEl.id;
        state.activeStateSubId = btn.dataset.stateId;
        state.stateSubTab = "elements";
        renderPropertiesPanel();
        renderCanvas();
      });
    });
    // The eye on its own only toggles the canvas preview — it never opens
    // the type's properties, unlike clicking the rest of the row.
    root.querySelectorAll(".state-eye[data-parent-id]").forEach((eye) => {
      const togglePreview = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const parentEl = screen.elements.find((x) => x.id === eye.dataset.parentId);
        if (!parentEl) return;
        const alreadyActive = parentEl.visible && parentEl.activeStateId === eye.dataset.stateId;
        resetStatePreviews(screen, parentEl.id); // only one active preview on screen at a time
        parentEl.activeStateId = alreadyActive ? null : eye.dataset.stateId;
        renderPropertiesPanel();
        renderCanvas();
      };
      eye.addEventListener("click", togglePreview);
      eye.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") togglePreview(e);
      });
    });
    root.querySelectorAll('.element-card[draggable="true"]').forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        draggedFieldId = card.dataset.dragFieldId;
        e.dataTransfer.effectAllowed = "move";
        card.classList.add("opacity-40");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("opacity-40");
        draggedFieldId = null;
      });
      card.addEventListener("dragover", (e) => {
        e.preventDefault(); // required to allow dropping
        if (draggedFieldId && draggedFieldId !== card.dataset.dragFieldId) {
          card.classList.add("ring-2", "ring-[#191D88]/40");
        }
      });
      card.addEventListener("dragleave", () => {
        card.classList.remove("ring-2", "ring-[#191D88]/40");
      });
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        card.classList.remove("ring-2", "ring-[#191D88]/40");
        const targetId = card.dataset.dragFieldId;
        if (!draggedFieldId || draggedFieldId === targetId) return;
        const fromIdx = screen.elements.findIndex((x) => x.id === draggedFieldId);
        const toIdx = screen.elements.findIndex((x) => x.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = screen.elements.splice(fromIdx, 1);
        screen.elements.splice(toIdx, 0, moved);
        draggedFieldId = null;
        renderPropertiesPanel();
        renderCanvas();
      });
    });
  }

  // ---------- Left nav rail ----------

  function renderNavRail() {
    document.querySelectorAll(".rail-item").forEach((btn) => {
      const isActive = btn.dataset.rail === state.activeNav;
      btn.classList.toggle("bg-blue-50", isActive);
      btn.classList.toggle("text-[#191D88]", isActive);
      btn.classList.toggle("font-medium", isActive);
      btn.classList.toggle("text-gray-500", !isActive);
    });
  }

  function renderMainArea() {
    const placeholder = document.getElementById("nav-placeholder");
    const workspace = document.getElementById("workspace");
    if (state.activeNav === "flows") {
      placeholder.classList.add("hidden");
      workspace.classList.remove("hidden");
    } else if (state.activeNav === null) {
      placeholder.classList.add("hidden");
      workspace.classList.remove("hidden");
      document.getElementById("flows-panel").innerHTML = "";
    } else {
      placeholder.classList.remove("hidden");
      workspace.classList.add("hidden");
      placeholder.innerHTML = `
        <div class="text-center text-gray-400 py-24">
          <div class="text-base font-medium text-gray-500 mb-1">${state.activeNav === "form-elements" ? "Form Elements" : "Roles"}</div>
          <div class="text-sm">Coming soon in this mock.</div>
        </div>`;
    }
  }

  // ---------- top-level render ----------

  function render() {
    renderNavRail();
    renderMainArea();
    if (state.activeNav === "flows" || state.activeNav === null) {
      renderFlowsPanel();
      renderTabs();
      renderCanvas();
      renderNavArrows();
      renderPropertiesPanel();
    }
  }

  window.addEventListener("resize", fitApkToFrame);
  // The frame also resizes without the window changing (e.g. the caption
  // under it hiding while a state is previewed).
  new ResizeObserver(fitApkToFrame).observe(document.getElementById("canvas"));

  function init() {
    document.getElementById("module-title").textContent = MODULE.name;
    document.getElementById("module-version").textContent = `(AppConfig Version - ${MODULE.version})`;

    document.querySelectorAll(".rail-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeNav = btn.dataset.rail;
        render();
      });
    });

    document.getElementById("nav-prev").addEventListener("click", () => stepScreen(-1));
    document.getElementById("nav-next").addEventListener("click", () => stepScreen(1));

    document.getElementById("save-config").addEventListener("click", () => {
      toast("Configuration saved");
      // eslint-disable-next-line no-console
      console.log("Saved module state:", JSON.parse(JSON.stringify(MODULE)));
    });

    document.getElementById("open-flows").addEventListener("click", () => {
      state.activeNav = "flows";
      render();
    });

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
