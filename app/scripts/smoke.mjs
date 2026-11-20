// End-to-end smoke test for Agent 茶话会.
// Drives the real Electron renderer over the Chrome DevTools Protocol.
// It starts from an empty data directory, completes onboarding in demo mode,
// creates an Agent from a bundled character pack, sends a chat message,
// checks usage accounting, then relaunches the app to verify persistence.

import { spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const userData = path.join(root, '.smoke', 'e2e')
const port = Number(process.env.TEA_SMOKE_PORT || 9333)
const origin = 'http://127.0.0.1:' + port
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let child = null
let ws = null
let nextId = 0
const pending = new Map()
const results = []

function ok(name, detail) {
  results.push({ name, ok: true, detail })
  console.log('  PASS ' + name + (detail ? ' — ' + detail : ''))
}

function assert(name, condition, detail) {
  if (!condition) throw new Error(name + (detail ? ': ' + detail : ''))
  ok(name, detail)
}

async function waitFor(expr, label, timeout = 30000) {
  const started = Date.now()
  let lastError = ''
  while (Date.now() - started < timeout) {
    try {
      if (await evaluate(expr)) return
    } catch (err) {
      lastError = String(err.message || err)
    }
    await sleep(250)
  }
  throw new Error('timeout waiting for ' + label + (lastError ? ' (' + lastError + ')' : ''))
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.addEventListener('open', () => resolve(socket), { once: true })
    socket.addEventListener('error', () => reject(new Error('CDP websocket failed')), { once: true })
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (!message.id) return
      const item = pending.get(message.id)
      if (!item) return
      pending.delete(message.id)
      if (message.error) item.reject(new Error(message.error.message))
      else item.resolve(message.result)
    })
  })
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error('CDP timeout: ' + method))
    }, 20000)
  })
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  })
  if (response.exceptionDetails) {
    const detail = response.exceptionDetails.exception?.description || response.exceptionDetails.text
    throw new Error('renderer exception: ' + detail)
  }
  return response.result?.value
}

async function launch(label) {
  const env = { ...process.env, TEA_USER_DATA: userData }
  delete env.ELECTRON_RUN_AS_NODE
  child = spawn(electronPath, ['--remote-debugging-port=' + port, '.'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  child.stdout.on('data', (chunk) => {
    const text = String(chunk).trim()
    if (text) console.log('  [app:' + label + '] ' + text.split('\n').slice(-1)[0])
  })
  child.stderr.on('data', (chunk) => {
    const text = String(chunk).trim()
    if (text && !text.includes('DevTools listening')) console.log('  [app:' + label + '] ' + text.split('\n').slice(-1)[0])
  })

  const deadline = Date.now() + 40000
  let target = null
  while (Date.now() < deadline) {
    try {
      const list = await fetch(origin + '/json/list').then((r) => r.json())
      target = list.find((item) => item.type === 'page' && item.url.includes('index.html'))
      if (target?.webSocketDebuggerUrl) break
    } catch {
      // Electron is still starting.
    }
    await sleep(400)
  }
  if (!target) throw new Error('Electron page target not available')

  ws = await connect(target.webSocketDebuggerUrl)
  await send('Runtime.enable')
  await sleep(600)
}

async function shutdown() {
  try { await send('Browser.close') } catch { /* already closing */ }
  const deadline = Date.now() + 8000
  while (child && child.exitCode === null && Date.now() < deadline) await sleep(200)
  if (child && child.exitCode === null) child.kill()
  if (ws) { try { ws.close() } catch { /* ignore */ } }
  ws = null
  pending.clear()
  await sleep(500)
}

async function clickButton(text) {
  const clicked = await evaluate('(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes(' + JSON.stringify(text) + ')); if (!b || b.disabled) return false; b.click(); return true })()')
  if (!clicked) throw new Error('button not clickable: ' + text)
}

async function main() {
  console.log('Agent 茶话会 smoke test')
  console.log('  app: ' + root)
  console.log('  data: ' + userData)
  rmSync(userData, { recursive: true, force: true })

  // Phase 1: first-run onboarding from an empty database.
  await launch('onboarding')
  await waitFor('Boolean(document.querySelector(".onboarding"))', 'onboarding screen')
  const heading = await evaluate('document.body.innerText')
  assert('first launch shows onboarding', heading.includes('先接入你自己的模型'))
  assert('no fabricated connection state', heading.includes('连接测试会真实请求你填写的地址'))

  await clickButton('没有 Key，用演示模式')
  await waitFor('document.body.innerText.includes("社区娘化 AI")', 'character gallery after demo provider')
  ok('demo provider setup advances to character creation')

  await waitFor('document.querySelectorAll(".character-card").length >= 4', 'bundled character cards')
  const cardCount = await evaluate('document.querySelectorAll(".character-card").length')
  assert('bundled community presets load', cardCount >= 4, cardCount + ' cards')

  await evaluate('document.querySelector(".character-card").click(); true')
  await waitFor('document.querySelector(".personality-scroll") && document.body.innerText.includes("角色档案")', 'character detail modal')
  assert('character detail shows full personality', (await evaluate('document.querySelector(".personality-scroll").innerText.length')) > 300)

  await clickButton('创建这位 Agent')
  await waitFor('location.hash === "#/" && Boolean(document.querySelector(".composer textarea"))', 'chat workspace after agent creation', 40000)
  const agents = await evaluate('window.tea.listAgents()')
  assert('agent created from character pack', agents.length === 1 && agents[0].name.length > 0, agents.map((a) => a.name).join(', '))
  assert('agent avatar copied into local app data', Boolean(agents[0].avatarPath) && existsSync(agents[0].avatarPath), agents[0].avatarPath)
  const rooms = await evaluate('window.tea.listRooms()')
  assert('first tea room created', rooms.length === 1, rooms[0]?.name)

  // Phase 2: send a message, observe the streamed demo reply, check accounting.
  const before = await evaluate('document.querySelectorAll(".msg-row.theirs").length')
  const typed = await evaluate('(() => { const ta = document.querySelector(".composer textarea"); if (!ta) return false; const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set; setter.call(ta, "你好呀，第一次见面"); ta.dispatchEvent(new Event("input", { bubbles: true })); return true })()')
  assert('composer accepts input', typed)
  await sleep(350)
  await evaluate('document.querySelector(".composer .send-btn").click(); true')
  await waitFor('document.body.innerText.includes("没有调用任何真实模型") && document.querySelectorAll(".msg-row.theirs").length > ' + before, 'streamed demo reply', 30000)
  const reply = await evaluate('document.querySelector(".msg-row.theirs .bubble")?.innerText ?? ""')
  assert('mock reply is explicitly marked as offline demo', reply.includes('未联网') && reply.includes('没有调用任何真实模型'))

  await waitFor('window.tea.getStats().then((s) => s.totals.inputTokens > 0 && s.totals.outputTokens > 0 && !document.querySelector(".bubble.streaming"))', 'persisted usage accounting', 20000)
  const stats = await evaluate('window.tea.getStats()')
  assert('usage accounting records tokens', stats.totals.inputTokens > 0 && stats.totals.outputTokens > 0, stats.totals.inputTokens + ' in / ' + stats.totals.outputTokens + ' out')
  assert('usage is marked estimated for mock provider', stats.totals.estimatedMessages > 0, stats.totals.estimatedMessages + ' estimated')

  const memories = await evaluate('window.tea.listMemories()')
  assert('independent memory persisted after chat', memories.length >= 1, memories.length + ' memories')

  const settings = await evaluate('window.tea.bootstrap()')
  assert('onboarding flag persisted', settings.settings.onboarded === true)
  assert('demo mode flagged in settings', settings.settings.demoMode === true)

  await sleep(1200)
  await shutdown()
  ok('app closed cleanly after first run')

  // Phase 3: relaunch the same data directory and verify persistence.
  await launch('relaunch')
  await waitFor('Boolean(document.querySelector(".composer textarea"))', 'chat workspace after relaunch', 40000)
  const survivors = await evaluate('window.tea.listAgents()')
  assert('agent survives relaunch', survivors.length === 1, survivors[0]?.name)
  const messages = await evaluate('document.querySelectorAll(".msg-row").length')
  assert('chat history survives relaunch', messages >= 2, messages + ' message rows')
  const hasGreeting = await evaluate('document.body.innerText.includes("你好呀，第一次见面")')
  assert('sent message text survives relaunch', hasGreeting)
  await shutdown()
  ok('relaunch persistence verified')

  console.log('\n' + results.length + ' checks passed')
}

try {
  await main()
  process.exitCode = 0
} catch (error) {
  console.error('\nSMOKE FAILED: ' + (error.stack || error.message || error))
  process.exitCode = 1
} finally {
  if (child && child.exitCode === null) {
    try { await shutdown() } catch { child.kill() }
  }
}
