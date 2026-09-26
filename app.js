const STORE='mt-risk-sim-v23-1';let DATA,state,undoStack=[],PROFILE_DATA=null;let sb=null;
if(window.supabase&&window.SUPABASE_CONFIG){sb=window.supabase.createClient(window.SUPABASE_CONFIG.url,window.SUPABASE_CONFIG.publishableKey);}
const labels={A:'Terugleggen bij de afzender',B:'Aanvullende informatie opvragen',C:'Opnemen als MT-risico',D:'Escaleren naar bestuur'};
const scoreNames={grip:'Grip op risico\'s',eig:'Eigenaarschap & vertrouwen',uit:'Uitvoerbaarheid',strat:'Strategische slagkracht'};
const riskFields=[['Bereikbaarheid','Risico_Bereikbaarheid'],['Leefbaarheid','Risico_Leefbaarheid'],['Veiligheid','Risico_Veiligheid'],['Imago','Risico_Imago'],['Kosten','Risico_Kosten']];
async function boot(){DATA=await fetch('game-data.json?v=23.1').then(r=>r.json());try{PROFILE_DATA=await fetch('mt-profiles.json?v=23.1').then(r=>r.ok?r.json():null)}catch(e){console.warn('Profieldata kon niet worden geladen',e);PROFILE_DATA=null;}state=load()||fresh();render();await syncAllToSupabase();}
function fresh(){let starts={grip:+DATA.config["Startscore Grip op risico's"]||70,eig:+DATA.config['Startscore Eigenaarschap & vertrouwen']||70,uit:+DATA.config['Startscore Uitvoerbaarheid']||70,strat:+DATA.config['Startscore Strategische slagkracht']||70};return{started:false,finished:false,round:1,mts:[1,2,3,4].map(i=>({id:i,name:`MT ${i}`,scores:{...starts},budget:+DATA.config['Startbudget kEUR']||10000,cap:+DATA.config['Startcapaciteit %']||100,current:'R1.1_START',line:1,step:1,managed:[],history:[],counters:{MICRO:0,ANALYSE:0,ESCAL:0,PREM_ESCAL:0,AFHOUD:0,GOOD_GOV:0},triggered:[],events:[],chosen:false}))};}
function load(){try{return JSON.parse(localStorage.getItem(STORE))}catch(e){return null}}function save(){localStorage.setItem(STORE,JSON.stringify(state))}function clamp(x){return Math.max(0,Math.min(100,x))}function scen(id){return DATA.scenarios.find(x=>x.Scenario_ID===id)}function effect(risk,ch){return DATA.effects.find(x=>x.Risico_ID===risk&&x.Keuze===ch)}function route(risk,ch){return DATA.routes.find(x=>x.Huidig_risico===risk&&x.Keuze===ch)}
function riskProfile(s){if(!s)return'';return `<div class="risk-profile">${riskFields.map(([label,key])=>`<div class="risk-pill risk-${String(s[key]||'').toLowerCase()}"><span>${label}</span><strong>${esc(s[key]||'-')}</strong></div>`).join('')}</div>`}
function riskText(s){if(!s)return JSON.stringify({context:'Deze risicolijn is afgerond.',event:'',risks:{}});return JSON.stringify({context:s.Context||'',event:s.Onzekere_gebeurtenis||'',risks:Object.fromEntries(riskFields.map(([label,key])=>[label,s[key]||'-']))})}

function choiceCounts(mt){let c={A:0,B:0,C:0,D:0};for(const h of (mt.history||[])){if(c[h.choice]!==undefined)c[h.choice]++}return c}
function sameRiskSummary(items){if(!items.length)return true;let f=items[0];return items.every(x=>x.risk===f.risk&&x.title===f.title&&x.sender===f.sender&&JSON.stringify(x.profile)===JSON.stringify(f.profile))}
function compactRiskProfile(s){return `<div class="round-risk-profile">${riskFields.map(([label,key])=>`<div class="risk-pill risk-${String(s?.[key]||'').toLowerCase()}"><span>${label}</span><strong>${esc(s?.[key]||'-')}</strong></div>`).join('')}</div>`}
function renderRoundRiskBar(){
  const el=document.getElementById('roundRiskBar');if(!el)return;
  if(!state.started){el.innerHTML='';el.style.display='none';return}
  el.style.display='block';
  const items=state.mts.map(mt=>{let s=scen(mt.current)||DATA.scenarios.find(x=>x.Risico_ID===`R${mt.line}.${mt.step}`);return{mt:mt.id,s,risk:s?.Risico_ID||'Einde',title:s?.Titel||'Risicolijn afgerond',sender:s?.Afzender||'-',profile:Object.fromEntries(riskFields.map(([l,k])=>[l,s?.[k]||'-']))}});
  let body='';
  if(sameRiskSummary(items)){
    const x=items[0];
    body=`<div class="round-risk-common"><div class="round-risk-title">${esc(x.risk)} · ${esc(x.title)}</div><div class="round-risk-sender"><strong>Afzender</strong>${esc(x.sender)}</div><div class="risk-profile-wrap"><span class="risk-profile-label">Risicoprofiel</span>${compactRiskProfile(x.s)}</div>`;
  }else{
    body=`<div class="round-risk-variants">${items.map(x=>`<div class="round-variant"><h4>MT ${x.mt}</h4><div class="variant-title">${esc(x.risk)} · ${esc(x.title)}</div><div class="variant-sender">Afzender: ${esc(x.sender)}</div>${compactRiskProfile(x.s)}</div>`).join('')}</div>`;
  }
  const chosenCount=state.mts.filter(m=>m.chosen).length;
  el.innerHTML=`<div class="round-risk-head"><strong>Risico deze ronde</strong><div class="round-head-right"><span>Volledige risicobeschrijving staat op de telefoon van ieder MT</span><b class="round-progress ${chosenCount===4?'complete':''}">${chosenCount}/4 MT's hebben gekozen${chosenCount===4?' ✓':''}</b></div></div><div class="round-risk-content">${body}</div>`;
}

function choiceBar(ch,count,total){
  const pct=total>0?Math.round((count/total)*100):0;
  return `<div class="choice-bar-row"><span class="bar-letter">${ch}</span><div class="bar-track"><div class="bar-fill bar-${ch.toLowerCase()}" style="width:${pct}%"></div></div><b>${count}</b></div>`;
}
function conditionsHtml(mt){
  const events=Array.isArray(mt.events)?mt.events.filter(Boolean):[];
  if(!events.length)return `<div class="empty">Nog geen aanvullende condities of gebeurtenissen.</div>`;
  return `<ul>${events.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
}

function endVector(mt){
  const cc=choiceCounts(mt);
  return {grip:mt.scores.grip,eigenaarschap:mt.scores.eig,uitvoerbaarheid:mt.scores.uit,
          strategisch:mt.scores.strat,keuze_A:cc.A,keuze_B:cc.B,keuze_C:cc.C,keuze_D:cc.D};
}
function profileFor(mt){
  if(!PROFILE_DATA)return null;
  const v=endVector(mt), f=PROFILE_DATA.features;
  let best=null,bestD=Infinity;
  for(const p of PROFILE_DATA.profiles){
    let d=0;
    for(const k of f){
      const sd=PROFILE_DATA.std[k]||1;
      d+=Math.pow((v[k]-p.centrum[k])/sd,2);
    }
    if(d<bestD){bestD=d;best=p}
  }
  return best;
}
function renderEndScreen(){
  const e=document.getElementById('endScreen'),g=document.getElementById('endGrid');if(!e||!g)return;
  e.classList.remove('hidden');
  g.innerHTML=state.mts.map(mt=>{
    const p=profileFor(mt),cc=choiceCounts(mt);
    return `<article class="end-card mt-${mt.id}">
      <div class="end-card-head"><h2>${mt.name}</h2><span>${esc(p?.naam||'MT-profiel')}</span></div>
      <div class="end-scores">${[['Grip',mt.scores.grip],['Eigenaarschap',mt.scores.eig],['Uitvoerbaarheid',mt.scores.uit],['Strategisch',mt.scores.strat]].map(x=>`<div><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('')}</div>
      <div class="end-choices"><span>A <b>${cc.A}</b></span><span>B <b>${cc.B}</b></span><span>C <b>${cc.C}</b></span><span>D <b>${cc.D}</b></span></div>
      <p>${esc(p?.beschrijving||'')}</p>
      <div class="end-insight good">${esc(p?.sterk||'')}</div>
      <div class="end-insight attention">${esc(p?.aandachtspunt||'')}</div>
    </article>`;
  }).join('');
}
function render(){
  if(state.finished){document.getElementById('grid').innerHTML='';document.getElementById('roundRiskBar').style.display='none';renderEndScreen();return}
  const end=document.getElementById('endScreen');if(end)end.classList.add('hidden');
  const ss=document.getElementById('startScreen');if(ss)ss.classList.toggle('hidden',!!state.started);
  renderRoundRiskBar();
  let g=document.getElementById('grid');g.innerHTML='';
  state.mts.forEach(mt=>{
    let s=scen(mt.current)||DATA.scenarios.find(x=>x.Risico_ID===`R${mt.line}.${mt.step}`);
    let risk=s?.Risico_ID||'Einde';
    let last=mt.history.length?mt.history[mt.history.length-1]:null;
    let chosen=mt.chosen&&last?.risk===risk?last.choice:null;
    let counts=choiceCounts(mt);
    let card=document.createElement('section');card.className='mt-card mt-'+String(mt.id);
    card.innerHTML=`<div class="mt-head"><h2>${mt.name}</h2><div class="head-actions"><a class="team-link" href="team.html?mt=${mt.id}" target="_blank">QR / telefoon</a><span class="eyebrow">Ronde ${state.round}</span></div></div>
    <div class="mt-top">
      <div class="scores"><h4>Vier scorepijlers</h4><div class="score-grid">${scoreWithDelta('grip',mt.scores.grip,mt)}${scoreWithDelta('eig',mt.scores.eig,mt)}${scoreWithDelta('uit',mt.scores.uit,mt)}${scoreWithDelta('strat',mt.scores.strat,mt)}</div></div>
      <div class="choice-history"><h4>Keuzes deze sessie</h4><div class="choice-bars">${['A','B','C','D'].map(ch=>choiceBar(ch,counts[ch],mt.history.length)).join('')}</div></div>
    </div>
    <div class="conditions-panel ${(Array.isArray(mt.events)&&mt.events.filter(Boolean).length)?'has-event':'is-empty'}"><h4>Condities / gebeurtenissen</h4><div class="conditions-content">${conditionsHtml(mt)}</div></div>
    <div class="managed managed-wide ${mt.managed.length?'':'is-empty'}"><h4>Actieve MT-risico's (keuze C)</h4>${mt.managed.length?`<ul class="managed-grid">${mt.managed.map(x=>`<li><strong>${esc(x.id)}</strong> ${esc(x.title)}</li>`).join('')}</ul>`:'<div class="empty">Nog geen risico’s door het MT opgenomen.</div>'}</div>
    <div class="choice"><div class="buttons">${['A','B','C','D'].map(ch=>`<button class="choice-btn ${chosen===ch?'selected':''}" ${mt.chosen?'disabled':''} onclick="preview(${mt.id},'${ch}')"><strong>${ch}</strong><br>${labels[ch]}</button>`).join('')}</div><div class="status">${mt.chosen?`Keuze ${chosen} voor deze ronde verwerkt.`:'Nog geen keuze ingevoerd.'}</div></div>`;
    g.appendChild(card)
  });
  const nextBtn=document.getElementById('nextRound');if(nextBtn){const ready=state.started&&state.mts.every(m=>m.chosen);nextBtn.disabled=!ready;nextBtn.classList.toggle('ready',ready)}
  save();publishPublicState()
}
async function syncMtToSupabase(mt){if(!sb)return;let s=state.started?(scen(mt.current)||DATA.scenarios.find(x=>x.Risico_ID===`R${mt.line}.${mt.step}`)):null;let row={ronde:state.started?state.round:0,scenario_id:state.started?(mt.current||null):null,risico_code:state.started?(s?.Risico_ID||'Einde'):'',risico_titel:state.started?(s?.Titel||'Risicolijn afgerond'):'Wachten op de start van de simulatie',risico_beschrijving:state.started?riskText(s):JSON.stringify({context:'Jullie zijn verbonden. De eerste risicokaart verschijnt zodra de docent de simulatie start.',event:'',risks:{}}),afzender:state.started?(s?.Afzender||'-'):'-',risico_eigenaar:JSON.stringify(state.started?(mt.events||[]):[]),score_grip:mt.scores.grip,score_eigenaarschap:mt.scores.eig,score_uitvoerbaarheid:mt.scores.uit,score_strategisch:mt.scores.strat,actieve_mt_risicos:state.started?mt.managed:[],updated_at:new Date().toISOString()};let {error}=await sb.from('mt_state').update(row).eq('mt_id',mt.id);if(error)console.error('Supabase sync MT '+mt.id,error);}
async function syncAllToSupabase(){if(!sb)return;await Promise.all(state.mts.map(syncMtToSupabase));}
function publishPublicState(){syncAllToSupabase();}
function score(k,v){let band=v>=80?'Goed':v>=60?'Redelijk':v>=40?'Onder druk':'Kritiek';return `<div class="score-chip"><div class="score-top"><span>${scoreNames[k]}</span><strong>${v}</strong></div><div class="track"><div class="fill" style="width:${v}%"></div></div><small>${band}</small></div>`}
window.preview=function(id,ch){let mt=state.mts.find(x=>x.id===id);if(mt.chosen)return;let s=scen(mt.current),e=effect(s.Risico_ID,ch);if(!e)return alert('Geen besluiteffect gevonden.');let box=document.getElementById('modalBox');box.innerHTML=`<div class="eyebrow">${mt.name} · ${s.Risico_ID} · keuze ${ch}</div><h2>${labels[ch]}</h2><p>${esc(e.Gevolgbeschrijving||'')}</p><div class="effect-grid">${delta('Grip',e.Delta_grip)}${delta('Eigenaarschap',e.Delta_eigenaarschap_vertrouwen)}${delta('Uitvoerbaarheid',e.Delta_uitvoerbaarheid)}${delta('Strategische slagkracht',e.Delta_strategische_slagkracht)}</div><p><strong>Budget:</strong> ${signed(e.Budget_mutatie_kEUR)} k€ &nbsp; <strong>Capaciteit:</strong> ${signed(e.Capaciteit_mutatie_pct)}%</p><div class="modal-actions"><button class="secondary" onclick="closeModal()">Annuleren</button><button class="primary" onclick="commit(${id},'${ch}')">Besluit verwerken</button></div>`;document.getElementById('modal').classList.add('show')}
function delta(n,v){v=+v||0;return `<div class="pill">${n}<strong>${signed(v)}</strong></div>`}function signed(v){v=+v||0;return v>0?`+${v}`:`${v}`}
window.closeModal=()=>document.getElementById('modal').classList.remove('show');
window.commit=function(id,ch){undoStack.push(JSON.stringify(state));let mt=state.mts.find(x=>x.id===id),s=scen(mt.current),e=effect(s.Risico_ID,ch);mt.scores.grip=clamp(mt.scores.grip+(+e.Delta_grip||0));mt.scores.eig=clamp(mt.scores.eig+(+e.Delta_eigenaarschap_vertrouwen||0));mt.scores.uit=clamp(mt.scores.uit+(+e.Delta_uitvoerbaarheid||0));mt.scores.strat=clamp(mt.scores.strat+(+e.Delta_strategische_slagkracht||0));mt.budget+=(+e.Budget_mutatie_kEUR||0);mt.cap+=(+e.Capaciteit_mutatie_pct||0);if(ch==='C'&&!mt.managed.some(x=>x.id===s.Risico_ID))mt.managed.push({id:s.Risico_ID,title:s.Titel});applyFlag(mt,e.Gedragsflag,ch);mt.history.push({scenario:mt.current,risk:s.Risico_ID,choice:ch,effect:e.Gevolgbeschrijving});mt.next=route(s.Risico_ID,ch)?.Volgend_scenario_ID||null;mt.chosen=true;checkConditions(mt);closeModal();render()}
function applyFlag(mt,flag,ch){if(ch==='B')mt.counters.ANALYSE++;if(ch==='D')mt.counters.ESCAL++;if(flag==='MICROMANAGEMENT')mt.counters.MICRO++;if(['ONNODIGE_ESCALATIE','PREMATURE_ESCALATIE'].includes(flag))mt.counters.PREM_ESCAL++;if(flag==='ANALYSEVERLAMMING')mt.counters.ANALYSE++;}
function checkConditions(mt){for(const c of DATA.conditions){if(!c.Eenmalig||!mt.triggered.includes(c.Conditie_ID)){let m=String(c.Voorwaarde||'').match(/([A-Z_]+)\s*(>=|<)/);if(!m)continue;let key=m[1],op=m[2],v=counterVal(mt,key),d=+c.Drempel||0,hit=op==='>='?v>=d:v<d;if(hit&&c.Eenmalig){mt.triggered.push(c.Conditie_ID);mt.scores.grip=clamp(mt.scores.grip+(+c.Delta_grip||0));mt.scores.eig=clamp(mt.scores.eig+(+c.Delta_eigenaarschap||0));mt.scores.uit=clamp(mt.scores.uit+(+c.Delta_uitvoerbaarheid||0));mt.scores.strat=clamp(mt.scores.strat+(+c.Delta_strategische_slagkracht||0));mt.events.push(c['Aanvullende tekst / gebeurtenis'])}}}}
function counterVal(mt,k){return({MICRO:mt.counters.MICRO,ANALYSE:mt.counters.ANALYSE,PREM_ESCAL:mt.counters.PREM_ESCAL,ESCAL:mt.counters.ESCAL,AFHOUD:mt.counters.AFHOUD,GOOD_GOV:mt.counters.GOOD_GOV,ORG_GRIP:mt.scores.grip,ORG_EIG:mt.scores.eig,ORG_UIT:mt.scores.uit,ORG_STRAT:mt.scores.strat,INFO:mt.counters.ANALYSE})[k]??0}
document.getElementById('fullscreen').onclick=async()=>{try{if(!document.fullscreenElement){await document.documentElement.requestFullscreen()}else{await document.exitFullscreen()}}catch(e){console.warn('Fullscreen niet beschikbaar',e)}};
document.addEventListener('fullscreenchange',()=>{const b=document.getElementById('fullscreen');if(b)b.textContent=document.fullscreenElement?'⛶ Volledig scherm verlaten':'⛶ Volledig scherm'});
document.getElementById('nextRound').onclick=()=>{if(!state.mts.every(x=>x.chosen))return alert('Nog niet alle vier MT’s hebben een keuze gemaakt.');undoStack.push(JSON.stringify(state));if(state.round>=16){state.finished=true;render();return}for(const mt of state.mts){if(mt.next){mt.current=mt.next;let s=scen(mt.current);mt.line=+(s?.Risico_ID?.split('.')[0].slice(1)||mt.line);mt.step=+(s?.Risico_ID?.split('.')[1]||mt.step)}else{if(mt.line<4){mt.line++;mt.step=1;mt.current=`R${mt.line}.1_START`}else mt.current=null}mt.chosen=false;mt.next=null}state.round++;render()};
document.getElementById('startSimulation').onclick=()=>{if(state.started)return;undoStack.push(JSON.stringify(state));state.started=true;render();};
document.getElementById('undo').onclick=()=>{if(!undoStack.length)return alert('Geen actie om ongedaan te maken.');state=JSON.parse(undoStack.pop());render()};document.getElementById('reset').onclick=()=>{if(confirm('Hele spelstatus wissen en opnieuw starten?')){localStorage.removeItem(STORE);state=fresh();undoStack=[];render()}};
function esc(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}boot();
