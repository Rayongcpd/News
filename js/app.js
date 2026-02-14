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
    },

    /** Initialize App */
    init() {
        this.loadUser();
        ThemeModule.init();
        showApp();
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => AppState.init());

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
// ============================================================
// 🔐 AUTH MODULE
// ============================================================
const Auth = {
    /** Show Login Modal */
    showLoginModal() {
        // Reset form
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        new bootstrap.Modal(document.getElementById('loginModal')).show();
    },

    /** Handle login/logout click */
    checkAuthAction() {
        if (AppState.user) {
            this.logout();
        } else {
            this.showLoginModal();
        }
    },

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
        loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังตรวจสอบ...';

        const result = await API.get({ action: 'login', username, password });

        if (result.success) {
            // Save password for subsequent admin API calls
            result.password = password;
            AppState.saveUser(result);
            showToast(`ยินดีต้อนรับ, ${result.name}!`, 'success');

            // Hide modal
            const modalEl = document.getElementById('loginModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

            showApp();
        } else {
            showToast(result.error || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
        }

        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>เข้าสู่ระบบ';
    },

    /** Handle logout */
    logout() {
        if (!confirm('ยืนยันการออกจากระบบ?')) return;
        AppState.clearUser();
        showApp(); // Refresh as guest
        showToast('ออกจากระบบแล้ว', 'info');
    }
};

// ============================================================
// 📢 ANNOUNCEMENTS MODULE
// ============================================================
// ============================================================
// 🔍 FILTER UTILS
// ============================================================
const FilterUtils = {
    /** Generate HTML for filter inputs based on type */
    updateInputs(prefix) {
        const type = document.getElementById(`${prefix}FilterType`).value;
        const container = document.getElementById(`${prefix}FilterInputs`);
        let html = '';
        const year = new Date().getFullYear();

        switch (type) {
            case 'daily':
                html = `<input type="date" class="form-control form-control-sm" id="${prefix}FilterDate">`;
                break;
            case 'monthly':
                html = `<input type="month" class="form-control form-control-sm" id="${prefix}FilterMonth">`;
                break;
            case 'quarterly':
                html = `
                    <div class="d-flex gap-2">
                        <select class="form-select form-select-sm" id="${prefix}FilterYear">
                            ${this.generateYearOptions(year)}
                        </select>
                        <select class="form-select form-select-sm" id="${prefix}FilterQuarter">
                            <option value="1">ไตรมาส 1 (ม.ค.-มี.ค.)</option>
                            <option value="2">ไตรมาส 2 (เม.ย.-มิ.ย.)</option>
                            <option value="3">ไตรมาส 3 (ก.ค.-ก.ย.)</option>
                            <option value="4">ไตรมาส 4 (ต.ค.-ธ.ค.)</option>
                        </select>
                    </div>`;
                break;
            case 'yearly':
                html = `
                    <select class="form-select form-select-sm" id="${prefix}FilterYear">
                        ${this.generateYearOptions(year)}
                    </select>`;
                break;
            default: // all
                html = `<div class="text-muted small pt-2">แสดงข้อมูลทั้งหมด</div>`;
        }
        container.innerHTML = html;
    },

    /** Generate year options (current year +/- 5) */
    generateYearOptions(currentYear) {
        let options = '';
        for (let y = currentYear + 1; y >= currentYear - 5; y--) {
            // Show Buddhist Era in text (Year + 543)
            options += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y + 543}</option>`;
        }
        return options;
    },

    /** Get filter criteria from inputs */
    getCriteria(prefix) {
        const type = document.getElementById(`${prefix}FilterType`).value;
        const criteria = { type };

        if (type === 'daily') {
            criteria.date = document.getElementById(`${prefix}FilterDate`).value;
        } else if (type === 'monthly') {
            criteria.month = document.getElementById(`${prefix}FilterMonth`).value; // YYYY-MM
        } else if (type === 'quarterly') {
            criteria.year = document.getElementById(`${prefix}FilterYear`).value;
            criteria.quarter = document.getElementById(`${prefix}FilterQuarter`).value;
        } else if (type === 'yearly') {
            criteria.year = document.getElementById(`${prefix}FilterYear`).value;
        }
        return criteria;
    },

    /** Filter data array based on criteria */
    filterData(data, criteria) {
        if (!data) return [];
        if (criteria.type === 'all') return data;

        return data.filter(item => {
            if (!item.Date) return false;
            // item.Date is likely YYYY-MM-DD string or ISO
            // Normalize to YYYY-MM-DD
            const itemDateStr = Calendar.normalizeDate(item.Date);
            if (!itemDateStr) return false;

            const [y, m, d] = itemDateStr.split('-').map(Number); // y=2024, m=2, d=15

            switch (criteria.type) {
                case 'daily':
                    // criteria.date is YYYY-MM-DD
                    if (!criteria.date) return true; // No date selected, show all? Or none? Let's show all or handle validation
                    return itemDateStr === criteria.date;
                case 'monthly':
                    // criteria.month is YYYY-MM
                    if (!criteria.month) return true;
                    return itemDateStr.startsWith(criteria.month);
                case 'quarterly':
                    const q = Math.ceil(m / 3);
                    return String(y) === String(criteria.year) && String(q) === String(criteria.quarter);
                case 'yearly':
                    return String(y) === String(criteria.year);
                default:
                    return true;
            }
        });
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
            container.innerHTML = `<tr><td colspan="10">${emptyHTML('ยังไม่มีรายการปฏิบัติงาน')}</td></tr>`;
            return;
        }

        container.innerHTML = data.map((item, index) => {
            // Format time display
            let timeDisplay = '-';
            if (item.Time) {
                timeDisplay = formatTime(item.Time);
                if (item.TimeSuffix) timeDisplay += ' ' + escapeHtml(item.TimeSuffix);
            }

            return `
      <tr class="fade-in" style="animation-delay: ${index * 0.05}s">
        <td data-label="#"><span style="color: var(--text-muted); font-size: 12px;">${index + 1}</span></td>
        <td data-label="วันที่">${formatThaiDate(item.Date)}</td>
        <td data-label="เวลา">${timeDisplay}</td>
        <td data-label="เรื่อง">
          <strong>${escapeHtml(item.Title || '')}</strong>
          <br><small class="text-muted">${truncate(item.Detail || '', 60)}</small>
        </td>
        <td data-label="สถานที่">${escapeHtml(item.Location || '-')}</td>
        <td data-label="สหกรณ์ฯ">${escapeHtml(item.CoopParticipation || '-')}</td>
        <td data-label="กลุ่มงาน">${escapeHtml(item.WorkGroup || '-')}</td>
        <td data-label="เอกสารแนบ">${item.FileURL ? `<a href="${item.FileURL}" target="_blank" class="file-link"><i class="fas fa-paperclip"></i> ดูไฟล์</a>` : '<span style="color: var(--text-muted);">-</span>'}</td>
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
    `;
        }).join('');
    },

    /** Show detail modal */
    showDetail(id) {
        const item = AppState.announcements.find(a => a.ID === id);
        if (!item) return;

        // Format time for display
        let timeDisplay = '-';
        if (item.Time) {
            timeDisplay = formatTime(item.Time);
            if (item.TimeSuffix) timeDisplay += ' ' + escapeHtml(item.TimeSuffix);
        }

        document.getElementById('detailModalTitle').textContent = item.Title;
        document.getElementById('detailModalBody').innerHTML = `
      <p><strong>เรื่อง:</strong> ${escapeHtml(item.Title || '-')}</p>
      <p><strong>วันที่:</strong> ${formatThaiDate(item.Date)}</p>
      <p><strong>เวลา:</strong> ${timeDisplay}</p>
      <p><strong>สถานที่:</strong> ${escapeHtml(item.Location || '-')}</p>
      <p><strong>สหกรณ์จังหวัดระยอง:</strong> ${escapeHtml(item.CoopParticipation || '-')}</p>
      <p><strong>กลุ่มงาน:</strong> ${escapeHtml(item.WorkGroup || '-')}</p>
      <p><strong>โพสต์โดย:</strong> ${item.PostedBy}</p>
      ${item.FileURL ? `<p><strong>เอกสารแนบ:</strong> <a href="${item.FileURL}" target="_blank" class="file-link"><i class="fas fa-download"></i> ดาวน์โหลดไฟล์</a></p>` : ''}
      <hr style="border-color: var(--border-color);">
      <div class="detail-text">${escapeHtml(item.Detail || 'ไม่มีรายละเอียด')}</div>
    `;
        new bootstrap.Modal(document.getElementById('detailModal')).show();
    },

    /** Show add form modal */
    showAdd() {
        document.getElementById('annFormTitle').textContent = 'เพิ่มงานใหม่';
        document.getElementById('annFormId').value = '';
        document.getElementById('annTitle').value = '';
        document.getElementById('annDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('annTime').value = '';
        document.getElementById('annTimeSuffix').value = 'เป็นต้นไป';
        document.getElementById('annLocation').value = '';
        document.getElementById('annCoopParticipation').value = '';
        document.getElementById('annWorkGroup').value = '';
        document.getElementById('annDetail').value = '';
        document.getElementById('annFile').value = '';
        document.getElementById('annFileURL').value = '';
        new bootstrap.Modal(document.getElementById('annFormModal')).show();
    },

    /** Show edit form modal */
    showEdit(id) {
        const item = AppState.announcements.find(a => a.ID === id);
        if (!item) return;

        document.getElementById('annFormTitle').textContent = 'แก้ไขงาน';
        document.getElementById('annFormId').value = item.ID;
        document.getElementById('annTitle').value = item.Title || '';
        document.getElementById('annDate').value = Calendar.normalizeDate(item.Date) || '';
        document.getElementById('annTime').value = parseTimeForInput(item.Time) || '';
        document.getElementById('annTimeSuffix').value = item.TimeSuffix || 'เป็นต้นไป';
        document.getElementById('annLocation').value = item.Location || '';
        document.getElementById('annCoopParticipation').value = item.CoopParticipation || '';
        document.getElementById('annWorkGroup').value = item.WorkGroup || '';
        document.getElementById('annDetail').value = item.Detail || '';
        document.getElementById('annFile').value = '';
        document.getElementById('annFileURL').value = item.FileURL || '';
        new bootstrap.Modal(document.getElementById('annFormModal')).show();
    },

    /** Save announcement (add or update) */
    async save() {
        const id = document.getElementById('annFormId').value;
        const title = document.getElementById('annTitle').value.trim();
        const date = document.getElementById('annDate').value;
        const time = document.getElementById('annTime').value;
        const timeSuffix = document.getElementById('annTimeSuffix').value;
        const location = document.getElementById('annLocation').value.trim();
        const coopParticipation = document.getElementById('annCoopParticipation').value;
        const workGroup = document.getElementById('annWorkGroup').value.trim();
        const detail = document.getElementById('annDetail').value.trim();
        let fileURL = document.getElementById('annFileURL').value;
        const fileInput = document.getElementById('annFile');

        if (!title) {
            showToast('กรุณากรอกเรื่อง', 'error');
            return;
        }
        if (!date) {
            showToast('กรุณาระบุวันที่', 'error');
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
        const payload = { action, title, date, time, timeSuffix, location, coopParticipation, workGroup, detail, fileURL };
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

    /** Apply filter */
    applyFilter() {
        const criteria = FilterUtils.getCriteria('ann');
        const filtered = FilterUtils.filterData(AppState.announcements, criteria);
        this.render(filtered);
    },

    /** Reset filter */
    resetFilter() {
        document.getElementById('annFilterType').value = 'all';
        FilterUtils.updateInputs('ann');
        this.render(AppState.announcements);
    },

    /** Confirm and delete announcement */
    async confirmDelete(id) {
        if (!confirm('ต้องการลบรายการนี้หรือไม่?')) return;

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
            container.innerHTML = `<tr><td colspan="10">${emptyHTML('ยังไม่มีบันทึกการใช้รถ')}</td></tr>`;
            return;
        }

        container.innerHTML = data.map((item, index) => `
      <tr class="fade-in" style="animation-delay: ${index * 0.05}s">
        <td data-label="#"><span style="color: var(--text-muted); font-size: 12px;">${index + 1}</span></td>
        <td data-label="วันที่">${formatThaiDate(item.Date)}</td>
        <td data-label="เวลาไป">${formatTime(item.DepartureTime)}</td>
        <td data-label="เวลากลับ">${formatTime(item.ReturnTime)}</td>
        <td data-label="ทะเบียนรถ"><strong>${escapeHtml(item.CarLicense || '')}</strong></td>
        <td data-label="จุดประสงค์">${escapeHtml(item.Purpose || '-')}</td>
        <td data-label="ปลายทาง">${escapeHtml(item.Destination || '')}</td>
        <td data-label="ผู้ขอใช้/กลุ่มงาน">${escapeHtml(item.Requestor || item.requestor || '-')}</td>
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
        document.getElementById('vehPurpose').value = '';
        document.getElementById('vehDestination').value = '';
        document.getElementById('vehRequestor').value = '';
        document.getElementById('vehDepartureTime').value = '';
        document.getElementById('vehReturnTime').value = '';
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
        // Format date to YYYY-MM-DD for input[type="date"]
        document.getElementById('vehDate').value = Calendar.normalizeDate(item.Date);
        document.getElementById('vehCarLicense').value = item.CarLicense || '';
        document.getElementById('vehPurpose').value = item.Purpose || '';
        document.getElementById('vehDestination').value = item.Destination || '';
        // Handle potential case sensitivity or missing field
        document.getElementById('vehRequestor').value = item.Requestor || item.requestor || '';
        // Format time for input[type="time"] - handles ISO strings from Google Sheets
        document.getElementById('vehDepartureTime').value = parseTimeForInput(item.DepartureTime);
        document.getElementById('vehReturnTime').value = parseTimeForInput(item.ReturnTime);
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
        const purpose = document.getElementById('vehPurpose').value.trim();
        const destination = document.getElementById('vehDestination').value.trim();
        const requestor = document.getElementById('vehRequestor').value.trim();
        const departureTime = document.getElementById('vehDepartureTime').value;
        const returnTime = document.getElementById('vehReturnTime').value;
        const mileageStart = document.getElementById('vehMileageStart').value;
        const mileageEnd = document.getElementById('vehMileageEnd').value;
        const driver = document.getElementById('vehDriver').value.trim();
        const status = document.getElementById('vehStatus').value;

        if (!date || !destination || !requestor || !purpose) {
            showToast('กรุณากรอกข้อมูลที่จำเป็น (วันที่, จุดประสงค์, ปลายทาง, ผู้ขอ)', 'error');
            return;
        }

        const action = id ? 'updateVehicleLog' : 'addVehicleLog';
        const payload = { action, date, carLicense, purpose, destination, requestor, departureTime, returnTime, mileageStart, mileageEnd, driver, status };
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

    /** Apply filter */
    applyFilter() {
        const criteria = FilterUtils.getCriteria('veh');
        const filtered = FilterUtils.filterData(AppState.vehicleLogs, criteria);
        this.render(filtered);
    },

    /** Reset filter */
    resetFilter() {
        document.getElementById('vehFilterType').value = 'all';
        FilterUtils.updateInputs('veh');
        this.render(AppState.vehicleLogs);
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
                        label: item.Title || 'งาน',
                        id: item.ID,
                        detail: item.Detail || '',
                        postedBy: item.PostedBy || '',
                        workGroup: item.WorkGroup || '',
                        time: item.Time || '',
                        timeSuffix: item.TimeSuffix || '',
                        location: item.Location || '',
                        coopParticipation: item.CoopParticipation || ''
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
                        label: item.CarLicense || 'รถ',
                        id: item.ID,
                        driver: item.Driver || '',
                        status: item.Status || '',
                        purpose: item.Purpose || '',
                        destination: item.Destination || '',
                        requestor: item.Requestor || item.requestor || '',
                        departureTime: item.DepartureTime || '',
                        returnTime: item.ReturnTime || ''
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

            const newsEvents = dayEvents.filter(e => e.type === 'announcement');
            const vehicleEvents = dayEvents.filter(e => e.type === 'vehicle');

            let eventsHtml = '';

            if (newsEvents.length > 0) {
                eventsHtml += `<div class="calendar-event announcement" onclick="Calendar.showGroup('${dateStr}', 'announcement')" title="ดูการปฏิบัติงาน">📋 การปฏิบัติงาน (${newsEvents.length})</div>`;
            }

            if (vehicleEvents.length > 0) {
                eventsHtml += `<div class="calendar-event vehicle" onclick="Calendar.showGroup('${dateStr}', 'vehicle')" title="ดูบันทึกการใช้รถ">🚗 บันทึกการใช้รถ (${vehicleEvents.length})</div>`;
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
        // Legacy function, kept just in case, but showGroup is preferred now.
        this.showGroup(this.currentDate.toISOString().split('T')[0], type);
    },

    /** Show grouped events in modal */
    showGroup(dateStr, type) {
        // Prevent bubbling if called from onclick directly (though in HTML we passed string values)
        if (event) event.stopPropagation();

        const typeName = type === 'announcement' ? 'การปฏิบัติงาน' : 'บันทึกการใช้รถ';
        const modalTitle = `${dateStr} - ${typeName}`;

        // Filter events
        const groupEvents = this.events.filter(ev => ev.date === dateStr && ev.type === type);

        let html = '<div class="list-group list-group-flush">';
        if (groupEvents.length === 0) {
            html += '<div class="p-3 text-center text-muted">ไม่พบข้อมูล</div>';
        } else {
            groupEvents.forEach(ev => {
                if (type === 'announcement') {
                    // Format time display
                    let timeDisplay = '-';
                    if (ev.time) {
                        timeDisplay = formatTime(ev.time);
                        if (ev.timeSuffix) timeDisplay += ' ' + escapeHtml(ev.timeSuffix);
                    }

                    html += `
                        <div class="list-group-item bg-transparent border-bottom">
                            <h6 class="mb-1 text-primary">${escapeHtml(ev.label)}</h6>
                            <p class="mb-1 small text-secondary"><i class="fas fa-clock me-1"></i> เวลา: ${timeDisplay}</p>
                            <p class="mb-1 small text-secondary"><i class="fas fa-map-marker-alt me-1"></i> สถานที่: ${escapeHtml(ev.location || '-')}</p>
                            <p class="mb-1 small text-secondary"><i class="fas fa-handshake me-1"></i> สหกรณ์ฯ: ${escapeHtml(ev.coopParticipation || '-')}</p>
                            <p class="mb-1 small text-secondary"><i class="fas fa-layer-group me-1"></i> กลุ่มงาน: ${escapeHtml(ev.workGroup || '-')}</p>
                            <p class="mb-1 small text-secondary"><i class="fas fa-file-alt me-1"></i> รายละเอียด: ${escapeHtml(ev.detail || '-')}</p>
                            <small class="text-muted"><i class="fas fa-user me-1"></i> ผู้สร้างโพสนี้: ${escapeHtml(ev.postedBy)}</small>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="list-group-item bg-transparent border-bottom">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="mb-0 text-primary">🚗 เลขทะเบียน : ${escapeHtml(ev.label)} <span class="text-muted fw-normal" style="font-size:0.85em;">(พนักงานขับรถ : ${escapeHtml(ev.driver || '-')})</span></h6>
                                <span class="badge-status badge-${(ev.status || '').toLowerCase()}">${escapeHtml(ev.status)}</span>
                            </div>
                            <p class="mb-1 small text-secondary"><i class="fas fa-user-tag me-1"></i> ผู้ขอใช้รถ : ${escapeHtml(ev.requestor || '-')}</p>
                            <div class="d-flex gap-3 mb-1 small text-secondary">
                                <span><i class="fas fa-clock me-1"></i> เวลาไป : ${formatTime(ev.departureTime)}</span>
                                <span><i class="fas fa-clock me-1"></i> เวลากลับ : ${formatTime(ev.returnTime)}</span>
                            </div>
                            <p class="mb-1 small text-secondary"><i class="fas fa-map-marker-alt me-1"></i> สถานที่ : ${escapeHtml(ev.destination || '-')}</p>
                            <p class="mb-0 small text-secondary"><i class="fas fa-bullseye me-1"></i> เพื่อ : ${escapeHtml(ev.purpose || '-')}</p>
                        </div>
                    `;
                }
            });
        }
        html += '</div>';

        document.getElementById('detailModalTitle').textContent = modalTitle;
        document.getElementById('detailModalBody').innerHTML = html;
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

// ============================================================
// 🎨 UI HELPERS
// ============================================================

/** Show app section and update UI based on auth state */
function showApp() {
    // Show app section (it should be visible by default, but ensuring here)
    document.getElementById('appSection').style.display = 'flex';

    const user = AppState.user;
    const authLink = document.getElementById('authMenuLink');
    const authIcon = authLink.querySelector('i');

    if (user) {
        // Logged In
        document.getElementById('userDisplayName').textContent = user.name;
        document.getElementById('userDisplayRole').textContent = user.role;
        document.getElementById('userAvatar').textContent = (user.name || 'U').charAt(0);
        document.getElementById('userAvatar').innerHTML = (user.name || 'U').charAt(0); // Text avatar

        // Update Auth Link to Logout (Red)
        authLink.className = 'nav-link text-danger mt-2';
        authLink.innerHTML = '<i class="fas fa-sign-out-alt"></i> ออกจากระบบ';

        // Show Admin Only Elements
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = AppState.isAdmin() ? 'inline-block' : 'none';
        });

    } else {
        // Guest
        document.getElementById('userDisplayName').textContent = 'ผู้เยี่ยมชม';
        document.getElementById('userDisplayRole').textContent = 'บุคคลทั่วไป';
        document.getElementById('userAvatar').innerHTML = '<i class="fas fa-user"></i>';

        // Update Auth Link to Login (Normal)
        authLink.className = 'nav-link mt-2';
        authLink.innerHTML = '<i class="fas fa-sign-in-alt"></i> เข้าสู่ระบบ';

        // Hide Admin Only Elements
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });
    }

    // Refresh current view if we are already viewing data
    const activePage = document.querySelector('.page-section.active-page');
    if (activePage) {
        // If we just logged in/out, re-render the current list to show/hide action buttons
        const pageId = activePage.id.replace('page-', '');
        if (pageId === 'announcements') Announcements.render(AppState.announcements);
        if (pageId === 'vehicles') VehicleLogs.render(AppState.vehicleLogs);
        if (pageId === 'calendar') Calendar.load();
    } else {
        // Default to calendar
        navigateTo('calendar');
    }
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

/** Format date to Thai format (d MMM yyyy) */
function formatThaiDate(dateVal) {
    if (!dateVal) return '-';

    // Thai Short Months
    const months = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.',
        'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.',
        'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    // Normalize to YYYY-MM-DD
    const dateStr = Calendar.normalizeDate(dateVal);
    if (!dateStr) return '-';

    const [y, m, d] = dateStr.split('-').map(Number);
    const thaiYear = y + 543;

    return `${d} ${months[m - 1]} ${thaiYear}`;
}

/** 
 * Parse time value for input[type="time"] (returns '' instead of '-' for empty)
 * Handles ISO strings from Google Sheets (1899-12-30T01:30:00.000Z) and HH:mm:ss
 */
function parseTimeForInput(timeVal) {
    if (!timeVal) return '';

    const str = String(timeVal);

    // If it's a full ISO date string (like 1899-12-30T...)
    if (str.includes('T')) {
        const d = new Date(str);
        if (isNaN(d.getTime())) return '';
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    // If it's already HH:mm or HH:mm:ss
    if (str.includes(':')) {
        return str.substring(0, 5);
    }

    return '';
}

/** 
 * Format time string to HH:mm
 * Handles ISO strings (2024-02-16T10:00:00.000Z) or simple HH:mm:ss
 */
function formatTime(timeVal) {
    if (!timeVal) return '-';

    // If it's a full date string (like 1899-12-30T...)
    if (String(timeVal).includes('T')) {
        const d = new Date(timeVal);
        if (isNaN(d.getTime())) return '-';
        // Adjust for timezone if needed, or just take UTC hours/min if coming from sheet as formatted
        // Google Sheets often sends 1899-12-30T... for time-only cells adjusted to script timezone
        // Let's assume the time part is correct in local time if standard string, 
        // or just parse simple HH:mm if it fits
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    // If it's already HH:mm:ss
    if (String(timeVal).includes(':')) {
        return String(timeVal).substring(0, 5);
    }

    return timeVal;
}

// ============================================================
// 🌓 THEME MODULE
// ============================================================
const ThemeModule = {
    init() {
        const savedTheme = localStorage.getItem('oms-theme');
        // If no saved theme, default to 'light' (which is default in CSS, so NO data-theme attribute)
        // If saved is 'dark', apply it.
        if (savedTheme === 'dark') {
            this.apply('dark');
        } else {
            this.apply('light');
        }
    },

    toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        const target = current === 'dark' ? 'light' : 'dark';
        this.apply(target);
    },

    apply(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            const checkbox = document.getElementById('checkbox');
            if (checkbox) checkbox.checked = true;
        } else {
            document.documentElement.removeAttribute('data-theme');
            const checkbox = document.getElementById('checkbox');
            if (checkbox) checkbox.checked = false;
        }
        localStorage.setItem('oms-theme', theme);
    }
};

/** Global toggle function */
function toggleTheme() {
    ThemeModule.toggle();
}
