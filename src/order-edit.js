state.orderEditing=false;state.orderView='list';
const quoteConfigurations={'Q-104':JSON.parse(JSON.stringify(quote))};
// Each saved order owns its configuration and its approved requirements.
for(const j of jobs.filter(j=>j.type==='order'&&j.id!=='Q-104')){
 const config={...quoteConfigurations['Q-104'],model:j.model,frame:j.frame,customer:j.party,site:j.site,date:j.promise};
 const cedar=entries.find(e=>e.job===j.id&&e.item==='cedar'&&e.kind==='reserved'),steel=entries.find(e=>e.job===j.id&&e.item==='steel'&&e.kind==='reserved');
 config.coverage=steel?'Half':'Full';config.override=!!cedar;config.overrideQty=cedar?.qty||presets[j.model+'|'+j.frame].panels;
 quoteConfigurations[j.id]=config;
 Object.assign(quote,config);state.quoteId=j.id;state.orderEditing=true;
 const plan=getQuotePlan();j.fullPlan=JSON.parse(JSON.stringify(plan));j.presetSnapshot={...presets[j.model+'|'+j.frame]};j.price=plan.price;
 // Saved commitments predate the editable draft recipes.
 for(const req of j.fullPlan.requirements){const old=entries.find(e=>e.job===j.id&&e.item===req.itemId&&e.kind==='reserved');if(old)req.qty=old.qty;}
 for(const row of j.fullPlan.rowPlans)for(const req of row.requirements){const old=entries.find(e=>e.job===j.id&&e.item===req.itemId&&e.kind==='reserved');if(old)req.qty=old.qty;}
}
state.quoteId='Q-104';state.orderEditing=false;Object.assign(quote,quoteConfigurations['Q-104']);
function openOrder(id){const previous=jobBy(state.quoteId);if(previous?.status==='Draft quote')quoteConfigurations[previous.id]=JSON.parse(JSON.stringify(quote));state.quoteId=id;state.orderEditing=false;Object.assign(quote,quoteConfigurations[id]);state.quoteOpen=true;navigate('orders');}
function saveOrderChanges(){const j=jobBy(state.quoteId);if(!state.orderEditing||j.status!=='Confirmed')return;
 const plan=getQuotePlan(),old=j.fullPlan,changedRecipe=JSON.stringify(plan.ruleSnapshot)!==JSON.stringify(old.ruleSnapshot);
 if(changedRecipe){if(plan.needsSetup.length){announce('Set up the selected option presets before saving a changed configuration.');return;}const short=plan.requirements.some(r=>!stockKnown(r.itemId)||stockForecast(r.itemId,quote.date-2,j.id).available<r.qty);if(short){announce('The changed configuration needs confirmed supply before it can be saved.');return;}}
 const oldDate=j.promise,delta=quote.date-oldDate;
 if(!Number.isFinite(quote.date)||!quote.customer.trim()||!quote.site.trim()){announce('Enter a name, delivery date and delivery site.');return;}
 if(changedRecipe){for(let n=entries.length-1;n>=0;n--)if(entries[n].job===j.id&&entries[n].kind==='reserved')entries.splice(n,1);plan.requirements.forEach((r,n)=>entries.push({id:j.id+'-REV-'+n,item:r.itemId,kind:'reserved',qty:r.qty,at:quote.date-2,job:j.id,label:'Updated confirmed requirement'}));
 // Completed work is retained; unstarted generated work follows the new option plan.
 const existing=tasks.filter(t=>t.job===j.id&&!t.group),titles=new Set(plan.taskTemplates.map(t=>t.title));for(let n=tasks.length-1;n>=0;n--)if(tasks[n].job===j.id&&!tasks[n].group&&!tasks[n].done&&!tasks[n].progress&&!tasks[n].actualHours&&tasks[n].status!=='In progress'&&!titles.has(tasks[n].title))tasks.splice(n,1);
 const parent=tasks.find(t=>t.job===j.id&&t.group)?.id||null;plan.taskTemplates.forEach((template,n)=>{let t=existing.find(t=>t.title===template.title);if(t?.done)return;if(!t){t={id:j.id+'-OPT-'+n,job:j.id,parent,done:false,people:[]};tasks.push(t);}Object.assign(t,{title:template.title,owner:template.owner,start:quote.date+template.offset,end:quote.date+template.offset+template.days-1});});j.fullPlan=JSON.parse(JSON.stringify(plan));j.presetSnapshot={...presets[quote.model+'|'+quote.frame]};j.price=plan.price;
 }else if(delta){entries.filter(e=>e.job===j.id&&e.kind==='reserved').forEach(e=>e.at+=delta);tasks.filter(t=>t.job===j.id&&!t.done&&!t.group).forEach(t=>{t.start+=delta;t.end+=delta;});}
 Object.assign(j,{party:quote.customer,site:quote.site,promise:quote.date,model:quote.model,frame:quote.frame});quoteConfigurations[j.id]=JSON.parse(JSON.stringify(quote));state.orderEditing=false;render();announce('Confirmed order updated. Saved requirements and task dates stay connected.');}
root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-order-edit')){state.orderEditing=true;render();}if(b.hasAttribute('data-order-cancel')){Object.assign(quote,quoteConfigurations[state.quoteId]);state.orderEditing=false;render();}if(b.hasAttribute('data-order-save'))saveOrderChanges();});
function planForOrder(id){const j=jobBy(id);if(j.status==='Confirmed'&&j.fullPlan)return j.fullPlan;const priorId=state.quoteId,priorQuote={...quote},editing=state.orderEditing;try{Object.assign(quote,id===priorId?priorQuote:quoteConfigurations[id]);state.quoteId=id;state.orderEditing=false;return getQuotePlan();}finally{Object.assign(quote,priorQuote);state.quoteId=priorId;state.orderEditing=editing;}}
function orderPage(){if(state.quoteOpen)return quoteForm();const toolbar=`<div class="task-toolbar"><div class="tabs" aria-label="Quote and order views"><button type="button" data-order-view="list" aria-pressed="${state.orderView==='list'}">List</button><button type="button" data-order-view="timeline" aria-pressed="${state.orderView==='timeline'}">Timeline</button></div><button class="primary" data-action="new-quote">New quote</button></div>`;if(state.orderView==='timeline')return toolbar+gantt(jobs.filter(j=>j.type==='order'));return `${toolbar}<div class="table-wrap"><table class="order-table"><thead><tr><th>Status</th><th>Quote / order</th><th>Customer</th><th>Model / frame</th><th>Delivery</th><th class="num">Price</th><th></th></tr></thead><tbody>${jobs.filter(j=>j.type==='order').map(j=>{const c=j.id===state.quoteId?quote:quoteConfigurations[j.id];return `<tr><td>${orderStageSelect(j)}</td><td><button class="link" data-open-order="${j.id}">${j.id} · ${esc(j.name)}</button></td><td>${esc(c.customer)}</td><td>${esc(c.model)} · ${esc(c.frame)}</td><td>${date(c.date)}</td><td class="num">${money(planForOrder(j.id).price)}</td><td>${j.status==='Confirmed'?`<button class="link" data-project="${j.id}">Tasks →</button>`:'Draft'}</td></tr>`;}).join('')}</tbody></table></div>`;}
root.addEventListener('change',e=>{if(e.target.dataset.quoteField&&jobBy(state.quoteId).status==='Draft quote')quoteConfigurations[state.quoteId]=JSON.parse(JSON.stringify(quote));});

root.addEventListener('click',e=>{const b=e.target.closest('[data-order-view]');if(!b)return;state.orderView=b.dataset.orderView;render();save();});
