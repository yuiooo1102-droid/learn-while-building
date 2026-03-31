export const GOAL_PRESETS = [
    { id: "read-code", label: "Read and understand code", domains: ["Programming Basics", "Code Structure", "Data Types"] },
    { id: "fix-bugs", label: "Fix bugs independently", domains: ["Programming Basics", "Debugging", "Error Handling", "Code Structure"] },
    { id: "add-features", label: "Add features to existing projects", domains: ["Programming Basics", "Web Development", "API", "Database", "Code Structure"] },
    { id: "build-scratch", label: "Build projects from scratch", domains: ["Programming Basics", "Architecture", "DevOps", "Testing", "Web Development"] },
];
export function detectProjectType(files, packageJson) {
    if (files.some(f => f === "pyproject.toml" || f === "setup.py" || f === "requirements.txt"))
        return "python";
    if (files.some(f => f === "Cargo.toml"))
        return "rust";
    if (files.some(f => f === "go.mod"))
        return "go";
    if (packageJson) {
        const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
        if (deps.react || deps.vue || deps.svelte || deps.angular)
            return "web-frontend";
        if (deps.express || deps.fastify || deps.koa || deps.hono)
            return "web-backend";
        return "node";
    }
    return "generic";
}
//# sourceMappingURL=goals.js.map