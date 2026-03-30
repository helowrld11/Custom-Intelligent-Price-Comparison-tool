document.addEventListener('DOMContentLoaded', () => {
    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-container');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show view
            const viewId = item.getAttribute('data-view');
            views.forEach(view => {
                view.classList.remove('active');
                if (view.id === `view-${viewId}`) {
                    view.classList.add('active');
                }
            });

            // If switching to products view, refresh list
            if (viewId === 'products') {
                loadProducts();
            } else if (viewId === 'dashboard') {
                loadDashboardData();
            }
        });
    });

    // Add Product Logic
    const btnAddProduct = document.getElementById('btn-add-product');
    const inputProductUrl = document.getElementById('add-product-url');
    const suggestionsContainer = document.getElementById('search-suggestions');
    let suggestionTimeout = null;

    inputProductUrl.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (suggestionTimeout) clearTimeout(suggestionTimeout);
        
        if (val.length < 2) {
            suggestionsContainer.style.display = 'none';
            return;
        }

        suggestionTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`http://localhost:5000/api/suggestions?q=${encodeURIComponent(val)}`);
                const data = await res.json();
                
                if (data && data.length > 0) {
                    suggestionsContainer.innerHTML = data.map(term => `
                        <div class="suggestion-item">${term}</div>
                    `).join('');
                    suggestionsContainer.style.display = 'block';

                    // Bind clicks
                    document.querySelectorAll('.suggestion-item').forEach(item => {
                        item.addEventListener('click', () => {
                            inputProductUrl.value = item.textContent;
                            suggestionsContainer.style.display = 'none';
                            btnAddProduct.click(); // Auto search
                        });
                    });
                } else {
                    suggestionsContainer.style.display = 'none';
                }
            } catch (err) {
                console.error('Suggestions error:', err);
                suggestionsContainer.style.display = 'none';
            }
        }, 300); // 300ms debounce
    });

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-bar')) {
            suggestionsContainer.style.display = 'none';
        }
    });

    btnAddProduct.addEventListener('click', async () => {
        const query = inputProductUrl.value.trim();
        if (!query) return alert('Please enter a name or URL');
        suggestionsContainer.style.display = 'none';

        const prevText = btnAddProduct.innerHTML;
        btnAddProduct.innerHTML = '<span class="spinner"></span> Searching...';
        btnAddProduct.disabled = true;

        try {
            const res = await fetch('http://localhost:5000/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const data = await res.json();
            
            if (res.ok) {
                openSearchModal(data, query);
            } else {
                alert(data.error || 'Failed to search product');
            }
        } catch (err) {
            console.error(err);
            alert('Server error while searching product.');
        } finally {
            btnAddProduct.innerHTML = prevText;
            btnAddProduct.disabled = false;
        }
    });

    // Close Modals when clicking outside
    const modal = document.getElementById('product-modal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    const searchModal = document.getElementById('search-modal');
    searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
            searchModal.classList.remove('active');
            inputProductUrl.value = ''; // clear input
            loadDashboardData();
        }
    });

    // Initial Load
    loadDashboardData();
});

let currentChart = null;

async function addToTracking(productData) {
    try {
        // if productData is string, handle it
        if (typeof productData === 'string') {
             productData = { url: productData };
        }
        await fetch('http://localhost:5000/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
    } catch (err) {
        console.error(err);
    }
}

function openSearchModal(data, query) {
    const modal = document.getElementById('search-modal');
    const content = document.getElementById('search-modal-content');
    
    let html = `
        <h2 style="margin-bottom: 16px;">Price Comparison for "${query}"</h2>
        <div style="background: rgba(16,185,129,0.1); border: 1px solid var(--success-color); padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <h3 style="color: var(--success-color); margin-bottom: 8px;">Cheapest Deal Found!</h3>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: bold; font-size: 18px;">${data.cheapest.source}</div>
                    <div style="color: var(--text-secondary); font-size: 14px;">${data.cheapest.name}</div>
                </div>
                <div style="font-size: 28px; font-weight: 700; color: var(--primary-color);">₹${data.cheapest.price.toFixed(0)}</div>
            </div>
            <button class="btn btn-primary btn-track-best" style="margin-top: 16px; width: 100%;">Track Best Deal</button>
        </div>
        
        <h3 style="margin-bottom: 12px; font-size: 16px;">All Retailers</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
    `;
    
    data.comparison.forEach(item => {
        html += `
            <div class="glass-panel" style="padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: bold;">${item.source}</div>
                    <div style="color: var(--text-secondary); font-size: 12px;">₹${item.price.toFixed(0)}</div>
                </div>
                <button class="btn btn-primary btn-track-item" style="padding: 6px 16px; font-size: 13px;">Track This</button>
            </div>
        `;
    });
    
    html += `</div>`;
    
    content.innerHTML = html;
    modal.classList.add('active');
    
    // Bind track best deal button
    content.querySelector('.btn-track-best').addEventListener('click', async (e) => {
        const prevText = e.target.innerHTML;
        e.target.innerHTML = 'Tracking...';
        e.target.disabled = true;
        await addToTracking({
            url: data.cheapest.url,
            name: data.cheapest.name,
            price: data.cheapest.price,
            source: data.cheapest.source
        });
        e.target.innerHTML = 'Tracked!';
        e.target.style.background = 'var(--success-color)';
    });

    // Bind individual track buttons
    content.querySelectorAll('.btn-track-item').forEach((btn, idx) => {
        btn.addEventListener('click', async (e) => {
            const itemData = data.comparison[idx];
            e.target.innerHTML = 'Tracking...';
            e.target.disabled = true;
            await addToTracking({
                url: itemData.url,
                name: itemData.name,
                price: itemData.price,
                source: itemData.source
            });
            e.target.innerHTML = 'Tracked!';
            e.target.style.background = 'var(--success-color)';
        });
    });
}

async function loadDashboardData() {
    try {
        const res = await fetch('http://localhost:5000/api/dashboard');
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById('stat-total').innerText = data.totalProducts || 0;
        document.getElementById('stat-alerts').innerText = data.activeAlerts || 0;
        document.getElementById('stat-buy').innerText = data.buyRecommendations || 0;

        renderDashboardProducts(data.recentProducts || []);
        renderInsights(data.insights || []);
    } catch (err) {
        console.error("Dashboard Load Error: ", err);
    }
}

async function loadProducts() {
    try {
        const res = await fetch('http://localhost:5000/api/products');
        if (!res.ok) return;
        const products = await res.json();
        
        const grid = document.getElementById('all-products-grid');
        grid.innerHTML = '';
        
        if (products.length === 0) {
            grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">No products found.</div>';
            return;
        }

        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card glass-panel';
            const price = p.current_price ? `₹${parseFloat(p.current_price).toFixed(0)}` : 'N/A';
            const recc = p.recommendation || 'Wait';
            const confidenceStyles = recc.includes('Buy') ? 'color: var(--success-color)' : 'color: var(--warning-color)';
            
            card.innerHTML = `
                <div class="p-name" title="${p.name}">${p.name_short || p.name || 'Unknown Product'}</div>
                <div class="p-price">${price}</div>
                <div class="p-meta">
                    <span style="font-weight: 600; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1);">${p.source || 'Website'}</span>
                    <span style="${confidenceStyles}; font-weight: bold;">${recc}</span>
                </div>
                <div style="font-size: 12px; margin-top: 6px; color: var(--text-secondary);">Deal Quality Score: <strong style="color:var(--text-color)">${p.deal_score || 0}/100</strong></div>
                
                <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 12px;">
                    <a href="${p.url}" target="_blank" class="btn btn-primary" style="padding: 6px; font-size: 13px; text-decoration: none; text-align: center; display: block;" onclick="event.stopPropagation()">Go To Store 🔗</a>
                    <a href="https://www.amazon.in/s?k=${encodeURIComponent(p.name_short)}" target="_blank" class="btn" style="background:var(--card-bg); color:var(--text-secondary); padding: 4px; font-size: 11px; display: block; text-align: center; text-decoration: none; border: 1px solid var(--border-color);" onclick="event.stopPropagation()">Search on Amazon</a>
                    <a href="https://www.flipkart.com/search?q=${encodeURIComponent(p.name_short)}" target="_blank" class="btn" style="background:var(--card-bg); color:var(--text-secondary); padding: 4px; font-size: 11px; display: block; text-align: center; text-decoration: none; border: 1px solid var(--border-color);" onclick="event.stopPropagation()">Search on Flipkart</a>
                </div>
                ${p.reason ? `<div class="ai-reason" style="margin-top:8px;">${p.reason}</div><div style="font-size: 10px; color: var(--text-secondary); margin-top:4px; font-style: italic;">${p.confidence}</div>` : ''}
            `;
            
            card.addEventListener('click', () => openProductDetail(p.id));
            grid.appendChild(card);
        });
    } catch (err) {
        console.error("Products Load Error: ", err);
    }
}

function renderDashboardProducts(products) {
    const list = document.getElementById('dashboard-product-list');
    list.innerHTML = '';
    
    if (products.length === 0) {
        list.innerHTML = '<div class="empty-state">No products tracked yet. Add one above!</div>';
        return;
    }

    products.forEach(p => {
        const item = document.createElement('div');
        item.style.padding = '12px 0';
        item.style.borderBottom = '1px solid var(--border-color)';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        
        const price = p.current_price ? `₹${parseFloat(p.current_price).toFixed(0)}` : 'N/A';
        item.innerHTML = `
            <div>
                <a href="${p.url}" target="_blank" style="font-weight: 500; color: inherit; text-decoration: none; cursor: pointer;">
                    ${p.name_short || p.name || 'Unknown Product'} 🔗
                </a>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top:2px;">${p.source || 'Website'}</div>
            </div>
            <div style="font-weight: 700; color: var(--primary-color);">${price}</div>
        `;
        list.appendChild(item);
    });
}

function renderInsights(insights) {
    const list = document.getElementById('dashboard-insights-list');
    list.innerHTML = '';
    
    if (insights.length === 0) {
        list.innerHTML = '<div class="empty-state">Not enough data to generate AI insights yet.</div>';
        return;
    }

    insights.forEach(i => {
        const item = document.createElement('div');
        item.style.padding = '12px';
        item.style.marginBottom = '12px';
        item.style.borderRadius = '8px';
        item.style.background = 'rgba(255,255,255,0.05)';
        item.style.borderLeft = i.recommendation === 'Buy' ? '4px solid var(--success-color)' : '4px solid var(--warning-color)';
        
        item.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">${i.product_name || 'Product'}</div>
            <div style="font-size: 13px; margin-bottom: 8px;">${i.reason || 'Price updated.'}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">Deal Quality Score: <strong style="color:var(--text-color)">${i.deal_score || 0}/100</strong></div>
            <span class="badge" style="background: ${i.recommendation.includes('Buy') ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}; color: ${i.recommendation.includes('Buy') ? 'var(--success-color)' : 'var(--warning-color)'}; border-color: transparent;">Action: ${i.recommendation}</span>
            <div style="margin-top: 6px; font-size: 11px; font-style: italic; color: #64748b; line-height: 1.3;">Confidence Indicator: ${i.confidence}</div>
        `;
        list.appendChild(item);
    });
}

async function openProductDetail(id) {
    try {
        const res = await fetch(`http://localhost:5000/api/products/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        
        const modal = document.getElementById('product-modal');
        const content = document.getElementById('product-modal-content');
        
        const price = data.current_price ? `₹${parseFloat(data.current_price).toFixed(0)}` : 'N/A';
        
        content.innerHTML = `
            <h2 style="margin-bottom: 8px;">${data.name}</h2>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div style="font-size: 32px; font-weight: 700; color: var(--primary-color);">${price}</div>
                <a href="${data.url}" target="_blank" class="btn btn-primary" style="text-decoration: none;">View Original</a>
            </div>
            
            <div class="chart-container">
                <canvas id="price-chart"></canvas>
            </div>
            
            ${data.recommendation ? `
            <div style="padding: 16px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-top: 16px;">
                <h3 style="font-size: 14px; margin-bottom: 8px; color: var(--text-secondary);">AI Recommendation Dashboard</h3>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: bold; font-size: 16px; color: ${data.recommendation.includes('Buy') ? 'var(--success-color)' : 'var(--warning-color)'}">${data.recommendation}</div>
                    <div style="font-weight: bold; font-size: 14px;">Deal Score: ${data.deal_score || 0}/100</div>
                </div>
                <div style="font-size: 13px; margin-top: 8px;">${data.reason || ''}</div>
                <div style="font-size: 11px; margin-top: 8px; font-style: italic; color: var(--text-secondary); line-height: 1.3;">Confidence Indicator: ${data.confidence}</div>
            </div>
            ` : ''}
        `;
        
        modal.classList.add('active');
        
        // Render Chart
        if (data.history && data.history.length > 0) {
            renderChart(data.history);
        }
    } catch (err) {
        console.error("Error fetching details: ", err);
    }
}

function renderChart(history) {
    const ctx = document.getElementById('price-chart').getContext('2d');
    
    // Sort chronologically
    history.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    const labels = history.map(h => {
        const d = new Date(h.timestamp);
        return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    });
    const prices = history.map(h => h.price);
    
    if (currentChart) {
        currentChart.destroy();
    }
    
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price History',
                data: prices,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#10b981',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8', maxTicksLimit: 5 }
                }
            }
        }
    });
}
