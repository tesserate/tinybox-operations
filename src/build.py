from pathlib import Path
from html import escape, unescape
import re, hashlib
ROOT=Path(__file__).resolve().parent.parent
src=ROOT/'src'
base=(src/'app-base.js').read_text()
app=base.replace('function openDialog(', 'function legacyOpenDialog(').replace('function saveDialog(', 'function legacySaveDialog(')
app=app.replace('presets:presetPage}', 'presets:presetPage,people:peoplePage}')
app=app.replace('Daily update','Update').replace('daily update','update').replace('Hours used today','Hours to record')
app=app.replace('<td>${esc(t.owner)}</td>', '<td>${esc(t.owner)}${peopleTags(t)}</td>')
app=app.replace("if(ds.openOrder){state.quoteId=ds.openOrder;state.quoteOpen=true;navigate('orders');}","if(ds.openOrder)openOrder(ds.openOrder);")
app=app.replace("if(a==='new-quote'){state.quoteId='Q-104';state.quoteOpen=true;render();}","if(a==='new-quote')openOrder('Q-104');")
parts=['preset-rules','quote-stock','timeline-shell','people','order-edit','task-list','inventory-ledger']
extensions='\n'.join((src/(p+'.js')).read_text() for p in parts)
marker="root.addEventListener('click'"
assert app.count(marker)==1
app=app.replace(marker,extensions+'\n'+marker,1)
frame=(src/'frame-base.html').read_text()
assert frame.count(base)==1
frame=frame.replace(base,app,1)
frame=frame.replace('</nav>', '<button type="button" data-nav="people" aria-pressed="false">People</button></nav>',1)
css='\n'.join((src/(p+'.css')).read_text() for p in parts)
frame=frame.replace('</body>','<style>\n'+css+'\n</style>\n</body>',1)
frame=frame.replace('App &amp; forms','Workspace').replace('App & forms','Workspace').replace('Six core tables</button>','Data model</button>')
outer=(src/'wrapper-original.html').read_text()
# Use the desktop width for the operations workspace while retaining isolation.
outer=outer.replace('max-width:736px;height:calc(100vh - 2rem)', 'max-width:1200px;height:calc(100vh - 2rem)',1)
match=re.search(r'data-srcdoc="([^"]*)"',outer)
assert match and 'id="codex-visualization"' in outer
result=outer[:match.start(1)]+escape(frame,quote=True)+outer[match.end(1):]
result=result.replace('</body>', '<script>'+ (src/'viewport-host.js').read_text() +'</script></body>', 1)
# Isolation policies are part of the artifact contract.
def policies(s): return re.findall(r'<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>',s)
assert policies(outer)==policies(result)
assert policies((src/'frame-base.html').read_text())==policies(frame)
assert re.search(r'<iframe[^>]*sandbox="([^"]*)"',result).group(1)=='allow-scripts'
assert unescape(re.search(r'data-srcdoc="([^"]*)"',result).group(1))==frame
(ROOT/'dist').mkdir(exist_ok=True)
(ROOT/'dist/index.html').write_text(result)
(src/'app-built.js').write_text(app)
(src/'frame-built.html').write_text(frame)
print('Built dist/index.html:',len(result.encode()),'bytes; sandbox and both CSPs unchanged')
print('SHA256',hashlib.sha256(result.encode()).hexdigest())
