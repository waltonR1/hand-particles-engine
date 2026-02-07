import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { HandFrame } from "./types/GestureTypes";
import { clamp01 } from "../../utils/math";

// ==========================================================
// HandTracker
// ==========================================================
//
// 职责定位（IMPORTANT）：
// - 负责「摄像头接入 + MediaPipe 推理 + 数据清洗」
// - 输出系统内部统一使用的 HandFrame[] 结构
//
// 明确不负责的事情：
// - ❌ 手势识别逻辑（交给 GestureEngine / 插件）
// - ❌ 平滑（EMA 等通常在更高一层做）
// - ❌ 业务语义（点击 / 缩放 / 旋转）
//
// 设计关键词：
// - 高性能（节流）
// - 强鲁棒（版本容错）
// - 强可视化（内置调试画布）
// ==========================================================
export class HandTracker {

    /**
     * MediaPipe HandLandmarker 实例
     *
     * 生命周期：
     * - init() 前为 null
     * - init() 成功后可用于每帧推理
     *
     * 设计为可空的原因：
     * - init 是异步的
     * - update() 可能早于 init 被调用
     */
    private handLandmarker: HandLandmarker | null = null;

    /**
     * 推理节流相关状态
     *
     * 目的：
     * - 控制模型推理频率 ≈ 30 FPS
     * - 防止 CPU / GPU 过热
     * - 避免不必要的抖动
     */
    private lastInfer = 0;
    private inferIntervalMs = 1000 / 30;

    /**
     * 调试画布（Offscreen Canvas 思路）
     *
     * 用途：
     * - 显示摄像头预览
     * - 绘制手部关键点和骨架
     *
     * 注意：
     * - 不直接插入 DOM
     * - 由外部 UI 自行决定是否展示
     */
    private debugCanvas: HTMLCanvasElement;
    private debugCtx: CanvasRenderingContext2D;

    /**
     * 调试开关
     *
     * drawDebug：
     * - 是否绘制手部关键点和骨架线
     *
     * showPreview：
     * - 是否绘制摄像头画面
     * - 若关闭，仅清空画布
     */
    private drawDebug = true;
    private showPreview = true;

    /**
     * @param video 外部传入的 <video> 元素
     *
     * 设计说明：
     * - video 的创建/插入 DOM 由外部负责
     * - HandTracker 只“使用”，不“管理 DOM”
     */
    constructor(private video: HTMLVideoElement) {
        // 初始化调试画布（固定分辨率，独立于摄像头真实分辨率）
        this.debugCanvas = document.createElement("canvas");
        this.debugCanvas.width = 640;
        this.debugCanvas.height = 360;
        this.debugCtx = this.debugCanvas.getContext("2d")!;
    }

    /**
     * init：异步初始化摄像头与 MediaPipe 模型
     *
     * 必须在 update() 之前调用
     */
    async init() {

        // ==========================
        // 1️⃣ 获取摄像头视频流
        // ==========================
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user", // 前置摄像头（自拍）
                width: 1280,
                height: 720,
            },
            audio: false,
        });

        // 将视频流绑定到 <video> 元素
        this.video.srcObject = stream;
        await this.video.play();

        // ==========================
        // 2️⃣ 加载 MediaPipe Vision WASM
        // ==========================
        //
        // 注意：
        // - 这里使用 CDN
        // - 若用于离线 / 内网环境，需要自行托管 wasm 文件
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        // ==========================
        // 3️⃣ 创建 HandLandmarker
        // ==========================
        //
        // 参数说明：
        // - runningMode: "VIDEO"
        //   → 允许基于时间戳做视频连续推理
        //
        // - numHands: 2
        //   → 最多检测两只手
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath:
                    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            },
            runningMode: "VIDEO",
            numHands: 2,
        });
    }

    // ======================================================
    // 调试相关对外接口（供 UI 使用）
    // ======================================================

    /**
     * 获取调试画布
     *
     * 使用方式：
     * - UI 层可将该 canvas 插入 DOM
     * - HandTracker 内部持续绘制
     */
    getPreviewCanvas() {
        return this.debugCanvas;
    }

    /**
     * 开关：是否绘制骨架与关键点
     */
    setDrawDebug(v: boolean) {
        this.drawDebug = v;
    }

    /**
     * 开关：是否显示摄像头画面
     */
    setShowPreview(v: boolean) {
        this.showPreview = v;
    }

    /**
     * update：每帧调用，执行一次“可能的”推理
     *
     * 返回值：
     * - 0 / 1 / 2 个 HandFrame
     *
     * 重要行为说明（IMPORTANT）：
     * - 若未到节流时间 → 直接返回 []
     * - 返回 [] 并不代表“没有手”
     * - 而是“这一帧没有做推理”
     */
    update(): HandFrame[] {
        if (!this.handLandmarker) return [];

        const now = performance.now();

        // ==========================
        // 节流控制
        // ==========================
        if (now - this.lastInfer < this.inferIntervalMs) {
            return [];
        }
        this.lastInfer = now;

        // ==========================
        // MediaPipe 推理
        // ==========================
        const res = this.handLandmarker.detectForVideo(this.video, now);

        // landmarks：二维数组 [hand][21 points]
        const landmarksAll = res.landmarks ?? [];

        /**
         * handedness 容错处理
         *
         * 原因：
         * - MediaPipe tasks-vision 的 handedness 结构
         *   在不同版本中字段层级可能变化
         *
         * 这里的策略：
         * - 使用 any
         * - 尽量提取 categoryName
         * - 失败则回退为 undefined
         */
        const handed =
            (res as any).handednesses?.map((h: any) => h?.[0]?.categoryName) ?? [];

        // ==========================
        // 调试绘制（原始 landmarks）
        // ==========================
        this.drawFrame(landmarksAll);

        const frames: HandFrame[] = [];

        // ==========================
        // 将模型输出 → HandFrame
        // ==========================
        for (let i = 0; i < landmarksAll.length; i++) {
            const lm = landmarksAll[i];
            if (!lm || lm.length !== 21) continue;

            /**
             * pinch：捏合强度
             *
             * 基于：
             * - thumb_tip (4)
             * - index_tip (8)
             *
             * 数值经验：
             * - 距离 ≈ 0.02 → 非常捏紧
             * - 距离 ≈ 0.14 → 完全张开
             *
             * 映射逻辑：
             * - 距离越小 → pinch 越接近 1
             * - 最终 clamp 到 [0, 1]
             */
            const pinchDist = Math.hypot(
                lm[4].x - lm[8].x,
                lm[4].y - lm[8].y
            );
            const pinch = clamp01(
                1 - (pinchDist - 0.02) / (0.14 - 0.02)
            );

            /**
             * center：手掌中心近似
             *
             * 计算方式：
             * - wrist (0)
             * - middle_mcp (9)
             *
             * 这是一个“经验定义”，不是模型直接输出
             */
            const center = {
                x: (lm[0].x + lm[9].x) / 2,
                y: (lm[0].y + lm[9].y) / 2,
            };

            /**
             * size：手部尺度
             *
             * 基于：
             * - wrist (0)
             * - middle_tip (12)
             *
             * *2.2：
             * - 经验缩放因子
             * - 用于让 size 分布更接近 [0, 1]
             */
            const size = clamp01(
                Math.hypot(
                    lm[12].x - lm[0].x,
                    lm[12].y - lm[0].y
                ) * 2.2
            );

            frames.push({
                // 深拷贝 landmarks，避免外部意外修改原始结果
                landmarks: lm.map((p) => ({
                    x: p.x,
                    y: p.y,
                    z: p.z,
                })),
                center,
                size,
                pinch,

                // 时间戳统一转为秒
                t: now / 1000,

                // handedness 严格校验
                handedness:
                    handed[i] === "Left" || handed[i] === "Right"
                        ? handed[i]
                        : undefined,
            });
        }

        /**
         * 双手排序策略
         *
         * 目的：
         * - 提升双手交互稳定性
         * - 保证 frames[0] / frames[1] 语义一致
         *
         * 策略：
         * - 若 handedness 缺失，默认视为 "Left"
         * - 使用字符串排序
         */
        frames.sort((a, b) => {
            const A = a.handedness ?? "Left";
            const B = b.handedness ?? "Left";
            return A.localeCompare(B);
        });

        return frames;
    }

    /**
     * drawFrame：调试绘制函数
     *
     * 功能：
     * - 绘制摄像头画面
     * - 绘制手部关键点与骨架
     *
     * 注意：
     * - 完全不影响 HandFrame 计算
     * - 仅用于开发 / 调试
     */
    private drawFrame(allLandmarks: any[]) {
        const ctx = this.debugCtx;
        const w = this.debugCanvas.width;
        const h = this.debugCanvas.height;

        ctx.clearRect(0, 0, w, h);
        if (!this.showPreview) return;

        /**
         * 镜像绘制摄像头画面
         *
         * 原因：
         * - 自拍视角更符合用户直觉
         */
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(this.video, -w, 0, w, h);
        ctx.restore();

        if (!this.drawDebug) return;

        // 与视频镜像保持一致
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);

        ctx.fillStyle = "rgba(0,255,200,0.9)";
        ctx.strokeStyle = "rgba(0,255,200,0.6)";
        ctx.lineWidth = 2;

        /**
         * 手部骨架边定义
         *
         * 数字索引遵循 MediaPipe Hands 官方拓扑
         */
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

            // 画骨架线
            for (const [a, b] of edges) {
                ctx.beginPath();
                ctx.moveTo(lm[a].x * w, lm[a].y * h);
                ctx.lineTo(lm[b].x * w, lm[b].y * h);
                ctx.stroke();
            }

            // 画关键点
            for (const p of lm) {
                ctx.beginPath();
                ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }
}
