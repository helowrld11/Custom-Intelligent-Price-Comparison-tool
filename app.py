import os
import threading
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from database import get_db
from scraper import extract_product_data
from ai_engine import generate_recommendation

app = Flask(__name__)
CORS(app)

# ----------------- BACKGROUND JOBS -----------------
def background_price_updater():
    """
    Simulates a cron job using a background thread and a while loop
    """
    import time
    while True:
        try:
            time.sleep(3600)  # run every hour
            print("Running background price update...")
            conn = get_db()
            products = conn.execute('SELECT * FROM products').fetchall()
            for p in products:
                data = extract_product_data(p['url'])
                new_price = data.get('price')
                
                # Insert history
                conn.execute('INSERT INTO price_history (product_id, price) VALUES (?, ?)', (p['id'], new_price))
                
                # Run AI logic
                hist = conn.execute('SELECT price, timestamp FROM price_history WHERE product_id = ? ORDER BY timestamp ASC', (p['id'],)).fetchall()
                history_list = [dict(h) for h in hist]
                ai_rec = generate_recommendation(p['id'], new_price, history_list, p['source'])
                
                # Update recommendations
                conn.execute('DELETE FROM recommendations WHERE product_id = ?', (p['id'],))
                conn.execute('INSERT INTO recommendations (product_id, recommendation, confidence, reason, deal_score) VALUES (?, ?, ?, ?, ?)', 
                             (p['id'], ai_rec['recommendation'], ai_rec['confidence'], ai_rec['reason'], ai_rec.get('deal_score', 0.0)))
                
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Background Job Error: {e}")

# Start the background thread
bg_thread = threading.Thread(target=background_price_updater, daemon=True)
bg_thread.start()

# ----------------- API ENDPOINTS -----------------

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    conn = get_db()
    total = conn.execute('SELECT COUNT(*) as c FROM products').fetchone()['c']
    alerts_count = conn.execute('SELECT COUNT(*) as c FROM alerts WHERE status="ACTIVE"').fetchone()['c']
    buy_recs = conn.execute('SELECT COUNT(*) as c FROM recommendations WHERE recommendation="Buy"').fetchone()['c']
    
    # Get recent products
    recent_rows = conn.execute('''
        SELECT p.id, p.name, p.url, p.source,
        (SELECT price FROM price_history WHERE product_id = p.id ORDER BY timestamp DESC LIMIT 1) as current_price
        FROM products p ORDER BY p.id DESC LIMIT 5
    ''').fetchall()
    
    # Get recent insights
    insights_rows = conn.execute('''
        SELECT r.recommendation, r.confidence, r.reason, r.deal_score, p.name as product_name
        FROM recommendations r
        JOIN products p ON p.id = r.product_id
        ORDER BY r.id DESC LIMIT 5
    ''').fetchall()
    
    conn.close()
    
    # add name short to recent
    recent_res = []
    for r in recent_rows:
        d = dict(r)
        d['name_short'] = d['name'][:30] + "..." if d['name'] and len(d['name']) > 30 else d['name']
        recent_res.append(d)
        
    return jsonify({
        "totalProducts": total,
        "activeAlerts": alerts_count,
        "buyRecommendations": buy_recs,
        "recentProducts": recent_res,
        "insights": [dict(i) for i in insights_rows]
    })

@app.route('/api/products', methods=['GET', 'POST'])
def handle_products():
    conn = get_db()
    if request.method == 'POST':
        data = request.json
        url = data.get('url')
        name = data.get('name')
        price = data.get('price')
        source = data.get('source')
        
        if not url:
            return jsonify({"error": "URL is required"}), 400
            
        # Check if already exists
        existing = conn.execute('SELECT * FROM products WHERE url=?', (url,)).fetchone()
        if existing:
            return jsonify({"error": "Product already tracked"}), 400
            
        # Extract data
        if name and price and source:
            scraped = {"name": name, "price": price, "source": source, "url": url}
        else:
            scraped = extract_product_data(url)
        
        c = conn.cursor()
        c.execute('INSERT INTO products (name, url, category, source) VALUES (?, ?, ?, ?)', 
                  (scraped['name'], url, 'General', scraped['source']))
        product_id = c.lastrowid
        
        # Add initial price history
        c.execute('INSERT INTO price_history (product_id, price) VALUES (?, ?)', (product_id, scraped['price']))
        
        # Add some mock older history to make the charts and AI work immediately for demo purposes
        import random
        from datetime import datetime, timedelta
        mock_price = scraped['price']
        for i in range(5, 0, -1):
            past_time = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d %H:%M:%S')
            past_price = round(mock_price * random.uniform(0.85, 1.15), 2)
            c.execute('INSERT INTO price_history (product_id, price, timestamp) VALUES (?, ?, ?)', (product_id, past_price, past_time))
            
        # Initial AI analysis
        hist = c.execute('SELECT price, timestamp FROM price_history WHERE product_id = ? ORDER BY timestamp ASC', (product_id,)).fetchall()
        ai_rec = generate_recommendation(product_id, scraped['price'], [dict(h) for h in hist], scraped['source'])
        c.execute('INSERT INTO recommendations (product_id, recommendation, confidence, reason, deal_score) VALUES (?, ?, ?, ?, ?)',
                  (product_id, ai_rec['recommendation'], str(ai_rec['confidence']), ai_rec['reason'], ai_rec.get('deal_score', 0.0)))
        
        conn.commit()
        conn.close()
        return jsonify({"message": "Product added", "id": product_id}), 201

    else:
        products = conn.execute('''
            SELECT p.id, p.name, p.url, p.source,
            (SELECT price FROM price_history WHERE product_id = p.id ORDER BY timestamp DESC LIMIT 1) as current_price,
            r.recommendation, r.confidence, r.reason, r.deal_score
            FROM products p
            LEFT JOIN recommendations r ON p.id = r.product_id
            ORDER BY p.id DESC
        ''').fetchall()
        
        res = []
        for p in products:
            d = dict(p)
            d['name_short'] = d['name'][:35] + "..." if d['name'] and len(d['name']) > 35 else d['name']
            res.append(d)
        
        conn.close()
        return jsonify(res)

@app.route('/api/products/<int:id>', methods=['GET'])
def get_product(id):
    conn = get_db()
    product = conn.execute('SELECT * FROM products WHERE id=?', (id,)).fetchone()
    if not product:
        return jsonify({"error": "Product not found"}), 404
        
    history = conn.execute('SELECT price, timestamp FROM price_history WHERE product_id=? ORDER BY timestamp ASC', (id,)).fetchall()
    rec = conn.execute('SELECT recommendation, confidence, reason, deal_score FROM recommendations WHERE product_id=?', (id,)).fetchone()
    
    result = dict(product)
    result['history'] = [dict(h) for h in history]
    if result['history']:
        result['current_price'] = result['history'][-1]['price']
        
    if rec:
        result.update(dict(rec))
        
    conn.close()
    return jsonify(result)

@app.route('/api/search', methods=['POST'])
def search_compare():
    data = request.json
    query = data.get('query')
    if not query:
        return jsonify({"error": "Query required"}), 400
        
    from scraper import search_product
    results = search_product(query)
    
    if not results:
        return jsonify({"error": "No results found"}), 404
        
    cheapest = results[0]
    
    return jsonify({
        "cheapest": cheapest,
        "comparison": results
    })

@app.route('/api/suggestions', methods=['GET'])
def get_suggestions():
    query = request.args.get('q', '')
    if not query:
        return jsonify([])
    try:
        import requests
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        r = requests.get(f"https://duckduckgo.com/ac/?q={query}", headers=headers, timeout=5)
        data = r.json()
        suggestions = [item['phrase'] for item in data if 'phrase' in item]
        return jsonify(suggestions[:8])
    except Exception as e:
        print(f"Suggestions Error: {e}")
        return jsonify([])

if __name__ == '__main__':
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    
    # Auto-Migration for deal_score column
    try:
        from database import get_db
        db_conn = get_db()
        db_conn.execute('ALTER TABLE recommendations ADD COLUMN deal_score REAL DEFAULT 0.0')
        db_conn.commit()
        db_conn.close()
        print("Database migrated to support deal_score.")
    except Exception as e:
        # Expected to fail if column already exists
        pass

    app.run(debug=True, port=5000, use_reloader=False) 
