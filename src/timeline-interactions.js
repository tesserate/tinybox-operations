// A single date model drives stages, tasks, batches and the stock forecast.
function rangeSpec(){
 const start=Date.UTC(2026,9+state.timelineOffset,1),end=Date.UTC(2026,9+state.timelineOffset+state.months,1);
 const from=state.timelineFrom??Math.round((start-origin)/DAY),days=state.timelineDays??Math.round((end-start)/DAY);
 state.ganttStart=from;return {from,days,to:from+days-1};
}
function timelineControls(){
 const r=rangeSpec(),label=state.timelineFrom==null?new Date(origin+r.from*DAY).toLocaleDateString('en-CA',{month:'short',year:'numeric',timeZone:'UTC'})+(state.months>1?' – '+new Date(origin+r.to*DAY).toLocaleDateString('en-CA',{month:'short',year:'numeric',timeZone:'UTC'}):''):date(r.from)+' – '+date(r.to);
 return `<div class="timeline-toolbar"><div class="range-control"><button data-time-step="-1" aria-label="Earlier time range">‹</button><strong>${label}</strong><button data-time-step="1" aria-label="Later time range">›</button></div><div class="timeline-tools"><div class="zoom-control"><button data-scale-step="-1" aria-label="Zoom in timeline">−</button>${[1,3,6].map(n=>`<button data-zoom-months="${n}" aria-pressed="${state.timelineDays==null&&state.months===n}">${n} ${n===1?'month':'months'}</button>`).join('')}<button data-scale-step="1" aria-label="Zoom out timeline">+</button></div>${levelControl()}</div></div>`;
}
function projectName(j){const c=j.id===state.quoteId&&state.quoteOpen?quote:quoteConfigurations[j.id];return j.type==='order'?[c?.customer||j.party,c?.site||j.site,c?.model||j.model].filter(Boolean).join(' - '):j.name;}
function customFlag(j){return j.customAdditions?'<span class="custom-flag" title="Custom additions">Custom</span>':'';}
function timelineBounds(list){return list.length?[Math.min(...list.map(t=>t.start)),Math.max(...list.map(t=>t.end))]:[today,today];}
function timelineDone(t){return t.group?leafDesc(t.id).length>0&&leafDesc(t.id).every(x=>x.done):!!t.done;}
function gantt(jobList){
 const spec=rangeSpec();let row=3,headers='',d=0;
 while(d<spec.days){const dt=new Date(origin+(spec.from+d)*DAY),m=dt.getUTCMonth(),begin=d;while(d<spec.days&&new Date(origin+(spec.from+d)*DAY).getUTCMonth()===m)d++;headers+=`<div class="g-month" style="grid-row:1;grid-column:${begin+2}/${d+2}">${dt.toLocaleDateString('en-CA',{month:'short',year:'numeric',timeZone:'UTC'})}</div>`;}
 for(let n=0;n<spec.days;n++){const day=new Date(origin+(spec.from+n)*DAY).getUTCDate();if(spec.days<=40||day===1||day===8||day===15||day===22)headers+=`<div class="g-day ${spec.from+n===today?'today':''}" style="grid-row:2;grid-column:${n+2}">${day}</div>`;}
 let html=`${timelineControls()}<div class="gantt-wrap" tabindex="0" aria-label="Timeline. Scroll horizontally to move dates, pinch or Control plus wheel to zoom."><div class="gantt v3-gantt calm-timeline" style="--days:${spec.days};--gridstep:${100*(spec.days<50?1:7)/spec.days}%;grid-template-columns:260px repeat(${spec.days},minmax(0,1fr))"><div class="g-label g-heading" style="grid-row:1/3">Project / task</div>${headers}`;
 for(const type of ['production','order']){
  const list=jobList.filter(j=>j.type===type);if(!list.length)continue;
  html+=`<div class="g-group type-heading ${type}" style="grid-row:${row++}">${type==='production'?'Factory production':'Customer delivery / installation'}</div>`;
  const groups=type==='production'?[...new Set(list.map(j=>j.batch||'Unassigned'))]:['orders'];
  for(const group of groups){
   const members=type==='production'?list.filter(j=>(j.batch||'Unassigned')===group):list;
   if(type==='production'){const all=jobs.filter(j=>j.type==='production'&&(j.batch||'Unassigned')===group).flatMap(j=>leaves(j.id)),[start,end]=timelineBounds(all);html+=ganttRow({id:group,title:group,batchrow:true,start,end},row++);}
   for(const j of members){
    const ls=j.status==='Draft quote'?[]:leaves(j.id),[start,end]=ls.length?timelineBounds(ls):[quoteConfigurations[j.id]?.date??j.promise,quoteConfigurations[j.id]?.date??j.promise];
    html+=ganttRow({id:j.id,title:projectName(j),job:j.id,start,end,jobrow:true},row++);
    if(j.status!=='Draft quote')for(const t of visibleTasks(j.id))html+=ganttRow(t,row++);
   }
  }
 }
 return html+`</div></div><div class="gantt-foot"><span>✓ Completed · stage bars span all subtasks</span><span>Drag to move · edges to resize · scroll sideways · pinch to zoom</span></div>`;
}
function ganttRow(t,row){
 const r=rangeSpec(),[a,b]=t.jobrow||t.batchrow?[t.start,t.end]:dates(t),l=Math.max(r.from,a)-r.from,h=Math.min(r.to,b)-r.from,off=b<r.from||a>r.to;
 const j=jobBy(t.job),draft=t.jobrow&&j.status==='Draft quote',completed=t.jobrow?leaves(j.id).length>0&&leaves(j.id).every(x=>x.done):t.batchrow?false:timelineDone(t);
 const dep=t.depends?taskBy(t.depends):null,conflict=dep&&dates(dep)[1]>=a&&!dep.done,jobLink=state.nav==='orders'?'data-open-order':'data-project';
 const expandable=(t.jobrow&&!draft)||t.group,collapsed=t.jobrow?state.jobCollapsed.includes(t.id)||state.level===0:state.collapsed.includes(t.id)||depth(t)>=state.level;
 const toggle=expandable?`<button class="tree-toggle" ${t.jobrow?`data-job-expand="${t.id}"`:`data-group-expand="${t.id}"`} aria-expanded="${!collapsed}" aria-label="${collapsed?'Expand':'Collapse'} ${esc(t.title)}">${collapsed?'+':'−'}</button>`:`<span class="timeline-check" aria-label="${completed?'Completed':'Scheduled'}">${completed?'✓':'·'}</span>`;
 const action=t.batchrow?`data-move-batch="${esc(t.id)}"`:t.jobrow?`${jobLink}="${t.id}"`:`data-edit-task="${t.id}"`;
 const key=t.batchrow?'batch:'+t.id:t.jobrow?'job:'+t.id:'task:'+t.id;
 const rowClass=t.batchrow?'g-batch-row':t.jobrow?'g-job-label':t.group?'g-stage-row':'g-task-row';
 const label=`${t.batchrow?'':toggle}<button class="plain ${t.jobrow?'job-name':''}" ${action}>${t.jobrow?`<small>${t.id} ${customFlag(j)}</small>`:''}${esc(t.title)}${t.batchrow?' <small>Move batch ↔</small>':''}${draft?' <span class="tag">Quote</span>':''}${completed?' <span class="completion-label">✓</span>':''}</button>`;
 const dragAttr=t.batchrow?`data-timeline-drag="batch" data-drag-id="${esc(t.id)}"`:!t.jobrow&&!t.group?`data-timeline-drag="task" data-drag-id="${t.id}" data-drag-task="${t.id}"`:'';
 return `<div class="g-label ${rowClass}" style="grid-row:${row};padding-left:${t.jobrow||t.batchrow?10:(depth(t)-1)*14+12}px">${label}</div><div class="g-track ${rowClass}" style="grid-row:${row}"></div>${off?`<div class="outside-range" style="grid-row:${row};grid-column:2/-1">${date(a)}–${date(b)} · outside view</div>`:`<button class="g-bar ${t.batchrow?'batchbar':t.jobrow?'jobbar'+(draft?' quote-draft-bar':''):t.group?'parent':'taskbar'} ${completed?'is-completed':''}" style="grid-row:${row};grid-column:${l+2}/${h+3}" ${action} ${dragAttr} data-timeline-info="${esc(key)}" aria-label="${esc(t.title)}, ${date(a)} to ${date(b)}${completed?', Completed':''}${conflict?', predecessor overlaps':''}">${!t.group&&!t.jobrow&&!t.batchrow&&specTextFits(h-l,r.days)?esc(t.title):''}${completed?'<span class="bar-check">✓</span>':''}${!t.jobrow&&!t.group&&!t.batchrow?'<span class="resize-edge left" data-resize="start" aria-hidden="true"></span><span class="resize-edge right" data-resize="end" aria-hidden="true"></span>':''}</button>`}`;
}
function specTextFits(span,days){return span/days>.14;}
function shiftTimeline(days){const r=rangeSpec();state.timelineFrom=r.from+days;state.timelineDays=r.days;render();}
function zoomTimeline(factor,anchor=.5){const r=rangeSpec(),days=Math.max(7,Math.min(366,Math.round(r.days*factor)));state.timelineFrom=Math.round(r.from+r.days*anchor-days*anchor);state.timelineDays=days;render();}
function timelineAnchor(e,wrap){const rect=wrap.querySelector('.g-track').getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));}
let moveGesture=null,pinchGesture=null,timelineTip=null,wheelRemainder=0,skipTimelineClick=false;
function hideTimelineTip(){timelineTip?.remove();timelineTip=null;}
function showTimelineTip(el){
 hideTimelineTip();const [kind,...rest]=el.dataset.timelineInfo.split(':'),id=rest.join(':');let title,span,owner,notes,done;
 if(kind==='task'){const t=taskBy(id);title=t.title;span=dates(t);owner=taskOwners(t).map(p=>p.name).join(', ')||t.owner;notes=t.comment||(t.group?'Dates follow all subtasks.':t.depends?'After '+taskBy(t.depends)?.title:'No notes yet.');done=timelineDone(t);}
 else if(kind==='job'){const j=jobBy(id);title=projectName(j);span=timelineBounds(leaves(id));owner=j.party;notes=j.customAdditions?'Custom additions: '+(j.customNotes||'See order details'):'Open project for all tasks.';}
 else{const members=jobs.filter(j=>j.type==='production'&&(j.batch||'Unassigned')===id);title='Batch '+id;span=timelineBounds(members.flatMap(j=>leaves(j.id)));owner=[...new Set(members.map(j=>j.party))].join(', ');notes='Moving this batch shifts all its tasks and expected arrivals together.';}
 timelineTip=document.createElement('div');timelineTip.className='timeline-tooltip';timelineTip.setAttribute('role','tooltip');timelineTip.innerHTML=`<strong>${esc(title)}</strong><span>${date(span[0])} – ${date(span[1])}${done?' · ✓ Completed':''}</span><span>${esc(owner)}</span><p>${esc(notes)}</p>`;root.appendChild(timelineTip);
 const rect=el.getBoundingClientRect(),tip=timelineTip.getBoundingClientRect(),top=Math.max(visibleFrame.top+8,Math.min(rect.bottom+8,visibleFrame.bottom-tip.height-8));timelineTip.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-300))+'px';timelineTip.style.top=top+'px';
}
root.addEventListener('pointerover',e=>{const el=e.target.closest('[data-timeline-info]');if(el&&!moveGesture&&e.pointerType!=='touch')showTimelineTip(el);});
root.addEventListener('pointerout',e=>{if(e.target.closest('[data-timeline-info]'))hideTimelineTip();});
root.addEventListener('focusin',e=>{if(e.target.matches('[data-timeline-info]'))showTimelineTip(e.target);});
root.addEventListener('focusout',hideTimelineTip);
root.addEventListener('click',e=>{
 if(skipTimelineClick){e.preventDefault();e.stopImmediatePropagation();skipTimelineClick=false;return;}
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.zoomMonths){state.timelineFrom=null;state.timelineDays=null;}
 if(b.dataset.timeStep&&state.timelineFrom!=null){e.stopImmediatePropagation();shiftTimeline(Number(b.dataset.timeStep)*rangeSpec().days);}
 if(b.dataset.scaleStep){e.stopImmediatePropagation();zoomTimeline(Number(b.dataset.scaleStep)>0?1.5:1/1.5);}
 if(b.dataset.moveBatch){e.stopImmediatePropagation();openScheduleDialog('batch',b.dataset.moveBatch,0);}
},true);
root.addEventListener('wheel',e=>{
 const wrap=e.target.closest('.gantt-wrap');if(!wrap)return;
 if(e.ctrlKey||e.metaKey){e.preventDefault();hideTimelineTip();zoomTimeline(Math.exp(Math.max(-.3,Math.min(.3,e.deltaY*.01))),timelineAnchor(e,wrap));return;}
 const amount=e.deltaX||(e.shiftKey?e.deltaY:0);if(!amount)return;e.preventDefault();hideTimelineTip();wheelRemainder+=amount;const px=wrap.querySelector('.g-track').getBoundingClientRect().width/rangeSpec().days,days=Math.trunc(wheelRemainder/Math.max(1,px));if(days){wheelRemainder-=days*Math.max(1,px);shiftTimeline(days);}
},{passive:false});
// Safari trackpad pinch emits gesture events instead of Control+wheel.
let safariScale=1;
root.addEventListener('gesturestart',e=>{if(e.target.closest('.gantt-wrap')){e.preventDefault();safariScale=1;}},{passive:false});
root.addEventListener('gesturechange',e=>{const w=e.target.closest('.gantt-wrap');if(w){e.preventDefault();zoomTimeline(safariScale/e.scale,timelineAnchor(e,w));safariScale=e.scale;}},{passive:false});
const timelineTouches=new Map();
root.addEventListener('pointerdown',e=>{
 const wrap=e.target.closest('.gantt-wrap');if(!wrap)return;hideTimelineTip();
 if(e.pointerType==='touch'){timelineTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(timelineTouches.size===2){const p=[...timelineTouches.values()];pinchGesture={distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),range:{...rangeSpec()}};moveGesture=null;drag=null;e.stopImmediatePropagation();return;}}
 const bar=e.target.closest('[data-timeline-drag]');if(!bar||e.button!==0)return;e.stopImmediatePropagation();drag=null;
 const type=bar.dataset.timelineDrag,id=bar.dataset.dragId,ts=type==='batch'?jobs.filter(j=>j.type==='production'&&(j.batch||'Unassigned')===id).flatMap(j=>leaves(j.id)):[taskBy(id)],[a,b]=timelineBounds(ts);
 moveGesture={type,id,start:a,end:b,x:e.clientX,bar,edge:e.target.dataset.resize,daysize:wrap.querySelector('.g-track').getBoundingClientRect().width/rangeSpec().days,delta:0,pointer:e.pointerId};bar.setPointerCapture?.(e.pointerId);
},true);
root.addEventListener('pointermove',e=>{
 if(timelineTouches.has(e.pointerId))timelineTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pinchGesture&&timelineTouches.size===2){e.preventDefault();e.stopImmediatePropagation();const p=[...timelineTouches.values()],distance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);state.timelineFrom=pinchGesture.range.from;state.timelineDays=pinchGesture.range.days;zoomTimeline(pinchGesture.distance/Math.max(1,distance));return;}
 if(!moveGesture)return;e.stopImmediatePropagation();const g=moveGesture;g.delta=Math.round((e.clientX-g.x)/g.daysize);if(g.edge==='start')g.delta=Math.min(g.delta,g.end-g.start);if(g.edge==='end')g.delta=Math.max(g.delta,g.start-g.end);
 const r=rangeSpec(),a=g.start+(g.edge==='end'?0:g.delta),b=g.end+(g.edge==='start'?0:g.delta);g.bar.style.gridColumn=`${Math.max(r.from,a)-r.from+2}/${Math.min(r.to,b)-r.from+3}`;g.bar.classList.toggle('is-dragging',!!g.delta);g.bar.setAttribute('aria-label',`${date(a)} to ${date(b)}`);
},true);
root.addEventListener('pointerup',e=>{
 timelineTouches.delete(e.pointerId);if(pinchGesture){if(timelineTouches.size<2)pinchGesture=null;skipTimelineClick=true;setTimeout(()=>skipTimelineClick=false,0);e.stopImmediatePropagation();return;}
 if(!moveGesture)return;e.stopImmediatePropagation();const g=moveGesture;moveGesture=null;if(!g.delta){g.bar.classList.remove('is-dragging');return;}skipTimelineClick=true;setTimeout(()=>skipTimelineClick=false,0);render();openScheduleDialog(g.type,g.id,g.delta,g.edge);
},true);
root.addEventListener('pointercancel',()=>{moveGesture=null;pinchGesture=null;timelineTouches.clear();drag=null;render();},true);
function scheduleChanges(type,id,delta,edge){const list=type==='batch'?jobs.filter(j=>j.type==='production'&&(j.batch||'Unassigned')===id).flatMap(j=>leaves(j.id)):[taskBy(id)];return list.map(t=>({id:t.id,before:[t.start,t.end],after:[t.start+(edge==='end'?0:delta),t.end+(edge==='start'?0:delta)]}));}
function openScheduleDialog(type,id,delta=0,edge){
 const changes=scheduleChanges(type,id,delta,edge),first=Math.min(...changes.map(c=>c.before[0]));lastFocus=document.activeElement;state.dialog={kind:'schedule',type,id,delta,edge,changes};
 modal.innerHTML=`<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="tb2-dialog-title"><h3 id="tb2-dialog-title">${type==='batch'?'Move batch '+esc(id):'Confirm date change'}</h3><p class="small muted">${type==='batch'?'All tasks and expected arrivals move together.':esc(taskBy(id).title)}</p>${type==='batch'?`<label class="space">Batch begins<input type="date" id="schedule-begin" value="${iso(first+delta)}" data-original="${first}"></label>`:''}<div id="schedule-preview">${schedulePreview(changes)}</div><p class="small muted space">${type==='batch'?'Recorded stock movements keep their actual dates. Customer delivery promises stay unchanged.':'Parent stage dates update automatically.'}</p><p id="tb2-dialog-error" role="alert"></p><div class="actions"><button data-action="close-dialog">Cancel</button><button class="primary" data-schedule-save>Confirm dates</button></div></div>`;modal.hidden=false;positionWorkDialog();modal.querySelector('input,button').focus({preventScroll:true});
}
function schedulePreview(changes){return `<div class="schedule-changes">${changes.map(c=>`<div><span>${esc(taskBy(c.id).title)}${taskBy(c.id).done?' · ✓ Completed':''}</span><small>${date(c.before[0])}–${date(c.before[1])} → <strong>${date(c.after[0])}–${date(c.after[1])}</strong></small></div>`).join('')}</div>`;}
function saveSchedule(){const d=state.dialog;if(d?.kind!=='schedule')return;if(d.changes.some(c=>c.after.some(n=>!Number.isFinite(n))||c.after[1]<c.after[0])){error('Enter a valid date range.');return;}
 for(const c of d.changes){const t=taskBy(c.id);t.start=c.after[0];t.end=c.after[1];(t.history||=[]).push({action:'Dates changed',at:today,note:iso(c.before[0])+' → '+iso(c.after[0])});entries.filter(e=>e.task===t.id&&e.kind!=='actual').forEach(e=>e.at=t.end);if(t.receipt)jobBy(t.job).promise=t.end;}
 if(d.type==='batch')jobs.filter(j=>j.type==='production'&&(j.batch||'Unassigned')===d.id).forEach(j=>{j.start+=d.delta;const receipt=leaves(j.id).filter(t=>t.receipt);j.promise=receipt.length?Math.max(...receipt.map(t=>t.end)):j.promise+d.delta;});
 closeDialog(false);render();save();announce('Dates updated. Stages and expected availability now follow the new schedule.');
}
root.addEventListener('change',e=>{if(e.target.id==='schedule-begin'){const d=state.dialog;d.delta=idx(e.target.value)-Number(e.target.dataset.original);if(Number.isFinite(d.delta)){d.changes=scheduleChanges(d.type,d.id,d.delta);modal.querySelector('#schedule-preview').innerHTML=schedulePreview(d.changes);}}});
root.addEventListener('click',e=>{if(e.target.closest('[data-schedule-save]'))saveSchedule();});
