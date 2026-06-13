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

// ========== PHILIPPINES & GLOBAL NEWS API ==========

// RSS Feeds configuration - PHILIPPINES NEWS
const PHILIPPINES_FEEDS = {
    // Major Philippine News Outlets
    inquirer: 'https://www.inquirer.net/fullfeed/',
    philstar: 'https://www.philstar.com/rss',
    manilaBulletin: 'https://mb.com.ph/feed',
    gmanetwork: 'https://www.gmanetwork.com/news/newsfeed',
    rappler: 'https://www.rappler.com/feed/',
    cnnPH: 'https://www.cnnphilippines.com/rss',
    
    // Philippine Agriculture News
    agriculturePH: 'https://business.inquirer.net/category/agribusiness/feed',
    agricultureBusiness: 'https://www.philstar.com/business/agriculture/feed',
    
    // Philippine Technology News
    techPH: 'https://technology.inquirer.net/feed',
    techNewsPH: 'https://www.philstar.com/technology/feed'
};

// RSS Feeds configuration - GLOBAL NEWS
const GLOBAL_FEEDS = {
    // International News
    bbc: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    reuters: 'https://www.reuters.com/news/archive/worldNews?view=page&output=RSS',
    aljazeera: 'https://www.aljazeera.com/xml/rss/all.xml',
    
    // Global Agriculture News
    agriGlobal: 'https://www.agriculture.com/rss',
    farmingGlobal: 'https://www.farminguk.com/news/feed.xml',
    
    // Global Technology News
    techGlobal: 'https://feeds.feedburner.com/TechCrunch',
    wired: 'https://www.wired.com/feed/rss',
    theVerge: 'https://www.theverge.com/rss/index.xml'
};

// Alternative: Google News RSS (Most Reliable Fallback)
const GOOGLE_NEWS_FEEDS = {
    philippines: 'https://news.google.com/rss/search?q=Philippines&hl=en-PH&gl=PH&ceid=PH:en',
    global: 'https://news.google.com/rss/search?q=world+news&hl=en-US&gl=US&ceid=US:en',
    agriculturePH: 'https://news.google.com/rss/search?q=agriculture+Philippines&hl=en-PH&gl=PH&ceid=PH:en',
    agricultureGlobal: 'https://news.google.com/rss/search?q=global+agriculture+farming&hl=en-US&gl=US&ceid=US:en',
    techPH: 'https://news.google.com/rss/search?q=technology+Philippines&hl=en-PH&gl=PH&ceid=PH:en',
    techGlobal: 'https://news.google.com/rss/search?q=technology+innovation&hl=en-US&gl=US&ceid=US:en',
    climatePH: 'https://news.google.com/rss/search?q=climate+change+Philippines&hl=en-PH&gl=PH&ceid=PH:en',
    farmingPH: 'https://news.google.com/rss/search?q=farming+crops+Philippines&hl=en-PH&gl=PH&ceid=PH:en'
};

// Helper function to fetch RSS and convert to JSON using rss2json API
async function fetchRSSFeed(feedUrl) {
    const rss2jsonProxy = 'https://api.rss2json.com/v1/api.json?rss_url=';
    try {
        const response = await fetch(`${rss2jsonProxy}${encodeURIComponent(feedUrl)}`);
        const data = await response.json();
        return data.status === 'ok' ? data.items : [];
    } catch (error) {
        console.error(`Error fetching RSS feed: ${feedUrl}`, error);
        return [];
    }
}

// ========== PHILIPPINES NEWS ENDPOINTS ==========

// Get Philippines news (all local sources)
app.get('/api/news/philippines/all', async (req, res) => {
    try {
        const categories = Object.keys(GOOGLE_NEWS_FEEDS).filter(key => key.includes('PH') || key === 'philippines');
        const promises = categories.map(async (category) => {
            const articles = await fetchRSSFeed(GOOGLE_NEWS_FEEDS[category]);
            return { category, articles };
        });
        
        const results = await Promise.all(promises);
        
        const allArticles = [];
        results.forEach(result => {
            result.articles.forEach(article => {
                allArticles.push({
                    ...article,
                    sourceCategory: result.category,
                    region: 'Philippines'
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
    const feedMap = {
        'general': GOOGLE_NEWS_FEEDS.philippines,
        'agriculture': GOOGLE_NEWS_FEEDS.agriculturePH,
        'technology': GOOGLE_NEWS_FEEDS.techPH,
        'climate': GOOGLE_NEWS_FEEDS.climatePH,
        'farming': GOOGLE_NEWS_FEEDS.farmingPH
    };
    
    const feedUrl = feedMap[category];
    if (!feedUrl) {
        return res.status(400).json({ error: 'Invalid category. Available: general, agriculture, technology, climate, farming' });
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

// Get global news
app.get('/api/news/global/all', async (req, res) => {
    try {
        const categories = Object.keys(GOOGLE_NEWS_FEEDS).filter(key => !key.includes('PH') && key !== 'philippines');
        const promises = categories.map(async (category) => {
            const articles = await fetchRSSFeed(GOOGLE_NEWS_FEEDS[category]);
            return { category, articles };
        });
        
        const results = await Promise.all(promises);
        
        const allArticles = [];
        results.forEach(result => {
            result.articles.forEach(article => {
                allArticles.push({
                    ...article,
                    sourceCategory: result.category,
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
    const feedMap = {
        'general': GOOGLE_NEWS_FEEDS.global,
        'agriculture': GOOGLE_NEWS_FEEDS.agricultureGlobal,
        'technology': GOOGLE_NEWS_FEEDS.techGlobal
    };
    
    const feedUrl = feedMap[category];
    if (!feedUrl) {
        return res.status(400).json({ error: 'Invalid category. Available: general, agriculture, technology' });
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
        const [philippines, global] = await Promise.all([
            fetch(`${req.protocol}://${req.get('host')}/api/news/philippines/all`).then(r => r.json()),
            fetch(`${req.protocol}://${req.get('host')}/api/news/global/all`).then(r => r.json())
        ]);
        
        res.json({
            success: true,
            philippines: philippines.articles || [],
            global: global.articles || [],
            totalPhilippines: philippines.total || 0,
            totalGlobal: global.total || 0
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== SEARCH NEWS (Philippines specific) ==========
app.get('/api/news/search/:query', async (req, res) => {
    const query = req.params.query;
    const phSearchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+Philippines&hl=en-PH&gl=PH&ceid=PH:en`;
    
    try {
        const articles = await fetchRSSFeed(phSearchUrl);
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

// ========== SERVE PAGES ==========
app.get('/timeline', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'timeline.html'));
});

app.get('/newsfeed', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'newsfeed.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`\n📰 News API Endpoints:`);
    console.log(`  🇵🇭 Philippines News:`);
    console.log(`     GET /api/news/philippines/all`);
    console.log(`     GET /api/news/philippines/general`);
    console.log(`     GET /api/news/philippines/agriculture`);
    console.log(`     GET /api/news/philippines/technology`);
    console.log(`     GET /api/news/philippines/climate`);
    console.log(`     GET /api/news/philippines/farming`);
    console.log(`  🌍 Global News:`);
    console.log(`     GET /api/news/global/all`);
    console.log(`     GET /api/news/global/general`);
    console.log(`     GET /api/news/global/agriculture`);
    console.log(`     GET /api/news/global/technology`);
    console.log(`  🔍 Combined & Search:`);
    console.log(`     GET /api/news/combined`);
    console.log(`     GET /api/news/search/:query`);
});