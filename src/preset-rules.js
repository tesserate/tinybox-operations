// Shared option catalogue. Missing recipes stay visible in Presets and in quotes.
const optionCatalog = [
  {id:'model',label:'Model',choices:[{value:'Dojo',label:'Dojo'},{value:'Bunkie',label:'Bunkie'}]},
  {id:'frame',label:'Frame',choices:[{value:'Hybrid',label:'Hybrid'},{value:'Pro',label:'Pro'}]},
  {id:'build',label:'Build type',choices:[{value:'DIY',label:'DIY'},{value:'Installed',label:'Installed'}]},
  {id:'siding',label:'Siding',choices:[{value:'steel',label:'Steel'},{value:'steelwood',label:'Steel + Wood'},{value:'dovercliffs',label:'Engineered Earth · Dover Cliffs'},{value:'lunardust',label:'Engineered Earth · Lunar Dust'},{value:'volcanicash',label:'Engineered Earth · Volcanic Ash'},{value:'sequoia',label:'Engineered Earth · Sequoia'},{value:'martiansoil',label:'Engineered Earth · Martian Soil'},{value:'engineeredwood',label:'Engineered Wood'},{value:'cedar',label:'Cedar'},{value:'aluminum',label:'Aluminum'},{value:'mirror',label:'Mirror'}]},
  {id:'electrical',label:'Electrical',choices:[{value:'Extension cord',label:'Extension cord'},{value:'Hookup to home',label:'Hookup to home'},{value:'Solar',label:'Solar'}]},
  {id:'foundation',label:'Foundation',choices:[{value:'Adjustable landing pad',label:'Adjustable landing pad'},{value:'Concrete Pier',label:'Concrete Pier'},{value:'Helical Pile',label:'Helical Pile'},{value:'Concrete Slab',label:'Concrete Slab'}]},
  {id:'hvac',label:'Heating & cooling',choices:[{value:'Space heater & fan',label:'Space heater & fan'},{value:'Energy Recovery Ventilator (ERV)',label:'Energy Recovery Ventilator (ERV)'},{value:'Electric heat pump',label:'Electric heat pump'},{value:'Off-Grid Systems',label:'Off-Grid Systems'}]},
  {id:'shipping',label:'Shipping',choices:[{value:'Pick up from Toronto warehouse',label:'Pick up from Toronto warehouse'},{value:'Shipped to your door',label:'Shipped to your door'}]},
  {id:'frameColour',label:'Frame colour',choices:[{value:'Black',label:'Black'},{value:'White',label:'White'}]},
  {id:'glazing',label:'Glazing',choices:[{value:'Dual pane',label:'Dual pane'},{value:'Triple pane Passive Haus',label:'Triple pane Passive Haus'}]},
  {id:'accessory',label:'Accessories',choices:[{value:'None',label:'None'},{value:'Retractable bug net',label:'Retractable bug net'}]},
  {id:'finish',label:'Interior finish',choices:[{value:'White',label:'White'},{value:'Pine',label:'Pine'},{value:'Painted',label:'Painted'},{value:'Acoustic Board',label:'Acoustic Board'}]},
  {id:'layout',label:'Interior layout',choices:[{value:'Furnish yourself',label:'Furnish yourself'},{value:'Gym (plan only)',label:'Gym (plan only)'},{value:'Built-in furniture wall',label:'Built-in furniture wall'},{value:'Built-in furniture wall XL',label:'Built-in furniture wall XL'}]}
];
const optionRules = Object.create(null);
const ruleTrades = ['PM','Warehouse','Build crew','Siding installer','Electrician','HVAC technician','Logistics','Delivery crew','Inspector','Factory'];
let ruleEditDraft = null;
state.presetFilter = 'all';
[
  {id:'electrical-kit',name:'Electrical hookup package',unit:'packages',untracked:true},
  {id:'heat-pump',name:'Heat pump package',unit:'packages',untracked:true},
  {id:'packing-kit',name:'Shipping protection kit',unit:'kits',untracked:true},
  {id:'landing-pad',name:'Adjustable landing pad set',unit:'sets',untracked:true},
  {id:'engineeredwood',name:'Engineered wood siding',unit:'panels',untracked:true}
].forEach(item=>{if(!items.some(x=>x.id===item.id))items.push(item);});

function optionRuleKey(optionId,value,variant){return `${variant}::${optionId}::${value}`;}
function getOptionRule(optionId,value,variant=quote.model+'|'+quote.frame){return optionRules[optionRuleKey(optionId,value,variant)] || null;}
function ruleClone(value){return JSON.parse(JSON.stringify(value));}
function ruleBlank(){return {materials:[],labour:[],tasks:[],price:0,cost:0,conditions:{}};}
function ruleSeed(optionId,value,variant,data){optionRules[optionRuleKey(optionId,value,variant)]={...ruleBlank(),...data,revision:1};}
for(const [variant,p] of Object.entries(presets)){
  for(const model of ['Dojo','Bunkie']){
    const modelPreset=presets[model+'|'+p.frame];
    ruleSeed('model',model,variant,{materials:[{itemId:'kit',quantity:1,basis:'fixed'}],tasks:[{title:'Confirm configuration and site',owner:'PM',days:1,offset:-10}],price:modelPreset.base,cost:Math.round(modelPreset.base*.65)});
  }
  for(const frame of ['Hybrid','Pro'])ruleSeed('frame',frame,variant,{explicitNoNeeds:true});
  ruleSeed('build','DIY',variant,{tasks:[{title:'Issue assembly instructions',owner:'PM',days:1,offset:-1}],labour:[{trade:'PM',hours:1}],price:0,cost:60});
  ruleSeed('build','Installed',variant,{tasks:[{title:'Book installation crew',owner:'PM',days:1,offset:-10},{title:'Assemble frame and panels',owner:'Build crew',days:2,offset:1},{title:'Install siding',owner:'Siding installer',days:p.days,offset:3},{title:'Inspect and hand over',owner:'Inspector',days:1,offset:5}],labour:[{trade:'Build crew',hours:40},{trade:'Inspector',hours:2}],price:11000,cost:6200});
  ruleSeed('siding','cedar',variant,{materials:[{itemId:'cedar',quantity:p.panels,basis:'coverage'}],labour:[{trade:'Siding installer',hours:p.panels*p.hoursPerPanel}],tasks:[{title:'Pick cedar siding',owner:'Warehouse',days:1,offset:-p.leadDays}],price:p.panels*p.cedarPrice,cost:p.panels*p.cedarCost});
  ruleSeed('siding','steel',variant,{materials:[{itemId:'steel',quantity:p.panels,basis:'coverage'}],labour:[{trade:'Siding installer',hours:p.panels*.5}],tasks:[{title:'Pick steel siding',owner:'Warehouse',days:1,offset:-p.leadDays}],price:0,cost:p.panels*55});
  ruleSeed('electrical','Hookup to home',variant,{materials:[{itemId:'electrical-kit',quantity:1,basis:'fixed'}],labour:[{trade:'Electrician',hours:6}],tasks:[{title:'Book electrician',owner:'PM',days:1,offset:-10},{title:'Complete electrical hookup',owner:'Electrician',days:1,offset:3}],price:2500,cost:1500});
  ruleSeed('hvac','Electric heat pump',variant,{materials:[{itemId:'heat-pump',quantity:1,basis:'fixed'}],labour:[{trade:'HVAC technician',hours:4}],tasks:[{title:'Book heat pump installer',owner:'PM',days:1,offset:-8},{title:'Install heat pump',owner:'HVAC technician',days:1,offset:4}],price:1500,cost:1100});
  ruleSeed('foundation','Adjustable landing pad',variant,{materials:[{itemId:'landing-pad',quantity:1,basis:'fixed'}],tasks:[{title:'Confirm foundation readiness',owner:'PM',days:1,offset:-5}],labour:[{trade:'Build crew',hours:2}],price:400,cost:260});
  ruleSeed('shipping','Shipped to your door',variant,{materials:[{itemId:'packing-kit',quantity:1,basis:'fixed'}],labour:[{trade:'Warehouse',hours:2},{trade:'Delivery crew',hours:4}],tasks:[{title:'Book delivery truck',owner:'Logistics',days:1,offset:-7},{title:'Pack and secure order',owner:'Warehouse',days:1,offset:-2},{title:'Deliver to site',owner:'Delivery crew',days:1,offset:0}],pricePending:true,price:0,cost:0});
  ruleSeed('shipping','Pick up from Toronto warehouse',variant,{materials:[{itemId:'packing-kit',quantity:1,basis:'fixed'}],labour:[{trade:'Warehouse',hours:2}],tasks:[{title:'Arrange customer pickup',owner:'Logistics',days:1,offset:-5},{title:'Pack and release customer order',owner:'Warehouse',days:1,offset:0}],price:0,cost:120});
  for(const [optionId,value] of [['frameColour','Black'],['glazing','Dual pane'],['accessory','None'],['layout','Furnish yourself']])ruleSeed(optionId,value,variant,{explicitNoNeeds:true});
}

function ruleDescription(rule){
  if(!rule)return {needs:'No preset yet',work:'—',timing:'—',hours:'—'};
  const needs=rule.materials.length?rule.materials.map(m=>`${items.find(i=>i.id===m.itemId)?.name||m.itemId} × ${m.quantity}${m.basis==='coverage'?' / full coverage':''}`).join(' · '):rule.explicitNoNeeds?'Included · no extra needs':'No materials';
  const work=rule.tasks.length?`${rule.tasks.length} task${rule.tasks.length===1?'':'s'} · ${rule.tasks[0].title}`:'No tasks';
  const offsets=rule.tasks.map(t=>t.offset),timing=offsets.length?`${Math.min(...offsets)>0?'+':''}${Math.min(...offsets)} to ${Math.max(...offsets)>0?'+':''}${Math.max(...offsets)} days`:'—';
  return {needs,work,timing,hours:rule.labour.length?`${rule.labour.reduce((n,l)=>n+l.hours,0)} h`:'—'};
}
function presetPage(){
  const variant=state.presetVariant,rows=optionCatalog.flatMap(o=>o.choices.map(choice=>({option:o,choice,rule:getOptionRule(o.id,choice.value,variant)}))),missing=rows.filter(r=>!r.rule).length;
  const visible=state.presetFilter==='missing'?rows.filter(r=>!r.rule):rows;
  let previous='';
  return `<div class="title"><div><div class="kicker">Configuration library</div><h2>Presets</h2><p>Every choice, with its materials, work and pricing.</p></div><label>Model / frame<select id="tb2-preset-variant">${Object.keys(presets).map(k=>`<option value="${esc(k)}" ${k===variant?'selected':''}>${esc(k.replace('|',' · '))}</option>`).join('')}</select></label></div><div class="rule-overview"><div class="tabs"><button type="button" data-rule-filter="all" aria-pressed="${state.presetFilter==='all'}">All choices <span>${rows.length}</span></button><button type="button" data-rule-filter="missing" aria-pressed="${state.presetFilter==='missing'}">Needs setup <span class="rule-count">${missing}</span></button></div><span class="small muted">Illustrative recipes · edit any row</span></div><div class="table-wrap"><table class="rule-table"><thead><tr><th>Choice</th><th>Status</th><th>Materials</th><th>Tasks / timing</th><th class="num">Price</th><th class="num rule-secondary">Cost</th><th class="num rule-secondary">Hours</th><th></th></tr></thead><tbody>${visible.map(({option:o,choice:c,rule})=>{const d=ruleDescription(rule);let group='';if(previous!==o.id){previous=o.id;group=`<tr class="rule-category"><th colspan="8">${esc(o.label)}${o.id==='siding'?'<span>Quantities, hours and prices are for full coverage</span>':''}</th></tr>`;}return group+`<tr class="${!rule?'rule-missing':''}"><td><strong>${esc(c.label)}</strong></td><td>${tag(rule?'Ready':'Needs setup',rule?'green':'orange')}${rule&&Object.keys(rule.conditions).length?'<small class="rule-condition-label">Conditional</small>':''}</td><td>${esc(d.needs)}</td><td>${esc(d.work)}${rule?.tasks.length?`<small class="muted">${esc(d.timing)} from delivery</small>`:''}</td><td class="num">${rule?(rule.pricePending?'To quote':rule.price?money(rule.price):'Included'):'—'}</td><td class="num rule-secondary">${rule?(rule.pricePending&&!rule.cost?'—':money(rule.cost)):'—'}</td><td class="num rule-secondary">${esc(d.hours)}</td><td><button type="button" class="rule-edit" data-rule-option="${esc(o.id)}" data-rule-value="${esc(c.value)}" aria-label="${rule?'Edit':'Set up'} ${esc(o.label)}: ${esc(c.label)}">${rule?'Edit':'Set up'}</button></td></tr>`;}).join('')||'<tr><td colspan="8" class="rule-empty">All choices have presets for this variant.</td></tr>'}</tbody></table></div><p class="small muted space">Changes apply to draft quotes. Confirmed orders keep their saved requirements.</p>`;
}
function ruleSelect(value,choices,attrs=''){return `<select ${attrs}>${choices.map(c=>{const v=typeof c==='string'?c:c.value,l=typeof c==='string'?c:c.label;return `<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`;}).join('')}</select>`;}
function openRuleEditor(optionId,value){
  const option=optionCatalog.find(o=>o.id===optionId),choice=option?.choices.find(c=>c.value===value);if(!choice)return;
  lastFocus=document.activeElement;
  state.dialog={kind:'option-rule',optionId,value,variant:state.nav==='presets'?state.presetVariant:quote.model+'|'+quote.frame};
  ruleEditDraft=ruleClone(getOptionRule(optionId,value,state.dialog.variant)||ruleBlank());
  renderRuleEditor();modal.hidden=false;const dialog=modal.querySelector('.rule-dialog');dialog.scrollIntoView({block:'center'});modal.querySelector('input,select,button')?.focus({preventScroll:true});
}
function ruleMaterialRows(){return ruleEditDraft.materials.map((m,n)=>`<div class="rule-material-row" data-rule-material="${n}"><label><span class="rule-sr-only">Material</span>${ruleSelect(m.itemId,items.map(i=>({value:i.id,label:i.name+(i.untracked?' · untracked':'' )})),'data-rule-material-item')}</label><label><span class="rule-sr-only">Quantity</span><input type="number" min="0.01" step="any" value="${m.quantity}" data-rule-material-qty aria-label="Material quantity"></label><label><span class="rule-sr-only">Quantity basis</span>${ruleSelect(m.basis,[{value:'fixed',label:'Per order'},{value:'coverage',label:'Full coverage'}],'data-rule-material-basis')}</label><button type="button" class="rule-remove" data-rule-remove="materials" data-rule-index="${n}" aria-label="Remove material">×</button></div>`).join('');}
function ruleLabourRows(){return ruleEditDraft.labour.map((l,n)=>`<div class="rule-labour-row" data-rule-labour="${n}"><label><span class="rule-sr-only">Trade</span>${ruleSelect(l.trade,ruleTrades.includes(l.trade)?ruleTrades:[l.trade,...ruleTrades],'data-rule-labour-trade')}</label><label><span class="rule-sr-only">Hours</span><input type="number" min="0.25" step="0.25" value="${l.hours}" data-rule-labour-hours aria-label="Labour hours"></label><button type="button" class="rule-remove" data-rule-remove="labour" data-rule-index="${n}" aria-label="Remove labour">×</button></div>`).join('');}
function ruleTaskRows(){return ruleEditDraft.tasks.map((t,n)=>`<div class="rule-task-row" data-rule-task="${n}"><label><span class="rule-sr-only">Task title</span><input value="${esc(t.title)}" placeholder="Task name" data-rule-task-title aria-label="Task name"></label><label><span class="rule-sr-only">Owner</span>${ruleSelect(t.owner,ruleTrades.includes(t.owner)?ruleTrades:[t.owner,...ruleTrades],'data-rule-task-owner')}</label><label><span class="rule-sr-only">Duration days</span><input type="number" min="1" step="1" value="${t.days}" data-rule-task-days aria-label="Duration in days"></label><label><span class="rule-sr-only">Offset from delivery</span><input type="number" step="1" value="${t.offset}" data-rule-task-offset aria-label="Days from delivery, negative is before"></label><button type="button" class="rule-remove" data-rule-remove="tasks" data-rule-index="${n}" aria-label="Remove task">×</button></div>`).join('');}
function renderRuleEditor(){
  const d=state.dialog,o=optionCatalog.find(x=>x.id===d.optionId),c=o.choices.find(x=>x.value===d.value),r=ruleEditDraft;
  const conditions=Object.entries(r.conditions).filter(([,values])=>values.length).map(([id,values])=>`${optionCatalog.find(x=>x.id===id)?.label||id}: ${values.join(' or ')}`);
  modal.innerHTML=`<div class="dialog rule-dialog" role="dialog" aria-modal="true" aria-labelledby="tb2-dialog-title"><div class="rule-dialog-head"><div><div class="kicker">${esc(d.variant.replace('|',' · '))}</div><h3 id="tb2-dialog-title">${esc(o.label)} · ${esc(c.label)}</h3></div><button type="button" class="rule-remove" data-action="close-dialog" aria-label="Close preset editor">×</button></div><div class="rule-trigger">When <strong>${esc(o.label)} = ${esc(c.label)}</strong><span>use these requirements</span></div><details class="rule-conditions" ${conditions.length?'open':''}><summary>Additional conditions <span>${conditions.length?conditions.length+' selected':'optional'}</span></summary><p class="small muted space">Match every selected group; any checked choice within a group is accepted.</p><div class="rule-condition-grid">${optionCatalog.filter(x=>x.id!==d.optionId).map(field=>`<fieldset><legend>${esc(field.label)}</legend>${field.choices.map(choice=>`<label class="check"><input type="checkbox" data-rule-condition="${esc(field.id)}" value="${esc(choice.value)}" ${(r.conditions[field.id]||[]).includes(choice.value)?'checked':''}>${esc(choice.label)}</label>`).join('')}</fieldset>`).join('')}</div></details><section class="rule-editor-section"><div class="rule-section-heading"><h4>Materials</h4><button type="button" data-rule-add="materials">+ Material</button></div>${r.materials.length?'<div class="rule-material-row rule-column-labels"><span>Item</span><span>Quantity</span><span>Basis</span><span></span></div>'+ruleMaterialRows():'<p class="rule-empty">No material requirements.</p>'}</section><section class="rule-editor-section"><div class="rule-section-heading"><h4>Labour</h4><button type="button" data-rule-add="labour">+ Trade</button></div>${r.labour.length?'<div class="rule-labour-row rule-column-labels"><span>Trade / crew</span><span>Hours</span><span></span></div>'+ruleLabourRows():'<p class="rule-empty">No labour requirements.</p>'}</section><section class="rule-editor-section"><div class="rule-section-heading"><h4>Tasks</h4><button type="button" data-rule-add="tasks">+ Task</button></div>${r.tasks.length?'<div class="rule-task-row rule-column-labels"><span>Task</span><span>Owner</span><span>Days</span><span>Offset</span><span></span></div>'+ruleTaskRows():'<p class="rule-empty">No generated tasks.</p>'}<p class="small muted space">Offsets are days from delivery: −7 = one week before, +2 = two days after.</p></section><section class="rule-editor-section"><div class="rule-section-heading"><h4>Pricing${d.optionId==='siding'?' · full coverage':''}</h4></div><div class="fields"><label>Selling price (CAD)<input type="number" min="0" step="0.01" value="${r.price}" data-rule-price></label><label>Internal cost (CAD)<input type="number" min="0" step="0.01" value="${r.cost}" data-rule-cost></label></div><label class="check space"><input type="checkbox" data-rule-price-pending ${r.pricePending?'checked':''}>Price to be quoted separately</label><label class="check space"><input type="checkbox" data-rule-no-needs ${r.explicitNoNeeds?'checked':''}>Included with no additional requirements</label></section><p id="tb2-dialog-error" class="small space" role="alert"></p><div class="actions rule-editor-actions"><span class="small muted">Saved for draft and new work</span><button type="button" data-action="close-dialog">Cancel</button><button type="button" class="primary" data-rule-save>Save preset</button></div></div>`;
}
function collectRuleEditor(){
  const r=ruleEditDraft;
  r.materials=[...modal.querySelectorAll('[data-rule-material]')].map(el=>({itemId:el.querySelector('[data-rule-material-item]').value,quantity:Number(el.querySelector('[data-rule-material-qty]').value),basis:el.querySelector('[data-rule-material-basis]').value}));
  r.labour=[...modal.querySelectorAll('[data-rule-labour]')].map(el=>({trade:el.querySelector('[data-rule-labour-trade]').value,hours:Number(el.querySelector('[data-rule-labour-hours]').value)}));
  r.tasks=[...modal.querySelectorAll('[data-rule-task]')].map(el=>({title:el.querySelector('[data-rule-task-title]').value.trim(),owner:el.querySelector('[data-rule-task-owner]').value,days:Number(el.querySelector('[data-rule-task-days]').value),offset:Number(el.querySelector('[data-rule-task-offset]').value)}));
  r.price=Number(modal.querySelector('[data-rule-price]').value);r.cost=Number(modal.querySelector('[data-rule-cost]').value);r.pricePending=modal.querySelector('[data-rule-price-pending]').checked;r.explicitNoNeeds=modal.querySelector('[data-rule-no-needs]').checked;
  r.conditions={};modal.querySelectorAll('[data-rule-condition]:checked').forEach(el=>(r.conditions[el.dataset.ruleCondition]||=[]).push(el.value));
  return r;
}
function saveOptionRule(){
  if(state.dialog?.kind!=='option-rule')return;
  const r=collectRuleEditor(),d=state.dialog;
  if(r.materials.some(m=>!items.some(i=>i.id===m.itemId)||!Number.isFinite(m.quantity)||m.quantity<=0)){error('Each material needs a valid item and a quantity greater than zero.');return;}
  if(r.labour.some(l=>!l.trade||!Number.isFinite(l.hours)||l.hours<=0)){error('Each trade needs hours greater than zero.');return;}
  if(r.tasks.some(t=>!t.title||!t.owner||!Number.isInteger(t.days)||t.days<1||!Number.isInteger(t.offset))){error('Each task needs a title, owner, whole-day duration and whole-day offset.');return;}
  if(!Number.isFinite(r.price)||r.price<0||!Number.isFinite(r.cost)||r.cost<0){error('Price and cost must be zero or greater.');return;}
  if(!r.materials.length&&!r.labour.length&&!r.tasks.length&&!r.price&&!r.cost&&!r.explicitNoNeeds&&!r.pricePending){error('Add requirements or mark this choice as included with no additional requirements.');return;}
  if(r.explicitNoNeeds&&(r.materials.length||r.labour.length||r.tasks.length||r.price||r.cost)){error('Remove the requirements and extra price/cost, or uncheck “Included with no additional requirements”.');return;}
  r.revision=(getOptionRule(d.optionId,d.value,d.variant)?.revision||0)+1;
  optionRules[optionRuleKey(d.optionId,d.value,d.variant)]=ruleClone(r);
  closeDialog(false);render();announce('Preset saved. Draft quotes updated; confirmed work keeps its saved version.');save();
  const returnButton=[...root.querySelectorAll('[data-rule-option]')].find(b=>b.dataset.ruleOption===d.optionId&&b.dataset.ruleValue===d.value)||root.querySelector('[data-rule-filter]');returnButton?.focus();
}
root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const ds=b.dataset;
  if(ds.ruleOption){openRuleEditor(ds.ruleOption,ds.ruleValue);return;}
  if(ds.ruleFilter){state.presetFilter=ds.ruleFilter;render();return;}
  if(state.dialog?.kind!=='option-rule')return;
  if('ruleSave' in ds){saveOptionRule();return;}
  if(ds.ruleAdd||ds.ruleRemove){
    const dialog=modal.querySelector('.rule-dialog'),scroll=dialog.scrollTop;collectRuleEditor();
    if(ds.ruleRemove)ruleEditDraft[ds.ruleRemove].splice(Number(ds.ruleIndex),1);
    if(ds.ruleAdd==='materials')ruleEditDraft.materials.push({itemId:items[0].id,quantity:1,basis:state.dialog.optionId==='siding'?'coverage':'fixed'});
    if(ds.ruleAdd==='labour')ruleEditDraft.labour.push({trade:'Build crew',hours:1});
    if(ds.ruleAdd==='tasks')ruleEditDraft.tasks.push({title:'',owner:'PM',days:1,offset:0});
    if(ds.ruleAdd)ruleEditDraft.explicitNoNeeds=false;
    renderRuleEditor();modal.querySelector('.rule-dialog').scrollTop=scroll;
  }
});
