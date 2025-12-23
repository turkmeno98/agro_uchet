// ====== КЛЮЧИ ДАННЫХ В localStorage ======
const LS_STOCKS_KEY = 'himsklad_stocks';
const LS_HISTORY_KEY = 'himsklad_history';
const LS_USERS_KEY = 'himsklad_users';
const LS_CURRENT_USER_KEY = 'currentUser';
const LS_SETTINGS_KEY = 'himsklad_settings';

// ====== КЛАСС ПРИЛОЖЕНИЯ ======
class ChemStockApp {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem(LS_CURRENT_USER_KEY));
        if (!this.currentUser) {
            window.location.href = 'login.html';
            return;
        }

        this.isCreator = this.currentUser.role === 'creator';

        // Данные
        this.stocks = JSON.parse(localStorage.getItem(LS_STOCKS_KEY)) || [];
        this.history = JSON.parse(localStorage.getItem(LS_HISTORY_KEY)) || [];
        this.users = JSON.parse(localStorage.getItem(LS_USERS_KEY)) || {
            admin: { password: 'admin123', role: 'creator' }
        };
        this.settings = JSON.parse(localStorage.getItem(LS_SETTINGS_KEY)) || {
            criticalThreshold: 50
        };

        this.abcChart = null;
        this.init();
    }

    init() {
        // Верхняя панель
        const curUserEl = document.getElementById('currentUser');
        const curRoleEl = document.getElementById('currentRole');
        if (curUserEl) curUserEl.textContent = this.currentUser.username;
        if (curRoleEl) curRoleEl.textContent =
            this.isCreator ? 'Создатель' : 'Агроном (только просмотр)';

        // Настройки
        const thresholdInput = document.getElementById('criticalThreshold');
        if (thresholdInput) {
            thresholdInput.value = this.settings.criticalThreshold;
            thresholdInput.addEventListener('change', () => {
                this.settings.criticalThreshold = Number(thresholdInput.value) || 0;
                this.saveSettings();
                this.updateDashboard();
                this.renderStocksTable();
            });
        }

        this.bindSidebar();
        this.bindLogout();
        this.bindModal();
        this.bindUsersPanel();
        this.bindFilterHistory();

        this.updateDashboard();
        this.renderHistoryShort();
        this.renderHistoryFull();
        this.renderStocksTable();
        this.renderUsersList();
    }

    // ====== БОКОВОЕ МЕНЮ ======
    bindSidebar() {
        const navItems = document.querySelectorAll('.nav-item[data-section]');
        navItems.forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                const section = item.dataset.section;
                this.switchSection(section);
                navItems.forEach(i => i.classList.remove('nav-item-active'));
                item.classList.add('nav-item-active');
            });
        });
    }

    switchSection(sectionName) {
        const sections = document.querySelectorAll('.section');
        sections.forEach(sec => sec.classList.remove('active-section'));
        const target = document.getElementById(`section-${sectionName}`);
        if (target) target.classList.add('active-section');
    }

    // ====== ВЫХОД ======
    bindLogout() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (!logoutBtn) return;
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem(LS_CURRENT_USER_KEY);
            window.location.href = 'login.html';
        });
    }

    // ====== МОДАЛКА ПРИХОД/РАСХОД ======
    bindModal() {
        this.stockModal = document.getElementById('stockModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.stockForm = document.getElementById('stockForm');

        const modalClose = document.getElementById('modalClose');
        const cancelBtn = document.getElementById('cancelBtn');

        const openInBtn = document.getElementById('stockInBtn');
        const openOutBtn = document.getElementById('stockOutBtn');

        if (this.isCreator) {
            if (openInBtn)
                openInBtn.addEventListener('click', () => this.openModal('приход'));
            if (openOutBtn)
                openOutBtn.addEventListener('click', () => this.openModal('расход'));
        } else {
            if (openInBtn) openInBtn.style.display = 'none';
            if (openOutBtn) openOutBtn.style.display = 'none';
        }

        if (modalClose) modalClose.addEventListener('click', () => this.closeModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());

        if (this.stockForm) {
            this.stockForm.addEventListener('submit', e => this.handleStockSubmit(e));
        }

        // Клик по фону
        if (this.stockModal) {
            this.stockModal.addEventListener('click', e => {
                if (e.target === this.stockModal) this.closeModal();
            });
        }
    }

    openModal(type) {
        if (!this.isCreator) return;

        if (this.stockForm) {
            this.stockForm.reset();
            this.stockForm.dataset.type = type;
        }
        if (this.modalTitle)
            this.modalTitle.textContent =
                type === 'приход' ? 'Операция прихода' : 'Операция расхода';

        // Дата по умолчанию — сегодня
        const dateInput = document.getElementById('operationDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }

        if (this.stockModal) this.stockModal.classList.remove('hidden');
    }

    closeModal() {
        if (this.stockModal) this.stockModal.classList.add('hidden');
    }

    handleStockSubmit(e) {
        e.preventDefault();
        if (!this.isCreator) return;

        const type = this.stockForm.dataset.type; // 'приход' | 'расход'
        const name = document.getElementById('itemName').value.trim();
        const volume = parseFloat(document.getElementById('itemVolume').value);
        const unit = document.getElementById('unitSelect').value;
        const date =
            document.getElementById('operationDate').value ||
            new Date().toISOString().split('T')[0];
        const vehicle = document.getElementById('vehicle').value.trim();

        if (!name || isNaN(volume) || volume <= 0) return;

        const op = {
            id: Date.now(),
            date,
            type,
            name,
            volume,
            unit,
            vehicle
        };

        // История
        this.history.unshift(op);
        this.saveHistory();

        // Остатки
        if (type === 'приход') {
            this.applyIncoming(op);
        } else {
            this.applyOutgoing(op);
        }

        this.updateDashboard();
        this.renderHistoryShort();
        this.renderHistoryFull();
        this.renderStocksTable();

        this.closeModal();
    }

    applyIncoming(op) {
        const existing = this.stocks.find(
            s => s.name === op.name && s.unit === op.unit
        );
        if (existing) {
            existing.volume += op.volume;
        } else {
            this.stocks.push({
                id: Date.now(),
                name: op.name,
                volume: op.volume,
                unit: op.unit
            });
        }
        this.saveStocks();
    }

    applyOutgoing(op) {
        const existing = this.stocks.find(
            s => s.name === op.name && s.unit === op.unit
        );
        if (!existing) return;
        existing.volume -= op.volume;
        if (existing.volume < 0) existing.volume = 0;
        this.saveStocks();
    }

    // ====== ДАШБОРД ======
    updateDashboard() {
        const totalStockEl = document.getElementById('totalStock');
        const criticalCountEl = document.getElementById('criticalCount');
        const recentOpsEl = document.getElementById('recentOps');

        const threshold = this.settings.criticalThreshold || 0;

        const criticalCount = this.stocks.filter(s => s.volume <= threshold).length;
        const totalCount = this.stocks.length;

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentOps = this.history.filter(
            h => new Date(h.date) >= weekAgo
        ).length;

        if (totalStockEl) totalStockEl.textContent = totalCount;
        if (criticalCountEl) criticalCountEl.textContent = criticalCount;
        if (recentOpsEl) recentOpsEl.textContent = recentOps;

        this.renderABC();
        this.maybeNotifyCritical(criticalCount);
    }

    // ABC-анализ: A — мало, B — средне, C — много
    renderABC() {
        const canvas = document.getElementById('abcChart');
        if (!canvas) return;

        const threshold = this.settings.criticalThreshold || 0;

        const a = this.stocks.filter(s => s.volume <= threshold).length;
        const b = this.stocks.filter(
            s => s.volume > threshold && s.volume <= threshold * 4
        ).length;
        const c = this.stocks.filter(
            s => s.volume > threshold * 4
        ).length;

        const data = [a, b, c];

        if (!this.abcChart) {
            this.abcChart = new Chart(canvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['A — критично', 'B — норма', 'C — запас'],
                    datasets: [
                        {
                            data,
                            backgroundColor: ['#ff6b6b', '#feca57', '#43e97b'],
                            borderWidth: 0
                        }
                    ]
                },
                options: {
                    plugins: {
                        legend: {
                            labels: {
                                color: '#c3cad9',
                                font: { size: 11 }
                            }
                        }
                    },
                    cutout: '60%'
                }
            });
        } else {
            this.abcChart.data.datasets[0].data = data;
            this.abcChart.update();
        }
    }

    maybeNotifyCritical(criticalCount) {
        if (criticalCount <= 0) return;
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            new Notification('ХимСклад Pro', {
                body: `Критично низкие остатки: ${criticalCount} позиций`,
                icon:
                    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23ff6b6b"/></svg>'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }

    // ====== ТАБЛИЦА ОСТАТКОВ ======
    renderStocksTable() {
        const container = document.getElementById('stockTable');
        if (!container) return;

        const threshold = this.settings.criticalThreshold || 0;

        if (this.stocks.length === 0) {
            container.innerHTML = '<div class="empty-text">Нет данных по складу</div>';
            return;
        }

        const header = `
            <div class="stock-row stock-row-header">
                <div>Название</div>
                <div>Объем</div>
                <div>Ед.</div>
                <div>Статус</div>
            </div>
        `;

        const rows = this.stocks
            .map(s => {
                const isCritical = s.volume <= threshold;
                const status = isCritical
                    ? `<span class="stock-badge-critical">Критично</span>`
                    : `<span class="stock-unit">Ок</span>`;
                return `
                <div class="stock-row">
                    <div class="stock-name">${s.name}</div>
                    <div>${s.volume.toFixed(2)}</div>
                    <div>${s.unit}</div>
                    <div>${status}</div>
                </div>`;
            })
            .join('');

        container.innerHTML = header + rows;
    }

    // ====== ИСТОРИЯ ======
    bindFilterHistory() {
        const filterSelect = document.getElementById('filterType');
        if (!filterSelect) return;
        filterSelect.addEventListener('change', () => this.renderHistoryShort());
    }

    renderHistoryShort() {
        const container = document.getElementById('historyList');
        if (!container) return;

        const filter = document.getElementById('filterType')
            ? document.getElementById('filterType').value
            : 'all';

        const filtered = this.history
            .filter(h => (filter === 'all' ? true : h.type === filter))
            .slice(0, 10);

        container.innerHTML =
            filtered
                .map(h => this.historyItemTemplate(h))
                .join('') || '<div class="empty-text">Нет движений</div>';
    }

    renderHistoryFull() {
        const container = document.getElementById('historyFull');
        if (!container) return;

        container.innerHTML =
            this.history
                .map(h => this.historyItemTemplate(h))
                .join('') || '<div class="empty-text">Нет движений</div>';
    }

    historyItemTemplate(h) {
        const cls = h.type === 'приход' ? 'in' : 'out';
        const label = h.type === 'приход' ? 'Приход' : 'Расход';
        const veh = h.vehicle ? h.vehicle : '—';
        return `
            <div class="history-item ${cls}">
                <div>
                    <div>${h.date} • ${label}</div>
                    <div class="stock-unit">${h.name}</div>
                </div>
                <div>
                    <div>${h.volume.toFixed(2)} ${h.unit}</div>
                    <div class="stock-unit">${veh}</div>
                </div>
            </div>
        `;
    }

    // ====== ПОЛЬЗОВАТЕЛИ (Только создатель) ======
    bindUsersPanel() {
        const panel = document.getElementById('creatorPanel');
        const note = document.getElementById('usersReadonlyNote');

        if (!this.isCreator) {
            if (panel) panel.style.display = 'none';
            if (note) note.style.display = 'block';
            return;
        }

        if (note) note.style.display = 'none';

        const form = document.getElementById('addUserForm');
        if (!form) return;

        form.addEventListener('submit', e => {
            e.preventDefault();
            const nameInput = document.getElementById('newUserName');
            const passInput = document.getElementById('newUserPass');
            const name = nameInput.value.trim();
            const pass = passInput.value.trim();
            if (!name || !pass) return;
            if (!this.users[name]) {
                this.users[name] = { password: pass, role: 'agronom' };
                this.saveUsers();
                this.renderUsersList();
            }
            nameInput.value = '';
            passInput.value = '';
        });
    }

    renderUsersList() {
        const container = document.getElementById('userList');
        if (!container) return;
        const entries = Object.entries(this.users);

        container.innerHTML =
            entries
                .map(([login, user]) => {
                    const role =
                        user.role === 'creator' ? 'Создатель' : 'Агроном';
                    return `
                    <div class="user-item">
                        <div>${login}</div>
                        <div class="stock-unit">${role}</div>
                    </div>`;
                })
                .join('') || '<div class="empty-text">Нет пользователей</div>';
    }

    // ====== SAVE HELPERS ======
    saveStocks() {
        localStorage.setItem(LS_STOCKS_KEY, JSON.stringify(this.stocks));
    }

    saveHistory() {
        localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(this.history));
    }

    saveUsers() {
        localStorage.setItem(LS_USERS_KEY, JSON.stringify(this.users));
    }

    saveSettings() {
        localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(this.settings));
    }
}

// ====== ЗАПУСК ======
document.addEventListener('DOMContentLoaded', () => {
    new ChemStockApp();
});
