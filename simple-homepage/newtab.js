// 默认搜索引擎配置
const defaultSearchEngines = [
    {
        name: 'Google',
        url: 'https://www.google.com/search?q=',
        icon: 'https://www.google.com/favicon.ico'
    },
    {
        name: '百度',
        url: 'https://www.baidu.com/s?wd=',
        icon: 'https://www.baidu.com/favicon.ico'
    },
    {
        name: 'Bing',
        url: 'https://www.bing.com/search?q=',
        icon: 'https://www.bing.com/favicon.ico'
    }
];

let currentSearchEngine = 0; // 使用索引来标识当前搜索引擎
let bookmarks = [];
let searchEngines = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadSearchEngines();
    loadBookmarks();
    setupEventListeners();
    initializeTime();
});

// 加载搜索引擎
function loadSearchEngines() {
    chrome.storage.sync.get(['searchEngines', 'currentSearchEngine'], (result) => {
        searchEngines = result.searchEngines || defaultSearchEngines;
        currentSearchEngine = result.currentSearchEngine || 0;
        updateSearchEngineDisplay();
        renderSearchEngines();
    });
}

// 更新搜索引擎显示
function updateSearchEngineDisplay() {
    const img = document.getElementById('currentSearchEngine');
    if (searchEngines[currentSearchEngine]) {
        img.src = searchEngines[currentSearchEngine].icon;
        img.alt = searchEngines[currentSearchEngine].name;
    }
}

// 渲染搜索引擎选项
function renderSearchEngines() {
    const dropdown = document.getElementById('searchEngineDropdown');
    dropdown.innerHTML = '';
    
    searchEngines.forEach((engine, index) => {
        const option = document.createElement('div');
        option.className = 'search-engine-option';
        option.innerHTML = `
            <img src="${engine.icon}" alt="${engine.name}">
            <span>${engine.name}</span>
        `;
        
        option.addEventListener('click', () => {
            currentSearchEngine = index;
            document.getElementById('currentSearchEngine').src = engine.icon;
            saveSearchEngines();
            dropdown.classList.remove('show');
        });
        
        dropdown.appendChild(option);
    });
}

// 加载书签
function loadBookmarks() {
    chrome.storage.sync.get(['bookmarks'], (result) => {
        bookmarks = result.bookmarks || [];
        renderBookmarks();
    });
}

// 缓存图标
async function cacheIcon(url) {
    try {
        const domain = new URL(url).origin;
        const iconUrl = `${domain}/favicon.ico`;
        
        // 尝试获取favicon
        const response = await fetch(iconUrl);
        if (!response.ok) {
            throw new Error('Favicon not found');
        }
        
        // 将图标转换为base64
        const blob = await response.blob();
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });

        return {
            data: base64,
            timestamp: Date.now()
        };
    } catch (error) {
        // 尝试使用Google的favicon服务
        try {
            const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64`;
            const response = await fetch(googleFaviconUrl);
            if (!response.ok) {
                throw new Error('Google favicon not found');
            }
            
            const blob = await response.blob();
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });

            return {
                data: base64,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error fetching Google favicon:', error);
            return null;
        }
    }
}

// 获取图标（从缓存或重新获取）
async function getIcon(url, name) {
    const cacheKey = `icon_${url}`;
    try {
        // 从存储中获取缓存的图标
        const result = await new Promise(resolve => {
            chrome.storage.local.get(cacheKey, (data) => resolve(data[cacheKey]));
        });

        const ONE_DAY = 24 * 60 * 60 * 1000; // 1天的毫秒数
        
        // 如果缓存存在且未过期
        if (result && (Date.now() - result.timestamp) < ONE_DAY) {
            return { type: 'icon', data: result.data };
        }

        // 缓存不存在或已过期，重新获取
        const newIcon = await cacheIcon(url);
        if (newIcon) {
            // 存储新的缓存
            chrome.storage.local.set({ [cacheKey]: newIcon });
            return { type: 'icon', data: newIcon.data };
        }
        
        // 如果无法获取图标，返回文字图标
        return { type: 'text', data: getFirstChar(name) };
    } catch (error) {
        console.error('Error getting icon:', error);
        return { type: 'text', data: getFirstChar(name) };
    }
}

// 获取文字的第一个字符（支持中文和英文）
function getFirstChar(text) {
    if (!text) return '?';
    return text.charAt(0).toUpperCase();
}

// 渲染书签
async function renderBookmarks() {
    const container = document.getElementById('bookmarksContainer');
    container.innerHTML = '';
    
    // 渲染现有书签
    for (let i = 0; i < bookmarks.length; i++) {
        const bookmark = bookmarks[i];
        const div = document.createElement('div');
        div.className = 'bookmark-item';
        
        // 获取图标
        const icon = await getIcon(bookmark.url, bookmark.name);
        const iconContent = icon.type === 'icon' 
            ? `<img src="${icon.data}" alt="${bookmark.name}">`
            : `<div class="text-icon">${icon.data}</div>`;
        
        div.innerHTML = `
            <div class="bookmark-icon-wrapper">
                <a href="${bookmark.url}" class="bookmark-icon">
                    ${iconContent}
                </a>
                <div class="delete-button" data-index="${i}">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
            </div>
            <span class="bookmark-name">${bookmark.name}</span>
        `;

        // 添加悬停计时器
        let hoverTimer;
        const deleteButton = div.querySelector('.delete-button');

        div.querySelector('.bookmark-icon-wrapper').addEventListener('mouseenter', () => {
            hoverTimer = setTimeout(() => {
                deleteButton.classList.add('show');
            }, 1000);
        });

        div.querySelector('.bookmark-icon-wrapper').addEventListener('mouseleave', () => {
            clearTimeout(hoverTimer);
            deleteButton.classList.remove('show');
        });

        // 添加删除事件
        deleteButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const index = parseInt(deleteButton.dataset.index);
            deleteBookmark(index);
        });

        container.appendChild(div);
    }

    // 添加"添加书签"按钮作为最后一个项目
    const addButton = document.createElement('div');
    addButton.className = 'bookmark-item add-bookmark-btn';
    addButton.id = 'addBookmark';
    addButton.innerHTML = `
        <div class="bookmark-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4V20M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </div>
        <span class="bookmark-name">添加书签</span>
    `;
    container.appendChild(addButton);

    // 为新添加的按钮绑定事件
    addButton.addEventListener('click', () => {
        document.getElementById('bookmarkModal').classList.add('show');
        document.getElementById('bookmarkName').focus();
    });
}

// 删除书签
function deleteBookmark(index) {
    const bookmark = bookmarks[index];
    // 删除对应的图标缓存
    chrome.storage.local.remove(`icon_${bookmark.url}`);
    
    bookmarks.splice(index, 1);
    chrome.storage.sync.set({ bookmarks }, () => {
        renderBookmarks();
    });
}

// 设置事件监听器
function setupEventListeners() {
    // 搜索引擎选择器点击事件
    document.getElementById('currentSearchEngine').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('searchEngineDropdown').classList.toggle('show');
    });

    // 点击其他地方时关闭下拉菜单
    document.addEventListener('click', () => {
        document.getElementById('searchEngineDropdown').classList.remove('show');
    });

    // 搜索框回车事件
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                const engine = searchEngines[currentSearchEngine];
                const searchUrl = engine.url + encodeURIComponent(query);
                window.location.href = searchUrl;
            }
        }
    });

    // 取消添加书签
    document.getElementById('cancelBookmark').addEventListener('click', () => {
        closeBookmarkModal();
    });

    // 保存书签
    document.getElementById('saveBookmark').addEventListener('click', saveNewBookmark);

    // 点击模态窗口外部关闭
    document.getElementById('bookmarkModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('bookmarkModal')) {
            closeBookmarkModal();
        }
    });

    // ESC键关闭模态窗口
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeBookmarkModal();
        }
        // Enter键保存书签
        if (e.key === 'Enter' && document.getElementById('bookmarkModal').classList.contains('show')) {
            saveNewBookmark();
        }
    });

    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', (e) => {
        if (!e.target.matches('#currentSearchEngine')) {
            document.getElementById('searchEngineDropdown').classList.remove('show');
        }
    });
}

// 关闭书签模态窗口
function closeBookmarkModal() {
    const modal = document.getElementById('bookmarkModal');
    modal.classList.remove('show');
    document.getElementById('bookmarkName').value = '';
    document.getElementById('bookmarkUrl').value = '';
}

// 保存新书签
function saveNewBookmark() {
    const name = document.getElementById('bookmarkName').value.trim();
    const url = document.getElementById('bookmarkUrl').value.trim();
    
    if (name && url) {
        // 确保URL格式正确
        let formattedUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            formattedUrl = 'https://' + url;
        }

        const bookmark = { url: formattedUrl, name };
        bookmarks.push(bookmark);
        chrome.storage.sync.set({ bookmarks }, () => {
            renderBookmarks();
            closeBookmarkModal();
        });
    }
}

// 更新时间显示
function updateTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('timeDisplay').textContent = `${hours}:${minutes}:${seconds}`;
}

// 初始化时间显示
function initializeTime() {
    updateTime();
    setInterval(updateTime, 1000);
}

// 保存搜索引擎设置
function saveSearchEngines() {
    chrome.storage.sync.set({ 
        searchEngines: searchEngines,
        currentSearchEngine: currentSearchEngine
    });
}
