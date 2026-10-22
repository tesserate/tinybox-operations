// 3PL orders allocate existing commitments; dispatch posts physical stock once.
let fulfillmentSequence=0;
const copyValue=v=>JSON.parse(JSON.stringify(v));
const savedQuotePlan=getQuotePlan;
getQuotePlan=function(){const plan=copyValue(savedQuotePlan()),overrides=jobBy(state.quoteId)?.materialQuantities||{};
 for(const r of plan.requirements){if(overrides[r.itemId]===undefined)continue;const previous=r.qty;r.qty=overrides[r.itemId];for(const row of plan.rowPlans||[])for(const m of row.requirements)if(m.itemId===r.itemId)m.qty=previous?m.qty/previous*r.qty:r.qty;}
 return plan;
};
function orderMaterials(id){return planForOrder(id).requirements.map(r=>({...r,qty:jobBy(id).materialQuantities?.[r.itemId]??r.qty}));}
function dispatchedQuantity(job,item){return entries.filter(e=>e.job===job&&e.item===item&&e.kind==='actual'&&e.qty<0).reduce((n,e)=>n-e.qty,0);}
function allocatedQuantity(job,item){return entries.filter(e=>e.job===job&&e.item===item&&e.kind==='reserved'&&e.fulfillment).reduce((n,e)=>n+e.qty,0);}
function availableFor3PL(job,item,total){return Math.max(0,total-dispatchedQuantity(job,item)-allocatedQuantity(job,item));}
function reconcileOrderCommitments(id){const j=jobBy(id);if(j.status!=='Confirmed')return;
 for(const r of orderMaterials(id)){
  const loose=entries.filter(e=>e.job===id&&e.item===r.itemId&&e.kind==='reserved'&&!e.fulfillment),needed=Math.max(0,r.qty-dispatchedQuantity(id,r.itemId)-allocatedQuantity(id,r.itemId));
  if(!needed){for(const e of loose)entries.splice(entries.indexOf(e),1);continue;}
  if(loose.length){loose[0].qty=needed;for(const e of loose.slice(1))entries.splice(entries.indexOf(e),1);}
  else entries.push({id:'REQ-'+id+'-'+r.itemId+'-'+(++fulfillmentSequence),item:r.itemId,kind:'reserved',qty:needed,at:j.promise-2,job:id,label:'Order material requirement'});
 }
}
function ensureFulfillmentTasks(){
 for(const j of jobs.filter(j=>j.type==='order'&&j.status==='Confirmed')){
  if(tasks.some(t=>t.job===j.id&&t.kind==='3pl-order'))continue;
  const parent=tasks.find(t=>t.job===j.id&&t.group)?.id||null;
  tasks.push({id:j.id+'-3PL',job:j.id,parent,kind:'3pl-order',title:'Order from 3PL',start:j.promise-7,end:j.promise-7,owner:'Warehouse',people:['P2'],done:false});
 }
}
function add3PLTask(id){const j=jobBy(id);if(!j||j.status!=='Confirmed')return;const t={id:id+'-3PL-'+(++fulfillmentSequence),job:id,parent:tasks.find(t=>t.job===id&&t.group)?.id||null,kind:'3pl-order',title:'Order from 3PL',start:today,end:today,owner:'Warehouse',people:['P2'],done:false};tasks.push(t);render();openDialog('edit',t.id);}
function completionInfo(t){return t.done?`<div class="completion-banner">✓ Completed${t.completedAt!==undefined?' '+date(t.completedAt):''}${t.completedBy?' by '+esc(t.completedBy):''}<span>Details remain editable</span></div>`:'';}
function taskHistory(t){return t.history?.length?`<details class="space"><summary>History (${t.history.length})</summary><div class="task-history">${[...t.history].reverse().map(h=>`<div><strong>${esc(h.action)}</strong> · ${date(h.at)}<small>${esc(h.note||'')}</small></div>`).join('')}</div></details>`:'';}
const previousOpenDialog=openDialog,previousSaveDialog=saveDialog;
openDialog=function(kind,id,extra={}){
 const t=taskBy(id);
 if(t?.kind==='3pl-order'&&(kind==='edit'||kind==='complete')){open3PL(t);return;}
 if(t?.kind==='3pl-dispatch'&&(kind==='edit'||kind==='complete')){openDispatch(t);return;}
 previousOpenDialog(kind,id,extra);
 if(kind==='edit'&&t&&!t.group){
  modal.querySelector('.fields').insertAdjacentHTML('beforebegin',completionInfo(t)+`<label class="space">Task<input id="task-edit-title" value="${esc(t.title)}"></label>`);
  const select=modal.querySelector('#tb2-edit-status');select.disabled=false;select.innerHTML=['Not started','In progress','Blocked','Complete'].map(s=>`<option value="${s}" ${s===(t.done?'Complete':t.status||'Not started')?'selected':''}>${s}</option>`).join('');
  modal.querySelector('.actions').insertAdjacentHTML('beforebegin',taskHistory(t));
 }
 if(kind==='complete'){const note=[...modal.querySelectorAll('p')].find(p=>p.textContent.includes('Demo user'));if(note)note.textContent='Completion and comments are recorded in task history.';}
 positionWorkDialog();
};
saveDialog=function(){
 const d=state.dialog,t=taskBy(d?.id);if(!d)return;
 if(d.kind==='edit'&&t&&!t.group){
  const selected=val('tb2-edit-status'),title=val('task-edit-title').trim(),before={start:t.start,end:t.end,done:t.done,title:t.title,comment:t.comment};
  if(!title){error('Enter a task name.');return;}
  if(t.receipt&&!t.done&&selected==='Complete'){error('Use the receipt confirmation to record quantities and complete this task.');return;}
  if(t.receipt&&t.done&&selected!=='Complete'){error('Posted receipts stay completed. Correct their stock movements separately.');return;}
  previousSaveDialog();if(state.dialog)return;t.title=title;t.done=selected==='Complete';
  if(t.done&&!before.done){t.completedAt=today;t.completedBy=taskOwners(t)[0]?.name||'Oliver';}if(!t.done){t.completedAt=undefined;t.completedBy=null;}
  (t.history||=[]).push({action:'Task edited',at:today,note:before.done!==t.done?(t.done?'Marked complete':'Reopened'):t.comment||'Details updated'});render();return;
 }
 previousSaveDialog();if(state.dialog)return;
 if(d.kind==='complete'&&t){if(t.done){t.completedAt=today;t.completedBy=taskOwners(t)[0]?.name||'Oliver';}else t.completedAt=undefined;(t.history||=[]).push({action:t.done?'Completed':'Reopened',at:today,note:t.comment});render();}
};
function positionWorkDialog(){if(modal.hidden)return;const dialog=modal.querySelector('.dialog');if(!dialog)return;modal.style.paddingTop=Math.max(12,visibleFrame.top+12)+'px';dialog.style.maxHeight=Math.max(180,visibleFrame.bottom-visibleFrame.top-24)+'px';}
window.addEventListener('message',e=>{if(e.source===window.parent&&e.data?.type==='tinybox:viewport')positionWorkDialog();});
function fulfillmentDialog(title,sub,body,actions,kind,id){lastFocus=document.activeElement;state.dialog={kind,id};modal.innerHTML=`<div class="dialog fulfillment-dialog" role="dialog" aria-modal="true" aria-labelledby="tb2-dialog-title"><h3 id="tb2-dialog-title">${title}</h3><p class="small muted">${sub}</p>${body}<p id="tb2-dialog-error" role="alert"></p><div class="actions">${actions}</div></div>`;modal.hidden=false;positionWorkDialog();modal.querySelector('input,button,textarea')?.focus({preventScroll:true});}
function open3PL(t){
 const j=jobBy(t.job),record=t.fulfillmentOrder,requirements=orderMaterials(j.id),lines=record?.lines||requirements.map(r=>({itemId:r.itemId,total:r.qty,qty:availableFor3PL(j.id,r.itemId,r.qty)}));
 const body=completionInfo(t)+`<div class="fields"><label>Order date<input id="fulfillment-date" type="date" value="${iso(t.end)}" ${record?'readonly':''}></label><label>Dispatch date<input id="fulfillment-dispatch" type="date" value="${iso((record?taskBy(record.dispatchTask)?.end:null)??t.draftDispatch??j.promise-2)}" ${record?'readonly':''}></label></div><div class="table-wrap space"><table class="fulfillment-table"><thead><tr><th><span class="sr-label">Include</span></th><th>Item</th><th class="num">Order total</th><th class="num">${record?'This order':'Still to order'}</th><th class="num">${record?'Committed':'This order'}</th></tr></thead><tbody>${lines.map(r=>{const i=items.find(i=>i.id===r.itemId),left=availableFor3PL(j.id,r.itemId,r.total),draft=t.draftLines?.find(x=>x.itemId===r.itemId),qty=draft?.qty??r.qty;return `<tr data-fulfillment-item="${r.itemId}"><td><input type="checkbox" data-fulfillment-include ${record||((draft?.included??true)&&left>0)?'checked':''} ${record?'disabled':''} aria-label="Include ${esc(i?.name||r.itemId)}"></td><td><strong>${esc(i?.name||r.itemId)}</strong><small>${esc(i?.unit||'units')}</small></td><td><input type="number" min="0" step="1" data-fulfillment-total value="${draft?.total??r.total}" ${record?'readonly':''} aria-label="Order total for ${esc(i?.name||r.itemId)}"></td><td class="num">${stockNumber(record?r.qty:left)}</td><td><input type="number" min="0" step="1" data-fulfillment-qty value="${qty}" ${record?'readonly':''} aria-label="This order quantity for ${esc(i?.name||r.itemId)}"></td></tr>`;}).join('')}</tbody></table></div><p class="small muted space">${record?'Quantities are committed to the linked dispatch task.':'Choose only the items in this 3PL order. Changing “Order total” updates the material quantities on the order page when confirmed.'}</p><label class="space">Notes<textarea id="fulfillment-notes">${esc(t.comment||'')}</textarea></label>${record?`<button class="link space" data-open-dispatch="${record.dispatchTask}">Open dispatch task →</button>`:''}${taskHistory(t)}`;
 fulfillmentDialog(record?'Order from 3PL · confirmed':'Order from 3PL',esc(j.id+' · '+projectName(j)),body,`<button data-action="close-dialog">Close</button><button data-add-3pl="${j.id}">+ Another 3PL order</button><button data-3pl-draft>${record?'Save notes':'Save draft'}</button>${record?'':'<button class="primary" data-3pl-review>Review order</button>'}`,'3pl',t.id);
}
function read3PL(){const t=taskBy(state.dialog?.id),at=idx(val('fulfillment-date')),dispatchAt=idx(val('fulfillment-dispatch'));
 const lines=[...modal.querySelectorAll('[data-fulfillment-item]')].map(row=>({itemId:row.dataset.fulfillmentItem,total:Number(row.querySelector('[data-fulfillment-total]').value),qty:Number(row.querySelector('[data-fulfillment-qty]').value),included:row.querySelector('[data-fulfillment-include]').checked}));
 return {t,at,dispatchAt,lines,notes:val('fulfillment-notes').trim()};
}
function validate3PL(data,confirm=false){
 if(!Number.isFinite(data.at)||!Number.isFinite(data.dispatchAt)||data.dispatchAt<data.at)return 'Dispatch must be on or after the order date.';
 if(data.lines.some(r=>![r.total,r.qty].every(n=>Number.isInteger(n)&&n>=0)))return 'Use non-negative whole quantities.';
 for(const r of data.lines){const committed=dispatchedQuantity(data.t.job,r.itemId)+allocatedQuantity(data.t.job,r.itemId);if(r.total<committed)return 'Order total cannot be lower than quantities already ordered or dispatched.';if(r.included&&r.qty>r.total-committed)return 'This order quantity exceeds the remaining requirement.';}
 if(confirm&&!data.lines.some(r=>r.included&&r.qty>0))return 'Choose at least one item and quantity.';return '';
}
function save3PLDraft(){const t=taskBy(state.dialog.id);if(t.fulfillmentOrder){t.comment=val('fulfillment-notes').trim();(t.history||=[]).push({action:'Notes edited',at:today,note:t.comment});closeDialog(false);render();return;}
 const data=read3PL(),message=validate3PL(data);if(message){error(message);return;}t.draftLines=data.lines;t.draftDispatch=data.dispatchAt;t.start=t.end=data.at;t.comment=data.notes;closeDialog(false);render();announce('3PL draft saved. Inventory has not changed.');}
function review3PL(){const data=read3PL(),message=validate3PL(data,true);if(message){error(message);return;}const rows=data.lines.filter(r=>r.included&&r.qty>0),t=data.t;
 fulfillmentDialog('Confirm 3PL order?',esc(projectName(jobBy(t.job))),`<div class="notice space">By clicking Confirm, you will update inventory commitments for the selected quantities. On-hand stock will be deducted when the dispatch task is confirmed.</div><ul class="fulfillment-review">${rows.map(r=>`<li>${esc(items.find(i=>i.id===r.itemId)?.name||r.itemId)}<strong>${r.qty} ${esc(items.find(i=>i.id===r.itemId)?.unit||'units')}</strong></li>`).join('')}</ul><p class="small muted">Dispatch planned ${date(data.dispatchAt)}. Existing order commitments are reused, so quantities are not counted twice.</p>`,`<button data-3pl-back>Back</button><button class="primary" data-3pl-confirm>Confirm</button>`,'3pl-confirm',t.id);state.dialog.pending=data;
}
function confirm3PL(){const d=state.dialog;if(d?.kind!=='3pl-confirm')return;const data=d.pending,t=taskBy(d.id);if(t.fulfillmentOrder)return;const message=validate3PL(data,true);if(message){error(message);return;}
 const j=jobBy(t.job);j.materialQuantities={...j.materialQuantities};data.lines.forEach(r=>j.materialQuantities[r.itemId]=r.total);reconcileOrderCommitments(j.id);
 const selected=data.lines.filter(r=>r.included&&r.qty>0),dispatchId=t.id+'-DISPATCH';
 for(const r of selected){let remaining=r.qty;const loose=entries.filter(e=>e.job===j.id&&e.item===r.itemId&&e.kind==='reserved'&&!e.fulfillment);for(const entry of loose){const n=Math.min(remaining,entry.qty);entry.qty-=n;remaining-=n;if(!entry.qty)entries.splice(entries.indexOf(entry),1);if(!remaining)break;}
  entries.push({id:t.id+'-'+r.itemId,item:r.itemId,kind:'reserved',qty:r.qty,at:data.dispatchAt,job:j.id,task:dispatchId,fulfillment:t.id,label:'3PL order · awaiting dispatch'});
 }
 t.fulfillmentOrder={lines:copyValue(selected),dispatchAt:data.dispatchAt,dispatchTask:dispatchId};t.start=t.end=data.at;t.done=true;t.completedAt=today;t.completedBy=taskOwners(t)[0]?.name||'Oliver';t.comment=data.notes;delete t.draftLines;
 (t.history||=[]).push({action:'3PL order confirmed',at:today,note:'Committed '+selected.length+' material types. On-hand stock unchanged.'});
 tasks.push({id:dispatchId,job:j.id,parent:t.parent,kind:'3pl-dispatch',orderTask:t.id,title:'Dispatch / delivery from 3PL',start:data.dispatchAt,end:data.dispatchAt,owner:'Logistics',people:['P7'],done:false,comment:'Dispatch items committed by '+t.title});
 closeDialog(false);render();save();announce('3PL order confirmed. Inventory commitments updated and dispatch task created.');
}
function openDispatch(t){const pending=entries.filter(e=>e.task===t.id&&e.kind==='reserved'),history=entries.filter(e=>e.task===t.id&&e.kind==='actual'),body=completionInfo(t)+`<div class="fields"><label>Actual dispatch date<input id="dispatch-date" type="date" max="${iso(today)}" value="${iso(today)}"></label><label>Planned dispatch<input id="dispatch-planned" type="date" value="${iso(t.end)}"></label></div><div class="table-wrap space"><table class="fulfillment-table"><thead><tr><th></th><th>Item</th><th class="num">Outstanding</th><th class="num">Dispatch now</th></tr></thead><tbody>${pending.map(e=>`<tr data-dispatch-entry="${e.id}"><td><input type="checkbox" data-dispatch-include checked aria-label="Dispatch ${esc(items.find(i=>i.id===e.item)?.name||e.item)}"></td><td>${esc(items.find(i=>i.id===e.item)?.name||e.item)}</td><td class="num">${e.qty}</td><td><input type="number" min="0" max="${e.qty}" step="1" data-dispatch-qty value="${e.qty}" aria-label="Quantity to dispatch ${esc(e.item)}"></td></tr>`).join('')||'<tr><td colspan="4">All committed items dispatched.</td></tr>'}</tbody></table></div>${history.length?`<details class="space" open><summary>Dispatch history</summary>${history.map(e=>`<div class="dispatch-history">${date(e.at)} · ${esc(items.find(i=>i.id===e.item)?.name||e.item)} · ${-e.qty} ${esc(e.comment||'')}</div>`).join('')}</details>`:''}<label class="space">Notes<textarea id="dispatch-notes">${esc(t.comment||'')}</textarea></label><p class="small muted space">Confirm only the items leaving the warehouse. Partial dispatch keeps the remaining quantities committed.</p>${taskHistory(t)}`;
 fulfillmentDialog('Dispatch / delivery from 3PL',esc(projectName(jobBy(t.job))),body,`<button data-action="close-dialog">Close</button><button data-dispatch-save>Save details</button>${pending.length?'<button class="primary" data-dispatch-review>Review dispatch</button>':''}`,'3pl-dispatch',t.id);
}
function readDispatch(){return {t:taskBy(state.dialog.id),at:idx(val('dispatch-date')),planned:idx(val('dispatch-planned')),notes:val('dispatch-notes').trim(),lines:[...modal.querySelectorAll('[data-dispatch-entry]')].filter(r=>r.querySelector('[data-dispatch-include]').checked).map(r=>({id:r.dataset.dispatchEntry,qty:Number(r.querySelector('[data-dispatch-qty]').value)})).filter(r=>r.qty!==0)};}
function validateDispatch(data){if(!Number.isFinite(data.at)||data.at>today)return 'Use an actual dispatch date no later than today.';if(!data.lines.length)return 'Select at least one item to dispatch.';const totals=new Map();for(const line of data.lines){const e=entries.find(e=>e.id===line.id&&e.kind==='reserved');if(!e||!Number.isInteger(line.qty)||line.qty<=0||line.qty>e.qty)return 'Check quantities against the outstanding balance.';totals.set(e.item,(totals.get(e.item)||0)+line.qty);}
 for(const [item,qty] of totals){const onHand=entries.filter(e=>e.item===item&&e.kind==='actual'&&e.at<=data.at).reduce((n,e)=>n+e.qty,0);if(qty>onHand)return 'Not enough recorded '+(items.find(i=>i.id===item)?.name||item)+' on that date. Record its receipt first.';}return '';}
function reviewDispatch(){const data=readDispatch(),message=validateDispatch(data);if(message){error(message);return;}
 fulfillmentDialog('Confirm dispatch?',esc(projectName(jobBy(data.t.job))),`<div class="notice space">Confirming deducts these quantities from on-hand inventory and clears their matching commitments.</div><ul class="fulfillment-review">${data.lines.map(r=>{const e=entries.find(e=>e.id===r.id);return `<li>${esc(items.find(i=>i.id===e.item)?.name||e.item)}<strong>${r.qty}</strong></li>`;}).join('')}</ul>`,`<button data-dispatch-back>Back</button><button class="primary" data-dispatch-confirm>Confirm dispatch</button>`,'dispatch-confirm',data.t.id);state.dialog.pending=data;
}
function confirmDispatch(){const d=state.dialog;if(d?.kind!=='dispatch-confirm')return;const data=d.pending,message=validateDispatch(data);if(message){error(message);return;}
 for(const line of data.lines){const e=entries.find(e=>e.id===line.id);entries.push({id:'3PL-OUT-'+(++fulfillmentSequence),item:e.item,kind:'actual',qty:-line.qty,at:data.at,job:e.job,task:e.task,fulfillment:e.fulfillment,label:'3PL dispatch',comment:data.notes});e.qty-=line.qty;if(!e.qty)entries.splice(entries.indexOf(e),1);state.stockHistory.add(e.item);}
 const t=data.t;t.done=!entries.some(e=>e.task===t.id&&e.kind==='reserved');t.status=t.done?'Complete':'In progress';t.comment=data.notes;if(t.done){t.completedAt=today;t.completedBy=taskOwners(t)[0]?.name||'Oliver';}t.start=Math.min(t.start,data.at);if(t.done)t.end=data.at;(t.history||=[]).push({action:t.done?'Dispatch completed':'Partial dispatch',at:today,note:data.notes});closeDialog(false);render();save();announce('Dispatch recorded. On-hand stock and remaining commitments updated.');
}
function orderMaterialsPanel(j){const reqs=orderMaterials(j.id);return `<details class="order-materials space"><summary>Materials & 3PL <span class="muted">${reqs.length} items</span></summary><div class="table-wrap"><table><thead><tr><th>Material</th><th class="num">Order quantity</th><th class="num">At 3PL</th><th class="num">Dispatched</th></tr></thead><tbody>${reqs.map(r=>`<tr><td>${esc(items.find(i=>i.id===r.itemId)?.name||r.itemId)}</td><td class="num">${r.qty} ${esc(items.find(i=>i.id===r.itemId)?.unit||'units')}</td><td class="num">${allocatedQuantity(j.id,r.itemId)}</td><td class="num">${dispatchedQuantity(j.id,r.itemId)}</td></tr>`).join('')}</tbody></table></div>${j.status==='Confirmed'?`<div class="row space"><button class="link" data-edit-task="${tasks.find(t=>t.job===j.id&&t.kind==='3pl-order')?.id}">Open 3PL order task →</button><button data-add-3pl="${j.id}">+ Another 3PL order</button></div>`:''}<p class="small muted space">Quantities edited in a confirmed 3PL task appear here.</p></details>`;}
const oldQuoteForm=quoteForm;
quoteForm=function(){const j=jobBy(state.quoteId);return oldQuoteForm().replace(`${j.id} · Studio configuration`,esc(projectName(j))+` ${customFlag(j)}`).replace('<div class="split qs-split">',`<div class="custom-control"><label class="check"><input data-custom-flag="${j.id}" type="checkbox" ${j.customAdditions?'checked':''}>Custom additions</label>${j.customAdditions?`<input data-custom-notes="${j.id}" aria-label="Custom additions notes" placeholder="Describe custom additions" value="${esc(j.customNotes||'')}">`:''}</div><div class="split qs-split">`).replace('<div class="quote-combination-note">',orderMaterialsPanel(j)+'<div class="quote-combination-note">').replaceAll('Free by need date','Available by date');};
const oldProjectPage=projectPage;
projectPage=function(){const j=jobBy(state.project);let html=oldProjectPage();if(j.type==='order')html=html.replace(`<h2>${esc(j.name)}</h2>`,`<h2>${esc(projectName(j))} ${customFlag(j)}</h2>`).replace('<div class="viewbar space">',`<div class="project-fulfillment space"><button data-add-3pl="${j.id}">+ 3PL order task</button><label class="check"><input data-custom-flag="${j.id}" type="checkbox" ${j.customAdditions?'checked':''}>Custom additions</label></div><div class="viewbar space">`);return html;};
const oldTaskTable=taskTable;
taskTable=function(list){let html=oldTaskTable(list);for(const j of jobs.filter(j=>j.type==='order'))html=html.replaceAll(esc(j.name),esc(projectName(j)));for(const j of jobs.filter(j=>j.customAdditions))html=html.replaceAll(`<span>${esc(projectName(j))}</span></button>`,`<span>${esc(projectName(j))}</span>${customFlag(j)}</button>`);return html;};
const oldOrderPage=orderPage;
orderPage=function(){let html=oldOrderPage();if(!state.quoteOpen)for(const j of jobs.filter(j=>j.type==='order'))html=html.replaceAll(`${j.id} · ${esc(j.name)}</button>`,`${j.id} · ${esc(projectName(j))} ${customFlag(j)}</button>`);return html;};
const oldInventoryPage=inventoryPage;
inventoryPage=function(){return oldInventoryPage().replaceAll('Free by date','Available by date');};
const oldRender=render;
render=function(){ensureFulfillmentTasks();for(const j of jobs.filter(j=>j.type==='order'))j.name=projectName(j);hideTimelineTip();oldRender();};
const previousStockMovement=openStockMovement;
openStockMovement=function(id){const e=entries.find(x=>x.id===id);if(e?.fulfillment&&taskBy(e.task)?.kind==='3pl-dispatch'){openDispatch(taskBy(e.task));return;}previousStockMovement(id);};
// Keep special task records when the option recipes regenerate ordinary tasks.
root.addEventListener('change',e=>{const id=e.target.dataset.customFlag||e.target.dataset.customNotes;if(!id)return;const j=jobBy(id);if(e.target.dataset.customFlag)j.customAdditions=e.target.checked;else j.customNotes=e.target.value.trim();render();save();});
root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.add3pl){e.stopImmediatePropagation();add3PLTask(d.add3pl);}
 if(d.openDispatch){e.stopImmediatePropagation();openDispatch(taskBy(d.openDispatch));}
 if('3plDraft' in d)save3PLDraft();if('3plReview' in d)review3PL();if('3plConfirm' in d)confirm3PL();
 if('3plBack' in d){const data=state.dialog.pending;data.t.draftLines=data.lines;data.t.draftDispatch=data.dispatchAt;data.t.comment=data.notes;open3PL(data.t);}
 if('dispatchReview' in d)reviewDispatch();if('dispatchConfirm' in d)confirmDispatch();if('dispatchBack' in d)openDispatch(taskBy(state.dialog.id));
 if('dispatchSave' in d){const t=taskBy(state.dialog.id),planned=idx(val('dispatch-planned'));if(!Number.isFinite(planned)){error('Enter a planned dispatch date.');return;}if(!t.done){t.start=t.end=planned;entries.filter(e=>e.task===t.id&&e.kind==='reserved').forEach(e=>e.at=planned);}t.comment=val('dispatch-notes');(t.history||=[]).push({action:'Details edited',at:today,note:t.comment});closeDialog(false);render();}
});
