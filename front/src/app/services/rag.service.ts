import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { API_BASE } from '../tokens';

export interface RAGQueryResponse {
  success: boolean;
  data?: {
    query: string;
    results: RAGResult[];
    rag_available: boolean;
  };
  error?: string;
}

export interface RAGResult {
  text: string;
  metadata: {
    chunk_id: string;
    chunk_index: number;
    document_id: string;
    document_title: string;
  };
  similarity: number;
}

export interface RAGStats {
  success: boolean;
  data: {
    document_count: number;
    collection_name: string;
    rag_available: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class RAGService {
  // Track service availability
  private ragServiceAvailable = true;

  constructor(
    private http: HttpClient,
    @Inject(API_BASE) public base: string
  ) {}

  /**
   * Query the RAG system with a user question
   * @param query The user's question
   * @param numResults Number of results to return (default: 3)
   * @returns Observable with the query response
   */
  queryRAG(query: string, numResults: number = 3): Observable<RAGQueryResponse> {
    // If we already know the service is unavailable, return a failed response immediately
    if (!this.ragServiceAvailable) {
      console.log('RAG service is known to be unavailable, skipping request');
      return of({
        success: false,
        error: 'RAG service unavailable',
        data: {
          query,
          results: [],
          rag_available: false
        }
      });
    }

    return this.http.post<RAGQueryResponse>(`${this.base}api/rag/query/`, {
      query,
      num_results: numResults
    }).pipe(
      timeout(8000), // 8-second timeout
      catchError((error: HttpErrorResponse) => {
        console.error('Error querying RAG system:', error);
        this.ragServiceAvailable = false;
        
        // After 30 seconds, try again
        setTimeout(() => {
          this.ragServiceAvailable = true;
        }, 30000);
        
        // Return a graceful failure response
        return of({
          success: false,
          error: error.message || 'RAG service unavailable',
          data: {
            query,
            results: [],
            rag_available: false
          }
        });
      })
    );
  }

  /**
   * Get information about the RAG system's document collection
   * @returns Observable with collection stats
   */
  getRAGStats(): Observable<RAGStats> {
    return this.http.get<RAGStats>(`${this.base}api/rag/stats/`).pipe(
      timeout(5000), // 5-second timeout
      catchError((error: HttpErrorResponse) => {
        console.error('Error getting RAG stats:', error);
        // Return a default response
        return of({
          success: false,
          data: {
            document_count: 0,
            collection_name: 'unknown',
            rag_available: false
          }
        });
      })
    );
  }
} 