type Status = {
    handCount: number;
    mode: string;
    gesture: string;
    shape: string;

    panX: number;
    panY: number;
    zoom: number;
    rotation: number;
    spread: number;

    shakeEnergy: number;
    scatter: boolean;
    converge: boolean;
};

export class UI {
    private statusEl!: HTMLDivElement;
    private colorEl!: HTMLInputElement;
    private toggleLm!: HTMLInputElement;
    private togglePreview!: HTMLInputElement;
    private previewCanvas!: HTMLCanvasElement;

    // ⭐ 插件面板
    private pluginPanel!: HTMLDivElement;
    private onPluginToggle?: (name: string, enabled: boolean) => void;

    private onColorCb: ((hex: string) => void) | null = null;
    private onToggleLmCb: ((v: boolean) => void) | null = null;
    private onTogglePreviewCb: ((v: boolean) => void) | null = null;
    private onFullscreenCb: (() => void) | null = null;

    constructor(private root: HTMLElement) {
        this.mount();
    }

    private mount() {
        const panel = document.createElement("div");
        panel.className = "panel";

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

        // ⭐ 插件面板（单独一块）
        this.pluginPanel = document.createElement("div");
        this.pluginPanel.className = "panel";
        this.pluginPanel.innerHTML = `<div style="font-weight:600;margin-bottom:8px">Plugins</div>`;
        this.root.appendChild(this.pluginPanel);

        this.statusEl = panel.querySelector("#status") as HTMLDivElement;
        this.colorEl = panel.querySelector("#color") as HTMLInputElement;
        this.toggleLm = panel.querySelector("#toggleLm") as HTMLInputElement;
        this.togglePreview = panel.querySelector("#togglePreview") as HTMLInputElement;
        this.previewCanvas = panel.querySelector("#pv") as HTMLCanvasElement;

        const fsBtn = panel.querySelector("#fsBtn") as HTMLButtonElement;
        fsBtn.onclick = () => this.onFullscreenCb?.();

        this.colorEl.oninput = () => this.onColorCb?.(this.colorEl.value);
        this.toggleLm.onchange = () => this.onToggleLmCb?.(this.toggleLm.checked);
        this.togglePreview.onchange = () => this.onTogglePreviewCb?.(this.togglePreview.checked);
    }

    // ===== 插件开关系统 =====

    bindPlugins(names: string[]) {
        this.pluginPanel.innerHTML = `<div style="font-weight:600;margin-bottom:8px">Plugins</div>`;

        for (const n of names) {
            const row = document.createElement("div");
            row.className = "row";

            const label = document.createElement("label");
            label.textContent = n;

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked = true;

            cb.onchange = () => {
                this.onPluginToggle?.(n, cb.checked);
            };

            row.appendChild(label);
            row.appendChild(cb);
            this.pluginPanel.appendChild(row);
        }
    }

    onPluginSwitch(cb: (name: string, enabled: boolean) => void) {
        this.onPluginToggle = cb;
    }

    // ===== 摄像头调试预览 =====

    bindPreviewSource(getCanvas: () => HTMLCanvasElement | null) {
        const src = getCanvas();
        if (!src) return;

        const dst = this.previewCanvas;
        const ctx = dst.getContext("2d")!;

        const syncSize = () => {
            dst.width = src.width;
            dst.height = src.height;
        };
        syncSize();

        const draw = () => {
            if (dst.width !== src.width || dst.height !== src.height) syncSize();
            ctx.clearRect(0, 0, dst.width, dst.height);
            ctx.drawImage(src, 0, 0);
            requestAnimationFrame(draw);
        };
        draw();
    }

    // ===== 回调绑定 =====

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

    // ===== 状态显示 =====

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
