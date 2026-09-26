const params=new URLSearchParams(location.search);const id=+(params.get('mt')||1);const cfg=window.SUPABASE_CONFIG;const sb=(window.supabase&&cfg)?window.supabase.createClient(cfg.url,cfg.publishableKey):null;
function esc(x){return String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function parseRisk(raw){try{const x=JSON.parse(raw||'');if(x&&typeof x==='object'&&!Array.isArray(x))return x}catch(e){}const t=String(raw||'');const parts=t.split(/\n\nOnzekere gebeurtenis\n/);return{context:(parts[0]||'').replace(/^Context\n/,''),event:parts[1]||'',risks:{}}}
function parseConditions(raw){try{const x=JSON.parse(raw||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}}
function parseManaged(raw){if(Array.isArray(raw))return raw;try{const x=JSON.parse(raw||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}}
function riskClass(v){return 'risk-'+String(v||'').toLowerCase()}

function teamChoiceCounts(mt){
  const out={A:0,B:0,C:0,D:0};
  const hist=Array.isArray(mt.history)?mt.history:[];
  for(const h of hist){
    const ch=(h.choice||h.keuze||h.chosen||'').toString().toUpperCase();
    if(out[ch]!==undefined)out[ch]++;
  }
  return out;
}
function teamChoiceQuality(riskId,choice){
  const opts=['A','B','C','D'].map(ch=>{
    const e=(DATA.effects||[]).find(x=>x.Risico_ID===riskId&&x.Keuze===ch);
    if(!e)return {ch,utility:-999};
    const ds=[Number(e.Delta_grip||0),Number(e.Delta_eigenaarschap_vertrouwen||0),
              Number(e.Delta_uitvoerbaarheid||0),Number(e.Delta_strategische_slagkracht||0)];
    const mean=ds.reduce((a,b)=>a+b,0)/4;
    const variance=ds.reduce((a,b)=>a+Math.pow(b-mean,2),0)/4;
    return {ch,utility:mean-(0.10*Math.sqrt(variance))};
  });
  const best=Math.max(...opts.map(x=>x.utility));
  const mine=(opts.find(x=>x.ch===choice)||{utility:-999}).utility;
  return {best,mine,gap:best-mine};
}
function teamGovernancePattern(mt){
  const hist=Array.isArray(mt.history)?mt.history:[];
  const g={total:0,preferred:0,micro:0,analyse:0,afhoudend:0,prematuur:0,deviations:0};
  for(const h of hist){
    const rid=h.riskId||h.risicoId||h.risk||h.risico;
    const ch=(h.choice||h.keuze||h.chosen||'').toString().toUpperCase();
    if(!rid||!'ABCD'.includes(ch))continue;
    const choices=['A','B','C','D'].map(c=>({ch:c,q:teamChoiceQuality(rid,c)}));
    const best=Math.max(...choices.map(x=>x.q.mine));
    const pref=(choices.find(x=>Math.abs(x.q.mine-best)<=0.01)||{}).ch||ch;
    g.total++;
    if(ch===pref){g.preferred++;continue}
    if(ch==='A')g.afhoudend++;
    if(ch==='B')g.analyse++;
    if(ch==='C')g.micro++;
    if(ch==='D')g.prematuur++;
  }
  g.deviations=g.total-g.preferred;
  return g;
}
function teamLevel(g){
  if(g.preferred>=15)return 'Zeer sterk';
  if(g.preferred>=13)return 'Sterk';
  if(g.preferred>=11)return 'Prima';
  if(g.preferred>=9)return 'In ontwikkeling';
  return 'Voor verbetering vatbaar';
}
function teamStyle(g){
  if(g.deviations===0)return 'Passend sturend';
  const ranked=[['Controlerend sturend',g.micro],['Onderzoekend sturend',g.analyse],
                ['Ruimtegevend sturend',g.afhoudend],['Bestuurlijk schakelend',g.prematuur]]
                .sort((a,b)=>b[1]-a[1]);
  if(ranked[0][1]===ranked[1][1])return 'Gemengd sturingsprofiel';
  if(ranked[0][1]===1)return 'Incidentele afwijking';
  return ranked[0][0];
}
function teamEndProfile(mt){
  const g=teamGovernancePattern(mt), n=g.total||16, niveau=teamLevel(g), stijl=teamStyle(g);
  const s=mt.scores||{grip:0,eig:0,uit:0,strat:0};
  const avg=Math.round((Number(s.grip||0)+Number(s.eig||0)+Number(s.uit||0)+Number(s.strat||0))/4*10)/10;
  let desc,sterk,aandacht;
  if(g.preferred>=15){
    desc=`Jullie kozen bij ${g.preferred} van de ${n} risico's voor de voorkeurskeuze. Daarmee is de governance over vrijwel de hele simulatie passend.`;
    sterk='Jullie bepalen scherp welk organisatieniveau daadwerkelijk kan sturen.';
    aandacht='Welke afweging hielp jullie het meest om te bepalen waar een risico thuishoort?';
    return {naam:`${niveau} · Passend sturend`,g,n,avg,desc,sterk,aandacht,reflectie:true};
  }
  const dominant={
    'Controlerend sturend':'Jullie trokken bij meerdere afwijkende keuzes een risico naar het MT terwijl een andere interventie passender was.',
    'Onderzoekend sturend':'Jullie vroegen bij meerdere afwijkende keuzes aanvullende informatie terwijl een andere interventie passender was.',
    'Ruimtegevend sturend':'Jullie legden bij meerdere afwijkende keuzes een risico terug terwijl meer sturing of opschaling passender was.',
    'Bestuurlijk schakelend':'Jullie escaleerden bij meerdere afwijkende keuzes bestuurlijk terwijl een andere interventie passender was.',
    'Gemengd sturingsprofiel':'De afwijkende keuzes laten meerdere typen reflexen zien; er is geen duidelijke dominante afwijking.',
    'Incidentele afwijking':'Er zijn afwijkende keuzes, maar geen type afwijking komt vaak genoeg terug om van een vaste reflex te spreken.'
  }[stijl]||'De afwijkende keuzes laten geen duidelijke vaste reflex zien.';
  desc=`Jullie kozen bij ${g.preferred} van de ${n} risico's voor de voorkeurskeuze. ${dominant}`;
  sterk='De vier scorepijlers laten zien waar jullie sturing gedurende het spel goed uitpakt.';
  aandacht='Bespreek vooral de afwijkende keuzes: daar zit de meeste leerwaarde.';
  return {naam:`${niveau} · ${stijl}`,g,n,avg,desc,sterk,aandacht,reflectie:false};
}
function renderTeamEnd(mt){
  const p=teamEndProfile(mt), s=mt.scores||{}, cc=teamChoiceCounts(mt);
  document.body.classList.add('team-finished');
  const main=document.querySelector('main')||document.body;
  let el=document.getElementById('teamEndResult');
  if(!el){
    el=document.createElement('section'); el.id='teamEndResult'; el.className='team-end-result';
    main.appendChild(el);
  }
  // Hide normal live-round content but retain page shell/header.
  [...main.children].forEach(ch=>{if(ch!==el)ch.style.display='none'});
  el.style.display='block';
  el.innerHTML=`
    <div class="team-end-kicker">Eindresultaat</div>
    <h1>${mt.name||('MT '+mt.id)}</h1>
    <div class="team-end-profile">${p.naam}</div>
    <div class="team-end-fit">${p.g.preferred} van ${p.n} passende governancekeuzes</div>
    <div class="team-end-scores">
      <div><span>Grip</span><strong>${s.grip}</strong></div>
      <div><span>Eigenaarschap</span><strong>${s.eig}</strong></div>
      <div><span>Uitvoerbaarheid</span><strong>${s.uit}</strong></div>
      <div><span>Strategisch</span><strong>${s.strat}</strong></div>
    </div>
    <div class="team-end-choices"><span>A <b>${cc.A}</b></span><span>B <b>${cc.B}</b></span><span>C <b>${cc.C}</b></span><span>D <b>${cc.D}</b></span></div>
    <p class="team-end-desc">${p.desc}</p>
    <div class="team-end-good"><b>Sterk</b><br>${p.sterk}</div>
    <div class="team-end-att"><b>${p.reflectie?'Reflectievraag':'Aandachtspunt'}</b><br>${p.aandacht}</div>
    <div class="team-end-average">Gemiddelde effectscore ${p.avg}</div>`;
}


function renderPublishedEnd(er){
  document.body.classList.add('team-finished');
  const main=document.querySelector('main')||document.body;
  let el=document.getElementById('teamEndResult');
  if(!el){el=document.createElement('section');el.id='teamEndResult';el.className='team-end-result';main.appendChild(el);}
  [...main.children].forEach(ch=>{if(ch!==el)ch.style.display='none'});
  el.style.display='block';
  const s=er.scores||{}, cc=er.choices||{A:0,B:0,C:0,D:0};
  el.innerHTML=`
    <div class="team-end-kicker">Eindresultaat</div>
    <h1>${esc(er.mt_name||('MT '+id))}</h1>
    <div class="team-end-profile">${esc(er.profile||'')}</div>
    <div class="team-end-fit">${esc(er.preferredText||'')}</div>
    <div class="team-end-scores">
      <div><span>Grip</span><strong>${s.grip??'-'}</strong></div>
      <div><span>Eigenaarschap</span><strong>${s.eig??'-'}</strong></div>
      <div><span>Uitvoerbaarheid</span><strong>${s.uit??'-'}</strong></div>
      <div><span>Strategisch</span><strong>${s.strat??'-'}</strong></div>
    </div>
    <div class="team-end-choices"><span>A <b>${cc.A||0}</b></span><span>B <b>${cc.B||0}</b></span><span>C <b>${cc.C||0}</b></span><span>D <b>${cc.D||0}</b></span></div>
    <p class="team-end-desc">${esc(er.description||'')}</p>
    <div class="team-end-good"><b>Sterk</b><br>${esc(er.strong||'').replace(/^Sterk:\s*/,'')}</div>
    <div class="team-end-att"><b>${er.reflection?'Reflectievraag':'Aandachtspunt'}</b><br>${esc(er.attention||'').replace(/^(Reflectievraag|Aandachtspunt):\s*/,'')}</div>
    <div class="team-end-average">${esc(er.averageText||'')}</div>`;
}
function render(row){
  if(row){
    try{
      const raw=typeof row.risico_beschrijving==='string'?JSON.parse(row.risico_beschrijving):row.risico_beschrijving;
      if(raw?.endResult?.finished){renderPublishedEnd(raw.endResult);return;}
    }catch(e){}
  }
document.getElementById('team').textContent=`MT ${id}`;if(!row){document.getElementById('title').textContent='Nog geen actuele risicokaart beschikbaar';document.getElementById('context').textContent='Wacht tot de docent de simulatie heeft gestart.';return;}const d=parseRisk(row.risico_beschrijving);document.getElementById('round').textContent=`Ronde ${row.ronde}`;document.getElementById('risk').textContent=`Actuele risicokaart · ${row.risico_code||''}`;document.getElementById('title').textContent=row.risico_titel||'';document.getElementById('context').textContent=d.context||'-';document.getElementById('event').textContent=d.event||'-';document.getElementById('meta').textContent=`Afzender: ${row.afzender||'-'}`;
 const order=['Bereikbaarheid','Leefbaarheid','Veiligheid','Imago','Kosten'];document.getElementById('riskProfile').innerHTML=order.map(k=>`<div class="risk-pill ${riskClass(d.risks?.[k])}"><span>${k}</span><strong>${esc(d.risks?.[k]||'-')}</strong></div>`).join('');
 const cond=parseConditions(row.risico_eigenaar);document.getElementById('conditions').innerHTML=cond.length?cond.map(x=>`<div class="condition-item">${esc(x)}</div>`).join(''):'<div class="empty">Er zijn nog geen aanvullende condities of gebeurtenissen actief.</div>';
 const managed=parseManaged(row.actieve_mt_risicos);document.getElementById('managedRisks').innerHTML=managed.length?`<ul>${managed.map(x=>`<li><strong>${esc(x.id||'')}</strong> ${esc(x.title||'')}</li>`).join('')}</ul>`:'<div class="empty">Nog geen risico’s door het MT opgenomen.</div>';
}
async function load(){if(!sb)return;let {data,error}=await sb.from('mt_state').select('*').eq('mt_id',id).single();if(error){console.error(error);return;}render(data)}
async function boot(){document.getElementById('team').textContent=`MT ${id}`;await load();if(!sb)return;sb.channel(`mt-${id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'mt_state',filter:`mt_id=eq.${id}`},payload=>render(payload.new)).subscribe(status=>{let el=document.getElementById('live');if(el)el.textContent=status==='SUBSCRIBED'?'● Live verbonden':'○ Verbinden…';});}boot();
