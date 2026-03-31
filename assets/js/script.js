const canvas = document.getElementById('gameCanva');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const startBtn = document.querySelector('.startBtn');

var H, W;

// INITIALISATION DU JOUEUR
let player = {
    x: 0,
    y: 0,
    w: 60,  // On l'agrandit un peu pour que ce soit plus visuel
    h: 40,
    vx: 0,
    ax: 0
};

const friction = 0.85; // Plus bas = plus de frottements (plus "lourd" dans l'eau)
const sensitivity = 0.25; // Augmenté un peu pour compenser la friction

// GESTION DES OBJETS
let objects = [];
const objectSize = 30;
const spawnSpeed = 2; // Vitesse de descente
let frameCount = 0;

// RECETTE ET PROGRESSION
const recipe = [1, 2, 3, 4]; // L'ordre des IDs à ramasser
let currentRecipeIndex = 0; // Quel ingrédient on cherche (0 à 3)
let gameActive = false;
let victory = false;

// REDIMENSIONNEMENT
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    W = canvas.width;
    H = canvas.height;
    
    // Repositionner le joueur en bas au milieu lors du redimensionnement
    player.x = (W / 2) - (player.w / 2);
    player.y = H - player.h - 50;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// DESSIN ET MISE À JOUR (BOUCLE DE JEU)
function updatePhysics() {
    player.vx += player.ax;
    player.vx *= friction;
    player.x += player.vx;

    // Limites de l'écran
    if (player.x < 0) {
        player.x = 0;
        player.vx = 0;
    }
    if (player.x > W - player.w) {
        player.x = W - player.w;
        player.vx = 0;
    }
}

function spawnObject() {
    frameCount++;
    if (frameCount % 60 === 0) { // Toutes les ~1 seconde
        const isBonus = Math.random() > 0.4;
        const id = isBonus ? Math.floor(Math.random() * 4) + 1 : Math.floor(Math.random() * 3) + 1;
        
        objects.push({
            x: Math.random() * (W - objectSize),
            y: -objectSize,
            w: objectSize,
            h: objectSize,
            type: isBonus ? 'good' : 'malus',
            id: id
        });
    }
}

function updateObjects() {
    for (let i = objects.length - 1; i >= 0; i--) {
        let obj = objects[i];
        obj.y += spawnSpeed;

        // Collision avec le joueur
        if (rectIntersect(player.x, player.y, player.w, player.h, obj.x, obj.y, obj.w, obj.h)) {
            handlePickup(obj);
            objects.splice(i, 1);
            continue;
        }

        // Sortie de l'écran
        if (obj.y > H) {
            objects.splice(i, 1);
        }
    }
}

function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
}

function handlePickup(obj) {
    if (obj.type === 'good') {
        if (obj.id === recipe[currentRecipeIndex]) {
            currentRecipeIndex++;
            if (currentRecipeIndex === recipe.length) {
                victory = true;
            }
        } else {
            // Mauvais ordre
            currentRecipeIndex = 0;
        }
    } else {
        // Malus
        currentRecipeIndex = 0;
    }
}

function drawUI() {
    // Petit papier de recette en haut
    const paperW = 200;
    const paperH = 60;
    const paperX = (W / 2) - (paperW / 2);
    const paperY = 20;

    ctx.fillStyle = "#fff9d7"; // Couleur papier
    ctx.fillRect(paperX, paperY, paperW, paperH);
    ctx.strokeStyle = "#d4c590";
    ctx.lineWidth = 2;
    ctx.strokeRect(paperX, paperY, paperW, paperH);

    // Titre recette
    ctx.fillStyle = "#5d4037";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("RECETTE", paperX + paperW/2, paperY + 15);

    // Ingrédients dans l'ordre
    recipe.forEach((id, index) => {
        const itemX = paperX + 30 + (index * 40);
        const itemY = paperY + 25;
        const itemSize = 25;

        // Si c'est déjà ramassé, on peut mettre une coche ou opacité
        ctx.fillStyle = index < currentRecipeIndex ? "#4CAF50" : "#ddd";
        ctx.fillRect(itemX, itemY, itemSize, itemSize);
        
        ctx.fillStyle = "black";
        ctx.font = "14px Arial";
        ctx.fillText(id, itemX + itemSize/2, itemY + 18);

        // Highlight de l'ingrédient actuel
        if (index === currentRecipeIndex) {
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
            ctx.strokeRect(itemX, itemY, itemSize, itemSize);
        }
    });
}

function draw() {
    if (victory) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "white";
        ctx.font = "40px Arial";
        ctx.textAlign = "center";
        ctx.fillText("VICTOIRE !", W / 2, H / 2);
        return;
    }

    // 1. Fond bleu (Eau)
    ctx.fillStyle = "#29a4dc";
    ctx.fillRect(0, 0, W, H);

    // 2. Logique
    updatePhysics();
    spawnObject();
    updateObjects();

    // 3. Dessin des objets
    objects.forEach(obj => {
        ctx.fillStyle = obj.type === 'good' ? "#4CAF50" : "#F44336";
        ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(obj.id, obj.x + obj.w/2, obj.y + obj.h/2 + 5);
    });

    // 4. Dessin du radeau (joueur)
    ctx.fillStyle = "#8B4513"; // Marron bois
    ctx.fillRect(player.x, player.y, player.w, player.h);

    // 5. UI
    drawUI();

    requestAnimationFrame(draw);
}

// CONTRÔLES (GYROSCOPE)
window.addEventListener('deviceorientation', (event) => {
    // gamma est l'inclinaison gauche/droite (en degrés)
    if (event.gamma !== null) {
        player.ax = event.gamma * sensitivity;
    }
});

// GESTION DU DÉBUT DU JEU
startBtn.addEventListener('click', () => {
    startScreen.style.display = 'none';

    // Demande de permission pour le gyroscope (nécessaire sur iOS)
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    draw();
                } else {
                    alert("L'accès aux capteurs est nécessaire pour jouer !");
                }
            })
            .catch(console.error);
    } else {
        // Pour les autres navigateurs (Android/Desktop en test)
        draw();
    }
});


