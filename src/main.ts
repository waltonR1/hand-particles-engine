import "./style.css";
import { ThreeApp } from "./app/ThreeApp";
import { HandTracker } from "./engine/input/HandTracker";
import { GestureEngine } from "./engine/gesture/GestureEngine";
import { InteractionCore } from "./engine/interaction/InteractionCore";
import { UI } from "./ui/UI";

/**
 * ======================================================
 * main
 * ======================================================
 *
 * 应用入口函数
 *
 * 职责：
 * - 初始化所有系统模块
 * - 连接各层之间的“数据流”
 * - 启动主循环
 *
 * 注意：
 * - 这是唯一一个“知道所有模块存在”的地方
 * - 其它模块彼此之间保持解耦
 * ======================================================
 */
async function main() {

    /**
     * DOM 获取
     *
     * three：Three.js 渲染 canvas
     * cam  ：摄像头 video（供 HandTracker 使用）
     * hud  ：UI 挂载容器
     */
    const canvas = document.getElementById("three") as HTMLCanvasElement;
    const video = document.getElementById("cam") as HTMLVideoElement;
    const hud = document.getElementById("hud") as HTMLDivElement;

    // ==================================================
    // Three.js 应用（渲染壳）
    // ==================================================

    /**
     * ThreeApp：
     * - 管理 renderer / scene / camera
     * - 提供渲染循环
     * - 对外交付 ParticleSystem
     */
    const app = new ThreeApp(canvas);

    // ==================================================
    // 手部追踪（感知层）
    // ==================================================

    /**
     * HandTracker：
     * - 负责摄像头访问
     * - MediaPipe 推理
     * - 输出 HandFrame[]
     * - 提供调试预览 canvas
     */
    const tracker = new HandTracker(video);

    /**
     * 初始化是异步的：
     * - 申请摄像头权限
     * - 加载 wasm / 模型
     */
    await tracker.init();

    // ==================================================
    // 手势引擎（语义产生层）
    // ==================================================

    /**
     * GestureEngine：
     * - 自动加载所有 GesturePlugin
     * - 把 HandFrame[] → InteractionEvent[]
     */
    const gestureEngine = new GestureEngine();

    // ==================================================
    // 交互核心（状态归并层）
    // ==================================================

    /**
     * InteractionCore：
     * - 把离散 InteractionEvent[] 汇总
     * - 生成一份稳定、可消费的 InteractionState
     */
    const interactionCore = new InteractionCore();

    // ==================================================
    // UI（调试 / 控制 / 展示）
    // ==================================================

    const ui = new UI(hud);

    /**
     * 插件控制面板
     *
     * - 从 GestureEngine 读取插件列表
     * - UI 只知道“名字”，不直接操作插件实例
     */
    ui.bindPlugins(
        gestureEngine.getPlugins().map(p => p.name)
    );

    /**
     * 插件启停回调
     *
     * UI → GestureEngine
     */
    ui.onPluginSwitch((name, enabled) => {
        gestureEngine.setPluginEnabled(name, enabled);
    });

    /**
     * 绑定摄像头调试预览
     *
     * UI 内部会：
     * - 从 HandTracker 取 canvas
     * - 复制绘制到 UI 面板
     */
    ui.bindPreviewSource(() => tracker.getPreviewCanvas());

    /**
     * 粒子颜色控制
     */
    ui.onColor((hex) => app.particles.setColor(hex));

    /**
     * 调试开关
     *
     * UI → HandTracker
     */
    ui.onToggleLandmarks((v) => tracker.setDrawDebug(v));
    ui.onTogglePreview((v) => tracker.setShowPreview(v));

    /**
     * 全屏切换
     */
    ui.onFullscreen(() => app.toggleFullscreen());

    // ==================================================
    // 主循环（数据流的“高速公路”）
    // ==================================================

    /**
     * app.start：
     * - 提供 dt / t
     * - 驱动整个系统逐帧运行
     */
    app.start((dt, t) => {

        /**
         * 1️⃣ 手部追踪
         *
         * 输出：
         * - 0 / 1 / 2 个 HandFrame
         */
        const frames = tracker.update();

        /**
         * 2️⃣ 手势插件处理
         *
         * HandFrame[] → InteractionEvent[]
         */
        const events = gestureEngine.process(frames, dt);

        /**
         * 3️⃣ 事件归并为统一状态
         *
         * InteractionEvent[] → InteractionState
         */
        interactionCore.update(events);

        // ==================================================
        // UI 状态显示（只读）
        // ==================================================

        /**
         * UI 使用的是“状态快照”
         * - 不直接引用 InteractionState
         * - 便于裁剪 / 重组 / 展示
         */
        ui.setStatus({
            handCount: frames.length,
            mode: interactionCore.state.mode,
            gesture: interactionCore.state.gestureLabel,
            spread: interactionCore.state.spread,
            zoom: interactionCore.state.zoom,
            rotation: interactionCore.state.rotation,
            panX: interactionCore.state.panX,
            panY: interactionCore.state.panY,
            shakeEnergy: interactionCore.state.shakeEnergy,
            scatter: interactionCore.state.scatter,
            converge: interactionCore.state.converge,
            shape: interactionCore.state.shape,
        });

        // ==================================================
        // 4️⃣ 粒子系统响应交互状态
        // ==================================================

        /**
         * InteractionState + 时间
         * → 连续的视觉变化
         */
        app.particles.applyInteraction(
            interactionCore.state,
            dt,
            t
        );

        /**
         * 5️⃣ 渲染
         */
        app.render();
    });
}

/**
 * 启动应用
 *
 * 错误处理：
 * - 常见失败原因：
 *   - 未授权摄像头
 *   - 非 HTTPS / localhost
 */
main().catch((e) => {
    console.error(e);
    alert(
        "启动失败：请允许摄像头权限，并在 HTTPS 或 localhost 下运行。"
    );
});
