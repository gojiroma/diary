/**
 * WebGL Cinematic Typography Engine
 * 巨大で圧倒的なタイポグラフィと、背景に溶け込むUIを実現
 */

class CinematicTypographyEngine {
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
            alpha: false,
            powerPreference: 'high-performance'
        });
        
        // レンダラー設定
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x0a0a0a, 1);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        
        // カメラ設定
        this.camera.position.z = 50;
        
        // ライト設定
        this.setupLights();
        
        // テキスト設定
        this.textColor = options.textColor || 0x8fbcf2;
        this.backgroundColor = options.backgroundColor || 0x0a0a0a;
        this.accentColor = options.accentColor || 0xff6b9d;
        
        // オブジェクト管理
        this.textMeshes = [];
        this.backgroundText = null;
        this.glyphCache = new Map();
        
        // インタラクション
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        this.currentRotationX = 0;
        this.currentRotationY = 0;
        
        // スクロール状態
        this.scrollProgress = 0;
        this.targetScrollProgress = 0;
        
        // アニメーション
        this.animationTime = 0;
        this.isAnimating = false;
        
        // イベントリスナー
        this.setupEventListeners();
        
        // アニメーション開始
        this.startAnimation();
        
        // ウィンドウリサイズ対応
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    setupLights() {
        // 環境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        
        // フロントライト
        const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
        frontLight.position.set(0, 0, 100);
        frontLight.castShadow = true;
        this.scene.add(frontLight);
        
        // バックライト（グロー効果用）
        const backLight = new THREE.PointLight(0x8fbcf2, 0.3);
        backLight.position.set(0, 0, -50);
        this.scene.add(backLight);
    }
    
    createGlyphTexture(char, fontSize = 256) {
        const key = `${char}-${fontSize}`;
        if (this.glyphCache.has(key)) {
            return this.glyphCache.get(key);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = fontSize;
        canvas.height = fontSize;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${fontSize * 0.8}px 'gojiromanus', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 文字を複数回描画してアンチエイリアスを強化
        ctx.fillText(char, fontSize / 2, fontSize / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        
        this.glyphCache.set(key, texture);
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
        
        // 背景透かしテキストをクリア
        if (this.backgroundText) {
            this.scene.remove(this.backgroundText);
            if (this.backgroundText.geometry) this.backgroundText.geometry.dispose();
            if (this.backgroundText.material) this.backgroundText.material.dispose();
        }
        
        // テキストをレイアウト
        const characters = this.layoutText(text);
        
        // 背景透かしテキストを作成
        this.createBackgroundText(text);
        
        // 各文字をメッシュとして作成
        for (let char of characters) {
            const mesh = this.createCharacterMesh(char);
            this.scene.add(mesh);
            this.textMeshes.push(mesh);
        }
    }
    
    layoutText(text) {
        const characters = [];
        const isMobile = window.innerWidth < 768;
        
        // 画面いっぱいに表示するための計算
        const maxWidth = isMobile ? 30 : 60;
        const maxHeight = isMobile ? 100 : 80;
        
        let x = maxWidth / 2;  // 右から開始
        let y = maxHeight / 2;
        let lineIndex = 0;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if (char === '\n') {
                x -= 4;  // 次の行へ（右から左）
                y = maxHeight / 2;
                lineIndex++;
                continue;
            }
            
            if (char.trim() === '') continue;
            
            // 縦書き: 右から左へ、上から下へ
            characters.push({
                char,
                x: x,
                y: y,
                z: 0,
                index: i,
                lineIndex: lineIndex
            });
            
            y -= 3;  // 次の文字へ（下へ）
            
            // 行の終端に達したら次の行へ
            if (y < -maxHeight / 2) {
                x -= 4;  // 右から左へ
                y = maxHeight / 2;
                lineIndex++;
            }
        }
        
        return characters;
    }
    
    createBackgroundText(text) {
        // 背景に大きな透かし文字を配置
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 2048;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(143, 188, 242, 0.08)';
        ctx.font = 'bold 300px "gojiromanus", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // テキストの最初の数文字を大きく表示
        const displayText = text.substring(0, 3).replace(/\n/g, '');
        ctx.fillText(displayText, 1024, 1024);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false
        });
        
        const geometry = new THREE.PlaneGeometry(200, 200);
        this.backgroundText = new THREE.Mesh(geometry, material);
        this.backgroundText.position.z = -10;
        this.scene.add(this.backgroundText);
    }
    
    createCharacterMesh(charData) {
        const isMobile = window.innerWidth < 768;
        const fontSize = isMobile ? 180 : 256;
        const texture = this.createGlyphTexture(charData.char, fontSize);
        
        // カスタムシェーダーマテリアル
        const material = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: texture },
                color: { value: new THREE.Color(this.textColor) },
                glowIntensity: { value: 0.5 },
                time: { value: 0 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D map;
                uniform vec3 color;
                uniform float glowIntensity;
                uniform float time;
                
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    vec4 texColor = texture2D(map, vUv);
                    
                    // グロー効果
                    float glow = glowIntensity * sin(time * 0.01) * 0.3 + 0.7;
                    
                    vec3 finalColor = color * glow;
                    gl_FragColor = vec4(finalColor, texColor.a);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const scale = isMobile ? 1.2 : 1.0;
        const geometry = new THREE.PlaneGeometry(
            8 * scale,
            8 * scale
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
            wobblePhase: Math.random() * Math.PI * 2,
            wobbleSpeed: Math.random() * 0.02 + 0.005
        };
        
        return mesh;
    }
    
    updateCharacterAnimation() {
        for (let mesh of this.textMeshes) {
            const data = mesh.userData;
            
            // ワイヤーフレーム効果
            data.wobblePhase += data.wobbleSpeed;
            data.basePosition.z = Math.sin(data.wobblePhase) * 3;
            
            // マウスインタラクション
            const dx = this.mouseX - data.basePosition.x;
            const dy = this.mouseY - data.basePosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 20) {
                const force = (1 - distance / 20) * 0.02;
                data.velocity.x -= (dx / distance) * force;
                data.velocity.y -= (dy / distance) * force;
            }
            
            // 速度減衰
            data.velocity.multiplyScalar(0.92);
            
            // 位置更新
            mesh.position.x += data.velocity.x;
            mesh.position.y += data.velocity.y;
            mesh.position.z += data.velocity.z;
            
            // ベース位置への復帰
            mesh.position.x += (data.basePosition.x - mesh.position.x) * 0.08;
            mesh.position.y += (data.basePosition.y - mesh.position.y) * 0.08;
            mesh.position.z += (data.basePosition.z - mesh.position.z) * 0.08;
            
            // シェーダーのtime uniformを更新
            if (mesh.material.uniforms && mesh.material.uniforms.time) {
                mesh.material.uniforms.time.value = this.animationTime;
            }
        }
    }
    
    updateRotation() {
        this.currentRotationX += (this.targetRotationX - this.currentRotationX) * 0.06;
        this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.06;
    }
    
    animate = () => {
        requestAnimationFrame(this.animate);
        
        this.animationTime++;
        
        // アニメーション更新
        this.updateRotation();
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
        const isMobile = window.innerWidth < 768;
        const scale = isMobile ? 1.5 : 1.0;
        this.mouseX = (x / window.innerWidth - 0.5) * 100 * scale;
        this.mouseY = -(y / window.innerHeight - 0.5) * 100 * scale;
    }
    
    setTargetRotation(x, y) {
        this.targetRotationX = x;
        this.targetRotationY = y;
    }
    
    setTextColor(colorHex) {
        const color = new THREE.Color(colorHex);
        
        // 既存のメッシュの色を更新
        for (let mesh of this.textMeshes) {
            if (mesh.material && mesh.material.uniforms) {
                mesh.material.uniforms.color.value.copy(color);
            }
        }
    }
    
    setBackgroundColor(colorHex) {
        const color = new THREE.Color(colorHex);
        this.renderer.setClearColor(color, 1);
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
        
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                this.setMousePosition(e.touches[0].clientX, e.touches[0].clientY);
            }
        });
    }
    
    triggerGlitch() {
        this.targetRotationX = (Math.random() - 0.5) * 0.15;
        this.targetRotationY = (Math.random() - 0.5) * 0.15;
        
        setTimeout(() => {
            this.targetRotationX = 0;
            this.targetRotationY = 0;
        }, 150);
    }
    
    dispose() {
        this.renderer.dispose();
        this.glyphCache.forEach(texture => texture.dispose());
    }
}

window.CinematicTypographyEngine = CinematicTypographyEngine;
