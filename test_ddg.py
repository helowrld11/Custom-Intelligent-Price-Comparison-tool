import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

o = Options()
o.add_argument('--headless=new')
o.add_argument('--window-size=1920,1080')
d = webdriver.Chrome(options=o)

d.get('https://lite.duckduckgo.com/lite/')
d.find_element(By.NAME, 'q').send_keys('site:amazon.in sony headphones')
d.find_element(By.CSS_SELECTOR, 'input[type="submit"]').click()
time.sleep(2)

with open('test_ddg_html.txt', 'w', encoding='utf-8') as f:
    f.write(d.page_source)
    
d.quit()
