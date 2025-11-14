# app/services/embedding_service.py
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
            # Extract the embedding values
            embedding = result.embeddings[0].values
            return list(embedding)
        except Exception as e:
            print(f"Error generating embedding: {e}")
            raise
    
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts at once (more efficient)"""
        try:
            result = self.client.models.embed_content(
                model=self.model,
                contents=texts,
                config=types.EmbedContentConfig(output_dimensionality=768)
            )
            # Extract all embeddings
            embeddings = [list(emb.values) for emb in result.embeddings]
            return embeddings
        except Exception as e:
            print(f"Error generating batch embeddings: {e}")
            raise
    
    def compute_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """Compute cosine similarity between two embeddings"""
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        return float(np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2)))

embedding_service = EmbeddingService()
