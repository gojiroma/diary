/**
 * WebGL Single-Line Scroll Typography Engine
 * 巨大な1行の縦書きテキストを、右から左へスムーズにスクロール
 */

class ScrollTypographyEngine {
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
        
        // オブジェクト管理
        this.textMeshes = [];
        this.glyphCache = new Map();
        
        // スクロール制御
        this.scrollPosition = 0;
        this.targetScrollPosition = 0;
        this.scrollVelocity = 0;
        this.maxScroll = 0;
        
        // インタラクション
        this.mouseX = 0;
        this.mouseY = 0;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartScroll = 0;
        
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        // フロントライト
        const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
        frontLight.position.set(0, 0, 100);
        this.scene.add(frontLight);
        
        // バックライト
        const backLight = new THREE.PointLight(0x8fbcf2, 0.2);
        backLight.position.set(0, 0, -50);
        this.scene.add(backLight);
    }
    
    createGlyphTexture(char, fontSize = 512) {
        const key = `${char}-${fontSize}`;
        if (this.glyphCache.has(key)) {
            return this.glyphCache.get(key);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = fontSize;
        canvas.height = fontSize;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${fontSize * 0.85}px 'gojiromanus', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
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
        
        // 改行を削除してテキストを1行に
        const singleLineText = text.replace(/\n/g, '');
        
        // 各文字をメッシュとして作成（1行、縦書き）
        let yOffset = 0;
        for (let i = 0; i < singleLineText.length; i++) {
            const char = singleLineText[i];
            if (char.trim() === '') continue;
            
            const mesh = this.createCharacterMesh(char, yOffset);
            this.scene.add(mesh);
            this.textMeshes.push(mesh);
            
            // 次の文字の位置（下へ）
            yOffset -= 18;  // 文字間隔
        }
        
        // スクロール範囲を設定
        this.maxScroll = Math.abs(yOffset) + 50;
        this.scrollPosition = 0;
        this.targetScrollPosition = 0;
    }
    
    createCharacterMesh(char, yOffset) {
        const fontSize = 512;
        const texture = this.createGlyphTexture(char, fontSize);
        
        // カスタムシェーダーマテリアル
        const material = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: texture },
                color: { value: new THREE.Color(this.textColor) },
                time: { value: 0 },
                glowIntensity: { value: 0.6 }
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
                uniform float time;
                uniform float glowIntensity;
                
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    vec4 texColor = texture2D(map, vUv);
                    
                    // グロー効果
                    float glow = glowIntensity * (0.7 + 0.3 * sin(time * 0.005));
                    
                    vec3 finalColor = color * glow;
                    gl_FragColor = vec4(finalColor, texColor.a);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const isMobile = window.innerWidth < 768;
        const scale = isMobile ? 0.8 : 1.0;
        const geometry = new THREE.PlaneGeometry(16 * scale, 16 * scale);
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, yOffset, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // キャラクター情報を保存
        mesh.userData = {
            char,
            baseY: yOffset,
            wobblePhase: Math.random() * Math.PI * 2,
            wobbleSpeed: Math.random() * 0.01 + 0.003
        };
        
        return mesh;
    }
    
    updateCharacterAnimation() {
        for (let mesh of this.textMeshes) {
            const data = mesh.userData;
            
            // ワイヤーフレーム効果
            data.wobblePhase += data.wobbleSpeed;
            const wobbleZ = Math.sin(data.wobblePhase) * 2;
            
            // スクロール位置に基づいて文字を配置
            mesh.position.y = data.baseY + this.scrollPosition;
            mesh.position.z = wobbleZ;
            
            // シェーダーのtime uniformを更新
            if (mesh.material.uniforms && mesh.material.uniforms.time) {
                mesh.material.uniforms.time.value = this.animationTime;
            }
            
            // 画面外の文字は非表示にしてパフォーマンス向上
            const isVisible = mesh.position.y > -60 && mesh.position.y < 60;
            mesh.visible = isVisible;
        }
    }
    
    updateScroll() {
        // スクロール位置をスムーズに更新
        this.scrollVelocity += (this.targetScrollPosition - this.scrollPosition) * 0.08;
        this.scrollVelocity *= 0.92;  // 減衰
        this.scrollPosition += this.scrollVelocity;
        
        // スクロール範囲を制限
        this.scrollPosition = Math.max(-this.maxScroll, Math.min(0, this.scrollPosition));
    }
    
    animate = () => {
        requestAnimationFrame(this.animate);
        
        this.animationTime++;
        
        // アニメーション更新
        this.updateScroll();
        this.updateCharacterAnimation();
        
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
    
    scroll(delta) {
        // マウスホイールやタッチでのスクロール
        this.targetScrollPosition += delta * 2;
        this.targetScrollPosition = Math.max(-this.maxScroll, Math.min(0, this.targetScrollPosition));
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
        // マウスホイール
        document.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.scroll(e.deltaY > 0 ? 5 : -5);
        }, { passive: false });
        
        // タッチスクロール
        let touchStartY = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        });
        
        document.addEventListener('touchmove', (e) => {
            const touchCurrentY = e.touches[0].clientY;
            const delta = touchCurrentY - touchStartY;
            this.scroll(-delta * 0.1);
            touchStartY = touchCurrentY;
        }, { passive: true });
        
        // キーボード
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                this.scroll(-10);
            } else if (e.key === 'ArrowDown') {
                this.scroll(10);
            }
        });
    }
    
    dispose() {
        this.renderer.dispose();
        this.glyphCache.forEach(texture => texture.dispose());
    }
}

window.ScrollTypographyEngine = ScrollTypographyEngine;
