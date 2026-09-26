const STORE='mt-risk-sim-v25-0';let DATA,state,undoStack=[],PROFILE_DATA=null;let sb=null;
if(window.supabase&&window.SUPABASE_CONFIG){sb=window.supabase.createClient(window.SUPABASE_CONFIG.url,window.SUPABASE_CONFIG.publishableKey);}
const labels={A:'Terugleggen bij de afzender',B:'Aanvullende informatie opvragen',C:'Opnemen als MT-risico',D:'Escaleren naar bestuur'};
const scoreNames={grip:'Grip op risico\'s',eig:'Eigenaarschap & vertrouwen',uit:'Uitvoerbaarheid',strat:'Strategische slagkracht'};
const riskFields=[['Bereikbaarheid','Risico_Bereikbaarheid'],['Leefbaarheid','Risico_Leefbaarheid'],['Veiligheid','Risico_Veiligheid'],['Imago','Risico_Imago'],['Kosten','Risico_Kosten']];
async function boot(){DATA=await fetch('game-data.json?v=25.0').then(r=>r.json());try{PROFILE_DATA=await fetch('mt-profiles.json?v=25.0').then(r=>r.ok?r.json():null)}catch(e){console.warn('Profieldata kon niet worden geladen',e);PROFILE_DATA=null;}state=load()||fresh();
if(typeof state.finished!=='boolean')state.finished=false;
if(!Array.isArray(state.mts)||state.mts.length!==4)state=fresh();
for(const mt of state.mts){
  if(!Array.isArray(mt.history))mt.history=[];
  if(!Array.isArray(mt.managed))mt.managed=[];
  if(!Array.isArray(mt.events))mt.events=[];
  if(!mt.scores)mt.scores={grip:60,eig:60,uit:60,strat:60};
}
render();await syncAllToSupabase();}
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
function governanceChoiceQuality(riskId,choice){
  const opts=['A','B','C','D'].map(ch=>{
    const e=DATA.effects.find(x=>x.Risico_ID===riskId&&x.Keuze===ch);
    if(!e)return {ch,utility:-999};
    const ds=[
      Number(e.Delta_grip||0),
      Number(e.Delta_eigenaarschap_vertrouwen||0),
      Number(e.Delta_uitvoerbaarheid||0),
      Number(e.Delta_strategische_slagkracht||0)
    ];
    const mean=ds.reduce((a,b)=>a+b,0)/4;
    const variance=ds.reduce((a,b)=>a+Math.pow(b-mean,2),0)/4;
    return {ch,utility:mean-(0.10*Math.sqrt(variance))};
  });
  const best=Math.max(...opts.map(x=>x.utility));
  const mine=(opts.find(x=>x.ch===choice)||{utility:-999}).utility;
  return {best,mine,gap:best-mine,optimal:(best-mine)<=0.01,acceptable:(best-mine)<=1.25};
}
function governancePattern(mt){
  const hist=Array.isArray(mt.history)?mt.history:[];
  const g={total:0,preferred:0,micro:0,analyse:0,afhoudend:0,prematuur:0,afwijkingen:[]};
  for(const h of hist){
    const rid=h.riskId||h.risicoId||h.risk||h.risico;
    const ch=(h.choice||h.keuze||h.chosen||'').toString().toUpperCase();
    if(!rid||!'ABCD'.includes(ch))continue;

    const choices=['A','B','C','D'].map(c=>({ch:c,q:governanceChoiceQuality(rid,c)}));
    const best=Math.max(...choices.map(x=>x.q.mine));
    const pref=(choices.find(x=>Math.abs(x.q.mine-best)<=0.01)||{}).ch||ch;

    g.total++;
    if(ch===pref){ g.preferred++; continue; }

    const q=governanceChoiceQuality(rid,ch);
    g.afwijkingen.push({riskId:rid,chosen:ch,preferred:pref,gap:q.gap});
    if(ch==='A')g.afhoudend++;
    if(ch==='B')g.analyse++;
    if(ch==='C')g.micro++;
    if(ch==='D')g.prematuur++;
  }
  g.deviations=g.total-g.preferred;
  g.fit=g.total?g.preferred/g.total:0;
  return g;
}
function performanceLevelByPreferred(g){
  const n=Math.max(1,g.total||0),ratio=g.preferred/n;
  if(ratio>=15/16)return 'Zeer sterk';
  if(ratio>=13/16)return 'Sterk';
  if(ratio>=11/16)return 'Prima';
  if(ratio>=9/16)return 'In ontwikkeling';
  return 'Voor verbetering vatbaar';
}
function governanceStyleFromDeviations(g){
  if(g.deviations===0)return 'Passend sturend';
  const ranked=[
    ['Controlerend sturend',g.micro],
    ['Onderzoekend sturend',g.analyse],
    ['Ruimtegevend sturend',g.afhoudend],
    ['Bestuurlijk schakelend',g.prematuur]
  ].sort((a,b)=>b[1]-a[1]);
  if(ranked[0][1]===0)return 'Evenwichtig sturend';
  if(ranked[0][1]===ranked[1][1])return 'Gemengd sturingsprofiel';
  // Herhaling telt: pas vanaf minimaal twee dezelfde afwijkingen spreken we van een reflex.
  if(ranked[0][1]===1)return 'Incidentele afwijking';
  return ranked[0][0];
}
function profileFor(mt){
  const v=endVector(mt);
  const g=governancePattern(mt);
  const niveau=performanceLevelByPreferred(g);
  const stijl=governanceStyleFromDeviations(g);
  const n=g.total||16;
  const avg=Math.round((v.grip+v.eigenaarschap+v.uitvoerbaarheid+v.strategisch)/4*10)/10;

  if(g.total>0 && (g.preferred/g.total)>=15/16){
    return {
      naam:`${niveau} · Passend sturend`,
      preferredText:`${g.preferred} van ${n} passende governancekeuzes`,
      averageText:`Gemiddelde effectscore ${avg}`,
      beschrijving:`Jullie kozen bij ${g.preferred} van de ${n} risico's voor de voorkeurskeuze. Daarmee is de governance over vrijwel de hele simulatie passend. De vier scorepijlers laten het effect daarvan op de organisatie zien.`,
      sterk:'Sterk: jullie bepalen per risico welk organisatieniveau daadwerkelijk kan sturen en laten je niet leiden door een vaste voorkeur voor A, B, C of D.',
      aandachtspunt:'Reflectievraag: welke afweging hielp jullie het meest om te bepalen waar een risico thuishoort?',
      perfect:true
    };
  }

  const reflex={
    'Controlerend sturend':`Bij ${g.micro} afwijkende keuzes is een risico naar het MT getrokken terwijl een andere interventie passender was. Omdat deze reflex zich herhaalt, is dit bepalend voor het profiel.`,
    'Onderzoekend sturend':`Bij ${g.analyse} afwijkende keuzes is aanvullende informatie gevraagd terwijl een andere interventie passender was. Omdat deze reflex zich herhaalt, is dit bepalend voor het profiel.`,
    'Ruimtegevend sturend':`Bij ${g.afhoudend} afwijkende keuzes is het risico teruggelegd terwijl meer sturing of opschaling passender was. Omdat deze reflex zich herhaalt, is dit bepalend voor het profiel.`,
    'Bestuurlijk schakelend':`Bij ${g.prematuur} afwijkende keuzes is bestuurlijk geëscaleerd terwijl een andere interventie passender was. Omdat deze reflex zich herhaalt, is dit bepalend voor het profiel.`,
    'Gemengd sturingsprofiel':`De ${g.deviations} afwijkende keuzes laten meerdere typen reflexen zien. Er is geen duidelijke dominante afwijking.`,
    'Incidentele afwijking':`Er zijn ${g.deviations} afwijkende keuzes, maar geen type afwijking komt vaak genoeg terug om van een vaste reflex te spreken.`,
    'Evenwichtig sturend':`De afwijkende keuzes laten geen duidelijke vaste sturingsreflex zien.`
  }[stijl];

  const strong={
    'Controlerend sturend':'Sterk: jullie herkennen regelmatig wanneer centrale MT-sturing nodig is.',
    'Onderzoekend sturend':'Sterk: jullie zijn alert op onzekerheid en de kwaliteit van besluitinformatie.',
    'Ruimtegevend sturend':'Sterk: jullie proberen verantwoordelijkheid zoveel mogelijk te laten waar het risico beheerst kan worden.',
    'Bestuurlijk schakelend':'Sterk: jullie zijn alert op vraagstukken die het mandaat van het MT kunnen overstijgen.',
    'Gemengd sturingsprofiel':'Sterk: jullie bekijken risico’s vanuit verschillende governanceperspectieven.',
    'Incidentele afwijking':'Sterk: er is geen duidelijke eenzijdige governance-reflex zichtbaar.',
    'Evenwichtig sturend':'Sterk: er is geen duidelijke eenzijdige governance-reflex zichtbaar.'
  }[stijl];

  const attention={
    'Controlerend sturend':'Aandachtspunt: toets eerst of de afzender voldoende mandaat en middelen heeft voordat een risico door het MT wordt overgenomen.',
    'Onderzoekend sturend':'Aandachtspunt: vraag alleen aanvullende informatie op wanneer die informatie de uiteindelijke keuze daadwerkelijk kan veranderen.',
    'Ruimtegevend sturend':'Aandachtspunt: leg niet terug wanneer samenhang, middelen of mandaat maken dat de afzender het risico feitelijk niet zelf kan beheersen.',
    'Bestuurlijk schakelend':'Aandachtspunt: onderscheid een groot risico van een vraagstuk waarvoor daadwerkelijk een bestuurlijk besluit nodig is.',
    'Gemengd sturingsprofiel':'Aandachtspunt: maak per risico explicieter welke interventie nodig is en welk organisatieniveau daarvoor het juiste mandaat heeft.',
    'Incidentele afwijking':'Aandachtspunt: bespreek vooral de afzonderlijke afwijkingen. Eén afwijking is nog geen patroon.',
    'Evenwichtig sturend':'Aandachtspunt: bespreek vooral de afzonderlijke afwijkingen; daar zit meer leerwaarde dan in één dominante reflex.'
  }[stijl];

  return {
    naam:`${niveau} · ${stijl}`,
    preferredText:`${g.preferred} van ${n} passende governancekeuzes`,
    averageText:`Gemiddelde effectscore ${avg}`,
    beschrijving:`De primaire beoordeling is gebaseerd op de passende governancekeuzes. ${reflex} De vier scorepijlers tonen vervolgens wat dit gedrag gedurende het spel met de organisatie doet.`,
    sterk:strong,
    aandachtspunt:attention
  };
}

function finishSummary(){
  const totals=state.mts.map(mt=>governancePattern(mt).total||0);
  const played=totals.length?Math.min(...totals):0;
  return {played,early:played<16,provisional:played<8};
}
function presentationProfile(mt){
  const p=profileFor(mt),g=governancePattern(mt),ctx=finishSummary();
  if(!ctx.provisional)return p;
  return {
    ...p,
    naam:`Indicatief · ${p?.naam||'MT-profiel'}`,
    beschrijving:`Dit resultaat is gebaseerd op ${g.total} gespeelde risico's. De scores en keuzeverdeling zijn bruikbaar voor reflectie, maar er zijn nog te weinig situaties gespeeld om het governanceprofiel als volwaardig patroon te duiden.`,
    aandachtspunt:'Reflectievraag: bespreek vooral de afzonderlijke afwijkende keuzes. Trek op basis van dit beperkte aantal rondes nog geen harde conclusie over een vaste MT-reflex.'
  };
}
function renderEndScreen(){
  const e=document.getElementById('endScreen'),g=document.getElementById('endGrid');if(!e||!g)return;
  e.classList.remove('hidden');
  const ctx=finishSummary();
  let status=document.getElementById('earlyFinishStatus');
  if(!status){status=document.createElement('div');status.id='earlyFinishStatus';status.className='early-finish-status';e.querySelector('.end-title')?.appendChild(status);}
  if(status){
    status.textContent=ctx.provisional?`Indicatief resultaat · ${ctx.played} van 16 risico's gespeeld`:(ctx.early?`Vervroegd afgerond · ${ctx.played} van 16 risico's gespeeld`:'');
    status.classList.toggle('hidden',!ctx.early);
  }
  g.innerHTML=state.mts.map(mt=>{
    const p=presentationProfile(mt),cc=choiceCounts(mt);
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

function publicEndResult(mt){
  const p=presentationProfile(mt);
  const ctx=finishSummary();
  const g=governancePattern(mt);
  const cc=choiceCounts(mt);
  return {
    finished:true,
    played:g.total,
    early:g.total<16,
    provisional:g.total<8,
    mt_id:mt.id,
    mt_name:mt.name,
    profile:p?.naam||'',
    preferredText:p?.preferredText||'',
    averageText:p?.averageText||'',
    description:p?.beschrijving||'',
    strong:p?.sterk||'',
    attention:p?.aandachtspunt||'',
    reflection:!!p?.perfect,
    scores:{grip:mt.scores.grip,eig:mt.scores.eig,uit:mt.scores.uit,strat:mt.scores.strat},
    choices:cc
  };
}
async function syncMtToSupabase(mt){
  if(!sb)return;
  let s=state.started?(scen(mt.current)||DATA.scenarios.find(x=>x.Risico_ID===`R${mt.line}.${mt.step}`)):null;
  const endResult=state.finished?publicEndResult(mt):null;
  let row={
    ronde:state.started?state.round:0,
    scenario_id:state.finished?'END':(state.started?(mt.current||null):null),
    risico_code:state.finished?'EINDRESULTAAT':(state.started?(s?.Risico_ID||'Einde'):''),
    risico_titel:state.finished?`Eindresultaat ${mt.name}`:(state.started?(s?.Titel||'Risicolijn afgerond'):'Wachten op de start van de simulatie'),
    risico_beschrijving:state.finished?JSON.stringify({endResult}):(state.started?riskText(s):JSON.stringify({context:'Jullie zijn verbonden. De eerste risicokaart verschijnt zodra de docent de simulatie start.',event:'',risks:{}})),
    afzender:state.finished?'':(state.started?(s?.Afzender||'-'):'-'),
    risico_eigenaar:JSON.stringify(state.started?(mt.events||[]):[]),
    score_grip:mt.scores.grip,
    score_eigenaarschap:mt.scores.eig,
    score_uitvoerbaarheid:mt.scores.uit,
    score_strategisch:mt.scores.strat,
    actieve_mt_risicos:state.started?mt.managed:[],
    updated_at:new Date().toISOString()
  };
  let {error}=await sb.from('mt_state').update(row).eq('mt_id',mt.id);
  if(error)console.error('Supabase sync MT '+mt.id,error);
}
async function syncAllToSupabase(){if(!sb)return;await Promise.all(state.mts.map(syncMtToSupabase));}
function publishPublicState(){syncAllToSupabase();}

function lastScoreDelta(mt,key){
  const hist=Array.isArray(mt.history)?mt.history:[];
  if(!hist.length)return null;
  const h=hist[hist.length-1];
  const aliases={
    grip:['grip','score_grip'],
    eig:['eig','score_eig','eigenaarschap'],
    uit:['uit','score_uit','uitvoerbaarheid'],
    strat:['strat','score_strat','strategisch']
  };
  for(const k of (aliases[key]||[key])){
    if(h.delta && Number.isFinite(Number(h.delta[k]))) return Number(h.delta[k]);
    if(h.before && h.after && Number.isFinite(Number(h.before[k])) && Number.isFinite(Number(h.after[k])))
      return Number(h.after[k])-Number(h.before[k]);
  }
  return null;
}
function scoreWithDelta(key,val,mt){
  const d=lastScoreDelta(mt,key);
  const delta=(d===null||d===0)?'':`<span class="score-delta ${d>0?'up':'down'}">${d>0?'+':''}${d}</span>`;
  return score(key,val).replace('</div><div class="track">',`${delta}</div><div class="track">`);
}
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

function openFinishModal(){
  if(!state.started)return alert('Start eerst de simulatie.');
  const ctx=finishSummary();
  const modal=document.getElementById('finishModal');
  document.getElementById('finishModalText').textContent=`Je hebt ${ctx.played} van de 16 risico's gespeeld. Wil je de simulatie nu afronden en de eindresultaten berekenen?`;
  document.getElementById('finishModalNote').textContent=ctx.provisional
    ? `Omdat minder dan 8 risico's zijn gespeeld, worden de scores en keuzeverdeling wel getoond, maar het governanceprofiel wordt als indicatief weergegeven.`
    : `Het niveau wordt berekend op basis van het percentage passende governancekeuzes binnen de gespeelde risico's.`;
  modal?.classList.remove('hidden');
}
function closeFinishModal(){document.getElementById('finishModal')?.classList.add('hidden')}
async function finishSessionEarly(){
  undoStack.push(JSON.stringify(state));
  state.finished=true;
  state.finishedEarly=true;
  closeFinishModal();
  render();
  await syncAllToSupabase();
}
document.getElementById('finishSession').onclick=openFinishModal;
document.getElementById('cancelFinish').onclick=closeFinishModal;
document.getElementById('confirmFinish').onclick=finishSessionEarly;
document.getElementById('nextRound').onclick=()=>{if(!state.mts.every(x=>x.chosen))return alert('Nog niet alle vier MT’s hebben een keuze gemaakt.');undoStack.push(JSON.stringify(state));if(state.round>=16){state.finished=true;state.finishedEarly=false;render();publishPublicState();return}for(const mt of state.mts){if(mt.next){mt.current=mt.next;let s=scen(mt.current);mt.line=+(s?.Risico_ID?.split('.')[0].slice(1)||mt.line);mt.step=+(s?.Risico_ID?.split('.')[1]||mt.step)}else{if(mt.line<4){mt.line++;mt.step=1;mt.current=`R${mt.line}.1_START`}else mt.current=null}mt.chosen=false;mt.next=null}state.round++;render()};
document.getElementById('startSimulation').onclick=()=>{if(state.started)return;undoStack.push(JSON.stringify(state));state.started=true;render();};
document.getElementById('undo').onclick=()=>{if(!undoStack.length)return alert('Geen actie om ongedaan te maken.');state=JSON.parse(undoStack.pop());render()};document.getElementById('reset').onclick=()=>{if(confirm('Hele spelstatus wissen en opnieuw starten?')){localStorage.removeItem(STORE);state=fresh();undoStack=[];render()}};
function esc(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}boot();
