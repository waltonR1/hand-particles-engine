import "./style.css";
import { ThreeApp } from "./app/ThreeApp";
import { HandTracker } from "./engine/input/HandTracker";
import { GestureEngine } from "./engine/gesture/GestureEngine";
import { InteractionCore } from "./engine/interaction/InteractionCore";
import { UI } from "./ui/UI";

async function main() {
    const canvas = document.getElementById("three") as HTMLCanvasElement;
    const video = document.getElementById("cam") as HTMLVideoElement;
    const hud = document.getElementById("hud") as HTMLDivElement;

    // Three.js 应用
    const app = new ThreeApp(canvas);

    // 手部追踪（支持双手 + 预览/骨架调试）
    const tracker = new HandTracker(video);
    await tracker.init();

    // 手势引擎：只负责把“HandFrame -> 交互事件”
    const gestureEngine = new GestureEngine();

    // 交互核心：把“事件 -> 可消费的统一状态”
    const interactionCore = new InteractionCore();

    // UI
    const ui = new UI(hud);
    ui.bindPlugins(gestureEngine.getPlugins().map(p => p.name));
    ui.onPluginSwitch((name, enabled) => {
        gestureEngine.setPluginEnabled(name, enabled);
    });
    ui.bindPreviewSource(() => tracker.getPreviewCanvas());
    ui.onColor((hex) => app.particles.setColor(hex));
    ui.onToggleLandmarks((v) => tracker.setDrawDebug(v));
    ui.onTogglePreview((v) => tracker.setShowPreview(v));
    ui.onFullscreen(() => app.toggleFullscreen());

    // 主循环
    app.start((dt, t) => {
        const frames = tracker.update();                 // 0/1/2 只手
        const events = gestureEngine.process(frames, dt); // 转交互事件
        interactionCore.update(events);                  // 变为统一状态

        // UI 状态显示
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

        // 驱动粒子系统
        app.particles.applyInteraction(interactionCore.state, dt, t);

        app.render();
    });
}

main().catch((e) => {
    console.error(e);
    alert("启动失败：请允许摄像头权限，并在 HTTPS 或 localhost 下运行。");
});
