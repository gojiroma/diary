/**
 * WebGL 3D Text Rendering Engine using Three.js
 * 高品位な3D表現と正確な縦書きレイアウトを実現
 */

class WebGL3DTextRenderer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        
        // Three.js基本設定
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            10000
        );
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            powerPreference: 'high-performance'
        });
        
        // レンダラー設定
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x271f2c, 1);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        // カメラ設定
        this.camera.position.z = 100;
        
        // ライト設定
        this.setupLights();
        
        // テキスト設定
        this.textColor = options.textColor || 0x8fbcf2;
        this.backgroundColor = options.backgroundColor || 0x271f2c;
        this.fontSize = options.fontSize || 48;
        this.fontFamily = options.fontFamily || 'gojiromanus, serif';
        
        // レイアウト設定
        this.verticalMode = options.verticalMode !== false;
        this.lineHeight = options.lineHeight || 1.8;
        this.letterSpacing = options.letterSpacing || 0.1;
        
        // オブジェクト管理
        this.textMeshes = [];
        this.particles = [];
        this.particleCount = options.particleCount || 40;
        
        // インタラクション
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        this.currentRotationX = 0;
        this.currentRotationY = 0;
        
        // アニメーション
        this.animationTime = 0;
        this.isAnimating = false;
        
        // Canvas テキスチャ生成用
        this.canvasTextures = new Map();
        
        // イベントリスナー
        this.setupEventListeners();
        
        // パーティクル初期化
        this.initParticles();
        
        // アニメーション開始
        this.startAnimation();
        
        // ウィンドウリサイズ対応
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupLights() {
        // 環境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // ポイントライト
        const pointLight = new THREE.PointLight(0xffffff, 0.8);
        pointLight.position.set(100, 100, 100);
        pointLight.castShadow = true;
        this.scene.add(pointLight);
        
        // 背景ライト
        const backLight = new THREE.PointLight(0x8fbcf2, 0.4);
        backLight.position.set(-100, -100, -100);
        this.scene.add(backLight);
    }
    
    createTextTexture(char) {
        const key = `${char}-${this.fontSize}`;
        if (this.canvasTextures.has(key)) {
            return this.canvasTextures.get(key);
        }
        
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${this.fontSize}px ${this.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char, size / 2, size / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        
        this.canvasTextures.set(key, texture);
        return texture;
    }
    
    renderText(text) {
        // 既存のメッシュをクリア
        this.textMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.textMeshes = [];
        
        // テキストをレイアウト
        const characters = this.layoutText(text);
        
        // 各文字をメッシュとして作成
        for (let char of characters) {
            const mesh = this.createCharacterMesh(char);
            this.scene.add(mesh);
            this.textMeshes.push(mesh);
        }
    }
    
    layoutText(text) {
        const characters = [];
        const maxWidth = 150;
        const maxHeight = 150;
        
        let x = -maxWidth / 2;
        let y = maxHeight / 2;
        let lineIndex = 0;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if (char === '\n') {
                if (this.verticalMode) {
                    x += this.fontSize * this.lineHeight * 0.1;
                    y = maxHeight / 2;
                } else {
                    y -= this.fontSize * this.lineHeight * 0.1;
                    x = -maxWidth / 2;
                }
                lineIndex++;
                continue;
            }
            
            if (this.verticalMode) {
                // 縦書き: 右から左へ、上から下へ
                characters.push({
                    char,
                    x: x,
                    y: y,
                    z: 0,
                    index: i,
                    lineIndex: lineIndex
                });
                
                y -= this.fontSize * (1 + this.letterSpacing) * 0.1;
                
                // 行の終端に達したら次の行へ
                if (y < -maxHeight / 2) {
                    x += this.fontSize * this.lineHeight * 0.1;
                    y = maxHeight / 2;
                    lineIndex++;
                }
            } else {
                // 横書き
                characters.push({
                    char,
                    x: x,
                    y: y,
                    z: 0,
                    index: i,
                    lineIndex: lineIndex
                });
                
                x += this.fontSize * 0.6 * (1 + this.letterSpacing) * 0.1;
                
                if (x > maxWidth / 2) {
                    y -= this.fontSize * this.lineHeight * 0.1;
                    x = -maxWidth / 2;
                    lineIndex++;
                }
            }
        }
        
        return characters;
    }
    
    createCharacterMesh(charData) {
        const texture = this.createTextTexture(charData.char);
        
        const material = new THREE.MeshPhongMaterial({
            map: texture,
            emissive: this.textColor,
            emissiveIntensity: 0.3,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.5
        });
        
        const geometry = new THREE.PlaneGeometry(
            this.fontSize * 0.08,
            this.fontSize * 0.08
        );
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(charData.x, charData.y, charData.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // キャラクター情報を保存
        mesh.userData = {
            ...charData,
            basePosition: new THREE.Vector3(charData.x, charData.y, charData.z),
            velocity: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Euler(0, 0, 0),
            wobblePhase: Math.random() * Math.PI * 2,
            wobbleSpeed: Math.random() * 0.03 + 0.01
        };
        
        return mesh;
    }
    
    initParticles() {
        // パーティクルジオメトリ
        const particleGeometry = new THREE.BufferGeometry();
        const particleCount = this.particleCount;
        
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 300;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 300;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 300;
            
            velocities[i * 3] = (Math.random() - 0.5) * 0.5;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: this.textColor,
            size: 0.5,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.6
        });
        
        this.particleSystem = new THREE.Points(particleGeometry, particleMaterial);
        this.particleVelocities = velocities;
        this.scene.add(this.particleSystem);
    }
    
    updateParticles() {
        const positions = this.particleSystem.geometry.attributes.position.array;
        const count = positions.length / 3;
        
        for (let i = 0; i < count; i++) {
            positions[i * 3] += this.particleVelocities[i * 3];
            positions[i * 3 + 1] += this.particleVelocities[i * 3 + 1];
            positions[i * 3 + 2] += this.particleVelocities[i * 3 + 2];
            
            // 画面外判定とリセット
            if (Math.abs(positions[i * 3]) > 200) {
                positions[i * 3] = (Math.random() - 0.5) * 300;
                this.particleVelocities[i * 3] = (Math.random() - 0.5) * 0.5;
            }
            if (Math.abs(positions[i * 3 + 1]) > 200) {
                positions[i * 3 + 1] = (Math.random() - 0.5) * 300;
                this.particleVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
            }
            if (Math.abs(positions[i * 3 + 2]) > 200) {
                positions[i * 3 + 2] = (Math.random() - 0.5) * 300;
                this.particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
            }
        }
        
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }
    
    updateCharacterAnimation() {
        for (let mesh of this.textMeshes) {
            const data = mesh.userData;
            
            // ワイヤーフレーム効果
            data.wobblePhase += data.wobbleSpeed;
            data.basePosition.z = Math.sin(data.wobblePhase) * 5;
            
            // マウスインタラクション
            const dx = this.mouseX - data.basePosition.x;
            const dy = this.mouseY - data.basePosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 50) {
                const force = (1 - distance / 50) * 0.01;
                data.velocity.x += (dx / distance) * force;
                data.velocity.y += (dy / distance) * force;
            }
            
            // 速度減衰
            data.velocity.multiplyScalar(0.95);
            
            // 位置更新
            mesh.position.x += data.velocity.x;
            mesh.position.y += data.velocity.y;
            mesh.position.z += data.velocity.z;
            
            // ベース位置への復帰
            mesh.position.x += (data.basePosition.x - mesh.position.x) * 0.05;
            mesh.position.y += (data.basePosition.y - mesh.position.y) * 0.05;
            mesh.position.z += (data.basePosition.z - mesh.position.z) * 0.05;
            
            // 回転
            mesh.rotation.x += (this.currentRotationX - mesh.rotation.x) * 0.05;
            mesh.rotation.y += (this.currentRotationY - mesh.rotation.y) * 0.05;
        }
    }
    
    updateRotation() {
        this.currentRotationX += (this.targetRotationX - this.currentRotationX) * 0.08;
        this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.08;
    }
    
    animate = () => {
        requestAnimationFrame(this.animate);
        
        this.animationTime++;
        
        // アニメーション更新
        this.updateRotation();
        this.updateParticles();
        this.updateCharacterAnimation();
        
        // シーン全体の回転
        this.scene.rotation.x = this.currentRotationX;
        this.scene.rotation.y = this.currentRotationY;
        
        // レンダリング
        this.renderer.render(this.scene, this.camera);
    }
    
    startAnimation() {
        this.isAnimating = true;
        this.animate();
    }
    
    stopAnimation() {
        this.isAnimating = false;
    }
    
    setMousePosition(x, y) {
        // スクリーン座標をワールド座標に変換
        this.mouseX = (x / window.innerWidth - 0.5) * 200;
        this.mouseY = -(y / window.innerHeight - 0.5) * 200;
    }
    
    setTargetRotation(x, y) {
        this.targetRotationX = x;
        this.targetRotationY = y;
    }
    
    setTextColor(colorHex) {
        const color = new THREE.Color(colorHex);
        this.textColor = color.getHex();
        
        // 既存のメッシュの色を更新
        for (let mesh of this.textMeshes) {
            if (mesh.material) {
                mesh.material.emissive.copy(color);
            }
        }
        
        // パーティクルの色を更新
        if (this.particleSystem && this.particleSystem.material) {
            this.particleSystem.material.color.copy(color);
        }
    }
    
    setBackgroundColor(colorHex) {
        const color = new THREE.Color(colorHex);
        this.backgroundColor = color.getHex();
        this.renderer.setClearColor(this.backgroundColor, 1);
    }
    
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    setupEventListeners() {
        document.addEventListener('mousemove', (e) => {
            this.setMousePosition(e.clientX, e.clientY);
        });
        
        // タッチイベント対応
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                this.setMousePosition(e.touches[0].clientX, e.touches[0].clientY);
            }
        });
    }
    
    triggerGlitch() {
        // グリッチ効果: 一時的に回転を加える
        this.targetRotationX = (Math.random() - 0.5) * 0.2;
        this.targetRotationY = (Math.random() - 0.5) * 0.2;
        
        setTimeout(() => {
            this.targetRotationX = 0;
            this.targetRotationY = 0;
        }, 200);
    }
    
    dispose() {
        this.renderer.dispose();
        this.canvasTextures.forEach(texture => texture.dispose());
    }
}

window.WebGL3DTextRenderer = WebGL3DTextRenderer;
