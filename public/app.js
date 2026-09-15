const apiBaseInput = document.querySelector('#apiBase');
const saveApiButton = document.querySelector('#saveApi');
const refreshButton = document.querySelector('#refreshFiles');
const fileList = document.querySelector('#fileList');
const statusBox = document.querySelector('#status');
const serverStatus = document.querySelector('#serverStatus');
const adminTokenInput = document.querySelector('#adminToken');
const gameFileInput = document.querySelector('#gameFile');
const uploadButton = document.querySelector('#uploadFile');
const uploadStatus = document.querySelector('#uploadStatus');
const adCopyStatus = document.querySelector('#adCopyStatus');
const copyAdButtons = document.querySelectorAll('.copy-ad');

apiBaseInput.value = localStorage.getItem('phonexosApiBase') || localStorage.getItem('gameFileApiBase') || '';

function apiUrl(path) {
  const base = apiBaseInput.value.trim().replace(/\/$/, '');
  return `${base}${path}`;
}

function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** exponent)).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function setStatus(message, target = statusBox, tone = 'neutral') {
  target.textContent = message;
  target.dataset.tone = tone;
}

function renderEmptyState() {
  fileList.innerHTML = `
    <li class="empty-state">
      <strong>No PhonexOS files yet.</strong>
      <span>Upload your first build, document, screenshot, or support file from the admin area and it will appear here.</span>
    </li>
  `;
}

async function checkServer() {
  setStatus('Checking server…', serverStatus);
  try {
    const response = await fetch(apiUrl('/api/health'));
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    const payload = await response.json();
    const visibility = payload.publicDownloads ? 'public downloads' : 'token-protected downloads';
    setStatus(`Online · ${visibility}`, serverStatus, 'success');
  } catch (error) {
    setStatus(`Offline or unreachable · ${error.message}`, serverStatus, 'error');
  }
}

async function loadFiles() {
  setStatus('Loading files…');
  fileList.innerHTML = '';
  try {
    const response = await fetch(apiUrl('/api/files'));
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    const payload = await response.json();
    if (!payload.files.length) {
      setStatus('Ready for uploads.', statusBox, 'success');
      renderEmptyState();
      return;
    }
    setStatus(`${payload.files.length} PhonexOS file${payload.files.length === 1 ? '' : 's'} ready.`, statusBox, 'success');
    payload.files.forEach((file) => {
      const item = document.createElement('li');
      item.className = 'file-item';

      const details = document.createElement('div');
      details.className = 'file-details';

      const name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = file.name;

      const meta = document.createElement('span');
      meta.className = 'file-meta';
      meta.textContent = `${formatBytes(file.size)} · Updated ${new Date(file.updatedAt).toLocaleString()}`;

      const link = document.createElement('a');
      link.className = 'button primary file-link';
      link.href = apiUrl(file.downloadUrl);
      link.textContent = 'Download';

      details.append(name, meta);
      item.append(details, link);
      fileList.append(item);
    });
  } catch (error) {
    setStatus(`Could not load files: ${error.message}`, statusBox, 'error');
    renderEmptyState();
  }
}

async function uploadFile() {
  const file = gameFileInput.files[0];
  const token = adminTokenInput.value.trim();
  if (!file) {
    setStatus('Choose a file first.', uploadStatus, 'error');
    return;
  }
  if (!token) {
    setStatus('Enter the admin token first.', uploadStatus, 'error');
    return;
  }
  setStatus(`Uploading ${file.name}…`, uploadStatus);
  uploadButton.disabled = true;
  try {
    const response = await fetch(apiUrl(`/api/files/${encodeURIComponent(file.name)}`), {
      method: 'PUT',
      headers: { 'x-admin-token': token },
      body: file,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `Server returned ${response.status}`);
    }
    setStatus(`Uploaded ${payload.name} (${formatBytes(payload.size)}).`, uploadStatus, 'success');
    gameFileInput.value = '';
    await Promise.all([checkServer(), loadFiles()]);
  } catch (error) {
    setStatus(`Upload failed: ${error.message}`, uploadStatus, 'error');
  } finally {
    uploadButton.disabled = false;
  }
}


async function copyAdvertisement(button) {
  const text = button.dataset.copy;
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Copy saved to clipboard. Replace bracketed placeholders with your live website URL, meeting link, or contact details.', adCopyStatus, 'success');
  } catch (error) {
    setStatus(`Copy failed: ${error.message}. You can still manually highlight and copy the ad text.`, adCopyStatus, 'error');
  }
}

async function refreshEverything() {
  await Promise.all([checkServer(), loadFiles()]);
}

saveApiButton.addEventListener('click', () => {
  localStorage.setItem('phonexosApiBase', apiBaseInput.value.trim());
  refreshEverything();
});
refreshButton.addEventListener('click', refreshEverything);
uploadButton.addEventListener('click', uploadFile);
copyAdButtons.forEach((button) => {
  button.addEventListener('click', () => copyAdvertisement(button));
});
refreshEverything();
