from pydantic import BaseModel


class PlanRead(BaseModel):
    name: str
    daily_limit: int
    price: float
