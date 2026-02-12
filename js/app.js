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
            // ห้ามตั้ง headers ใดๆ เพื่อให้เป็น "simple request" ที่ไม่ trigger preflight
            const res = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(body)
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
        <td data-label="#"><span style="color: var(--text-muted); font-size: 12px;">${index + 1}</span></td>
        <td data-label="วันที่">${escapeHtml(item.Date || '')}</td>
        <td data-label="หัวข้อ / รายละเอียด">
          <strong>${escapeHtml(item.Title || '')}</strong>
          <br><small class="text-muted">${truncate(item.Detail || '', 60)}</small>
        </td>
        <td data-label="ไฟล์แนบ">${item.FileURL ? `<a href="${item.FileURL}" target="_blank" class="file-link"><i class="fas fa-paperclip"></i> ดูไฟล์</a>` : '<span style="color: var(--text-muted);">-</span>'}</td>
        <td data-label="โพสต์โดย"><small>${escapeHtml(item.PostedBy || '')}</small></td>
        <td data-label="จัดการ">
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
            Calendar.load(); // Refresh calendar
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
        <td data-label="#"><span style="color: var(--text-muted); font-size: 12px;">${index + 1}</span></td>
        <td data-label="วันที่">${escapeHtml(item.Date || '')}</td>
        <td data-label="ทะเบียนรถ"><strong>${escapeHtml(item.CarLicense || '')}</strong></td>
        <td data-label="ปลายทาง">${escapeHtml(item.Destination || '')}</td>
        <td data-label="เลขไมล์เริ่ม" class="text-end">${formatNumber(item.MileageStart)}</td>
        <td data-label="เลขไมล์สิ้นสุด" class="text-end">${formatNumber(item.MileageEnd)}</td>
        <td data-label="พนักงานขับ">${escapeHtml(item.Driver || '')}</td>
        <td data-label="สถานะ"><span class="badge-status badge-${(item.Status || '').toLowerCase()}">${escapeHtml(item.Status || '')}</span></td>
        <td data-label="จัดการ">
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
            Calendar.load();
        } else {
            showToast(result.error, 'error');
        }
    }
};



// ============================================================
// 📅 CALENDAR MODULE
// ============================================================
const Calendar = {
    currentDate: new Date(),
    events: [],

    THAI_MONTHS: [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
        'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
        'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ],
    THAI_DAYS: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],

    /** Normalize any date format to YYYY-MM-DD (Bangkok timezone) */
    normalizeDate(dateVal) {
        if (!dateVal) return '';
        const str = String(dateVal);
        // Already YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        // Parse as date and format to Bangkok timezone
        const d = new Date(str);
        if (isNaN(d.getTime())) return str;
        // Convert to Bangkok timezone (UTC+7)
        const bangkok = new Date(d.getTime() + (7 * 60 * 60 * 1000));
        const y = bangkok.getUTCFullYear();
        const m = String(bangkok.getUTCMonth() + 1).padStart(2, '0');
        const day = String(bangkok.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    /** Load data from both modules and render calendar */
    async load() {
        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = '<div style="grid-column: span 7;"><div class="loading-spinner"><div class="spinner-border"></div></div></div>';

        // Fetch both data sources in parallel
        const [annResult, vehResult] = await Promise.all([
            API.get({ action: 'getAnnouncements' }),
            API.get({ action: 'getVehicleLogs' })
        ]);

        this.events = [];

        if (annResult.success && annResult.data) {
            annResult.data.forEach(item => {
                if (item.Date) {
                    this.events.push({
                        type: 'announcement',
                        date: this.normalizeDate(item.Date),
                        label: item.Title || 'ข่าว',
                        id: item.ID,
                        detail: item.Detail || '',
                        postedBy: item.PostedBy || ''
                    });
                }
            });
        }

        if (vehResult.success && vehResult.data) {
            vehResult.data.forEach(item => {
                if (item.Date) {
                    this.events.push({
                        type: 'vehicle',
                        date: this.normalizeDate(item.Date),
                        label: `${item.CarLicense || 'รถ'} → ${item.Destination || ''}`,
                        id: item.ID,
                        driver: item.Driver || '',
                        status: item.Status || ''
                    });
                }
            });
        }

        this.render();
    },

    /** Render the calendar grid for currentDate month */
    render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const today = new Date();

        // Update title (Thai Buddhist Era = +543)
        const thaiYear = year + 543;
        document.getElementById('calendarTitle').textContent =
            `${this.THAI_MONTHS[month]} ${thaiYear}`;

        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // Build events map: 'YYYY-MM-DD' -> [events]
        const eventsMap = {};
        this.events.forEach(ev => {
            const key = ev.date;
            if (!eventsMap[key]) eventsMap[key] = [];
            eventsMap[key].push(ev);
        });

        let html = '';

        // Day names header
        this.THAI_DAYS.forEach(d => {
            html += `<div class="calendar-day-name">${d}</div>`;
        });

        // Previous month trailing days
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            html += `<div class="calendar-day other-month"><div class="day-number">${day}</div></div>`;
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dayEvents = eventsMap[dateStr] || [];

            let eventsHtml = '';
            const maxShow = 3;
            dayEvents.slice(0, maxShow).forEach(ev => {
                const icon = ev.type === 'announcement' ? '📢' : '🚗';
                eventsHtml += `<div class="calendar-event ${ev.type}" onclick="Calendar.showEvent(event, '${ev.type}', '${ev.id}')" title="${escapeHtml(ev.label)}">${icon} ${escapeHtml(ev.label)}</div>`;
            });
            if (dayEvents.length > maxShow) {
                eventsHtml += `<div class="calendar-event-more">+${dayEvents.length - maxShow} เพิ่มเติม</div>`;
            }

            html += `<div class="calendar-day${isToday ? ' today' : ''}">
                <div class="day-number">${d}</div>
                ${eventsHtml}
            </div>`;
        }

        // Next month leading days (fill to complete grid)
        const totalCells = firstDay + daysInMonth;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= remaining; i++) {
            html += `<div class="calendar-day other-month"><div class="day-number">${i}</div></div>`;
        }

        document.getElementById('calendarGrid').innerHTML = html;
    },

    /** Navigate to previous month */
    prev() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
    },

    /** Navigate to next month */
    next() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
    },

    /** Go back to today */
    goToday() {
        this.currentDate = new Date();
        this.render();
    },

    /** Show event detail in modal */
    showEvent(e, type, id) {
        e.stopPropagation();
        const ev = this.events.find(ev => ev.id === id && ev.type === type);
        if (!ev) return;

        if (type === 'announcement') {
            document.getElementById('detailModalTitle').textContent = ev.label;
            document.getElementById('detailModalBody').innerHTML = `
                <p><strong>📅 วันที่:</strong> ${ev.date}</p>
                <p><strong>👤 โพสต์โดย:</strong> ${ev.postedBy}</p>
                <hr style="border-color: var(--border-color);">
                <div class="detail-text">${escapeHtml(ev.detail || 'ไม่มีรายละเอียด')}</div>
            `;
        } else {
            document.getElementById('detailModalTitle').textContent = '🚗 บันทึกการใช้รถ';
            document.getElementById('detailModalBody').innerHTML = `
                <p><strong>📅 วันที่:</strong> ${ev.date}</p>
                <p><strong>🚗 รายละเอียด:</strong> ${escapeHtml(ev.label)}</p>
                <p><strong>👤 พนักงานขับ:</strong> ${escapeHtml(ev.driver)}</p>
                <p><strong>📌 สถานะ:</strong> <span class="badge-status badge-${(ev.status || '').toLowerCase()}">${escapeHtml(ev.status)}</span></p>
            `;
        }

        new bootstrap.Modal(document.getElementById('detailModal')).show();
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
    navigateTo('calendar');
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
        case 'calendar':
            Calendar.load();
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
