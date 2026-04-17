/**
 * Customer Dashboard Logic
 */

// --- Helpers ---
function formatPrice(amount) { return '₫' + Number(amount).toLocaleString('vi-VN'); }
function formatDate(date) { return new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function getStatusLabel(status) {
  const labels = { pending: 'Ch\u1edd x\u1eed l\u00fd', processing: '\u0110ang x\u1eed l\u00fd', shipping: '\u0110ang giao', delivered: '\u0110\u00e3 giao', completed: 'Ho\u00e0n th\u00e0nh', cancelled: '\u0110\u00e3 h\u1ee7y' };
  return labels[status] || status;
}
function getStatusBadgeClass(status) {
    if(status === 'delivered' || status === 'completed') return 'badge-success';
    if(status === 'cancelled') return 'badge-error';
    if(status === 'pending') return 'badge-warning';
    return 'badge-info';
}
function skeletonLoading(rows = 3) {
    return Array.from({length: rows}, () => `<div class="skeleton" style="height:1rem;width:60%;margin-bottom:0.5rem"></div><div class="skeleton" style="height:0.75rem;width:40%;margin-bottom:1rem"></div>`).join('');
}

const views = {
  settings: `
    <div class="content-wrapper">
      <div class="view-header">
        <div>
          <h1 class="view-title">C\u00e0i \u0111\u1eb7t t\u00e0i kho\u1ea3n</h1>
          <p class="view-description">Qu\u1ea3n l\u00fd th\u00f4ng tin c\u00e1 nh\u00e2n v\u00e0 b\u1ea3o m\u1eadt.</p>
        </div>
        <div class="flex items-center gap-4">
          <button class="btn-secondary">H\u1ee7y thay \u0111\u1ed5i</button>
          <button class="btn-primary" onclick="saveProfileChanges()">L\u01b0u thay \u0111\u1ed5i</button>
        </div>
      </div>
      <div class="stats-grid" style="grid-template-columns: 1fr; gap: 2rem; display: flex; flex-direction: column; @media(min-width: 1024px){ display: grid; grid-template-columns: 2fr 1fr; }">
        <div class="flex flex-col gap-6" style="flex: 2;">
          <div class="card">
            <h2 class="card-title mb-6">
              <span class="material-symbols-outlined text-hq-primary">badge</span>
              H\u1ed3 s\u01a1 c\u00f4ng khai
            </h2>
            <div class="flex flex-col sm:flex-row gap-8">
              <div class="flex flex-col items-center gap-4">
                <div class="avatar-upload">
                  <div class="avatar-inner">
                    <span id="avatar-initials" class="text-3xl font-bold text-slate-900"></span>
                    <img id="avatar-img" src="" class="w-full h-full object-cover hidden">
                  </div>
                  <button onclick="document.getElementById('inp-avatar').click()" class="avatar-edit-btn">
                    <span class="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <input type="file" id="inp-avatar" class="hidden" accept="image/*" />
                </div>
                <p class="text-xs text-muted text-center max-w-[120px]">Cho ph\u00e9p *.jpeg, *.jpg, *.png, t\u1ed1i \u0111a 3MB</p>
              </div>
              <div style="flex: 1;" class="flex flex-col gap-4">
                <div class="two-col-grid">
                  <div class="form-group">
                    <label class="form-label">H\u1ecd</label>
                    <input id="inp-first-name" class="form-input" type="text" placeholder="H\u1ecd" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">T\u00ean</label>
                    <input id="inp-last-name" class="form-input" type="text" placeholder="T\u00ean" />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <input id="inp-email" class="form-input" type="email" readonly />
                </div>
                <div class="form-group">
                  <label class="form-label">S\u1ed1 \u0111i\u1ec7n tho\u1ea1i</label>
                  <input id="inp-phone" class="form-input" type="tel" placeholder="0912 345 678" />
                </div>
              </div>
            </div>
          </div>
          <div class="card">
            <h2 class="card-title mb-6">
              <span class="material-symbols-outlined text-hq-primary">lock</span>
              M\u1eadt kh\u1ea9u & B\u1ea3o m\u1eadt
            </h2>
            <div class="flex flex-col gap-4">
              <div class="form-group">
                <label class="form-label">M\u1eadt kh\u1ea9u hi\u1ec7n t\u1ea1i</label>
                <input id="inp-current-pass" class="form-input" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" type="password" />
              </div>
              <div class="two-col-grid">
                <div class="form-group">
                  <label class="form-label">M\u1eadt kh\u1ea9u m\u1edbi</label>
                  <input id="inp-new-pass" class="form-input" placeholder="Nh\u1eadp m\u1eadt kh\u1ea9u m\u1edbi" type="password" />
                </div>
                <div class="form-group">
                  <label class="form-label">X\u00e1c nh\u1eadn m\u1eadt kh\u1ea9u</label>
                  <input id="inp-confirm-pass" class="form-input" placeholder="X\u00e1c nh\u1eadn m\u1eadt kh\u1ea9u m\u1edbi" type="password" />
                </div>
              </div>
              <div class="flex justify-end">
                <button class="text-sm font-bold text-hq-primary" style="background:none; border:none; cursor:pointer;">Qu\u00ean m\u1eadt kh\u1ea9u?</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  addresses: `
    <div class="content-wrapper">
      <div class="view-header">
        <div>
          <h1 class="view-title">\u0110\u1ecba ch\u1ec9</h1>
          <p class="view-description">Qu\u1ea3n l\u00fd \u0111\u1ecba ch\u1ec9 giao h\u00e0ng.</p>
        </div>
        <button onclick="showAddressModal()" class="btn-primary flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">add</span>
          Th\u00eam \u0111\u1ecba ch\u1ec9
        </button>
      </div>
      <div id="address-list" class="stats-grid">
        <div class="col-span-full py-12 text-center text-muted">${skeletonLoading(2)}</div>
      </div>
    </div>
  `,
  payment: `
    <div class="content-wrapper">
      <div class="view-header">
        <div>
          <h1 class="view-title">Ph\u01b0\u01a1ng th\u1ee9c thanh to\u00e1n</h1>
          <p class="view-description">Qu\u1ea3n l\u00fd th\u1ebb thanh to\u00e1n \u0111\u00e3 l\u01b0u.</p>
        </div>
        <button onclick="openAddCardModal()" class="btn-primary flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">add_card</span>
          Th\u00eam th\u1ebb m\u1edbi
        </button>
      </div>
      <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:var(--hq-radius);padding:0.5rem 0.75rem;margin-bottom:1rem;font-size:0.75rem;color:#C2410C;display:flex;align-items:center;gap:0.5rem;">
        <span class="material-symbols-outlined" style="font-size:1rem">info</span>
        Demo: Thẻ được lưu trên thiết bị, không gửi lên server.
      </div>
      <div id="saved-cards-list" class="stats-grid">
        <div class="py-12 text-center text-muted w-full col-span-full">${skeletonLoading(2)}</div>
      </div>
    </div>
  `,
  promotions: `
    <div class="content-wrapper">
      <div class="view-header">
         <div>
            <h1 class="view-title">Voucher & \u01afu \u0111\u00e3i</h1>
            <p class="view-description">M\u00e3 gi\u1ea3m gi\u00e1 v\u00e0 khuy\u1ebfn m\u00e3i d\u00e0nh cho b\u1ea1n.</p>
        </div>
      </div>
      <div id="promotions-list" class="two-col-grid">
        <div class="col-span-full py-12 text-center text-muted">${skeletonLoading(2)}</div>
      </div>
    </div>
  `,
  overview: `
    <div class="flex flex-col gap-8">
      <h1 class="view-title">T\u1ed5ng quan</h1>
      <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
        <div class="card relative overflow-hidden group">
          <div class="absolute top-0 right-0 p-4 opacity-50">
             <span class="material-symbols-outlined text-4xl text-hq-primary" style="opacity:0.2">shopping_bag</span>
          </div>
          <div class="form-label">T\u1ed5ng \u0111\u01a1n h\u00e0ng</div>
          <div id="stats-orders" class="text-3xl font-bold text-slate-900">0</div>
        </div>
        <div class="card relative overflow-hidden group">
           <div class="absolute top-0 right-0 p-4 opacity-50">
             <span class="material-symbols-outlined text-4xl text-green-400" style="opacity:0.2">payments</span>
          </div>
          <div class="form-label">\u0110\u00e3 chi ti\u00eau</div>
          <div id="stats-spent" class="text-3xl font-bold text-hq-primary">\u20ab0</div>
        </div>
        <div class="card relative overflow-hidden group">
           <div class="absolute top-0 right-0 p-4 opacity-50">
             <span class="material-symbols-outlined text-4xl text-blue-400" style="opacity:0.2">local_shipping</span>
          </div>
          <div class="form-label">\u0110ang x\u1eed l\u00fd</div>
          <div id="stats-pending" class="text-3xl font-bold text-blue-400">0</div>
        </div>
        <div class="card relative overflow-hidden group">
           <div class="absolute top-0 right-0 p-4 opacity-50">
             <span class="material-symbols-outlined text-4xl text-red-400" style="opacity:0.2">cancel</span>
          </div>
          <div class="form-label">\u0110\u01a1n \u0111\u00e3 h\u1ee7y</div>
          <div id="stats-cancelled" class="text-3xl font-bold text-red-400">0</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="flex gap-3 flex-wrap">
        <button onclick="document.querySelector('.nav-item[data-view=\\'orders\\']').click()" class="btn-secondary flex items-center gap-2 text-sm">
          <span class="material-symbols-outlined text-[18px]">receipt_long</span> Xem \u0111\u01a1n h\u00e0ng
        </button>
        <button onclick="document.querySelector('.nav-item[data-view=\\'wishlist\\']').click()" class="btn-secondary flex items-center gap-2 text-sm">
          <span class="material-symbols-outlined text-[18px]">favorite</span> Y\u00eau th\u00edch
        </button>
        <button onclick="document.querySelector('.nav-item[data-view=\\'promotions\\']').click()" class="btn-secondary flex items-center gap-2 text-sm">
          <span class="material-symbols-outlined text-[18px]">confirmation_number</span> Voucher
        </button>
        <button onclick="document.querySelector('.nav-item[data-view=\\'settings\\']').click()" class="btn-secondary flex items-center gap-2 text-sm">
          <span class="material-symbols-outlined text-[18px]">settings</span> C\u00e0i \u0111\u1eb7t
        </button>
      </div>

      <div class="card p-0 overflow-hidden">
        <div class="card-header p-6 border-b border-slate-200">
          <h3 class="card-title">
             <span class="material-symbols-outlined text-hq-primary">history</span>
             \u0110\u01a1n h\u00e0ng g\u1ea7n \u0111\u00e2y
          </h3>
          <button onclick="document.querySelector('.nav-item[data-view=\\'orders\\']').click()" class="text-xs font-bold text-hq-primary uppercase tracking-wide" style="background:none; border:none; cursor:pointer;">
             Xem t\u1ea5t c\u1ea3
          </button>
        </div>
        <div class="table-container" style="border:none; border-radius:0;">
          <table class="table">
            <thead>
              <tr>
                <th>M\u00e3 \u0111\u01a1n</th>
                <th>Ng\u00e0y \u0111\u1eb7t</th>
                <th>Tr\u1ea1ng th\u00e1i</th>
                <th class="text-right">T\u1ed5ng ti\u1ec1n</th>
              </tr>
            </thead>
            <tbody id="recent-orders-body">
              <tr><td colspan="4" class="px-6 py-8 text-center text-muted">${skeletonLoading(3)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Products awaiting review -->
      <div class="card p-0 overflow-hidden">
        <div class="card-header p-6 border-b border-slate-200">
          <h3 class="card-title">
             <span class="material-symbols-outlined text-hq-primary">rate_review</span>
             S\u1ea3n ph\u1ea9m ch\u1edd \u0111\u00e1nh gi\u00e1
          </h3>
        </div>
        <div id="pending-reviews-body" class="p-6">
          ${skeletonLoading(2)}
        </div>
      </div>
    </div>
  `,
  orders: `
    <div class="flex flex-col gap-6">
      <div class="view-header">
        <h2 class="view-title">L\u1ecbch s\u1eed \u0111\u01a1n h\u00e0ng</h2>
        <div class="flex gap-2">
          <input type="text" id="order-search" placeholder="T\u00ecm \u0111\u01a1n h\u00e0ng..." class="form-input" style="width: auto;" autocomplete="off">
          <select id="order-status-filter" class="form-input" style="width: auto;">
            <option value="">T\u1ea5t c\u1ea3 tr\u1ea1ng th\u00e1i</option>
            <option value="pending">Ch\u1edd x\u1eed l\u00fd</option>
            <option value="processing">\u0110ang x\u1eed l\u00fd</option>
            <option value="shipping">\u0110ang giao</option>
            <option value="delivered">\u0110\u00e3 giao</option>
            <option value="cancelled">\u0110\u00e3 h\u1ee7y</option>
          </select>
        </div>
      </div>

      <div class="card p-0 overflow-hidden">
        <div class="table-container" style="border:none; border-radius:0;">
          <table class="table">
            <thead>
              <tr>
                <th>\u0110\u01a1n #</th>
                <th>Ng\u00e0y \u0111\u1eb7t</th>
                <th>S\u1ea3n ph\u1ea9m</th>
                <th>Tr\u1ea1ng th\u00e1i</th>
                <th class="text-right">T\u1ed5ng ti\u1ec1n</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="orders-table-body">
              <tr><td colspan="6" class="px-6 py-12 text-center text-muted">${skeletonLoading(4)}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="sidebar-footer flex items-center justify-between">
            <span class="text-xs text-muted">Hi\u1ec3n th\u1ecb \u0111\u01a1n h\u00e0ng g\u1ea7n \u0111\u00e2y</span>
             <div class="flex gap-1">
                 <!-- Pagination mocks -->
             </div>
        </div>
      </div>
    </div>
  `,
  wishlist: `
    <div class="flex flex-col gap-6">
      <div class="view-header">
        <h2 class="view-title">Y\u00eau th\u00edch c\u1ee7a t\u00f4i</h2>
        <div class="flex gap-2">
          <select id="wishlist-sort" class="form-input" style="width:auto;">
            <option value="newest">M\u1edbi nh\u1ea5t</option>
            <option value="price-asc">Gi\u00e1 t\u0103ng d\u1ea7n</option>
            <option value="price-desc">Gi\u00e1 gi\u1ea3m d\u1ea7n</option>
            <option value="name">T\u00ean A-Z</option>
          </select>
        </div>
      </div>
      <div id="wishlist-grid" class="card-grid" style="grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));">
        <div class="col-span-full py-12 text-center text-muted">${skeletonLoading(3)}</div>
      </div>
    </div>
  `,
  reviews: `
    <div class="flex flex-col gap-6">
      <h2 class="view-title">\u0110\u00e1nh gi\u00e1 c\u1ee7a t\u00f4i</h2>
      <div id="reviews-list" class="flex flex-col gap-4">
         <div class="py-12 text-center text-muted">${skeletonLoading(3)}</div>
      </div>
    </div>
  `,
  notifications: `
    <div class="flex flex-col gap-6">
      <div class="view-header">
        <h2 class="view-title">Th\u00f4ng b\u00e1o</h2>
        <button onclick="markAllNotificationsRead()" class="btn-secondary text-xs">
          \u0110\u1ecdc t\u1ea5t c\u1ea3
        </button>
      </div>
      <!-- Filter tabs -->
      <div class="flex gap-2 flex-wrap" id="notif-filter-tabs">
        <button class="btn-primary text-xs notif-tab active" data-filter="all">T\u1ea5t c\u1ea3</button>
        <button class="btn-secondary text-xs notif-tab" data-filter="order">\u0110\u01a1n h\u00e0ng</button>
        <button class="btn-secondary text-xs notif-tab" data-filter="promo">Khuy\u1ebfn m\u00e3i</button>
        <button class="btn-secondary text-xs notif-tab" data-filter="system">H\u1ec7 th\u1ed1ng</button>
      </div>
      <div id="notifications-list" class="flex flex-col gap-2">
         <div class="py-12 text-center text-muted">${skeletonLoading(3)}</div>
      </div>
    </div>
  `,
  help: `
    <div class="flex flex-col gap-8">
      <h2 class="view-title">Trung t\u00e2m h\u1ed7 tr\u1ee3</h2>
      <div class="two-col-grid">
        <div class="card">
          <h3 class="card-title mb-4">Y\u00eau c\u1ea7u h\u1ed7 tr\u1ee3</h3>
          <div id="tickets-list" class="flex flex-col gap-3">
             <div class="text-center text-muted py-4">${skeletonLoading(2)}</div>
          </div>
           <a href="ticketPage.html" class="btn-primary block mt-4 text-center w-full" style="text-decoration:none; color:black;">
            T\u1ea1o y\u00eau c\u1ea7u m\u1edbi
          </a>
        </div>
        <div class="card">
          <h3 class="card-title mb-4">C\u00e2u h\u1ecfi th\u01b0\u1eddng g\u1eb7p</h3>
          <div class="flex flex-col gap-2 text-sm text-slate-500">
             <details class="bg-slate-50 rounded-lg p-3 cursor-pointer group">
                  <summary class="font-bold text-slate-900 list-none flex justify-between items-center">
                      L\u00e0m sao \u0111\u1ec3 theo d\u00f5i \u0111\u01a1n h\u00e0ng?
                  </summary>
                  <p class="mt-2 text-muted">V\u00e0o "\u0110\u01a1n h\u00e0ng" v\u00e0 nh\u1ea5n "Chi ti\u1ebft" tr\u00ean \u0111\u01a1n h\u00e0ng c\u1ee5 th\u1ec3.</p>
              </details>
             <details class="bg-slate-50 rounded-lg p-3 cursor-pointer group">
                  <summary class="font-bold text-slate-900 list-none flex justify-between items-center">
                      L\u00e0m sao \u0111\u1ec3 \u0111\u1ed5i/tr\u1ea3 h\u00e0ng?
                  </summary>
                  <p class="mt-2 text-muted">Li\u00ean h\u1ec7 h\u1ed7 tr\u1ee3 trong v\u00f2ng 7 ng\u00e0y k\u1ec3 t\u1eeb khi nh\u1eadn h\u00e0ng. \u0110\u1ea3m b\u1ea3o s\u1ea3n ph\u1ea9m c\u00f2n nguy\u00ean tem/nh\u00e3n.</p>
              </details>
             <details class="bg-slate-50 rounded-lg p-3 cursor-pointer group">
                  <summary class="font-bold text-slate-900 list-none flex justify-between items-center">
                      Th\u1eddi gian giao h\u00e0ng l\u00e0 bao l\u00e2u?
                  </summary>
                  <p class="mt-2 text-muted">N\u1ed9i th\u00e0nh: 1-2 ng\u00e0y. Ngo\u1ea1i th\u00e0nh: 3-5 ng\u00e0y. \u0110\u01a1n h\u00e0ng \u0111\u1eb7c bi\u1ec7t c\u00f3 th\u1ec3 l\u00e2u h\u01a1n.</p>
              </details>
             <details class="bg-slate-50 rounded-lg p-3 cursor-pointer group">
                  <summary class="font-bold text-slate-900 list-none flex justify-between items-center">
                      T\u00f4i c\u00f3 th\u1ec3 h\u1ee7y \u0111\u01a1n h\u00e0ng kh\u00f4ng?
                  </summary>
                  <p class="mt-2 text-muted">B\u1ea1n c\u00f3 th\u1ec3 h\u1ee7y \u0111\u01a1n h\u00e0ng khi \u0111\u01a1n \u0111ang \u1edf tr\u1ea1ng th\u00e1i "Ch\u1edd x\u1eed l\u00fd". Sau khi x\u00e1c nh\u1eadn, kh\u00f4ng th\u1ec3 h\u1ee7y.</p>
              </details>
             <details class="bg-slate-50 rounded-lg p-3 cursor-pointer group">
                  <summary class="font-bold text-slate-900 list-none flex justify-between items-center">
                      Ph\u01b0\u01a1ng th\u1ee9c thanh to\u00e1n n\u00e0o \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3?
                  </summary>
                  <p class="mt-2 text-muted">Ch\u00fang t\u00f4i h\u1ed7 tr\u1ee3: Thanh to\u00e1n khi nh\u1eadn h\u00e0ng (COD), chuy\u1ec3n kho\u1ea3n ng\u00e2n h\u00e0ng, v\u00ed \u0111i\u1ec7n t\u1eed (MoMo, ZaloPay), v\u00e0 th\u1ebb t\u00edn d\u1ee5ng.</p>
              </details>
             <details class="bg-slate-50 rounded-lg p-3 cursor-pointer group">
                  <summary class="font-bold text-slate-900 list-none flex justify-between items-center">
                      L\u00e0m sao \u0111\u1ec3 s\u1eed d\u1ee5ng m\u00e3 gi\u1ea3m gi\u00e1?
                  </summary>
                  <p class="mt-2 text-muted">Nh\u1eadp m\u00e3 gi\u1ea3m gi\u00e1 t\u1ea1i trang thanh to\u00e1n. M\u1ed7i \u0111\u01a1n h\u00e0ng ch\u1ec9 \u00e1p d\u1ee5ng 1 m\u00e3.</p>
              </details>
             <details class="bg-slate-50 rounded-lg p-3 cursor-pointer group">
                  <summary class="font-bold text-slate-900 list-none flex justify-between items-center">
                      L\u00e0m sao li\u00ean h\u1ec7 b\u1ed9 ph\u1eadn h\u1ed7 tr\u1ee3?
                  </summary>
                  <p class="mt-2 text-muted">B\u1ea1n c\u00f3 th\u1ec3 t\u1ea1o y\u00eau c\u1ea7u h\u1ed7 tr\u1ee3 ngay t\u1ea1i trang n\u00e0y ho\u1eb7c g\u1ecdi hotline: 1900-xxxx (8h-22h h\u00e0ng ng\u00e0y).</p>
              </details>
          </div>
        </div>
      </div>
    </div>
  `,
  messages: `
    <div class="flex flex-col gap-8">
      <h2 class="view-title">Tin nh\u1eafn</h2>
      <div class="card">
        <h3 class="card-title mb-4">Cu\u1ed9c tr\u00f2 chuy\u1ec7n c\u1ee7a b\u1ea1n</h3>
        <div id="messages-list" class="flex flex-col gap-3">
          <div class="text-center text-muted py-4">${skeletonLoading(3)}</div>
        </div>
      </div>
    </div>
  `
};

// Global state
let myAddresses = [];
let editingAddressId = null;
let currentUserProfile = null;

// Initialization
document.addEventListener("DOMContentLoaded", async () => {
    checkAuth();
    setupNavigation();
    loadProfile();
    setupUserDropdown();

    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get("tab");
    if (tab && views[tab]) {
        const targetLink = Array.from(document.querySelectorAll(".nav-item")).find(l => {
            const t = l.innerText.trim().toLowerCase();
            if (tab === "orders") return t.includes("orders") || t.includes("\u0111\u01a1n");
            if (tab === "overview") return t.includes("overview") || t.includes("t\u1ed5ng");
            if (tab === "settings") return t.includes("account") || t.includes("settings") || t.includes("c\u00e0i");
            if (tab === "addresses") return t.includes("addresses") || t.includes("\u0111\u1ecba");
            if (tab === "payment") return t.includes("payment") || t.includes("thanh");
            if (tab === "notifications") return t.includes("notifications") || t.includes("th\u00f4ng");
            return false;
        });
        if (targetLink) targetLink.click();
        else if (tab === "settings") loadView("settings"); // Fallback
    } else {
        // Default
        const overviewBtn = document.querySelector('.nav-item[data-view="overview"]');
        if (overviewBtn) overviewBtn.click();
    }
});

function checkAuth() {
    if (typeof AuthAPI === 'undefined' || typeof TokenService === 'undefined') return;
    if (!AuthAPI.checkAuth("customer")) {
        window.location.href = "loginPage.html";
        return;
    }
    const user = TokenService.getUser();
    if (user) {
        updateUserDisplay(user);
        loadNavNotifications();
    }
}

function updateUserDisplay(user) {
    const firstName = user.firstName || user.first_name || "";
    const lastName = user.lastName || user.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim() || "User";
    const initials = (firstName?.[0] || "") + (lastName?.[0] || "U");
    const email = user.email || "";

    document.querySelectorAll("#header-user-name, #dropdown-user-name").forEach(el => el.textContent = fullName);
    document.querySelectorAll("#header-user-initial").forEach(el => el.textContent = initials.toUpperCase());
    document.querySelectorAll("#dropdown-user-email").forEach(el => el.textContent = email);

    // Update avatar image if available
    if(user.avatar) {
        const imgs = document.querySelectorAll("#avatar-img");
        imgs.forEach(img => {
            img.src = user.avatar;
            img.classList.remove("hidden");
            img.previousElementSibling?.classList.add("hidden"); // Hide initials
        });
    }
}

function setupUserDropdown() {
    const btn = document.getElementById("user-dropdown-btn");
    const dropdown = document.querySelector(".user-dropdown");

    if(btn && dropdown) {
        // Initially hide
        dropdown.classList.add("hidden");

        btn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("hidden");
        };

        document.addEventListener("click", (e) => {
            if(!dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.classList.add("hidden");
            }
        });
    }
}

function setupNavigation() {
    const navLinks = document.querySelectorAll(".nav-item");
    const container = document.getElementById("main-view-container");

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
             // Handle logout specifically
            if (link.innerText.includes("Sign Out") || link.innerText.includes("\u0110\u0103ng xu\u1ea5t")) {
                e.preventDefault();
                AuthAPI.logout();
                return;
            }

            e.preventDefault();
            const key = link.getAttribute("data-view");
            if (key && views[key]) {
                 navLinks.forEach(l => l.classList.remove("active"));
                 link.classList.add("active");
                 loadView(key);
            }
        });
    });
}

function loadView(key) {
    const container = document.getElementById("main-view-container");
    container.innerHTML = views[key];

    if (key === "overview") loadOverview();
    if (key === "orders") loadOrders();
    if (key === "addresses") loadAddresses();
    if (key === "promotions") loadPromotions();
    if (key === "wishlist") loadWishlist();
    if (key === "reviews") loadReviews();
    if (key === "notifications") loadNotifications();
    if (key === "help" || key === "messages") { window.location.href = 'ticketPage.html'; return; }
    if (key === "settings") {
         setupActionButtons();
         populateProfileForm();
    }
    if (key === "payment") loadPaymentMethods();
}

// --- Load Functions ---

async function loadProfile() {
    try {
        const res = await CustomersAPI.getProfile();
        if(res.success && res.data) {
            currentUserProfile = res.data;
            updateUserDisplay(currentUserProfile);
            // If settings page is open, update it
            if(document.getElementById("inp-email")) {
                populateProfileForm();
            }
        }
    } catch(e) { console.error("Failed to load profile", e); }
}

function populateProfileForm() {
    if(!currentUserProfile) return;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.value = val || "";
    };

    setVal("inp-first-name", currentUserProfile.first_name || currentUserProfile.firstName);
    setVal("inp-last-name", currentUserProfile.last_name || currentUserProfile.lastName);
    setVal("inp-email", currentUserProfile.email);
    setVal("inp-phone", currentUserProfile.phone);

    const img = document.getElementById("avatar-img");
    const initialsEl = document.getElementById("avatar-initials");

    if (img && initialsEl) {
        if(currentUserProfile.avatar) {
             img.src = currentUserProfile.avatar;
             img.classList.remove("hidden");
             initialsEl.classList.add("hidden");
        } else {
             img.classList.add("hidden");
             initialsEl.classList.remove("hidden");
             const f = currentUserProfile.first_name || currentUserProfile.firstName || "";
             const l = currentUserProfile.last_name || currentUserProfile.lastName || "";
             const init = (f[0] || "") + (l[0] || "U");
             initialsEl.textContent = init.toUpperCase();
        }
    }
}

async function loadOverview() {
    try {
        const res = await OrdersAPI.getMyOrders();
        if (res.success && res.data) {
            const orders = res.data;
            document.getElementById("stats-orders").textContent = orders.length;
            const total = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
            document.getElementById("stats-spent").textContent = formatPrice(total);
            const pending = orders.filter(o => o.status === "pending" || o.status === "processing").length;
            document.getElementById("stats-pending").textContent = pending;
            const cancelled = orders.filter(o => o.status === "cancelled").length;
            const cancelledEl = document.getElementById("stats-cancelled");
            if (cancelledEl) cancelledEl.textContent = cancelled;

            const recentBody = document.getElementById("recent-orders-body");
            if(orders.length === 0) {
                 recentBody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-muted">Ch\u01b0a c\u00f3 \u0111\u01a1n h\u00e0ng.</td></tr>';
            } else {
                 recentBody.innerHTML = orders.slice(0, 5).map(o => `
                    <tr class="hover:bg-slate-50 transition-colors cursor-pointer" onclick="viewOrderDetails(${o.id})">
                        <td class="font-mono text-slate-900">#${o.id}</td>
                        <td>${formatDate(o.created_at)}</td>
                        <td><span class="badge ${getStatusBadgeClass(o.status)}">${getStatusLabel(o.status)}</span></td>
                        <td class="text-right font-medium text-slate-900">${formatPrice(o.total_amount)}</td>
                    </tr>
                `).join("");
            }

            // Pending reviews: delivered orders
            const pendingReviewsBody = document.getElementById("pending-reviews-body");
            if (pendingReviewsBody) {
                const delivered = orders.filter(o => o.status === "delivered" || o.status === "completed");
                if (delivered.length > 0) {
                    const items = [];
                    delivered.slice(0, 5).forEach(o => {
                        if (o.items && o.items.length > 0) {
                            o.items.forEach(item => {
                                items.push({ ...item, orderId: o.id });
                            });
                        }
                    });
                    if (items.length > 0) {
                        pendingReviewsBody.innerHTML = items.slice(0, 4).map(item => `
                            <div class="flex items-center gap-4 p-3 bg-slate-50 rounded-lg mb-2">
                                <div class="h-12 w-12 bg-gray-800 rounded-lg flex-shrink-0 overflow-hidden">
                                    ${item.product_image ? `<img src="${item.product_image}" class="object-cover w-full h-full">` : '<div class="w-full h-full flex items-center justify-center text-muted"><span class="material-symbols-outlined">image</span></div>'}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="font-bold text-slate-900 text-sm truncate">${item.product_name || 'S\u1ea3n ph\u1ea9m'}</div>
                                    <div class="text-xs text-muted">\u0110\u01a1n #${item.orderId}</div>
                                </div>
                                <a href="productPage.html?id=${item.product_id}" class="btn-secondary text-xs" style="text-decoration:none;">\u0110\u00e1nh gi\u00e1</a>
                            </div>
                        `).join("");
                    } else {
                        pendingReviewsBody.innerHTML = '<div class="text-center text-muted text-sm py-4">Kh\u00f4ng c\u00f3 s\u1ea3n ph\u1ea9m ch\u1edd \u0111\u00e1nh gi\u00e1.</div>';
                    }
                } else {
                    pendingReviewsBody.innerHTML = '<div class="text-center text-muted text-sm py-4">Kh\u00f4ng c\u00f3 s\u1ea3n ph\u1ea9m ch\u1edd \u0111\u00e1nh gi\u00e1.</div>';
                }
            }
        }
    } catch(e) { console.error(e); }
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById("orders-table-body");
    if (!tbody) return;
    if (orders && orders.length > 0) {
        tbody.innerHTML = orders.map(o => `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="font-mono text-slate-900 font-medium">#${o.id}</td>
                <td>${formatDate(o.created_at)}</td>
                <td class="text-muted text-xs">${o.item_count ? o.item_count + " sản phẩm" : (o.items ? o.items.length + " sản phẩm" : "Xem chi tiết")}</td>
                <td><span class="badge ${getStatusBadgeClass(o.status)}">${getStatusLabel(o.status)}</span></td>
                <td class="text-right font-bold text-slate-900">${formatPrice(o.total_amount)}</td>
                <td class="text-right">
                    <button onclick="viewOrderDetails(${o.id})" class="text-xs font-bold text-hq-primary border border-hq-primary/30 px-3 py-1 rounded hover:bg-hq-primary hover:text-white transition-colors">Chi ti\u1ebft</button>
                </td>
            </tr>
        `).join("");
    } else {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-muted">Ch\u01b0a c\u00f3 \u0111\u01a1n h\u00e0ng.</td></tr>';
    }
}

async function loadOrders() {
     try {
        const res = await OrdersAPI.getMyOrders();
        if (res.success && res.data) {
            let allOrders = res.data;
            renderOrdersTable(allOrders);

            const searchInput = document.getElementById('order-search');
            const statusFilter = document.getElementById('order-status-filter');

            function filterOrders() {
                const query = searchInput ? searchInput.value.toLowerCase() : '';
                const status = statusFilter ? statusFilter.value : '';
                let filtered = allOrders;
                if (query) filtered = filtered.filter(o => ('#'+o.id).includes(query) || (o.items && o.items.some(i => i.product_name?.toLowerCase().includes(query))));
                if (status) filtered = filtered.filter(o => o.status === status);
                renderOrdersTable(filtered);
            }

            if (searchInput) searchInput.addEventListener('input', filterOrders);
            if (statusFilter) statusFilter.addEventListener('change', filterOrders);
        } else {
            renderOrdersTable([]);
        }
    } catch(e) { console.error(e); }
}

async function loadAddresses() {
    const container = document.getElementById("address-list");
    try {
        const res = await CustomersAPI.getAddresses();
        if (res.success && res.data && res.data.length > 0) {
            myAddresses = res.data;
            container.innerHTML = res.data.map(addr => `
                <div class="card relative group ${addr.is_default ? 'border-hq-primary' : ''}">
                    ${addr.is_default ? '<span class="absolute top-4 right-4 text-[10px] font-bold bg-hq-primary text-white px-2 py-0.5 rounded">M\u1eb7c \u0111\u1ecbnh</span>' : ''}
                    <h4 class="font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <span class="material-symbols-outlined text-hq-primary">home</span>
                        ${addr.address_name || "Nh\u00e0"}
                    </h4>
                    <div class="text-sm text-muted space-y-1 mb-4">
                        <p class="text-slate-900 font-medium">${addr.recipient_name} | ${addr.phone}</p>
                        <p>${addr.street_address}</p>
                        <p>${addr.ward}, ${addr.district}, ${addr.province}</p>
                    </div>
                    <div class="flex gap-2 pt-4 border-t border-slate-200">
                        <button onclick="editAddress(${addr.id})" class="text-xs font-bold text-slate-900 bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded">S\u1eeda</button>
                        <button onclick="deleteAddress(${addr.id})" class="text-xs font-bold text-red-400 hover:bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded">X\u00f3a</button>
                    </div>
                </div>
            `).join("");
        } else {
             container.innerHTML = '<div class="col-span-full py-12 text-center text-muted">Ch\u01b0a c\u00f3 \u0111\u1ecba ch\u1ec9 n\u00e0o.</div>';
        }
    } catch(e) { console.error(e); }
}

async function startAddressAction(editId = null) {
     showAddressModal(editId);
}

// Global functions for inline onclicks
window.editAddress = (id) => showAddressModal(id);
window.deleteAddress = async (id) => {
    if(!confirm("X\u00f3a \u0111\u1ecba ch\u1ec9 n\u00e0y?")) return;
    const res = await CustomersAPI.deleteAddress(id);
    if(res.success) loadAddresses();
};
window.showAddressModal = showAddressModal; // defined below
window.closeAddressModal = closeAddressModal;
window.saveAddress = saveAddress;
window.openAddCardModal = () => document.getElementById("card-modal").classList.add("active");
window.closeCardModal = () => document.getElementById("card-modal").classList.remove("active");
window.saveCard = saveCard;
window.removeCard = removeCard;
window.markAllNotificationsRead = markAllNotificationsRead;
window.markRead = markRead;
window.removeFromWishlist = removeFromWishlist;

// Modal handling
function showAddressModal(editId = null) {
    editingAddressId = editId;
    const modal = document.getElementById("address-modal");
    modal.classList.add("active");
    if(editId) {
        const addr = myAddresses.find(a => a.id === editId);
        if(addr) {
            document.getElementById("addr-name").value = addr.recipient_name;
            document.getElementById("addr-phone").value = addr.phone;
            document.getElementById("addr-province").value = addr.province;
            document.getElementById("addr-district").value = addr.district;
            document.getElementById("addr-ward").value = addr.ward;
            document.getElementById("addr-street").value = addr.street_address;
            document.getElementById("addr-default").checked = addr.is_default;
        }
    } else {
         document.querySelectorAll("#address-modal input").forEach(i => i.value = "");
         document.getElementById("addr-default").checked = false;
    }
}

function closeAddressModal() {
    document.getElementById("address-modal").classList.remove("active");
}

async function saveAddress() {
    const data = {
        recipientName: document.getElementById("addr-name").value,
        phone: document.getElementById("addr-phone").value,
        province: document.getElementById("addr-province").value,
        district: document.getElementById("addr-district").value,
        ward: document.getElementById("addr-ward").value,
        streetAddress: document.getElementById("addr-street").value,
        isDefault: document.getElementById("addr-default").checked,
    };
    try {
        const res = editingAddressId ? await CustomersAPI.updateAddress(editingAddressId, data) : await CustomersAPI.addAddress(data);
        if(res.success) {
            closeAddressModal();
            loadAddresses();
            if (typeof showToast === 'function') showToast('\u0110\u00e3 l\u01b0u', '', 'success');
        }
        else {
            if (typeof showToast === 'function') showToast(res.message || 'L\u1ed7i', '', 'error');
            else alert(res.message || 'L\u1ed7i');
        }
    } catch(e) {
        if (typeof showToast === 'function') showToast('L\u1ed7i', '', 'error');
        else alert("L\u1ed7i");
    }
}

async function loadWishlist() {
    const container = document.getElementById("wishlist-grid");
    try {
        const res = await CustomersAPI.getWishlist();
        const items = res.data || [];

        // Setup sort
        const sortSelect = document.getElementById("wishlist-sort");
        function sortAndRender(list) {
            const val = sortSelect ? sortSelect.value : 'newest';
            let sorted = [...list];
            if (val === 'price-asc') sorted.sort((a, b) => Number(a.price) - Number(b.price));
            else if (val === 'price-desc') sorted.sort((a, b) => Number(b.price) - Number(a.price));
            else if (val === 'name') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            renderWishlistItems(sorted);
        }

        function renderWishlistItems(list) {
            if(list.length > 0) {
                container.innerHTML = list.map(item => {
                    const stockHTML = item.stock !== undefined
                        ? (item.stock > 0
                            ? `<span class="text-xs text-green-500 font-medium">C\u00f2n h\u00e0ng</span>`
                            : `<span class="text-xs text-red-500 font-medium">H\u1ebft h\u00e0ng</span>`)
                        : '';
                    const originalPriceHTML = item.original_price && Number(item.original_price) > Number(item.price)
                        ? `<span class="text-xs text-muted line-through ml-1">${formatPrice(item.original_price)}</span>`
                        : '';
                    return `
                    <div class="card p-0 overflow-hidden group">
                        <div class="aspect-square bg-gray-800 relative">
                            ${item.image ? `<img src="${item.image}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-muted"><span class="material-symbols-outlined text-4xl">image</span></div>'}
                            <button onclick="removeFromWishlist(${item.product_id})" class="absolute top-2 right-2 p-1.5 bg-white/80 shadow text-slate-900 rounded-full hover:bg-red-500 transition-colors">
                                <span class="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>
                        <div class="p-4">
                            <h3 class="font-bold text-slate-900 truncate mb-1">${item.name}</h3>
                            <div class="flex items-center gap-1 mb-2">${stockHTML}</div>
                            <div class="flex justify-between items-center">
                                <div>
                                    <span class="text-hq-primary font-bold">${formatPrice(item.price)}</span>
                                    ${originalPriceHTML}
                                </div>
                                <a href="productPage.html?id=${item.product_id}" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-900 px-2 py-1 rounded transition-colors" style="text-decoration:none;">Xem</a>
                            </div>
                        </div>
                    </div>
                    `;
                }).join("");
            } else {
                container.innerHTML = '<div class="col-span-full py-12 text-center text-muted">Ch\u01b0a c\u00f3 s\u1ea3n ph\u1ea9m y\u00eau th\u00edch.</div>';
            }
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', () => sortAndRender(items));
        }
        sortAndRender(items);
    } catch(e) {}
}

async function removeFromWishlist(id) {
    if(!confirm("X\u00f3a kh\u1ecfi danh s\u00e1ch?")) return;
    const res = await CustomersAPI.removeFromWishlist(id);
    if(res.success) loadWishlist();
}

async function loadPromotions() {
    const container = document.getElementById("promotions-list");
    try {
        const res = await PromotionsAPI.getActivePromotions();
        if(res.success && res.data && res.data.length > 0) {
            container.innerHTML = res.data.map(p => {
                const discountText = p.type === 'percentage' ? `${p.value}%` : formatPrice(p.value);
                const codeText = p.coupon_code || 'N/A';
                const endDate = p.end_date ? formatDate(p.end_date) : '';
                return `
                <div class="card p-0 flex relative overflow-hidden" style="min-height:8rem">
                     <div style="width:0.25rem;background:var(--hq-primary);flex-shrink:0;border-radius:var(--hq-radius-md) 0 0 var(--hq-radius-md);"></div>
                     <div class="flex-1 p-5 flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start gap-2">
                                <h3 class="font-bold text-slate-900">${p.name}</h3>
                                <span class="badge badge-success" style="white-space:nowrap;">Giảm ${discountText}</span>
                            </div>
                            <p class="text-muted text-xs mt-1">${p.description || 'Ưu đãi đặc biệt'}</p>
                        </div>
                        <div class="flex items-center justify-between mt-2">
                             <div style="display:flex;align-items:center;gap:0.5rem;">
                                <span class="material-symbols-outlined" style="font-size:1rem;color:var(--hq-primary)">confirmation_number</span>
                                <code style="background:var(--hq-primary-bg);color:var(--hq-primary);padding:0.25rem 0.75rem;border-radius:var(--hq-radius);font-size:0.8125rem;font-weight:600;border:1px dashed var(--hq-primary);">${codeText}</code>
                             </div>
                             ${endDate ? `<span class="text-xs text-muted">HSD: ${endDate}</span>` : ''}
                        </div>
                     </div>
                </div>`;
            }).join("");
        } else {
            container.innerHTML = '<div class="col-span-full py-12 text-center text-muted">Chưa có voucher nào.</div>';
        }
    } catch(e) { console.error(e); }
}

async function loadPaymentMethods() {
    const container = document.getElementById("saved-cards-list");
    try {
        const res = await PaymentsAPI.getSavedCards();
        if(res.success && res.data && res.data.length > 0) {
             container.innerHTML = res.data.map(card => `
                <div class="payment-card-gradient flex flex-col justify-between h-48 relative group">
                    ${card.isDefault ? '<div class="absolute top-4 right-4 text-[10px] font-bold bg-hq-primary text-white px-2 py-0.5 rounded">M\u1eb7c \u0111\u1ecbnh</div>' : ''}
                    <div class="font-bold text-slate-900 text-xl tracking-widest mt-8">\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 ${card.last4}</div>
                    <div class="flex justify-between text-sm text-slate-600">
                        <span>${card.holder}</span>
                        <span>${card.expiry}</span>
                    </div>
                    <button onclick="removeCard(${card.id})" class="absolute bottom-4 right-4 text-xs text-red-400 border border-red-500/50 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">X\u00f3a</button>
                </div>
             `).join("");
        } else {
             container.innerHTML = '<div class="col-span-full py-12 text-center text-muted">Ch\u01b0a c\u00f3 th\u1ebb n\u00e0o.</div>';
        }
    } catch(e) {}
}

async function saveCard() {
    const number = document.getElementById("card-number").value;
    const holder = document.getElementById("card-holder").value;
    const expiry = document.getElementById("card-expiry").value;
    if(!number || !holder || !expiry) {
        if (typeof showToast === 'function') showToast('Vui l\u00f2ng \u0111i\u1ec1n \u0111\u1ea7y \u0111\u1ee7', '', 'warning');
        else alert("Vui l\u00f2ng \u0111i\u1ec1n \u0111\u1ea7y \u0111\u1ee7");
        return;
    }
    try {
        // Mask card number — only store last 4 digits
        const last4 = number.replace(/\s/g, '').slice(-4);
        await PaymentsAPI.addCard({number: '****' + last4, holder, expiry, brand:"Visa", last4});
        closeCardModal();
        loadPaymentMethods();
        if (typeof showToast === 'function') showToast('\u0110\u00e3 l\u01b0u', '', 'success');
    } catch(e) {
        if (typeof showToast === 'function') showToast('Th\u1ea5t b\u1ea1i', '', 'error');
        else alert("Th\u1ea5t b\u1ea1i");
    }
}

async function removeCard(id) {
    if(confirm("X\u00f3a th\u1ebb n\u00e0y?")) {
        await PaymentsAPI.removeCard(id);
        loadPaymentMethods();
    }
}

async function loadReviews() {
    const container = document.getElementById("reviews-list");
    const res = await ReviewsAPI.getMyReviews();
    if(res.success && res.data && res.data.length > 0) {
        container.innerHTML = res.data.map(r => {
            const rating = r.rating || 0;
            const stars = Array.from({length: 5}, (_, i) => i < rating ? '\u2605' : '\u2606').join('');
            const reviewDate = r.created_at ? formatDate(r.created_at) : '';
            const reviewText = r.comment || '';
            return `
            <div class="card flex gap-4 p-4">
                 <div style="width:5rem;height:5rem;background:var(--hq-bg);border-radius:var(--hq-radius);flex-shrink:0;overflow:hidden;">
                      ${r.product_image ? `<img src="${r.product_image}" class="object-cover w-full h-full">` : '<div class="w-full h-full flex items-center justify-center text-muted"><span class="material-symbols-outlined text-2xl">image</span></div>'}
                 </div>
                 <div class="flex-1">
                      <h4 class="font-bold text-slate-900 text-sm mb-1">${r.product_name || 'Sản phẩm'}</h4>
                      <div class="flex items-center gap-2 mb-1">
                          <span class="text-yellow-400 text-sm tracking-wide">${stars}</span>
                          <span class="text-xs text-muted">${reviewDate}</span>
                      </div>
                      ${reviewText ? `<p class="text-sm text-muted">${reviewText}</p>` : '<p class="text-sm text-muted" style="font-style:italic">Không có nội dung đánh giá</p>'}
                 </div>
            </div>
            `;
        }).join("");
    } else {
        container.innerHTML = '<div class="py-12 text-center text-muted">Ch\u01b0a c\u00f3 \u0111\u00e1nh gi\u00e1 n\u00e0o.</div>';
    }
}

async function loadNotifications() {
     const container = document.getElementById("notifications-list");
     const res = await NotificationsAPI.getNotifications();
     let allNotifs = (res.success && res.data) ? res.data : [];

     function renderNotifs(list) {
         if(list.length > 0) {
              container.innerHTML = list.map(n => `
                 <div class="card p-4 flex justify-between items-start ${n.is_read ? 'opacity-60' : ''}">
                     <div>
                         <h4 class="text-sm font-bold text-slate-900">${n.title}</h4>
                         <p class="text-xs text-muted">${n.message}</p>
                         ${n.created_at ? `<span class="text-[10px] text-muted">${formatDate(n.created_at)}</span>` : ''}
                     </div>
                     ${!n.is_read ? `<button onclick="markRead(${n.id})" class="text-hq-primary"><span class="material-symbols-outlined">check_circle</span></button>` : ''}
                 </div>
              `).join("");
         } else {
             container.innerHTML = '<div class="py-12 text-center text-muted">Kh\u00f4ng c\u00f3 th\u00f4ng b\u00e1o.</div>';
         }
     }

     renderNotifs(allNotifs);

     // Setup filter tabs
     const tabs = document.querySelectorAll('.notif-tab');
     tabs.forEach(tab => {
         tab.addEventListener('click', () => {
             tabs.forEach(t => { t.classList.remove('btn-primary'); t.classList.add('btn-secondary'); t.classList.remove('active'); });
             tab.classList.remove('btn-secondary');
             tab.classList.add('btn-primary', 'active');
             const filter = tab.getAttribute('data-filter');
             if (filter === 'all') {
                 renderNotifs(allNotifs);
             } else if (filter === 'order') {
                 renderNotifs(allNotifs.filter(n => (n.type === 'order') || (n.title && (n.title.toLowerCase().includes('order') || n.title.toLowerCase().includes('\u0111\u01a1n')))));
             } else if (filter === 'promo') {
                 renderNotifs(allNotifs.filter(n => (n.type === 'promo') || (n.title && (n.title.toLowerCase().includes('promo') || n.title.toLowerCase().includes('voucher') || n.title.toLowerCase().includes('khuy\u1ebfn')))));
             } else if (filter === 'system') {
                 renderNotifs(allNotifs.filter(n => (n.type === 'system') || (n.title && (n.title.toLowerCase().includes('system') || n.title.toLowerCase().includes('h\u1ec7 th\u1ed1ng')))));
             }
         });
     });
}

async function markAllNotificationsRead() {
    await NotificationsAPI.markAllAsRead();
    loadNotifications();
}
async function markRead(id) {
    await NotificationsAPI.markAsRead(id);
    loadNotifications();
}

async function loadHelp() {
    const container = document.getElementById("tickets-list");
    try {
         const data = await SupportAPI.getUserTickets();
         if(data.success && data.data && data.data.length > 0) {
             container.innerHTML = data.data.map(t => {
                 const statusBadge = getStatusBadgeClass(t.status);
                 return `
                 <div class="card p-3 border border-slate-200 bg-slate-50 flex justify-between">
                     <div>
                         <div class="text-sm font-bold text-slate-900">${t.subject}</div>
                         <div class="text-[10px] mt-1"><span class="badge ${statusBadge}">${getStatusLabel(t.status) || t.status}</span></div>
                     </div>
                     <a href="ticketPage.html?id=${t.id}" class="text-xs text-hq-primary" style="text-decoration:none;">Xem</a>
                 </div>
                 `;
             }).join("");
         } else {
             container.innerHTML = '<div class="text-center text-muted text-xs">Ch\u01b0a c\u00f3 y\u00eau c\u1ea7u h\u1ed7 tr\u1ee3.</div>';
         }
    } catch(e){}
}

function escapeHtmlCustomer(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

async function loadMessages() {
    const container = document.getElementById("messages-list");
    if (!container) return;
    try {
        const data = await SupportAPI.getUserTickets();
        if (data.success && data.data && data.data.length > 0) {
            container.innerHTML = '';
            data.data.forEach(t => {
                const card = document.createElement('div');
                card.className = 'card p-3 border border-slate-200 bg-slate-50';
                card.style.cssText = 'cursor:pointer;transition:background 0.15s;';
                card.onmouseenter = function() { this.style.background = '#F1F5F9'; };
                card.onmouseleave = function() { this.style.background = ''; };

                const topRow = document.createElement('div');
                topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;';

                const infoDiv = document.createElement('div');
                infoDiv.style.cssText = 'flex:1;min-width:0;';
                const subjectEl = document.createElement('div');
                subjectEl.className = 'text-sm font-bold text-slate-900';
                subjectEl.textContent = t.subject;
                subjectEl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
                const metaEl = document.createElement('div');
                metaEl.style.cssText = 'font-size:0.6875rem;color:#94A3B8;margin-top:0.25rem;';
                metaEl.textContent = formatDate(t.created_at);
                infoDiv.appendChild(subjectEl);
                infoDiv.appendChild(metaEl);

                const statusBadge = getStatusBadgeClass(t.status);
                const badgeEl = document.createElement('span');
                badgeEl.className = 'badge ' + statusBadge;
                badgeEl.style.cssText = 'font-size:0.625rem;flex-shrink:0;margin-left:0.5rem;';
                badgeEl.textContent = getStatusLabel(t.status) || t.status;

                topRow.appendChild(infoDiv);
                topRow.appendChild(badgeEl);

                // Last message preview
                const previewEl = document.createElement('div');
                previewEl.style.cssText = 'font-size:0.75rem;color:#64748B;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:0.5rem;';
                previewEl.textContent = t.last_message || '';

                card.appendChild(topRow);
                card.appendChild(previewEl);
                card.onclick = function() { window.location.href = 'ticketPage.html?id=' + t.id; };
                container.appendChild(card);
            });
        } else {
            container.innerHTML = '<div class="text-center text-muted text-xs" style="padding:2rem 0;">Chua co cuoc tro chuyen nao.</div>';
        }
    } catch(e) {
        container.innerHTML = '<div class="text-center text-muted text-xs" style="padding:2rem 0;">Loi tai du lieu.</div>';
    }
}

async function viewOrderDetails(id) {
    const res = await OrdersAPI.getOrder(id);
    if(!res.success || !res.data) { if(typeof showToast==='function') showToast('Lỗi','Không tìm thấy đơn hàng','error'); return; }
    const order = res.data;
    const orderNum = order.order_number || '#' + order.id;

    // Timeline
    const steps = ['pending','processing','shipping','delivered'];
    const stepLabels = {pending:'Đặt hàng',processing:'Xác nhận',shipping:'Đang giao',delivered:'Đã giao'};
    const stepIcons = {pending:'receipt_long',processing:'check_circle',shipping:'local_shipping',delivered:'inventory'};
    const curIdx = order.status==='cancelled' ? -1 : steps.indexOf(order.status);
    const timelineHTML = order.status==='cancelled'
      ? '<div style="text-align:center;padding:1rem;background:var(--hq-sale-bg,#FEF2F2);border-radius:var(--hq-radius-md,0.75rem);"><span class="material-symbols-outlined" style="color:var(--hq-sale);font-size:1.5rem;vertical-align:middle;">cancel</span> <span style="font-weight:700;color:var(--hq-sale);margin-left:0.25rem;">Đơn hàng đã bị hủy</span></div>'
      : `<div style="display:flex;align-items:flex-start;position:relative;padding:0 1rem;">
          <div style="position:absolute;top:1rem;left:calc(12.5% + 1rem);right:calc(12.5% + 1rem);height:2px;background:var(--hq-border,#e2e8f0);z-index:0;"></div>
          <div style="position:absolute;top:1rem;left:calc(12.5% + 1rem);height:2px;background:var(--hq-success,#10B981);z-index:1;width:${curIdx >= 0 ? (curIdx / (steps.length - 1)) * 75 : 0}%;transition:width 0.5s;"></div>
          ${steps.map((s,i) => {
            const done = i <= curIdx;
            const current = i === curIdx;
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;position:relative;z-index:2;">
              <div style="width:2.25rem;height:2.25rem;border-radius:50%;display:flex;align-items:center;justify-content:center;${done ? 'background:var(--hq-success,#10B981);color:#fff;box-shadow:0 0 0 3px rgba(16,185,129,0.15);' : 'background:var(--hq-bg-white,#fff);color:var(--hq-text-light,#94a3b8);border:2px solid var(--hq-border,#e2e8f0);'}">
                <span class="material-symbols-outlined" style="font-size:1.125rem">${done ? 'check' : stepIcons[s]}</span>
              </div>
              <span style="font-size:0.6875rem;margin-top:0.375rem;font-weight:${current?'700':'500'};color:${done?'var(--hq-text,#0f172a)':'var(--hq-text-light,#94a3b8)'};text-align:center;">${stepLabels[s]}</span>
            </div>`;
          }).join('')}
        </div>`;

    // Shipping address
    const addr = order.shipping_address || {};
    const addrParts = [addr.street_address || addr.address, addr.ward, addr.district, addr.province || addr.city].filter(Boolean);
    const addrHTML = (addr.name || addr.recipient_name)
      ? `<div style="padding:0.875rem;background:var(--hq-bg,#F8FAFC);border-radius:var(--hq-radius,0.5rem);border:1px solid var(--hq-border,#E2E8F0);">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.375rem;"><span class="material-symbols-outlined" style="font-size:1rem;color:var(--hq-primary,#2563EB)">location_on</span><span style="font-size:0.75rem;font-weight:600;color:var(--hq-text-muted,#64748B);text-transform:uppercase;letter-spacing:0.04em;">Địa chỉ giao hàng</span></div>
          <div style="font-size:0.875rem;font-weight:600;color:var(--hq-text,#0f172a);">${addr.name || addr.recipient_name}${addr.phone ? ' | ' + addr.phone : ''}</div>
          ${addrParts.length ? '<div style="font-size:0.8125rem;color:var(--hq-text-secondary,#334155);margin-top:0.125rem;">' + addrParts.join(', ') + '</div>' : ''}
        </div>`
      : '';

    // Shop info
    const shopHTML = order.shop_name
      ? `<div style="display:flex;align-items:center;gap:0.625rem;padding:0.75rem;background:var(--hq-bg,#F8FAFC);border-radius:var(--hq-radius,0.5rem);border:1px solid var(--hq-border,#E2E8F0);">
          <div style="width:2rem;height:2rem;border-radius:50%;background:var(--hq-primary-light,#DBEAFE);display:flex;align-items:center;justify-content:center;"><span class="material-symbols-outlined" style="font-size:1rem;color:var(--hq-primary,#2563EB)">store</span></div>
          <span style="font-size:0.875rem;font-weight:600;color:var(--hq-text,#0f172a);">${order.shop_name}</span>
        </div>`
      : '';

    // Items
    const itemsHTML = (order.items || []).map(i => `
      <div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0;border-bottom:1px solid var(--hq-border-light,#F1F5F9);">
        <div style="width:3.5rem;height:3.5rem;border-radius:var(--hq-radius,0.5rem);overflow:hidden;flex-shrink:0;background:var(--hq-bg,#F8FAFC);border:1px solid var(--hq-border,#E2E8F0);">
          ${i.image ? '<img src="' + i.image + '" style="width:100%;height:100%;object-fit:cover;">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--hq-text-light,#94a3b8);"><span class="material-symbols-outlined" style="font-size:1.25rem">image</span></div>'}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.875rem;font-weight:500;color:var(--hq-text,#0f172a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i.product_name}</div>
          <div style="font-size:0.75rem;color:var(--hq-text-muted,#64748B);">x${i.quantity}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:0.875rem;font-weight:600;color:var(--hq-text,#0f172a);">${formatPrice(i.price * i.quantity)}</div>
          ${i.quantity > 1 ? '<div style="font-size:0.6875rem;color:var(--hq-text-light,#94a3b8);">' + formatPrice(i.price) + ' / sp</div>' : ''}
        </div>
      </div>`).join('');

    // Payment summary
    const payLabels = {cod:'Thanh toán khi nhận hàng',card:'Thẻ tín dụng',bank_transfer:'Chuyển khoản',e_wallet:'Ví điện tử'};
    const paymentHTML = `
      <div style="background:var(--hq-bg,#F8FAFC);border-radius:var(--hq-radius,0.5rem);padding:0.875rem;border:1px solid var(--hq-border,#E2E8F0);">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.625rem;"><span class="material-symbols-outlined" style="font-size:1rem;color:var(--hq-primary,#2563EB)">receipt</span><span style="font-size:0.75rem;font-weight:600;color:var(--hq-text-muted,#64748B);text-transform:uppercase;letter-spacing:0.04em;">Chi tiết thanh toán</span></div>
        <div style="display:flex;justify-content:space-between;font-size:0.8125rem;color:var(--hq-text-secondary,#334155);padding:0.25rem 0;"><span>Tạm tính</span><span>${formatPrice(order.subtotal || order.total_amount)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:0.8125rem;color:var(--hq-text-secondary,#334155);padding:0.25rem 0;"><span>Phí vận chuyển</span><span>${order.shipping_fee ? formatPrice(order.shipping_fee) : 'Miễn phí'}</span></div>
        ${order.discount_amount > 0 ? '<div style="display:flex;justify-content:space-between;font-size:0.8125rem;color:var(--hq-success,#10B981);padding:0.25rem 0;"><span>Giảm giá</span><span>-' + formatPrice(order.discount_amount) + '</span></div>' : ''}
        <div style="border-top:1px dashed var(--hq-border,#E2E8F0);margin:0.5rem 0;padding-top:0.5rem;display:flex;justify-content:space-between;">
          <span style="font-size:0.9375rem;font-weight:700;color:var(--hq-text,#0f172a);">Tổng thanh toán</span>
          <span style="font-size:1.125rem;font-weight:800;color:var(--hq-primary,#2563EB);">${formatPrice(order.total_amount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--hq-text-muted,#64748B);margin-top:0.25rem;"><span>Phương thức</span><span>${payLabels[order.payment_method] || order.payment_method || 'COD'}</span></div>
      </div>`;

    // Tracking
    let trackingHTML = '';
    if (order.tracking && order.tracking.length > 0) {
      trackingHTML = '<div>' +
        '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.625rem;"><span class="material-symbols-outlined" style="font-size:1rem;color:var(--hq-primary,#2563EB)">local_shipping</span><span style="font-size:0.75rem;font-weight:600;color:var(--hq-text-muted,#64748B);text-transform:uppercase;letter-spacing:0.04em;">Theo dõi vận chuyển</span></div>' +
        '<div style="padding-left:0.5rem;border-left:2px solid var(--hq-border,#E2E8F0);">' +
        order.tracking.map((t, idx) =>
          '<div style="position:relative;padding:0.375rem 0 0.625rem 1.25rem;">' +
          '<div style="position:absolute;left:-0.3125rem;top:0.5rem;width:0.5rem;height:0.5rem;border-radius:50%;' + (idx===0?'background:var(--hq-primary,#2563EB);box-shadow:0 0 0 3px rgba(37,99,235,0.15);':'background:var(--hq-border,#E2E8F0);') + '"></div>' +
          '<div style="font-size:0.8125rem;' + (idx===0?'font-weight:600;color:var(--hq-text,#0f172a);':'color:var(--hq-text-secondary,#334155);') + '">' + (t.description || t.status) + '</div>' +
          '<div style="font-size:0.6875rem;color:var(--hq-text-light,#94a3b8);margin-top:0.125rem;">' + (t.location ? t.location + ' — ' : '') + formatDate(t.created_at) + '</div>' +
          '</div>'
        ).join('') +
        '</div></div>';
    }

    // Actions
    let actionsHTML = '';
    if (order.status === 'delivered' || order.status === 'completed') {
      actionsHTML = '<div style="display:flex;gap:0.5rem;padding-top:0.75rem;border-top:1px solid var(--hq-border,#E2E8F0);">' +
        '<a href="productPage.html" style="flex:1;display:flex;align-items:center;justify-content:center;gap:0.375rem;padding:0.625rem;border:1px solid var(--hq-border,#E2E8F0);border-radius:var(--hq-radius,0.5rem);font-size:0.8125rem;font-weight:600;color:var(--hq-text-secondary,#334155);text-decoration:none;"><span class="material-symbols-outlined" style="font-size:1rem">shopping_cart</span>Mua lại</a>' +
        '<button onclick="openReviewModal(' + order.id + ')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:0.375rem;padding:0.625rem;background:var(--hq-primary,#2563EB);color:#fff;border:none;border-radius:var(--hq-radius,0.5rem);font-size:0.8125rem;font-weight:600;cursor:pointer;"><span class="material-symbols-outlined" style="font-size:1rem">rate_review</span>Viết đánh giá</button></div>';
    } else if (order.status === 'pending') {
      actionsHTML = '<div style="padding-top:0.75rem;border-top:1px solid var(--hq-border,#E2E8F0);">' +
        '<button onclick="cancelOrder(' + order.id + ')" style="width:100%;padding:0.625rem;border:1px solid var(--hq-sale,#EF4444);color:var(--hq-sale,#EF4444);background:none;border-radius:var(--hq-radius,0.5rem);font-size:0.8125rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.375rem;"><span class="material-symbols-outlined" style="font-size:1rem">cancel</span>Hủy đơn hàng</button></div>';
    }

    const modal = document.createElement("div");
    modal.className = "modal active";
    modal.id = "order-details-modal";
    modal.innerHTML =
      '<div class="modal-backdrop" onclick="this.parentElement.remove()"></div>' +
      '<div class="modal-dialog" style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem;">' +
        '<div style="background:var(--hq-bg-white,#fff);border:1px solid var(--hq-border,#E2E8F0);border-radius:var(--hq-radius-lg,1rem);width:100%;max-width:32rem;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,0.1);">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid var(--hq-border,#E2E8F0);">' +
            '<div><h3 style="font-size:1rem;font-weight:700;color:var(--hq-text,#0f172a);margin:0;">Đơn hàng ' + orderNum + '</h3><p style="font-size:0.75rem;color:var(--hq-text-muted,#64748B);margin:0.125rem 0 0;">Ngày đặt: ' + formatDate(order.created_at) + '</p></div>' +
            '<button onclick="document.getElementById(\'order-details-modal\').remove()" style="color:var(--hq-text-muted,#64748B);padding:0.25rem;"><span class="material-symbols-outlined">close</span></button>' +
          '</div>' +
          '<div style="overflow-y:auto;flex:1;padding:1.25rem;display:flex;flex-direction:column;gap:1rem;">' +
            timelineHTML + addrHTML + shopHTML +
            '<div><div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;"><span class="material-symbols-outlined" style="font-size:1rem;color:var(--hq-primary,#2563EB)">inventory_2</span><span style="font-size:0.75rem;font-weight:600;color:var(--hq-text-muted,#64748B);text-transform:uppercase;letter-spacing:0.04em;">Sản phẩm (' + (order.items||[]).length + ')</span></div>' + itemsHTML + '</div>' +
            paymentHTML + trackingHTML + actionsHTML +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
}

// Cancel order
window.cancelOrder = async function(id) {
    if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
    try {
        const res = await OrdersAPI.cancelOrder(id);
        if (res.success) {
            if(typeof showToast==='function') showToast('Thành công','Đã hủy đơn hàng','success');
            document.getElementById('order-details-modal')?.remove();
            loadOrders();
        } else {
            if(typeof showToast==='function') showToast('Lỗi', res.message || 'Không thể hủy','error');
        }
    } catch(e) { if(typeof showToast==='function') showToast('Lỗi', e.message,'error'); }
};

function setupActionButtons() {
    // No specific listeners needed now as logic is handled
}

async function saveProfileChanges() {
     const firstName = document.getElementById("inp-first-name")?.value;
     const lastName = document.getElementById("inp-last-name")?.value;
     const phone = document.getElementById("inp-phone")?.value;
     await CustomersAPI.updateProfile({firstName, lastName, phone});

     if (typeof showToast === 'function') showToast('\u0110\u00e3 l\u01b0u', '', 'success');
     else alert("\u0110\u00e3 l\u01b0u");
}

// Make globally available
window.saveProfileChanges = saveProfileChanges;

async function loadNavNotifications() {
    try {
        const res = await NotificationsAPI.getNotifications();
        if (res.success && res.data) {
            const notifs = res.data;
            const unreadCount = notifs.filter(n => !n.is_read).length;

            // Update Badge
            const badge = document.getElementById("nav-notif-badge");
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount;
                    badge.classList.remove("hidden");
                } else {
                    badge.classList.add("hidden");
                }
            }

            // Update Dropdown List
            const list = document.getElementById("nav-notif-list");
            if (list) {
                if (notifs.length === 0) {
                    list.innerHTML = '<div class="p-4 text-center text-xs text-muted">Kh\u00f4ng c\u00f3 th\u00f4ng b\u00e1o</div>';
                } else {
                    list.innerHTML = notifs.slice(0, 5).map(n => `
                        <div class="p-3 border-b border-slate-200 hover:bg-slate-50 transition-colors ${n.is_read ? 'opacity-50' : ''}">
                            <p class="text-xs font-bold text-slate-900 mb-1">${n.title}</p>
                            <p class="text-[10px] text-muted line-clamp-2">${n.message}</p>
                        </div>
                    `).join("");
                }
            }
        }
    } catch (e) {
        console.error("Failed to load nav notifications", e);
    }
}
window.loadNavNotifications = loadNavNotifications;

// ===== REVIEW MODAL =====
let reviewOrderId = null;
let reviewRating = 5;

window.openReviewModal = async function(orderId) {
  reviewOrderId = orderId;
  reviewRating = 5;

  // Fetch order to get items
  try {
    const res = await OrdersAPI.getOrder(orderId);
    if (!res.success) { showToast('Lỗi', 'Không thể tải đơn hàng', 'error'); return; }
    const order = res.data;

    // Build product selector
    const itemOptions = (order.items || []).map(item =>
      `<option value="${item.product_id}">${item.product_name || 'Sản phẩm #' + item.product_id}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'review-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="closeReviewModal()"></div>
      <div class="modal-dialog" style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem;">
        <div class="card" style="width:100%;max-width:28rem;padding:1.5rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
            <h3 class="card-title" style="margin:0;">Viết đánh giá</h3>
            <button onclick="closeReviewModal()" style="color:var(--hq-text-muted)"><span class="material-symbols-outlined">close</span></button>
          </div>
          <div class="form-group">
            <label class="form-label">Sản phẩm</label>
            <select id="review-product" class="form-input">${itemOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Đánh giá</label>
            <div id="review-stars" style="display:flex;gap:0.25rem;font-size:1.75rem;cursor:pointer;color:var(--hq-rating);">
              ${[1,2,3,4,5].map(i => `<span onclick="setReviewRating(${i})" data-star="${i}" style="transition:transform 0.15s;" onmouseenter="this.style.transform='scale(1.2)'" onmouseleave="this.style.transform='scale(1)'">★</span>`).join('')}
            </div>
            <p id="review-rating-text" style="font-size:0.75rem;color:var(--hq-text-muted);margin-top:0.25rem;">Tuyệt vời</p>
          </div>
          <div class="form-group">
            <label class="form-label">Nhận xét</label>
            <textarea id="review-comment" class="form-input" rows="4" placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm..." style="resize:vertical;"></textarea>
          </div>
          <button onclick="submitReview()" class="btn-primary" style="width:100%;padding:0.75rem;border-radius:var(--hq-radius);">
            <span class="material-symbols-outlined" style="font-size:1rem;vertical-align:middle;">send</span> Gửi đánh giá
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch(e) { showToast('Lỗi', 'Không thể mở form đánh giá', 'error'); }
};

window.setReviewRating = function(rating) {
  reviewRating = rating;
  const labels = {1: 'Tệ', 2: 'Không hài lòng', 3: 'Bình thường', 4: 'Hài lòng', 5: 'Tuyệt vời'};
  document.getElementById('review-rating-text').textContent = labels[rating] || '';
  document.querySelectorAll('#review-stars span').forEach(s => {
    const star = parseInt(s.dataset.star);
    s.style.color = star <= rating ? 'var(--hq-rating)' : '#CBD5E1';
  });
};

window.submitReview = async function() {
  const productId = document.getElementById('review-product').value;
  const comment = document.getElementById('review-comment').value.trim();
  if (!productId) { showToast('Cảnh báo', 'Vui lòng chọn sản phẩm', 'warning'); return; }
  if (!comment) { showToast('Cảnh báo', 'Vui lòng nhập nhận xét', 'warning'); return; }
  try {
    const res = await ReviewsAPI.createReview({ productId: parseInt(productId), rating: reviewRating, comment, order_id: reviewOrderId });
    if (res.success) {
      showToast('Thành công', 'Đánh giá đã được gửi!', 'success');
      closeReviewModal();
    } else {
      showToast('Lỗi', res.message || 'Không thể gửi đánh giá', 'error');
    }
  } catch(e) { showToast('Lỗi', e.message || 'Lỗi khi gửi đánh giá', 'error'); }
};

window.closeReviewModal = function() {
  const modal = document.getElementById('review-modal');
  if (modal) modal.remove();
};
