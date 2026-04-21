from fintastech.agent.orchestrator import ResearchPipeline
from fintastech.data.mock_provider import MockMarketProvider


def test_brief_shape() -> None:
    pipe = ResearchPipeline(MockMarketProvider())
    b = pipe.brief("TEST")
    assert b.symbol == "TEST"
    assert -1.0 <= b.illustrative_position_pct <= 1.0
    assert b.disclaimer
