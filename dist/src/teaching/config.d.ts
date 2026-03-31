import type { LwbConfig } from "../types.js";
export declare const DEFAULT_CONFIG: LwbConfig;
export declare function loadConfig(filePath: string): Promise<LwbConfig>;
export declare function saveConfig(filePath: string, config: LwbConfig): Promise<void>;
