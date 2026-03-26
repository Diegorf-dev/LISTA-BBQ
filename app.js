import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

/* 
 * TODO: Configura tu proyecto de Firebase
 * 1. Ve a https://console.firebase.google.com/
 * 2. Crea un proyecto y añade una App Web
 * 3. Habilita 'Realtime Database' en modo prueba (Test Mode)
 * 4. Pega aquí el objeto firebaseConfig que te da Google:
 */
const firebaseConfig = {
    apiKey: "AIzaSyBPg5bq8iXUQcSUBLTnonrNgz1BAUgECTc",
    authDomain: "bbq-in-atico-s-8bbe3.firebaseapp.com",
    projectId: "bbq-in-atico-s-8bbe3",
    storageBucket: "bbq-in-atico-s-8bbe3.firebasestorage.app",
    messagingSenderId: "933531376764",
    appId: "1:933531376764:web:8eb66d7bbc60583dcbfdf9",
    // NOTA: Para Realtime Database necesitas una URL. Prueba alguna de estas dos:
    databaseURL: "https://bbq-in-atico-s-8bbe3-default-rtdb.europe-west1.firebasedatabase.app/"
};

let app, database;
// Verificar si firebaseConfig tiene algo dentro para inicializar
if (Object.keys(firebaseConfig).length > 0) {
    try {
        app = initializeApp(firebaseConfig);
        database = getDatabase(app);
    } catch (e) {
        console.error("Error al inicializar Firebase:", e);
    }
} else {
    console.warn("Firebase no está configurado. La app funcionará en modo local MOCK.");
}

// App State
let currentUser = {
    id: localStorage.getItem('listas_user_id') || generateId(),
    name: localStorage.getItem('listas_user_name') || '',
    item: ''
};

// Event ID from URL (?event=xyz)
const urlParams = new URLSearchParams(window.location.search);
let eventId = urlParams.get('event') || 'evento_demo';

if (!urlParams.get('event')) {
    const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?event=' + eventId;
    window.history.pushState({ path: newurl }, '', newurl);
}

let eventData = {
    title: "🎉 BBQ IN ATICO'S ☀️",
    description: "Añade lo que vas a traer para no repetir",
    participants: {}
};

// DOM Elements
const screens = {
    welcome: document.getElementById('welcome-screen'),
    event: document.getElementById('event-screen')
};

const elements = {
    joinForm: document.getElementById('join-form'),
    usernameInput: document.getElementById('username-input'),
    displayName: document.getElementById('display-name'),
    eventTitle: document.getElementById('event-title'),
    eventDesc: document.getElementById('event-desc'),
    myItemInput: document.getElementById('my-item'),
    btnSaveItem: document.getElementById('btn-save-item'),
    participantsList: document.getElementById('participants-list'),
    participantCount: document.getElementById('participant-count'),
    btnChangeName: document.getElementById('btn-change-name'),
    btnShareWA: document.getElementById('btn-share-wa')
};

function init() {
    if (currentUser.name) {
        showScreen('event');
        setupEventScreen();
    } else {
        showScreen('welcome');
    }
    setupEventListeners();
}

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('view-hidden'));
    screens[screenName].classList.remove('view-hidden');
}

function setupEventListeners() {
    elements.joinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = elements.usernameInput.value.trim();
        if (name) {
            currentUser.name = name;
            localStorage.setItem('listas_user_name', name);
            localStorage.setItem('listas_user_id', currentUser.id);
            showScreen('event');
            setupEventScreen();

            if (database) {
                updateUserInDB();
            } else {
                eventData.participants[currentUser.id] = { ...currentUser };
                renderParticipants();
            }
        }
    });

    elements.btnSaveItem.addEventListener('click', () => {
        const item = elements.myItemInput.value.trim();
        currentUser.item = item;

        if (!database) {
            eventData.participants[currentUser.id] = { ...currentUser };
            renderParticipants();
            elements.btnSaveItem.textContent = "✔ Guardado";
            setTimeout(() => elements.btnSaveItem.textContent = "Actualizar", 2000);
        } else {
            updateUserInDB();
            elements.btnSaveItem.textContent = "✔ Guardado";
            setTimeout(() => elements.btnSaveItem.textContent = "Actualizar", 2000);
        }
    });

    elements.myItemInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.btnSaveItem.click();
        }
    });

    elements.btnChangeName.addEventListener('click', () => {
        currentUser.name = '';
        localStorage.removeItem('listas_user_name');
        elements.usernameInput.value = '';
        showScreen('welcome');
    });

    elements.btnShareWA.addEventListener('click', shareToWhatsApp);
}

function setupEventScreen() {
    elements.displayName.textContent = currentUser.name;
    elements.eventTitle.textContent = eventData.title;
    elements.eventDesc.textContent = eventData.description;

    // Configurar input si hay item
    if (eventData.participants[currentUser.id]) {
        elements.myItemInput.value = eventData.participants[currentUser.id].item || '';
    }

    if (database) {
        const eventRef = ref(database, 'events/' + eventId);
        onValue(eventRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (data.info) {
                    eventData.title = data.info.title || eventData.title;
                    eventData.description = data.info.description || eventData.description;
                    elements.eventTitle.textContent = eventData.title;
                    elements.eventDesc.textContent = eventData.description;
                }
                eventData.participants = data.participants || {};

                if (eventData.participants[currentUser.id]) {
                    currentUser.item = eventData.participants[currentUser.id].item;
                    if (document.activeElement !== elements.myItemInput) {
                        elements.myItemInput.value = currentUser.item || '';
                    }
                }
                renderParticipants();
            } else {
                set(ref(database, 'events/' + eventId + '/info'), {
                    title: eventData.title,
                    description: eventData.description
                });
                updateUserInDB();
            }
        });
    } else {
        eventData.participants[currentUser.id] = { ...currentUser };
        renderParticipants();
    }
}

function updateUserInDB() {
    if (!database) return;
    set(ref(database, 'events/' + eventId + '/participants/' + currentUser.id), {
        name: currentUser.name,
        item: currentUser.item || '',
        timestamp: Date.now()
    });
}

function renderParticipants() {
    elements.participantsList.innerHTML = '';
    const participants = Object.values(eventData.participants);
    elements.participantCount.textContent = participants.length;

    if (participants.length === 0) {
        elements.participantsList.innerHTML = '<li style="text-align: center; color: var(--text-muted)">Aún no hay nadie apuntado.</li>';
        return;
    }

    participants.sort((a, b) => {
        if (a.name === currentUser.name) return -1;
        if (b.name === currentUser.name) return 1;
        return (a.timestamp || 0) - (b.timestamp || 0);
    });

    participants.forEach(p => {
        const li = document.createElement('li');
        const isMe = p.name === currentUser.name;

        li.innerHTML = `
            <div class="name">${escapeHtml(p.name)} ${isMe ? '(Tú)' : ''}</div>
            <div class="item">${p.item ? `🎁 Trae: <b>${escapeHtml(p.item)}</b>` : '<i>Aún no ha puesto qué trae</i>'}</div>
        `;
        elements.participantsList.appendChild(li);
    });
}

function shareToWhatsApp() {
    let text = `*${eventData.title}*\n_${eventData.description}_\n\n`;
    text += `*Lista de asistentes:*\n`;

    const participants = Object.values(eventData.participants);
    if (participants.length === 0) text += "Aún no hay nadie.\n";

    participants.forEach((p, idx) => {
        text += `${idx + 1}. ${p.name} - ${p.item ? p.item : '¡Aún no se decidió!'}\n`;
    });

    text += `\n👉 Apúntate aquí: ${window.location.href}`;
    const encode = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encode}`, '_blank');
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

init();
