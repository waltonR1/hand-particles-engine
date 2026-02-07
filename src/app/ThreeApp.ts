import * as THREE from "three";
import { ParticleSystem } from "../engine/particles/ParticleSystem";

/**
 * ======================================================
 * ThreeApp
 * ======================================================
 *
 * Three.js 应用封装类
 *
 * 职责定位（IMPORTANT）：
 * - Three.js 的“壳层 / 应用层”
 * - 只负责：
 *   - Renderer / Scene / Camera 的创建
 *   - 渲染循环
 *   - 窗口尺寸变化
 *   - 全屏控制
 *
 * 明确不负责：
 * - ❌ 手势识别
 * - ❌ 交互语义
 * - ❌ 粒子逻辑
 *
 * 设计原则：
 * - 尽量薄
 * - 不掺杂业务逻辑
 * - Three.js 相关代码集中在这一层
 * ======================================================
 */
export class ThreeApp {

    /**
     * WebGL 渲染器
     */
    private renderer: THREE.WebGLRenderer;

    /**
     * Three.js 场景
     */
    private scene: THREE.Scene;

    /**
     * 主相机（透视相机）
     */
    private camera: THREE.PerspectiveCamera;

    /**
     * Three.js Clock
     *
     * 用途：
     * - 统一计算 dt（帧间隔）
     * - 提供 elapsedTime（全局时间）
     */
    private clock = new THREE.Clock();

    /**
     * 粒子系统（核心视觉对象）
     *
     * 对外暴露：
     * - 方便上层（控制器 / 主循环）调用
     */
    public particles: ParticleSystem;

    /**
     * 构造函数
     *
     * @param canvas 用于渲染的 HTMLCanvasElement
     */
    constructor(private canvas: HTMLCanvasElement) {

        // ==========================
        // Renderer 初始化
        // ==========================
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true, // 抗锯齿
            alpha: true,     // 透明背景（方便叠加 UI）
        });

        /**
         * 像素比设置
         *
         * 说明：
         * - 使用 devicePixelRatio 可以提升清晰度
         * - 但在高分屏上成本很高
         * - 因此限制最大为 2（经验折中）
         */
        this.renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, 2)
        );

        // 初始尺寸
        this.renderer.setSize(
            window.innerWidth,
            window.innerHeight,
            false
        );

        // ==========================
        // Scene 初始化
        // ==========================
        this.scene = new THREE.Scene();

        // ==========================
        // Camera 初始化
        // ==========================
        this.camera = new THREE.PerspectiveCamera(
            55,                                   // FOV（视角）
            window.innerWidth / window.innerHeight,
            0.01,                                 // 近裁剪面
            200                                   // 远裁剪面
        );

        /**
         * 相机位置
         *
         * 设计说明：
         * - z = 4 是为粒子系统调好的默认距离
         * - 不参与交互（不会跟手势移动）
         */
        this.camera.position.set(0, 0, 4);

        // ==========================
        // 灯光
        // ==========================
        /**
         * 环境光即可
         *
         * 原因：
         * - 粒子材质使用 AdditiveBlending
         * - 不依赖复杂光照模型
         */
        this.scene.add(
            new THREE.AmbientLight(0xffffff, 1.0)
        );

        // ==========================
        // 粒子系统
        // ==========================
        this.particles = new ParticleSystem(18000);
        this.scene.add(this.particles.object3d);

        // ==========================
        // 窗口尺寸变化监听
        // ==========================
        window.addEventListener(
            "resize",
            () => this.onResize()
        );
    }

    /**
     * onResize：窗口尺寸变化处理
     *
     * 行为：
     * - 更新相机宽高比
     * - 更新投影矩阵
     * - 更新 renderer 尺寸
     */
    private onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(w, h, false);
    }

    /**
     * ======================================================
     * start
     * ======================================================
     *
     * 启动主循环（但不直接 render）
     *
     * 设计说明（IMPORTANT）：
     * - ThreeApp 不直接决定“每帧做什么”
     * - 而是把 dt / t 交给外部 loop
     *
     * 好处：
     * - ThreeApp 是“基础设施”
     * - 主逻辑（交互 / 状态更新）由外部控制
     *
     * @param loop 外部传入的帧更新函数
     */
    public start(loop: (dt: number, t: number) => void) {

        const tick = () => {
            const dt = this.clock.getDelta();
            const t = this.clock.elapsedTime;

            // 执行外部逻辑
            loop(dt, t);

            requestAnimationFrame(tick);
        };

        tick();
    }

    /**
     * render：执行一次渲染
     *
     * 说明：
     * - 通常在 loop 内被调用
     * - 渲染逻辑与更新逻辑分离
     */
    public render() {
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * toggleFullscreen：全屏切换
     *
     * 设计说明：
     * - 使用 Canvas 作为全屏元素
     * - 简洁、跨浏览器
     *
     * 注意：
     * - 某些浏览器要求必须由用户交互触发
     */
    public toggleFullscreen() {
        const el = this.canvas;

        if (!document.fullscreenElement) {
            el.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }
}
