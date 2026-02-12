/**
 * ============================================================
 * Office Management System — Frontend JavaScript
 * ============================================================
 * Handles: API calls, Auth, CRUD, File uploads, UI navigation
 * ============================================================
 */

// ============================================================
// 🔧 CONFIGURATION — เปลี่ยน URL นี้เป็น Web App URL ของคุณ
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbx-0oVcXcEc4_0EUPfxBg_aDVsZD9QIhW-J-G0cP9CpntkzRevq0pDcms5HdbMrdXns_w/exec';

// ============================================================
// 🏗️ APP STATE
// ============================================================
const AppState = {
    user: null,
    announcements: [],
    vehicleLogs: [],

    /** Load user from localStorage */
    loadUser() {
        const saved = localStorage.getItem('omsUser');
        if (saved) {
            this.user = JSON.parse(saved);
            return true;
        }
        return false;
    },

    /** Save user to localStorage */
    saveUser(userData) {
        this.user = userData;
        localStorage.setItem('omsUser', JSON.stringify(userData));
    },

    /** Clear user session */
    clearUser() {
        this.user = null;
        localStorage.removeItem('omsUser');
    },

    /** Check if user is Admin */
    isAdmin() {
        return this.user && this.user.role === 'Admin';
    }
};

// ============================================================
// 📡 API SERVICE
// ============================================================
const API = {
    /**
     * GET request to GAS Web App
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>}
     */
    async get(params) {
        const query = new URLSearchParams(params).toString();
        const url = `${API_URL}?${query}`;
        try {
            const res = await fetch(url);
            return await res.json();
        } catch (err) {
            console.error('API GET Error:', err);
            return { success: false, error: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' };
        }
    },

    /**
     * POST request to GAS Web App
     * @param {Object} body - JSON body
     * @returns {Promise<Object>}
     */
    async post(body) {
        // Attach credentials for admin operations
        if (AppState.user) {
            body.username = AppState.user.username;
            body.password = AppState.user.password;
        }
        try {
            // NOTE: GAS Web App ไม่ support preflight CORS (OPTIONS request)
            // ดังนั้นต้องใช้ Content-Type: text/plain เพื่อหลีกเลี่ยง preflight
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(body),
                redirect: 'follow'
            });
            return await res.json();
        } catch (err) {
            console.error('API POST Error:', err);
            return { success: false, error: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' };
        }
    }
};

// ============================================================
// 🔐 AUTH MODULE
// ============================================================
const Auth = {
    /** Handle login form submission */
    async login() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!username || !password) {
            showToast('กรุณากรอก Username และ Password', 'error');
            return;
        }

        const loginBtn = document.getElementById('loginBtn');
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังเข้าสู่ระบบ...';

        const result = await API.get({ action: 'login', username, password });

        if (result.success) {
            // Save password for subsequent admin API calls
            result.password = password;
            AppState.saveUser(result);
            showToast(`ยินดีต้อนรับ, ${result.name}!`, 'success');
            showApp();
        } else {
            showToast(result.error || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
        }

        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>เข้าสู่ระบบ';
    },

    /** Handle logout */
    logout() {
        AppState.clearUser();
        showLogin();
        showToast('ออกจากระบบแล้ว', 'info');
    }
};

// ============================================================
// 📢 ANNOUNCEMENTS MODULE
// ============================================================
const Announcements = {
    /** Fetch and render all announcements */
    async load() {
        const container = document.getElementById('announcementsTableBody');
        container.innerHTML = loadingHTML();

        const result = await API.get({ action: 'getAnnouncements' });

        if (result.success) {
            AppState.announcements = result.data;
            this.render(result.data);
        } else {
            container.innerHTML = emptyHTML('ไม่สามารถโหลดข้อมูลได้');
        }
    },

    /** Render announcements table */
    render(data) {
        const container = document.getElementById('announcementsTableBody');

        if (!data || data.length === 0) {
            container.innerHTML = `<tr><td colspan="6">${emptyHTML('ยังไม่มีข่าวประชาสัมพันธ์')}</td></tr>`;
            return;
        }

        container.innerHTML = data.map((item, index) => `
      <tr class="fade-in" style="animation-delay: ${index * 0.05}s">
        <td><span style="color: var(--text-muted); font-size: 12px;">${index + 1}</span></td>
        <td>${escapeHtml(item.Date || '')}</td>
        <td>
          <strong>${escapeHtml(item.Title || '')}</strong>
          <br><small class="text-muted">${truncate(item.Detail || '', 60)}</small>
        </td>
        <td>${item.FileURL ? `<a href="${item.FileURL}" target="_blank" class="file-link"><i class="fas fa-paperclip"></i> ดูไฟล์</a>` : '<span style="color: var(--text-muted);">-</span>'}</td>
        <td><small>${escapeHtml(item.PostedBy || '')}</small></td>
        <td>
          <button class="btn btn-outline-custom btn-sm me-1" onclick="Announcements.showDetail('${item.ID}')" title="ดูรายละเอียด">
            <i class="fas fa-eye"></i>
          </button>
          ${AppState.isAdmin() ? `
          <button class="btn btn-outline-custom btn-sm me-1" onclick="Announcements.showEdit('${item.ID}')" title="แก้ไข">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger-custom btn-sm" onclick="Announcements.confirmDelete('${item.ID}')" title="ลบ">
            <i class="fas fa-trash"></i>
          </button>
          ` : ''}
        </td>
      </tr>
    `).join('');
    },

    /** Show detail modal */
    showDetail(id) {
        const item = AppState.announcements.find(a => a.ID === id);
        if (!item) return;

        document.getElementById('detailModalTitle').textContent = item.Title;
        document.getElementById('detailModalBody').innerHTML = `
      <p><strong>วันที่:</strong> ${item.Date}</p>
      <p><strong>โพสต์โดย:</strong> ${item.PostedBy}</p>
      ${item.FileURL ? `<p><strong>ไฟล์แนบ:</strong> <a href="${item.FileURL}" target="_blank" class="file-link"><i class="fas fa-download"></i> ดาวน์โหลดไฟล์</a></p>` : ''}
      <hr style="border-color: var(--border-color);">
      <div class="detail-text">${escapeHtml(item.Detail || 'ไม่มีรายละเอียด')}</div>
    `;
        new bootstrap.Modal(document.getElementById('detailModal')).show();
    },

    /** Show add form modal */
    showAdd() {
        document.getElementById('annFormTitle').textContent = 'เพิ่มข่าวใหม่';
        document.getElementById('annFormId').value = '';
        document.getElementById('annTitle').value = '';
        document.getElementById('annDetail').value = '';
        document.getElementById('annFile').value = '';
        document.getElementById('annFileURL').value = '';
        new bootstrap.Modal(document.getElementById('annFormModal')).show();
    },

    /** Show edit form modal */
    showEdit(id) {
        const item = AppState.announcements.find(a => a.ID === id);
        if (!item) return;

        document.getElementById('annFormTitle').textContent = 'แก้ไขข่าว';
        document.getElementById('annFormId').value = item.ID;
        document.getElementById('annTitle').value = item.Title || '';
        document.getElementById('annDetail').value = item.Detail || '';
        document.getElementById('annFile').value = '';
        document.getElementById('annFileURL').value = item.FileURL || '';
        new bootstrap.Modal(document.getElementById('annFormModal')).show();
    },

    /** Save announcement (add or update) */
    async save() {
        const id = document.getElementById('annFormId').value;
        const title = document.getElementById('annTitle').value.trim();
        const detail = document.getElementById('annDetail').value.trim();
        let fileURL = document.getElementById('annFileURL').value;
        const fileInput = document.getElementById('annFile');

        if (!title) {
            showToast('กรุณากรอกหัวข้อข่าว', 'error');
            return;
        }

        // Handle file upload if selected
        if (fileInput.files.length > 0) {
            showToast('กำลังอัปโหลดไฟล์...', 'info');
            const uploadResult = await uploadFile(fileInput.files[0]);
            if (uploadResult.success) {
                fileURL = uploadResult.fileURL;
            } else {
                showToast(uploadResult.error || 'อัปโหลดไฟล์ล้มเหลว', 'error');
                return;
            }
        }

        const action = id ? 'updateAnnouncement' : 'addAnnouncement';
        const payload = { action, title, detail, fileURL };
        if (id) payload.id = id;

        const result = await API.post(payload);

        if (result.success) {
            showToast(result.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('annFormModal')).hide();
            this.load();
            Dashboard.load(); // Refresh dashboard counts
        } else {
            showToast(result.error, 'error');
        }
    },

    /** Confirm and delete announcement */
    async confirmDelete(id) {
        if (!confirm('ต้องการลบข่าวนี้หรือไม่?')) return;

        const result = await API.post({ action: 'deleteAnnouncement', id });

        if (result.success) {
            showToast(result.message, 'success');
            this.load();
            Dashboard.load();
        } else {
            showToast(result.error, 'error');
        }
    }
};

// ============================================================
// 🚗 VEHICLE LOGS MODULE
// ============================================================
const VehicleLogs = {
    /** Fetch and render all vehicle logs */
    async load() {
        const container = document.getElementById('vehicleTableBody');
        container.innerHTML = loadingHTML();

        const result = await API.get({ action: 'getVehicleLogs' });

        if (result.success) {
            AppState.vehicleLogs = result.data;
            this.render(result.data);
        } else {
            container.innerHTML = emptyHTML('ไม่สามารถโหลดข้อมูลได้');
        }
    },

    /** Render vehicle logs table */
    render(data) {
        const container = document.getElementById('vehicleTableBody');

        if (!data || data.length === 0) {
            container.innerHTML = `<tr><td colspan="9">${emptyHTML('ยังไม่มีบันทึกการใช้รถ')}</td></tr>`;
            return;
        }

        container.innerHTML = data.map((item, index) => `
      <tr class="fade-in" style="animation-delay: ${index * 0.05}s">
        <td><span style="color: var(--text-muted); font-size: 12px;">${index + 1}</span></td>
        <td>${escapeHtml(item.Date || '')}</td>
        <td><strong>${escapeHtml(item.CarLicense || '')}</strong></td>
        <td>${escapeHtml(item.Destination || '')}</td>
        <td class="text-end">${formatNumber(item.MileageStart)}</td>
        <td class="text-end">${formatNumber(item.MileageEnd)}</td>
        <td>${escapeHtml(item.Driver || '')}</td>
        <td><span class="badge-status badge-${(item.Status || '').toLowerCase()}">${escapeHtml(item.Status || '')}</span></td>
        <td>
          ${AppState.isAdmin() ? `
          <button class="btn btn-outline-custom btn-sm me-1" onclick="VehicleLogs.showEdit('${item.ID}')" title="แก้ไข">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger-custom btn-sm" onclick="VehicleLogs.confirmDelete('${item.ID}')" title="ลบ">
            <i class="fas fa-trash"></i>
          </button>
          ` : ''}
        </td>
      </tr>
    `).join('');
    },

    /** Show add form modal */
    showAdd() {
        document.getElementById('vehFormTitle').textContent = 'เพิ่มบันทึกการใช้รถ';
        document.getElementById('vehFormId').value = '';
        document.getElementById('vehDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('vehCarLicense').value = '';
        document.getElementById('vehDestination').value = '';
        document.getElementById('vehMileageStart').value = '';
        document.getElementById('vehMileageEnd').value = '';
        document.getElementById('vehDriver').value = '';
        document.getElementById('vehStatus').value = 'Active';
        new bootstrap.Modal(document.getElementById('vehFormModal')).show();
    },

    /** Show edit form modal */
    showEdit(id) {
        const item = AppState.vehicleLogs.find(v => v.ID === id);
        if (!item) return;

        document.getElementById('vehFormTitle').textContent = 'แก้ไขบันทึกการใช้รถ';
        document.getElementById('vehFormId').value = item.ID;
        document.getElementById('vehDate').value = item.Date || '';
        document.getElementById('vehCarLicense').value = item.CarLicense || '';
        document.getElementById('vehDestination').value = item.Destination || '';
        document.getElementById('vehMileageStart').value = item.MileageStart || '';
        document.getElementById('vehMileageEnd').value = item.MileageEnd || '';
        document.getElementById('vehDriver').value = item.Driver || '';
        document.getElementById('vehStatus').value = item.Status || 'Active';
        new bootstrap.Modal(document.getElementById('vehFormModal')).show();
    },

    /** Save vehicle log (add or update) */
    async save() {
        const id = document.getElementById('vehFormId').value;
        const date = document.getElementById('vehDate').value;
        const carLicense = document.getElementById('vehCarLicense').value.trim();
        const destination = document.getElementById('vehDestination').value.trim();
        const mileageStart = document.getElementById('vehMileageStart').value;
        const mileageEnd = document.getElementById('vehMileageEnd').value;
        const driver = document.getElementById('vehDriver').value.trim();
        const status = document.getElementById('vehStatus').value;

        if (!date || !carLicense || !destination || !driver) {
            showToast('กรุณากรอกข้อมูลที่จำเป็น', 'error');
            return;
        }

        const action = id ? 'updateVehicleLog' : 'addVehicleLog';
        const payload = { action, date, carLicense, destination, mileageStart, mileageEnd, driver, status };
        if (id) payload.id = id;

        const result = await API.post(payload);

        if (result.success) {
            showToast(result.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('vehFormModal')).hide();
            this.load();
            Dashboard.load();
        } else {
            showToast(result.error, 'error');
        }
    },

    /** Confirm and delete vehicle log */
    async confirmDelete(id) {
        if (!confirm('ต้องการลบบันทึกนี้หรือไม่?')) return;

        const result = await API.post({ action: 'deleteVehicleLog', id });

        if (result.success) {
            showToast(result.message, 'success');
            this.load();
            Dashboard.load();
        } else {
            showToast(result.error, 'error');
        }
    }
};

// ============================================================
// 📊 DASHBOARD MODULE
// ============================================================
const Dashboard = {
    async load() {
        const result = await API.get({ action: 'getDashboard' });
        if (result.success) {
            animateCounter('statAnnouncements', result.totalAnnouncements || 0);
            animateCounter('statVehicleLogs', result.totalVehicleLogs || 0);
            animateCounter('statActiveVehicles', result.activeVehicles || 0);
        }
    }
};

// ============================================================
// 📁 FILE UPLOAD HELPER
// ============================================================

/**
 * Upload a File via Base64 to GAS → Google Drive
 * @param {File} file
 * @returns {Promise<Object>}
 */
async function uploadFile(file) {
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        return { success: false, error: 'ไฟล์ต้องมีขนาดไม่เกิน 10 MB' };
    }

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async function () {
            // Extract base64 data (remove "data:...;base64," prefix)
            const base64Data = reader.result.split(',')[1];
            const result = await API.post({
                action: 'uploadFile',
                fileName: file.name,
                mimeType: file.type,
                base64Data: base64Data
            });
            resolve(result);
        };
        reader.onerror = () => resolve({ success: false, error: 'อ่านไฟล์ล้มเหลว' });
        reader.readAsDataURL(file);
    });
}

// ============================================================
// 🎨 UI HELPERS
// ============================================================

/** Show login section, hide app */
function showLogin() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('appSection').style.display = 'none';
}

/** Show app section, hide login */
function showApp() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('appSection').style.display = 'flex';

    // Update user info in sidebar
    const user = AppState.user;
    document.getElementById('userDisplayName').textContent = user.name;
    document.getElementById('userDisplayRole').textContent = user.role;
    document.getElementById('userAvatar').textContent = (user.name || 'U').charAt(0);

    // Show/hide admin elements
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = AppState.isAdmin() ? '' : 'none';
    });

    // Navigate to dashboard
    navigateTo('dashboard');
}

/** Navigate between pages */
function navigateTo(page) {
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const activeLink = document.querySelector(`[data-page="${page}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Show target page
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active-page'));
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) targetPage.classList.add('active-page');

    // Load data for the page
    switch (page) {
        case 'dashboard':
            Dashboard.load();
            break;
        case 'announcements':
            Announcements.load();
            break;
        case 'vehicles':
            VehicleLogs.load();
            break;
    }

    // Close sidebar on mobile
    document.querySelector('.sidebar')?.classList.remove('show');
}

/** Toggle sidebar on mobile */
function toggleSidebar() {
    document.querySelector('.sidebar')?.classList.toggle('show');
}

/** Show toast notification */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const iconMap = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast-custom ${type}`;
    toast.innerHTML = `<i class="fas ${iconMap[type] || iconMap.info}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/** Animate counter from 0 to target */
function animateCounter(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        el.textContent = current.toLocaleString();
    }, 30);
}

/** Loading HTML */
function loadingHTML() {
    return `<tr><td colspan="10"><div class="loading-spinner"><div class="spinner-border"></div></div></td></tr>`;
}

/** Empty state HTML */
function emptyHTML(message) {
    return `<div class="empty-state"><i class="fas fa-inbox"></i><p>${message}</p></div>`;
}

/** Escape HTML special characters */
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Truncate string */
function truncate(str, length) {
    if (!str) return '';
    return str.length > length ? str.slice(0, length) + '...' : str;
}

/** Format number */
function formatNumber(n) {
    if (n === '' || n === undefined || n === null) return '-';
    return Number(n).toLocaleString();
}

// ============================================================
// 🚀 APP INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    if (AppState.loadUser()) {
        showApp();
    } else {
        showLogin();
    }
});
