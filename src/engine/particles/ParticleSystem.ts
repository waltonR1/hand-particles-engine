import * as THREE from "three";
import type { InteractionState } from "../interaction/InteractionCore";
import { clamp, lerp } from "../../utils/math";
import { makeShapePositions } from "./ShapeFactory";
import type { ShapeName } from "./ShapeTypes";

/**
 * 粒子系统：只消费 InteractionState（解耦）
 * - 不关心“手势是什么”
 * - 未来换输入源（语音/键盘/VR）无需改动这里
 */
export class ParticleSystem {
    public object3d: THREE.Points;

    private geometry: THREE.BufferGeometry;
    private material: THREE.PointsMaterial;

    private count: number;

    // 当前粒子位置（写回 attribute）
    private pos: Float32Array;

    // 多形状目标点
    private targets: Record<ShapeName, Float32Array>;
    private currentTarget: Float32Array;

    // 爆散 & 聚散
    private scatter = 0;     // 0..1
    private scatterVel = 0;  // 冲量
    private spread = 0.25;   // 0..1

    // 变换（不自旋转：rotation 只来自交互）
    private pan = new THREE.Vector3(0, 0, 0);
    private zoom = 1;
    private rotationZ = 0;

    constructor(count = 18000) {
        this.count = count;

        this.geometry = new THREE.BufferGeometry();
        this.pos = new Float32Array(this.count * 3);

        // 预生成所有形状目标（加新形状只在 ShapeTypes/ShapeFactory 增加即可）
        this.targets = {
            SPHERE: makeShapePositions("SPHERE", this.count),
            CUBE: makeShapePositions("CUBE", this.count),
            TORUSKNOT: makeShapePositions("TORUSKNOT", this.count),
            WAVE: makeShapePositions("WAVE", this.count),
            RING: makeShapePositions("RING", this.count),
            HEART: makeShapePositions("HEART", this.count),
            TEXT: makeShapePositions("TEXT", this.count),
        };

        this.currentTarget = this.targets.SPHERE;
        this.pos.set(this.currentTarget);

        this.geometry.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));

        this.material = new THREE.PointsMaterial({
            size: 0.012,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            color: new THREE.Color("#66ffd8"),
        });

        this.object3d = new THREE.Points(this.geometry, this.material);
        this.object3d.frustumCulled = false;
    }

    setColor(hex: string) {
        this.material.color.set(hex);
    }

    private setShape(name: ShapeName) {
        this.currentTarget = this.targets[name];
    }

    /**
     * 主更新：粒子实时响应交互状态
     * - 位置/缩放/旋转来自 InteractionState
     * - 粒子形状与聚散/爆散实时插值
     */
    applyInteraction(s: InteractionState, dt: number, t: number) {
        // 形状切换
        this.setShape(s.shape);

        // 平移/缩放/旋转（旋转只来自交互；手不动不旋转）
        this.pan.x = lerp(this.pan.x, s.panX, 1 - Math.pow(0.0006, dt));
        this.pan.y = lerp(this.pan.y, s.panY, 1 - Math.pow(0.0006, dt));
        this.zoom = lerp(this.zoom, s.zoom, 1 - Math.pow(0.0008, dt));
        this.rotationZ = lerp(this.rotationZ, s.rotation, 1 - Math.pow(0.0007, dt));

        this.object3d.position.copy(this.pan);
        this.object3d.scale.setScalar(this.zoom);
        this.object3d.rotation.z = this.rotationZ;

        // 聚散：spread 由交互决定（0..1）
        this.spread = lerp(this.spread, s.spread, 1 - Math.pow(0.001, dt));

        // 双手合拢吸收：更强的“拉回中心”
        if (s.converge) {
            this.spread = this.spread * 0.88;
            // 同时压制爆散
            this.scatter = this.scatter * 0.7;
        }

        // 爆散触发：一次脉冲
        if (s.scatter) {
            this.scatterVel = Math.min(2.0, this.scatterVel + 1.4);
        }

        // 呼吸（手不动时，不自旋转，只轻微 scale 呼吸）
        const breathe = 1 + Math.sin(t * 2.0) * 0.03 * s.stillness;

        this.updateParticles(dt, breathe);
    }

    private updateParticles(dt: number, breatheScale: number) {
        // 爆散动力学：快速起、慢慢回落
        this.scatterVel = lerp(this.scatterVel, 0, 1 - Math.pow(0.08, dt));
        this.scatter = clamp(this.scatter + this.scatterVel * dt, 0, 1);
        this.scatter = lerp(this.scatter, 0, 1 - Math.pow(0.35, dt));

        const p = this.pos;
        const target = this.currentTarget;

        // 跟随速度：越小越柔和
        const follow = 1 - Math.pow(0.002, dt);

        for (let i = 0; i < this.count; i++) {
            const ix = i * 3;

            const tx = target[ix + 0];
            const ty = target[ix + 1];
            const tz = target[ix + 2];

            // 扩散：轻微向随机方向推出
            const dir = pseudoDir(i);

            // spread：正常张合扩散
            const spreadAmt = this.spread * 0.9;

            // scatter：爆散更强
            const scatterAmt = this.scatter * 2.2;

            const gx = (tx + dir.x * spreadAmt + dir.x * scatterAmt) * breatheScale;
            const gy = (ty + dir.y * spreadAmt + dir.y * scatterAmt) * breatheScale;
            const gz = (tz + dir.z * spreadAmt + dir.z * scatterAmt) * breatheScale;

            // 插值逼近目标
            p[ix + 0] = lerp(p[ix + 0], gx, follow);
            p[ix + 1] = lerp(p[ix + 1], gy, follow);
            p[ix + 2] = lerp(p[ix + 2], gz, follow);
        }

        (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
}

// 稳定伪随机方向（不存数组，省内存）
function pseudoDir(i: number) {
    const x = fract(Math.sin(i * 12.9898) * 43758.5453) * 2 - 1;
    const y = fract(Math.sin(i * 78.233) * 12345.6789) * 2 - 1;
    const z = fract(Math.sin(i * 39.425) * 98765.4321) * 2 - 1;
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    return { x: x / len, y: y / len, z: z / len };
}

function fract(x: number) {
    return x - Math.floor(x);
}
