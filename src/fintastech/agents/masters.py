"""
Master Investor Agents — rule-based scoring inspired by real-world investing legends.
Each master applies their unique philosophy to score a stock, producing an AnalystSignal.
Works with OHLCV + optional yfinance fundamentals dict.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from fintastech.models.analysis import AnalystSignal, SignalDirection


# ── helpers ──────────────────────────────────────────────────────────────────

def _safe(v: Any, default: float = 0.0) -> float:
    """Coerce arbitrary input to a finite float, falling back to *default*.

    Handles the usual yfinance quirks: ``None``, NaN, inf, and string
    representations like ``"N/A"`` / ``"32.5%"`` / ``"1,234"``.
    """
    if v is None or isinstance(v, bool):
        return default
    if isinstance(v, (int, float)):
        f = float(v)
        return default if (math.isnan(f) or math.isinf(f)) else f
    if isinstance(v, str):
        s = v.strip().replace(",", "").replace("%", "")
        if not s or s.lower() in {"n/a", "none", "nan", "null", "-"}:
            return default
        try:
            f = float(s)
        except ValueError:
            return default
        return default if (math.isnan(f) or math.isinf(f)) else f
    try:
        f = float(v)
    except (ValueError, TypeError):
        return default
    return default if (math.isnan(f) or math.isinf(f)) else f


def _score_to_signal(score: float, max_score: float) -> tuple[SignalDirection, float]:
    """Map a raw integer score to a direction + confidence.

    Rules (revised):

    * ``score > 0``:  bullish scale (≥ 60% of max → strong bull, weaker →
      mildly bull).
    * ``score < 0``:  symmetric bearish scale. A master that explicitly
      *deducts* points is expressing a negative view.
    * ``score == 0`` (e.g. "数据不足" with no positives and no negatives):
      always NEUTRAL with 0 confidence, never BEARISH.
    """
    if not max_score or max_score <= 0 or score == 0:
        return SignalDirection.NEUTRAL, 0.0
    ratio = score / max_score
    conf = min(1.0, abs(ratio))
    if ratio >= 0.6:
        return SignalDirection.BULLISH, conf
    if ratio >= 0.25:
        return SignalDirection.BULLISH, conf * 0.7
    if ratio <= -0.4:
        return SignalDirection.BEARISH, conf
    if ratio <= -0.15:
        return SignalDirection.BEARISH, conf * 0.7
    return SignalDirection.NEUTRAL, conf * 0.3


# ── base ─────────────────────────────────────────────────────────────────────

@dataclass
class MasterProfile:
    key: str
    name_en: str
    name_cn: str
    title: str
    philosophy: str
    icon: str


class MasterInvestor:
    profile: MasterProfile

    def analyze(
        self, symbol: str, ohlcv: pd.DataFrame, info: dict[str, Any] | None = None
    ) -> AnalystSignal:
        raise NotImplementedError


# ── Warren Buffett ───────────────────────────────────────────────────────────

class WarrenBuffett(MasterInvestor):
    profile = MasterProfile(
        key="warren_buffett", name_en="Warren Buffett", name_cn="沃伦·巴菲特",
        title="奥马哈先知", philosophy="寻找具有持久竞争优势（护城河）、管理层优秀、价格合理的伟大企业",
        icon="🏛️",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []

        roe = _safe(info.get("roe"))
        if roe > 0.15:
            score += 2; parts.append(f"ROE {roe:.1%} 优秀，展现盈利能力")
        elif roe > 0.10:
            score += 1; parts.append(f"ROE {roe:.1%} 尚可")
        else:
            parts.append(f"ROE {roe:.1%} 偏低，不符合高质量标准")

        margin = _safe(info.get("profit_margin"))
        if margin > 0.20:
            score += 2; parts.append(f"净利率 {margin:.1%}，定价权强")
        elif margin > 0.10:
            score += 1
        de = _safe(info.get("debt_to_equity"))
        if de and de < 50:
            score += 1; parts.append("负债率健康")
        elif de and de > 100:
            score -= 1; parts.append("负债偏高，风险增大")

        pe = _safe(info.get("pe_ratio"))
        if 0 < pe < 20:
            score += 2; parts.append(f"P/E {pe:.1f}，估值合理")
        elif 0 < pe < 30:
            score += 1
        elif pe > 40:
            score -= 1; parts.append(f"P/E {pe:.1f}，估值偏高")

        eg = _safe(info.get("earnings_growth"))
        if eg > 0.10:
            score += 1; parts.append(f"利润增长 {eg:.1%}")

        signal, conf = _score_to_signal(score, 8)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": score, "max": 8},
        )


# ── Charlie Munger ───────────────────────────────────────────────────────────

class CharlieMunger(MasterInvestor):
    profile = MasterProfile(
        key="charlie_munger", name_en="Charlie Munger", name_cn="查理·芒格",
        title="理性思考者", philosophy="以合理价格持有优质企业，注重管理层品质与长期竞争壁垒",
        icon="🧠",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []
        roe = _safe(info.get("roe"))
        margin = _safe(info.get("profit_margin"))
        if roe > 0.15 and margin > 0.15:
            score += 3; parts.append("高质量企业：高 ROE + 高利润率")
        elif roe > 0.10:
            score += 1
        de = _safe(info.get("debt_to_equity"))
        if de and de < 60:
            score += 1; parts.append("财务保守")
        pe = _safe(info.get("pe_ratio"))
        if 0 < pe < 25:
            score += 2; parts.append("估值未过度膨胀")
        cr = _safe(info.get("current_ratio"))
        if cr > 1.5:
            score += 1; parts.append("流动性充足")
        signal, conf = _score_to_signal(score, 7)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": score, "max": 7},
        )


# ── Benjamin Graham ──────────────────────────────────────────────────────────

class BenGraham(MasterInvestor):
    profile = MasterProfile(
        key="ben_graham", name_en="Benjamin Graham", name_cn="本杰明·格雷厄姆",
        title="价值投资之父", philosophy="强调安全边际：相对内在价值显著折价的基本面稳健公司",
        icon="📚",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []
        pe = _safe(info.get("pe_ratio"))
        if 0 < pe < 15:
            score += 3; parts.append(f"P/E {pe:.1f}，具有安全边际")
        elif 0 < pe < 20:
            score += 1
        pb = _safe(info.get("pb_ratio"))
        if 0 < pb < 1.5:
            score += 2; parts.append(f"P/B {pb:.2f}，低于格雷厄姆阈值")
        elif 0 < pb < 3:
            score += 1
        cr = _safe(info.get("current_ratio"))
        if cr > 2.0:
            score += 2; parts.append(f"流动比率 {cr:.1f}，财务稳健")
        elif cr > 1.5:
            score += 1
        de = _safe(info.get("debt_to_equity"))
        if de and de < 50:
            score += 1; parts.append("低负债")
        dy = _safe(info.get("dividend_yield"))
        if dy and dy > 0.02:
            score += 1; parts.append(f"股息率 {dy:.1%}")
        signal, conf = _score_to_signal(score, 9)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": score, "max": 9},
        )


# ── Peter Lynch ──────────────────────────────────────────────────────────────

class PeterLynch(MasterInvestor):
    profile = MasterProfile(
        key="peter_lynch", name_en="Peter Lynch", name_cn="彼得·林奇",
        title="十倍股猎手", philosophy="买你了解的公司，关注 PEG 比率，寻找被忽视的成长股",
        icon="🔟",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []
        peg = _safe(info.get("peg_ratio"))
        if 0 < peg < 1.0:
            score += 3; parts.append(f"PEG {peg:.2f} < 1，成长被低估")
        elif 0 < peg < 1.5:
            score += 1; parts.append(f"PEG {peg:.2f}，成长合理定价")
        rg = _safe(info.get("revenue_growth"))
        if rg > 0.20:
            score += 2; parts.append(f"营收增长 {rg:.1%}，高成长")
        elif rg > 0.10:
            score += 1
        eg = _safe(info.get("earnings_growth"))
        if eg > 0.20:
            score += 2; parts.append(f"利润增长 {eg:.1%}")
        pe = _safe(info.get("pe_ratio"))
        if 0 < pe < 25:
            score += 1
        signal, conf = _score_to_signal(score, 8)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": score, "max": 8},
        )


# ── Cathie Wood ──────────────────────────────────────────────────────────────

class CathieWood(MasterInvestor):
    profile = MasterProfile(
        key="cathie_wood", name_en="Cathie Wood", name_cn="凯西·伍德",
        title="颠覆式创新女王", philosophy="押注颠覆性科技与指数级增长，5 年投资周期",
        icon="🚀",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []
        rg = _safe(info.get("revenue_growth"))
        if rg > 0.30:
            score += 3; parts.append(f"营收增速 {rg:.1%}，符合颠覆性增长")
        elif rg > 0.15:
            score += 1
        sector = (info.get("sector") or "").lower()
        if sector in ("technology", "healthcare", "communication services"):
            score += 2; parts.append(f"赛道 {info.get('sector','')} 属于创新领域")
        mc = _safe(info.get("market_cap"))
        if mc and mc < 50e9:
            score += 1; parts.append("市值尚有成长空间")
        signal, conf = _score_to_signal(score, 6)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": score, "max": 6},
        )


# ── Michael Burry ────────────────────────────────────────────────────────────

class MichaelBurry(MasterInvestor):
    profile = MasterProfile(
        key="michael_burry", name_en="Michael Burry", name_cn="迈克尔·伯瑞",
        title="大空头", philosophy="逆向深度价值投资，寻找市场严重错误定价的标的",
        icon="🔻",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []
        pe = _safe(info.get("pe_ratio"))
        if 0 < pe < 10:
            score += 3; parts.append(f"P/E {pe:.1f}，极度低估")
        elif 0 < pe < 15:
            score += 1
        pb = _safe(info.get("pb_ratio"))
        if 0 < pb < 1.0:
            score += 2; parts.append(f"P/B {pb:.2f}，低于净资产")
        if not ohlcv.empty and len(ohlcv) > 50:
            close = ohlcv["close"].astype(float)
            high52 = close.rolling(252, min_periods=50).max().iloc[-1]
            drawdown = (close.iloc[-1] / high52 - 1) if high52 else 0
            if drawdown < -0.3:
                score += 2; parts.append(f"较高点回撤 {drawdown:.1%}，或存在逆向机会")
        cr = _safe(info.get("current_ratio"))
        if cr > 1.5:
            score += 1; parts.append("资产负债表健康")
        signal, conf = _score_to_signal(score, 8)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": score, "max": 8},
        )


# ── Stanley Druckenmiller ────────────────────────────────────────────────────

class StanleyDruckenmiller(MasterInvestor):
    profile = MasterProfile(
        key="stanley_druckenmiller", name_en="Stanley Druckenmiller", name_cn="斯坦利·德鲁肯米勒",
        title="宏观投资大师", philosophy="自上而下宏观分析，寻找非对称赌注，重仓高确信交易",
        icon="🌍",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []
        if not ohlcv.empty and len(ohlcv) > 50:
            close = ohlcv["close"].astype(float)
            ma50 = close.rolling(50, min_periods=20).mean().iloc[-1]
            ma200 = close.rolling(200, min_periods=50).mean().iloc[-1] if len(close) > 200 else ma50
            if close.iloc[-1] > ma50 > ma200:
                score += 2; parts.append("处于上升趋势（价格>MA50>MA200）")
            elif close.iloc[-1] < ma50 < ma200:
                score -= 1; parts.append("处于下降趋势")
            ret_3m = close.iloc[-1] / close.iloc[-min(63, len(close))] - 1
            if ret_3m > 0.15:
                score += 2; parts.append(f"近季度动量强劲 {ret_3m:.1%}")
            elif ret_3m > 0.05:
                score += 1
        eg = _safe(info.get("earnings_growth"))
        if eg > 0.20:
            score += 1; parts.append("盈利加速")
        rg = _safe(info.get("revenue_growth"))
        if rg > 0.15:
            score += 1; parts.append("营收扩张")
        signal, conf = _score_to_signal(score, 6)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": score, "max": 6},
        )


# ── Aswath Damodaran ─────────────────────────────────────────────────────────

class AswathDamodaran(MasterInvestor):
    profile = MasterProfile(
        key="aswath_damodaran", name_en="Aswath Damodaran", name_cn="阿斯瓦斯·达莫达兰",
        title="估值教父", philosophy="每只股票都有可计算的内在价值，关键在于故事与数字的结合",
        icon="📐",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []
        eps = _safe(info.get("eps"))
        fwd_eps = _safe(info.get("forward_eps"))
        pe = _safe(info.get("pe_ratio"))
        fpe = _safe(info.get("forward_pe"))
        if fwd_eps > 0 and eps > 0 and fwd_eps > eps:
            score += 1; parts.append(f"预期 EPS 增长至 {fwd_eps:.2f}")
        if fpe and 0 < fpe < pe:
            score += 1; parts.append(f"远期 P/E {fpe:.1f} < 当前 {pe:.1f}")
        rg = _safe(info.get("revenue_growth"))
        roe = _safe(info.get("roe"))
        if roe > 0.12:
            score += 1; parts.append(f"ROE {roe:.1%}，资本效率良好")
        if rg > 0.10:
            score += 1; parts.append(f"营收增长 {rg:.1%}")
        if 0 < pe < 25:
            score += 1
        de = _safe(info.get("debt_to_equity"))
        if de and de < 80:
            score += 1; parts.append("杠杆可控")
        signal, conf = _score_to_signal(score, 6)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": score, "max": 6},
        )


# ── Bill Ackman ──────────────────────────────────────────────────────────────

class BillAckman(MasterInvestor):
    profile = MasterProfile(
        key="bill_ackman", name_en="Bill Ackman", name_cn="比尔·阿克曼",
        title="激进投资者", philosophy="寻找被低估的优质企业，通过激进策略释放隐藏价值",
        icon="⚡",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []
        margin = _safe(info.get("profit_margin"))
        if margin > 0.15:
            score += 2; parts.append("利润率展现企业品质")
        roe = _safe(info.get("roe"))
        if roe > 0.15:
            score += 1
        pe = _safe(info.get("pe_ratio"))
        fpe = _safe(info.get("forward_pe"))
        if fpe and pe and fpe < pe * 0.85:
            score += 2; parts.append("远期估值显著改善，存在催化剂预期")
        elif 0 < pe < 20:
            score += 1
        if not ohlcv.empty and len(ohlcv) > 50:
            close = ohlcv["close"].astype(float)
            high = close.max()
            dd = close.iloc[-1] / high - 1
            if dd < -0.2:
                score += 1; parts.append(f"较高点回撤 {dd:.1%}，或存转折机会")
        signal, conf = _score_to_signal(score, 6)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": score, "max": 6},
        )


# ── Phil Fisher ──────────────────────────────────────────────────────────────

class PhilFisher(MasterInvestor):
    profile = MasterProfile(
        key="phil_fisher", name_en="Phil Fisher", name_cn="菲利普·费雪",
        title="成长股教父", philosophy="深入调研管理层与产品创新能力，长期持有高成长企业",
        icon="🔬",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []
        rg = _safe(info.get("revenue_growth"))
        if rg > 0.15:
            score += 2; parts.append(f"营收增长 {rg:.1%}，成长性突出")
        elif rg > 0.08:
            score += 1
        margin = _safe(info.get("profit_margin"))
        if margin > 0.15:
            score += 2; parts.append("高利润率暗示产品优势")
        roe = _safe(info.get("roe"))
        if roe > 0.15:
            score += 1; parts.append("管理层运营高效")
        eg = _safe(info.get("earnings_growth"))
        if eg and eg > rg:
            score += 1; parts.append("利润增速超过营收增速，经营杠杆释放")
        signal, conf = _score_to_signal(score, 6)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": score, "max": 6},
        )


# ── George Soros (NEW — not in ai-hedge-fund) ───────────────────────────────

class GeorgeSoros(MasterInvestor):
    profile = MasterProfile(
        key="george_soros", name_en="George Soros", name_cn="乔治·索罗斯",
        title="反身性理论大师", philosophy="市场认知与现实之间存在反馈循环，趋势可自我强化至极端后反转",
        icon="🦅",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []
        if not ohlcv.empty and len(ohlcv) > 30:
            close = ohlcv["close"].astype(float)
            vol = ohlcv["volume"].astype(float)
            ret_1m = close.iloc[-1] / close.iloc[-min(22, len(close))] - 1
            vol_ratio = vol.iloc[-5:].mean() / (vol.iloc[-30:].mean() + 1)
            if abs(ret_1m) > 0.10 and vol_ratio > 1.5:
                if ret_1m > 0:
                    score += 3; parts.append(f"价量齐升 {ret_1m:.1%}，趋势自我强化中")
                else:
                    score -= 2; parts.append(f"放量下跌 {ret_1m:.1%}，负反馈循环")
            elif ret_1m > 0.05 and vol_ratio > 1.2:
                score += 1; parts.append("温和放量上涨")
            ma20 = close.rolling(20, min_periods=10).mean()
            ma60 = close.rolling(60, min_periods=20).mean()
            if len(ma60.dropna()) > 0 and ma20.iloc[-1] > ma60.iloc[-1]:
                score += 1; parts.append("中期趋势偏多")
        beta = _safe(info.get("beta"))
        if beta and beta > 1.2:
            score += 0.5; parts.append(f"高 Beta {beta:.2f}，波动中藏机会")
        signal, conf = _score_to_signal(score, 5)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": round(score, 1), "max": 5},
        )


# ── Ray Dalio (NEW) ─────────────────────────────────────────────────────────

class RayDalio(MasterInvestor):
    profile = MasterProfile(
        key="ray_dalio", name_en="Ray Dalio", name_cn="瑞·达利欧",
        title="全天候策略创始人", philosophy="分散化是唯一免费的午餐，关注宏观周期与风险平衡",
        icon="🌦️",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []
        beta = _safe(info.get("beta"), 1.0)
        if 0.5 < beta < 1.2:
            score += 2; parts.append(f"Beta {beta:.2f}，波动适中，适合组合配置")
        elif beta > 1.5:
            score -= 1; parts.append(f"Beta {beta:.2f}，波动过大")
        dy = _safe(info.get("dividend_yield"))
        if dy and dy > 0.02:
            score += 1; parts.append(f"股息率 {dy:.1%}，提供现金流缓冲")
        de = _safe(info.get("debt_to_equity"))
        if de and de < 60:
            score += 1; parts.append("低杠杆，抗周期能力强")
        if not ohlcv.empty and len(ohlcv) > 60:
            ret = ohlcv["close"].astype(float).pct_change().dropna()
            vol = float(ret.std() * np.sqrt(252))
            if vol < 0.25:
                score += 1; parts.append(f"年化波动率 {vol:.1%}，风险可控")
        signal, conf = _score_to_signal(score, 5)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": round(score, 1), "max": 5},
        )


# ── Nassim Taleb ────────────────────────────────────────────────────────────

class NassimTaleb(MasterInvestor):
    profile = MasterProfile(
        key="nassim_taleb", name_en="Nassim Taleb", name_cn="纳西姆·塔勒布",
        title="黑天鹅风控大师", philosophy="杠铃策略：大部分资产极保守，小部分押注尾部事件的非对称回报",
        icon="🦢",
    )

    def analyze(self, symbol, ohlcv, info=None):
        info = info or {}
        score, parts = 0.0, []
        de = _safe(info.get("debt_to_equity"))
        if de and de > 100:
            score -= 2; parts.append(f"负债率 {de:.0f}%，脆弱性高")
        elif de and de < 30:
            score += 2; parts.append("极低负债，反脆弱")
        cr = _safe(info.get("current_ratio"))
        if cr and cr > 2.0:
            score += 1; parts.append("充裕流动性")
        if not ohlcv.empty and len(ohlcv) > 60:
            ret = ohlcv["close"].astype(float).pct_change().dropna()
            kurt = float(ret.kurtosis()) if len(ret) > 20 else 0
            if kurt > 5:
                score -= 1; parts.append(f"峰度 {kurt:.1f}，尾部风险大")
            skew = float(ret.skew()) if len(ret) > 20 else 0
            if skew > 0.5:
                score += 1; parts.append("正偏态，潜在非对称上涨")
        mc = _safe(info.get("market_cap"))
        if mc and mc > 100e9:
            score += 0.5; parts.append("大市值，系统性风险较低")
        signal, conf = _score_to_signal(score, 5)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "数据不足",
            metrics={"score": round(score, 1), "max": 5},
        )


# ── Jesse Livermore (NEW) ────────────────────────────────────────────────────

class JesseLivermore(MasterInvestor):
    profile = MasterProfile(
        key="jesse_livermore", name_en="Jesse Livermore", name_cn="杰西·利弗莫尔",
        title="股市投机之王", philosophy="跟随趋势交易，在关键位突破时重仓，严格止损",
        icon="👑",
    )

    def analyze(self, symbol, ohlcv, info=None):
        score, parts = 0.0, []
        if ohlcv.empty or len(ohlcv) < 30:
            return AnalystSignal(
                analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
                signal=SignalDirection.NEUTRAL, confidence=0.0, reasoning="数据不足",
            )
        close = ohlcv["close"].astype(float)
        high = ohlcv["high"].astype(float)
        volume = ohlcv["volume"].astype(float)
        high20 = high.rolling(20, min_periods=10).max()
        if close.iloc[-1] >= high20.iloc[-1]:
            vol_avg = volume.iloc[-5:].mean() / (volume.iloc[-20:].mean() + 1)
            if vol_avg > 1.3:
                score += 3; parts.append("突破近 20 日新高且放量，经典 Livermore 多头突破信号")
            else:
                score += 1; parts.append("触及近期高点但量能不足")
        ma10 = close.rolling(10, min_periods=5).mean()
        if close.iloc[-1] > ma10.iloc[-1]:
            score += 1; parts.append("站上 10 日均线")
        else:
            score -= 1; parts.append("跌破 10 日均线，纪律止损")
        ret_5d = close.iloc[-1] / close.iloc[-min(5, len(close))] - 1
        if ret_5d > 0.05:
            score += 1; parts.append(f"5 日涨幅 {ret_5d:.1%}，动量强")
        signal, conf = _score_to_signal(score, 5)
        return AnalystSignal(
            analyst=self.profile.key, analyst_display=f"{self.profile.icon} {self.profile.name_cn}",
            signal=signal, confidence=conf,
            reasoning="；".join(parts) if parts else "中性",
            metrics={"score": round(score, 1), "max": 5},
        )


# ── Registry ─────────────────────────────────────────────────────────────────

ALL_MASTERS: list[MasterInvestor] = [
    WarrenBuffett(),
    CharlieMunger(),
    BenGraham(),
    PeterLynch(),
    CathieWood(),
    MichaelBurry(),
    StanleyDruckenmiller(),
    AswathDamodaran(),
    BillAckman(),
    PhilFisher(),
    GeorgeSoros(),
    RayDalio(),
    NassimTaleb(),
    JesseLivermore(),
]


def get_master_profiles() -> list[dict]:
    return [
        {
            "key": m.profile.key,
            "name_en": m.profile.name_en,
            "name_cn": m.profile.name_cn,
            "title": m.profile.title,
            "philosophy": m.profile.philosophy,
            "icon": m.profile.icon,
        }
        for m in ALL_MASTERS
    ]
