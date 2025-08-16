// Water Grid — app simples para controle de regas por áreas
const LS_KEY = 'wg_state_v1';
const IMG_KEY = 'wg_image_v1';

let state = {
  rows: 5,
  cols: 10,
  defaultCooldownH: 24,
  cells: [], // {id, name, cooldownH, lastReset}
  showOnlyNeeds: false,
  selectedId: null
};

function uid(r,c){ return `r${r}c${c}`; }

function now(){ return Date.now(); }

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      state = JSON.parse(raw);
    }else{
      // inicializa com 5x10=50
      state.cells = [];
      for(let r=0;r<state.rows;r++){
        for(let c=0;c<state.cols;c++){
          state.cells.push({
            id: uid(r,c),
            name: `Área ${r*state.cols + c + 1}`,
            cooldownH: state.defaultCooldownH,
            lastReset: 0
          });
        }
      }
    }
  }catch(e){
    console.error('Erro ao carregar estado', e);
  }
}

function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function setBgFromStorage(){
  const bg = localStorage.getItem(IMG_KEY);
  const img = document.getElementById('bg-image');
  if(bg){
    img.src = bg;
  }else{
    img.src = 'assets/terreno-placeholder.png';
  }
}

function msUntilReady(cell){
  if(!cell.lastReset) return 0; // nunca regado => precisa
  const msCooldown = cell.cooldownH * 3600_000;
  const elapsed = now() - cell.lastReset;
  return Math.max(0, msCooldown - elapsed);
}

function statusOf(cell){
  const remain = msUntilReady(cell);
  const total = cell.cooldownH * 3600_000;
  if(remain === 0) return {key:'need', label:'Precisa de água'};
  const ratio = remain / total;
  if(ratio > 0.66) return {key:'ok', label:'Descansando'};
  if(ratio > 0.33) return {key:'warn', label:'Quase lá'};
  return {key:'need', label:'Atenção'};
}

function fmtTime(ms){
  const sec = Math.floor(ms/1000);
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  const dd = (n)=> String(n).padStart(2,'0');
  return `${dd(h)}:${dd(m)}:${dd(s)}`;
}

function renderGrid(){
  const grid = document.getElementById('grid');
  grid.style.gridTemplateRows = `repeat(${state.rows}, 1fr)`;
  grid.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
  grid.innerHTML = '';
  for(let r=0;r<state.rows;r++){
    for(let c=0;c<state.cols;c++){
      const id = uid(r,c);
      let cell = state.cells.find(x=>x.id===id);
      if(!cell){
        cell = { id, name:`Área ${r*state.cols + c + 1}`, cooldownH: state.defaultCooldownH, lastReset:0 };
        state.cells.push(cell);
      }
      const msRem = msUntilReady(cell);
      const st = statusOf(cell);

      if(state.showOnlyNeeds && st.key !== 'need') continue;

      const btn = document.createElement('button');
      btn.className = `cell ${st.key}`;
      btn.dataset.id = cell.id;
      btn.innerHTML = `
        <span class="label">
          <span class="name">${escapeHtml(cell.name)}</span>
          <span class="count">${msRem>0 ? fmtTime(msRem) : '—:—:—'}</span>
          <span class="status">${st.label}</span>
        </span>
        <span class="progress"><i style="width:${progressPct(cell)}%"></i></span>
      `;
      attachPressHandlers(btn, cell.id);
      grid.appendChild(btn);
    }
  }
  saveState();
}

function progressPct(cell){
  const rem = msUntilReady(cell);
  const total = cell.cooldownH * 3600_000;
  if(total === 0) return 0;
  return Math.round((rem/total)*100);
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));
}

function onShortPress(id){
  const cell = state.cells.find(x=>x.id===id);
  if(!cell) return;
  cell.lastReset = now();
  saveState();
  renderGrid();
}

function onLongPress(id){
  state.selectedId = id;
  openConfigFor(id);
}

function attachPressHandlers(el, id){
  let timer = null;
  let isLong = false;

  const start = () => {
    isLong = false;
    timer = setTimeout(()=>{
      isLong = true;
      onLongPress(id);
    }, 500);
  };
  const end = () => {
    if(timer){ clearTimeout(timer); timer=null; }
  };

  el.addEventListener('touchstart', start, {passive:true});
  el.addEventListener('mousedown', start);
  el.addEventListener('touchend', ()=>{
    if(!isLong) onShortPress(id);
    end();
  });
  el.addEventListener('mouseup', ()=>{
    if(!isLong) onShortPress(id);
    end();
  });
  el.addEventListener('mouseleave', end);
  el.addEventListener('touchcancel', end);
}

function tick(){
  // atualiza contagens a cada segundo
  const grid = document.getElementById('grid');
  const cells = grid.querySelectorAll('.cell');
  cells.forEach(btn=>{
    const id = btn.dataset.id;
    const cell = state.cells.find(x=>x.id===id);
    if(!cell) return;
    const msRem = msUntilReady(cell);
    const st = statusOf(cell);
    btn.classList.remove('ok','warn','need');
    btn.classList.add(st.key);
    btn.querySelector('.count').textContent = msRem>0 ? fmtTime(msRem) : '—:—:—';
    btn.querySelector('.status').textContent = st.label;
    btn.querySelector('.progress i').style.width = progressPct(cell)+'%';
  });
}

function openConfig(){
  const modal = document.getElementById('config-modal');
  const rows = document.getElementById('rows');
  const cols = document.getElementById('cols');
  const defC = document.getElementById('defaultCooldown');
  rows.value = state.rows;
  cols.value = state.cols;
  defC.value = state.defaultCooldownH;
  document.getElementById('cell-name').value = '';
  document.getElementById('cell-cooldown').value = '';
  modal.showModal();
}

function openConfigFor(id){
  const cell = state.cells.find(x=>x.id===id);
  if(!cell){ openConfig(); return; }
  openConfig();
  document.getElementById('cell-name').value = cell.name || '';
  document.getElementById('cell-cooldown').value = cell.cooldownH || state.defaultCooldownH;
}

function applyGrid(){
  const rows = parseInt(document.getElementById('rows').value || '5',10);
  const cols = parseInt(document.getElementById('cols').value || '10',10);
  // Se mudar o grid, tentamos preservar dados existentes quando possível
  const newCells = [];
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const id = uid(r,c);
      const old = state.cells.find(x=>x.id===id);
      newCells.push(old ? old : { id, name:`Área ${r*cols + c + 1}`, cooldownH: state.defaultCooldownH, lastReset: 0 });
    }
  }
  state.rows = rows;
  state.cols = cols;
  state.cells = newCells;
  saveState();
  renderGrid();
}

function applyDefaultCooldown(){
  const def = parseInt(document.getElementById('defaultCooldown').value || '24', 10);
  state.defaultCooldownH = def;
  state.cells.forEach(c=> c.cooldownH = def);
  saveState();
  renderGrid();
}

function saveSelectedCell(){
  const id = state.selectedId;
  if(!id) return;
  const cell = state.cells.find(x=>x.id===id);
  if(!cell) return;
  const nm = document.getElementById('cell-name').value.trim();
  const cd = parseInt(document.getElementById('cell-cooldown').value || cell.cooldownH, 10);
  if(nm) cell.name = nm;
  if(cd>0) cell.cooldownH = cd;
  saveState();
  renderGrid();
}

function resetSelectedCell(){
  const id = state.selectedId;
  if(!id) return;
  const cell = state.cells.find(x=>x.id===id);
  if(!cell) return;
  cell.lastReset = now();
  saveState();
  renderGrid();
}

function exportData(){
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'water-grid-dados.json';
  a.click();
}

function importData(file){
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const obj = JSON.parse(e.target.result);
      if(!obj || !obj.cells) throw new Error('arquivo inválido');
      state = obj;
      saveState();
      renderGrid();
    }catch(err){
      alert('Falha ao importar: '+ err.message);
    }
  };
  reader.readAsText(file);
}

function changeBg(file, persist=true){
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    document.getElementById('bg-image').src = dataUrl;
    if(persist){
      try{ localStorage.setItem(IMG_KEY, dataUrl); }
      catch(err){ alert('Imagem não salva (pode ser grande demais). Mas funcionará até fechar a aba.'); }
    }
  };
  reader.readAsDataURL(file);
}

function resetAll(){
  if(!confirm('Marcar todas as áreas como regadas agora?')) return;
  state.cells.forEach(c => c.lastReset = now());
  saveState();
  renderGrid();
}

function showNeedsOnly(flag){
  state.showOnlyNeeds = flag;
  renderGrid();
}

// instalação do service worker
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
  });
}

function initUI(){
  document.getElementById('btn-config').addEventListener('click', openConfig);
  document.getElementById('btn-apply-grid').addEventListener('click', applyGrid);
  document.getElementById('btn-apply-default').addEventListener('click', applyDefaultCooldown);
  document.getElementById('btn-save-cell').addEventListener('click', saveSelectedCell);
  document.getElementById('btn-reset-cell').addEventListener('click', resetSelectedCell);

  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('file-import').addEventListener('change', (e)=>{
    if(e.target.files && e.target.files[0]) importData(e.target.files[0]);
  });

  document.getElementById('btn-reset-all').addEventListener('click', resetAll);
  document.getElementById('btn-show-needs').addEventListener('click', ()=>showNeedsOnly(true));
  document.getElementById('btn-show-all').addEventListener('click', ()=>showNeedsOnly(false));

  // imagem de fundo
  document.getElementById('bg-upload').addEventListener('change', (e)=>{
    const persist = document.getElementById('persist-image').checked;
    if(e.target.files && e.target.files[0]) changeBg(e.target.files[0], persist);
  });
}

function init(){
  loadState();
  setBgFromStorage();
  renderGrid();
  initUI();
  setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', init);
