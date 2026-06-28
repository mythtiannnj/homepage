const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// ========== CONFIG.JSON API ==========
app.get('/api/config', (req, res) => {
    const configPath = path.join(__dirname, 'config.json');
    fs.readFile(configPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to load config' });
        }
        try {
            const jsonData = JSON.parse(data);
            res.json(jsonData);
        } catch (parseErr) {
            res.status(500).json({ error: 'Invalid JSON format' });
        }
    });
});

// ========== EVENTS API ==========
app.get('/api/events', (req, res) => {
    const configPath = path.join(__dirname, 'config.json');
    fs.readFile(configPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to load events' });
        }
        try {
            const jsonData = JSON.parse(data);
            res.json(jsonData.events || []);
        } catch (parseErr) {
            res.status(500).json({ error: 'Invalid JSON format' });
        }
    });
});

// ========== BIBLE VERSE API ==========
app.get('/api/bible/random', async (req, res) => {
    try {
        const response = await fetch('https://bible-api.com/?random=verse&translation=web');
        const data = await response.json();

        res.json({
            success: true,
            reference: data.reference,
            verse: data.text,
            translation: data.translation_name || 'World English Bible'
        });
    } catch (error) {
        console.error('Bible API error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            fallback: {
                reference: "Philippians 4:13",
                verse: "I can do all things through Christ who strengthens me.",
                translation: "World English Bible"
            }
        });
    }
});

// ========== AI ASSISTANT API ==========
app.get('/api/ai/chat', async (req, res) => {
    const prompt = req.query.prompt;
    const userId = req.query.userId || 'portfolio_user';
    
    if (!prompt) {
        return res.status(400).json({ 
            success: false, 
            error: 'Please provide a prompt' 
        });
    }
    
    try {
        const apiUrl = `https://ai-api-khcz.onrender.com/api/chat?prompt=${encodeURIComponent(prompt)}&userId=${encodeURIComponent(userId)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        // Check if the API returned an error
        if (data.error) {
            return res.status(500).json({
                success: false,
                error: data.error
            });
        }
        
        res.json({
            success: true,
            model: data.model || 'gemini-2.5-flash',
            prompt: data.prompt || prompt,
            response: data.response || 'Sorry, I could not generate a response.',
            author: data.author || 'AI Assistant',
            conversation: data.conversation || null
        });
    } catch (error) {
        console.error('AI API error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            fallback: {
                response: "I'm having trouble connecting to my AI service. Please try again later."
            }
        });
    }
});

// ========== PHILIPPINES & GLOBAL NEWS API ==========

// Google News RSS Feeds - PHILIPPINES
const PHILIPPINES_FEEDS = {
    agriculture: 'https://news.google.com/rss/search?q=agriculture+Philippines&hl=en-PH&gl=PH&ceid=PH:en',
    technology: 'https://news.google.com/rss/search?q=technology+Philippines&hl=en-PH&gl=PH&ceid=PH:en',
    climate: 'https://news.google.com/rss/search?q=climate+change+Philippines&hl=en-PH&gl=PH&ceid=PH:en',
    farming: 'https://news.google.com/rss/search?q=farming+crops+Philippines&hl=en-PH&gl=PH&ceid=PH:en'
};

// Google News RSS Feeds - GLOBAL
const GLOBAL_FEEDS = {
    agriculture: 'https://news.google.com/rss/search?q=global+agriculture+farming&hl=en-US&gl=US&ceid=US:en',
    technology: 'https://news.google.com/rss/search?q=technology+innovation+global&hl=en-US&gl=US&ceid=US:en'
};

// Helper function to fetch RSS and convert to JSON using rss2json API
async function fetchRSSFeed(feedUrl) {
    const rss2jsonProxy = 'https://api.rss2json.com/v1/api.json?rss_url=';
    try {
        const response = await fetch(`${rss2jsonProxy}${encodeURIComponent(feedUrl)}`);
        const data = await response.json();

        if (data.status === 'ok' && data.items) {
            // Enhance articles with better image extraction
            const enhancedItems = data.items.map(item => {
                // Try to extract image from various sources
                let imageUrl = null;

                // Check for thumbnail
                if (item.thumbnail) {
                    imageUrl = item.thumbnail;
                }
                // Check enclosure
                else if (item.enclosure && item.enclosure.link) {
                    imageUrl = item.enclosure.link;
                }
                // Extract from description
                else if (item.description) {
                    const imgMatch = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
                    if (imgMatch && imgMatch[1]) {
                        imageUrl = imgMatch[1];
                    }
                }
                // Extract from content
                else if (item.content) {
                    const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
                    if (imgMatch && imgMatch[1]) {
                        imageUrl = imgMatch[1];
                    }
                }

                return {
                    ...item,
                    thumbnail: imageUrl,
                    imageUrl: imageUrl
                };
            });
            return enhancedItems;
        }
        return [];
    } catch (error) {
        console.error(`Error fetching RSS feed: ${feedUrl}`, error);
        return [];
    }
}

// ========== PHILIPPINES NEWS ENDPOINTS ==========

// Get all Philippines news (all categories)
app.get('/api/news/philippines/all', async (req, res) => {
    try {
        const categories = Object.keys(PHILIPPINES_FEEDS);
        const promises = categories.map(async (category) => {
            const articles = await fetchRSSFeed(PHILIPPINES_FEEDS[category]);
            return { category, articles };
        });

        const results = await Promise.all(promises);

        const allArticles = [];
        results.forEach(result => {
            result.articles.forEach(article => {
                allArticles.push({
                    ...article,
                    category: result.category,
                    region: 'Philippines'
                });
            });
        });

        // Sort by publish date (newest first)
        allArticles.sort((a, b) => {
            const dateA = new Date(a.pubDate);
            const dateB = new Date(b.pubDate);
            return dateB - dateA;
        });

        res.json({
            success: true,
            region: 'Philippines',
            categories: results,
            articles: allArticles,
            total: allArticles.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get specific Philippines category news
app.get('/api/news/philippines/:category', async (req, res) => {
    const category = req.params.category;
    const feedUrl = PHILIPPINES_FEEDS[category];

    if (!feedUrl) {
        return res.status(400).json({ 
            error: 'Invalid category. Available: agriculture, technology, climate, farming' 
        });
    }

    try {
        const articles = await fetchRSSFeed(feedUrl);
        res.json({
            success: true,
            region: 'Philippines',
            category: category,
            articles: articles,
            total: articles.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== GLOBAL NEWS ENDPOINTS ==========

// Get all global news
app.get('/api/news/global/all', async (req, res) => {
    try {
        const categories = Object.keys(GLOBAL_FEEDS);
        const promises = categories.map(async (category) => {
            const articles = await fetchRSSFeed(GLOBAL_FEEDS[category]);
            return { category, articles };
        });

        const results = await Promise.all(promises);

        const allArticles = [];
        results.forEach(result => {
            result.articles.forEach(article => {
                allArticles.push({
                    ...article,
                    category: result.category,
                    region: 'Global'
                });
            });
        });

        allArticles.sort((a, b) => {
            const dateA = new Date(a.pubDate);
            const dateB = new Date(b.pubDate);
            return dateB - dateA;
        });

        res.json({
            success: true,
            region: 'Global',
            categories: results,
            articles: allArticles,
            total: allArticles.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get specific global category news
app.get('/api/news/global/:category', async (req, res) => {
    const category = req.params.category;
    const feedUrl = GLOBAL_FEEDS[category];

    if (!feedUrl) {
        return res.status(400).json({ 
            error: 'Invalid category. Available: agriculture, technology' 
        });
    }

    try {
        const articles = await fetchRSSFeed(feedUrl);
        res.json({
            success: true,
            region: 'Global',
            category: category,
            articles: articles,
            total: articles.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== COMBINED NEWS (Philippines + Global) ==========
app.get('/api/news/combined', async (req, res) => {
    try {
        // Fetch Philippines categories
        const phPromises = Object.keys(PHILIPPINES_FEEDS).map(async (category) => {
            const articles = await fetchRSSFeed(PHILIPPINES_FEEDS[category]);
            return articles.map(article => ({
                ...article,
                category: category,
                region: 'Philippines'
            }));
        });

        // Fetch Global categories
        const globalPromises = Object.keys(GLOBAL_FEEDS).map(async (category) => {
            const articles = await fetchRSSFeed(GLOBAL_FEEDS[category]);
            return articles.map(article => ({
                ...article,
                category: category,
                region: 'Global'
            }));
        });

        const phResults = await Promise.all(phPromises);
        const globalResults = await Promise.all(globalPromises);

        const philippines = phResults.flat();
        const global = globalResults.flat();

        // Sort each by date
        philippines.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        global.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        const allArticles = [...philippines, ...global];
        allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        res.json({
            success: true,
            philippines: philippines,
            global: global,
            allArticles: allArticles,
            totalPhilippines: philippines.length,
            totalGlobal: global.length,
            total: allArticles.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== SEARCH NEWS (Philippines specific) ==========
app.get('/api/news/search/:query', async (req, res) => {
    const query = req.params.query;
    const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+Philippines&hl=en-PH&gl=PH&ceid=PH:en`;

    try {
        const articles = await fetchRSSFeed(searchUrl);
        res.json({
            success: true,
            query: query,
            region: 'Philippines',
            articles: articles,
            total: articles.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== HEALTH CHECK ENDPOINT ==========
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        endpoints: {
            config: '/api/config',
            events: '/api/events',
            bible: '/api/bible/random',
            ai: '/api/ai/chat?prompt=your_question&userId=your_id',
            philippines: '/api/news/philippines/:category',
            global: '/api/news/global/:category',
            combined: '/api/news/combined',
            search: '/api/news/search/:query'
        },
        availableCategories: {
            philippines: ['agriculture', 'technology', 'climate', 'farming'],
            global: ['agriculture', 'technology']
        }
    });
});

// ========== SERVE PAGES ==========
app.get('/timeline', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'timeline.html'));
});

app.get('/info', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'info.html'));
});

app.get('/newsfeed', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'newsfeed.html'));
});

app.get('/bible', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'bible.html'));
});

app.get('/ai', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ai.html'));
});

// Catch-all route to serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`\n🤖 AI Assistant API:`);
    console.log(`   GET /api/ai/chat?prompt=Your%20question&userId=your_id`);
    console.log(`\n📖 Bible API:`);
    console.log(`   GET /api/bible/random - Random Bible verse`);
    console.log(`\n📰 News API Endpoints:`);
    console.log(`\n🇵🇭 Philippines News:`);
    console.log(`   GET /api/news/philippines/agriculture`);
    console.log(`   GET /api/news/philippines/technology`);
    console.log(`   GET /api/news/philippines/climate`);
    console.log(`   GET /api/news/philippines/farming`);
    console.log(`   GET /api/news/philippines/all`);
    console.log(`\n🌍 Global News:`);
    console.log(`   GET /api/news/global/agriculture`);
    console.log(`   GET /api/news/global/technology`);
    console.log(`   GET /api/news/global/all`);
    console.log(`\n🔄 Combined:`);
    console.log(`   GET /api/news/combined`);
    console.log(`   GET /api/news/search/:query`);
    console.log(`   GET /api/health`);
    console.log(`\n📄 Pages:`);
    console.log(`   http://localhost:${PORT}/ - Home Page`);
    console.log(`   http://localhost:${PORT}/info - Personal Information`);
    console.log(`   http://localhost:${PORT}/timeline - Events Timeline`);
    console.log(`   http://localhost:${PORT}/newsfeed - News Feed`);
    console.log(`   http://localhost:${PORT}/bible - Bible Verse`);
    console.log(`   http://localhost:${PORT}/ai - AI Assistant\n`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server...');
    process.exit();
});