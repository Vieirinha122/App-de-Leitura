import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const sources = [
    { name: 'Simon Willison', url: 'https://simonwillison.net', feedUrl: 'https://simonwillison.net/atom/everything/', type: 'rss' },
    { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog', feedUrl: 'https://huggingface.co/blog/rss.xml', type: 'rss' },
    { name: 'Ahead of AI', url: 'https://magazine.sebastianraschka.com', feedUrl: 'https://magazine.sebastianraschka.com/feed', type: 'rss' },
    { name: 'The Batch', url: 'https://www.deeplearning.ai/the-batch/', feedUrl: 'https://www.deeplearning.ai/the-batch/feed/', type: 'rss' },
    { name: 'Martin Fowler', url: 'https://martinfowler.com', feedUrl: 'https://martinfowler.com/feed.atom', type: 'rss' },
    { name: 'InfoQ', url: 'https://www.infoq.com', feedUrl: 'https://feed.infoq.com', type: 'rss' },
    { name: 'Latent Space', url: 'https://www.latent.space', feedUrl: 'https://www.latent.space/feed', type: 'rss' },
    { name: 'Aeon', url: 'https://aeon.co', feedUrl: 'https://aeon.co/feed.rss', type: 'rss' }
];
const categories = [
    'Programação',
    'Engenharia de Software',
    'AI Engineering',
    'Machine Learning',
    'LLMs',
    'Ciência',
    'Ideias'
];
const mockArticles = [
    // Simon Willison
    { title: 'Building a semantic search engine with SQLite and embeddings', source: 'Simon Willison', category: 'AI Engineering', readingTime: 8, tags: ['sqlite', 'embeddings', 'search'] },
    { title: 'How I use LLMs for coding', source: 'Simon Willison', category: 'LLMs', readingTime: 12, tags: ['llm', 'coding', 'productivity'] },
    { title: 'Datasette 1.0: An open source multi-tool for exploring and publishing data', source: 'Simon Willison', category: 'Engenharia de Software', readingTime: 10, tags: ['datasette', 'open-source', 'data'] },
    // Hugging Face Blog
    { title: 'Introducing SmolLM2: Small language models that punch above their weight', source: 'Hugging Face Blog', category: 'LLMs', readingTime: 6, tags: ['sml', 'small-models', 'huggingface'] },
    { title: 'Fine-tuning vision transformers with PEFT and LoRA', source: 'Hugging Face Blog', category: 'Machine Learning', readingTime: 15, tags: ['vit', 'peft', 'lora', 'fine-tuning'] },
    { title: 'Building multimodal RAG systems with ColPali', source: 'Hugging Face Blog', category: 'AI Engineering', readingTime: 10, tags: ['rag', 'multimodal', 'colpali'] },
    // Ahead of AI
    { title: 'Understanding Reasoning in LLMs: Chain-of-Thought and Beyond', source: 'Ahead of AI', category: 'LLMs', readingTime: 18, tags: ['reasoning', 'cot', 'llm'] },
    { title: 'Mixture of Experts (MoE) Models Explained', source: 'Ahead of AI', category: 'Machine Learning', readingTime: 14, tags: ['moe', 'architecture', 'ml'] },
    { title: 'Efficient Training of Large Language Models', source: 'Ahead of AI', category: 'Machine Learning', readingTime: 20, tags: ['training', 'efficiency', 'llm'] },
    // The Batch
    { title: 'AI agents that can use computers', source: 'The Batch', category: 'AI Engineering', readingTime: 8, tags: ['agents', 'computer-use', 'automation'] },
    { title: 'New benchmarks for evaluating LLM reasoning', source: 'The Batch', category: 'LLMs', readingTime: 7, tags: ['benchmarks', 'reasoning', 'evaluation'] },
    { title: 'The state of open-source AI in 2024', source: 'The Batch', category: 'Ideias', readingTime: 12, tags: ['open-source', 'ai-landscape', '2024'] },
    // Martin Fowler
    { title: 'Refactoring: The Long Method smell', source: 'Martin Fowler', category: 'Engenharia de Software', readingTime: 10, tags: ['refactoring', 'code-smells', 'clean-code'] },
    { title: 'Microservices vs Monolith: A decision framework', source: 'Martin Fowler', category: 'Engenharia de Software', readingTime: 15, tags: ['microservices', 'monolith', 'architecture'] },
    { title: 'Continuous Delivery vs Continuous Deployment', source: 'Martin Fowler', category: 'Engenharia de Software', readingTime: 8, tags: ['ci-cd', 'deployment', 'delivery'] },
    // InfoQ
    { title: 'Platform Engineering: Building Internal Developer Platforms', source: 'InfoQ', category: 'Engenharia de Software', readingTime: 12, tags: ['platform-engineering', 'idp', 'devops'] },
    { title: 'Rust in Production: Lessons from 3 Years at Scale', source: 'InfoQ', category: 'Programação', readingTime: 14, tags: ['rust', 'production', 'systems'] },
    { title: 'Observability Patterns for Distributed Systems', source: 'InfoQ', category: 'Engenharia de Software', readingTime: 10, tags: ['observability', 'distributed-systems', 'monitoring'] },
    // Latent Space
    { title: 'The Rise of AI-Native Applications', source: 'Latent Space', category: 'AI Engineering', readingTime: 16, tags: ['ai-native', 'applications', 'future'] },
    { title: 'Vector Databases Compared: Pinecone vs Weaviate vs Qdrant', source: 'Latent Space', category: 'AI Engineering', readingTime: 12, tags: ['vector-db', 'comparison', 'rag'] },
    { title: 'Evaluating RAG Systems: Beyond Recall@K', source: 'Latent Space', category: 'AI Engineering', readingTime: 15, tags: ['rag', 'evaluation', 'metrics'] },
    // Aeon
    { title: 'Why we still don\'t understand how general anesthesia works', source: 'Aeon', category: 'Ciência', readingTime: 18, tags: ['neuroscience', 'anesthesia', 'consciousness'] },
    { title: 'The strange physics of time crystals', source: 'Aeon', category: 'Ciência', readingTime: 12, tags: ['physics', 'time-crystals', 'quantum'] },
    { title: 'How language shapes the way we think', source: 'Aeon', category: 'Ideias', readingTime: 14, tags: ['linguistics', 'cognition', 'culture'] },
    { title: 'The philosophy of effective altruism', source: 'Aeon', category: 'Ideias', readingTime: 16, tags: ['philosophy', 'altruism', 'ethics'] },
    { title: 'What ancient DNA tells us about human migration', source: 'Aeon', category: 'Ciência', readingTime: 14, tags: ['genetics', 'anthropology', 'history'] }
];
async function main() {
    console.log('🌱 Starting seed...');
    // Create categories
    console.log('📂 Creating categories...');
    for (const catName of categories) {
        await prisma.category.upsert({
            where: { name: catName },
            update: {},
            create: { name: catName }
        });
    }
    console.log('✅ Categories created');
    // Create sources
    console.log('📰 Creating sources...');
    for (const source of sources) {
        await prisma.source.upsert({
            where: { name: source.name },
            update: {},
            create: source
        });
    }
    console.log('✅ Sources created');
    // Get category and source IDs
    const categoryMap = new Map();
    const categoriesDb = await prisma.category.findMany();
    for (const cat of categoriesDb) {
        categoryMap.set(cat.name, cat.id);
    }
    const sourceMap = new Map();
    const sourcesDb = await prisma.source.findMany();
    for (const src of sourcesDb) {
        sourceMap.set(src.name, src.id);
    }
    // Create articles
    console.log('📝 Creating articles...');
    let created = 0;
    for (const article of mockArticles) {
        const categoryId = categoryMap.get(article.category);
        const sourceId = sourceMap.get(article.source);
        if (!categoryId || !sourceId) {
            console.warn(`⚠️ Skipping article "${article.title}" - missing category or source`);
            continue;
        }
        const publishedAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Random within last 30 days
        await prisma.article.upsert({
            where: { url: `https://example.com/article/${created + 1}` },
            update: {},
            create: {
                title: article.title,
                url: `https://example.com/article/${created + 1}`,
                summary: `Resumo do artigo: ${article.title}. Este é um resumo gerado automaticamente para o seed do Daily Read.`,
                readingTimeMinutes: article.readingTime,
                publishedAt,
                collectedAt: new Date(),
                status: 'new',
                tags: article.tags,
                sourceId,
                categoryId
            }
        });
        created++;
    }
    console.log(`✅ ${created} articles created`);
    console.log('🎉 Seed completed!');
}
main()
    .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map