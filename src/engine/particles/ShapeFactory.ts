import * as THREE from "three";
import type { ShapeName } from "./ShapeTypes";

// ======================================================
// makeShapePositions
// ======================================================
//
// 职责：
// - 根据 ShapeName 生成“粒子目标位置数组”
// - 所有位置都位于“单位空间”附近（约 [-1, 1]）
// - 返回值可直接作为粒子系统的 target positions
//
// 设计约定（IMPORTANT）：
// - 返回 Float32Array，长度 = count * 3
// - 每 3 个数表示一个点的 (x, y, z)
// - 该函数只负责“形状分布”，不关心：
//   - 粒子当前状态
//   - 动画 / 插值
//   - Three.js BufferGeometry 的绑定
//
// 这种设计使得：
// - interaction 层只需切换 ShapeName
// - particles 层负责“如何从当前位置过渡到目标位置”
// ======================================================
export function makeShapePositions(
    name: ShapeName,
    count: number
): Float32Array {
    switch (name) {
        case "SPHERE":
            return sphere(count);
        case "CUBE":
            return cube(count);
        case "TORUSKNOT":
            return torusKnot(count);
        case "WAVE":
            return wave(count);
        case "RING":
            return ring(count);
        case "HEART":
            return heart(count);
        case "TEXT":
            // 当前文字内容写死为 "ISEP"
            // 语义上 ShapeName = TEXT
            // 具体文字属于“额外参数”，未来可外置
            return textShape(count, "ISEP");
    }
}

/**
 * sphere：球体内部均匀分布
 *
 * 数学说明：
 * - 使用球坐标系 (r, θ, φ)
 * - r 使用 cbrt(random)，保证体积分布均匀
 *   （否则会在球心聚集）
 *
 * 结果特性：
 * - 点分布在单位球内部
 * - 适合作为“中性 / 默认”粒子形态
 */
function sphere(n: number) {
    const a = new Float32Array(n * 3);

    for (let i = 0; i < n; i++) {
        const u = Math.random();
        const v = Math.random();

        // 球坐标角度
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);

        // 使用立方根，使半径在体积上均匀
        const r = Math.cbrt(Math.random());

        a[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        a[i * 3 + 1] = r * Math.cos(phi);
        a[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }

    return a;
}

/**
 * cube：立方体内均匀随机分布
 *
 * 分布范围：
 * - x, y, z ∈ [-1, 1]
 *
 * 特点：
 * - 实现最简单
 * - 视觉上“噪声感 / 体素感”较强
 */
function cube(n: number) {
    const a = new Float32Array(n * 3);

    for (let i = 0; i < n; i++) {
        a[i * 3 + 0] = (Math.random() * 2 - 1) * 1.0;
        a[i * 3 + 1] = (Math.random() * 2 - 1) * 1.0;
        a[i * 3 + 2] = (Math.random() * 2 - 1) * 1.0;
    }

    return a;
}

/**
 * torusKnot：环面扭结（Torus Knot）
 *
 * 数学模型：
 * - 使用经典参数方程
 * - p, q 决定结的“缠绕方式”
 *
 * 实现细节：
 * - 沿曲线均匀采样
 * - 在每个点附近加入少量随机扰动
 *   → 让粒子形成“管状体积”，而不是一根线
 *
 * 后处理：
 * - 计算最大长度
 * - 整体归一化到单位空间
 */
function torusKnot(n: number) {
    const a = new Float32Array(n * 3);

    const p = 2, q = 3; // 结的参数
    const r = 0.7;      // 管半径

    for (let i = 0; i < n; i++) {
        // t 范围拉大（*6），让曲线更“饱满”
        const t = (i / n) * Math.PI * 2 * 6;

        const x = (1.2 + r * Math.cos(q * t)) * Math.cos(p * t);
        const y = (1.2 + r * Math.cos(q * t)) * Math.sin(p * t);
        const z = r * Math.sin(q * t);

        // 抖动半径：让形状有体积
        const j = 0.06;
        a[i * 3 + 0] = x + (Math.random() * 2 - 1) * j;
        a[i * 3 + 1] = y + (Math.random() * 2 - 1) * j;
        a[i * 3 + 2] = z + (Math.random() * 2 - 1) * j;
    }

    // ==========================
    // 归一化处理
    // ==========================
    // 目的：
    // - 不同形状生成函数的尺度统一
    // - 方便粒子系统用同一套参数
    const v = new THREE.Vector3();
    let maxL = 0;

    for (let i = 0; i < n; i++) {
        v.set(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);
        maxL = Math.max(maxL, v.length());
    }

    for (let i = 0; i < n; i++) {
        a[i * 3] /= maxL;
        a[i * 3 + 1] /= maxL;
        a[i * 3 + 2] /= maxL;
    }

    return a;
}

/**
 * wave：二维波面 + 高度起伏
 *
 * 构造方式：
 * - x, y：平面随机分布
 * - z：由 sin / cos 叠加得到
 *
 * 视觉效果：
 * - 类似“起伏的布面 / 能量波”
 */
function wave(n: number) {
    const a = new Float32Array(n * 3);

    for (let i = 0; i < n; i++) {
        const x = (Math.random() * 2 - 1) * 1.2;
        const y = (Math.random() * 2 - 1) * 0.8;

        // z 作为高度扰动
        const z =
            Math.sin(x * 3) * 0.25 +
            Math.cos(y * 4) * 0.18;

        a[i * 3] = x;
        a[i * 3 + 1] = y;
        a[i * 3 + 2] = z;
    }

    return a;
}

/**
 * ring：环形分布
 *
 * 特点：
 * - 主要分布在 XY 平面
 * - 半径有轻微随机扰动
 * - Z 方向厚度很薄
 *
 * 常用于：
 * - 双手交互
 * - 围绕中心的 UI / 控制反馈
 */
function ring(n: number) {
    const a = new Float32Array(n * 3);

    for (let i = 0; i < n; i++) {
        const t = Math.random() * Math.PI * 2;

        // 半径带少量随机性，避免“完美圆”
        const r = 0.75 + (Math.random() * 2 - 1) * 0.1;

        a[i * 3] = Math.cos(t) * r;
        a[i * 3 + 1] = Math.sin(t) * r;
        a[i * 3 + 2] = (Math.random() * 2 - 1) * 0.15;
    }

    return a;
}

/**
 * heart：心形曲线 + 厚度
 *
 * 使用经典二维心形参数方程
 * 再在 z 轴方向加入微小随机扰动
 *
 * 注意：
 * - 这是“情绪/符号型”形状
 * - 精度与数学严谨性并非首要目标
 */
function heart(n: number) {
    const a = new Float32Array(n * 3);

    for (let i = 0; i < n; i++) {
        const t = Math.random() * Math.PI * 2;
        const r = 0.9;

        const x =
            (r * 16 * Math.pow(Math.sin(t), 3)) / 16;

        const y =
            (-r *
                (13 * Math.cos(t)
                    - 5 * Math.cos(2 * t)
                    - 2 * Math.cos(3 * t)
                    - Math.cos(4 * t))) / 16;

        const z = (Math.random() * 2 - 1) * 0.08;

        a[i * 3] = x;
        a[i * 3 + 1] = y;
        a[i * 3 + 2] = z;
    }

    return a;
}

/**
 * textShape：文字点阵形状
 *
 * 实现思路（IMPORTANT）：
 * - 使用 Canvas 2D API 渲染文字
 * - 读取像素 alpha
 * - 将“有字的像素”转换为 3D 点
 *
 * 优点：
 * - 实现简单
 * - 不依赖字体解析库
 * - 很容易扩展为任意字符串
 *
 * 局限：
 * - 不是严格的字形轮廓
 * - 点密度受画布分辨率影响
 */
function textShape(n: number, text: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 240;

    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "white";
    ctx.font = "bold 160px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 将文字绘制到画布中心
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const img = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    ).data;

    const pts: number[] = [];

    /**
     * 像素采样
     *
     * - 每 2 像素取一次，减少点数
     * - alpha > 100 视为“文字区域”
     */
    for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
            const i = (y * canvas.width + x) * 4;
            const alpha = img[i + 3];

            if (alpha > 100) {
                pts.push(
                    (x / canvas.width - 0.5) * 2.2,
                    -(y / canvas.height - 0.5) * 1.2,
                    (Math.random() * 2 - 1) * 0.05
                );
            }
        }
    }

    /**
     * 输出长度对齐
     *
     * - 若文字点数 < n
     * - 使用取模重复填充
     */
    const arr = new Float32Array(n * 3);
    const m = Math.max(1, pts.length / 3);

    for (let i = 0; i < n; i++) {
        const k = (i % m) * 3;
        arr[i * 3] = pts[k];
        arr[i * 3 + 1] = pts[k + 1];
        arr[i * 3 + 2] = pts[k + 2];
    }

    return arr;
}
