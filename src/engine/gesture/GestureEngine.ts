import type { HandFrame } from "../input/types/GestureTypes";
import type { InteractionEvent } from "../interaction/InteractionTypes";
import type { GesturePlugin } from "./GesturePlugin";

/**
 * PluginModule
 *
 * 用于描述通过 import.meta.glob() 动态加载到的模块结构。
 *
 * 设计原因：
 * - 不同插件文件可能使用：
 *   - export default class XxxPlugin
 *   - 或 export class Plugin
 * - 这里做一个“结构兜底”，提高兼容性
 */
type PluginModule = {
    default?: new () => GesturePlugin;
    Plugin?: new () => GesturePlugin;
};

/**
 * ======================================================
 * GestureEngine
 * ======================================================
 *
 * GestureEngine：手势插件的“执行引擎 / 调度器”
 *
 * 核心职责（IMPORTANT）：
 * - 自动发现并加载 plugins 目录下的所有插件
 * - 按 priority 与 phase 调度插件
 * - 聚合所有插件产生的 InteractionEvent
 *
 * 明确不负责的事情：
 * - ❌ 不做任何手势识别逻辑
 * - ❌ 不维护跨帧状态（由插件自行维护）
 * - ❌ 不解释事件含义（交给 InteractionCore）
 *
 * 它的角色类似于：
 * - 中间件调度器
 * - 或一个“无状态的插件执行管线”
 * ======================================================
 */
export class GestureEngine {

    /**
     * 已加载的插件实例列表
     *
     * 生命周期：
     * - 在 constructor 中加载
     * - 整个 GestureEngine 生命周期内保持不变
     */
    private plugins: GesturePlugin[] = [];

    constructor() {
        // 构造时立即加载插件
        this.loadPlugins();
    }

    /**
     * loadPlugins：动态加载并初始化所有插件
     *
     * 实现方式：
     * - 使用 Vite 的 import.meta.glob
     * - eager: true → 构建时即引入，不做懒加载
     *
     * 插件发现规则：
     * - 文件路径：./plugins/*.ts
     * - 导出：
     *   - default export，或
     *   - 名为 Plugin 的命名导出
     */
    private loadPlugins() {

        /**
         * import.meta.glob 返回：
         * - key   → 文件路径
         * - value → 模块对象
         */
        const modules = import.meta.glob("./plugins/*.ts", { eager: true }) as Record<
            string,
            PluginModule
        >;

        for (const path in modules) {
            const mod = modules[path];

            // 兼容 default / Plugin 两种导出方式
            const PluginClass = mod.default || mod.Plugin;
            if (!PluginClass) continue;

            // 实例化插件
            const instance = new PluginClass();
            this.plugins.push(instance);
        }

        /**
         * 插件排序（按 priority）
         *
         * 约定：
         * - priority 数值越小 → 越早执行
         * - 未指定 priority 的插件默认视为 100
         *
         * 注意：
         * - 这里只排序一次
         * - phase 的顺序在 process() 中控制
         */
        this.plugins.sort(
            (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
        );

        /**
         * 控制台输出插件信息
         *
         * 用途：
         * - 调试
         * - 验证加载顺序
         */
        console.table(
            this.plugins.map((p) => ({
                name: p.name,
                priority: p.priority ?? 100,
            }))
        );
    }

    /**
     * ======================================================
     * process
     * ======================================================
     *
     * 每帧调用的核心方法
     *
     * 输入：
     * - frames：当前帧检测到的所有 HandFrame
     * - dt：时间步长（秒）
     * - time：全局时间（秒，默认使用 performance.now）
     *
     * 输出：
     * - 当前帧所有插件产生的 InteractionEvent[]
     */
    process(
        frames: HandFrame[],
        dt: number,
        time = performance.now() / 1000
    ): InteractionEvent[] {

        const events: InteractionEvent[] = [];

        /**
         * runPhase：执行指定阶段的插件
         *
         * 执行规则：
         * - 按 plugins 已排序顺序遍历
         * - enabled === false → 跳过
         * - phase 不匹配 → 跳过
         * - 收集插件返回的所有事件
         */
        const runPhase = (phase: "before" | "main" | "after") => {
            for (const p of this.plugins) {
                if (p.enabled === false) continue;
                if ((p.phase ?? "main") !== phase) continue;

                /**
                 * 插件 update：
                 * - 只接收 frames + 时间上下文
                 * - 返回 InteractionEvent[]
                 */
                events.push(
                    ...p.update(frames, { dt, time })
                );
            }
        };

        // ==========================
        // 三阶段执行顺序（固定）
        // ==========================
        runPhase("before");
        runPhase("main");
        runPhase("after");

        return events;
    }

    /**
     * setPluginEnabled：启用 / 禁用指定插件
     *
     * 用途：
     * - 调试
     * - UI 开关
     * - 动态策略切换
     *
     * 注意：
     * - 只是修改 enabled 标志
     * - 插件实例仍然保留
     */
    public setPluginEnabled(name: string, enabled: boolean) {
        const p = this.plugins.find(p => p.name === name);
        if (p) p.enabled = enabled;
    }

    /**
     * getPlugins：获取当前已加载的插件列表
     *
     * 用途：
     * - UI 展示插件状态
     * - 调试
     *
     * 注意：
     * - 返回的是内部数组引用
     * - 调用方不应随意修改
     */
    public getPlugins() {
        return this.plugins;
    }
}
