import type { HandFrame } from "../input/types/GestureTypes";
import type { InteractionEvent } from "../interaction/InteractionTypes";
import type { GesturePlugin } from "./GesturePlugin";

type PluginModule = {
    default?: new () => GesturePlugin;
    Plugin?: new () => GesturePlugin;
};

export class GestureEngine {
    private plugins: GesturePlugin[] = [];

    constructor() {
        this.loadPlugins();
    }

    private loadPlugins() {
        const modules = import.meta.glob("./plugins/*.ts", { eager: true }) as Record<
            string,
            PluginModule
        >;

        for (const path in modules) {
            const mod = modules[path];
            const PluginClass = mod.default || mod.Plugin;
            if (!PluginClass) continue;

            const instance = new PluginClass();
            this.plugins.push(instance);
        }

        // 按 priority 排序
        this.plugins.sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

        console.table(
            this.plugins.map((p) => ({
                name: p.name,
                priority: p.priority ?? 100,
            }))
        );
    }

    process(frames: HandFrame[], dt: number, time = performance.now() / 1000): InteractionEvent[] {
        const events: InteractionEvent[] = [];

        const runPhase = (phase: "before" | "main" | "after") => {
            for (const p of this.plugins) {
                if (p.enabled === false) continue;
                if ((p.phase ?? "main") !== phase) continue;
                events.push(...p.update(frames, { dt, time }));
            }
        };

        runPhase("before");
        runPhase("main");
        runPhase("after");

        return events;
    }


    public setPluginEnabled(name: string, enabled: boolean) {
        const p = this.plugins.find(p => p.name === name);
        if (p) p.enabled = enabled;
    }

    public getPlugins() {
        return this.plugins;
    }

}
