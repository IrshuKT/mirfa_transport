from typing import Any, Generic, List, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class PagedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: List[Any]


def paginate(total: int, page: int, page_size: int, results: list) -> dict:
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "results": results,
    }
