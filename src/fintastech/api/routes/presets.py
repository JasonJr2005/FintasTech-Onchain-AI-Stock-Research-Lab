"""Curated preset watch-lists.

EDUCATIONAL / RESEARCH USE ONLY. These presets are illustrative groupings of
publicly-listed symbols used as demo inputs for the research orchestrator and
paper-trading simulator. They are **not** recommendations, not curated
portfolios, and do not constitute investment advice.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/presets")


PRESETS: list[dict] = [
    {
        "key": "us_tech7",
        "label": "美股科技 7 巨头",
        "description": "Apple / Microsoft / Google / Amazon / Meta / Nvidia / Tesla",
        "symbols": ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA"],
        "region": "US",
    },
    {
        "key": "us_ai",
        "label": "美股 AI 主题",
        "description": "Nvidia / AMD / Microsoft / Palantir / Super Micro / Broadcom",
        "symbols": ["NVDA", "AMD", "MSFT", "PLTR", "SMCI", "AVGO"],
        "region": "US",
    },
    {
        "key": "us_finance",
        "label": "美股金融",
        "description": "JPMorgan / Bank of America / Wells Fargo / Goldman / BRK-B",
        "symbols": ["JPM", "BAC", "WFC", "GS", "BRK-B"],
        "region": "US",
    },
    {
        "key": "hk_blue",
        "label": "港股蓝筹",
        "description": "腾讯 / 阿里 / 美团 / 中国移动 / 汇丰 / 友邦",
        "symbols": ["0700.HK", "9988.HK", "3690.HK", "0941.HK", "0005.HK", "1299.HK"],
        "region": "HK",
    },
    {
        "key": "cn_consumer",
        "label": "A 股消费龙头",
        "description": "贵州茅台 / 五粮液 / 伊利股份 / 美的集团",
        "symbols": ["600519.SS", "000858.SZ", "600887.SS", "000333.SZ"],
        "region": "CN",
    },
    {
        "key": "cn_new_energy",
        "label": "A 股新能源",
        "description": "宁德时代 / 比亚迪 / 隆基绿能 / 阳光电源",
        "symbols": ["300750.SZ", "002594.SZ", "601012.SS", "300274.SZ"],
        "region": "CN",
    },
]


@router.get("")
def list_presets() -> list[dict]:
    """Return the full catalog of curated demo watch-lists."""
    return PRESETS
