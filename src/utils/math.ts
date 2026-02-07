// ==============================
// 数学工具函数集合（Math Utils）
// ==============================
//
// 设计目标：
// - 提供最基础、无副作用的纯函数（pure functions）
// - 显式返回 number，避免 TypeScript 在复杂调用链中推断出联合/泛型怪类型
// - 不依赖任何外部状态，方便在手势、动画、粒子系统中高频调用
//
// 注意：
// - 这里所有函数都不做参数合法性校验（如 NaN / Infinity）
// - 默认调用方已经保证输入是“合理的数值”
// - 如果未来用于不可信输入，需在上层统一兜底
// ==============================


/**
 * clamp：数值钳制函数
 *
 * 将输入值 v 限制在区间 [a, b] 之间：
 * - 若 v < a，则返回 a
 * - 若 v > b，则返回 b
 * - 否则返回 v 本身
 *
 * 常见用途：
 * - 限制手势强度、缩放倍率、速度等不越界
 * - 防止动画参数超出预期范围
 *
 * 参数约定（隐式）：
 * - a <= b（未做校验，若 a > b，结果将不符合直觉）
 *
 * @param v 要被限制的原始数值
 * @param a 下界（最小值）
 * @param b 上界（最大值）
 * @returns 被限制在 [a, b] 区间内的数值
 */
export function clamp(v: number, a: number, b: number): number {
    // 先用 Math.min 把 v 限制到不超过 b
    // 再用 Math.max 把结果限制到不小于 a
    return Math.max(a, Math.min(b, v));
}


/**
 * clamp01：归一化钳制函数
 *
 * clamp(v, 0, 1) 的语义化快捷版本，用于“比例 / 权重 / 插值因子”等场景。
 *
 * 常见用途：
 * - 插值参数 t（lerp 中的 t）
 * - 进度值 progress
 * - 归一化后的手势强度、置信度
 *
 * 设计动机：
 * - 语义比 clamp(v, 0, 1) 更清晰
 * - 避免在调用点反复写魔法数字 0 和 1
 *
 * @param v 输入数值（理论上期望在 [0, 1]，但允许越界）
 * @returns 被限制在 [0, 1] 区间内的数值
 */
export function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}


/**
 * lerp：线性插值（Linear Interpolation）
 *
 * 在数值 a 与 b 之间，根据参数 t 进行线性插值：
 * - t = 0   → 返回 a
 * - t = 1   → 返回 b
 * - 0 < t < 1 → 返回 a 与 b 之间的过渡值
 *
 * 数学表达式：
 *   a + (b - a) * t
 *
 * 注意（非常重要的隐式约定）：
 * - 本函数 **不会 clamp t**
 * - 当 t < 0 或 t > 1 时，结果是“外插（extrapolation）”
 *
 * 常见用途：
 * - 动画平滑过渡
 * - 手势参数平滑（结合 clamp01 使用）
 * - 粒子属性（大小、透明度、速度）随时间变化
 *
 * 典型安全用法：
 *   lerp(a, b, clamp01(t))
 *
 * @param a 起始值（t = 0 时）
 * @param b 目标值（t = 1 时）
 * @param t 插值因子（通常在 [0, 1]，但不强制）
 * @returns 插值后的数值
 */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}


/**
 * length2：二维向量长度（欧几里得范数）
 *
 * 计算二维向量 (x, y) 的长度（模长）：
 *   sqrt(x² + y²)
 *
 * 命名说明（容易产生歧义的点）：
 * - 这里的 length2 并不是 “length squared”
 * - 而是 “2D length”（二维长度）
 *
 * ⚠️ 潜在歧义提示（NOTE）：
 * - 在数学/图形学中，length2 常被用来表示 “平方长度”
 * - 如果未来代码规模变大，可能需要：
 *   - 改名为 length2D
 *   - 或补充 length2Sq / lengthSquared
 *
 * 常见用途：
 * - 计算两点间距离（先算 dx, dy）
 * - 手势中心点距离
 * - 粒子、向量的幅值计算
 *
 * 性能说明：
 * - 内部使用 Math.sqrt
 * - 若只做比较（大小判断），可考虑用平方长度避免开根号
 *
 * @param x 向量在 x 轴上的分量
 * @param y 向量在 y 轴上的分量
 * @returns 向量 (x, y) 的欧几里得长度
 */
export function length2(x: number, y: number): number {
    return Math.sqrt(x * x + y * y);
}
