from app.bot.handlers.result import split_telegram_message


def test_long_result_is_split_for_telegram() -> None:
    chunks = split_telegram_message("a" * 9000)
    assert "".join(chunks) == "a" * 9000
    assert all(len(chunk) <= 4000 for chunk in chunks)
