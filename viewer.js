// =========================
// CONFIG INICIAL
// =========================
let playlistRodando = false;
let params = new URLSearchParams(window.location.search);
let preview = params.get("preview") === "true";

let tvId = preview
  ? params.get("tv")
  : localStorage.getItem("tvId");

let ultimaPagina = null;
let intervaloAtual = 2000;
let modoAtual = "iframe";

let ultimoConteudo = "";
let carregandoConteudo = false;
let ultimoRefresh = null;

let heartbeatInterval = null;
let polling = null;

let playlistIndex = 0;
let playlistCache = [];
let playlistTimer = null;

// elementos DOM (centralizado)
const frame = document.getElementById("frame");
const content = document.getElementById("content");

// =========================
// UTILIDADES
// =========================
function getTempo(tipo, item){
  if(tipo === "videos") return item.duracao * 1000 || 60000;
  if(tipo === "mapa") return 10000;
  if(tipo === "avisos") return 5000;
  return 5000;
}

// =========================
// RENDERIZAÇÃO
// =========================
function render(tipo, item){

  if(tipo === "videos"){
    frame.style.display = "block";
    content.style.display = "none";
    frame.src = item.iframe;
    return;
  }

  frame.style.display = "none";
  content.style.display = "block";

  if(tipo === "avisos"){
    content.innerHTML = `
      <div class="aviso">
        <fieldset class="field-texto">
          <legend>
            <img src="/layouts/logo-ifsc.png" class="warning-image">
          </legend>
          ${item.texto}
        </fieldset>
      </div>
    `;
    return;
  }

  if(tipo === "mapa"){
    content.innerHTML = `
      <img src="${item.src}" class="imagemViewer">
    `;
    return;
  }

  if(tipo === "calendario"){
    content.innerHTML = `
      <iframe src="${item.src}"
        style="width:80vw;height:100vh;margin-left:10vw;">
      </iframe>
    `;
    return;
  }
}

// =========================
// PLAYLIST
// =========================
async function rodarPlaylist(tipo){

  if(carregandoConteudo) return;

  let res = await fetch(`/playlist?tv=${tvId}&type=${tipo}`);
  let items = await res.json();

  if(!items || items.length === 0) return;

  playlistCache = items;

  let item = items[playlistIndex];

  render(tipo, item);

  let tempo = getTempo(tipo, item);

  playlistIndex = (playlistIndex + 1) % items.length;

  if(playlistTimer) clearTimeout(playlistTimer);

  playlistTimer = setTimeout(() => {
    rodarPlaylist(tipo);
  }, tempo);
}

async function rodarModoPadrao(){

  let res = await fetch(`/playlist?tv=${tvId}&type=padrao`);
  let items = await res.json();

  if(!items || items.length === 0) return;

  let item = items[playlistIndex];

  render(item.tipo, item);

  let tempo = getTempo(item.tipo, item);

  playlistIndex = (playlistIndex + 1) % items.length;

  if(playlistTimer) clearTimeout(playlistTimer);

  playlistTimer = setTimeout(() => {
    rodarModoPadrao();
  }, tempo);
}

// =========================
// REGISTER AND HEARTBEAT
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
// UNREGISTER
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
    const html = await res.text();

    content.innerHTML = html;

  } catch (e) {
    console.error("Erro ao carregar ensalamento");
  }
}

setInterval(carregarEnsalamento, 60000);

// =========================
// CONTEÚDO DIRETO
// =========================
async function mostrarConteudo(type, refreshAtual){

  if(carregandoConteudo) return;
  carregandoConteudo = true;

  let res = await fetch(`/playlist?tv=${tvId}&type=${type}`);
  let items = await res.json();

  let item = items[0];
  let conteudoAtual = JSON.stringify(items);

  if(!item){
    frame.style.display = "none";
    content.style.display = "flex";
    content.innerHTML = `<div class="aviso">Nenhum conteúdo cadastrado</div>`;
    carregandoConteudo = false;
    return;
  }

  if(ultimoConteudo === conteudoAtual && ultimoRefresh === refreshAtual){
    carregandoConteudo = false;
    return;
  }

  ultimoConteudo = conteudoAtual;
  ultimoRefresh = refreshAtual;

  if(type === "ensalamento"){
    await carregarEnsalamento();
    carregandoConteudo = false;
    return;
  }

  render(type, item);

  carregandoConteudo = false;
}

// =========================
// LOOP PRINCIPAL
// =========================
async function carregar(){

  try{
    let res = await fetch("/state");
    let state = await res.json();

    if(!tvId || !state[tvId]){
      if(!preview){
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

    if(pagina && pagina.includes("padrao")){
      if(modoAtual !== "padrao"){
        playlistIndex = 0;
        rodarModoPadrao();
      }
      modoAtual = "padrao";
      return;
    }

    if(pagina && pagina.includes("avisos")){
      modoAtual = "avisos";
      mostrarConteudo("avisos",config.refresh);
      return;
    }

    if(pagina && pagina.includes("videos")){
      modoAtual = "videos";
      mostrarConteudo("videos",config.refresh);
      return;
    }

    if(pagina && pagina.includes("mapa")){
      modoAtual = "mapa";
      mostrarConteudo("mapa",config.refresh);
      return;
    }

    if(pagina && pagina.includes("calendario")){
      modoAtual = "calendario";
      mostrarConteudo("calendario",config.refresh);
      return;
    }

    if(pagina && pagina.includes("ensalamento")){
      modoAtual = "ensalamento";
      mostrarConteudo("ensalamento", config.refresh);
      return;
    }

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
// INICIALIZAÇÃO
// =========================
async function iniciar(){

  if(!preview){
    await registrar();
    await carregar();
    polling = setInterval(carregar, 2000);
  }else{
    await carregar();
    polling = setInterval(carregar, 5000);
  }
}

iniciar();