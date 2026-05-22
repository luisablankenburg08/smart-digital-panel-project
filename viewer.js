

// =========================
// 🔧 CONFIG INICIAL
// =========================
let playlistRodando = false;
let params = new URLSearchParams(window.location.search);
let preview = params.get("preview") === "true";

let tvId = preview
  ? params.get("tv")
  : localStorage.getItem("tvId");

// controle interno
let ultimaPagina = null;
let intervaloAtual = 2000;
let modoAtual = "iframe";


let ultimoConteudo = "";
let carregandoConteudo = false;
let ultimoRefresh = null;

// timers
let heartbeatInterval = null;
let polling = null;

// rodar playlist padrão
let playlistIndex = 0;
let playlistCache = [];
let playlistTimer = null;


async function rodarPlaylist(tipo){

  if(carregandoConteudo) return;

  let res = await fetch(`/playlist?tv=${tvId}&type=${tipo}`);
  let items = await res.json();

  if(!items || items.length === 0){
    return;
  }

  playlistCache = items;

  let item = items[playlistIndex];

  mostrarItemPlaylist(tipo, item);

  // próximo
  playlistIndex = (playlistIndex + 1) % items.length;
}

function mostrarItemPlaylist(tipo, item){

  let frame = document.getElementById("frame");
  let content = document.getElementById("content");

  if(playlistTimer) clearTimeout(playlistTimer);

  // =========================
  // VÍDEO
  // =========================
  if(tipo === "videos"){

    frame.style.display = "block";
    content.style.display = "none";

    frame.src = item.iframe;

    playlistTimer = setTimeout(() => {
      rodarPlaylist("videos");
    }, item.duracao * 1000 || 60000);

    return;
  }

  // =========================
  // AVISO
  // =========================
  if(tipo === "avisos"){

    frame.style.display = "none";
    content.style.display = "block";

    content.innerHTML = `
      <div class="aviso">
        <fieldset class="field-texto">
          <legend>
            <img src="/layouts/imagem-alerta.png" class="warning-image">
          </legend>
          ${item.texto}
        </fieldset>
      </div>
    `;

    playlistTimer = setTimeout(() => {
      rodarPlaylist("avisos");
    }, 5000);

    return;
  }

  // =========================
  // MAPA
  // =========================
  if(tipo === "mapa"){

    frame.style.display = "none";
    content.style.display = "block";

    content.innerHTML = `
      <img src="${item.src}" class="imagemViewer">
    `;

    playlistTimer = setTimeout(() => {
      rodarPlaylist("mapa");
    }, 10000);

    return;
  }
}

async function rodarModoPadrao(){

  let res = await fetch(`/playlist?tv=${tvId}&type=padrao`);
  let items = await res.json();

  if(!items || items.length === 0){
    return;
  }

  let item = items[playlistIndex];

  mostrarItemPlaylist(item.tipo, item);

  playlistIndex = (playlistIndex + 1) % items.length;

  // ⏱️ tempo automático
  let tempo = 5000;

  if(item.tipo === "videos"){
    tempo = item.duracao * 1000 || 60000;
  }

  if(item.tipo === "mapa"){
    tempo = 10000;
  }

  if(item.tipo === "avisos"){
    tempo = 5000;
  }

  if(playlistTimer) clearTimeout(playlistTimer);

  playlistTimer = setTimeout(() => {
    rodarModoPadrao();
  }, tempo);
}
// =========================
// REGISTRO
// =========================
async function registrar(){

  if(preview) return;

  try{
    let res = await fetch("/register", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ tv: tvId })
    });

    let data = await res.json();

    tvId = data.tv;
    localStorage.setItem("tvId", tvId);

    iniciarHeartbeat();
    await ping();

  }catch(e){
    console.error("Erro register:", e);
  }
}

// =========================
// HEARTBEAT
// =========================
async function ping(){

  if(preview) return;

  try{
    await fetch("/ping", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ tv: tvId }),
      keepalive: true
    });
  }catch(e){
    console.error("Erro ping:", e);
  }
}

function iniciarHeartbeat(){
  if(preview) return;

  if(heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(ping, 5000);
}

// =========================
// DESCONEXÃO
// =========================
function desligar(){

  if(preview) return;

  if(tvId){
    const params = new URLSearchParams();
    params.append('tv', tvId);
    navigator.sendBeacon("/unregister", params);
  }
}

window.addEventListener("beforeunload", desligar);
window.addEventListener("pagehide", desligar);
window.addEventListener("unload", desligar);
// =========================
// ENSALAMENTO
// =========================

async function carregarEnsalamento() {
  try {
    const res = await fetch("/api/ensalamento");
    const data = await res.json();

    if (data.imagem) {
      document.getElementById("ensalamento").src =
        data.imagem + "?t=" + Date.now(); // evita cache
    }

  } catch (e) {
    console.error("Erro ao carregar ensalamento");
  }
}

// 🔁 atualiza a cada 1 min
setInterval(carregarEnsalamento, 60000);

// primeira carga
carregarEnsalamento();

function montarGrade(data){

  const grid = [];

  data.linhas.forEach((linha, i) => {

    if(!grid[i]) grid[i] = [];

    let col = 0;

    linha.forEach(cell => {

      // encontra próxima coluna livre
      while(grid[i][col]) col++;

      for(let r = 0; r < cell.rowspan; r++){
        for(let c = 0; c < cell.colspan; c++){

          if(!grid[i + r]) grid[i + r] = [];

          grid[i + r][col + c] = cell.texto;

        }
      }

      col++;
    });

  });

  return grid;
}

function renderTabela(data){

  const container = document.getElementById("content");

  const grid = montarGrade(data);

  let html = `<div class="tabela">`;

  // cabeçalho
  html += `<div class="linha">`;
  data.cabecalho.forEach(c => {
    html += `<div class="cell header">${c}</div>`;
  });
  html += `</div>`;

  // linhas
  grid.forEach(row => {

    html += `<div class="linha">`;

    row.forEach(cell => {
      html += `<div class="cell">${cell || ""}</div>`;
    });

    html += `</div>`;
  });

  html += `</div>`;

  container.innerHTML = html;
}
// =========================
// PLAYLIST IFRAME
// =========================

async function mostrarConteudo(type, refreshAtual){

  if(carregandoConteudo) return;
  carregandoConteudo = true;

  let frame = document.getElementById("frame");
  let content = document.getElementById("content");


  let res =
    await fetch(`/playlist?tv=${tvId}&type=${type}`);

  let items = await res.json();

  // pega apenas o primeiro item
  let item = items[0];
  let conteudoAtual = JSON.stringify(items);

  if(!item){

    frame.style.display = "none";

    content.style.display = "flex";

    content.innerHTML = `
      <div class="aviso">
        Nenhum conteúdo cadastrado
      </div>
    `;
    carregandoConteudo = false;
    return;
  }

  if(
    ultimoConteudo === conteudoAtual &&
    ultimoRefresh === refreshAtual
  ){
      carregandoConteudo = false;
      return;
  }
  
  ultimoConteudo = conteudoAtual;
  ultimoRefresh = refreshAtual;

  // =========================
  // VÍDEOS
  // =========================
  if(type === "videos"){

    frame.style.display = "block";

    content.style.display = "none";

    frame.src = item.iframe;

    carregandoConteudo = false;
    return;
  }

  // =========================
  // AVISOS
  // =========================
  if(type === "avisos"){

    frame.style.display = "none";

    content.style.display = "block";

    content.innerHTML = `
      <div class="aviso">
        <fieldset class="field-texto">
        <legend> <img src="/layouts/imagem-alerta.png" class="warning-image" > </legend>
          ${item.texto}
        </fieldset>
      </div>
    `;
    carregandoConteudo = false;
    return;
  }

  // =========================
  // MAPA
  // =========================
  if(type === "mapa"){

    frame.style.display = "none";

    content.style.display = "block";

    content.innerHTML = `
      <img
        src="${item.src}"
        class="imagemViewer"
      >
    `;
    carregandoConteudo = false;
    return;
  }

// =========================
// CALENDÁRIO
// =========================
if(type === "calendario"){

    frame.style.display = "none";

    content.style.display = "block";

    content.innerHTML = `
        <iframe
            src="${item.src}"
            style="
                width:80vw;
                height:100vh;
                margin-left: 10vw;
            ">
        </iframe>
    `;
    carregandoConteudo = false;
    return;
}
// =========================
// ENSALAMENTO
// =========================
if(type === "ensalamento"){

  frame.style.display = "none";
  content.style.display = "block";

  const res = await fetch("/api/ensalamento");
  const html = await res.text();

  content.innerHTML = html;

  carregandoConteudo = false;
  return;
}
}

// =========================
// 🔄 LOOP PRINCIPAL
// =========================
async function carregar(){

  try{

    let res = await fetch("/state");
    let state = await res.json();

    if(!tvId || !state[tvId]){

      if(!preview){

        console.log("Re-registrando TV...");

        localStorage.removeItem("tvId");

        await registrar();
      }

      return;
    }

    let config = state[tvId];

    let pagina =
      typeof config === "string"
        ? config
        : config.pagina;

    let frame =
      document.getElementById("frame");

    let content =
      document.getElementById("content");


    if(pagina && pagina.includes("padrao")){

      if(modoAtual !== "padrao"){
        playlistIndex = 0;
        rodarModoPadrao();
      }

      modoAtual = "padrao";
      return;
      }
    // =========================
    // AVISOS
    // =========================
    if(pagina && pagina.includes("avisos")){

      modoAtual = "avisos";

      mostrarConteudo("avisos",config.refresh);
    
      return;
    }

    // =========================
    // VÍDEOS
    // =========================
    if(pagina && pagina.includes("videos",)){

      modoAtual = "videos";

      mostrarConteudo("videos",config.refresh);

      return;
    }

    // =========================
    // MAPA
    // =========================

    if(pagina && pagina.includes("mapa")){

      modoAtual = "mapa";

      mostrarConteudo("mapa",config.refresh);
      
      return;
    }

    // =========================
    // CALENDÁRIO
    // =========================

    if(pagina && pagina.includes("calendario")){

      modoAtual = "calendario";

      mostrarConteudo("calendario",config.refresh);

      return;
    }
    // =========================
    // ENSALAMENTO
    // =========================
    if(pagina && pagina.includes("ensalamento")){

      modoAtual = "ensalamento";

      mostrarConteudo("ensalamento", config.refresh);

      return;
    }

    // =========================
    // MODO PADRÃO
    // =========================
    if(pagina && pagina.includes("padrao")){

      modoAtual = "padrao";

      rodarModoPadrao();

      return;
    }
    // =========================
    // IFRAME NORMAL
    // =========================
    modoAtual = "iframe";

    frame.style.display = "block";
    content.style.display = "none";

    if(ultimaPagina !== pagina){

      frame.src = pagina;

      ultimaPagina = pagina;
    }

  }catch(e){

    console.error("Erro ao carregar:", e);
  }
}

// =========================
// 🚀 INICIALIZAÇÃO
// =========================
async function iniciar(){

  if(!preview){
    await registrar();
    await carregar();
    polling = setInterval(carregar, 2000);
  }else{
    console.log("Modo preview ativo");
    await carregar();
    polling = setInterval(carregar, 5000);
  }
}

iniciar();

