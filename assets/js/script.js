const canvas = document.getElementById('gameCanva');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const startBtn = document.querySelector('.startBtn');

var H, W;

// INITIALISATION DU JOUEUR
let player = {
    x: 0,
    y: 0,
    w: 40,
    h: 40,
    vx: 0,
    ax: 0
};

const friction = 0.92; // Plus proche de 1 = moins de friction (plus d'inertie)
const sensitivity = 0.15; // Puissance de l'inclinaison

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
function draw() {
    // 1. Fond bleu (Eau)
    ctx.fillStyle = "#29a4dc";
    ctx.fillRect(0, 0, W, H);

    // 2. Physique (Inertie)
    player.vx += player.ax;
    player.vx *= friction;
    player.x += player.vx;

    // 3. Limites de l'écran
    if (player.x < 0) {
        player.x = 0;
        player.vx = 0;
    }
    if (player.x > W - player.w) {
        player.x = W - player.w;
        player.vx = 0;
    }

    // 4. Dessin du carré noir
    ctx.fillStyle = "black";
    ctx.fillRect(player.x, player.y, player.w, player.h);

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


