from pydantic import BaseModel, Field


class TranscriptionInput(BaseModel):
    text: str = Field(min_length=100, max_length=30_000)
