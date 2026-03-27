const path = require("path")
const express = require("express")
const fs = require("fs")

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 🔥 SERVE A MESMA PASTA DO APACHE
app.use(express.static("/var/www/html/painel"))

const STATE_FILE = "/var/www/html/painel/state.json"

// cria se não existir
if (!fs.existsSync(STATE_FILE)) {
  fs.writeFileSync(STATE_FILE, "{}")
}

// Map para rastrear heartbeat de cada TV
const tvHeartbeats = new Map()

// Função para remover TV do state.json
function removerTV(tvId) {
  try {
    let state = JSON.parse(fs.readFileSync(STATE_FILE))
    if (state[tvId]) {
      delete state[tvId]
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
      tvHeartbeats.delete(tvId)
      console.log(`❌ TV ${tvId} removida do sistema`)
    }
  } catch (e) {
    console.error(`Erro ao remover TV ${tvId}:`, e)
  }
}

// Checar TVs com timeout a cada 10 segundos
setInterval(() => {
  const agora = Date.now()
  const timeout = 10000 // 10 segundos sem heartbeat = TV desconectada

  for (const [tvId, ultimoHeartbeat] of tvHeartbeats.entries()) {
    if (agora - ultimoHeartbeat > timeout) {
      console.log(`⏱️ Timeout detectado para ${tvId}`)
      removerTV(tvId)
    }
  }
}, 10000)

// registrar TV
app.post("/register", (req, res) => {

  let state = JSON.parse(fs.readFileSync(STATE_FILE))

  let tvs = Object.keys(state)

  let newTv = "tv" + (tvs.length + 1)

  state[newTv] = "layouts/tela1.html"

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))

  res.json({ tv: newTv })

})

// atualizar tela
app.post("/update",(req,res)=>{

 let {tv,pagina} = req.body

 let state = JSON.parse(fs.readFileSync(STATE_FILE))

 state[tv] = pagina

 fs.writeFileSync(STATE_FILE,JSON.stringify(state,null,2))

 res.send({status:"ok"})

})

// estado
app.get("/state", (req, res) => {
  let state = JSON.parse(fs.readFileSync(STATE_FILE))
  res.json(state)
})

// heartbeat - TV envia ping indicando que está ativa
app.post("/ping", (req, res) => {
  const { tv } = req.body
  if (tv) {
    tvHeartbeats.set(tv, Date.now())
    console.log(`💓 Heartbeat recebido de ${tv}`)
    res.json({ status: "ok" })
  } else {
    res.status(400).json({ status: "error", message: "TV não informada" })
  }
})

// desregistrar TV (quando se desconecta)
app.post("/unregister", (req, res) => {
  const { tv } = req.body
  if (tv) {
    console.log(`🔌 Requisição de desconexão recebida de ${tv}`)
    removerTV(tv)
    res.json({ status: "ok" })
  } else {
    res.status(400).json({ status: "error", message: "TV não informada" })
  }
})

app.listen(3000,"0.0.0.0",()=>{
 console.log("Servidor rodando em http://10.190.31.40:3000")
})


