/**
 * The system map page (#1463): holds the state (what is open, filtered, selected), runs the
 * layout and the frame loop, and wires the canvas, the panels and the keyboard together. The rules
 * live in the pure modules; this file only connects them. Browser code.
 */
import { centerOn, clampZoom, fitPoints, toWorld } from './camera.mjs'
import { changedSince, choices } from './changes.mjs'
import { fill, h } from './dom.mjs'
import { drawEdges, drawGrid, drawLabels, drawMinimap, drawNode } from './draw.mjs'
import { createSim, forceStep, mindMap, regionHomes, seed } from './layout.mjs'
import { editorUrl } from './links.mjs'
import { ancestors, buildModel, moduleOf } from './model.mjs'
import { shortestPath } from './path.mjs'
import { attachPointer } from './pointer.mjs'
import {
  HOW_TO,
  buildControls,
  helpContent,
  nodeList,
  renderDetail,
  renderLegend,
  renderOutline,
  syncControls,
} from './panels.mjs'
import { searchNodes } from './search.mjs'
import {
  layerStyles as makeLayerStyles,
  moduleHues,
  radiusOf,
  typeStyles as makeTypeStyles,
} from './style.mjs'
import { collapseAll, computeView, expandAll, flip, reveal, startState, toggle } from './view.mjs'

const $ = (id) => document.getElementById(id)
const store = {
  get: (key) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* a browser that forbids storage just forgets */
    }
  },
}
const CHECKOUT_KEY = 'sprecher-east-system-map-checkout'
const THEME_KEY = 'sprecher-east-system-map-theme'

/** @public Called by the page's own script, which build-page.mjs appends after the bundle. */
export function startApp({ graph, history, snapshot, built }) {
  const model = buildModel(graph)
  const styles = makeTypeStyles(graph.nodeTypes)
  const layerStyles = makeLayerStyles(graph.layers)
  const hues = moduleHues(model.modules)
  const canvas = $('map')
  const ctx = canvas.getContext('2d')
  const mini = $('minimap')
  const miniCtx = mini.getContext('2d')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const stored = store.get(THEME_KEY)
  let dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches

  let state = startState(model)
  let view = computeView(model, state)
  let layout = 'free'
  let selected = null
  let hover = null
  let pathStart = null
  let path = []
  let sinceSha = ''
  let changed = new Set()
  let changedList = []
  let cam = { k: 1, tx: 0, ty: 0 }
  let size = { w: 800, h: 600, dpr: 1 }
  let alpha = 1
  let time = 0
  let follow = null
  let colors = {}
  let refs = null
  let miniMap = null
  const sim = createSim()
  const homes = regionHomes(model)
  const born = new Map()
  const pinned = new Set()
  let targets = new Map()

  const childCount = (id) => model.children.get(id).length
  const radius = (id) => radiusOf(styles, model.nodes.get(id), childCount(id))
  const moduleHueOf = (id) => {
    const m = moduleOf(model, id)
    return m && hues[m] !== undefined ? hues[m] : null
  }
  const focus = () => {
    if (path.length > 0) return new Set(path)
    if (selected === null) return new Set()
    const set = new Set([selected])
    for (const e of view.edges)
      if (e.from === selected || e.to === selected) set.add(e.from === selected ? e.to : e.from)
    return set
  }

  const say = (text) => {
    $('announce').textContent = text
  }
  let toastTimer = 0
  const toast = (text) => {
    fill($('toast'), text)
    $('toast').hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => ($('toast').hidden = true), 4000)
    say(text)
  }

  function readColors() {
    const style = getComputedStyle(document.documentElement)
    const get = (name) => style.getPropertyValue(name).trim()
    colors = {
      bg: get('--background'),
      fg: get('--foreground'),
      muted: get('--muted-foreground'),
      ring: get('--ring'),
      warning: get('--warning-strong'),
    }
  }

  // ── Scene and frame ────────────────────────────────────────────────────────────
  const scene = () => ({
    cam,
    width: size.w,
    height: size.h,
    view,
    model,
    pos: sim.pos,
    colors,
    dark,
    time,
    selected,
    hover,
    path,
    changed,
    born,
    pinned,
    focus: focus(),
    reducedMotion: reduced.matches,
    typeStyles: styles,
    layerStyles,
    radius,
    hueOf: (id) => moduleHueOf(id) ?? styles[model.nodes.get(id).type].hue,
    fillHueOf: (id) =>
      (model.nodes.get(id).type === 'module' ? moduleHueOf(id) : null) ??
      styles[model.nodes.get(id).type].hue,
    moduleHueOf,
    depthOf: (id) => model.depth.get(id),
    hasHidden: (id) => childCount(id) > 0 && !state.expanded.has(id),
  })

  function settle(steps) {
    for (let i = 0; i < steps; i++)
      forceStep(sim, model, view, homes, Math.max(0.05, 1 - i / steps), radius)
  }

  function moveTowardTargets() {
    let far = 0
    for (const [id, t] of targets) {
      const p = sim.pos.get(id)
      if (!p || !view.shown.has(id)) continue
      p.x += (t.x - p.x) * 0.16
      p.y += (t.y - p.y) * 0.16
      far = Math.max(far, Math.abs(t.x - p.x) + Math.abs(t.y - p.y))
    }
    return far
  }

  let raf = 0
  let drawQueued = false
  function frame(now) {
    time = now
    drawQueued = false
    if (layout === 'free') {
      if (alpha > 0.03) {
        forceStep(sim, model, view, homes, alpha, radius)
        alpha *= 0.985
      }
    } else if (!reduced.matches) moveTowardTargets()
    if (follow && sim.pos.has(follow.id)) {
      const p = sim.pos.get(follow.id)
      const goal = centerOn(cam, p.x, p.y, follow.free.w, follow.free.h, follow.k)
      const ease = reduced.matches ? 1 : 0.14
      cam = {
        k: cam.k + (goal.k - cam.k) * ease,
        tx: cam.tx + (goal.tx - cam.tx) * ease,
        ty: cam.ty + (goal.ty - cam.ty) * ease,
      }
    }
    paint()
    if (!reduced.matches) raf = requestAnimationFrame(frame)
  }
  const requestDraw = () => {
    if (!reduced.matches || drawQueued) return
    drawQueued = true
    raf = requestAnimationFrame(frame)
  }

  function paint() {
    const s = scene()
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    drawGrid(ctx, s)
    drawEdges(ctx, s)
    const order = [...view.ids].sort((a, b) => radius(b) - radius(a))
    for (const id of order) drawNode(ctx, s, id)
    drawLabels(ctx, s)
    miniCtx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
    miniMap = drawMinimap(miniCtx, s, { w: mini.clientWidth, h: mini.clientHeight })
  }

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect()
    size = {
      w: Math.max(r.width, 200),
      h: Math.max(r.height, 200),
      dpr: window.devicePixelRatio || 1,
    }
    for (const [el, w, hh] of [
      [canvas, size.w, size.h],
      [mini, mini.clientWidth, mini.clientHeight],
    ]) {
      el.width = Math.round(w * size.dpr)
      el.height = Math.round(hh * size.dpr)
    }
    requestDraw()
  }

  // ── State changes ──────────────────────────────────────────────────────────────
  function apply(next, { kick = true } = {}) {
    const before = view.shown
    state = next
    view = computeView(model, state)
    if (selected !== null && !view.shown.has(selected)) selected = null
    path = path.filter((id) => view.shown.has(id))
    seed(sim, model, view, homes)
    for (const id of view.ids) if (!before.has(id)) born.set(id, time)
    if (layout === 'mind') targets = mindMap(model, view)
    if (kick) alpha = 1
    if (reduced.matches) {
      if (layout === 'mind') for (const [id, t] of targets) Object.assign(sim.pos.get(id), t)
      else settle(120)
    }
    syncControls(refs, state, layout)
    renderOutline($('outline'), model, view, state, selected, api)
    updateDetail()
    $('counts').textContent =
      `${view.ids.filter((id) => !model.nodes.get(id).virtual).length} of ${model.graph.nodes.length} nodes shown · ${model.graph.edges.length} connections`
    requestDraw()
  }

  function updateDetail() {
    const panel = $('detail')
    const node = selected === null ? null : model.nodes.get(selected)
    panel.hidden = node === null
    document.body.classList.toggle('detail-open', node !== null)
    if (node === null) return
    renderDetail(panel, {
      node,
      model,
      view,
      history,
      snapshot,
      folder: store.get(CHECKOUT_KEY),
      api,
      since: changed,
    })
  }

  /** Clears the filters that would hide this node, so a search or a link always shows it. */
  function unhide(id, from = state) {
    const node = model.nodes.get(id)
    const m = moduleOf(model, id)
    let next = from
    if (next.hiddenTypes.has(node.type)) next = flip(next, 'hiddenTypes', node.type)
    if (m && next.hiddenModules.has(m)) next = flip(next, 'hiddenModules', m)
    if (next.solo !== null && next.solo !== m) next = { ...next, solo: null }
    return reveal(model, next, id)
  }

  function flyTo(id) {
    const p = sim.pos.get(id)
    if (!p) return
    const near = [...focus()].map((n) => sim.pos.get(n)).filter(Boolean)
    // The part of the screen the panels leave free: beside the detail panel, or above the sheet.
    const phone = window.innerWidth <= 760
    const free = { w: phone ? size.w : size.w - 400, h: phone ? size.h * 0.4 : size.h }
    const fitted = fitPoints(near.length > 1 ? near : [p], free.w, free.h, 70, 1.3)
    follow = { id, k: clampZoom(Math.max(fitted.k, 0.5)), free }
    if (reduced.matches) {
      cam = centerOn(cam, p.x, p.y, free.w, free.h, follow.k)
      follow = null
      requestDraw()
    }
  }

  function select(id, fly = true) {
    if (pathStart !== null && id !== pathStart) {
      const route = shortestPath(model, state, pathStart, id)
      pathStart = null
      refs.trace.setAttribute('aria-pressed', 'false')
      if (route === null) toast('No route between them with these layers switched on.')
      else {
        const next = route.reduce((acc, step) => unhide(step, acc), state)
        selected = id
        path = route
        apply(next, { kick: false })
        toast(
          `Shortest path: ${route.map((r) => model.nodes.get(r).name).join(' → ')} (${route.length - 1} steps).`,
        )
        const mid = route.map((r) => sim.pos.get(r))
        cam = fitPoints(mid, size.w, size.h, 120, 1.2)
        return
      }
    }
    path = []
    selected = id
    apply(unhide(id), { kick: false })
    updateDetail()
    renderOutline($('outline'), model, view, state, selected, api)
    const node = model.nodes.get(id)
    say(
      `${node.name}, ${node.type.replace(/-/g, ' ')}, ${view.edges.filter((e) => e.from === id || e.to === id).length} connections shown.`,
    )
    if (fly) flyTo(id)
    requestDraw()
  }

  function clearSelection() {
    selected = null
    path = []
    pathStart = null
    follow = null
    refs.trace.setAttribute('aria-pressed', 'false')
    $('search').value = ''
    nodeList(refs.results, model, [], () => {}, '')
    apply(state, { kick: false })
  }

  function setLayout(mode) {
    layout = mode
    if (mode === 'mind') targets = mindMap(model, view)
    alpha = 1
    syncControls(refs, state, layout)
    if (reduced.matches) apply(state)
    api.fit()
  }

  function setTheme(next) {
    dark = next
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    store.set(THEME_KEY, dark ? 'dark' : 'light')
    readColors()
    buildUi()
    requestDraw()
  }

  const api = {
    search(text) {
      const found = searchNodes(model, text)
      nodeList(
        refs.results,
        model,
        found,
        (id) => select(id, true),
        text.trim() ? 'Nothing matches.' : '',
      )
      say(text.trim() ? `${found.length} results.` : '')
    },
    searchEnter() {
      const [first] = searchNodes(model, refs.search.value)
      if (first) select(first.id, true)
    },
    select: (id) => select(id, true),
    toggleNode: (id) => apply(toggle(state, id)),
    toggleLayer: (key) => apply(flip(state, 'hiddenLayers', key), { kick: false }),
    toggleType: (key) => apply(flip(state, 'hiddenTypes', key)),
    toggleModule: (id) => apply({ ...flip(state, 'hiddenModules', id), solo: null }),
    soloModule: (id) =>
      apply({ ...state, solo: state.solo === id ? null : id, hiddenModules: new Set() }),
    showAllModules: () => apply({ ...state, solo: null, hiddenModules: new Set() }),
    expandAll: () => {
      apply(expandAll(model, state))
      api.fit()
    },
    collapseAll: () => {
      apply(collapseAll(model, state))
      api.fit()
    },
    setLayout,
    fit() {
      follow = null
      const pts = view.ids.map((id) => sim.pos.get(id)).filter(Boolean)
      const target = layout === 'mind' ? [...targets.values()] : pts
      cam = fitPoints(target.length ? target : pts, size.w, size.h)
      requestDraw()
    },
    tracePath() {
      if (pathStart !== null) {
        pathStart = null
        refs.trace.setAttribute('aria-pressed', 'false')
        return
      }
      if (selected === null) {
        toast('Pick a first node, then press Trace path.')
        return
      }
      api.traceFrom(selected)
    },
    traceFrom(id) {
      pathStart = id
      refs.trace.setAttribute('aria-pressed', 'true')
      toast(`Now pick the second node. The route starts at ${model.nodes.get(id).name}.`)
    },
    setSince(sha) {
      sinceSha = sha
      const result = sha ? changedSince(history, sha) : { ids: new Set(), list: [] }
      changed = result.ids
      changedList = result.list
      nodeList(
        refs.changes,
        model,
        changedList.map((c) => ({ id: c.id, why: `${c.date.slice(0, 10)}: ${c.subject}` })),
        (id) => select(id, true),
        sha ? 'Nothing changed since then.' : '',
      )
      requestDraw()
      updateDetail()
    },
    clearSelection,
    isPinned: (id) => pinned.has(id),
    unpin(id) {
      pinned.delete(id)
      const p = sim.pos.get(id)
      if (p) p.pinned = false
      alpha = Math.max(alpha, 0.5)
      updateDetail()
    },
    openHelp: () => $('help').showModal(),
    openEditor(id) {
      const folder = store.get(CHECKOUT_KEY)
      const url = editorUrl(folder, model.nodes.get(id).path)
      if (url) location.assign(url)
      else {
        $('folder-input').value = folder ?? ''
        $('folder').dataset.node = id
        $('folder').showModal()
      }
    },
  }

  const host = {
    camera: () => cam,
    setCamera(next) {
      cam = next
      requestDraw()
    },
    interrupt() {
      follow = null
    },
    size: () => size,
    hit(x, y, coarse) {
      const slack = coarse ? 14 : 4
      const world = toWorld(cam, x, y)
      let best = null
      let bestD = Infinity
      for (const id of view.ids) {
        const p = sim.pos.get(id)
        const reach = (radius(id) * (0.55 + 0.45 * Math.min(cam.k, 2))) / cam.k + slack / cam.k
        const d = Math.hypot(p.x - world.x, p.y - world.y)
        if (d <= reach && d < bestD) {
          best = id
          bestD = d
        }
      }
      return best
    },
    hover(id, cx, cy) {
      if (id === hover) return
      hover = id
      const tip = $('tooltip')
      tip.hidden = id === null
      canvas.style.cursor = id ? 'pointer' : 'grab'
      if (id) {
        const node = model.nodes.get(id)
        fill(
          tip,
          h('strong', {}, node.name),
          h('span', {}, ` ${node.type.replace(/-/g, ' ')}`),
          node.summary ? h('p', {}, node.summary.slice(0, 140)) : null,
        )
        const r = canvas.getBoundingClientRect()
        tip.style.left = `${Math.min(cx - r.left + 14, size.w - 260)}px`
        tip.style.top = `${cy - r.top + 14}px`
      }
      requestDraw()
    },
    subtree: (id) => ({
      head: id,
      ids: view.ids.filter((n) => n === id || ancestors(model, n).includes(id)),
    }),
    dragNode({ head, ids }, dx, dy) {
      for (const id of ids) {
        const p = sim.pos.get(id)
        p.x += dx
        p.y += dy
        p.vx = 0
        p.vy = 0
        if (targets.has(id)) targets.set(id, { x: p.x, y: p.y })
      }
      pinned.add(head)
      sim.pos.get(head).pinned = true
      requestDraw()
    },
    select: (id, fly) => select(id, fly),
    open: (id) => apply(toggle(state, id)),
    unpin: (id) => api.unpin(id),
    background() {
      if (selected !== null || path.length > 0) clearSelection()
    },
  }
  // ── Page furniture ─────────────────────────────────────────────────────────────
  function buildUi() {
    refs = buildControls({ model, styles, layerStyles, moduleHueOf: (id) => hues[id], dark, api })
    fill($('controls'), refs.el)
    renderLegend($('legend'), { model, styles, dark })
    const c = choices(history)
    fill(
      refs.since,
      h('option', { value: '' }, c.length ? 'Choose a build…' : 'No history in this build'),
      c.map((commit) =>
        h(
          'option',
          { value: commit.sha },
          `${commit.date.slice(0, 10)} ${commit.subject.slice(0, 60)}`,
        ),
      ),
    )
    refs.since.disabled = c.length === 0
    refs.since.value = sinceSha
    refs.sinceNote.textContent = history?.available
      ? 'Marks what changed after the build you pick, and lists it.'
      : `No change history in this build${history?.reason ? ` (${history.reason})` : ''}.`
    syncControls(refs, state, layout)
    renderOutline($('outline'), model, view, state, selected, api)
    api.setSince(sinceSha)
  }

  function footer() {
    const hist = history?.available
      ? `change history up to ${history.head.slice(0, 7)}`
      : 'no change history'
    const snap = snapshot?.available
      ? `open issues as of ${snapshot.date}`
      : 'no open-issue snapshot'
    $('footer-text').textContent =
      `Built ${built.date} from docs/knowledge/graph.json (${model.graph.nodes.length} nodes, ${model.graph.edges.length} connections), ${hist}, ${snap}. Rebuild: ${built.command}`
  }

  const typing = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
  function onKey(e) {
    if (e.key === 'Escape' && !$('help').open) {
      if (typing(e)) e.target.blur()
      clearSelection()
      return
    }
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('dialog')) return
    const keys = {
      '/': () => $('search').focus(),
      f: () => api.fit(),
      e: () => api.expandAll(),
      c: () => api.collapseAll(),
      l: () => setLayout(layout === 'free' ? 'mind' : 'free'),
      p: () => api.tracePath(),
      t: () => setTheme(!dark),
      '?': () => api.openHelp(),
      u: () => selected && api.unpin(selected),
      s: () => document.body.classList.toggle('controls-hidden'),
      Enter: () => e.target === canvas && selected && apply(toggle(state, selected)),
    }
    const run = keys[e.key.length === 1 ? e.key.toLowerCase() : e.key]
    if (!run) return
    e.preventDefault()
    run()
  }

  function init() {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    if (window.matchMedia('(max-width: 760px)').matches)
      document.body.classList.add('controls-hidden')
    readColors()
    buildUi()
    fill(
      $('help-body'),
      h(
        'ul',
        {},
        HOW_TO.map((t) => h('li', {}, t)),
      ),
      h('h3', {}, 'Keyboard shortcuts'),
      helpContent(),
    )
    $('theme-btn').addEventListener('click', () => setTheme(!dark))
    $('panel-btn').addEventListener('click', () =>
      document.body.classList.toggle('controls-hidden'),
    )
    $('help-btn').addEventListener('click', () => api.openHelp())
    $('help-close').addEventListener('click', () => $('help').close())
    $('folder-form').addEventListener('submit', (e) => {
      e.preventDefault()
      const value = $('folder-input').value.trim()
      if (editorUrl(value, 'x')) {
        store.set(CHECKOUT_KEY, value)
        const id = $('folder').dataset.node
        $('folder').close()
        updateDetail()
        if (id) api.openEditor(id)
      } else $('folder-error').textContent = 'That does not look like a folder path.'
    })
    $('folder-cancel').addEventListener('click', () => $('folder').close())
    $('mini-hit').addEventListener('click', (e) => {
      if (!miniMap) return
      const r = mini.getBoundingClientRect()
      const world = toWorld(miniMap, e.clientX - r.left, e.clientY - r.top)
      cam = centerOn(cam, world.x, world.y, size.w, size.h)
      follow = null
      requestDraw()
    })
    attachPointer(canvas, host)
    document.addEventListener('keydown', onKey)
    new ResizeObserver(resize).observe(canvas.parentElement)
    reduced.addEventListener('change', () => {
      cancelAnimationFrame(raf)
      if (!reduced.matches) raf = requestAnimationFrame(frame)
      else requestDraw()
    })
    footer()
    seed(sim, model, view, homes)
    settle(160)
    alpha = 0.3
    resize()
    api.fit()
    $('loading').hidden = true
    $('app').setAttribute('aria-busy', 'false')
    apply(state, { kick: false })
    raf = requestAnimationFrame(frame)
    toast('New here? Press ? for how to use this map.')
  }
  init()
  return { api, state: () => state, view: () => view, select }
}
