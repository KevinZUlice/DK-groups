(() => {
  // ===== 0) AUTONAVIGACE =====
  const usp = new URLSearchParams(location.search);
  const onTarget =
    usp.get('screen') === 'overview_villages' &&
    usp.get('type')   === 'static' &&
    usp.get('mode')   === 'groups' &&
    (usp.get('group') === '0' || usp.get('group') === null);
  if (!onTarget) {
    const base = location.origin + location.pathname.replace(/\/+$/, '');
    const village = usp.get('village');
    const p = new URLSearchParams({screen:'overview_villages', type:'static', mode:'groups', group:'0'});
    if (village) p.set('village', village);
    alert('Přesměrovávám na Náhledy → Skupiny → Všechno…\nPo načtení spusť skript znovu.');
    location.href = `${base}?${p.toString()}`;
    return;
  }

  // ===== 1) PARSE (jen skutečné vesnice – musí mít souřadnice) =====
  const sel = { rows:'table.vis tbody tr', name:'td:nth-child(1)', groups:'td:nth-child(5)' };
  const norm = s => (s||'').replace(/\s+/g,' ').trim();
  const parseCoords = t => { const m=t.match(/\((\d{2,3})\|(\d{2,3})\)/); return m?{x:+m[1],y:+m[2]}:null; };
  const getVillageIdFromHref = (el) => {
    const a = el.querySelector('a[href*="screen=info_village"]') || el.querySelector('a[href*="village="]');
    if (!a) return null;
    const href = a.getAttribute('href')||'';
    const m = href.match(/(?:[?&])village=(\d+)/) || href.match(/(?:[?&])id=(\d+)/);
    return m ? m[1] : null;
  };

  const rawRows = Array.from(document.querySelectorAll(sel.rows));
  const villageRows = rawRows.filter(r => {
    const c = r.querySelector(sel.name);
    if (!c) return false;
    const txt = norm(c.textContent||'');
    return /\(\d{2,3}\|\d{2,3}\)/.test(txt); // vyžaduj (x|y)
  });

  const all = [];
  const listDEFF = [];
  const listOFF  = [];
  const keyOf = v => v.village_id || `${v.coords.x}|${v.coords.y}`;

  const toLine = (v) => {
    const groupsStr = (v.groups && v.groups.length) ? ` — ${v.groups.join(', ')}` : '';
    return `${v.coords.x}|${v.coords.y} — ${v.name} — [url=${v.send_link}]Send[/url]${groupsStr}`;
  };

  for (const row of villageRows) {
    const nameCell = row.querySelector(sel.name);
    const groupsCell = row.querySelector(sel.groups);

    const nameText = norm(nameCell?.textContent || '');
    const coords   = parseCoords(nameText);
    if (!coords) continue;

    const village_id = getVillageIdFromHref(nameCell || row) || row.getAttribute('data-id') || null;
    const nameOnly = nameText.replace(/\s*\(\d{2,3}\|\d{2,3}\)\s*K\d{2}\s*$/,'').trim();
    const send_link = (village_id) ? `game.php?village=${village_id}&screen=place&x=${coords.x}&y=${coords.y}` : `game.php?screen=place&x=${coords.x}&y=${coords.y}`;

    // Seber všechny štítky skupin (např. "DEFF", "OFF", "Nebezpečí", …)
    const groups = norm(groupsCell?.textContent || '')
      .split(';')
      .map(t => norm(t))
      .filter(Boolean);

    const hasDEFF = groups.includes('DEFF');
    const hasOFF  = groups.includes('OFF');

    const vObj = {name:nameOnly, coords, village_id, send_link, groups, hasDEFF, hasOFF};
    all.push(vObj);
    if (hasDEFF) listDEFF.push(vObj);
    if (hasOFF)  listOFF.push(vObj);
  }

  const totalVillages = all.length;
  const markedMap = new Map();
  [...listDEFF, ...listOFF].forEach(v => { const k = keyOf(v); if (!markedMap.has(k)) markedMap.set(k, v); });
  const unmarked = all.filter(v => !markedMap.has(keyOf(v)));
  const unmarkedCount = unmarked.length;

  // ===== 2) TEXTY PRO FILTRY (čisté řádky bez hlaviček/bulletů) =====
  const txtALL  = all.map(toLine).join('\n');
  const txtDEFF = listDEFF.map(toLine).join('\n');
  const txtOFF  = listOFF.map(toLine).join('\n');
  const txtMISS = unmarked.map(toLine).join('\n');

  // ===== 3) POPUP =====
  const OLD = document.getElementById('dk-groups-popup'); if (OLD) OLD.remove();
  const wrap = document.createElement('div');
  wrap.id = 'dk-groups-popup';
  wrap.innerHTML = `
  <div class="dkg-backdrop"></div>
  <div class="dkg-modal">
    <div class="dkg-header">
      <strong>Skupiny export (DEFF/OFF/Nebezpečí)</strong>
      <button class="dkg-close" title="Zavřít">×</button>
    </div>

    <div class="dkg-summary">
      <span class="badge all">Vesnice: <b>${totalVillages}</b></span>
      <span class="badge miss">Neoznačené: <b>${unmarkedCount}</b></span>
      <span class="badge deff">DEFF: <b>${listDEFF.length}</b></span>
      <span class="badge off">OFF: <b>${listOFF.length}</b></span>
    </div>

    <div class="dkg-toolbar">
      <label><input type="radio" name="dkout" value="all" checked> Vše</label>
      <label><input type="radio" name="dkout" value="deff"> Jen DEFF</label>
      <label><input type="radio" name="dkout" value="off"> Jen OFF</label>
      <label><input type="radio" name="dkout" value="miss"> Jen Neoznačené</label>
      <button class="dkg-copy">Zkopírovat</button>
    </div>

    <textarea class="dkg-ta" spellcheck="false"></textarea>
    <div class="dkg-footer">
      <span>Řádků v exportu: <b class="dkg-count"></b></span>
    </div>
  </div>`;
  document.body.appendChild(wrap);

  const style = document.createElement('style');
  style.textContent = `
  #dk-groups-popup{position:fixed;inset:0;z-index:999999}
  .dkg-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.35)}
  .dkg-modal{position:absolute;top:6%;left:50%;transform:translateX(-50%);width:min(900px,92vw);height:80vh;background:#fff;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.4);display:flex;flex-direction:column;font:14px/1.3 Arial,sans-serif}
  .dkg-header{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #eee}
  .dkg-close{background:#eee;border:0;border-radius:8px;padding:2px 10px;cursor:pointer;font-size:18px}
  .dkg-summary{display:flex;gap:10px;align-items:center;padding:8px 12px;border-bottom:1px solid #f0f0f0;flex-wrap:wrap}
  .badge{background:#f5f5f5;border:1px solid #e5e5e5;border-radius:999px;padding:4px 10px;color:#333}
  .badge.deff{background:#e9f8ef;border-color:#cdebd8}.badge.off{background:#e9f1fb;border-color:#cddaf6}.badge.miss{background:#fdecec;border-color:#fac9c9}
  .dkg-toolbar{display:flex;gap:14px;align-items:center;padding:8px 12px;border-bottom:1px solid #f0f0f0}
  .dkg-toolbar label{display:flex;align-items:center;gap:6px;cursor:pointer}
  .dkg-copy{margin-left:auto;padding:6px 12px;border:0;border-radius:8px;cursor:pointer;background:#2d7;color:#fff;font-weight:600}
  .dkg-ta{flex:1;margin:12px;resize:none;border:1px solid #ddd;border-radius:8px;padding:10px;white-space:pre;font-family:Consolas,monospace}
  .dkg-footer{padding:6px 12px;border-top:1px solid #eee;color:#666}
  `;
  document.head.appendChild(style);

  // ===== 4) Naplnění + počítadlo =====
  const ta  = wrap.querySelector('.dkg-ta');
  const cnt = wrap.querySelector('.dkg-count');
  const countLines = txt => txt.split('\n').filter(l => l.trim().length>0).length;

  const fill = (mode) => {
    let txt = txtALL;
    if (mode === 'deff') txt = txtDEFF;
    else if (mode === 'off') txt = txtOFF;
    else if (mode === 'miss') txt = txtMISS;
    ta.value = txt;
    cnt.textContent = String(countLines(txt));
  };
  fill('all');

  wrap.querySelectorAll('input[name="dkout"]').forEach(r => r.addEventListener('change', e => fill(e.target.value)));

  wrap.querySelector('.dkg-copy').addEventListener('click', async () => {
  const text = ta.value; // prostý text, každá vesnice na novém řádku
  const btn = wrap.querySelector('.dkg-copy');
  const old = btn.textContent;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      // primární cesta – vloží čistý text do schránky
      await navigator.clipboard.writeText(text);
    } else {
      // fallback – dočasné textarea, select + copy
      const tmp = document.createElement('textarea');
      tmp.value = text;
      tmp.setAttribute('readonly', '');
      tmp.style.position = 'fixed';
      tmp.style.opacity = '0';
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
    }
    btn.textContent = 'Zkopírováno ✓';
    setTimeout(() => (btn.textContent = old), 1200);
  } catch (err) {
    alert('Nepodařilo se zkopírovat. Zkopíruj ručně (Ctrl+C).');
  }
});


  wrap.querySelector('.dkg-close').onclick = () => wrap.remove();
  wrap.querySelector('.dkg-backdrop').onclick = () => wrap.remove();
})();
