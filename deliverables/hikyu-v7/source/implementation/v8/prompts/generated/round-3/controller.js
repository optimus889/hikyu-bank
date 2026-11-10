(function () {
  'use strict';
  if (window.__hikyuV8Controller) { window.__hikyuV8Controller.mount(document); return; }
  const roots = new WeakMap();
  const state = root => { if (!roots.has(root)) roots.set(root, {posts:0, generation:0, sequence:0, controller:null}); return roots.get(root); };
  function feedback(node, message, kind) {
    if (!node) return;
    node.textContent = message;
    node.dataset.feedbackKind = kind || 'info';
    node.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    node.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  }
  function announce(root, message, kind, token) {
    if (token !== undefined && token !== state(root).sequence) return;
    feedback(root.querySelector('[data-page-feedback]'), message, kind);
  }
  function count(form) {
    const input = form.elements.namedItem('description');
    const output = form.querySelector('[data-description-counter]');
    if (input && output) output.textContent = input.value.trim().length + ' / 2000 characters after trimming';
  }
  function filter(root) {
    if (root.dataset.v8Root !== 'sync') return;
    const selected = root.querySelector('[data-sync-filter]')?.value || '';
    const query = (root.querySelector('[data-case-search]')?.value || '').trim().toLowerCase();
    const cards = Array.from(root.querySelectorAll('.v7-sync'));
    const counts = new Map(); let shown = 0;
    cards.forEach(card => {
      const value = card.dataset.syncState || 'UNKNOWN';
      counts.set(value, (counts.get(value) || 0) + 1);
      const visible = (!selected || selected === value) && (!query || (card.dataset.caseId || '').toLowerCase().includes(query));
      card.hidden = !visible; if (visible) shown++;
    });
    const summary = root.querySelector('[data-status-summary]');
    if (summary) {
      summary.replaceChildren();
      Array.from(counts).sort((a,b) => a[0].localeCompare(b[0])).forEach(([key,total]) => {
        const node = document.createElement('span'); node.textContent = key + ': ' + total; summary.append(node);
      });
      if (!cards.length) summary.textContent = 'No authorized records loaded.';
    }
    const total = root.querySelector('[data-loaded-count]'); if (total) total.textContent = String(cards.length);
    const status = root.querySelector('[data-filter-result]'); if (status) status.textContent = shown + ' of ' + cards.length + ' loaded records shown.';
    const empty = root.querySelector('[data-empty-filter]'); if (empty) empty.hidden = shown !== 0;
  }
  function mount(scope) {
    scope.querySelectorAll('.hikyu-v8 form[data-v8-action], form[data-v8-action]').forEach(form => { form.noValidate = true; count(form); });
    scope.querySelectorAll('[data-v8-root="sync"]').forEach(filter);
    if (scope.matches?.('[data-v8-root="sync"]')) filter(scope);
  }
  function validate(form) {
    form.querySelectorAll('[data-field-error]').forEach(node => { node.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid'));
    if (form.dataset.v8Action !== 'submit_draft') return true;
    const transaction = form.elements.namedItem('transaction_id');
    const description = form.elements.namedItem('description'); const errors = [];
    if (!transaction?.value || !/^\d+$/.test(transaction.value)) errors.push([transaction,'transaction_id','Choose one of your transactions.']);
    const length = description?.value.trim().length || 0;
    if (length < 3) errors.push([description,'description','Enter a description with at least 3 characters after trimming.']);
    else if (length > 2000) errors.push([description,'description','Shorten the description to 2000 characters or fewer after trimming.']);
    errors.forEach(([input,key,message]) => {
      if (input) input.setAttribute('aria-invalid','true');
      const node = form.querySelector('[data-field-error="' + key + '"]'); if (node) node.textContent = message;
    });
    if (errors.length) { feedback(form.querySelector('[data-form-feedback]'),'Please correct the highlighted fields.','error'); errors[0][0]?.focus(); return false; }
    return true;
  }
  function refreshButtons(root) { const s=state(root); root.querySelectorAll('[data-v8-refresh]').forEach(b => { b.disabled = s.posts > 0 || !!s.controller; }); }
  function cancelRefresh(root) { const s=state(root); s.generation++; if(s.controller) s.controller.abort(); s.controller=null; refreshButtons(root); }
  async function freshRoot(root, signal) {
    const response = await fetch(location.pathname + location.search, {credentials:'same-origin',cache:'no-store',headers:{Accept:'text/html'},signal});
    if (!response.ok) throw new Error('The latest view could not be loaded. Refresh again when the connection is available.');
    const html = new DOMParser().parseFromString(await response.text(),'text/html');
    const result = Array.from(html.querySelectorAll('[data-v8-root]')).find(node => node.dataset.v8Root === root.dataset.v8Root);
    if (!result) throw new Error('The authenticated view is unavailable. Check your session and refresh.');
    return result;
  }
  function errorMessage(status, data) {
    if (status === 401) return 'Your session is no longer authorized. Sign in again; your input is kept here.';
    if (status === 403) return 'This operation is not authorized for your account, transaction, or session. Your input is kept.';
    if (status === 409) return 'This record has changed or the operation is no longer available. Your input is kept; refresh the latest state before retrying.';
    const detail = typeof data?.error === 'object' ? data.error.message : data?.error;
    if (typeof detail === 'string' && status >= 400 && status < 500) return detail;
    return 'The server could not confirm this operation. Your input is kept. Check the latest state before retrying.';
  }
  async function submit(form) {
    const root=form.closest('[data-v8-root]'); if (!root || form.dataset.busy === 'true' || form.dataset.committed === 'true') return;
    if (!validate(form)) return;
    const payload=new URLSearchParams(new FormData(form));
    const s=state(root), token=++s.sequence; cancelRefresh(root); s.posts++; refreshButtons(root);
    form.dataset.busy='true'; form.setAttribute('aria-busy','true');
    const controls=Array.from(form.elements).map(el => [el,el.disabled]); controls.forEach(([el]) => {el.disabled=true;});
    const button=form.querySelector('[type=submit]'), label=button?.textContent;
    if(button) button.textContent='Processing…';
    feedback(form.querySelector('[data-form-feedback]'),'Processing your request. Please wait.','info');
    const controller=new AbortController(), timeout=setTimeout(() => controller.abort(),15000);
    try {
      const response=await fetch(form.action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:payload,signal:controller.signal});
      if(response.redirected)throw new Error('The action was not accepted. Your session or form token may have expired. Your input is kept; sign in or refresh before retrying.');
      let data; try { data=await response.json(); } catch { throw new Error('The server response could not be confirmed. Your input is kept. Check your session and refresh the latest state.'); }
      if(!response.ok || data?.ok!==true) throw new Error(errorMessage(response.status,data));
      form.dataset.committed='true';
      const result=data.result||{},message='Operation confirmed: '+(result.draft_status||result.job_status||'Saved')+'.';
      try {
        const next=await freshRoot(root,controller.signal);
        const card=form.closest('.v7-draft,.v7-sync');
        const match=card && Array.from(next.querySelectorAll('.v7-draft,.v7-sync')).find(n => card.dataset.draftId ? n.dataset.draftId===card.dataset.draftId : n.dataset.caseId===card.dataset.caseId);
        if(card && match && Number(match.dataset.version||0)>=Number(card.dataset.version||0)) {
          const keepContext=document.activeElement===document.body||form.contains(document.activeElement);
          card.replaceWith(match);mount(match);
          if(keepContext){const editable=match.querySelector('select:not([disabled]),textarea:not([disabled]):not([readonly]),input:not([type=hidden]):not([disabled])');const heading=match.querySelector('h2,h3');if(editable)editable.focus();else if(heading){heading.tabIndex=-1;heading.focus();}}
        }
        filter(root); announce(root,message,'success',token);
      } catch { announce(root,message+' The latest card could not be loaded. Refresh to check its persisted state.','info',token); }
    } catch(error) {
      const message=error.name==='AbortError'?'The request timed out before confirmation. Your input is kept; refresh the latest state before retrying.':error.message;
      feedback(form.querySelector('[data-form-feedback]'),message,'error');
    } finally {
      clearTimeout(timeout); form.dataset.busy='false'; form.removeAttribute('aria-busy');
      controls.forEach(([el,disabled]) => {el.disabled=disabled;});
      if(button) {button.textContent=label; if(form.dataset.committed==='true')button.disabled=true;}
      s.posts--; refreshButtons(root);
    }
  }
  async function refresh(root) {
    const focusAtStart=root.contains(document.activeElement)?document.activeElement.id:'';
    const s=state(root); if(s.posts>0) {announce(root,'Wait for the current operation before refreshing.','info');return;}
    cancelRefresh(root); const generation=s.generation,token=++s.sequence,controller=new AbortController();s.controller=controller;refreshButtons(root);
    announce(root,'Refreshing authorized records…','info',token);
    let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;controller.abort();},10000);
    try {
      const next=await freshRoot(root,controller.signal);
      if(generation!==s.generation || !root.isConnected) return;
      const oldFilter=root.querySelector('[data-sync-filter]')?.value||'',oldQuery=root.querySelector('[data-case-search]')?.value||'';
      const active=document.activeElement;const focused=root.contains(active)&&active.id?active.id:active===document.body?focusAtStart:'';
      const select=next.querySelector('[data-sync-filter]');
      if(select){if(oldFilter&&!Array.from(select.options).some(o=>o.value===oldFilter))select.add(new Option(oldFilter,oldFilter));select.value=oldFilter;}
      const query=next.querySelector('[data-case-search]');if(query)query.value=oldQuery;
      root.replaceWith(next);state(next).sequence=token;mount(next);announce(next,'Authorized records refreshed.','success',token);
      if(focused)document.getElementById(focused)?.focus();
    } catch(error) {if(error.name!=='AbortError')announce(root,error.message,'error',token);else if(timedOut)announce(root,'Refresh timed out. Existing records are kept; try refreshing again.','error',token);}
    finally {clearTimeout(timeout);if(s.controller===controller)s.controller=null;if(root.isConnected)refreshButtons(root);}
  }
  document.addEventListener('submit',event => {const form=event.target;if(!form.matches?.('.hikyu-v8 form[data-v8-action]'))return;event.preventDefault();event.stopPropagation();submit(form);},true);
  document.addEventListener('input',event => {const root=event.target.closest?.('[data-v8-root]');if(!root)return;const form=event.target.closest('form[data-v8-action]');if(form)count(form);if(event.target.matches('[data-case-search]'))filter(root);});
  document.addEventListener('change',event => {const root=event.target.closest?.('[data-v8-root]');if(root&&event.target.matches('[data-sync-filter]'))filter(root);});
  document.addEventListener('click',event => {const button=event.target.closest?.('[data-v8-refresh]');if(button)refresh(button.closest('[data-v8-root]'));});
  window.__hikyuV8Controller={mount};mount(document);
})();
