#!/usr/bin/env python3
"""
Debug orders endpoint issue
"""

import requests
import json

# Get backend URL from frontend .env
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception as e:
        print(f"❌ Error reading frontend .env: {e}")
        return None

def test_orders_endpoint():
    backend_url = get_backend_url()
    api_base = f"{backend_url}/api"
    
    # Login first
    login_payload = {
        "email": "kayicom509@gmail.com",
        "password": "Admin123!"
    }
    
    try:
        login_response = requests.post(
            f"{api_base}/auth/login",
            json=login_payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        if login_response.status_code == 200:
            token = login_response.json()["access_token"]
            print(f"✅ Login successful, token: {token[:20]}...")
            
            # Test orders endpoint
            orders_response = requests.get(
                f"{api_base}/orders",
                headers={"Authorization": f"Bearer {token}"},
                timeout=15
            )
            
            print(f"Orders endpoint status: {orders_response.status_code}")
            if orders_response.status_code != 200:
                print(f"Response text: {orders_response.text}")
            else:
                orders = orders_response.json()
                print(f"✅ Orders retrieved successfully: {len(orders)} orders")
                
        else:
            print(f"❌ Login failed: {login_response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_orders_endpoint()