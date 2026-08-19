from app.scripts.import_topics import parse_topics


def test_parse_topics_preserves_category_and_removes_numbering(tmp_path) -> None:
    source = tmp_path / "topics.txt"
    source.write_text("# PACK\n\n## EIXO 1 — EDUCAÇÃO\n1. Desafios da escola.\n2. Acesso ao ensino.\n", encoding="utf-8")
    assert parse_topics(source) == [
        {"title": "Desafios da escola", "category": "EIXO 1 — EDUCAÇÃO"},
        {"title": "Acesso ao ensino", "category": "EIXO 1 — EDUCAÇÃO"},
    ]
