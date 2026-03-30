# PricePulse AI 🚀  
**Multi-Source Price Intelligence & Decision Support System**

PricePulse AI is an AI-powered price tracking system that aggregates product data using a hybrid approach (scraping + APIs + smart redirection) and provides intelligent recommendations on whether to buy now or wait.

---

## 🔥 Features

- 🧠 **AI Recommendations** – Buy/Wait decisions with reasoning  
- 🌐 **Multi-Source Data** – Snapdeal scraping + API support + Amazon/Flipkart search fallback  
- 📊 **Price Tracking** – Monitor price history and trends  
- 🔔 **Smart Alerts** – Notifications based on meaningful price drops  
- 🎯 **Deal Score** – Evaluate deal quality using historical data  
- 🔍 **Transparent Sources** – Clearly labeled data origin (Verified/API/Search)

---

## 🧩 Architecture

- **Frontend:** Web UI (Flask / LCNC UI tools)  
- **Backend:** Python + Database (Sheets/DB)  
- **Data Layer:** Hybrid scraping + APIs  
- **Automation:** Scheduled workflows (Zapier / Make)  
- **AI Layer:** Decision engine (ChatGPT/Gemini)

---

## ⚙️ How It Works

1. Search for a product  
2. System fetches data from multiple sources  
3. Stores and tracks price history  
4. AI analyzes trends  
5. Displays insights + recommendations  

---

## 🚀 Tech Stack

- Python (Flask)
- Web Scraping (Snapdeal)
- APIs (Amazon / Flipkart - optional)
- LCNC Tools (AppSheet / Automation)
- AI Integration (ChatGPT / Gemini)

---

## ▶️ Run Locally

```bash
python app.py
