(()=>{
 const frame=document.getElementById('codex-visualization');
 const send=()=>{const r=frame.getBoundingClientRect();frame.contentWindow?.postMessage({type:'tinybox:viewport',top:Math.max(0,-r.top),bottom:Math.min(r.height,innerHeight-r.top)},'*');};
 addEventListener('message',e=>{if(e.source===frame.contentWindow&&e.data?.type==='tinybox:viewport-request')send();});
 addEventListener('scroll',send,{passive:true});addEventListener('resize',send);frame.addEventListener('load',send);send();
})();
