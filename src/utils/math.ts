// 常用数学工具（显式标注返回类型，避免 TS 推断链出奇怪类型）
export function clamp(v: number, a: number, b: number): number {
    return Math.max(a, Math.min(b, v));
}

export function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function length2(x: number, y: number): number {
    return Math.sqrt(x * x + y * y);
}
