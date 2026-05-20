const path = require("path")
const express = require("express")
const fs = require("fs")
const { randomUUID } = require("crypto")

const app = express()

const PLAYLIST_FILE = path.join(__dirname, "playlists.json");

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
  const timeout = 30000

  for (const [tvId, ultimoHeartbeat] of tvHeartbeats.entries()) {
    if (agora - ultimoHeartbeat > timeout) {
      console.log(`⏱️ Timeout ${tvId}`)
      removerTV(tvId)
    }
  }
}, 10000)

// LER PLAYLISTS
function readPlaylists(){
  try{
    return JSON.parse(fs.readFileSync(PLAYLIST_FILE));
  }catch{
    return {};
  }
}
// SALVAR PLAYLISTS
function savePlaylists(data){
  fs.writeFileSync(PLAYLIST_FILE, JSON.stringify(data, null, 2));
}

// REGISTRO (AGORA COM REAPROVEITAMENTO DE ID)
app.post("/register", (req, res) => {

  let { tv } = req.body

  let state = JSON.parse(fs.readFileSync(STATE_FILE))

  // ✅ TV já existe
  if (tv) {

    // recria se não existir mais
    if (!state[tv]) {

      state[tv] = {
        pagina: "layouts/tela2.html",
        intervalo: 2000
      }

      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
    }

    tvHeartbeats.set(tv, Date.now())

    return res.json({ tv })
  }

  // procura menor número livre
  let numero = 1

  while (state[`tv${numero}`]) {
    numero++
  }

  let newTv = `tv${numero}`

  state[newTv] = {
    pagina: "layouts/tela2.html",
    intervalo: 2000
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))

  tvHeartbeats.set(newTv, Date.now())

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
      intervalo: 2000,
      refresh: Date.now()
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

//rota de leitura de playlists (vídeos, avisos, etc)
app.get("/playlist", (req,res)=>{

  let { tv, type } = req.query;

  if(!fs.existsSync("playlists.json")){

    return res.json([]);
  }

  let playlists =
    JSON.parse(
      fs.readFileSync("playlists.json")
    );

  let items = [];

  // 🔥 se não passar TV → retorna tudo
  if(!tv){
    Object.values(playlists).forEach(tvData => {
      if(tvData[type]){
        items.push(...tvData[type]);
      }
    });
  }else{
    items = playlists?.[tv]?.[type] || [];
  }

  res.json(items);
});


//rota para salvar playlists (vídeos, avisos, etc)
app.post("/save-playlist", (req,res)=>{

  let { tv, type, items } = req.body;

  let playlists = {};

  if(fs.existsSync("playlists.json")){

    playlists =
      JSON.parse(
        fs.readFileSync("playlists.json")
      );
  }

  if(!playlists[tv]){

    playlists[tv] = {};
  }

  playlists[tv][type] = items;

  fs.writeFileSync(
    "playlists.json",
    JSON.stringify(playlists,null,2)
  );

  res.json({ ok:true });
});

app.use("/uploads", express.static("uploads"));

//rota para aplicar em todas as telas
app.post("/update-all", (req, res) => {

  let { pagina, type, items, intervalo } = req.body;

  let state = JSON.parse(
    fs.readFileSync(STATE_FILE)
  );

  let playlists = readPlaylists();

  // aplica em TODAS as TVs
  Object.keys(state).forEach(tv => {

    // atualiza tela atual
    state[tv] = {
      pagina,
      intervalo: intervalo ?? 2000,
      refresh: Date.now()
    };

    // garante estrutura
    if(!playlists[tv]){
      playlists[tv] = {};
    }

    // salva playlist da TV
    playlists[tv][type] = [...items];
  });

  // salva state
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(state, null, 2)
  );

  // salva playlists
  savePlaylists(playlists);

  res.json({
    ok: true
  });

});