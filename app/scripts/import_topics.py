import argparse
import asyncio
import re
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database.database import SessionFactory
from app.database.models import EssayTopic

TOPIC_RE = re.compile(r"^\s*\d+\.\s+(.+?)\s*$")


def parse_topics(path: Path) -> list[dict[str, str]]:
    category = "Temas gerais"
    topics: list[dict[str, str]] = []
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if line.startswith("## "):
            category = line.removeprefix("## ").strip()
            continue
        match = TOPIC_RE.match(line)
        if match:
            title = match.group(1).strip().rstrip(".")
            topics.append({"title": title, "category": category})
    unique: dict[str, dict[str, str]] = {}
    for topic in topics:
        unique.setdefault(topic["title"].casefold(), topic)
    return list(unique.values())


async def import_topics(path: Path) -> None:
    topics = parse_topics(path)
    if not topics:
        raise RuntimeError("Nenhum tema numerado foi encontrado no arquivo")
    async with SessionFactory.begin() as session:
        statement = pg_insert(EssayTopic).values(topics)
        statement = statement.on_conflict_do_update(
            index_elements=[EssayTopic.title],
            set_={"category": statement.excluded.category, "active": True},
        )
        await session.execute(statement)
    print(f"{len(topics)} temas processados")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    asyncio.run(import_topics(args.path))


if __name__ == "__main__":
    main()
