def generate_recommendation(product_id, current_price, price_history, source="External"):
    """
    Analyzes price history and trends to generate a recommendation.
    price_history is a list of dicts: [{'price': X, 'timestamp': Y}, ...]
    """
    
    # Establish Source Confidence Level
    if "Snapdeal" in source:
        confidence = "High - Based on verified local Indian source (Snapdeal)."
    elif "Import" in source or "Global" in source:
        confidence = "Low - Based on global parity conversion. Amazon/Flipkart searches recommended."
    else:
        confidence = f"Medium - Single external provider ({source})."

    if not price_history or len(price_history) < 2:
        return {
            "recommendation": "Wait",
            "confidence": confidence,
            "deal_score": 50.0,
            "reason": "Not enough historical data to make a reliable recommendation."
        }
        
    prices = [h['price'] for h in price_history]
    avg_price = sum(prices) / len(prices)
    min_price = min(prices)
    
    # Deal Quality Score Logic (0-100)
    # Baseline is 50. Discount boosts score, Premium reduces it.
    deal_score = 50.0
    
    if current_price <= min_price:
        diff_pct = ((avg_price - current_price) / avg_price) * 100 if avg_price > 0 else 0
        deal_score = min(100.0, 60.0 + (diff_pct * 1.5))
        return {
            "recommendation": "Buy Now",
            "confidence": confidence,
            "deal_score": round(deal_score, 1),
            "reason": f"Current price is {diff_pct:.1f}% lower than the historical average. Excellent deal."
        }
    elif current_price < avg_price * 0.95:
        diff_pct = ((avg_price - current_price) / avg_price) * 100
        deal_score = min(90.0, 50.0 + diff_pct)
        return {
            "recommendation": "Buy",
            "confidence": confidence,
            "deal_score": round(deal_score, 1),
            "reason": f"Good deal. Price is {diff_pct:.1f}% lower than the historical average."
        }
    elif current_price > avg_price * 1.05:
        diff_pct = ((current_price - avg_price) / avg_price) * 100
        deal_score = max(0.0, 50.0 - (diff_pct * 2))
        return {
            "recommendation": "Wait for Better Deal",
            "confidence": confidence,
            "deal_score": round(deal_score, 1),
            "reason": f"Price is {diff_pct:.1f}% higher than average. Wait for a drop."
        }
    else:
        return {
            "recommendation": "Wait",
            "confidence": confidence,
            "deal_score": 50.0,
            "reason": "Price is hovering around its historical average. No significant discount detected."
        }
