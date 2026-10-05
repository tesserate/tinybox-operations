const orderStages=['Quote','$1k deposit','50% downpayment','75% downpayment','100% downpayment'];
function orderStage(j){return j.status==='Draft quote'?'Quote':orderStages.includes(j.paymentStage)&&j.paymentStage!=='Quote'?j.paymentStage:'$1k deposit';}
function orderStageSelect(j){const stage=orderStage(j);return `<select class="order-status-select stage-${orderStages.indexOf(stage)}" data-order-stage="${j.id}" aria-label="Status for ${j.id}" ${state.orderEditing&&state.quoteId===j.id?'disabled':''}>${orderStages.map(s=>`<option value="${esc(s)}" ${stage===s?'selected':''}>${esc(s)}</option>`).join('')}</select>`;}
function orderRecipeSignature(c){const {customer,site,date,...recipe}=c;return JSON.stringify(recipe);}
function setOrderStage(id,stage){
 const j=jobBy(id);if(!j||j.type!=='order'||!orderStages.includes(stage)||state.orderEditing&&state.quoteId===id)return;
 const previous=orderStage(j);if(previous===stage)return;
 const config=JSON.parse(JSON.stringify(state.quoteId===id?quote:quoteConfigurations[id]));
 if(stage==='Quote'){
  // Pause future commitments, but never erase physical movements or completed work.
  j.pausedConfirmation={config,plan:JSON.parse(JSON.stringify(j.fullPlan)),preset:{...j.presetSnapshot},reservations:entries.filter(e=>e.job===id&&e.kind==='reserved').map(e=>({...e})),promise:j.promise};
  for(let n=entries.length-1;n>=0;n--)if(entries[n].job===id&&entries[n].kind==='reserved')entries.splice(n,1);
  j.status='Draft quote';j.paymentStage='Quote';quoteConfigurations[id]=config;
 }else if(j.status==='Confirmed'){
  j.paymentStage=stage;
 }else{
  const held=j.pausedConfirmation,same=held&&orderRecipeSignature(config)===orderRecipeSignature(held.config),plan=same?held.plan:planForOrder(id),delta=held?config.date-held.promise:0;
  Object.assign(j,{status:'Confirmed',paymentStage:stage,fullPlan:JSON.parse(JSON.stringify(plan)),presetSnapshot:same?held.preset:{...presets[config.model+'|'+config.frame]},promise:config.date,party:config.customer,site:config.site,model:config.model,frame:config.frame,price:plan.price});
  quoteConfigurations[id]=config;
  if(same){held.reservations.forEach(e=>entries.push({...e,at:e.at+delta}));if(delta)tasks.filter(t=>t.job===id&&!t.done&&!t.group).forEach(t=>{t.start+=delta;t.end+=delta;});}
  else{
   // Only unfulfilled material requirements become new reservations.
   for(const [n,r] of plan.requirements.entries()){const issued=entries.filter(e=>e.job===id&&e.item===r.itemId&&e.kind==='actual'&&e.qty<0).reduce((sum,e)=>sum-e.qty,0),qty=Math.max(0,r.qty-issued);if(qty)entries.push({id:id+'-STAGE-'+n,item:r.itemId,kind:'reserved',qty,at:config.date-2,job:id,label:'Confirmed option requirement'});}
   const titles=new Set(plan.taskTemplates.map(t=>t.title));
   for(let n=tasks.length-1;n>=0;n--){const t=tasks[n];if(t.job===id&&!t.group&&!t.done&&!t.progress&&!t.actualHours&&t.status!=='In progress'&&!titles.has(t.title))tasks.splice(n,1);}
   let parent=tasks.find(t=>t.job===id&&t.group)?.id;if(!parent){parent=id+'-ROOT';tasks.push({id:parent,job:id,parent:null,title:'Order fulfillment',owner:'PM',group:true,start:config.date-10,end:config.date});}
   plan.taskTemplates.forEach((template,n)=>{let t=tasks.find(t=>t.job===id&&!t.group&&t.title===template.title);if(t?.done||t?.progress||t?.actualHours||t?.status==='In progress')return;if(!t){t={id:id+'-STAGE-T'+n,job:id,parent,done:false,people:people.filter(p=>p.roles.includes(template.owner)).map(p=>p.id)};tasks.push(t);}Object.assign(t,{title:template.title,owner:template.owner,start:config.date+Number(template.offset||0),end:config.date+Number(template.offset||0)+Math.max(1,Number(template.days||1))-1});});
  }
  delete j.pausedConfirmation;
 }
 (j.statusHistory||=[]).push({from:previous,to:stage,at:today});
 render();save();announce(stage==='Quote'?'Moved to Quote. Future reservations released; work history retained.':`${stage} · confirmed project.${previous==='Quote'&&j.fullPlan?.needsSetup?.length?' Some options still need preset setup.':''}`);
}
root.addEventListener('change',e=>{if(e.target.dataset.orderStage)setOrderStage(e.target.dataset.orderStage,e.target.value);});
