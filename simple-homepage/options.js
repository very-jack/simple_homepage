// 默认搜索引擎
const defaultSearchEngines = {
    google: {
        name: 'Google',
        url: 'https://www.google.com/search?q=%s',
        icon: 'https://www.google.com/favicon.ico'
    },
    baidu: {
        name: '百度',
        url: 'https://www.baidu.com/s?wd=%s',
        icon: 'https://www.baidu.com/favicon.ico'
    },
    bing: {
        name: 'Bing',
        url: 'https://www.bing.com/search?q=%s',
        icon: 'https://www.bing.com/favicon.ico'
    }
};

// 加载搜索引擎列表
function loadSearchEngines() {
    chrome.storage.sync.get(['searchEngines'], (result) => {
        const searchEngines = result.searchEngines || defaultSearchEngines;
        const container = document.getElementById('searchEngines');
        container.innerHTML = '';
        
        Object.entries(searchEngines).forEach(([key, engine]) => {
            const div = document.createElement('div');
            div.className = 'search-engine-item';
            div.innerHTML = `
                <img src="${engine.icon}" alt="${engine.name}">
                <span>${engine.name}</span>
                <span style="margin-left: 10px; color: #666;">${engine.url}</span>
                <button onclick="deleteSearchEngine('${key}')">删除</button>
            `;
            container.appendChild(div);
        });
    });
}

// 删除搜索引擎
function deleteSearchEngine(key) {
    chrome.storage.sync.get(['searchEngines'], (result) => {
        const searchEngines = result.searchEngines || defaultSearchEngines;
        delete searchEngines[key];
        chrome.storage.sync.set({ searchEngines }, () => {
            loadSearchEngines();
        });
    });
}

// 添加新搜索引擎
document.getElementById('addEngine').addEventListener('click', () => {
    const name = document.getElementById('engineName').value.trim();
    const url = document.getElementById('engineUrl').value.trim();
    const icon = document.getElementById('engineIcon').value.trim();
    
    if (name && url) {
        chrome.storage.sync.get(['searchEngines'], (result) => {
            const searchEngines = result.searchEngines || defaultSearchEngines;
            const key = name.toLowerCase().replace(/\s+/g, '_');
            
            searchEngines[key] = {
                name,
                url,
                icon: icon || `${new URL(url).origin}/favicon.ico`
            };
            
            chrome.storage.sync.set({ searchEngines }, () => {
                loadSearchEngines();
                // 清空输入框
                document.getElementById('engineName').value = '';
                document.getElementById('engineUrl').value = '';
                document.getElementById('engineIcon').value = '';
            });
        });
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', loadSearchEngines);
