(function(){
  const showBtn=document.getElementById('showQr');
  const modal=document.getElementById('qrModal');
  const grid=document.getElementById('qrGrid');
  const closeTop=document.getElementById('closeQr');
  const closeBottom=document.getElementById('closeQrBottom');
  const printBtn=document.getElementById('printQr');
  function teamUrl(mt){return new URL(`team.html?mt=${mt}`,new URL('.',window.location.href)).href;}
  function build(){grid.innerHTML='';for(let mt=1;mt<=4;mt++){const url=teamUrl(mt);const card=document.createElement('section');card.className='qr-card';card.innerHTML=`<h3>MT ${mt}</h3><div class="qr-sub">Scan voor actuele risicokaart en scores</div><div class="qr-code" id="qr-${mt}"></div><div class="qr-url">${url}</div>`;grid.appendChild(card);new QRCode(document.getElementById(`qr-${mt}`),{text:url,width:180,height:180,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});}}
  function open(){build();modal.classList.add('show');}
  function close(){modal.classList.remove('show');}
  showBtn.addEventListener('click',open);closeTop.addEventListener('click',close);closeBottom.addEventListener('click',close);printBtn.addEventListener('click',()=>window.print());modal.addEventListener('click',e=>{if(e.target===modal)close();});document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
})();
