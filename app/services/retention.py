from datetime import date


WEEKLY_THEMES = (
    "Desafios para a valorização da saúde mental entre jovens brasileiros",
    "Caminhos para combater a desinformação no Brasil",
    "Desafios da inclusão digital na sociedade brasileira",
    "A preservação ambiental e o desenvolvimento sustentável",
    "O combate à evasão escolar no Brasil",
    "A valorização da diversidade cultural brasileira",
    "Desafios para a mobilidade urbana sustentável",
    "A importância da educação financeira para os jovens",
)


def weekly_theme(today: date | None = None) -> str:
    current = today or date.today()
    week = current.isocalendar().week
    return WEEKLY_THEMES[(week - 1) % len(WEEKLY_THEMES)]
