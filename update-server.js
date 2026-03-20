/*const express = require("express")
const fs = require("fs")

const app = express()
app.use(express.json())


const STATE_FILE = "/var/www/html/painel/state.json"


app.post("/update",(req,res)=>{

 let {tv,pagina} = req.body

 let state = JSON.parse(fs.readFileSync(STATE_FILE))

 state[tv] = pagina

 fs.writeFileSync(STATE_FILE,JSON.stringify(state,null,2))

 res.send({status:"ok"})

})

app.listen(3000,"0.0.0.0",()=>{
 console.log("Servidor rodando na porta 3000")
})
 console.log("Servidor de atualização rodando") */

const path = require("path")
const express = require("express")
const fs = require("fs")

const app = express()

app.use(express.json())

// 🔥 SERVE A MESMA PASTA DO APACHE
app.use(express.static("/var/www/html/painel"))

const STATE_FILE = "/var/www/html/painel/state.json"

// cria se não existir
if (!fs.existsSync(STATE_FILE)) {
  fs.writeFileSync(STATE_FILE, "{}")
}

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

app.listen(3000,"0.0.0.0",()=>{
 console.log("Servidor rodando em http://10.190.31.40:3000")
})