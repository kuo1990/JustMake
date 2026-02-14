// Confetti System
class ConfettiSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.animating = false;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    burst() {
        for (let i = 0; i < 100; i++) {
            this.particles.push({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 1) * 20,
                color: ['#FFD700', '#D32F2F', '#FFF'][Math.floor(Math.random() * 3)],
                size: Math.random() * 10 + 5,
                rotation: Math.random() * 360,
                vRot: (Math.random() - 0.5) * 10
            });
        }
        if (!this.animating) this.animate();
    }

    animate() {
        this.animating = true;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.5; // Gravity
            p.rotation += p.vRot;

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation * Math.PI / 180);
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            this.ctx.restore();

            if (p.y > this.canvas.height) this.particles.splice(i, 1);
        }

        if (this.particles.length > 0) {
            requestAnimationFrame(() => this.animate());
        } else {
            this.animating = false;
        }
    }
}

class JustMakeGame {
    constructor() {
        // Configuration
        this.basePotPerPlayer = 210; // (1+2+3+4+5+6)*10 = 210
        this.cashPerPoint = 10;
        this.avatars = [
            '🐲', '🦁', '🧧', '💰', '🍊', '🍍', '🧨', '🏮',
            '🐯', '🐰', '🐍', '🐎', '🐐', '🐒', '🐔', '🐶', '🐷',
            '💎', '🀄', '🎲', '🎋', '🥟', '🍵', '🌑'
        ];

        // Systems
        this.audio = {
            ctx: new (window.AudioContext || window.webkitAudioContext)(),
            shake: new Audio('dice_rolling.mp3'),
            roll: new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3'),
            win: new Audio('winner.mov'), // User provided file
            playShake: () => {
                const s = this.audio.shake;
                s.loop = true;
                s.currentTime = 0;
                s.play().catch(() => { });
            },
            stopShake: () => {
                this.audio.shake.pause();
                this.audio.shake.currentTime = 0;
            },
            playClack: () => {
                const s = this.audio.roll;
                s.currentTime = 0;
                s.play().catch(() => { });
            },
            playWin: () => {
                const s = this.audio.win;
                s.currentTime = 0;
                s.play().catch(() => { });
            },
            playMoney: () => {
                // Reuse clack for now or add new sound
                // Preventing crash is priority
                const s = this.audio.roll;
                if (s.paused) {
                    s.currentTime = 0;
                    s.play().catch(() => { });
                }
            }
        };
        this.confetti = new ConfettiSystem('confetti-canvas');

        // State
        this.players = [];
        this.currentPlayerIndex = 0;
        this.potBalance = 0;
        this.gameStatus = 'SETUP';

        // DOM Elements
        this.ui = {
            setupScreen: document.getElementById('setup-screen'),
            gameScreen: document.getElementById('game-screen'),
            playerCountInput: document.getElementById('player-count'),
            initialPotDisplay: document.getElementById('initial-pot-display'),
            currentPotDisplay: document.getElementById('current-pot'),
            potContainer: document.querySelector('.pot-container'),
            diceContainer: document.getElementById('dice-container'),
            playerName: document.getElementById('player-name'),
            playerAvatar: document.getElementById('player-avatar'),
            rollResult: document.getElementById('roll-result-display'),
            rollBtn: document.getElementById('roll-btn'),
            overlay: document.getElementById('overlay'),
            overlayTitle: document.getElementById('overlay-title'),
            overlayMessage: document.getElementById('overlay-message'),
            overlayBtn: document.getElementById('overlay-btn'),
            overlayIcon: document.getElementById('overlay-icon'),
            overlayContent: document.querySelector('.overlay-content'),
            diceCupOverlay: document.getElementById('dice-cup-overlay')
        };

        this.shakeState = {
            lastX: null, lastY: null, lastZ: null,
            lastTime: 0,
            shakeStartTime: 0,
            isShaking: false
        };

        this.initEventListeners();
        this.setupShakeDetection();
        this.updateSetupPreview();

        // Unlock audio context on user interaction
        document.body.addEventListener('click', () => {
            if (this.audio.ctx.state === 'suspended') this.audio.ctx.resume();
        }, { once: true });
        // Visibility API to mute in background
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.audio.stopShake();
                this.shakeState.isShaking = false;
            }
        });
    }

    setupShakeDetection() {
        const btn = document.getElementById('shake-perm-btn');

        // Check if DeviceMotionEvent is defined
        if (typeof DeviceMotionEvent !== 'undefined') {
            // iOS 13+ requires permission
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                btn.classList.remove('hidden');
                btn.onclick = () => {
                    this.audio.ctx.resume(); // Ensure AudioContext is resumed on click
                    DeviceMotionEvent.requestPermission()
                        .then(response => {
                            if (response === 'granted') {
                                window.addEventListener('devicemotion', (e) => this.handleMotion(e));
                                btn.classList.add('hidden');
                                this.showSnackbar('搖一搖已啟用', '大力甩動手機來擲骰子！', 'normal');
                            }
                        })
                        .catch(console.error);
                };
            } else {
                // Non-iOS 13+ devices (Android or older iOS)
                window.addEventListener('devicemotion', (e) => this.handleMotion(e));
            }
        }
    }

    handleMotion(event) {
        if (this.gameStatus !== 'IDLE') return;
        if (this.shakeCooldown) return; // Prevent immediate re-trigger

        const current = event.accelerationIncludingGravity;
        if (!current) return;

        const currentTime = Date.now();
        if ((currentTime - this.shakeState.lastTime) < 100) return; // Throttle 100ms

        const { x, y, z } = current;
        const { lastX, lastY, lastZ } = this.shakeState;

        if (lastX === null) {
            this.shakeState.lastX = x;
            this.shakeState.lastY = y;
            this.shakeState.lastZ = z;
            this.shakeState.lastTime = currentTime;
            return;
        }

        const deltaX = Math.abs(x - lastX);
        const deltaY = Math.abs(y - lastY);
        const deltaZ = Math.abs(z - lastZ);

        // Sensitivity thresholds
        const shakeThreshold = 15; // Increased to prevent accidental triggering
        const throwThreshold = 40; // Harder shake to throw

        const speed = deltaX + deltaY + deltaZ;

        // Continuous Shake Sound Logic
        if (speed > shakeThreshold) {
            this.shakeState.shakeStartTime = currentTime;
            if (!this.shakeState.isShaking) {
                this.shakeState.isShaking = true;
                this.audio.playShake();
                this.ui.diceContainer.classList.add('shaking'); // Visual Feedback
            }
        } else {
            // Stop sound if shaking stops for 300ms
            if (this.shakeState.isShaking && (currentTime - this.shakeState.shakeStartTime > 300)) {
                this.shakeState.isShaking = false;
                this.audio.stopShake();
                this.ui.diceContainer.classList.remove('shaking'); // Stop Visual
            }
        }

        // Trigger Throw
        if (speed > throwThreshold) {
            this.audio.stopShake(); // Stop looping sound
            this.ui.diceContainer.classList.remove('shaking'); // Stop visual
            this.shakeState.isShaking = false;
            this.playTurn(true); // Cup Roll (treated as Shake Roll)
        }

        this.shakeState.lastX = x;
        this.shakeState.lastY = y;
        this.shakeState.lastZ = z;
        this.shakeState.lastTime = currentTime;
    }

    // ... inside nextTurn ...
    nextTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.gameStatus = 'IDLE';
        this.ui.rollBtn.disabled = false;

        // Clear dice for the next player (User Request)
        const nextPlayerName = this.players[this.currentPlayerIndex].name;
        this.ui.diceContainer.innerHTML = `<div class="placeholder-text">換 ${nextPlayerName} 試試手氣!</div>`;

        // Add cooldown to prevent accidental shakes immediately getting detected
        this.shakeCooldown = true;
        setTimeout(() => {
            this.shakeCooldown = false;
        }, 1000); // 1.0s safety period

        this.updateGameUI();
    }

    initEventListeners() {
        document.getElementById('decrease-players').addEventListener('click', () => this.adjustPlayers(-1));
        document.getElementById('increase-players').addEventListener('click', () => this.adjustPlayers(1));
        document.getElementById('start-game-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.resetGame()); // New Listener

        // Hybrid Roll Trigger
        this.ui.rollBtn.addEventListener('click', () => {
            // Force Fast Roll if clicking button, unless shaking is somehow persistent
            // Actually, if clicking button, it's likely intended as a manual roll.
            // But if shaking, we want the shake behavior.
            const isShaking = this.shakeState && this.shakeState.isShaking;
            this.playTurn(isShaking);
        });

        this.ui.overlayBtn.addEventListener('click', () => this.hideOverlay());

        // Input listener for manual pot edit
        this.ui.playerCountInput.addEventListener('change', () => this.updateSetupPreview());
    }

    adjustPlayers(delta) {
        let count = parseInt(this.ui.playerCountInput.value);
        count += delta;
        if (count < 2) count = 2;
        if (count > 20) count = 20;
        this.ui.playerCountInput.value = count;
        this.updateSetupPreview();
    }

    updateSetupPreview() {
        const count = parseInt(this.ui.playerCountInput.value);
        // Only update if user hasn't manually messed with it too much? 
        // Actually, let's just update the value based on players if it matches logic, 
        // otherwise let user type. For simplicity, we just update it.
        const total = count * this.basePotPerPlayer;
        const input = document.getElementById('initial-pot-input');
        input.value = total;
    }

    startGame() {
        const playerCount = parseInt(this.ui.playerCountInput.value);
        const inputPot = parseInt(document.getElementById('initial-pot-input').value); // Read Input

        // Shuffle avatars
        const shuffledAvatars = [...this.avatars].sort(() => 0.5 - Math.random());

        this.players = Array.from({ length: playerCount }, (_, i) => ({
            id: i + 1,
            name: `玩家 ${i + 1} `,
            avatar: shuffledAvatars[i % shuffledAvatars.length], // Use modulo just in case but we have enough
            moneyToken: 0
        }));

        this.potBalance = isNaN(inputPot) ? playerCount * this.basePotPerPlayer : inputPot;
        this.currentPlayerIndex = 0;

        // Initial Leaderboard
        this.updateLeaderboard();

        this.ui.setupScreen.classList.remove('active');
        this.ui.gameScreen.classList.add('active');

        this.updateGameUI();
        this.gameStatus = 'IDLE';
    }

    resetGame() {
        // if(!confirm("確定要重新開始遊戲嗎？")) return; // Removing native confirm for smoother UX
        this.gameStatus = 'SETUP';

        // Clear dice from previous game
        this.ui.diceContainer.innerHTML = '<div class="placeholder-text">準備好手氣...</div>';

        this.ui.gameScreen.classList.remove('active');
        this.ui.setupScreen.classList.add('active');
        this.updateSetupPreview();
    }

    updateGameUI() {
        this.ui.currentPotDisplay.textContent = `$${this.potBalance} `;
        const player = this.players[this.currentPlayerIndex];
        this.ui.playerName.textContent = player.name;
        this.ui.playerAvatar.textContent = player.avatar;
        this.ui.rollResult.textContent = '';

        const popup = document.querySelector('.points-popup');
        if (popup) popup.remove();

        // Placeholder handling is now done in nextTurn (add) and playTurn (remove)
        // const placeholder = this.ui.diceContainer.querySelector('.placeholder-text');
        // if (this.gameStatus !== 'SETUP' && placeholder) {
        //    placeholder.remove();
        // }

        this.updateLeaderboard(); // Sync Leaderboard Highlight
    }

    createDieHTMLElement(value, existingDice) {
        const die = document.createElement('div');
        die.className = 'die';
        die.dataset.value = value;

        // No pips needed, using background image via CSS

        // Collision Detection Loop
        let top, left;
        let overlap = true;
        let retries = 0;
        const maxRetries = 100;
        const containerW = 320;
        const containerH = 240;
        const padding = 20;
        const dieSize = 50;

        while (overlap && retries < maxRetries) {
            retries++;

            // Rectangular Distribution
            left = padding + Math.random() * (containerW - dieSize - padding * 2);
            top = padding + Math.random() * (containerH - dieSize - padding * 2);

            // Check against existing
            overlap = false;
            for (let other of existingDice) {
                const dx = left - other.left;
                const dy = top - other.top;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < dieSize * 0.9) { // 0.9 allows slight squeeze
                    overlap = true;
                    break;
                }
            }
        }

        const rotate = Math.random() * 360;
        die.style.top = `${top}px`;
        die.style.left = `${left}px`;
        die.style.transform = `rotate(${rotate}deg)`;

        // Save pos for next check
        existingDice.push({ top, left });

        return die;
    }

    async playTurn(isCupRoll = false) {
        if (this.gameStatus !== 'IDLE') return;

        this.gameStatus = 'ROLLING';
        this.ui.rollBtn.disabled = true;
        this.audio.stopShake(); // Ensure shake sound stops

        // 1. Shake Phase (0.8s) - Shake the Bowl/Mat
        this.ui.diceContainer.innerHTML = '';
        this.ui.diceContainer.classList.add('shaking');

        let shakeInterval;
        if (isCupRoll) {
            shakeInterval = setInterval(() => {
                this.audio.playShake();
                if (navigator.vibrate) navigator.vibrate(50);
            }, 100);
        }

        await new Promise(r => setTimeout(r, 800));

        if (isCupRoll && shakeInterval) {
            clearInterval(shakeInterval);
            this.audio.stopShake();
        }

        this.ui.diceContainer.classList.remove('shaking');
        // No lift animation needed anymore

        await new Promise(r => setTimeout(r, 200));

        // 2. Land Phase
        this.audio.playClack();

        const diceCount = 6;
        const rolls = [];
        const dicePositions = []; // Store {top, left} for collision check

        for (let i = 0; i < diceCount; i++) {
            // Standard 1-6 dice
            const val = Math.floor(Math.random() * 6) + 1;
            rolls.push(val);

            const die = this.createDieHTMLElement(val, dicePositions);
            die.style.animation = 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            this.ui.diceContainer.appendChild(die);
        }

        const points = rolls.reduce((a, b) => a + b, 0);

        // 3. Reveal Phase (Suspense 1.0s per user request)
        // Show points bubble AFTER delay? Or during? User said "Wait 1s then show details".
        // Let's settle on: Dice visible -> Wait 1s -> Show Points Bubble -> Wait 2s -> Result.
        await new Promise(r => setTimeout(r, 1000));

        // 4. Show Points Popup
        this.showPointsPopup(points);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

        // Wait another 2s before showing money result
        await new Promise(r => setTimeout(r, 2000));

        this.resolveTurn(rolls, points);
    }

    showPointsPopup(points) {
        // Clear previous
        this.ui.rollResult.innerHTML = '';

        const popup = document.createElement('div');
        popup.className = 'points-popup static';
        popup.textContent = `${points} 點!`;

        // Append to fixed container
        this.ui.rollResult.appendChild(popup);
        this.audio.playMoney();
    }

    resolveTurn(rolls, points) {
        const rollValue = points * this.cashPerPoint;
        this.processGameLogic(rollValue, points);
    }

    showFloatingText(amount, isNegative) {
        const float = document.createElement('div');
        float.className = isNegative ? 'float-up-text negative' : 'float-up-text';
        float.textContent = isNegative ? `- $${Math.abs(amount)} ` : ` + $${amount} `;

        // Position relative to pot
        const rect = this.ui.potContainer.getBoundingClientRect();
        // We append to body to absolute position correctly on screen
        document.body.appendChild(float);

        float.style.left = `${rect.left + rect.width / 2}px`;
        float.style.top = `${rect.top}px`;

        setTimeout(() => float.remove(), 1500);
    }

    processGameLogic(rollValue, points) {
        const player = this.players[this.currentPlayerIndex];
        let amountChange = 0;
        let type = 'normal';

        // 1. Victory (Just Make)
        if (rollValue === this.potBalance) {
            this.handleVictory(player, rollValue);
            return;
        }

        // 2. Normal Take
        if (rollValue < this.potBalance) {
            this.potBalance -= rollValue;
            player.moneyToken += rollValue;
            amountChange = rollValue;
            this.showFloatingText(rollValue, true); // Pot loses money

            if (rollValue > 0) {
                this.showOverlay('恭喜發財', `你擲出了 ${points} 點！\n從獎金池拿走 $${rollValue}。`, 'normal');
            } else {
                // Zero points - auto skip after short delay
                setTimeout(() => this.nextTurn(), 1000);
            }
        }

        // 3. Bounce Back (Recall)
        else {
            const bounceBackAmount = rollValue - this.potBalance;
            this.potBalance += bounceBackAmount;
            player.moneyToken -= bounceBackAmount;
            amountChange = -bounceBackAmount;
            type = 'bounce-back';

            this.showFloatingText(bounceBackAmount, false); // Pot gains money
            this.showOverlay('倒扣機制', `爆了！\n擲出 ${points} 點($${rollValue}) > 獎金池餘額。\n你需要賠付 $${bounceBackAmount} 充公！`, 'bounce-back');
        }

        // this.logTurn(player, points, amountChange, type); // Removed logTurn
        this.updateLeaderboard(); // Update Leaderboard instead
        this.updateGameUI();
    }

    handleVictory(player, amount) {
        this.gameStatus = 'WIN';

        // 1. Winner takes the pot
        player.moneyToken += this.potBalance;
        this.potBalance = 0;

        // 2. "Just Make" Bonus: Each other player pays 'amount' to the winner
        // amount is the pot size before it was cleared (passed as argument)
        this.players.forEach(p => {
            if (p.id !== player.id) {
                p.moneyToken -= amount;
                player.moneyToken += amount;
            }
        });

        // this.logTurn(player, amount / this.cashPerPoint, amount, 'win'); // Removed logTurn
        this.updateLeaderboard(); // Update Leaderboard

        this.updateGameUI();
        this.confetti.burst();
        this.showFirecrackers();
        this.audio.playWin();

        // Generate Final Ranking HTML
        const sortedPlayers = [...this.players].sort((a, b) => b.moneyToken - a.moneyToken);
        let rankingHTML = '<div class="final-ranking">';
        rankingHTML += sortedPlayers.map((p, index) => {
            const rank = index + 1;
            const isWinner = index === 0;
            const medal = isWinner ? '👑' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : `#${rank} `));
            const amountClass = p.moneyToken >= 0 ? 'positive' : 'negative';

            return `
                <div class="rank-row ${isWinner ? 'winner' : ''}">
                    <div class="rank-medal">${medal}</div>
                    <div class="rank-avatar">${p.avatar}</div>
                    <div class="rank-name">${p.name}</div>
                    <div class="rank-amount ${amountClass}">$${p.moneyToken}</div>
                </div>
            `;
        }).join('');
        rankingHTML += '</div>';

        const message = `
            <div class="win-summary">
                <p>恭喜 ${player.name} 清空獎金池！<br>通殺全場！每位玩家額外支付 $${amount}！</p>
            </div>
            ${rankingHTML}
        `;

        this.showOverlay('🏆 最終發財榜', message, 'win');

        this.ui.overlayBtn.textContent = "再來一局";
        this.ui.overlayBtn.onclick = () => location.reload();
    }

    showFirecrackers() {
        const container = document.createElement('div');
        container.className = 'firecracker-container';
        container.innerHTML = `
            <div class="firecracker">🧨</div>
            <div class="firecracker">🧨</div>
        `;
        document.body.appendChild(container);
        // Remove after 5 seconds
        setTimeout(() => container.remove(), 5000);
    }

    updateLeaderboard() {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;

        // Sort players by money (descending) -> REMOVED per user request
        // const sortedPlayers = [...this.players].sort((a, b) => b.moneyToken - a.moneyToken);
        const displayPlayers = this.players; // Keep original order

        list.innerHTML = displayPlayers.map(p => {
            const amountClass = p.moneyToken >= 0 ? 'positive' : 'negative';
            const sign = p.moneyToken > 0 ? '+' : '';
            return `
    <div class="log-entry" style="${p.id === this.players[this.currentPlayerIndex].id ? 'background: rgba(255,215,0,0.1);' : ''}">
                    <div class="log-player">
                        <span class="avatar">${p.avatar}</span>
                        <span class="name">${p.name}</span>
                    </div>
                    <div class="log-amount ${amountClass}">${sign}$${p.moneyToken}</div>
                </div>
    `;
        }).join('');
    }

    showOverlay(title, message, type) {
        if (type === 'win') {
            // Full Overlay for Jackpot
            this.ui.overlayTitle.textContent = title;
            this.ui.overlayMessage.innerHTML = message; // Allow HTML
            this.ui.overlayContent.className = 'overlay-content win-mode';
            this.ui.overlayIcon.textContent = '🧧';
            this.ui.overlay.classList.remove('hidden');
        } else {
            // Snackbar for regular updates
            this.showSnackbar(title, message, type);
        }
    }

    showSnackbar(title, message, type) {
        const sb = document.getElementById('snackbar');
        const icon = sb.querySelector('.snackbar-icon');
        const titleEl = sb.querySelector('.snackbar-title');
        const msgEl = sb.querySelector('.snackbar-message');

        titleEl.textContent = title;
        msgEl.textContent = message;
        sb.className = 'snackbar'; // Reset class

        if (type === 'normal') {
            sb.classList.add('normal');
            icon.textContent = '💰';
        } else if (type === 'bounce-back') {
            sb.classList.add('bounce-back');
            icon.textContent = '💸';
        }

        sb.classList.remove('hidden');

        // Auto hide after 2.5s and next turn
        setTimeout(() => {
            sb.classList.add('hidden');
            if (this.gameStatus !== 'WIN') {
                this.nextTurn();
            }
        }, 2500);
    }

    hideOverlay() {
        this.ui.overlay.classList.add('hidden');
        // Only next turn if we closed a win overlay manually? 
        // Actually win overlay usually reloads game. 
        // If we use overlay for generic messages later, we might need this.
    }

    nextTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this.gameStatus = 'IDLE';
        this.ui.rollBtn.disabled = false;
        this.updateGameUI();
    }
}

// Start App
window.addEventListener('DOMContentLoaded', () => {
    new JustMakeGame();
});
