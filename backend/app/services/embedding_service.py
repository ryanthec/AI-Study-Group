# app/services/embedding_service.py
from google import genai
from google.genai import types
from typing import List, Optional
import os
import numpy as np

class EmbeddingService:
    def __init__(self):
        free_key = os.getenv("GEMINI_API_KEY_FREE")
        paid_key = os.getenv("GEMINI_API_KEY")
        
        self.clients = []
        if free_key:
            self.clients.append(("Free", genai.Client(api_key=free_key)))
        if paid_key:
            self.clients.append(("Paid", genai.Client(api_key=paid_key)))
        self.model = "gemini-embedding-001"
        self.dimension = 768  # gemini-embedding-001 dimension
    
    def embed_text(self, text: str) -> List[float]:
        last_exception = None
        for client_name, client in self.clients:
            try:
                result = client.models.embed_content(
                    model=self.model,
                    contents=text,
                    config=types.EmbedContentConfig(output_dimensionality=self.dimension)
                )
                return list(result.embeddings[0].values)
            except Exception as e:
                print(f"Embedding failed on {client_name} key: {e}")
                last_exception = e
                continue
        raise RuntimeError(f"Embedding failed on all keys: {last_exception}")
    
    def embed_batch(self, texts: List[str], batch_size: int = 100) -> List[List[float]]:
        """
        Generate embeddings for multiple texts at once.
        Handles API limits by splitting input into batches of max 100 requests.
        Includes fallback support across multiple API keys.
        """
        all_embeddings = []
        total_texts = len(texts)
        
        # Loop through the texts in chunks of 'batch_size' (default 100)
        for i in range(0, total_texts, batch_size):
            batch = texts[i : i + batch_size]
            batch_success = False
            last_exception = None
            
            # Inner loop: Try Free key first, then Paid key
            for client_name, client in self.clients:
                try:
                    # Call API for this specific batch using the current client
                    result = client.models.embed_content(
                        model=self.model,
                        contents=batch,
                        # Using self.dimension to keep it consistent with your init
                        config=types.EmbedContentConfig(output_dimensionality=self.dimension) 
                    )
                    
                    # Extract embeddings for this batch and extend the main list
                    if result.embeddings:
                        batch_embeddings = [list(emb.values) for emb in result.embeddings]
                        all_embeddings.extend(batch_embeddings)
                    
                    batch_success = True
                    break # Success! Break out of the client fallback loop for this batch
                    
                except Exception as e:
                    # To keep dependencies simple here, we check the exception string for rate limit codes
                    error_str = str(e)
                    if "429" in error_str or "503" in error_str:
                        print(f"Batch {i//batch_size + 1} hit rate limit on {client_name} key. Falling back...")
                    else:
                        print(f"Batch {i//batch_size + 1} encountered error on {client_name} key: {e}")
                        
                    last_exception = e
                    continue # Try the next key
                    
            if not batch_success:
                # If we exhausted all keys for this specific batch, fail the whole process
                # This prevents you from inserting incomplete document chunks into your database
                error_msg = f"Failed to embed batch {i//batch_size + 1} on all keys. Last error: {last_exception}"
                print(error_msg)
                raise RuntimeError(error_msg)
                
        return all_embeddings
    
    def compute_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """Compute cosine similarity between two embeddings"""
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        return float(np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2)))

embedding_service = EmbeddingService()