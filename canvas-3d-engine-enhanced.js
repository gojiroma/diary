/**
 * Enhanced Canvas 3D Text Rendering Engine
 * 高度な3D効果、パーティクルシステム、インタラクションを搭載
 */

class Canvas3DTextRendererEnhanced {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: true });
        this.width = canvas.width;
        this.height = canvas.height;
        
        // 3D設定
        this.perspective = options.perspective || 1000;
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        this.targetRotationZ = 0;
        this.cameraDistance = options.cameraDistance || 0;
        
        // テキスト設定
        this.fontSize = options.fontSize || 24;
        this.fontFamily = options.fontFamily || 'gojiromanus, serif';
        this.textColor = options.textColor || '#8fbcf2';
        this.backgroundColor = options.backgroundColor || '#271f2c';
        
        // アニメーション設定
        this.animationTime = 0;
        this.isAnimating = false;
        this.characters = [];
        this.glyphCache = new Map();
        
        // レイアウト設定
        this.lineHeight = options.lineHeight || 1.8;
        this.letterSpacing = options.letterSpacing || 0.1;
        this.verticalMode = options.verticalMode !== false;
        
        // パーティクルシステム
        this.particles = [];
        this.particleCount = options.particleCount || 60;
        this.particleEmitters = [];
        
        // インタラクション
        this.mouseX = this.width / 2;
        this.mouseY = this.height / 2;
        this.mouseVX = 0;
        this.mouseVY = 0;
        this.interactionRadius = 150;
        this.interactionStrength = 0.15;
        
        // エフェクト
        this.bloomEffect = true;
        this.motionBlur = true;
        this.glitchEffect = false;
        this.glitchIntensity = 0;
        
        // パフォーマンス
        this.frameCount = 0;
        this.fps = 0;
        this.lastFrameTime = Date.now();
        
        this.initParticles();
        this.startAnimation();
    }
    
    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push(this.createParticle());
        }
    }
    
    createParticle() {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 1 + 0.5;
        return {
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            z: Math.random() * 400 - 200,
            vx: Math.cos(angle) * speed * 0.3,
            vy: Math.sin(angle) * speed * 0.3,
            vz: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 0.5,
            opacity: Math.random() * 0.6 + 0.2,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: Math.random() * 0.02 + 0.005,
            life: 1,
            maxLife: 1,
            color: this.randomColor(),
            trail: []
        };
    }
    
    randomColor() {
        const colors = ['#8fbcf2', '#a7be80', '#ff6b9d', '#ffd93d', '#6bcf7f'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    updateParticles() {
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            
            // 速度更新
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.vz *= 0.98;
            
            // 位置更新
            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;
            
            // ライフタイム
            p.life -= 0.005;
            
            // ワイヤーフレーム効果
            p.wobble += p.wobbleSpeed;
            
            // 画面外判定とリセット
            if (p.life <= 0 || p.x < -100 || p.x > this.width + 100 || 
                p.y < -100 || p.y > this.height + 100) {
                this.particles[i] = this.createParticle();
            }
        }
    }
    
    drawParticles() {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // パーティクル接続
        for (let i = 0; i < this.particles.length; i++) {
            const p1 = this.particles[i];
            const screenPos1 = this.projectPoint(
                p1.x - centerX,
                p1.y - centerY,
                p1.z
            );
            
            for (let j = i + 1; j < Math.min(i + 5, this.particles.length); j++) {
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dz = p1.z - p2.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < 200) {
                    const screenPos2 = this.projectPoint(
                        p2.x - centerX,
                        p2.y - centerY,
                        p2.z
                    );
                    
                    const opacity = (1 - distance / 200) * 0.2 * Math.min(p1.life, p2.life);
                    this.ctx.strokeStyle = this.hexToRgba(p1.color, opacity);
                    this.ctx.lineWidth = 0.8;
                    this.ctx.beginPath();
                    this.ctx.moveTo(screenPos1.x, screenPos1.y);
                    this.ctx.lineTo(screenPos2.x, screenPos2.y);
                    this.ctx.stroke();
                }
            }
        }
        
        // パーティクル描画
        for (let p of this.particles) {
            const screenPos = this.projectPoint(
                p.x - centerX,
                p.y - centerY,
                p.z
            );
            
            const opacity = p.opacity * p.life;
            const size = p.size * screenPos.scale;
            
            // グロー効果
            if (this.bloomEffect) {
                const glowGradient = this.ctx.createRadialGradient(
                    screenPos.x, screenPos.y, 0,
                    screenPos.x, screenPos.y, size * 3
                );
                glowGradient.addColorStop(0, this.hexToRgba(p.color, opacity * 0.3));
                glowGradient.addColorStop(1, this.hexToRgba(p.color, 0));
                this.ctx.fillStyle = glowGradient;
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, size * 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            // パーティクル本体
            this.ctx.fillStyle = this.hexToRgba(p.color, opacity);
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    projectPoint(x, y, z) {
        // 3D回転を適用
        const rotated = this.applyRotation(x, y, z);
        
        // 透視投影
        const scale = this.perspective / (this.perspective + rotated.z + this.cameraDistance);
        return {
            x: this.width / 2 + rotated.x * scale,
            y: this.height / 2 + rotated.y * scale,
            scale: scale
        };
    }
    
    renderText(text, options = {}) {
        this.characters = text.split('').map((char, index) => ({
            char,
            index,
            baseX: 0,
            baseY: 0,
            x: 0,
            y: 0,
            z: 0,
            vx: 0,
            vy: 0,
            vz: 0,
            rotation: 0,
            targetRotation: 0,
            opacity: 1,
            scale: 1,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: Math.random() * 0.03 + 0.01,
            distortion: 0,
            glitch: 0
        }));
        
        this.layoutCharacters();
    }
    
    layoutCharacters() {
        const padding = 60;
        const maxWidth = this.width - padding * 2;
        const maxHeight = this.height - padding * 2;
        
        let x = padding;
        let y = padding;
        
        for (let char of this.characters) {
            if (char.char === '\n') {
                x += this.fontSize * this.lineHeight;
                y = padding;
                continue;
            }
            
            if (this.verticalMode) {
                char.baseX = x;
                char.baseY = y;
                char.x = x;
                char.y = y;
                y += this.fontSize * (1 + this.letterSpacing);
                
                if (y > maxHeight) {
                    x += this.fontSize * this.lineHeight;
                    y = padding;
                }
            } else {
                char.baseX = x;
                char.baseY = y;
                char.x = x;
                char.y = y;
                x += this.fontSize * 0.6 * (1 + this.letterSpacing);
                
                if (x > maxWidth) {
                    y += this.fontSize * this.lineHeight;
                    x = padding;
                }
            }
        }
    }
    
    drawCharacters() {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // 文字を奥行き順にソート
        const sortedChars = [...this.characters].sort((a, b) => a.z - b.z);
        
        for (let char of sortedChars) {
            // 3D投影
            const screenPos = this.projectPoint(
                char.x - centerX,
                char.y - centerY,
                char.z
            );
            
            // グリッチエフェクト
            let displayX = screenPos.x;
            let displayY = screenPos.y;
            
            if (this.glitchEffect && Math.random() < this.glitchIntensity) {
                displayX += (Math.random() - 0.5) * 20;
                displayY += (Math.random() - 0.5) * 20;
            }
            
            // 文字描画
            this.ctx.save();
            this.ctx.translate(displayX, displayY);
            this.ctx.rotate(char.rotation);
            this.ctx.scale(screenPos.scale * char.scale, screenPos.scale * char.scale);
            
            // シャドウ効果
            this.ctx.fillStyle = this.hexToRgba(this.backgroundColor, 0.3);
            this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(char.char, 2, 2);
            
            // メイン文字
            this.ctx.fillStyle = this.hexToRgba(this.textColor, char.opacity);
            this.ctx.fillText(char.char, 0, 0);
            
            this.ctx.restore();
        }
    }
    
    applyRotation(x, y, z) {
        // X軸回転
        let y1 = y * Math.cos(this.rotationX) - z * Math.sin(this.rotationX);
        let z1 = y * Math.sin(this.rotationX) + z * Math.cos(this.rotationX);
        
        // Y軸回転
        let x2 = x * Math.cos(this.rotationY) + z1 * Math.sin(this.rotationY);
        let z2 = -x * Math.sin(this.rotationY) + z1 * Math.cos(this.rotationY);
        
        // Z軸回転
        let x3 = x2 * Math.cos(this.rotationZ) - y1 * Math.sin(this.rotationZ);
        let y3 = x2 * Math.sin(this.rotationZ) + y1 * Math.cos(this.rotationZ);
        
        return { x: x3, y: y3, z: z2 };
    }
    
    updateRotation() {
        this.rotationX += (this.targetRotationX - this.rotationX) * 0.08;
        this.rotationY += (this.targetRotationY - this.rotationY) * 0.08;
        this.rotationZ += (this.targetRotationZ - this.rotationZ) * 0.08;
    }
    
    setTargetRotation(x, y, z) {
        this.targetRotationX = x;
        this.targetRotationY = y;
        this.targetRotationZ = z;
    }
    
    updateCharacterAnimation() {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        for (let char of this.characters) {
            // ワイヤーフレーム効果
            char.wobble += char.wobbleSpeed;
            char.z = Math.sin(char.wobble) * 40 + Math.cos(char.wobble * 0.7) * 20;
            
            // マウスインタラクション
            const dx = this.mouseX - char.x;
            const dy = this.mouseY - char.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.interactionRadius) {
                const force = (1 - distance / this.interactionRadius) * this.interactionStrength;
                char.vx += (dx / distance) * force;
                char.vy += (dy / distance) * force;
                char.scale = 1 + (1 - distance / this.interactionRadius) * 0.3;
            } else {
                char.scale += (1 - char.scale) * 0.1;
            }
            
            // 速度減衰
            char.vx *= 0.92;
            char.vy *= 0.92;
            
            // 位置更新
            char.x += char.vx;
            char.y += char.vy;
            
            // ベース位置への復帰
            char.x += (char.baseX - char.x) * 0.02;
            char.y += (char.baseY - char.y) * 0.02;
            
            // 回転
            char.targetRotation = (char.vx * 0.1);
            char.rotation += (char.targetRotation - char.rotation) * 0.1;
        }
    }
    
    hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    animate = () => {
        // 背景クリア
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // アニメーション更新
        this.animationTime++;
        this.frameCount++;
        
        // FPS計算
        const now = Date.now();
        if (now - this.lastFrameTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = now;
        }
        
        this.updateRotation();
        this.updateParticles();
        this.updateCharacterAnimation();
        
        // 描画
        this.drawParticles();
        this.drawCharacters();
        
        if (this.isAnimating) {
            requestAnimationFrame(this.animate);
        }
    }
    
    startAnimation() {
        this.isAnimating = true;
        this.animate();
    }
    
    stopAnimation() {
        this.isAnimating = false;
    }
    
    setMousePosition(x, y) {
        this.mouseVX = x - this.mouseX;
        this.mouseVY = y - this.mouseY;
        this.mouseX = x;
        this.mouseY = y;
    }
    
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
        this.layoutCharacters();
    }
    
    setTextColor(color) {
        this.textColor = color;
    }
    
    setBackgroundColor(color) {
        this.backgroundColor = color;
    }
    
    setBloomEffect(enabled) {
        this.bloomEffect = enabled;
    }
    
    setMotionBlur(enabled) {
        this.motionBlur = enabled;
    }
    
    setGlitchEffect(enabled, intensity = 0.1) {
        this.glitchEffect = enabled;
        this.glitchIntensity = intensity;
    }
    
    triggerGlitch() {
        this.glitchEffect = true;
        this.glitchIntensity = 0.3;
        setTimeout(() => {
            this.glitchIntensity = 0;
            this.glitchEffect = false;
        }, 200);
    }
    
    emitParticles(x, y, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 2 + Math.random() * 2;
            const p = this.createParticle();
            p.x = x;
            p.y = y;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            this.particles.push(p);
        }
    }
}

window.Canvas3DTextRendererEnhanced = Canvas3DTextRendererEnhanced;
