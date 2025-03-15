#!/usr/bin/env python
"""
Test script to verify RAG availability handling.
This script tests:
1. Clearing RAG data
2. Checking if the system correctly reports RAG unavailability
3. Re-ingesting documents
4. Checking if the system correctly reports RAG availability
"""
import os
import sys
import json
import requests
import argparse
import subprocess
from pprint import pprint

def run_command(command):
    """Run a shell command and return output"""
    print(f"Running: {command}")
    result = subprocess.run(command, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error executing command: {result.stderr}")
        return None
    return result.stdout.strip()

def test_rag_query(query="What is Co.meta?"):
    """Test querying the RAG API"""
    url = "http://localhost:8000/api/rag/query/"
    headers = {'Content-Type': 'application/json'}
    data = {"query": query, "num_results": 3}
    
    try:
        response = requests.post(url, headers=headers, json=data)
        return response.json()
    except Exception as e:
        print(f"Error querying RAG API: {e}")
        return None

def test_rag_stats():
    """Test getting RAG stats"""
    url = "http://localhost:8000/api/rag/stats/"
    
    try:
        response = requests.get(url)
        return response.json()
    except Exception as e:
        print(f"Error getting RAG stats: {e}")
        return None

def clear_rag_data():
    """Clear all RAG data"""
    command = "cd /opt/code && python manage.py clear_rag"
    return run_command(command)

def ingest_document(filepath="/opt/code/sample_readme.md", title="Co.meta Documentation"):
    """Ingest a document into the RAG system"""
    command = f"cd /opt/code && python manage.py ingest_document {filepath} --title '{title}'"
    return run_command(command)

def main():
    parser = argparse.ArgumentParser(description="Test RAG availability handling")
    parser.add_argument("--clear", action="store_true", help="Clear RAG data")
    parser.add_argument("--ingest", action="store_true", help="Ingest sample document")
    parser.add_argument("--query", action="store_true", help="Test RAG query")
    parser.add_argument("--stats", action="store_true", help="Test RAG stats")
    parser.add_argument("--all", action="store_true", help="Run all tests")
    
    args = parser.parse_args()
    
    if args.all or (not args.clear and not args.ingest and not args.query and not args.stats):
        print("=== Testing RAG Availability ===")
        
        print("\n1. Getting current RAG stats...")
        stats_before = test_rag_stats()
        pprint(stats_before)
        
        print("\n2. Testing RAG query with existing data...")
        query_before = test_rag_query()
        pprint(query_before)
        
        print("\n3. Clearing RAG data...")
        clear_result = clear_rag_data()
        print(clear_result)
        
        print("\n4. Getting RAG stats after clearing...")
        stats_after_clear = test_rag_stats()
        pprint(stats_after_clear)
        
        print("\n5. Testing RAG query with no data...")
        query_after_clear = test_rag_query()
        pprint(query_after_clear)
        
        print("\n6. Re-ingesting document...")
        ingest_result = ingest_document()
        print(ingest_result)
        
        print("\n7. Getting RAG stats after ingestion...")
        stats_after_ingest = test_rag_stats()
        pprint(stats_after_ingest)
        
        print("\n8. Testing RAG query with restored data...")
        query_after_ingest = test_rag_query()
        pprint(query_after_ingest)
        
        print("\n=== Test Complete ===")
    else:
        if args.clear:
            print("Clearing RAG data...")
            clear_result = clear_rag_data()
            print(clear_result)
        
        if args.ingest:
            print("Ingesting document...")
            ingest_result = ingest_document()
            print(ingest_result)
        
        if args.stats:
            print("Getting RAG stats...")
            stats = test_rag_stats()
            pprint(stats)
        
        if args.query:
            print("Testing RAG query...")
            query_result = test_rag_query()
            pprint(query_result)

if __name__ == "__main__":
    main() 