document.addEventListener('DOMContentLoaded', () => {
    // --- 0. Logika Tema ---
    const themeButtons = document.querySelectorAll('.theme-btn');
    const body = document.body;

    function setTheme(theme) {
        // Hapus kelas tema lama dan tambahkan yang baru
        body.className = '';
        if (theme !== 'pink') {
            body.classList.add(`theme-${theme}`);
        }
        
        // Simpan tema di Local Storage
        localStorage.setItem('meowTheme', theme);

        // Atur status aktif pada tombol
        themeButtons.forEach(btn => btn.classList.remove('active-theme'));
        document.querySelector(`.theme-btn[data-theme="${theme}"]`).classList.add('active-theme');
    }

    // Event listener untuk tombol tema
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setTheme(btn.dataset.theme);
        });
    });

    // Muat tema saat aplikasi dimuat
    const savedTheme = localStorage.getItem('meowTheme') || 'pink';
    setTheme(savedTheme);

    // --- Elemen DOM ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const taskForm = document.getElementById('taskForm');
    const taskList = document.getElementById('taskList');
    const financeForm = document.getElementById('financeForm');
    const financeList = document.getElementById('financeList');
    const currentBalanceEl = document.getElementById('currentBalance');

    const alarmTimeInput = document.getElementById('alarmTime');
    const setAlarmBtn = document.getElementById('setAlarmBtn');
    const clearAlarmBtn = document.getElementById('clearAlarmBtn');
    const alarmStatusEl = document.getElementById('alarmStatus');
    
    // --- Variabel Alarm Global ---
    let alarmTimeout = null;
    let alarmTimeValue = null;

    // --- Helper Function ---
    const formatRupiah = (number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(number);
    };
    
    // --- 1. Logika Tabs ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            document.querySelector('.tab-btn.active').classList.remove('active');
            button.classList.add('active');

            document.querySelector('.tab-content.active').classList.remove('active');
            const targetId = button.dataset.tab;
            document.getElementById(targetId).classList.add('active');
        });
    });

    // --- 2. Logika Alarm Sederhana ---
    
    function checkAlarm() {
        if (!alarmTimeValue) return;

        const now = new Date();
        const [targetHour, targetMinute] = alarmTimeValue.split(':').map(Number);
        
        // Buat objek Date untuk waktu alarm hari ini
        let alarmDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMinute, 0, 0);

        // Jika waktu alarm sudah lewat hari ini, atur untuk besok
        if (alarmDate.getTime() < now.getTime()) {
            alarmDate.setDate(alarmDate.getDate() + 1);
        }

        const timeToAlarm = alarmDate.getTime() - now.getTime();

        // Bersihkan timeout yang lama sebelum mengatur yang baru
        if (alarmTimeout) clearTimeout(alarmTimeout);

        alarmTimeout = setTimeout(() => {
            alert(`🔔 MEOW! Alarm Berbunyi! Sekarang pukul ${alarmTimeValue}. Saatnya cek tugas!`);
            clearAlarm(); // Reset alarm setelah berbunyi
        }, timeToAlarm);
        
        // Update status
        alarmStatusEl.textContent = `Alarm disetel pada: ${alarmTimeValue}`;
        setAlarmBtn.style.display = 'none';
        clearAlarmBtn.style.display = 'inline-block';
    }

    function clearAlarm() {
        if (alarmTimeout) {
            clearTimeout(alarmTimeout);
            alarmTimeout = null;
        }
        alarmTimeValue = null;
        alarmStatusEl.textContent = 'Alarm tidak aktif.';
        setAlarmBtn.style.display = 'inline-block';
        clearAlarmBtn.style.display = 'none';
        localStorage.removeItem('meowAlarm');
    }

    setAlarmBtn.addEventListener('click', () => {
        const time = alarmTimeInput.value;
        if (!time) {
            alert("Mohon pilih waktu alarm!");
            return;
        }
        alarmTimeValue = time;
        localStorage.setItem('meowAlarm', time);
        checkAlarm();
    });

    clearAlarmBtn.addEventListener('click', clearAlarm);

    // Muat alarm dari local storage saat start
    const savedAlarm = localStorage.getItem('meowAlarm');
    if (savedAlarm) {
        alarmTimeInput.value = savedAlarm;
        alarmTimeValue = savedAlarm;
        checkAlarm();
    }


    // --- 3. Logika Tugas & Keuangan (Firebase) ---
    
    // READ: Tugas
    function listenForTasks() {
        db.collection("tasks").orderBy("date", "asc").onSnapshot(snapshot => {
            taskList.innerHTML = ''; 
            snapshot.forEach(doc => {
                const task = doc.data();
                const li = document.createElement('li');
                li.classList.add('task-item');
                const formattedDate = new Date(task.date).toLocaleDateString('id-ID');
                
                li.innerHTML = `
                    <span>${task.description} (${formattedDate})</span>
                    <button class="delete-btn" data-id="${doc.id}"><i class="fas fa-trash"></i></button>
                `;
                taskList.appendChild(li);
            });
        });
    }

    // CREATE: Tugas
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const description = document.getElementById('taskInput').value;
        const date = document.getElementById('taskDate').value;

        db.collection("tasks").add({
            description: description,
            date: date,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => taskForm.reset());
    });
    
    // DELETE: Tugas & Keuangan (Handler umum)
    document.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) {
            const btn = e.target.closest('.delete-btn');
            const itemId = btn.dataset.id;
            const parent = btn.closest('.tab-content');
            
            let collectionName = '';
            if (parent.id === 'tugas') collectionName = 'tasks';
            if (parent.id === 'keuangan') collectionName = 'finances';
            
            if (collectionName) {
                db.collection(collectionName).doc(itemId).delete();
            }
        }
    });

    // READ: Keuangan
    function listenForFinances() {
        db.collection("finances").orderBy("createdAt", "desc").onSnapshot(snapshot => {
            financeList.innerHTML = '';
            let balance = 0;

            snapshot.forEach(doc => {
                const transaction = doc.data();
                const amount = transaction.type === 'income' ? transaction.amount : -transaction.amount;
                balance += amount;

                const li = document.createElement('li');
                li.classList.add(transaction.type === 'income' ? 'finance-income' : 'finance-expense');
                
                const sign = transaction.type === 'income' ? '+' : '-';
                
                li.innerHTML = `
                    <span>${transaction.description}</span>
                    <span class="${transaction.type}-text">${sign} ${formatRupiah(transaction.amount)}</span>
                    <button class="delete-btn" data-id="${doc.id}"><i class="fas fa-trash"></i></button>
                `;
                financeList.appendChild(li);
            });
            
            // Update Saldo
            currentBalanceEl.textContent = formatRupiah(balance);
            currentBalanceEl.className = balance >= 0 ? 'income-text' : 'expense-text';
        });
    }

    // CREATE: Keuangan
    financeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const description = document.getElementById('financeDesc').value;
        const amount = parseFloat(document.getElementById('financeAmount').value);
        const type = document.getElementById('financeType').value;

        db.collection("finances").add({
            description: description,
            amount: amount,
            type: type,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => financeForm.reset());
    });

    // --- INISIALISASI ---
    listenForTasks();
    listenForFinances();
});