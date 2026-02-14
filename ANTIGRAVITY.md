# ANTIGRAVITY.md
> 🤖 **Project Memory & Guidelines**
> "Keep your gravity, don't float away."

## 1. Project Overview
- **Name**: 嘟嘟好 (Just Make) - CNY Edition
- **Type**: Mobile-first Web Game (Dice & Gambling)
- **Repo**: `https://github.com/kuo1990/JustMake`
- **Tech Stack**:
  - HTML5 (Semantic)
  - CSS3 (Variables, Grid/Flexbox, Animations)
  - Vanilla JavaScript (ES6+, No Frameworks)

## 2. Design Philosophy
- **Mobile First**: All UI must be touch-friendly and responsive (320px - 480px priority).
- **Localized (TW)**: All text must be **Traditional Chinese (Taiwan)**.
  - *Correct*: "開啟搖晃偵測", "重新開始", "發財金"
  - *Avoid*: "Enable Shake", "Restart", "Money"
- **Festive Aesthetic**: Red/Gold palette, rounded corners, drop shadows.
- **Feedback**: Every action (Click/Shake) must have Visual + Audio feedback.

## 3. Key Features & Logic
- **Dice System**: `6` distinct dice (Standard 1-6). Collision detection prevents overlap.
- **Game Economy**:
  - Starting Pot: Editable (Default $100/player).
  - Win Condition: Roll = Pot (Jackpot).
  - Lose Condition: Roll > Pot (Bounce Back / Recall).
- **Shake Detection**:
  - Requires permission on iOS (`DeviceMotionEvent`).
  - Threshold: Speed > 15 (Shake), > 40 (Throw).
- **Victory**: Full-screen overlay + Firecrackers + `winner.mov`.

## 4. 🛑 Lessons Learned (Don'ts)
1.  **Do NOT use spaces in CSS units**: `top: ${y}px` ✅, `top: ${y} px` ❌ (Breaks layout).
2.  **Do NOT remove DOM elements without checking JS**: Removing `#dice-cup` broke the `game.js` init logic. Always check references first.
3.  **Do NOT rely on external assets**: Ensure `winner.mov` and `die_face_*.svg` exist locally before referencing.
4.  **Do NOT use absolute positioning for flexible UI**: Use `Flexbox` or `Grid` for headers to avoid button overlap.

## 5. File Structure
- `index.html`: Entry point.
- `style.css`: All styles (includes animations & responsive constraints).
- `game.js`:
  - `JustMakeGame` class (Controller).
  - `ConfettiSystem` class (Visuals).
  - Event Listeners (Shake/Click).
- `assets/`: Images & SVG dice faces.
- `winner.mov`, `dice_rolling.mp3`: Audio files.
