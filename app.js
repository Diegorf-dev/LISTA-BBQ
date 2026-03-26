import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// Ofuscar claves para evitar scrapers simples (No sustituye a las Reglas de Firebase)
const _0x = str => atob(str);

const firebaseConfig = {
    apiKey: _0x("QUl6YVN5QlBnNWJxOGlYVVFjU1VCTFRub25yTmd6MUJBVWdFQ1Rj"),
    authDomain: _0x("YmJxLWluLWF0aWNvLXMtOGJiZTMuZmlyZWJhc2VhcHAuY29t"),
    projectId: _0x("YmJxLWluLWF0aWNvLXMtOGJiZTM="),
    storageBucket: _0x("YmJxLWluLWF0aWNvLXMtOGJiZTMuZmlyZWJhc2VzdG9yYWdlLmFwcA=="),
    messagingSenderId: _0x("OTMzNTMxMzc2NzY0"),
    appId: _0x("MTo5MzM1MzEzNzY3NjQ6d2ViOjhlYjY2ZDdiYmM2MDU4M2RjYmZkZjk="),
    databaseURL: _0x("aHR0cHM6Ly9iYnEtaW4tYXRpY28tcy04YmJlMy1kZWZhdWx0LXJ0ZGIuZXVyb3BlLXdlc3QxLmZpcmViYXNlZGF0YWJhc2UuYXBwLw==")
};

let app, database;
try {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
} catch (e) {
    console.error("Error al inicializar Firebase:", e);
}

let currentUser = {
    id: localStorage.getItem('listas_user_id') || generateId(),
    name: localStorage.getItem('listas_user_name') || '',
    items: [] // Multi-item support
};

let hasLoadedInitialItems = false;

const urlParams = newSearchParams();
function newSearchParams() { return new URLSearchParams(window.location.search); }
const urlP = new URLSearchParams(window.location.search);
let eventId = urlP.get('event') || 'BBQ';

if (!urlP.get('event')) {
    const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?event=' + eventId;
    window.history.pushState({ path: newurl }, '', newurl);
}

let eventData = {
    title: "🎉 BBQ IN ATICO'S ☀️", // Kept user's title
    description: "Añade todo lo que vas a traer para no repetir",
    participants: {}
};

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
    btnAddItem: document.getElementById('btn-add-item'),
    btnSaveItems: document.getElementById('btn-save-items'),
    myPendingItems: document.getElementById('my-pending-items'),
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
            
            if (database) updateUserInDB();
        }
    });

    elements.btnAddItem.addEventListener('click', () => {
        const item = elements.myItemInput.value.trim();
        if(item) {
            currentUser.items.push(item);
            elements.myItemInput.value = '';
            renderMyPendingItems();
        }
    });

    elements.myItemInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.btnAddItem.click();
        }
    });

    elements.btnSaveItems.addEventListener('click', () => {
        updateUserInDB();
        const oldText = elements.btnSaveItems.textContent;
        elements.btnSaveItems.textContent = "✔ ¡Confirmado!";
        setTimeout(() => {
            elements.btnSaveItems.textContent = 'Confirmar mi aportación';
        }, 2000);
        hasLoadedInitialItems = true;
    });

    elements.btnChangeName.addEventListener('click', () => {
        resetUserAndGoHome();
    });

    elements.btnShareWA.addEventListener('click', shareToWhatsApp);
}

// Hacemos global la función para que funcione siempre
window.confirmDeleteMe = function() {
    if (confirm("¿Seguro que deseas eliminarte de la lista? Toda tu aportación se borrará para siempre.")) {
        deleteMeFromDB();
    }
};

function renderMyPendingItems() {
    elements.myPendingItems.innerHTML = '';
    if (currentUser.items.length > 0) {
        elements.btnSaveItems.style.display = 'block';
    } else {
        elements.btnSaveItems.style.display = 'block'; // mostrar para vaciar si en db habia algo
        if(!hasLoadedInitialItems && currentUser.items.length === 0) elements.btnSaveItems.style.display = 'none';
    }

    currentUser.items.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            ${escapeHtml(item)}
            <span class="remove-btn" data-index="${index}">✖</span>
        `;
        elements.myPendingItems.appendChild(li);
    });

    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            currentUser.items.splice(idx, 1);
            renderMyPendingItems();
        });
    });
}

function setupEventScreen() {
    elements.displayName.textContent = currentUser.name;
    elements.eventTitle.textContent = eventData.title;
    elements.eventDesc.textContent = eventData.description;

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
                
                // Cargar ítems propios una sola vez para no sobreescribir pendientes que estés tecleando
                if (!hasLoadedInitialItems && eventData.participants[currentUser.id]) {
                    currentUser.items = eventData.participants[currentUser.id].items || [];
                    if(typeof eventData.participants[currentUser.id].item === 'string' && eventData.participants[currentUser.id].item) { 
                        currentUser.items.push(eventData.participants[currentUser.id].item);
                    }
                    renderMyPendingItems();
                    hasLoadedInitialItems = true;
                }
                
                renderParticipants();
            } else {
                // Evento nuevo detectado: Preguntamos automáticamente al creador
                let customTitle = prompt("⚡ Nuevo evento detectado en la URL.\n¿Qué título quieres ponerle a esta lista?", "Gran Evento 🎉");
                if (!customTitle) customTitle = "Gran Evento 🎉";
                
                let customDesc = prompt("⚡ Escribe una breve descripción para tus invitados:", "Añade todo lo que vas a traer para no repetir");
                if (!customDesc) customDesc = "Añade todo lo que vas a traer para no repetir";
                
                eventData.title = customTitle;
                eventData.description = customDesc;
                elements.eventTitle.textContent = eventData.title;
                elements.eventDesc.textContent = eventData.description;

                set(ref(database, 'events/' + eventId + '/info'), {
                    title: eventData.title,
                    description: eventData.description
                });
                updateUserInDB();
                hasLoadedInitialItems = true;
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
        items: currentUser.items || [],
        timestamp: Date.now()
    });
    // Optimistic Update
    eventData.participants[currentUser.id] = {
        name: currentUser.name,
        items: currentUser.items || [],
        timestamp: Date.now()
    };
    renderParticipants();
}

function deleteMeFromDB() {
    if (!database) {
        delete eventData.participants[currentUser.id];
        resetUserAndGoHome();
        return;
    }
    remove(ref(database, 'events/' + eventId + '/participants/' + currentUser.id))
        .then(() => {
            resetUserAndGoHome();
        })
        .catch(err => {
            console.error("Error al borrar de BD:", err);
            alert("No se ha podido borrar tu registro. Es probable que Firebase esté bloqueando los borrados para prevenir trolleos. Díselo al admin para que cambie la regla a '.write': true.");
        });
}

function resetUserAndGoHome() {
    currentUser.name = '';
    currentUser.items = [];
    localStorage.removeItem('listas_user_name');
    elements.usernameInput.value = '';
    hasLoadedInitialItems = false;
    showScreen('welcome');
}

function renderParticipants() {
    elements.participantsList.innerHTML = '';
    
    const participantsArray = Object.entries(eventData.participants).map(([id, p]) => ({ id, ...p }));
    elements.participantCount.textContent = participantsArray.length;

    if (participantsArray.length === 0) {
        elements.participantsList.innerHTML = '<li style="text-align: center; color: var(--text-muted)">Aún no hay nadie apuntado.</li>';
        return;
    }

    participantsArray.sort((a, b) => {
        if (a.id === currentUser.id) return -1;
        if (b.id === currentUser.id) return 1;
        return (a.timestamp || 0) - (b.timestamp || 0);
    });

    participantsArray.forEach(p => {
        const li = document.createElement('li');
        const isMe = p.id === currentUser.id;
        
        let itemList = p.items || [];
        if (typeof p.item === 'string' && p.item) itemList.push(p.item);

        let itemsRender = '';
        if (itemList.length > 0) {
            itemsRender = `🎁 Trae:<ul class="items-list">`;
            itemList.forEach(it => {
                itemsRender += `<li class="items-list-entry">• ${escapeHtml(it)}</li>`;
            });
            itemsRender += `</ul>`;
        } else {
            itemsRender = '<i>Aún no ha puesto qué trae</i>';
        }

        li.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                <div class="name">${escapeHtml(p.name)} ${isMe ? '<span style="color:var(--primary); font-size:0.9rem;">(Tú)</span>' : ''}</div>
                ${isMe ? '<span class="delete-me-btn" title="Eliminarme de la BBQ" onclick="window.confirmDeleteMe()" style="cursor:pointer; padding:5px 10px; background:#fee2e2; color:#ef4444; border-radius:6px; font-weight:bold;">✖</span>' : ''}
            </div>
            <div class="item">${itemsRender}</div>
        `;
        elements.participantsList.appendChild(li);
    });
}

function shareToWhatsApp() {
    let text = `*${eventData.title}*\n_${eventData.description}_\n\n`;
    text += `*Lista de asistentes:*\n`;

    const participantsArray = Object.values(eventData.participants);
    if (participantsArray.length === 0) text += "Aún no hay nadie.\n";

    participantsArray.forEach((p, idx) => {
        let itemList = p.items || [];
        if (typeof p.item === 'string' && p.item) itemList.push(p.item);
        
        let itemsText = itemList.length > 0 ? itemList.join(', ') : '¡Aún no se decidió!';
        text += `${idx + 1}. ${p.name} - ${itemsText}\n`;
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
