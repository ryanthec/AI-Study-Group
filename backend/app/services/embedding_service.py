# app/services/embedding_service.py
import time

from google import genai
from google.genai import types
from typing import List, Optional
import os
import numpy as np

class EmbeddingService:
    def __init__(self):
        self.client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        self.model = "gemini-embedding-001"
        self.dimension = 768  # gemini-embedding-001 dimension
    
    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        try:
            result = self.client.models.embed_content(
                model=self.model,
                contents=text,
                config=types.EmbedContentConfig(output_dimensionality=768)
            )
            return list(result.embeddings[0].values)
        except Exception as e:
            print(f"Error generating embedding: {e}")
            raise
    
    def embed_batch(self, texts: List[str], batch_size: int = 5) -> List[List[float]]:
        """
        Generate embeddings for multiple texts at once.
        Handles API limits by splitting input into micro-batches and sleeping on rate limits.
        """
        all_embeddings = []
        total_texts = len(texts)
        
        for i in range(0, total_texts, batch_size):
            batch = texts[i : i + batch_size]
            batch_success = False
            last_exception = None
            
            # Retry loop for rate limits
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    result = self.client.models.embed_content(
                        model=self.model,
                        contents=batch,
                        config=types.EmbedContentConfig(output_dimensionality=self.dimension)
                    )
                    
                    if result.embeddings:
                        batch_embeddings = [list(emb.values) for emb in result.embeddings]
                        all_embeddings.extend(batch_embeddings)
                    
                    batch_success = True
                    break # Success! Break out of the retry loop
                    
                except Exception as e:
                    error_str = str(e)
                    last_exception = e
                    
                    # Check if the error is a Rate Limit (429) or Service Unavailable (503)
                    if "429" in error_str or "503" in error_str:
                        if attempt < max_retries - 1:
                            print(f"Chunk {i+1}/{total_texts} hit rate limit. Sleeping for 20 seconds before attempt {attempt + 2}...")
                            time.sleep(20) # Wait for the per-minute quota to reset
                            continue
                    
                    # If it's a 400 (Token Limit) or other error, break and fail
                    print(f"Chunk {i+1}/{total_texts} encountered an error: {e}")
                    break
                    
            if not batch_success:
                error_msg = f"Failed to embed chunk {i+1} after retries. Last error: {last_exception}"
                print(error_msg)
                raise RuntimeError(error_msg)
                
        return all_embeddings
    
    def compute_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """Compute cosine similarity between two embeddings"""
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        return float(np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2)))

embedding_service = EmbeddingService()