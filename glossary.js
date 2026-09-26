// ============================================================
// TU DIEN THUAT NGU DA NGANH
//
// BA TANG SO KHOP:
//  1. Muc TOAN chu thuong    -> khong phan biet hoa thuong
//     ("landing page" khop ca "Landing page" o dau cau)
//  2. Muc CO chu hoa         -> phai dung chu hoa
//     ("Excel" khong khop "excel" nghia vuot troi)
//  3. Muc trong RISKY_PROPER -> dung chu hoa VA khong duoc o dau cau
//     ("Notion" giua cau la ten app, dau cau co the la "notion" thuong)
//
// KHONG BAO GIO dua tu don da nghia vao day (make, lead, run, scale,
// model, share, reach, target, value, return, form, pivot...).
// ============================================================

const DEFAULT_NORMALIZE = [
    ["claude'?s\\s+co[-\\s]?work(ing)?", "Claude Cowork"],
    ["claude'?s\\s+code", "Claude Code"],
    ["claude'?s\\s+chat", "Claude Chat"],
    ["claude'?s\\s+desktop", "Claude Desktop"],
    ["claude'?s\\s+master\\s*class", "Claude Masterclass"],
    ["chat\\s*gpt", "ChatGPT"],
    ["google\\s+ad\\s*words", "Google Ads"],
    ["you\\s*tube", "YouTube"],
    ["java\\s*script", "JavaScript"],
    ["type\\s*script", "TypeScript"],
    ["power\\s*point", "PowerPoint"],
    ["word\\s*press", "WordPress"],
    ["v\\s*o\\s*2\\s*max", "VO2 max"],
    ["a\\s*/\\s*b\\s+test(ing)?", "A/B testing"],
    ["six\\s*sigma", "Six Sigma"],
    ["e[-\\s]?commerce", "e-commerce"]
];

// Ten rieng trung tu tieng Anh thong dung.
// Chi bao ve khi nam GIUA cau, bo qua khi dung dau cau.
const RISKY_PROPER = [
    // Ten san pham trung tu tieng Anh thong dung.
    // Chi bao ve khi nam GIUA cau, bo qua khi dung dau cau.
    "Notion", "Slack", "Excel", "Flask", "Llama", "Swift", "Git",
    "Sora", "Bubble", "Framer", "Branch", "Adjust", "Discover",
    "Prime", "Square", "Stripe", "Lever", "Anchor", "Mint",
    // Bo sung sau khi ra soat: deu la ten san pham nhung trung tu thuong
    "Whisper",    // thi tham
    "Rust",       // gi set
    "Polygon",    // hinh da giac
    "Selenium",   // nguyen to selen
    "Asana",      // tu the yoga
    "Amplitude",  // bien do
    "Airflow",    // luong khong khi
    "Postman",    // nguoi dua thu
    "Swagger",    // dang di venh vao
    "Bootstrap",  // dong tu tu luc
    "Replicate",  // dong tu sao chep
    "Snowflake",  // bong tuyet
    "Perplexity"  // su boi roi
];


// ============================================================
// THUAT NGU PHU THUOC NGU CANH
// Chi duoc bao ve khi doan van co dau hieu cua linh vuc do.
// Vi du "agent" trong bai giang AI la AI agent, con trong bai giang
// bao hiem lai la dai ly that va phai de may dich xu ly binh thuong.
// ============================================================
const CONTEXTUAL_TERMS = [
    { term: "agent",       context: ["AI", "LLM", "agentic", "autonomous", "Claude", "GPT", "orchestrat", "tool use", "workflow", "model"] },
    { term: "prompt",      context: ["AI", "LLM", "model", "GPT", "Claude", "token", "engineering", "chatbot"] },
    { term: "token",       context: ["AI", "LLM", "model", "context window", "prompt", "blockchain", "crypto", "wallet", "smart contract"] },
    { term: "embedding",   context: ["AI", "vector", "model", "semantic", "similarity"] },
    { term: "inference",   context: ["AI", "LLM", "model", "GPU", "latency", "deploy"] },
    { term: "hallucination", context: ["AI", "LLM", "model", "GPT", "Claude", "accuracy"] },
    { term: "alignment",   context: ["AI", "LLM", "model", "safety", "RLHF", "human feedback"] },
    { term: "grounding",   context: ["AI", "LLM", "model", "retrieval", "source"] },
    { term: "fine-tune",   context: ["AI", "LLM", "model", "dataset", "training"] },
    { term: "checkpoint",  context: ["AI", "model", "training", "weights"] },
    { term: "impression",  context: ["ad", "campaign", "CTR", "reach", "CPM", "advertis"] },
    { term: "conversion",  context: ["ad", "campaign", "funnel", "landing page", "CTR", "CPA", "marketing"] },
    { term: "funnel",      context: ["marketing", "sales", "conversion", "lead", "campaign"] },
    { term: "churn",       context: ["customer", "subscription", "retention", "SaaS", "revenue"] },
    { term: "wallet",      context: ["crypto", "blockchain", "token", "Bitcoin", "Ethereum", "DeFi"] },
    { term: "mining",      context: ["crypto", "blockchain", "Bitcoin", "hash", "proof of work"] },
    { term: "staking",     context: ["crypto", "blockchain", "token", "yield", "validator"] }
];

const GLOSSARY_GROUPS = {

    tech: {
        label: "Công nghệ và AI",
        terms: [
            // San pham va nen tang
            "Claude Cowork", "Claude Code", "Claude Chat", "Claude Desktop",
            "Claude Masterclass", "Claude Opus", "Claude Sonnet", "Claude Haiku",
            "Claude", "Anthropic", "OpenAI", "ChatGPT", "Gemini", "DeepMind",
            "Llama", "Mistral", "Copilot", "GitHub Copilot", "Midjourney",
            "Stable Diffusion", "DALL-E", "Whisper", "Perplexity", "Hugging Face",
            "LangChain", "LlamaIndex", "Pinecone", "Ollama", "Groq", "Replicate",
            "NVIDIA", "TensorFlow", "PyTorch", "Keras", "scikit-learn",
            "Jupyter Notebook", "Google Colab", "Visual Studio Code",
            "Docker", "Kubernetes", "Terraform", "Ansible", "Jenkins",
            "Amazon Web Services", "Microsoft Azure", "Google Cloud",
            "Cloudflare", "Vercel", "Netlify", "Nginx", "Firebase", "Supabase",
            "MongoDB", "PostgreSQL", "MySQL", "Redis", "Elasticsearch",
            "Kafka", "Apache Spark", "Hadoop", "Airflow", "Snowflake",
            "BigQuery", "Databricks", "GraphQL", "Postman", "Swagger",
            "Node.js", "React.js", "Vue.js", "Django", "Flask", "FastAPI",
            "Next.js", "Tailwind CSS", "Bootstrap", "jQuery",
            "Git", "GitHub", "GitLab", "Bitbucket",
            "Linux", "Ubuntu", "macOS", "Android", "iOS",
            "Python", "JavaScript", "TypeScript", "Kotlin", "Swift", "Rust",
            "Coursera", "Udemy", "edX", "Khan Academy", "YouTube", "LinkedIn",
            "Notion", "Slack", "Figma", "Canva", "Zapier", "Airtable",
            "Trello", "Asana", "Jira", "Google Workspace", "Webflow", "Retool",
            "Microsoft Excel", "Excel", "PowerPoint", "Power BI", "Tableau",
            "Looker Studio", "Shopify", "WordPress", "WooCommerce",
            "Playwright", "Selenium", "Stripe", "Twilio",

            // Viet tat
            "AI", "AGI", "API", "LLM", "MCP", "RAG", "NLP", "CNN", "RNN",
            "GAN", "GPT", "BERT", "GPU", "CPU", "TPU", "RAM", "SSD",
            "HTTP", "HTTPS", "URL", "HTML", "CSS", "SQL", "JSON", "CSV",
            "XML", "YAML", "REST", "SDK", "IDE", "CLI", "GUI", "UI", "UX",
            "SaaS", "PaaS", "IaaS", "VPN", "DNS", "CDN", "SSL", "TLS",
            "SSH", "FTP", "TCP", "DDoS", "MFA", "RBAC", "SRE", "TDD",
            "OOP", "CRUD", "ORM", "DOM", "CORS", "SPA", "PWA", "JWT",
            "OAuth", "IoT", "AR", "VR", "XR", "OCR", "TTS", "ASR", "ETL",
            "CI/CD", "CMS", "CRM", "ERP", "MVP", "QA", "SSO", "MLOps",

            // Cum tu AI
            "machine learning", "deep learning", "neural network",
            "reinforcement learning", "supervised learning",
            "unsupervised learning", "transfer learning",
            "natural language processing", "computer vision",
            "generative ai", "agentic ai", "prompt engineering",
            "large language model", "foundation model", "context window",
            "fine-tuning", "few-shot learning", "zero-shot learning",
            "chain of thought", "vector database", "vector embedding",
            "semantic search", "system prompt", "token limit",
            "multimodal model", "diffusion model", "transformer architecture",
            "attention mechanism", "self-attention", "backpropagation",
            "gradient descent", "loss function", "activation function",
            "batch size", "learning rate", "hyperparameter", "model drift",
            "inference time", "synthetic data", "human in the loop",
            "reinforcement learning from human feedback",
            "guardrails", "temperature setting",

            // Cum tu ky thuat phan mem
            "rate limiting", "load balancing", "microservices",
            "serverless architecture", "container orchestration",
            "continuous integration", "continuous deployment",
            "infrastructure as code", "software development life cycle",
            "refactoring", "regression test", "smoke test",
            "staging environment", "production environment",
            "root cause analysis", "system design", "data structure",
            "time complexity", "space complexity", "garbage collection",
            "race condition", "memory leak", "dependency injection",
            "middleware", "endpoint", "payload", "webhook",
            // Tac nhan AI va quy trinh nhieu tac nhan
            "AI agent", "AI assistant", "autonomous agent", "coding agent",
            "browser agent", "research agent", "agent framework",
            "agent workflow", "agent loop", "agent memory", "agent system",
            "subagent", "agent handoff", "planner executor",
            "multi agent workflow", "agentic workflow", "agentic coding",
            "tool use", "tool calling", "tool schema", "computer use",
            "model context protocol", "MCP server", "MCP client",

            // Lam viec voi mo hinh ngon ngu
            "system message", "user message", "assistant message",
            "prompt template", "prompt injection", "prompt caching",
            "structured output", "JSON mode", "stop sequence",
            "max tokens", "top-k", "top-p", "nucleus sampling",
            "beam search", "greedy decoding", "streaming response",
            "batch inference", "context length", "KV cache",
            "attention head", "tokenizer", "positional encoding",
            "mixture of experts", "vision language model",
            "tree of thought", "self-consistency", "self-critique",
            "reflection pattern", "constitutional AI", "red teaming",
            "jailbreak", "groundedness", "faithfulness",
            "semantic chunking", "reranking", "cosine similarity",
            "similarity search", "vector store", "knowledge graph",
            "LoRA", "PEFT", "quantization", "distillation",
            "model card", "eval harness", "benchmark suite",
            "latent space", "autoencoder", "encoder decoder",
            "sequence to sequence", "speech to text", "text to speech",

            "data pipeline", "pull request", "technical debt",
            "feature flag", "canary release", "blue green deployment",
            "observability", "distributed tracing", "service mesh",
            "event driven architecture", "message queue", "idempotency",
            "graceful degradation", "circuit breaker", "cache invalidation",
            "horizontal scaling", "vertical scaling", "sharding",
            "replication lag", "eventual consistency", "acid transaction",
            "model context protocol", "tool calling", "function calling",
            "retrieval augmented generation", "context engineering",
            "agent orchestration", "multi agent system", "chain of agents",
            "cloud computing", "edge computing", "tech stack",
            "front-end", "back-end", "full-stack",
            "user interface", "user experience", "responsive design",
            "single sign-on", "two-factor authentication"
        ]
    },

    marketing: {
        label: "Marketing và quảng cáo",
        terms: [
            // Nen tang va tinh nang
            "Google Ads", "Google Analytics", "Google Tag Manager",
            "Google Search Console", "Google Merchant Center",
            "Google Shopping", "Google Business Profile", "YouTube Ads",
            "Facebook Ads", "Meta Ads", "Meta Business Suite",
            "TikTok Ads", "TikTok Shop", "LinkedIn Ads", "Microsoft Ads",
            "Amazon Ads", "Pinterest Ads", "Google Ads Editor",
            "Performance Max", "Demand Gen", "Display Network",
            "Search Network", "Smart Bidding", "Target CPA", "Target ROAS",
            "Quality Score", "Ad Rank", "Google Sites", "Hotjar",
            "Mailchimp", "HubSpot", "Salesforce", "Klaviyo", "Semrush",
            "Ahrefs", "Mixpanel", "Amplitude", "Optimizely", "AppsFlyer",
            "Taboola", "Outbrain", "Criteo", "Shopee", "Lazada", "Zalo OA",

            // Viet tat
            "CTR", "CPC", "CPA", "CPM", "CPL", "CPV", "CPI", "eCPM",
            "ROAS", "ROI", "KPI", "CTA", "USP", "UGC", "SERP", "PPC",
            "DSP", "SSP", "RTB", "CAC", "LTV", "CLV", "MRR", "ARR",
            "GA4", "GTM", "UTM", "AOV", "ARPU", "GMV", "RFM", "SOV",
            "TOFU", "MOFU", "BOFU", "MQL", "OOH", "DOOH", "CTV", "OTT",
            "B2B", "B2C", "D2C", "OKR", "AIDA", "STP", "SWOT", "PESTEL",
            "NPS", "CSAT", "CRO", "SEO", "SEM", "SMM", "EDM", "KOL", "KOC",

            // Do luong va toi uu
            "landing page", "landing page optimization", "conversion rate",
            "click-through rate", "cost per click", "cost per acquisition",
            "cost per mille", "return on ad spend", "bounce rate",
            "exit rate", "average order value", "cart abandonment",
            "checkout flow", "conversion window", "conversion tracking",
            "view-through conversion", "assisted conversion",
            "attribution model", "last-click attribution",
            "first-click attribution", "multi-touch attribution",
            "data-driven attribution", "incrementality testing",
            "media mix modeling", "cohort analysis", "retention rate",
            "repeat purchase rate", "heat map", "session recording",
            "scroll depth", "exit intent", "core web vitals", "page speed",

            // Chay quang cao
            "bid strategy", "bid adjustment", "daily budget",
            "lifetime budget", "frequency cap", "ad fatigue",
            "creative testing", "dynamic creative", "audience overlap",
            "seed audience", "interest targeting", "behavioral targeting",
            "geotargeting", "dayparting", "device targeting",
            "impression share", "ad group", "search term",
            "keyword research", "long-tail keyword", "negative keyword",
            "match type", "broad match", "phrase match", "exact match",
            "remarketing", "retargeting", "lookalike audience",
            "custom audience", "product listing ad", "shopping campaign",
            "media buying", "ad creative", "ad copy", "banner ad",
            "native ad", "display ad", "video ad", "carousel ad",
            "programmatic advertising", "demand-side platform",
            "supply-side platform", "real-time bidding", "brand safety",
            "viewability", "ad fraud", "click fraud", "bot traffic",

            // Chien luoc va noi dung
            "marketing funnel", "sales funnel", "conversion funnel",
            "top of funnel", "bottom of funnel", "lead generation",
            "lead magnet", "lead nurturing", "lead scoring",
            "call to action", "a/b testing", "split testing",
            "multivariate testing", "growth hacking",
            "content marketing", "email marketing", "affiliate marketing",
            "influencer marketing", "performance marketing",
            "inbound marketing", "outbound marketing", "viral marketing",
            "account based marketing", "marketing automation",
            "drip campaign", "nurture sequence", "welcome email",
            "abandoned cart email", "push notification", "in-app message",
            "brand awareness", "brand identity", "brand positioning",
            "positioning statement", "tone of voice", "brand guideline",
            "brand lift", "market segmentation", "target audience",
            "buyer persona", "unique selling proposition",
            "value proposition", "product-market fit", "go-to-market",
            "marketing mix", "competitive analysis", "voice of customer",
            "content calendar", "editorial calendar", "evergreen content",
            "pillar content", "topic cluster", "internal linking",
            "search engine optimization", "search engine marketing",
            "technical seo", "on-page seo", "off-page seo", "local seo",
            "schema markup", "featured snippet", "mobile-first indexing",
            "pay per click", "organic traffic", "paid traffic",
            "direct traffic", "referral traffic", "backlink",
            "anchor text", "meta description", "meta title",
            "app store optimization", "deep link", "organic install",
            "word of mouth", "social proof", "user-generated content",
            "customer journey", "customer lifetime value",
            "customer acquisition cost", "monthly recurring revenue",
            "churn rate", "engagement rate", "share of voice",
            "affiliate network", "tracking link", "utm parameter",
            "conversion lag", "attribution window", "smart campaign",
            "responsive search ad", "ad extension", "sitelink extension",
            "callout extension", "structured snippet", "audience signal",
            "customer match", "offline conversion", "enhanced conversion",
            "server side tagging", "first party data", "third party cookie",
            "consent mode", "privacy sandbox", "conversion modeling",
            "creative fatigue", "hook rate", "thumb stop ratio",
            "watch time", "completion rate", "viral coefficient",
            "referral program", "loyalty program", "win back campaign"
        ]
    },

    business: {
        label: "Kinh doanh và tài chính",
        terms: [
            "IPO", "M&A", "EPS", "EBITDA", "EBIT", "NPV", "IRR", "DCF",
            "FCF", "ROE", "ROA", "WACC", "CAGR", "COGS", "SKU", "ETF",
            "OPEX", "CAPEX", "TAM", "SAM", "SOM", "MOIC", "GDP", "FDI",
            "SOP", "PMO", "PMP", "ESG", "CEO", "CFO", "COO", "CTO",
            "CMO", "CIO", "R&D", "MBA", "CFA", "CPA", "P&L",
            "YoY", "MoM", "QoQ",

            "cash flow", "gross margin", "net margin", "operating margin",
            "contribution margin", "operating leverage", "break-even point",
            "economies of scale", "sunk cost", "unit economics",
            "price to earnings ratio", "earnings per share",
            "market capitalization", "mergers and acquisitions",
            "initial public offering", "discounted cash flow",
            "net present value", "internal rate of return",
            "dollar cost averaging", "blue chip", "exchange-traded fund",
            "venture capital", "private equity", "angel investor",
            "seed funding", "due diligence", "term sheet", "cap table",
            "exit strategy", "burn rate", "burn multiple", "runway",
            "convertible note", "vesting schedule", "cliff period",
            "stock option", "equity dilution", "down round", "bridge round",
            "bootstrapping", "rule of 40", "gross merchandise value",
            "take rate", "customer concentration", "moat",
            "flywheel effect", "network effect", "first mover advantage",
            "blue ocean strategy", "porter five forces",
            "value based pricing", "cost plus pricing",
            "penetration pricing", "skimming pricing", "freemium model",
            "subscription model", "marketplace model", "franchise model",
            "white label", "private label", "dropshipping", "e-commerce",
            "just in time", "inventory turnover",
            "days sales outstanding", "quick ratio", "current ratio",
            "debt to equity", "leverage ratio", "accrual accounting",
            "fiscal year", "quarterly report", "annual report",
            "audit trail", "internal control", "transfer pricing",
            "gantt chart", "raci matrix", "lean startup",
            "north star metric", "leading indicator", "lagging indicator",
            "balanced scorecard", "business case", "feasibility study",
            "stakeholder mapping", "risk register", "contingency plan",
            "vendor management", "service level agreement", "scope baseline",
            "earned value", "critical chain", "resource leveling",
            "working backwards", "pre mortem", "postmortem review",
            "minimum viable product", "design thinking", "scope creep"
        ]
    },

    economics: {
        label: "Kinh tế học",
        terms: [
            "GNP", "CPI", "PPI", "PMI", "IMF", "WTO", "OPEC",

            "inflation rate", "stagflation", "interest rate",
            "monetary policy", "fiscal policy", "quantitative easing",
            "supply and demand", "elasticity of demand",
            "price elasticity", "marginal cost", "marginal revenue",
            "marginal utility", "consumer surplus", "producer surplus",
            "deadweight loss", "market equilibrium",
            "perfect competition", "monopolistic competition",
            "externality", "public good", "moral hazard",
            "adverse selection", "information asymmetry",
            "game theory", "nash equilibrium", "prisoner dilemma",
            "comparative advantage", "absolute advantage",
            "balance of trade", "exchange rate",
            "purchasing power parity", "business cycle",
            "gross domestic product", "unemployment rate",
            "labor force participation", "opportunity cost"
        ]
    },

    sales: {
        label: "Bán hàng và chăm sóc khách hàng",
        terms: [
            "BANT", "MEDDIC", "SPIN", "SDR", "BDR", "QBR", "ACV", "ASP",

            "cold call", "cold email", "warm lead", "sales pipeline",
            "pipeline coverage", "deal stage", "discovery call",
            "demo call", "objection handling", "closing technique",
            "upselling", "cross-selling", "consultative selling",
            "solution selling", "value selling", "social selling",
            "key account", "sales enablement", "sales playbook",
            "quota attainment", "win rate", "sales velocity",
            "customer success", "renewal rate", "expansion revenue",
            "net revenue retention", "churn prevention",
            "sales qualified lead", "marketing qualified lead",
            "customer satisfaction score", "net promoter score"
        ]
    },

    hrops: {
        label: "Nhân sự và vận hành",
        terms: [
            "HRM", "HRBP", "HRIS", "ATS", "DEI", "PTO", "PIP", "L&D",
            "Six Sigma", "Kaizen",

            "talent acquisition", "employer branding", "job description",
            "applicant tracking system", "behavioral interview",
            "structured interview", "culture fit", "onboarding",
            "offboarding", "performance review", "360 degree feedback",
            "succession planning", "career path", "compensation package",
            "base salary", "variable pay", "equity compensation",
            "employee engagement", "employee retention", "turnover rate",
            "remote work", "hybrid work", "work life balance",
            "psychological safety", "servant leadership",
            "span of control", "org chart", "cross functional team",
            "standard operating procedure", "continuous improvement",
            "lean manufacturing", "capacity planning",
            "demand forecasting", "inventory management",
            "supply chain management", "third party logistics",
            "last mile delivery", "fulfillment center", "cycle time",
            "lead time", "quality control"
        ]
    },

    data: {
        label: "Dữ liệu và thống kê",
        terms: [
            "EDA", "PCA", "SVM", "KNN", "MSE", "RMSE", "MAE",
            "AUC", "ROC", "ANOVA", "OLAP", "OLS",

            "standard deviation", "normal distribution",
            "probability distribution", "confidence interval",
            "hypothesis testing", "null hypothesis", "p-value",
            "statistical significance", "correlation coefficient",
            "linear regression", "logistic regression",
            "decision tree", "random forest", "gradient boosting",
            "k-means clustering", "principal component analysis",
            "cross-validation", "overfitting", "underfitting",
            "feature engineering", "training set", "test set",
            "validation set", "confusion matrix",
            "precision and recall", "roc curve", "time series",
            "data cleaning", "data wrangling",
            "exploratory data analysis", "descriptive statistics",
            "inferential statistics", "sample size",
            "central limit theorem", "monte carlo simulation",
            "pivot table", "data warehouse", "data lake", "big data",
            "data mart", "star schema", "slowly changing dimension",
            "data governance", "data lineage", "data catalog",
            "master data management", "data quality dimension",
            "imputation", "normalization", "standardization",
            "one hot encoding", "label encoding", "class imbalance",
            "bootstrap sampling", "ensemble method", "bias variance tradeoff",
            "data visualization", "outlier detection",
            "regression to the mean", "selection bias",
            "statistical power", "effect size", "degrees of freedom"
        ]
    },

    health: {
        label: "Sức khỏe và thể dục",
        terms: [
            "VO2 max", "BMI", "BMR", "TDEE", "HIIT", "HRV", "DOMS",
            "RPE", "1RM", "LISS", "EPOC", "LDL", "HDL", "BPM", "REM",

            "body mass index", "basal metabolic rate",
            "total daily energy expenditure", "lean body mass",
            "heart rate variability", "macronutrient", "micronutrient",
            "protein synthesis", "muscle hypertrophy",
            "progressive overload", "eccentric contraction",
            "concentric contraction", "isometric contraction",
            "deload week", "high-intensity interval training",
            "delayed onset muscle soreness", "glycogen depletion",
            "lactate threshold", "insulin sensitivity",
            "intermittent fasting", "metabolic syndrome",
            "foam rolling", "core stability", "time under tension",
            "rep range", "training split", "push pull legs",
            "mind muscle connection", "anabolic window",
            "muscle protein synthesis", "caloric maintenance",
            "reverse dieting", "body recomposition",
            "training frequency", "volume landmark", "maintenance volume",
            "minimum effective volume", "maximum recoverable volume",
            "rate of perceived exertion", "autoregulation",
            "periodization", "block periodization", "linear progression",
            "double progression", "accessory movement", "prime mover",
            "antagonist muscle", "posterior chain", "anterior chain",
            "energy system", "creatine monohydrate", "beta alanine",
            "electrolyte balance", "hydration status", "sleep debt"
        ]
    },

    medicine: {
        label: "Y khoa và sinh học",
        terms: [
            "DNA", "RNA", "mRNA", "PCR", "MRI", "ECG", "EEG",
            "WHO", "CDC", "FDA", "IVF", "HIV",

            "randomized controlled trial", "double blind study",
            "placebo effect", "clinical trial", "peer reviewed",
            "meta analysis", "systematic review", "control group",
            "treatment group", "informed consent", "side effect",
            "contraindication", "immune system", "gene expression",
            "stem cell", "evidence based medicine",
            "differential diagnosis", "chronic disease",
            "acute condition", "herd immunity", "incubation period",
            "mortality rate", "morbidity rate", "life expectancy",
            "public health", "gut microbiome", "inflammation marker"
        ]
    },

    crypto: {
        label: "Blockchain và tiền số",
        terms: [
            "Bitcoin", "Ethereum", "Solana", "Binance", "Coinbase",
            "Metamask", "Uniswap", "Chainlink", "Polygon",
            "BTC", "ETH", "DeFi", "NFT", "DAO", "DEX", "CEX",
            "TVL", "APY", "APR", "KYC", "AML", "P2P", "ICO",

            "blockchain", "smart contract", "proof of work",
            "proof of stake", "consensus mechanism", "private key",
            "public key", "cold wallet", "hot wallet", "gas fee",
            "liquidity pool", "yield farming", "staking reward",
            "market maker", "order book", "stablecoin", "tokenomics",
            "whitepaper", "airdrop", "rug pull", "bitcoin halving",
            "hash rate", "layer two", "cross chain", "bridge protocol"
        ]
    },

    psychology: {
        label: "Tâm lý và giáo dục",
        terms: [
            "CBT", "IQ", "EQ", "ADHD", "MBTI", "PTSD", "OCD",
            "GPA", "MOOC", "LMS", "STEM",
            "Dunning-Kruger", "Maslow", "Big Five",

            "cognitive behavioral therapy", "growth mindset",
            "fixed mindset", "spaced repetition", "active recall",
            "deliberate practice", "flow state", "cognitive load",
            "confirmation bias", "cognitive dissonance",
            "anchoring bias", "survivorship bias", "sunk cost fallacy",
            "availability heuristic", "framing effect", "loss aversion",
            "imposter syndrome", "emotional intelligence",
            "self-efficacy", "intrinsic motivation",
            "extrinsic motivation", "socratic method",
            "blended learning", "flipped classroom",
            "formative assessment", "summative assessment",
            "feedback loop", "bloom taxonomy",
            "metacognition", "retrieval practice", "interleaved practice"
        ]
    },

    design: {
        label: "Thiết kế và truyền thông",
        terms: [
            "RGB", "CMYK", "HEX", "DPI", "PPI", "SVG", "PNG",
            "JPEG", "GIF", "MP4", "FPS", "HDR",

            "wireframe", "mockup", "design system", "style guide",
            "typography", "visual hierarchy", "usability testing",
            "information architecture", "user flow",
            "customer journey map", "vector graphic", "raster image",
            "color grading", "motion graphics", "rule of thirds",
            "above the fold", "negative space", "kerning",
            "leading and tracking", "serif and sans serif",
            "accessibility standard", "contrast ratio", "design token",
            "atomic design", "responsive breakpoint"
        ]
    },

    academic: {
        label: "Học thuật và nghiên cứu",
        terms: [
            "APA", "MLA", "IEEE", "DOI", "ISBN", "ISSN", "IRB",
            "PhD", "MSc", "BSc",

            "literature review", "research question", "research gap",
            "theoretical framework", "conceptual framework",
            "independent variable", "dependent variable",
            "control variable", "confounding variable",
            "qualitative research", "quantitative research",
            "mixed methods", "primary source", "secondary source",
            "citation style", "in-text citation", "reference list",
            "peer reviewed journal", "impact factor", "h-index",
            "thesis statement", "research proposal", "cohort study",
            "longitudinal study", "cross-sectional study",
            "case control study", "focus group", "likert scale",
            "construct validity", "internal validity",
            "external validity", "grounded theory", "content analysis",
            "thematic analysis", "triangulation", "saturation point",
            "ethical approval", "sampling frame", "random sampling",
            "stratified sampling", "convenience sampling",
            "response rate", "pilot study", "open access"
        ]
    },

    cybersecurity: {
        label: "An ninh mạng",
        terms: [
            "SOC", "SIEM", "IDS", "WAF", "EDR", "XDR", "MITM",
            "APT", "CVE", "CVSS", "OWASP", "PKI", "IAM", "SASE",

            "phishing", "spear phishing", "ransomware", "malware",
            "spyware", "keylogger", "botnet", "zero day", "zero trust",
            "penetration testing", "red team", "blue team",
            "threat modeling", "attack surface", "social engineering",
            "brute force attack", "sql injection",
            "cross site scripting", "man in the middle",
            "denial of service", "security audit", "incident response",
            "vulnerability scan", "patch management",
            "end to end encryption", "hashing algorithm",
            "digital signature", "certificate authority",
            "security token", "threat intelligence", "security posture"
        ]
    },

    sustainability: {
        label: "Môi trường và bền vững",
        terms: [
            "SDG", "GHG", "LCA", "EPR",

            "carbon footprint", "carbon neutral", "net zero",
            "carbon offset", "carbon credit", "circular economy",
            "linear economy", "life cycle assessment", "greenwashing",
            "sustainable development", "waste management",
            "energy efficiency", "supply chain transparency",
            "fair trade", "social impact", "impact investing",
            "triple bottom line", "stakeholder capitalism",
            "science based target", "scope one emissions",
            "scope two emissions", "scope three emissions"
        ]
    },

    realestate: {
        label: "Bất động sản",
        terms: [
            "REIT", "NOI", "HOA",

            "cap rate", "net operating income", "gross rental yield",
            "net rental yield", "cash on cash return", "loan to value",
            "debt service coverage ratio", "amortization schedule",
            "escrow", "title deed", "leasehold", "freehold", "zoning",
            "closing cost", "mortgage rate", "fixed rate mortgage",
            "adjustable rate mortgage", "refinancing", "equity release",
            "property management", "vacancy rate", "tenant turnover",
            "capital appreciation", "mixed use development",
            "gross floor area", "net usable area", "master plan"
        ]
    },

    legal: {
        label: "Pháp lý và chính sách",
        terms: [
            "NDA", "GDPR", "CCPA", "SLA", "LLC", "EULA", "DMCA", "CSR",

            "intellectual property", "fair use", "licensing agreement",
            "non-disclosure agreement", "terms of service",
            "force majeure", "statute of limitations",
            "corporate social responsibility", "compliance program",
            "data processing agreement", "right to be forgotten",
            "cookie consent", "legal liability", "indemnification"
        ]
    }
};

const DEFAULT_ENABLED_GROUPS = Object.keys(GLOSSARY_GROUPS);

// Same three-way export as the other modules: page (window), service worker (globalThis), Node tests
const CST_GLOSSARY_API = {
    CST_GLOSSARY_GROUPS: GLOSSARY_GROUPS,
    CST_DEFAULT_NORMALIZE: DEFAULT_NORMALIZE,
    CST_DEFAULT_ENABLED_GROUPS: DEFAULT_ENABLED_GROUPS,
    CST_RISKY_PROPER: RISKY_PROPER,
    CST_CONTEXTUAL_TERMS: CONTEXTUAL_TERMS
};
if (typeof globalThis !== "undefined") Object.assign(globalThis, CST_GLOSSARY_API);
if (typeof window !== "undefined" && window !== globalThis) Object.assign(window, CST_GLOSSARY_API);
if (typeof module === "object" && module.exports) module.exports = CST_GLOSSARY_API;
