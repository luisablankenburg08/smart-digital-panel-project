const path = require("path")
const express = require("express")
const fs = require("fs")
const { randomUUID } = require("crypto")

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(express.static("/var/www/html/painel"))

const STATE_FILE = "/var/www/html/painel/state.json"

if (!fs.existsSync(STATE_FILE)) {
  fs.writeFileSync(STATE_FILE, "{}")
}

const tvHeartbeats = new Map()

function removerTV(tvId) {
  try {
    let state = JSON.parse(fs.readFileSync(STATE_FILE))

    if (state[tvId]) {
      delete state[tvId]
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
      tvHeartbeats.delete(tvId)
      console.log(`❌ TV ${tvId} removida`)
    }
  } catch (e) {
    console.error(`Erro ao remover TV ${tvId}:`, e)
  }
}

setInterval(() => {
  const agora = Date.now()
  const timeout = 10000

  for (const [tvId, ultimoHeartbeat] of tvHeartbeats.entries()) {
    if (agora - ultimoHeartbeat > timeout) {
      console.log(`⏱️ Timeout ${tvId}`)
      removerTV(tvId)
    }
  }
}, 10000)

// REGISTRO (AGORA COM REAPROVEITAMENTO DE ID)
app.post("/register", (req, res) => {
  let { tv } = req.body
  let state = JSON.parse(fs.readFileSync(STATE_FILE))
  let tvs = Object.keys(state)

  // ✅ Se já existe → reutiliza
  if (tv && state[tv]) {
    tvHeartbeats.set(tv, Date.now()) // 🔥 MARCA COMO ATIVA
    return res.json({ tv })
  }

  // ✅ cria nova
  let newTv = "tv-" + (tvs.length + 1)

  state[newTv] = {
    pagina: "layouts/tela1.html",
    intervalo: 2000
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))

  tvHeartbeats.set(newTv, Date.now()) // 🔥 ESSENCIAL

  res.json({ tv: newTv })
})

// UPDATE (AGORA COM INTERVALO)
app.post("/update", (req, res) => {

  let { tv, pagina, intervalo } = req.body

  let state = JSON.parse(fs.readFileSync(STATE_FILE))

  if (!state[tv]) {
    return res.status(404).send("TV não encontrada")
  }

  // 🔥 garante estrutura completa
  if (typeof state[tv] === "string") {
    state[tv] = {
      pagina: state[tv],
      intervalo: 2000
    }
  }

  // 🔥 mantém valores antigos se não vierem novos
  state[tv] = {
    pagina: pagina ?? state[tv].pagina,
    intervalo: intervalo ?? state[tv].intervalo
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))

  res.json({ status: "ok" })
})


// STATE
app.get("/state", (req, res) => {
  let state = JSON.parse(fs.readFileSync(STATE_FILE))
  res.json(state)
})

// HEARTBEAT
app.post("/ping", (req, res) => {
  const { tv } = req.body

  if (tv) {
    tvHeartbeats.set(tv, Date.now())
    res.json({ status: "ok" })
  } else {
    res.status(400).json({ status: "error" })
  }
})

// UNREGISTER
app.post("/unregister", (req, res) => {
  const { tv } = req.body

  if (tv) {
    removerTV(tv)
    res.json({ status: "ok" })
  } else {
    res.status(400).json({ status: "error" })
  }
})

app.listen(3000, "0.0.0.0", () => {
  console.log("Servidor rodando")
})
