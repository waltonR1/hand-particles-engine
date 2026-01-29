import * as THREE from "three";
import { ParticleSystem } from "../engine/particles/ParticleSystem";

// Three.js 基础应用：场景/相机/渲染/循环
export class ThreeApp {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private clock = new THREE.Clock();

    public particles: ParticleSystem;

    constructor(private canvas: HTMLCanvasElement) {
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(
            55,
            window.innerWidth / window.innerHeight,
            0.01,
            200
        );
        this.camera.position.set(0, 0, 4);

        // 环境光即可（粒子材质 Additive）
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.0));

        // 粒子系统
        this.particles = new ParticleSystem(18000);
        this.scene.add(this.particles.object3d);

        window.addEventListener("resize", () => this.onResize());
    }

    private onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
    }

    // 启动主循环
    public start(loop: (dt: number, t: number) => void) {
        const tick = () => {
            const dt = this.clock.getDelta();
            const t = this.clock.elapsedTime;
            loop(dt, t);
            requestAnimationFrame(tick);
        };
        tick();
    }

    public render() {
        this.renderer.render(this.scene, this.camera);
    }

    // 全屏（简洁按钮）
    public toggleFullscreen() {
        const el = this.canvas;
        if (!document.fullscreenElement) {
            el.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }
}
