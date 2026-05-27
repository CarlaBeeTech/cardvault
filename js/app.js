/* ============================
   CARDVAULT — app.js
   CMB Enterprise Group LLC
   ============================ */

'use strict';

// ---- STATE ----
let contacts = [];
let currentContactId = null;
let stream = null;
let editMode = false;

// ---- STORAGE ----
const STORAGE_KEY = 'cardvault_contacts';

function saveContacts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

function loadContacts() {
  try {
    contacts = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    contacts = [];
  }
}

// ---- UTILITIES ----
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), duration);
}

// ---- TABS ----
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
      v.classList.add('hidden');
    });
    tab.classList.add('active');
    const viewEl = document.getElementById('view-' + tab.dataset.tab);
    viewEl.classList.remove('hidden');
    viewEl.classList.add('active');

    if (tab.dataset.tab === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }
    if (tab.dataset.tab === 'contacts') {
      renderContacts();
    }
  });
});

// ---- CAMERA ----
async function startCamera() {
  const video = document.getElementById('cameraFeed');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
  } catch (err) {
    showToast('Camera not available — use Upload instead.');
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

// ---- CAPTURE ----
document.getElementById('captureBtn').addEventListener('click', () => {
  const video = document.getElementById('cameraFeed');
  const canvas = document.getElementById('captureCanvas');
  if (!stream || !video.videoWidth) {
    showToast('Camera not ready.');
    return;
  }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  processCardImage(dataUrl);
});

// ---- UPLOAD ----
document.getElementById('uploadBtn').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => processCardImage(ev.target.result);
  reader.readAsDataURL(file);
  e.target.value = '';
});

// ---- OCR PIPELINE ----
async function processCardImage(dataUrl) {
  const preview = document.getElementById('previewSection');
  const img = document.getElementById('previewImg');
  const indicator = document.getElementById('processingIndicator');
  const form = document.getElementById('extractedForm');

  preview.classList.remove('hidden');
  img.src = dataUrl;
  indicator.classList.remove('hidden');
  form.classList.add('hidden');

  try {
    const result = await Tesseract.recognize(dataUrl, 'eng', {
      logger: () => {}
    });

    const rawText = result.data.text;
    const extracted = parseCardText(rawText);
    indicator.classList.add('hidden');
    renderExtractedForm(form, extracted, dataUrl);
    form.classList.remove('hidden');
  } catch (err) {
    indicator.classList.add('hidden');
    showToast('OCR failed — please fill in manually.');
    renderExtractedForm(form, {}, dataUrl);
    form.classList.remove('hidden');
  }
}

// ---- PARSE CARD TEXT ----
function parseCardText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = { name: '', title: '', company: '', email: '', phone: '', website: '', address: '', notes: '', type: 'paper' };

  const emailRx = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
  const phoneRx = /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
  const urlRx   = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}(?:\/\S*)?/i;
  const titleKws = ['ceo','cto','cfo','coo','vp','president','director','manager','developer','designer','founder','owner','consultant','engineer','analyst','coordinator','specialist','associate','executive','officer','partner','principal'];

  const addressRx = /\d{2,5}\s+[A-Za-z\s]+(St|Ave|Blvd|Dr|Rd|Ln|Way|Ct|Pl|Suite|Ste)\b/i;

  let usedLines = new Set();

  // Email
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(emailRx);
    if (m) { result.email = m[0]; usedLines.add(i); break; }
  }

  // Phone
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const m = lines[i].match(phoneRx);
    if (m) { result.phone = m[0].trim(); usedLines.add(i); break; }
  }

  // Website
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const m = lines[i].match(urlRx);
    if (m && !lines[i].includes('@')) {
      result.website = m[0].startsWith('http') ? m[0] : 'https://' + m[0];
      usedLines.add(i);
      break;
    }
  }

  // Address
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    if (lines[i].match(addressRx)) {
      result.address = lines[i];
      usedLines.add(i);
      break;
    }
  }

  // Title / Company from keyword matching
  for (let i = 0; i < lines.length; i++) {
    if (usedLines.has(i)) continue;
    const lower = lines[i].toLowerCase();
    if (titleKws.some(kw => lower.includes(kw))) {
      result.title = lines[i];
      usedLines.add(i);
      break;
    }
  }

  // Remaining lines — first unused is likely name, second is company
  const remaining = lines.filter((_, i) => !usedLines.has(i));
  if (remaining.length > 0 && !result.name) result.name = remaining[0];
  if (remaining.length > 1 && !result.company) result.company = remaining[1];

  return result;
}

// ---- RENDER EXTRACTED FORM ----
function renderExtractedForm(container, data, imageData) {
  container.innerHTML = `
    <div class="section-label" style="margin-top:4px">Review & Edit</div>
    <div class="form-group"><label>Full Name *</label><input type="text" id="e_name" value="${esc(data.name)}" placeholder="Jane Smith" /></div>
    <div class="form-group"><label>Job Title</label><input type="text" id="e_title" value="${esc(data.title)}" placeholder="Marketing Director" /></div>
    <div class="form-group"><label>Company</label><input type="text" id="e_company" value="${esc(data.company)}" placeholder="Acme Corp" /></div>
    <div class="form-group"><label>Email</label><input type="email" id="e_email" value="${esc(data.email)}" placeholder="jane@acme.com" /></div>
    <div class="form-group"><label>Phone</label><input type="tel" id="e_phone" value="${esc(data.phone)}" placeholder="(816) 555-0100" /></div>
    <div class="form-group"><label>Website</label><input type="url" id="e_website" value="${esc(data.website)}" placeholder="https://acme.com" /></div>
    <div class="form-group"><label>Address</label><input type="text" id="e_address" value="${esc(data.address)}" placeholder="123 Main St" /></div>
    <div class="form-group"><label>Notes</label><textarea id="e_notes" rows="2" placeholder="Where you met…"></textarea></div>
    <div class="form-group">
      <label>Card Type</label>
      <div class="radio-group">
        <label class="radio-opt"><input type="radio" name="e_type" value="paper" checked /> Paper</label>
        <label class="radio-opt"><input type="radio" name="e_type" value="digital" /> Digital</label>
      </div>
    </div>
    <button class="btn-primary full-width" id="saveExtracted">Save Contact</button>
  `;

  document.getElementById('saveExtracted').addEventListener('click', () => {
    const name = document.getElementById('e_name').value.trim();
    if (!name) { showToast('Name is required.'); return; }
    const type = document.querySelector('input[name="e_type"]:checked')?.value || 'paper';
    addContact({
      name,
      title:   document.getElementById('e_title').value.trim(),
      company: document.getElementById('e_company').value.trim(),
      email:   document.getElementById('e_email').value.trim(),
      phone:   document.getElementById('e_phone').value.trim(),
      website: document.getElementById('e_website').value.trim(),
      address: document.getElementById('e_address').value.trim(),
      notes:   document.getElementById('e_notes').value.trim(),
      type,
      imageData
    });
  });
}

function esc(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- MANUAL FORM ----
document.getElementById('manualForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('m_name').value.trim();
  if (!name) return;
  const type = document.querySelector('input[name="m_type"]:checked')?.value || 'paper';

  if (editMode && currentContactId) {
    const idx = contacts.findIndex(c => c.id === currentContactId);
    if (idx !== -1) {
      contacts[idx] = {
        ...contacts[idx],
        name,
        title:   document.getElementById('m_title').value.trim(),
        company: document.getElementById('m_company').value.trim(),
        email:   document.getElementById('m_email').value.trim(),
        phone:   document.getElementById('m_phone').value.trim(),
        website: document.getElementById('m_website').value.trim(),
        address: document.getElementById('m_address').value.trim(),
        notes:   document.getElementById('m_notes').value.trim(),
        type,
        updatedAt: new Date().toISOString()
      };
      saveContacts();
      showToast('Contact updated.');
      editMode = false;
      currentContactId = null;
      document.getElementById('manualForm').reset();
      switchTab('contacts');
    }
  } else {
    addContact({
      name,
      title:   document.getElementById('m_title').value.trim(),
      company: document.getElementById('m_company').value.trim(),
      email:   document.getElementById('m_email').value.trim(),
      phone:   document.getElementById('m_phone').value.trim(),
      website: document.getElementById('m_website').value.trim(),
      address: document.getElementById('m_address').value.trim(),
      notes:   document.getElementById('m_notes').value.trim(),
      type
    });
  }
});

function addContact(data) {
  const contact = {
    id:        genId(),
    createdAt: new Date().toISOString(),
    ...data
  };
  contacts.unshift(contact);
  saveContacts();
  showToast(`✓ ${contact.name} saved!`);
  document.getElementById('manualForm').reset();
  document.getElementById('previewSection')?.classList.add('hidden');
  switchTab('contacts');
}

// ---- RENDER CONTACTS ----
function renderContacts(filter = '') {
  const list = document.getElementById('contactList');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('headerCount');

  const filtered = filter
    ? contacts.filter(c =>
        [c.name, c.company, c.email, c.phone, c.title].join(' ').toLowerCase().includes(filter.toLowerCase())
      )
    : contacts;

  count.textContent = `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = filtered.map(c => `
    <div class="contact-card" data-id="${c.id}">
      <div class="contact-avatar">${initials(c.name)}</div>
      <div class="contact-info">
        <div class="contact-name">${esc(c.name)}</div>
        <div class="contact-sub">${[c.title, c.company].filter(Boolean).join(' · ') || c.email || '—'}</div>
      </div>
      <span class="contact-badge badge-${c.type || 'paper'}">${c.type || 'paper'}</span>
    </div>
  `).join('');

  list.querySelectorAll('.contact-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

// ---- SEARCH ----
const searchInput = document.getElementById('searchInput');
const clearBtn    = document.getElementById('clearSearch');

searchInput.addEventListener('input', () => {
  const val = searchInput.value;
  clearBtn.classList.toggle('hidden', !val);
  renderContacts(val);
});
clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearBtn.classList.add('hidden');
  renderContacts();
});

// ---- MODAL ----
function openModal(id) {
  currentContactId = id;
  const c = contacts.find(c => c.id === id);
  if (!c) return;

  const mc = document.getElementById('modalContent');
  mc.innerHTML = `
    <div class="modal-contact-header">
      <div class="modal-avatar">${initials(c.name)}</div>
      <div>
        <div class="modal-name">${esc(c.name)}</div>
        <div class="modal-title-co">${[c.title, c.company].filter(Boolean).join(' · ') || ''}</div>
      </div>
    </div>
    ${c.imageData ? `<img src="${c.imageData}" style="width:100%;border-radius:10px;border:1px solid var(--border);margin-bottom:16px;max-height:160px;object-fit:contain;background:var(--bg3)" />` : ''}
    <div class="modal-fields">
      ${field('Email',   c.email   ? `<a href="mailto:${c.email}">${esc(c.email)}</a>` : '')}
      ${field('Phone',   c.phone   ? `<a href="tel:${c.phone}">${esc(c.phone)}</a>` : '')}
      ${field('Website', c.website ? `<a href="${esc(c.website)}" target="_blank" rel="noopener">${esc(c.website)}</a>` : '')}
      ${field('Address', esc(c.address))}
      ${field('Notes',   esc(c.notes))}
      ${field('Type',    `<span class="contact-badge badge-${c.type || 'paper'}">${c.type || 'paper'}</span>`)}
      ${field('Saved',   new Date(c.createdAt).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }))}
    </div>
  `;

  document.getElementById('detailModal').classList.remove('hidden');
}

function field(label, value) {
  if (!value) return '';
  return `<div class="modal-field"><div class="modal-field-label">${label}</div><div class="modal-field-value">${value}</div></div>`;
}

document.getElementById('closeModal').addEventListener('click', closeModal);
document.querySelector('.modal-backdrop').addEventListener('click', closeModal);

function closeModal() {
  document.getElementById('detailModal').classList.add('hidden');
  currentContactId = null;
}

document.getElementById('deleteContactBtn').addEventListener('click', () => {
  if (!currentContactId) return;
  const c = contacts.find(c => c.id === currentContactId);
  if (!confirm(`Delete ${c?.name}?`)) return;
  contacts = contacts.filter(c => c.id !== currentContactId);
  saveContacts();
  closeModal();
  renderContacts(searchInput.value);
  showToast('Contact deleted.');
});

document.getElementById('editContactBtn').addEventListener('click', () => {
  const c = contacts.find(c => c.id === currentContactId);
  if (!c) return;
  editMode = true;
  closeModal();
  switchTab('manual');
  setTimeout(() => {
    document.getElementById('m_name').value    = c.name || '';
    document.getElementById('m_title').value   = c.title || '';
    document.getElementById('m_company').value = c.company || '';
    document.getElementById('m_email').value   = c.email || '';
    document.getElementById('m_phone').value   = c.phone || '';
    document.getElementById('m_website').value = c.website || '';
    document.getElementById('m_address').value = c.address || '';
    document.getElementById('m_notes').value   = c.notes || '';
    const typeInput = document.querySelector(`input[name="m_type"][value="${c.type || 'paper'}"]`);
    if (typeInput) typeInput.checked = true;
  }, 50);
});

// ---- EXPORT CSV ----
document.getElementById('exportBtn').addEventListener('click', () => {
  if (!contacts.length) { showToast('No contacts to export.'); return; }
  const headers = ['Name','Title','Company','Email','Phone','Website','Address','Notes','Type','Created'];
  const rows = contacts.map(c => [
    c.name, c.title, c.company, c.email, c.phone, c.website, c.address, c.notes, c.type,
    new Date(c.createdAt).toLocaleDateString()
  ].map(v => `"${(v||'').replace(/"/g,'""')}"`));
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `cardvault_contacts_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!');
});

// ---- SWITCH TAB HELPER ----
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.classList.add('hidden'); });
  const tab = document.querySelector(`.tab[data-tab="${name}"]`);
  if (tab) tab.classList.add('active');
  const view = document.getElementById(`view-${name}`);
  if (view) { view.classList.remove('hidden'); view.classList.add('active'); }
  if (name !== 'scan') stopCamera();
  if (name === 'contacts') renderContacts(searchInput.value);
}

// ---- SPLASH → APP ----
window.addEventListener('load', () => {
  loadContacts();
  renderContacts();

  setTimeout(() => {
    document.getElementById('splash').classList.add('fade-out');
    setTimeout(() => {
      document.getElementById('splash').remove();
      document.getElementById('app').classList.remove('hidden');
    }, 650);
  }, 1800);
});

// ---- SERVICE WORKER REGISTRATION ----
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
