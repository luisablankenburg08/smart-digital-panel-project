const express = require("express")
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
 console.log("Servidor de atualização rodando")