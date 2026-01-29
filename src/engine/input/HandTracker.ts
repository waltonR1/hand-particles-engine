import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { HandFrame } from "./types/GestureTypes";
import { clamp01 } from "../../utils/math";

// 手部追踪：负责摄像头 + 模型推理 + 输出 HandFrame[]
export class HandTracker {
    private handLandmarker: HandLandmarker | null = null;

    // 节流：推理 30FPS 左右，避免过热
    private lastInfer = 0;
    private inferIntervalMs = 1000 / 30;

    // 调试画布：用于 UI 预览（可开关）
    private debugCanvas: HTMLCanvasElement;
    private debugCtx: CanvasRenderingContext2D;

    private drawDebug = true;   // 是否画骨架点线
    private showPreview = true; // 是否显示摄像头画面

    constructor(private video: HTMLVideoElement) {
        this.debugCanvas = document.createElement("canvas");
        this.debugCanvas.width = 640;
        this.debugCanvas.height = 360;
        this.debugCtx = this.debugCanvas.getContext("2d")!;
    }

    async init() {
        // 摄像头
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: 1280, height: 720 },
            audio: false,
        });
        this.video.srcObject = stream;
        await this.video.play();

        // 模型 wasm 资源
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        // 手部关键点模型（最多 2 只手）
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath:
                    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            },
            runningMode: "VIDEO",
            numHands: 2,
        });
    }

    // ===== 提供给 UI 的调试接口 =====
    getPreviewCanvas() {
        return this.debugCanvas;
    }

    setDrawDebug(v: boolean) {
        this.drawDebug = v;
    }

    setShowPreview(v: boolean) {
        this.showPreview = v;
    }

    // 每帧调用：返回 0/1/2 个 HandFrame
    update(): HandFrame[] {
        if (!this.handLandmarker) return [];

        const now = performance.now();
        if (now - this.lastInfer < this.inferIntervalMs) {
            // 没到推理时机：不更新（减少抖动/算力）
            return [];
        }
        this.lastInfer = now;

        const res = this.handLandmarker.detectForVideo(this.video, now);

        const landmarksAll = res.landmarks ?? [];
        // handedness 结构在 tasks-vision 里可能随版本变化，这里做容错
        const handed = (res as any).handednesses?.map((h: any) => h?.[0]?.categoryName) ?? [];

        // 先画调试画面
        this.drawFrame(landmarksAll);

        const frames: HandFrame[] = [];

        for (let i = 0; i < landmarksAll.length; i++) {
            const lm = landmarksAll[i];
            if (!lm || lm.length !== 21) continue;

            // pinch：thumb_tip(4) 与 index_tip(8) 距离映射到 0..1
            const pinchDist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
            // d≈0.02 很紧，d≈0.14 很开（可调）
            const pinch = clamp01(1 - (pinchDist - 0.02) / (0.14 - 0.02));

            // center：wrist(0) 与 middle_mcp(9) 平均
            const center = {
                x: (lm[0].x + lm[9].x) / 2,
                y: (lm[0].y + lm[9].y) / 2,
            };

            // size：wrist(0) -> middle_tip(12)
            const size = clamp01(Math.hypot(lm[12].x - lm[0].x, lm[12].y - lm[0].y) * 2.2);

            frames.push({
                landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
                center,
                size,
                pinch,
                t: now / 1000,
                handedness: handed[i] === "Left" || handed[i] === "Right" ? handed[i] : undefined,
            });
        }

        // 为了双手交互稳定：按左右排序（如果拿得到 handedness）
        frames.sort((a, b) => {
            const A = a.handedness ?? "Left";
            const B = b.handedness ?? "Left";
            return A.localeCompare(B);
        });

        return frames;
    }

    // 画摄像头预览 + 关键点骨架
    private drawFrame(allLandmarks: any[]) {
        const ctx = this.debugCtx;
        const w = this.debugCanvas.width;
        const h = this.debugCanvas.height;

        ctx.clearRect(0, 0, w, h);
        if (!this.showPreview) return;

        // 镜像绘制（更符合自拍控制习惯）
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(this.video, -w, 0, w, h);
        ctx.restore();

        if (!this.drawDebug) return;

        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);

        ctx.fillStyle = "rgba(0,255,200,0.9)";
        ctx.strokeStyle = "rgba(0,255,200,0.6)";
        ctx.lineWidth = 2;

        const edges: Array<[number, number]> = [
            [0, 5], [5, 9], [9, 13], [13, 17], // palm
            [0, 1], [1, 2], [2, 3], [3, 4],    // thumb
            [5, 6], [6, 7], [7, 8],            // index
            [9, 10], [10, 11], [11, 12],       // middle
            [13, 14], [14, 15], [15, 16],      // ring
            [17, 18], [18, 19], [19, 20],      // pinky
        ];

        for (const lm of allLandmarks) {
            if (!lm || lm.length !== 21) continue;

            for (const [a, b] of edges) {
                ctx.beginPath();
                ctx.moveTo(lm[a].x * w, lm[a].y * h);
                ctx.lineTo(lm[b].x * w, lm[b].y * h);
                ctx.stroke();
            }

            for (const p of lm) {
                ctx.beginPath();
                ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}
