import requests
import urllib.parse
from bs4 import BeautifulSoup
import re

def search_snapdeal(query):
    try:
        url = f"https://www.snapdeal.com/search?keyword={urllib.parse.quote(query)}"
        h = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        r = requests.get(url, headers=h, timeout=10)
        s = BeautifulSoup(r.text, 'html.parser')
        
        products = s.find_all('div', class_='product-tuple-listing')
        results = []
        for p in products:
            link_tag = p.find('a', class_='dp-widget-link')
            title_tag = p.find('p', class_='product-title')
            price_tag = p.find('span', class_='product-price')
            
            if link_tag and title_tag and price_tag:
                link = link_tag.get('href', '')
                title = title_tag.text.strip()
                price_text = price_tag.text.replace('Rs.', '').replace(',', '').strip()
                
                try:
                    price = float(price_text)
                    results.append({
                        "source": "Snapdeal",
                        "name": title[:100],
                        "price": price,
                        "url": link
                    })
                except ValueError:
                    continue
                    
        return results[:5]
    except Exception as e:
        print("Snapdeal API Error:", e)
        return []

def search_upcitemdb(query):
    # Fallback to UPCItemDB if Snapdeal fails to yield Indian results
    url = f"https://api.upcitemdb.com/prod/trial/search?s={urllib.parse.quote(query)}&match_mode=0&type=product"
    try:
        res = requests.get(url, timeout=10)
        items = res.json().get('items', [])
        
        results = []
        for item in items:
            title = item.get('title', 'Product')
            offers = item.get('offers', [])
            usd_price = 0.0
            exact_link = ""
            merchant = ""
            
            for offer in offers:
                if offer.get('price') and offer.get('link'):
                    usd_price = float(offer.get('price'))
                    exact_link = offer.get('link')
                    domain = offer.get('domain', '')
                    merchant = domain.split('.')[0].capitalize() if domain else offer.get('merchant', 'Store')
                    break
                    
            if usd_price == 0.0 and item.get('price'):
                usd_price = float(item['price'])
                exact_link = item.get('link', '')
                merchant = "Global Store"
                
            if usd_price > 0 and exact_link:
                # Provide the exact link from UPCItemDB (e.g. Walmart/Bestbuy)
                # But display the localized approximate INR equivalent
                base_inr = usd_price * 83.5
                results.append({
                    "source": f"{merchant} (Global Import)",
                    "name": title[:100],
                    "price": round(base_inr * 1.15, 0),
                    "url": exact_link
                })
                # Break to prevent flooding with global items, 1 fallback is enough
                break
                
        return results
    except Exception as e:
        print("UPC API Error:", e)
        return []

def search_product(query):
    if query.startswith('http'):
        return extract_specific_url(query)
        
    results = search_snapdeal(query)
    
    if not results:
        # Fallback if no exact indian links available
        results = search_upcitemdb(query)
        
    if not results:
        return []
        
    return sorted(results, key=lambda x: x['price'])

def extract_specific_url(url):
    domain = url.split("//")[-1].split("/")[0]
    domain_name = domain.replace("www.", "").split(".")[0].capitalize()
    return [{
        "source": domain_name,
        "name": f"Tracked Direct Product ({domain_name})",
        "price": 9999, 
        "url": url
    }]

def extract_product_data(url):
    results = search_product(url)
    return results[0] if results else {
        "source": "Unknown",
        "name": url[:40] + "...",
        "price": 9999,
        "url": url
    }
