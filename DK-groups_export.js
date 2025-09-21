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
  // -> Nově: řádek je vesnice pouze pokud v první buňce NAJDEME SOUŘADNICE.
  const villageRows = rawRows.filter(r => {
    const c = r.querySelector(sel.name);
    if (!c) return false;
    const txt = norm(c.textContent||'');
    return /\(\d{2,3}\|\d{2,3}\)/.test(txt); // vyžaduj (x|y)
  });

  const all = [];
  const listDEFF = [];
  const listOFF  = [];
  const fmtLine = v => `• [coord]${v.coords.x}|${v.coords.y}[/coord] — ${v.name} — [url=${v.send_link}]Send[/url]`;
  const keyOf = v => v.village_id || `${v.coords.x}|${v.coords.y}`;

  for (const row of villageRows) {
    const nameCell = row.querySelector(sel.name);
    const groupsCell = row.querySelector(sel.groups);

    const nameText = norm(nameCell?.textContent || '');
    const coords   = parseCoords(nameText);
    if (!coords) continue; // ochrana: bez souřadnic NENÍ vesnice

    const village_id = getVillageIdFromHref(nameCell || row) || row.getAttribute('data-id') || null;
    const nameOnly = nameText.replace(/\s*\(\d{2,3}\|\d{2,3}\)\s*K\d{2}\s*$/,'').trim();
    const send_link = (village_id) ? `game.php?village=${village_id}&screen=place&x=${coords.x}&y=${coords.y}` : null;

    const tokens = norm(groupsCell?.textContent || '').split(';').map(t=>norm(t)).filter(Boolean);
    const hasDEFF = tokens.includes('DEFF');
    const hasOFF  = tokens.includes('OFF');

    const vObj = {name:nameOnly, coords, village_id, send_link, hasDEFF, hasOFF};
    all.push(vObj);
    if (hasDEFF) listDEFF.push(vObj);
    if (hasOFF)  listOFF.push(vObj);
  }

  const totalVillages = all.length;
  const markedMap = new Map();
  [...listDEFF, ...listOFF].forEach(v => { const k = keyOf(v); if (!markedMap.has(k)) markedMap.set(k, v); });
  const unmarked = all.filter(v => !markedMap.has(keyOf(v)));
  const unmarkedCount = unmarked.length;

  // ===== 2) BBCode pro filtry =====
  const bbALL  = [`[b]VŠE[/b] [i]${totalVillages}[/i]`, ...all.map(fmtLine)].join('\n');
  const bbDEFF = [`[b]DEFF (exact)[/b] [i]${listDEFF.length}[/i]`, ...listDEFF.map(fmtLine)].join('\n');
  const bbOFF  = [`[b]OFF (exact)[/b]  [i]${listOFF.length}[/i]`,  ...listOFF.map(fmtLine)].join('\n');
  const bbMISS = [`[b]NEOZNAČENÉ[/b] [i]${unmarkedCount}[/i]`,     ...unmarked.map(fmtLine)].join('\n');

  // ===== 3) POPUP =====
  const OLD = document.getElementById('dk-groups-popup'); if (OLD) OLD.remove();
  const wrap = document.createElement('div');
  wrap.id = 'dk-groups-popup';
  wrap.innerHTML = `
  <div class="dkg-backdrop"></div>
  <div class="dkg-modal">
    <div class="dkg-header">
      <strong>Skupiny export (DEFF/OFF)</strong>
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
      <span>Řádků v exportu: <b class="dkg-count"></b> <i style="color:#888">(počítají se jen odrážky „•“)</i></span>
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
  const countBullets = txt => txt.split('\n').filter(l => /^\s*•\s/.test(l)).length;

  const fill = (mode) => {
    let txt = bbALL;
    if (mode === 'deff') txt = bbDEFF;
    else if (mode === 'off') txt = bbOFF;
    else if (mode === 'miss') txt = bbMISS;
    ta.value = txt;
    cnt.textContent = String(countBullets(txt));
  };
  fill('all');

  wrap.querySelectorAll('input[name="dkout"]').forEach(r => r.addEventListener('change', e => fill(e.target.value)));

  wrap.querySelector('.dkg-copy').addEventListener('click', async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(ta.value);
      else { ta.select(); document.execCommand('copy'); ta.setSelectionRange(0,0); }
      const btn = wrap.querySelector('.dkg-copy'); const old = btn.textContent;
      btn.textContent = 'Zkopírováno ✓'; setTimeout(()=>btn.textContent=old, 1200);
    } catch {
      alert('Nepodařilo se zkopírovat. Zkopíruj ručně (Ctrl+C).');
    }
  });

  wrap.querySelector('.dkg-close').onclick = () => wrap.remove();
  wrap.querySelector('.dkg-backdrop').onclick = () => wrap.remove();
})();
