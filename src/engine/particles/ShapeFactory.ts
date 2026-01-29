import * as THREE from "three";
import type { ShapeName } from "./ShapeTypes";

// 生成指定形状的粒子目标位置（单位空间）
export function makeShapePositions(name: ShapeName, count: number): Float32Array {
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
            return textShape(count, "ISEP");
    }
}

function sphere(n: number) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = Math.cbrt(Math.random());
        a[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        a[i * 3 + 1] = r * Math.cos(phi);
        a[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return a;
}

function cube(n: number) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        a[i * 3 + 0] = (Math.random() * 2 - 1) * 1.0;
        a[i * 3 + 1] = (Math.random() * 2 - 1) * 1.0;
        a[i * 3 + 2] = (Math.random() * 2 - 1) * 1.0;
    }
    return a;
}

function torusKnot(n: number) {
    const a = new Float32Array(n * 3);
    const p = 2, q = 3;
    const r = 0.7;
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2 * 6;
        const x = (1.2 + r * Math.cos(q * t)) * Math.cos(p * t);
        const y = (1.2 + r * Math.cos(q * t)) * Math.sin(p * t);
        const z = r * Math.sin(q * t);
        const j = 0.06;
        a[i * 3 + 0] = x + (Math.random() * 2 - 1) * j;
        a[i * 3 + 1] = y + (Math.random() * 2 - 1) * j;
        a[i * 3 + 2] = z + (Math.random() * 2 - 1) * j;
    }

    // 归一化
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

function wave(n: number) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const x = (Math.random() * 2 - 1) * 1.2;
        const y = (Math.random() * 2 - 1) * 0.8;
        const z = Math.sin(x * 3) * 0.25 + Math.cos(y * 4) * 0.18;
        a[i * 3] = x;
        a[i * 3 + 1] = y;
        a[i * 3 + 2] = z;
    }
    return a;
}

function ring(n: number) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const t = Math.random() * Math.PI * 2;
        const r = 0.75 + (Math.random() * 2 - 1) * 0.1;
        a[i * 3] = Math.cos(t) * r;
        a[i * 3 + 1] = Math.sin(t) * r;
        a[i * 3 + 2] = (Math.random() * 2 - 1) * 0.15;
    }
    return a;
}

/* 心形：经典参数方程 */
function heart(n: number) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const t = Math.random() * Math.PI * 2;
        const r = 0.9;
        const x = (r * 16 * Math.pow(Math.sin(t), 3)) / 16;
        const y =
            (-r *
                (13 * Math.cos(t) -
                    5 * Math.cos(2 * t) -
                    2 * Math.cos(3 * t) -
                    Math.cos(4 * t))) / 16;
        const z = (Math.random() * 2 - 1) * 0.08;
        a[i * 3] = x;
        a[i * 3 + 1] = y;
        a[i * 3 + 2] = z;
    }
    return a;
}

/**
 * 文字点阵：用 Canvas 写字，再采样像素
 * 说明：这是最简单实用的方式，扩展成任意文字也很容易
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
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const pts: number[] = [];

    // 每 2 像素采样一次（性能更好）
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
