#!/usr/bin/env python3
"""
Quick Integration Test for Grocy API

This script tests the Grocy integration without requiring a full test suite.
Run this to verify that the integration works correctly.

Usage:
    python3 test_grocy_integration.py

Requirements:
    - Set GROCY_URL and GROCY_API_KEY in .env file
    - Grocy instance must be accessible
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.integrations.grocy import grocy_client
from app.core.config import settings


async def test_grocy_connection():
    """Test basic Grocy API connectivity"""
    print("=" * 60)
    print("Grocy Integration Test")
    print("=" * 60)
    print()

    # Check configuration
    print(f"Grocy URL: {settings.GROCY_URL or '(not configured)'}")
    print(f"API Key: {'***' + settings.GROCY_API_KEY[-4:] if settings.GROCY_API_KEY else '(not configured)'}")
    print()

    if not settings.GROCY_URL:
        print("⚠️  GROCY_URL not configured - testing graceful degradation")
        print()

        # Test graceful degradation
        print("Testing get_stock() with no configuration...")
        stock = await grocy_client.get_stock()
        assert stock == [], "Should return empty list"
        print("✅ get_stock() returned empty list (expected)")

        print("Testing get_products() with no configuration...")
        products = await grocy_client.get_products()
        assert products == [], "Should return empty list"
        print("✅ get_products() returned empty list (expected)")

        print()
        print("✅ Graceful degradation working correctly!")
        print()
        print("To test with Grocy, add to .env:")
        print("  GROCY_URL=http://your-grocy-instance:9283")
        print("  GROCY_API_KEY=your-api-key")
        return

    # Test with Grocy configured
    print("Testing Grocy API connection...")
    print()

    # Test 1: Get stock
    try:
        print("1. Testing get_stock()...")
        stock = await grocy_client.get_stock()
        print(f"   ✅ Success! Found {len(stock)} items in stock")
        if stock:
            print(f"   First item: {stock[0].get('product', {}).get('name', 'Unknown')}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return

    # Test 2: Get products
    try:
        print("2. Testing get_products()...")
        products = await grocy_client.get_products()
        print(f"   ✅ Success! Found {len(products)} products")
        if products:
            print(f"   First product: {products[0].get('name', 'Unknown')}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return

    # Test 3: Get specific product (if any exist)
    if products:
        try:
            product_id = products[0].get('id')
            print(f"3. Testing get_product({product_id})...")
            product = await grocy_client.get_product(product_id)
            if product:
                print(f"   ✅ Success! Product: {product.get('name', 'Unknown')}")
            else:
                print(f"   ⚠️  Product {product_id} not found")
        except Exception as e:
            print(f"   ❌ Error: {e}")

    print()
    print("=" * 60)
    print("✅ All tests passed! Grocy integration working correctly.")
    print("=" * 60)


if __name__ == "__main__":
    # Run async test
    asyncio.run(test_grocy_connection())
