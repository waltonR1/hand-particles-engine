import * as THREE from "three";
import type { InteractionState } from "../interaction/InteractionCore";
import { clamp, lerp } from "../../utils/math";
import { makeShapePositions } from "./ShapeFactory";
import type { ShapeName } from "./ShapeTypes";

/**
 * ======================================================
 * ParticleSystem
 * ======================================================
 *
 * 粒子系统：系统的“视觉执行层（Renderer / Animator）”
 *
 * 设计原则（IMPORTANT）：
 * - 只消费 InteractionState
 * - 不关心：
 *   - 手势来源
 *   - 插件逻辑
 *   - 输入设备
 *
 * 这使得系统可以：
 * - 手势 → 语音 → 键盘 → VR
 * - 完全复用这一层
 *
 * 核心职责：
 * - 管理粒子几何与材质
 * - 执行“连续时间上的插值与动力学”
 * - 将“语义状态”转化为“视觉运动”
 * ======================================================
 */
export class ParticleSystem {

    /**
     * object3d：对外暴露的 Three.js 对象
     *
     * 使用方式：
     * - scene.add(particleSystem.object3d)
     * - 外部不应直接修改其 transform（统一由 applyInteraction 控制）
     */
    public object3d: THREE.Points;

    /**
     * Three.js 几何与材质
     */
    private geometry: THREE.BufferGeometry;
    private material: THREE.PointsMaterial;

    /**
     * 粒子数量（固定）
     */
    private count: number;

    /**
     * pos：当前粒子位置数组
     *
     * 特点：
     * - Float32Array，直接绑定到 BufferAttribute
     * - 每帧在 CPU 上更新
     * - 修改后需要标记 needsUpdate
     */
    private pos: Float32Array;

    /**
     * 所有形状的“目标点集”
     *
     * 设计动机：
     * - 一次性预生成
     * - 形状切换时仅更换引用
     * - 避免运行时重复分配内存
     */
    private targets: Record<ShapeName, Float32Array>;
    private currentTarget: Float32Array;

    /**
     * 爆散 / 聚散相关状态
     *
     * scatter：
     * - 当前爆散强度（0..1）
     *
     * scatterVel：
     * - 爆散“速度/冲量”
     * - 用于制造“瞬间触发 + 缓慢衰减”的感觉
     *
     * spread：
     * - 常态下的聚散程度（0..1）
     */
    private scatter = 0;
    private scatterVel = 0;
    private spread = 0.25;

    /**
     * 物体级变换
     *
     * 重要设计点：
     * - 不做自动旋转
     * - rotation 只来自 InteractionState
     */
    private pan = new THREE.Vector3(0, 0, 0);
    private zoom = 1;
    private rotationZ = 0;

    constructor(count = 18000) {
        this.count = count;

        // ==========================
        // 几何初始化
        // ==========================
        this.geometry = new THREE.BufferGeometry();
        this.pos = new Float32Array(this.count * 3);

        /**
         * 预生成所有形状目标
         *
         * 扩展方式：
         * - 新增 ShapeName
         * - 在 ShapeFactory 中实现
         * - 在此处注册
         *
         * 粒子系统本身无需修改逻辑
         */
        this.targets = {
            SPHERE: makeShapePositions("SPHERE", this.count),
            CUBE: makeShapePositions("CUBE", this.count),
            TORUSKNOT: makeShapePositions("TORUSKNOT", this.count),
            WAVE: makeShapePositions("WAVE", this.count),
            RING: makeShapePositions("RING", this.count),
            HEART: makeShapePositions("HEART", this.count),
            TEXT: makeShapePositions("TEXT", this.count),
        };

        // 初始形状
        this.currentTarget = this.targets.SPHERE;
        this.pos.set(this.currentTarget);

        this.geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(this.pos, 3)
        );

        // ==========================
        // 材质设置（偏能量感）
        // ==========================
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

        // 不参与视锥裁剪（避免大尺度位移时被错误裁掉）
        this.object3d.frustumCulled = false;
    }

    /**
     * 外部接口：设置粒子颜色
     *
     * 通常用于：
     * - UI 控制
     * - 模式切换反馈
     */
    setColor(hex: string) {
        this.material.color.set(hex);
    }

    /**
     * 内部接口：切换当前目标形状
     *
     * 注意：
     * - 不做插值
     * - 插值在 updateParticles 中完成
     */
    private setShape(name: ShapeName) {
        this.currentTarget = this.targets[name];
    }

    /**
     * ======================================================
     * applyInteraction
     * ======================================================
     *
     * 主入口：粒子系统每帧调用
     *
     * 输入：
     * - InteractionState：语义状态
     * - dt：时间步长（秒）
     * - t：全局时间（秒）
     *
     * 职责：
     * - 更新 object3d 的 transform
     * - 更新粒子动力学参数
     * - 驱动 updateParticles
     */
    applyInteraction(s: InteractionState, dt: number, t: number) {

        // ==========================
        // 形状切换（无状态）
        // ==========================
        this.setShape(s.shape);

        /**
         * 平移 / 缩放 / 旋转
         *
         * 使用指数插值：
         * - 与帧率无关
         * - dt 越大，收敛越快
         */
        this.pan.x = lerp(this.pan.x, s.panX, 1 - Math.pow(0.0006, dt));
        this.pan.y = lerp(this.pan.y, s.panY, 1 - Math.pow(0.0006, dt));
        this.zoom = lerp(this.zoom, s.zoom, 1 - Math.pow(0.0008, dt));
        this.rotationZ = lerp(
            this.rotationZ,
            s.rotation,
            1 - Math.pow(0.0007, dt)
        );

        // 写回 Three.js 对象
        this.object3d.position.copy(this.pan);
        this.object3d.scale.setScalar(this.zoom);
        this.object3d.rotation.z = this.rotationZ;

        // ==========================
        // 聚散（连续）
        // ==========================
        this.spread = lerp(
            this.spread,
            s.spread,
            1 - Math.pow(0.001, dt)
        );

        /**
         * 双手合拢（CONVERGE）
         *
         * 行为：
         * - 强制拉回粒子
         * - 同时压制爆散残留
         */
        if (s.converge) {
            this.spread *= 0.88;
            this.scatter *= 0.7;
        }

        /**
         * 爆散（SCATTER）
         *
         * 特点：
         * - 脉冲型事件
         * - 通过 scatterVel 注入能量
         */
        if (s.scatter) {
            this.scatterVel = Math.min(
                2.0,
                this.scatterVel + 1.4
            );
        }

        /**
         * 呼吸效果
         *
         * 特点：
         * - 只影响 scale
         * - stillness 越高，呼吸越明显
         * - 手不动时保持“生命感”
         */
        const breathe =
            1 + Math.sin(t * 2.0) * 0.03 * s.stillness;

        this.updateParticles(dt, breathe);
    }

    /**
     * ======================================================
     * updateParticles
     * ======================================================
     *
     * 逐粒子更新函数
     *
     * 职责：
     * - 爆散动力学
     * - 聚散叠加
     * - 插值逼近目标形状
     */
    private updateParticles(dt: number, breatheScale: number) {

        /**
         * 爆散动力学模型
         *
         * 行为特性：
         * - 快速触发（scatterVel）
         * - 缓慢回落（scatter）
         */
        this.scatterVel = lerp(
            this.scatterVel,
            0,
            1 - Math.pow(0.08, dt)
        );

        this.scatter = clamp(
            this.scatter + this.scatterVel * dt,
            0,
            1
        );

        this.scatter = lerp(
            this.scatter,
            0,
            1 - Math.pow(0.35, dt)
        );

        const p = this.pos;
        const target = this.currentTarget;

        // 跟随速度（越小越柔）
        const follow = 1 - Math.pow(0.002, dt);

        for (let i = 0; i < this.count; i++) {
            const ix = i * 3;

            const tx = target[ix + 0];
            const ty = target[ix + 1];
            const tz = target[ix + 2];

            /**
             * 稳定伪随机方向
             *
             * - 与粒子 index 绑定
             * - 不存数组，节省内存
             */
            const dir = pseudoDir(i);

            // 常态扩散
            const spreadAmt = this.spread * 0.9;

            // 爆散叠加
            const scatterAmt = this.scatter * 2.2;

            // 目标位置（叠加呼吸缩放）
            const gx =
                (tx + dir.x * spreadAmt + dir.x * scatterAmt) *
                breatheScale;

            const gy =
                (ty + dir.y * spreadAmt + dir.y * scatterAmt) *
                breatheScale;

            const gz =
                (tz + dir.z * spreadAmt + dir.z * scatterAmt) *
                breatheScale;

            // 插值逼近
            p[ix + 0] = lerp(p[ix + 0], gx, follow);
            p[ix + 1] = lerp(p[ix + 1], gy, follow);
            p[ix + 2] = lerp(p[ix + 2], gz, follow);
        }

        // 告知 Three.js position 已更新
        (this.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
}

/**
 * ======================================================
 * pseudoDir
 * ======================================================
 *
 * 稳定伪随机方向生成器
 *
 * 特点：
 * - 仅依赖 index
 * - 每个粒子方向恒定
 * - 不需要额外数组存储
 *
 * 用途：
 * - 扩散 / 爆散方向
 */
function pseudoDir(i: number) {
    const x =
        fract(Math.sin(i * 12.9898) * 43758.5453) * 2 - 1;
    const y =
        fract(Math.sin(i * 78.233) * 12345.6789) * 2 - 1;
    const z =
        fract(Math.sin(i * 39.425) * 98765.4321) * 2 - 1;

    const len = Math.sqrt(x * x + y * y + z * z) || 1;

    return { x: x / len, y: y / len, z: z / len };
}

/**
 * fract：小数部分
 *
 * 常用于伪随机函数
 */
function fract(x: number) {
    return x - Math.floor(x);
}
