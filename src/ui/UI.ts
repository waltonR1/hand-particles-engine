/**
 * Status
 *
 * UI 层使用的“状态快照结构”
 *
 * 设计原则：
 * - 只用于展示（只读）
 * - 与内部状态（InteractionState）解耦
 * - 可以自由裁剪 / 重组 / 重命名
 *
 * 通常由上层控制器从 InteractionState + 运行时信息拼装
 */
type Status = {
    handCount: number;   // 当前检测到的手数量
    mode: string;        // 交互模式（NONE / SINGLE / DUAL）
    gesture: string;     // 当前识别到的离散手势标签
    shape: string;       // 当前目标形状名称

    panX: number;        // 世界平移 X
    panY: number;        // 世界平移 Y
    zoom: number;        // 缩放
    rotation: number;   // Z 轴旋转
    spread: number;     // 聚散程度

    shakeEnergy: number;// 抖动能量（调试用）
    scatter: boolean;   // 是否触发爆散（脉冲）
    converge: boolean;  // 是否触发吸收（脉冲）
};

/**
 * ======================================================
 * UI
 * ======================================================
 *
 * UI：系统的“人类可视接口层”
 *
 * 职责定位（IMPORTANT）：
 * - 提供调试 / 演示 / 控制界面
 * - 展示系统当前状态
 * - 提供少量可控开关
 *
 * 明确不负责：
 * - ❌ 手势识别
 * - ❌ 状态计算
 * - ❌ 粒子更新
 *
 * 设计哲学：
 * - UI 只负责：
 *   - 采集用户意图（checkbox / color / button）
 *   - 显示当前系统状态
 * - 所有行为都通过 callback 向外传递
 * ======================================================
 */
export class UI {

    /**
     * 状态显示区域
     */
    private statusEl!: HTMLDivElement;

    /**
     * 粒子颜色选择器
     */
    private colorEl!: HTMLInputElement;

    /**
     * 显示关键点开关
     */
    private toggleLm!: HTMLInputElement;

    /**
     * 显示摄像头预览开关
     */
    private togglePreview!: HTMLInputElement;

    /**
     * UI 中用于显示摄像头/调试画面的 canvas
     */
    private previewCanvas!: HTMLCanvasElement;

    // ==================================================
    // ⭐ 插件面板
    // ==================================================

    /**
     * 插件控制面板容器
     *
     * 用于：
     * - 动态列出所有插件
     * - 提供启用 / 禁用开关
     */
    private pluginPanel!: HTMLDivElement;

    /**
     * 插件开关回调
     *
     * 由外部（GestureEngine 管理者）注入
     */
    private onPluginToggle?: (name: string, enabled: boolean) => void;

    // ==================================================
    // 回调接口（由外部绑定）
    // ==================================================

    private onColorCb: ((hex: string) => void) | null = null;
    private onToggleLmCb: ((v: boolean) => void) | null = null;
    private onTogglePreviewCb: ((v: boolean) => void) | null = null;
    private onFullscreenCb: (() => void) | null = null;

    /**
     * 构造函数
     *
     * @param root UI 挂载点
     */
    constructor(private root: HTMLElement) {
        this.mount();
    }

    /**
     * mount：创建并挂载 UI DOM 结构
     *
     * 说明：
     * - 使用原生 DOM API
     * - 不依赖任何 UI 框架
     * - 便于快速调试 / 移植
     */
    private mount() {

        // ==========================
        // 主控制面板
        // ==========================
        const panel = document.createElement("div");
        panel.className = "panel";

        /**
         * innerHTML 直接定义 UI 结构
         *
         * 包含：
         * - 标题 + 全屏按钮
         * - 摄像头预览 canvas
         * - 调试开关
         * - 颜色选择器
         * - 状态文本区
         */
        panel.innerHTML = `
      <div class="row">
        <div style="font-weight:600;">Hand Particles Engine</div>
        <button id="fsBtn">全屏</button>
      </div>

      <div class="preview"><canvas id="pv"></canvas></div>

      <div class="row">
        <div class="toggle">
          <input id="togglePreview" type="checkbox" checked />
          <label for="togglePreview">显示摄像头预览</label>
        </div>

        <div class="toggle">
          <input id="toggleLm" type="checkbox" checked />
          <label for="toggleLm">显示关键点</label>
        </div>
      </div>

      <div class="row">
        <label>粒子颜色</label>
        <input id="color" type="color" value="#66ffd8" />
      </div>

      <div class="small" id="status"></div>
    `;

        this.root.appendChild(panel);

        // ==========================
        // ⭐ 插件控制面板（独立区域）
        // ==========================
        this.pluginPanel = document.createElement("div");
        this.pluginPanel.className = "panel";
        this.pluginPanel.innerHTML =
            `<div style="font-weight:600;margin-bottom:8px">Plugins</div>`;
        this.root.appendChild(this.pluginPanel);

        // ==========================
        // DOM 元素引用
        // ==========================
        this.statusEl = panel.querySelector("#status") as HTMLDivElement;
        this.colorEl = panel.querySelector("#color") as HTMLInputElement;
        this.toggleLm = panel.querySelector("#toggleLm") as HTMLInputElement;
        this.togglePreview = panel.querySelector("#togglePreview") as HTMLInputElement;
        this.previewCanvas = panel.querySelector("#pv") as HTMLCanvasElement;

        const fsBtn = panel.querySelector("#fsBtn") as HTMLButtonElement;

        // ==========================
        // 事件绑定（转发给外部）
        // ==========================
        fsBtn.onclick = () => this.onFullscreenCb?.();

        this.colorEl.oninput =
            () => this.onColorCb?.(this.colorEl.value);

        this.toggleLm.onchange =
            () => this.onToggleLmCb?.(this.toggleLm.checked);

        this.togglePreview.onchange =
            () => this.onTogglePreviewCb?.(this.togglePreview.checked);
    }

    // ==================================================
    // 插件开关系统
    // ==================================================

    /**
     * bindPlugins：根据插件名称列表生成 UI 开关
     *
     * @param names 插件名称列表
     */
    bindPlugins(names: string[]) {

        // 重建插件面板
        this.pluginPanel.innerHTML =
            `<div style="font-weight:600;margin-bottom:8px">Plugins</div>`;

        for (const n of names) {
            const row = document.createElement("div");
            row.className = "row";

            const label = document.createElement("label");
            label.textContent = n;

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = true;

            /**
             * 插件开关变化 → 通知外部
             */
            cb.onchange = () => {
                this.onPluginToggle?.(n, cb.checked);
            };

            row.appendChild(label);
            row.appendChild(cb);
            this.pluginPanel.appendChild(row);
        }
    }

    /**
     * 绑定插件启停回调
     */
    onPluginSwitch(cb: (name: string, enabled: boolean) => void) {
        this.onPluginToggle = cb;
    }

    // ==================================================
    // 摄像头调试预览
    // ==================================================

    /**
     * bindPreviewSource
     *
     * 用于将 HandTracker 的调试 canvas
     * 实时复制到 UI 面板中的 preview canvas
     *
     * 设计说明：
     * - 不直接复用 canvas（避免布局 / 样式冲突）
     * - 使用 drawImage 做“镜像输出”
     */
    bindPreviewSource(getCanvas: () => HTMLCanvasElement | null) {

        const src = getCanvas();
        if (!src) return;

        const dst = this.previewCanvas;
        const ctx = dst.getContext("2d")!;

        /**
         * 同步 canvas 尺寸
         */
        const syncSize = () => {
            dst.width = src.width;
            dst.height = src.height;
        };
        syncSize();

        /**
         * 使用 requestAnimationFrame
         * 持续将源 canvas 内容绘制到目标 canvas
         */
        const draw = () => {
            if (
                dst.width !== src.width ||
                dst.height !== src.height
            ) syncSize();

            ctx.clearRect(0, 0, dst.width, dst.height);
            ctx.drawImage(src, 0, 0);
            requestAnimationFrame(draw);
        };

        draw();
    }

    // ==================================================
    // 回调绑定接口
    // ==================================================

    onColor(cb: (hex: string) => void) {
        this.onColorCb = cb;
    }

    onToggleLandmarks(cb: (v: boolean) => void) {
        this.onToggleLmCb = cb;
    }

    onTogglePreview(cb: (v: boolean) => void) {
        this.onTogglePreviewCb = cb;
    }

    onFullscreen(cb: () => void) {
        this.onFullscreenCb = cb;
    }

    // ==================================================
    // 状态显示
    // ==================================================

    /**
     * setStatus：更新 UI 状态文本
     *
     * 说明：
     * - 纯展示函数
     * - 不缓存、不做差分
     * - 适合每帧调用
     */
    setStatus(s: Status) {
        this.statusEl.textContent =
            `Hands: ${s.handCount}\n` +
            `Mode: ${s.mode}\n` +
            `Gesture: ${s.gesture}\n` +
            `Shape: ${s.shape}\n` +
            `Pan: (${s.panX.toFixed(2)}, ${s.panY.toFixed(2)})\n` +
            `Zoom: ${s.zoom.toFixed(2)}\n` +
            `Rotate: ${s.rotation.toFixed(2)}\n` +
            `Spread: ${s.spread.toFixed(2)}\n` +
            `ShakeEnergy: ${s.shakeEnergy.toFixed(2)}\n` +
            `Converge: ${s.converge ? "YES" : "NO"}\n` +
            `Scatter: ${s.scatter ? "YES" : "NO"}`;
    }
}
