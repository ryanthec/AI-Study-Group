from pydantic import BaseModel, Field
from typing import Optional, List


class MissedMessagesResponse(BaseModel):
    missed_count: int
    last_viewed: Optional[str]

class SummaryResponse(BaseModel):
    summary: str