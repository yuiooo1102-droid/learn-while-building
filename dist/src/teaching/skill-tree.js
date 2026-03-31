export function buildSkillTree(conceptMap, knowledge) {
    const domains = new Map();
    for (const [conceptName, mapping] of Object.entries(conceptMap.concepts)) {
        const state = knowledge.concepts[conceptName];
        const level = state?.level ?? 0;
        const encounters = state?.encounters ?? 0;
        if (!domains.has(mapping.domain))
            domains.set(mapping.domain, new Map());
        const categories = domains.get(mapping.domain);
        if (!categories.has(mapping.category))
            categories.set(mapping.category, []);
        categories.get(mapping.category).push({ name: conceptName, level, encounters });
    }
    const tree = [];
    for (const [domainName, categories] of domains) {
        const categoryNodes = [];
        let domainTotal = 0, domainMax = 0;
        for (const [categoryName, concepts] of categories) {
            const categoryTotal = concepts.reduce((sum, c) => sum + c.level, 0);
            const categoryMax = concepts.length * 3;
            domainTotal += categoryTotal;
            domainMax += categoryMax;
            categoryNodes.push({
                name: categoryName,
                progress: categoryMax > 0 ? Math.round((categoryTotal / categoryMax) * 100) : 0,
                children: [],
                concepts,
            });
        }
        tree.push({
            name: domainName,
            progress: domainMax > 0 ? Math.round((domainTotal / domainMax) * 100) : 0,
            children: categoryNodes,
        });
    }
    tree.sort((a, b) => b.progress - a.progress);
    return tree;
}
//# sourceMappingURL=skill-tree.js.map