(function() {
  if (!document.getElementById('toast-container')) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    // Use semantic classes defined in css/toast.css
    container.innerHTML = `
      <div id="toast" class="toast-notification">
        <span id="toast-icon" class="material-symbols-outlined toast-icon toast-info">info</span>
        <div class="toast-content">
          <p id="toast-title" class="toast-title">Notification</p>
          <p id="toast-message" class="toast-message">Message here</p>
        </div>
        <button onclick="hideToast()" class="toast-close-btn">
          <span class="material-symbols-outlined toast-close-icon">close</span>
        </button>
      </div>
    `;
    document.body.appendChild(container);
  }
})();

if (typeof window.toastTimeout === 'undefined') window.toastTimeout = null;

function showToast(title, message = '', type = 'info') {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const titleEl = document.getElementById('toast-title');
  const messageEl = document.getElementById('toast-message');

  const icons = { info: 'info', success: 'check_circle', warning: 'warning', error: 'error' };
  const defaultTitles = { info: 'Thông báo', success: 'Thành công', warning: 'Cảnh báo', error: 'Lỗi' };

  // Detect type from args if type is not valid
  const validTypes = ['info', 'success', 'warning', 'error'];
  if (!validTypes.includes(type) && validTypes.includes(message)) {
    type = message;
    message = '';
  }

  icon.textContent = icons[type] || icons.info;

  icon.className = 'material-symbols-outlined toast-icon';
  const safeType = type.replace(/[^a-z0-9-_]/gi, '');
  icon.classList.add(`toast-${safeType}`);

  titleEl.textContent = title || defaultTitles[type] || defaultTitles.info;
  messageEl.textContent = message;
  
  // Activate toast
  toast.classList.add('toast-active');
  
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(hideToast, 4000);
}

function hideToast() {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.classList.remove('toast-active');
  }
}

const originalAlert = window.alert;
window.alert = function(message) {
  let type = 'info';
  const msg = message.toLowerCase();
  if (msg.includes('error') || msg.includes('failed')) type = 'error';
  else if (msg.includes('success') || msg.includes('created') || msg.includes('updated') || msg.includes('deleted') || msg.includes('sent') || msg.includes('approved') || msg.includes('thank')) type = 'success';
  else if (msg.includes('please') || msg.includes('select') || msg.includes('empty') || msg.includes('required')) type = 'warning';
  showToast(message, type);
};
