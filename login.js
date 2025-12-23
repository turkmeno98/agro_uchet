// Твоя база пользователей (защищено localStorage)
const USERS = {
    'admin': { password: 'admin123', role: 'creator' },  // Ты - полный доступ
    'agronom1': { password: 'agro1', role: 'agronom' },  // Пример агронома
    'agronom2': { password: 'agro2', role: 'agronom' }
    // Добавляй своих коллег здесь 👇
};

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('loginError');
    
    // Проверка пользователя
    if (USERS[username] && USERS[username].password === password) {
        localStorage.setItem('currentUser', JSON.stringify({
            username: username,
            role: USERS[username].role
        }));
        window.location.href = 'index.html';
    } else {
        errorMsg.classList.remove('hidden');
    }
});

// Автологин если уже вошел
if (localStorage.getItem('currentUser')) {
    window.location.href = 'index.html';
}
