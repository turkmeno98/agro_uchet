class ChemStockApp {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser'));
        this.init();
    }
    
    init() {
        if (!this.currentUser) {
            window.location.href = 'login.html';
            return;
        }
        
        document.getElementById('currentUser').textContent = this.currentUser.username;
        this.isCreator = this.currentUser.role === 'creator';
        
        if (this.isCreator) {
            document.getElementById('creatorPanel').classList.remove('hidden');
        }
        
        this.stocks = JSON.parse(localStorage.getItem('stocks')) || [];
        this.history = JSON.parse(localStorage.getItem('history')) || [];
        
        this.bindEvents();
        this.updateDashboard();
        this.renderHistory();
    }
    
    bindEvents() {
        // Кнопки создателя
        document.getElementById('stockInBtn').addEventListener('click', () => this.openModal('Приход'));
        document.getElementById('stockOutBtn').addEventListener('click', () => this.openModal('Расход'));
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        });
        
        // Фильтр истории
        document.getElementById('filterType').addEventListener('change', () => this.renderHistory());
        
        // Модальное окно
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        document.getElementById('stockForm').addEventListener('submit', (e) => this.handleStock(e));
    }
    
    openModal(type) {
        const modal = document.getElementById('stockModal');
        document.getElementById('modalTitle').textContent = type;
        document.getElementById('stockForm').dataset.type = type.toLowerCase();
        modal.classList.remove('hidden');
    }
    
    closeModal() {
        document.getElementById('stockModal').classList.add('hidden');
        document.getElementById('stockForm').reset();
    }
    
    async handleStock(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const type = e.target.dataset.type;
        
        const operation = {
            id: Date.now(),
            date: formData.get('operationDate') || new Date().toISOString().split('T')[0],
            type: type,
            name: formData.get('itemName'),
            volume: parseFloat(formData.get('itemVolume')),
            unit: formData.get('unitSelect'),
            vehicle: formData.get('vehicle') || ''
        };
        
        this.history.unshift(operation);
        this.saveHistory();
        
        if (type === 'приход') {
            this.addStock(operation);
        } else {
            this.removeStock(operation);
        }
        
        this.updateDashboard();
        this.renderHistory();
        this.closeModal();
    }
    
    addStock(operation) {
        const existing = this.stocks.find(s => s.name === operation.name);
        if (existing) {
            existing.volume += operation.volume;
            existing.unit = operation.unit;
        } else {
            this.stocks.push({
                name: operation.name,
                volume: operation.volume,
                unit: operation.unit,
                critical: operation.volume < 50  // Критично если <50л/кг
            });
        }
        this.saveStocks();
    }
    
    removeStock(operation) {
        const stock = this.stocks.find(s => s.name === operation.name);
        if (stock) {
            stock.volume -= operation.volume;
            stock.critical = stock.volume < 50;
            this.saveStocks();
        }
    }
    
    updateDashboard() {
        const critical = this.stocks.filter(s => s.critical).length;
        const total = this.stocks.length;
        
        document.getElementById('criticalCount').textContent = critical;
        document.getElementById('totalStock').textContent = total;
        
        this.renderABC();
        this.checkNotifications(critical);
    }
    
    renderABC() {
        const ctx = document.getElementById('abcChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['A (критично)', 'B (норма)', 'C (много)'],
                datasets: [{
                    data: [
                        this.stocks.filter(s => s.volume < 50).length,
                        this.stocks.filter(s => s.volume >= 50 && s.volume < 200).length,
                        this.stocks.filter(s => s.volume >= 200).length
                    ],
                    backgroundColor: ['#ff6b6b', '#feca57', '#43e97b']
                }]
            }
        });
    }
    
    renderHistory() {
        const filter = document.getElementById('filterType').value;
        const filtered = this.history.filter(h => 
            filter === 'all' || h.type === filter
        ).slice(0, 10);
        
        const html = filtered.map(item => `
            <div class="history-item ${item.type === 'приход' ? 'in' : 'out'}">
                <span>${item.date} | ${item.name} | ${item.volume}${item.unit}</span>
                <span>${item.vehicle || '—'}</span>
            </div>
        `).join('');
        
        document.getElementById('historyList').innerHTML = html || '<p>Нет движений</p>';
    }
    
    checkNotifications(critical) {
        if (critical > 0 && Notification.permission === 'granted') {
            new Notification('ХимСклад Pro', {
                body: `Критично низкие остатки: ${critical} позиций`,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23ff6b6b"/></svg>'
            });
        }
    }
    
    saveStocks() { localStorage.setItem('stocks', JSON.stringify(this.stocks)); }
    saveHistory() { localStorage.setItem('history', JSON.stringify(this.history)); }
}

// Запуск при загрузке
document.addEventListener('DOMContentLoaded', () => new ChemStockApp());
