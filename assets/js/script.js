const canvas = document.getElementById('gameCanva');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const startBtn = document.querySelector('.startBtn');

// Chargement des images pour le canvas
const images = {
    fabric: new Image(),
    dye: new Image(),
    needle: new Image(),
    scissors: new Image(),
    river: new Image(),
    beer: new Image(),
    gear: new Image()
};
images.fabric.src = 'assets/img/elements/ingredients/fabric.svg';
images.dye.src = 'assets/img/elements/ingredients/dye.svg';
images.needle.src = 'assets/img/elements/ingredients/needle.svg';
images.scissors.src = 'assets/img/elements/ingredients/scissors.svg';
images.river.src = 'assets/img/river.svg';
images.beer.src = 'assets/img/elements/malus/beer4.svg';
images.gear.src = 'assets/img/elements/malus/gear.svg';

// Debug: vérifier le chargement
Object.keys(images).forEach(key => {
    images[key].onerror = () => console.error(`Erreur de chargement pour l'image: ${key} (${images[key].src})`);
});

// Mapping des IDs vers les clés d'images
const ingredientMap = {
    1: 'fabric',
    2: 'dye',
    3: 'needle',
    4: 'scissors'
};

const friction = 0.75; 
const sensitivity = 0.12; 

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


// GESTION DES OBJETS
let objects = [];
const objectSize = 50; // Plus grand pour une meilleure visibilité
const spawnSpeed = 2; // Vitesse de descente
let frameCount = 0;

// RECETTE ET PROGRESSION
let recipe = [1, 2, 3, 4]; // L'ordre sera mélangé au début
let currentRecipeIndex = 0; // Quel ingrédient on cherche (0 à 3)
let gameActive = false;
let victory = false;

// ETATS DE MALUS
let controlsInverted = false;
let inversionTimer = 0;
const INVERSION_DURATION = 180; // 3 secondes à 60fps

let isOiled = false;
let oilTimer = 0;
const OIL_DURATION = 300; 

let isImmobilized = false;
let immobilizationTimer = 0;
const IMMOBILIZATION_DURATION = 120; // 2 secondes

let beerLevel = 0; // 0 à 4
let beerTimer = 0;
const BEER_DURATION = 400; 

// ANIMATION DU FOND
let backgroundY = 0;

// CONTRÔLES CLAVIER (POUR TEST PC)
let keys = {
    ArrowLeft: false,
    ArrowRight: false
};

// REDIMENSIONNEMENT
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    W = canvas.width;
    H = canvas.height;
    
    // Replace le joueur si on change la taille
    player.x = (W / 2) - (player.w / 2);
    player.y = H - player.h - 50;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// DESSIN ET MISE À JOUR (BOUCLE DE JEU)
function updatePhysics() {
    if (isImmobilized) {
        player.vx = 0;
        player.ax = 0;
        return; // On ne bouge plus si immobilisé
    }
    player.vx += player.ax;
    player.vx *= friction;
    player.x += player.vx;

    // petite marge pour empêche le joueur de "sortir" de l'eau
    const margin = W * 0.13;

    // Limites de l'écran avec marges
    if (player.x < margin) {
        player.x = margin;
        player.vx = 0;
    }
    if (player.x > W - player.w - margin) {
        player.x = W - player.w - margin;
        player.vx = 0;
    }
}

function spawnObject() {
    frameCount++;
    if (frameCount % 120 === 0) { // Toutes les ~2 secondes
        const rand = Math.random();
        let type, id;

        if (rand < 0.5) {
            type = 'good';
            id = recipe[currentRecipeIndex];
        } else if (rand < 0.8) {
            type = 'good';
            id = Math.floor(Math.random() * 4) + 1;
        } else {
            type = 'malus';
            id = Math.floor(Math.random() * 2) + 1; // 1: Inversion, 2: Huile, 3: Bière
            if (Math.random() > 0.5) id = 3; // Plus de chance de tomber sur une bière pour tester
        }
        
        const margin = W * 0.15;
        const spawnX = margin + Math.random() * (W - objectSize - 2 * margin);

        objects.push({
            x: spawnX,
            y: -objectSize,
            w: objectSize,
            h: objectSize,
            type: type,
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

function updateRecipeUI() {
    const wrapper = document.getElementById('recipe-container');
    const container = document.getElementById('recipe-items');
    
    // On affiche le cadre seulement si le jeu est actif
    if (gameActive && !victory) {
        wrapper.style.display = 'flex';
    } else {
        wrapper.style.display = 'none';
        return;
    }

    container.innerHTML = '';
    
    recipe.forEach((id, index) => {
        const item = document.createElement('div');
        item.className = 'recipe-item';
        
        // On assigne le visuel correspondant à l'ID
        const type = ingredientMap[id];
        if (type) {
            item.classList.add(`item-${type}`);
        }

        if (index < currentRecipeIndex) {
            item.classList.add('collected');
        } else if (index === currentRecipeIndex) {
            item.classList.add('current');
        }
        
        container.appendChild(item);
    });
}

function handlePickup(obj) {
    if (obj.type === 'good') {
        if (obj.id === recipe[currentRecipeIndex]) {
            currentRecipeIndex++;
            updateRecipeUI();
            if (currentRecipeIndex === recipe.length) {
                victory = true;
            }
        } else {
            // Mauvais ordre
            currentRecipeIndex = 0;
            updateRecipeUI();
        }
    } else {
        // Malus
        if (obj.id === 1 || obj.id === 2) { // Malus Engrenage (Immobilisation)
            isImmobilized = true;
            immobilizationTimer = IMMOBILIZATION_DURATION;
        } else if (obj.id === 3) { // Malus Bière (Inversion + États)
            controlsInverted = true;
            inversionTimer = BEER_DURATION;
            beerLevel = 4;
            beerTimer = BEER_DURATION;
            updateBeerUI();
        }
        // On ne reset plus la recette en cas de malus !
    }
}

function updateBeerUI() {
    const beerUI = document.getElementById('beer-status');
    if (beerLevel > 0) {
        beerUI.style.display = 'block';
        beerUI.className = `beer-${beerLevel}`;
    } else {
        beerUI.style.display = 'none';
    }
}

function drawUI() {
    // Le cadre de recette est maintenant géré en HTML/CSS

    // JAUGE D'INVERSION
    if (controlsInverted) {
        const gaugeW = 100;
        const gaugeH = 10;
        const gaugeX = W - gaugeW - 20;
        const gaugeY = 20;

        // Fond jauge
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);

        // Remplissage (temps restant)
        const progress = inversionTimer / INVERSION_DURATION;
        ctx.fillStyle = "#FF5722";
        ctx.fillRect(gaugeX, gaugeY, gaugeW * progress, gaugeH);

        ctx.fillStyle = "white";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "right";
        ctx.fillText("ATTENTION : INVERSE !", gaugeX + gaugeW, gaugeY - 5);
    }

    // JAUGE D'HUILE
    if (isOiled) {
        const gaugeW = 100;
        const gaugeH = 10;
        const gaugeX = W - gaugeW - 20;
        const gaugeY = controlsInverted ? 50 : 20; // Se décale si l'autre jauge est là

        // Fond jauge
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);

        // Remplissage (temps restant)
        const progress = oilTimer / OIL_DURATION;
        ctx.fillStyle = "#FFC107"; // Jaune huile
        ctx.fillRect(gaugeX, gaugeY, gaugeW * progress, gaugeH);

        ctx.fillStyle = "white";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "right";
        ctx.fillText("ATTENTION : HUILE !", gaugeX + gaugeW, gaugeY - 5);
    }
}

function draw() {
    requestAnimationFrame(draw);

    if (victory) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "white";
        ctx.font = "40px Arial";
        ctx.textAlign = "center";
        ctx.fillText("VICTOIRE !", W / 2, H / 2);
        return;
    }

    // 1. On efface le canvas
    ctx.clearRect(0, 0, W, H);

    // 1b. On anime et on dessine le fond (la rivière)
    backgroundY += spawnSpeed;
    if (images.river.complete && images.river.naturalWidth !== 0) {
        let drawWidth = images.river.naturalWidth;
        let drawHeight = images.river.naturalHeight;
        const imgH = W * (drawHeight / drawWidth);
        const yOffset = backgroundY % imgH;
        
        // On dessine assez de tuiles pour remplir TOUT le rectangle (H)
        for (let y = yOffset - imgH; y < H; y += imgH) {
            ctx.drawImage(images.river, 0, y, W, imgH);
        }
    } else {
        ctx.fillStyle = "#29a4dc";
        ctx.fillRect(0, 0, W, H);
    }

    // Si le jeu n'est pas actif, on s'arrête là (on ne dessine que le fond)
    if (!gameActive) return;

    // 2. Logique de jeu
    if (controlsInverted) {
        inversionTimer--;
        if (inversionTimer <= 0) controlsInverted = false;
    }
    if (isOiled) {
        oilTimer--;
        if (oilTimer <= 0) isOiled = false;
    }
    if (isImmobilized) {
        immobilizationTimer--;
        if (immobilizationTimer <= 0) isImmobilized = false;
    }
    if (beerLevel > 0) {
        beerTimer--;
        // L'inversion s'arrête quand la bière est vide
        if (beerTimer <= 0) {
            controlsInverted = false;
            inversionTimer = 0;
        }
        // On change l'état de la bière tous les 1/4 du temps
        let newLevel = Math.ceil((beerTimer / BEER_DURATION) * 4);
        if (newLevel !== beerLevel) {
            beerLevel = newLevel;
            updateBeerUI();
        }
    }

    handleKeyboardInput();
    updatePhysics();
    spawnObject();
    updateObjects();

    // 3. Dessin des objets
    objects.forEach(obj => {
        let currentImg = null;
        if (obj.type === 'good') {
            const typeKey = ingredientMap[obj.id];
            currentImg = images[typeKey];
        } else {
            // Malus images
            if (obj.id === 1 || obj.id === 2) currentImg = images.gear; // Engrenage pour inversion/huile
            if (obj.id === 3) currentImg = images.beer; // Bière (beer4 par défaut)
        }

        if (currentImg && currentImg.complete && currentImg.naturalWidth !== 0) {
            ctx.drawImage(currentImg, obj.x, obj.y, obj.w, obj.h);
        } else {
            // Fallback
            ctx.fillStyle = obj.type === 'good' ? "#4CAF50" : "#F44336";
            ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
            ctx.fillStyle = "white";
            ctx.font = "bold 14px Arial";
            ctx.textAlign = "center";
            ctx.fillText(obj.id, obj.x + obj.w/2, obj.y + obj.h/2 + 5);
        }
    });

    // 4. Dessin du radeau (joueur)
    ctx.fillStyle = "#8B4513"; // Marron bois
    ctx.fillRect(player.x, player.y, player.w, player.h);

    // 5. UI
    drawUI();
}

// CONTRÔLES (GYROSCOPE)
window.addEventListener('deviceorientation', (event) => {
    if (event.gamma !== null) {
        let currentSense = isOiled ? sensitivity / 2 : sensitivity;
        let tilt = event.gamma * currentSense;
        if (controlsInverted) tilt *= -1;
        player.ax = tilt;
    }
});

// CONTRÔLES (CLAVIER)
window.addEventListener('keydown', (e) => {
    if (e.key in keys) keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key in keys) keys[e.key] = false;
});

function handleKeyboardInput() {
    let currentSense = isOiled ? sensitivity / 2 : sensitivity;
    let tilt = 0;
    if (keys.ArrowLeft) tilt = -20 * currentSense;
    if (keys.ArrowRight) tilt = 20 * currentSense;
    
    if (tilt !== 0) {
        if (controlsInverted) tilt *= -1;
        player.ax = tilt;
    } else if (typeof DeviceOrientationEvent === 'undefined') {
        player.ax = 0;
    }
}

function shuffleRecipe() {
    for (let i = recipe.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [recipe[i], recipe[j]] = [recipe[j], recipe[i]];
    }
}

// GESTION DU DÉBUT DU JEU
startBtn.addEventListener('click', () => {
    startScreen.style.display = 'none';
    gameActive = true; 

    // Initialisation / Reset du jeu
    currentRecipeIndex = 0;
    victory = false;
    objects = [];
    beerLevel = 0;
    beerTimer = 0;
    isImmobilized = false;
    controlsInverted = false;
    updateBeerUI();
    shuffleRecipe();
    updateRecipeUI();

    // Demande de permission pour le gyroscope (nécessaire sur iOS)
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState !== 'granted') {
                    alert("L'accès aux capteurs est nécessaire pour jouer !");
                }
            })
            .catch(console.error);
    }
});

// DÉMARRAGE IMMÉDIAT DE LA BOUCLE (pour voir le fond tout de suite)
draw();
