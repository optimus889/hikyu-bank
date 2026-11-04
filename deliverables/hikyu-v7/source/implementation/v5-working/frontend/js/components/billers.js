import { bankingAPI } from '../api/banking.js';
import { openDialog } from './dialog.js';
import { escape } from './ui.js';

/** View state only. All biller persistence uses the existing /payees API. */
export function mountBillers(section, select, { payees, catalog, onChange, onPending }) {
  let active = true, pending = false, dialog = null;
  section.innerHTML = `<div class="biller-heading"><h3 id="saved-billers-title">Saved billers</h3><button type="button" class="secondary-button" data-add-biller>Add biller</button></div><div class="saved-biller-list"></div><p class="biller-notice" role="status" aria-live="polite"></p>`;
  const add = section.querySelector('[data-add-biller]');
  const list = section.querySelector('.saved-biller-list');
  const notice = section.querySelector('.biller-notice');
  const billerName = code => catalog.find(b => b.code === code)?.name || 'Demo biller';
  function controls(value) {
    pending = value;
    section.querySelectorAll('button').forEach(b => b.disabled = value);
    onPending(value);
  }
  function paint(preferred = select.value) {
    const billers = payees.filter(p => p.kind === 'biller');
    list.innerHTML = billers.length ? `<ul>${billers.map(p => `<li><div><strong>${escape(p.alias)}</strong><small>${escape(billerName(p.identifier))} · ${escape(p.reference)}</small></div><div class="biller-actions"><button class="text-link" type="button" data-use-biller="${escape(p.id)}" aria-label="Select ${escape(p.alias)}">Select</button><button class="text-link" type="button" data-edit-biller="${escape(p.id)}" aria-label="Edit ${escape(p.alias)}">Edit</button><button class="text-link" type="button" data-delete-biller="${escape(p.id)}" aria-label="Delete ${escape(p.alias)}">Delete</button></div></li>`).join('')}</ul>` : '<p class="empty-state">No saved billers yet. Add a biller to get started.</p>';
    select.innerHTML = '<option value="">Select a biller</option>' + billers.map(p => `<option value="${escape(p.id)}">${escape(p.alias)} · ${escape(p.reference)}</option>`).join('');
    select.disabled = billers.length === 0;
    select.value = billers.some(p => p.id === preferred) ? preferred : '';
    onChange(payees);
    list.querySelectorAll('[data-use-biller]').forEach(b => b.onclick = () => {
      if (pending) return;
      select.value = b.dataset.useBiller;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.focus();
    });
    list.querySelectorAll('[data-edit-biller]').forEach(b => b.onclick = () => openBiller(payees.find(p => p.id === b.dataset.editBiller)));
    list.querySelectorAll('[data-delete-biller]').forEach(b => b.onclick = async () => {
      if (pending) return;
      const id = b.dataset.deleteBiller;
      controls(true);
      notice.textContent = 'Deleting biller…';
      try {
        await bankingAPI.deletePayee(id);
        if (!active) return;
        // A successful DELETE is authoritative even if the follow-up GET fails.
        payees = payees.filter(p => p.id !== id);
        let message = 'Biller deleted. Completed payment history is unchanged.';
        try { payees = await bankingAPI.payees(); }
        catch { message += ' The list could not be refreshed. Try again later.'; }
        if (!active) return;
        paint();
        notice.textContent = message;
        add.focus();
      } catch (error) {
        if (active) { notice.textContent = error.message; b.focus(); }
      } finally { if (active) controls(false); }
    });
    list.querySelectorAll('button').forEach(b => b.disabled = pending);
  }
  function openBiller(existing = null) {
    if (pending || !active) return;
    const opener = existing ? [...list.querySelectorAll('[data-edit-biller]')].find(b => b.dataset.editBiller === existing.id) : add;
    opener?.focus();
    dialog = openDialog(existing ? 'Edit biller' : 'Add biller', `<p id="biller-dialog-description" class="muted">Simulation only. Use a demo bill reference. No real money is moved.</p><form class="bank-form biller-form" novalidate><label>Biller selection<select name="biller" required ${existing ? 'disabled' : ''}><option value="">Select a biller</option>${catalog.map(b => `<option value="${escape(b.code)}">${escape(b.name)}</option>`).join('')}</select></label><label>Nickname (optional)<input name="alias" maxlength="60" placeholder="Defaults to the biller name"></label><label>Demo bill reference<input name="reference" maxlength="60" placeholder="demo-account-001" required></label><p class="form-status" role="alert" aria-live="polite"></p><div class="biller-dialog-actions"><button class="secondary-button" type="button" data-cancel-biller>Cancel</button><button class="primary-button" type="submit">Save biller</button></div></form>`);
    const ownedDialog = dialog;
    dialog.classList.add('biller-dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-describedby', 'biller-dialog-description');
    const form = dialog.querySelector('form'), status = form.querySelector('.form-status');
    const save = form.querySelector('[type=submit]'), cancel = form.querySelector('[data-cancel-biller]');
    if (existing) {
      form.elements.biller.value = existing.identifier;
      form.elements.alias.value = existing.alias;
      form.elements.reference.value = existing.reference;
    }
    if (!catalog.length && !existing) { save.disabled = true; status.textContent = 'No billers are available. Close this dialog and refresh Bill Pay.'; }
    cancel.onclick = () => ownedDialog.close();
    ownedDialog.addEventListener('cancel', event => { event.preventDefault(); if (!pending) ownedDialog.close(); });
    ownedDialog.addEventListener('close', () => { if (dialog === ownedDialog) dialog = null; });
    form.addEventListener('input', () => {
      status.textContent = '';
      form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
    });
    form.onsubmit = async event => {
      event.preventDefault();
      if (pending || !active || !ownedDialog.open) return;
      const identifier = form.elements.biller.value;
      const reference = form.elements.reference.value.trim();
      const selected = catalog.find(b => b.code === identifier);
      let invalid = !selected ? form.elements.biller : !reference || reference.length > 60 || !form.elements.reference.validity.valid ? form.elements.reference : form.elements.alias.value.trim().length > 60 || !form.elements.alias.validity.valid ? form.elements.alias : null;
      if (invalid) {
        status.textContent = invalid === form.elements.biller ? 'Choose a biller.' : invalid === form.elements.reference ? 'Enter a demo bill reference of up to 60 characters.' : 'Use at most 60 characters for the nickname.';
        invalid.setAttribute('aria-invalid', 'true');
        invalid.focus();
        return;
      }
      // The current API requires alias. An omitted nickname uses the catalog name.
      const input = { kind: 'biller', identifier, alias: form.elements.alias.value.trim() || selected.name.slice(0, 60), reference };
      controls(true);
      form.querySelectorAll('button,input,select').forEach(field => field.disabled = true);
      ownedDialog.querySelector('[data-close]').disabled = true;
      save.textContent = 'Saving…';
      status.textContent = 'Saving biller…';
      try {
        const saved = existing ? await bankingAPI.editPayee(existing.id, { alias: input.alias, reference }) : await bankingAPI.savePayee(input);
        if (!active) return;
        // Retain the server-returned UUID; never create client-side biller IDs.
        payees = [...payees.filter(p => p.id !== saved.id), saved];
        ownedDialog.close();
        paint(saved.id);
        // The dialog's opener was disabled during POST; restore a stable focus target.
        add.disabled = false;
        add.focus();
        notice.textContent = existing ? 'Biller updated.' : 'Biller saved and selected.';
        try {
          const refreshed = await bankingAPI.payees();
          if (!active) return;
          // Prefer GET data while retaining a confirmed save if the list is stale.
          payees = refreshed.some(p => p.id === saved.id) ? refreshed : [...refreshed, saved];
          paint(saved.id);
        } catch {
          if (active) notice.textContent += ' The list could not be refreshed. Your saved biller is selected; do not save it again.';
        }
      } catch (error) {
        if (active && ownedDialog.open) {
          status.textContent = error.message;
          form.querySelectorAll('button,input,select').forEach(field => field.disabled = false);
          form.elements.biller.disabled = !!existing;
          ownedDialog.querySelector('[data-close]').disabled = false;
          save.textContent = 'Save biller';
          save.focus();
        }
      } finally { if (active) controls(false); }
    };
    (existing ? form.elements.alias : form.elements.biller).focus();
  }
  add.onclick = () => openBiller();
  paint();
  return () => { active = false; dialog?.close(); };
}
