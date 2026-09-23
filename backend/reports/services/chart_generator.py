"""Generates report-ready charts (PNG) from backend data.

Uses matplotlib (Agg) so no browser is needed. The Nepal province map is
drawn from the same SVG boundary shapes used by the frontend map
(`reports/services/nepal_map_data.py`), coloured with database values.
"""

import io
import math
import re

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib import path as mplpath
from matplotlib.patches import PathPatch
from matplotlib.colors import Normalize
from matplotlib.cm import ScalarMappable
from matplotlib.backends.backend_agg import FigureCanvasAgg

from .nepal_map_data import NEPAL_MAP_VIEWBOX, PROVINCE_PATHS

ACCENT = "#b70011"
PRIMARY = "#0051d5"
SUCCESS = "#0f7a3d"
GRID = "#d9d3d1"
TEXT = "#20202a"

_NUM_RE = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")
_CMD_RE = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]")
_PARAMS = {
    "M": 2, "L": 2, "H": 1, "V": 1,
    "C": 6, "S": 4, "Q": 4, "T": 2, "A": 7, "Z": 0,
}

_MOVETO = mplpath.Path.MOVETO
_LINETO = mplpath.Path.LINETO
_CURVE3 = mplpath.Path.CURVE3
_CURVE4 = mplpath.Path.CURVE4
_CLOSE = mplpath.Path.CLOSEPOLY


def _two_angle(ux, uy, vx, vy):
    dot = ux * vx + uy * vy
    length = math.hypot(ux, uy) * math.hypot(vx, vy)
    if length == 0:
        return 0.0
    angle = math.acos(max(-1.0, min(1.0, dot / length)))
    if ux * vy - uy * vx < 0:
        angle = -angle
    return angle


def _arc_points(x1, y1, rx, ry, phi_deg, large_arc, sweep, x2, y2, steps_per_full=48):
    """SVG elliptical arc -> sampled line points (standard endpoint-to-center)."""
    if rx == 0 or ry == 0 or (x1 == x2 and y1 == y2):
        return [(x1, y1)]
    rx, ry = abs(rx), abs(ry)
    phi = math.radians(float(phi_deg) % 360.0)
    cos_p, sin_p = math.cos(phi), math.sin(phi)

    dx = (x1 - x2) / 2.0
    dy = (y1 - y2) / 2.0
    x1p = cos_p * dx + sin_p * dy
    y1p = -sin_p * dx + cos_p * dy

    radii_check = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if radii_check > 1:
        scale = math.sqrt(radii_check)
        rx *= scale
        ry *= scale

    sign = -1.0 if bool(large_arc) == bool(sweep) else 1.0
    numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    coef = sign * math.sqrt(max(0.0, numerator / denominator)) if denominator else 0.0
    cxp = coef * (rx * y1p / ry)
    cyp = coef * (-ry * x1p / rx)

    cx = cos_p * cxp - sin_p * cyp + (x1 + x2) / 2.0
    cy = sin_p * cxp + cos_p * cyp + (y1 + y2) / 2.0

    ux = (x1p - cxp) / rx
    uy = (y1p - cyp) / ry
    vx = (-x1p - cxp) / rx
    vy = (-y1p - cyp) / ry

    theta1 = _two_angle(1.0, 0.0, ux, uy)
    delta = _two_angle(ux, uy, vx, vy)
    if sweep == 0 and delta > 0:
        delta -= 2 * math.pi
    elif sweep == 1 and delta < 0:
        delta += 2 * math.pi

    count = max(4, int(abs(delta) / (2 * math.pi) * steps_per_full))
    points = []
    for step in range(count + 1):
        t = theta1 + delta * step / count
        ellipse_x = rx * math.cos(t)
        ellipse_y = ry * math.sin(t)
        points.append(
            (cx + cos_p * ellipse_x - sin_p * ellipse_y,
             cy + sin_p * ellipse_x + cos_p * ellipse_y)
        )
    return points


def _tokenize(d):
    """Splits an SVG path string into command / number tokens.

    Commas are treated as separators (legal in SVG attribute syntax) and
    consecutive numbers without a command belong to the previous command.
    """
    d = d.replace(",", " ")
    parts = re.split(r"([MmLlHhVvCcSsQqTtAaZz])", d)
    tokens = []
    for part in parts:
        if not part:
            continue
        if re.fullmatch(r"[MmLlHhVvCcSsQqTtAaZz]", part):
            tokens.append(part)
        else:
            tokens.extend(num for num in part.split() if num)
    return tokens


def path_from_svg(d):
    """Parses an SVG path `d` string into a matplotlib Path (per subpath)."""
    tokens = _tokenize(d)
    paths = []
    verts, codes = [], []

    cur_x, cur_y = 0.0, 0.0
    start_x, start_y = 0.0, 0.0
    prev_ctrl = None

    def close():
        nonlocal cur_x, cur_y
        if verts:
            verts.append((cur_x, cur_y))
            codes.append(_CLOSE)
        cur_x, cur_y = start_x, start_y

    def moveto(x, y, rel):
        nonlocal cur_x, cur_y, start_x, start_y
        if rel:
            x, y = cur_x + x, cur_y + y
        cur_x, cur_y = start_x, start_y = x, y
        verts.append((x, y))
        codes.append(_MOVETO)

    def lineto(x, y, rel):
        nonlocal cur_x, cur_y
        if rel:
            x, y = cur_x + x, cur_y + y
        cur_x, cur_y = x, y
        verts.append((x, y))
        codes.append(_LINETO)

    def hline(x, rel):
        nonlocal cur_x, cur_y
        x = cur_x + x if rel else x
        cur_x = x
        verts.append((x, cur_y))
        codes.append(_LINETO)

    def vline(y, rel):
        nonlocal cur_x, cur_y
        y = cur_y + y if rel else y
        cur_y = y
        verts.append((cur_x, y))
        codes.append(_LINETO)

    def cubic(x1, y1, x2, y2, x, y, rel):
        nonlocal cur_x, cur_y, prev_ctrl
        if rel:
            x1, y1 = cur_x + x1, cur_y + y1
            x2, y2 = cur_x + x2, cur_y + y2
            x, y = cur_x + x, cur_y + y
        for px, py in ((x1, y1), (x2, y2), (x, y)):
            verts.append((px, py))
            codes.append(_CURVE4)
        prev_ctrl = (x2, y2)
        cur_x, cur_y = x, y

    def smooth_cubic(x2, y2, x, y, rel):
        nonlocal cur_x, cur_y, prev_ctrl
        if prev_ctrl is None:
            x1, y1 = cur_x, cur_y
        else:
            x1, y1 = 2 * cur_x - prev_ctrl[0], 2 * cur_y - prev_ctrl[1]
        cubic(x1, y1, x2, y2, x, y, rel=rel)

    def quad(x1, y1, x, y, rel):
        nonlocal cur_x, cur_y, prev_ctrl
        if rel:
            x1, y1 = cur_x + x1, cur_y + y1
            x, y = cur_x + x, cur_y + y
        verts.append((x1, y1))
        codes.append(_CURVE3)
        verts.append((x, y))
        codes.append(_CURVE3)
        prev_ctrl = (x1, y1)
        cur_x, cur_y = x, y

    def smooth_quad(x, y, rel):
        nonlocal cur_x, cur_y, prev_ctrl
        if prev_ctrl is None:
            x1, y1 = cur_x, cur_y
        else:
            x1, y1 = 2 * cur_x - prev_ctrl[0], 2 * cur_y - prev_ctrl[1]
        quad(x1, y1, x, y, rel=rel)

    def arc(rx, ry, phi, large, sweep, x, y, rel):
        nonlocal cur_x, cur_y
        start = (cur_x, cur_y)
        end = (cur_x + x, cur_y + y) if rel else (x, y)
        points = _arc_points(start[0], start[1], rx, ry, phi, large, sweep, end[0], end[1])
        for px, py in points[1:]:
            cur_x, cur_y = px, py
            verts.append((px, py))
            codes.append(_LINETO)
        cur_x, cur_y = end

    handlers = {
        "M": lambda xs: moveto(xs[0], xs[1], False),
        "m": lambda xs: moveto(xs[0], xs[1], True),
        "L": lambda xs: lineto(xs[0], xs[1], False),
        "l": lambda xs: lineto(xs[0], xs[1], True),
        "H": lambda xs: hline(xs[0], False),
        "h": lambda xs: hline(xs[0], True),
        "V": lambda xs: vline(xs[0], False),
        "v": lambda xs: vline(xs[0], True),
        "C": lambda xs: cubic(xs[0], xs[1], xs[2], xs[3], xs[4], xs[5], False),
        "c": lambda xs: cubic(xs[0], xs[1], xs[2], xs[3], xs[4], xs[5], True),
        "S": lambda xs: smooth_cubic(xs[0], xs[1], xs[2], xs[3], False),
        "s": lambda xs: smooth_cubic(xs[0], xs[1], xs[2], xs[3], True),
        "Q": lambda xs: quad(xs[0], xs[1], xs[2], xs[3], False),
        "q": lambda xs: quad(xs[0], xs[1], xs[2], xs[3], True),
        "T": lambda xs: smooth_quad(xs[0], xs[1], False),
        "t": lambda xs: smooth_quad(xs[0], xs[1], True),
        "A": lambda xs: arc(xs[0], xs[1], xs[2], xs[3], xs[4], xs[5], xs[6], False),
        "a": lambda xs: arc(xs[0], xs[1], xs[2], xs[3], xs[4], xs[5], xs[6], True),
    }

    index = 0
    cmd = "M"
    while index < len(tokens):
        token = tokens[index]
        if re.fullmatch(r"[MmLlHhVvCcSsQqTtAaZz]", token):
            cmd = token
            index += 1
            if cmd in "Zz":
                close()
                prev_ctrl = None
            continue

        required = _PARAMS[cmd.upper()]
        ns = []
        for _ in range(required):
            if index >= len(tokens) or re.fullmatch(r"[MmLlHhVvCcSsQqTtAaZz]", tokens[index]):
                break
            ns.append(float(tokens[index]))
            index += 1
        if ns:
            handlers[cmd](ns[:required])

    if verts:
        paths.append(mplpath.Path(verts, codes))
    return paths


def _clean_bytes(fig):
    canvas = FigureCanvasAgg(fig)
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=160, bbox_inches="tight")
    plt.close(fig)
    return buffer.getvalue()


def _style_axes(ax, grid_axis="y", legend_font=8):
    """Shared, clean styling for report charts (no top/right spines)."""
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.spines["bottom"].set_visible(True)
    ax.spines["bottom"].set_color("#d9d3d1")
    ax.spines["left"].set_visible(True)
    ax.spines["left"].set_color("#d9d3d1")
    ax.tick_params(colors=TEXT, labelsize=8)
    ax.grid(axis=grid_axis, color=GRID, linewidth=0.5, alpha=0.7)
    ax.set_axisbelow(True)
    ax.margins(y=0.12)


def _label_bars(ax, bars, template="{value:,.1f}", pad=5, textsize=8.5):
    for bar in bars:
        width = bar.get_width()
        if width is None:
            continue
        ax.annotate(
            template.format(value=width),
            (width, bar.get_y() + bar.get_height() / 2),
            textcoords="offset points",
            xytext=(pad if width >= 0 else -pad, 0),
            va="center", ha="left" if width >= 0 else "right",
            fontsize=textsize, color=TEXT,
        )


def _label_vertical_bars(ax, bars, template="{value:,.1f}", pad=3, textsize=8.5):
    for bar in bars:
        height = bar.get_height()
        if height is None:
            continue
        ax.annotate(
            template.format(value=height),
            (bar.get_x() + bar.get_width() / 2, height),
            textcoords="offset points",
            xytext=(0, pad),
            va="bottom", ha="center",
            fontsize=textsize, color=TEXT,
        )


_bar_style = _style_axes


def _fmt_compact(value):
    if value is None:
        return "n/a"
    if abs(value) >= 1_000_000:
        return f"{value / 1_000_000:,.1f}M"
    if abs(value) >= 1_000:
        return f"{value / 1_000:,.1f}k"
    return f"{value:,.0f}"


def _decimate_indices(n, max_labels=12):
    if n <= max_labels:
        return list(range(n))
    indices = {round(i * (n - 1) / (max_labels - 1)) for i in range(max_labels)}
    indices.add(0)
    indices.add(n - 1)
    return sorted(indices)


def _line_chart(ax, x, values, color, label_fmt="{value:,.1f}"):
    ax.plot(x, values, color=color, marker="o", linewidth=2.4, markersize=6, zorder=3)
    ax.fill_between(x, values, min(0, min(values)) if values else 0, color=color, alpha=0.10, zorder=1)
    n = len(values)
    dense = n > 12
    for i in _decimate_indices(n, 12):
        ax.annotate(
            label_fmt.format(value=values[i]), (x[i], values[i]), textcoords="offset points",
            xytext=(0, 9), ha="center", fontsize=7.5 if dense else 8.5, color=TEXT, zorder=4,
        )


def gdp_trend_chart(dataset):
    window = dataset.get("gdp_window") or []
    if not window:
        return None
    years = [str(point["year"]) for point in window]
    values = [point["value"] for point in window]
    x = list(range(len(values)))

    fig, ax = plt.subplots(figsize=(6.8, 3.4))
    ax.axhline(0, color="#bdb5b3", linewidth=1, zorder=1)
    _line_chart(ax, x, values, ACCENT, "{value:,.1f}%")
    ax.set_xticks(x, years, fontsize=8.5)
    ax.set_xlabel("Year")
    ax.set_ylabel("Real growth (%)", fontsize=9)
    _style_axes(ax)
    ax.xaxis.grid(False)
    fig.tight_layout()
    return _clean_bytes(fig)


def population_distribution_chart(dataset):
    provinces = dataset.get("provinces") or []
    if not provinces:
        return None
    ordered = sorted(provinces, key=lambda p: p["pct"])
    names = [p["name"] for p in ordered]
    values = [p["pct"] for p in ordered]

    fig, ax = plt.subplots(figsize=(6.8, 4.0))
    bars = ax.barh(names, values, color=PRIMARY, alpha=0.92, height=0.62)
    _label_bars(ax, bars, "{value:,.1f}%")
    ax.set_xlabel("Share of national population (%)", fontsize=9)
    ax.set_xlim(0, max(values) * 1.18)
    _style_axes(ax, grid_axis="y")
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    return _clean_bytes(fig)


def density_chart(dataset):
    provinces = [p for p in dataset.get("provinces") or [] if p.get("population_density") is not None]
    if not provinces:
        return None
    ordered = sorted(provinces, key=lambda p: p["population_density"])
    names = [p["name"] for p in ordered]
    values = [p["population_density"] for p in ordered]

    fig, ax = plt.subplots(figsize=(6.8, 4.0))
    bars = ax.barh(names, values, color=ACCENT, alpha=0.92, height=0.62)
    _label_bars(ax, bars, "{value:,.1f}")
    ax.set_xlabel("Population density (persons/km²)", fontsize=9)
    ax.set_xlim(0, max(values) * 1.16)
    _style_axes(ax, grid_axis="y")
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    return _clean_bytes(fig)


def sectoral_chart(dataset):
    sectors = (dataset.get("sectoral") or {}).get("sectors") or []
    if not sectors:
        return None
    ordered = sorted(sectors, key=lambda s: s["value"])
    names = [s["sector"] for s in ordered]
    values = [s["value"] for s in ordered]

    fig, ax = plt.subplots(figsize=(6.8, 3.8))
    colors_list = [SUCCESS if v >= 0 else ACCENT for v in values]
    bars = ax.barh(names, values, color=colors_list, alpha=0.92, height=0.62)
    _label_bars(ax, bars, "{value:,.1f}%")
    ax.axvline(0, color="#c9c1bf", linewidth=0.8)
    ax.set_xlabel(f"Growth ({sectors[0]['unit'] if sectors else '%'})", fontsize=9)
    ax.set_xlim(min(values) * 1.2 if min(values) < 0 else 0, max(values) * 1.22)
    _style_axes(ax, grid_axis="y")
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    return _clean_bytes(fig)


def _flip_path(subpath, top_y):
    """Flips an SVG path (y-down) into matplotlib coordinates (y-up).

    SVG boundaries are authored for direct SVG rendering where y grows
    downward, so north sits at *low* y values. matplotlib grows y upward,
    which would otherwise render the map upside down.
    """
    vertices = [(x, top_y - y) for x, y in subpath.vertices]
    return mplpath.Path(vertices, subpath.codes)


def province_map_chart(dataset):
    """Choropleth of population density from the real province boundaries."""
    provinces = {p["province_code"]: p for p in dataset.get("provinces") or []}
    density_by_id = {
        code: p["population_density"] for code, p in provinces.items() if p.get("population_density") is not None
    }
    if not density_by_id:
        return None

    min_x, min_y, width, height = [float(v) for v in NEPAL_MAP_VIEWBOX.split()]
    top_y = min_y + height

    # Size the figure exactly around the map shape so the completed map is
    # centred with the colour bar tucked beside it (no letter-boxing skew).
    data_aspect = width / height
    cbar_frac = 0.085
    fig_w, fig_h = 6.9, 6.9 / (data_aspect * (1 + cbar_frac))
    fig = plt.figure(figsize=(fig_w, fig_h))
    ax = fig.add_axes([0.01, 0.02, 0.90, 0.96])

    cmap = plt.get_cmap("Reds")
    vmin = min(density_by_id.values())
    vmax = max(density_by_id.values())
    norm = Normalize(vmin=vmin, vmax=vmax)

    for shape in PROVINCE_PATHS:
        code = shape["id"]
        for raw_subpath in path_from_svg(shape["d"]):
            subpath = _flip_path(raw_subpath, top_y)
            density = density_by_id.get(code)
            color = cmap(norm(density)) if density is not None else "#f1ecea"
            patch = PathPatch(subpath, facecolor=color, edgecolor="#ffffff", linewidth=1.4)
            ax.add_patch(patch)
            bx0, by0 = subpath.get_extents().p0
            bx1, by1 = subpath.get_extents().p1
            cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
            cy = min(cy, by0 + (by1 - by0) * 0.9)
            ax.text(cx, cy, str(code), ha="center", va="center", fontsize=9,
                    fontweight="bold", color="#3d0b0f" if density is not None else "#6b6b76")

    ax.set_xlim(min_x, min_x + width)
    ax.set_ylim(min_y, min_y + height)
    ax.set_aspect("equal")
    ax.axis("off")

    scalar = ScalarMappable(norm=norm, cmap=cmap)
    scalar.set_array([])
    cbar_ax = fig.add_axes([0.925, 0.06, 0.035, 0.90])
    cbar = fig.colorbar(scalar, cax=cbar_ax)
    cbar.set_label("Population density (persons/km²)", fontsize=9)
    cbar.ax.tick_params(labelsize=8)

    canvas = FigureCanvasAgg(fig)
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", dpi=160)
    plt.close(fig)
    return buffer.getvalue()


def build_all(dataset):
    """Returns a dict of PNG byte strings for every chart used by the PDF."""
    return {
        "gdp_trend": gdp_trend_chart(dataset),
        "population_distribution": population_distribution_chart(dataset),
        "density": density_chart(dataset),
        "sectoral": sectoral_chart(dataset),
    }


def tourism_arrivals_chart(dataset):
    trend = dataset.get("arrival_trend") or []
    window = trend[-12:]
    if not window:
        return None
    years = [str(p["year"]) for p in window]
    values = [p.get("total_arrivals") or 0 for p in window]
    x = list(range(len(values)))

    fig, ax = plt.subplots(figsize=(6.8, 3.4))
    _line_chart(ax, x, values, ACCENT, "{value:,.0f}")
    ax.set_xticks(x, years, fontsize=8.5)
    ax.set_xlabel("Year")
    ax.set_ylabel("Total arrivals", fontsize=9)
    _style_axes(ax)
    ax.xaxis.grid(False)
    fig.tight_layout()
    return _clean_bytes(fig)


def tourism_source_markets_chart(dataset):
    markets = sorted(
        dataset.get("source_market_top") or dataset.get("source_markets") or [],
        key=lambda m: (m.get("arrivals") or 0),
    )
    names = [m["nationality"] for m in markets]
    values = [m.get("arrivals") or 0 for m in markets]
    if not names:
        return None

    fig, ax = plt.subplots(figsize=(6.8, 4.6))
    bars = ax.barh(names, values, color=PRIMARY, alpha=0.92, height=0.62)
    _label_bars(ax, bars, "{value:,.0f}")
    year = dataset.get("source_market_year")
    ax.set_xlabel(f"Arrivals ({year})" if year else "Arrivals", fontsize=9)
    ax.set_xlim(0, max(values) * 1.18)
    _style_axes(ax, grid_axis="y")
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    return _clean_bytes(fig)


def tourism_revenue_chart(dataset):
    revenue = dataset.get("revenue") or []
    if not revenue:
        return None
    labels = [p["fiscal_year"] for p in revenue]
    values = [p.get("value") or 0 for p in revenue]
    x = list(range(len(labels)))

    fig, ax = plt.subplots(figsize=(6.8, 3.4))
    _line_chart(ax, x, values, "#5a3f00", "{value:,.0f}")
    tick_indices = _decimate_indices(len(values), 9)
    ax.set_xticks([x[i] for i in tick_indices], [labels[i] for i in tick_indices], rotation=28, ha="right", fontsize=8)
    ax.set_xlabel("Fiscal year")
    ax.set_ylabel("Revenue (US$ million)", fontsize=9)
    _style_axes(ax)
    ax.xaxis.grid(False)
    fig.tight_layout()
    return _clean_bytes(fig)


def tourism_stay_chart(dataset):
    stay = dataset.get("avg_stay_trend") or []
    pairs = [(str(p["year"]), p.get("value")) for p in stay if p.get("value") is not None]
    if not pairs:
        return None
    years = [year for year, _ in pairs]
    values = [value for _, value in pairs]
    x = list(range(len(values)))

    fig, ax = plt.subplots(figsize=(6.8, 3.4))
    _line_chart(ax, x, values, ACCENT, "{value:,.1f}")
    tick_indices = _decimate_indices(len(values), 10)
    ax.set_xticks([x[i] for i in tick_indices], [years[i] for i in tick_indices], fontsize=8)
    ax.set_xlabel("Year")
    ax.set_ylabel("Average length of stay (days)", fontsize=9)
    _style_axes(ax)
    ax.xaxis.grid(False)
    fig.tight_layout()
    return _clean_bytes(fig)


def tourism_purpose_chart(dataset):
    rows = [
        roster for roster in dataset.get("purpose_trend") or []
        if roster.get("value")
    ]
    year = dataset.get("latest_purpose_year")
    if year is not None:
        rows = [roster for roster in rows if roster.get("year") == year]
    rows = sorted(rows, key=lambda roster: roster.get("value") or 0)
    names = [roster["category"] for roster in rows]
    values = [roster.get("value") or 0 for roster in rows]
    if not names:
        return None

    fig, ax = plt.subplots(figsize=(6.8, 4.0))
    bars = ax.barh(names, values, color="#5a3f00", alpha=0.92, height=0.62)
    _label_bars(ax, bars, "{value:,.0f}")
    ax.set_xlabel(f"Arrivals ({year})" if year else "Arrivals", fontsize=9)
    ax.set_xlim(0, max(values) * 1.18)
    _style_axes(ax, grid_axis="y")
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    return _clean_bytes(fig)


def tourism_trekking_chart(dataset):
    rows = [
        roster for roster in dataset.get("trekking_trend") or []
        if roster.get("trekkers")
    ]
    year = dataset.get("latest_trekking_year")
    if year is not None:
        rows = [roster for roster in rows if roster.get("year") == year]
    rows = sorted(rows, key=lambda roster: roster.get("trekkers") or 0)
    names = [roster["region"] for roster in rows]
    values = [roster.get("trekkers") or 0 for roster in rows]
    if not names:
        return None

    fig, ax = plt.subplots(figsize=(6.8, 4.0))
    bars = ax.barh(names, values, color="#0f7a3d", alpha=0.92, height=0.62)
    _label_bars(ax, bars, "{value:,.0f}")
    ax.set_xlabel(f"Trekkers ({year})" if year else "Trekkers", fontsize=9)
    ax.set_xlim(0, max(values) * 1.18)
    _style_axes(ax, grid_axis="y")
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    return _clean_bytes(fig)


def tourism_sex_chart(dataset):
    rows = [
        roster for roster in dataset.get("sex_trend") or []
        if (roster.get("statistic_type") or "").strip().lower() == "number"
        and roster.get("value")
    ]
    year = dataset.get("latest_sex_year")
    if year is not None:
        rows = [roster for roster in rows if roster.get("year") == year]
    rows = sorted(rows, key=lambda roster: roster.get("value") or 0)
    names = [roster["gender"] for roster in rows]
    values = [roster.get("value") or 0 for roster in rows]
    if not names:
        return None

    colors_list = ["#0051d5" if "female" in str(n).lower() else "#b70011" for n in names]
    fig, ax = plt.subplots(figsize=(6.8, 2.6))
    bars = ax.barh(names, values, color=colors_list, alpha=0.92, height=0.5)
    _label_bars(ax, bars, "{value:,.0f}")
    ax.set_xlabel(f"Arrivals ({year})" if year else "Arrivals", fontsize=9)
    ax.set_xlim(0, max(values) * 1.18)
    _style_axes(ax, grid_axis="y")
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    return _clean_bytes(fig)


def tourism_age_chart(dataset):
    rows = [
        roster for roster in dataset.get("age_trend") or []
        if roster.get("value")
    ]
    year = dataset.get("latest_age_year")
    if year is not None:
        rows = [roster for roster in rows if roster.get("year") == year]
    rows = sorted(rows, key=lambda roster: roster.get("value") or 0)
    names = [roster["age_group"] for roster in rows]
    values = [roster.get("value") or 0 for roster in rows]
    if not names:
        return None

    fig, ax = plt.subplots(figsize=(6.8, 4.0))
    bars = ax.barh(names, values, color="#6a1b9a", alpha=0.92, height=0.62)
    _label_bars(ax, bars, "{value:,.0f}")
    ax.set_xlabel(f"Arrivals ({year})" if year else "Arrivals", fontsize=9)
    ax.set_xlim(0, max(values) * 1.18)
    _style_axes(ax, grid_axis="y")
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    return _clean_bytes(fig)


def tourism_province_chart(dataset):
    province_tourism = dataset.get("province_tourism") or {}
    rows = [
        item for item in province_tourism.get("latest") or []
        if item.get("visitors")
    ]
    if not rows:
        return None
    rows = sorted(rows, key=lambda item: item.get("visitors") or 0)
    names = [item["province"] for item in rows]
    values = [item.get("visitors") or 0 for item in rows]
    year = province_tourism.get("latest_year")

    fig, ax = plt.subplots(figsize=(6.8, 4.0))
    bars = ax.barh(names, values, color=ACCENT, alpha=0.92, height=0.62)
    _label_bars(ax, bars, "{value:,.0f}")
    ax.set_xlabel(f"Official visits ({year})" if year else "Official visits", fontsize=9)
    ax.set_xlim(0, max(values) * 1.18)
    _style_axes(ax, grid_axis="y")
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    return _clean_bytes(fig)


def economic_growth_chart(dataset):
    growth = dataset.get("global_growth") or []
    window = growth[-10:]
    if not window:
        return None
    years = [str(p["year"]).replace("Real_", "") for p in window]
    values = [p["value"] for p in window]
    x = list(range(len(values)))

    fig, ax = plt.subplots(figsize=(6.8, 3.4))
    ax.axhline(0, color="#bdb5b3", linewidth=1, zorder=1)
    _line_chart(ax, x, values, PRIMARY, "{value:,.1f}%")
    ax.set_xticks(x, years, fontsize=8.5)
    ax.set_xlabel("Year")
    ax.set_ylabel("Real growth (%)", fontsize=9)
    _style_axes(ax)
    ax.xaxis.grid(False)
    fig.tight_layout()
    return _clean_bytes(fig)


def economic_trade_chart(dataset):
    pairs = (dataset.get("trade_by_year") or [])[-6:]
    if not pairs:
        return None
    labels = [p["fiscal_year"] for p in pairs]
    exports = [p.get("exports") for p in pairs]
    imports = [p.get("imports") for p in pairs]
    x = list(range(len(labels)))
    width = 0.36

    fig, ax = plt.subplots(figsize=(6.8, 3.6))
    export_bars = ax.bar([i - width / 2 for i in x], exports, width, color=SUCCESS, label="Exports")
    import_bars = ax.bar([i + width / 2 for i in x], imports, width, color=ACCENT, label="Imports")
    ax.axhline(0, color="#c9c1bf", linewidth=0.8, zorder=1)
    ax.set_xticks(x, labels, rotation=28, ha="right", fontsize=8)
    ax.legend(fontsize=8, frameon=False, loc="upper left")
    _style_axes(ax, grid_axis="y")
    ax.set_ylabel("Value (units as recorded)", fontsize=9)
    fig.tight_layout()
    return _clean_bytes(fig)


def economic_sectoral_chart(dataset):
    sectors = dataset.get("sectoral_growth") or []
    latest_year = dataset.get("latest_sectoral_year")
    latest = [
        s for s in sectors
        if s["fiscal_year"] == latest_year and s.get("value") is not None
    ]
    ordered = sorted(latest, key=lambda s: s["value"])[-12:]
    names = [s["sector"] for s in ordered]
    values = [s["value"] for s in ordered]
    if not names:
        return None

    fig, ax = plt.subplots(figsize=(6.8, 5.0))
    colors_list = [SUCCESS if v >= 0 else ACCENT for v in values]
    bars = ax.barh(names, values, color=colors_list, alpha=0.92, height=0.62)
    _label_bars(ax, bars, "{value:,.1f}%")
    ax.axvline(0, color="#c9c1bf", linewidth=0.8)
    ax.set_xlabel(f"Growth (%) — {latest_year}" if latest_year else "Growth (%)", fontsize=9)
    ax.set_xlim(min(values) * 1.2 if min(values) < 0 else 0, max(values) * 1.2)
    _style_axes(ax, grid_axis="y")
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    return _clean_bytes(fig)


def economic_province_gdp_chart(dataset):
    province_gdp = dataset.get("province_gdp") or {}
    latest = province_gdp.get("latest")
    if not latest or not latest.get("provinces"):
        return None
    pairs = [
        (province, latest["provinces"][province].get("growth_basic_price"))
        for province in province_gdp.get("provinces") or []
        if province in latest["provinces"] and latest["provinces"][province].get("growth_basic_price") is not None
    ]
    if not pairs:
        return None
    names = [name for name, _ in pairs]
    values = [value for _, value in pairs]
    x = list(range(len(values)))

    fig, ax = plt.subplots(figsize=(6.8, 3.6))
    colors_list = [SUCCESS if value >= 0 else ACCENT for value in values]
    bars = ax.bar(x, values, color=colors_list, alpha=0.92, width=0.62)
    _label_vertical_bars(ax, bars, "{value:,.1f}%")
    ax.axhline(0, color="#c9c1bf", linewidth=0.8)
    ax.set_xticks(x, names, rotation=28, ha="right", fontsize=7.5)
    ax.set_ylabel(f"GDP growth (%) — {latest.get('fiscal_year')}" if latest.get("fiscal_year") else "GDP growth (%)", fontsize=9)
    _style_axes(ax, grid_axis="y")
    ax.grid(axis="y", visible=False)
    ax.set_xlim(-0.5, len(values) - 0.5)
    fig.tight_layout()
    return _clean_bytes(fig)


def economic_economies_chart(dataset):
    rows = (dataset.get("economies_growth") or [])[-15:]
    if not rows:
        return None
    years = [str(row["year"]).replace("Real_", "") for row in rows]
    contexts = sorted({key for row in rows for key in row if key != "year"})
    palette = [PRIMARY, SUCCESS, ACCENT, "#e6a700", "#7c4dff", "#009688", "#d81b60", "#455a64"]
    colors = dict(zip(contexts, palette))

    fig, ax = plt.subplots(figsize=(6.8, 3.8))
    _style_axes(ax, grid_axis="y")
    tick_indices = _decimate_indices(len(years), 8)
    for context in contexts:
        values = [row.get(context) for row in rows]
        ax.plot(list(range(len(values))), values, color=colors[context], linewidth=2, markersize=4, marker="o", label=context, zorder=3)
    ax.set_xticks([x for x in tick_indices], [years[i] for i in tick_indices], fontsize=7.5)
    ax.legend(fontsize=7, frameon=False, loc="upper left", ncol=2)
    ax.set_ylabel("Real growth (%)", fontsize=9)
    fig.tight_layout()
    return _clean_bytes(fig)


def economic_overall_chart(dataset):
    rows = (dataset.get("overall_growth") or [])[-8:]
    if not rows:
        return None
    labels = [row["fiscal_year"] for row in rows]
    categories = [
        ("agriculture", "Agriculture", SUCCESS),
        ("nonagriculture", "Non-agriculture", PRIMARY),
        ("industry", "Industry", ACCENT),
        ("service", "Service", "#e6a700"),
    ]
    x = list(range(len(labels)))
    n = len(categories)

    fig, ax = plt.subplots(figsize=(6.8, 3.6))
    width = 0.72 / n
    for offset, (key, label, color) in enumerate(categories):
        values = [row.get(key) for row in rows]
        ax.bar([i + (offset - n / 2) * width for i in x], values, width, color=color, alpha=0.92, label=label)
    ax.axhline(0, color="#c9c1bf", linewidth=0.8, zorder=1)
    ax.set_xticks(x, labels, rotation=28, ha="right", fontsize=8)
    ax.legend(fontsize=8, frameon=False, loc="upper left")
    _style_axes(ax, grid_axis="y")
    ax.set_ylabel("Growth (%)", fontsize=9)
    fig.tight_layout()
    return _clean_bytes(fig)


def economic_partners_chart(dataset, direction):
    key = "exports_by_partner" if direction == "exports" else "imports_by_partner"
    rows = (dataset.get(key) or [])[-6:]
    if not rows:
        return None
    labels = [row["fiscal_year"] for row in rows]
    partners = [
        ("India", "India", PRIMARY),
        ("China", "China", ACCENT),
        ("Other Countries", "Other countries", SUCCESS),
    ]
    x = list(range(len(labels)))
    n = len(partners)

    fig, ax = plt.subplots(figsize=(6.8, 3.6))
    width = 0.72 / n
    for offset, (key, label, color) in enumerate(partners):
        values = [row.get(key) for row in rows]
        ax.bar([i + (offset - n / 2) * width for i in x], values, width, color=color, alpha=0.92, label=label)
    ax.axhline(0, color="#c9c1bf", linewidth=0.8, zorder=1)
    ax.set_xticks(x, labels, rotation=28, ha="right", fontsize=8)
    ax.legend(fontsize=8, frameon=False, loc="upper left")
    _style_axes(ax, grid_axis="y")
    ax.set_ylabel(f"{direction.capitalize()} (units as recorded)", fontsize=9)
    fig.tight_layout()
    return _clean_bytes(fig)


def economic_balance_chart(dataset):
    rows = (dataset.get("trade_balance") or [])[-10:]
    if not rows:
        return None
    labels = [row["fiscal_year"] for row in rows]
    values = [row["value"] for row in rows]
    x = list(range(len(values)))

    fig, ax = plt.subplots(figsize=(6.8, 3.4))
    ax.axhline(0, color="#bdb5b3", linewidth=1, zorder=1)
    _line_chart(ax, x, values, SUCCESS, "{value:,.0f}")
    ax.set_xticks(x, labels, rotation=28, ha="right", fontsize=8)
    ax.set_ylabel("Trade balance (units as recorded)", fontsize=9)
    _style_axes(ax)
    ax.xaxis.grid(False)
    fig.tight_layout()
    return _clean_bytes(fig)


def economic_salary_chart(dataset):
    rows = dataset.get("salary_index") or []
    groups = ["Overall Index", "Wage Rate Index", "Government Service", "Education", "Bank & Financial Institutions"]
    palette = [PRIMARY, ACCENT, SUCCESS, "#e6a700", "#7c4dff"]
    series = []
    for group, color in zip(groups, palette):
        points = [row for row in rows if row.get("group") == group]
        if points:
            series.append((group, points, color))
    if not series:
        return None
    years = sorted({row["year"] for row in rows})
    x = list(range(len(years)))

    fig, ax = plt.subplots(figsize=(6.8, 3.8))
    _style_axes(ax, grid_axis="y")
    for group, points, color in series:
        values = [
            next((row["value"] for row in points if row["year"] == year), None)
            for year in years
        ]
        ax.plot(x, values, color=color, linewidth=2, markersize=4, marker="o", label=group, zorder=3)
    ax.set_xticks([x[i] for i in _decimate_indices(len(years), 9)], [years[i] for i in _decimate_indices(len(years), 9)], rotation=28, ha="right", fontsize=7.5)
    ax.legend(fontsize=7.5, frameon=False, loc="upper left", ncol=2)
    ax.set_ylabel("Index", fontsize=9)
    fig.tight_layout()
    return _clean_bytes(fig)


def economic_appi_chart(dataset):
    rows = dataset.get("appi") or []
    if not rows:
        return None
    by_year = {}
    for row in rows:
        by_year.setdefault(row["base_year"], []).append(row)
    candidates = sorted(
        (year for year, items in by_year.items() if any(i.get("quarter") == "ANN" for i in items)),
        key=lambda year: int(_NUM_RE.search(str(year)).group(0)) if _NUM_RE.search(str(year)) else 0,
    )
    selected_rows = by_year[candidates[-1]] if candidates else rows[-len(rows):]
    annual = [row for row in selected_rows if row.get("quarter") == "ANN"]
    chart_rows = annual if annual else selected_rows
    ordered = sorted(chart_rows, key=lambda row: row["value"])[::-1]
    names = [row["product"] for row in ordered]
    values = [row["value"] for row in ordered]
    base_year = ordered[0]["base_year"] if ordered else ""
    quarter = ordered[0]["quarter"] if ordered else ""

    fig, ax = plt.subplots(figsize=(6.8, 5.6))
    bars = ax.barh(names, values, color=PRIMARY, alpha=0.92, height=0.62)
    _label_bars(ax, bars, "{value:,.1f}")
    ax.set_xlabel(f"Producer price index — {base_year} ({quarter})" if base_year else "Producer price index", fontsize=9)
    ax.set_xlim(0, max(values) * 1.18)
    _style_axes(ax, grid_axis="y")
    ax.grid(axis="y", visible=False)
    fig.tight_layout()
    return _clean_bytes(fig)


def build_tourism(dataset):
    """PNG bytes for every chart used by the tourism report."""
    return {
        "tourism_arrivals": tourism_arrivals_chart(dataset),
        "tourism_source_markets": tourism_source_markets_chart(dataset),
        "tourism_revenue": tourism_revenue_chart(dataset),
        "tourism_stay": tourism_stay_chart(dataset),
        "tourism_purpose": tourism_purpose_chart(dataset),
        "tourism_trekking": tourism_trekking_chart(dataset),
        "tourism_sex": tourism_sex_chart(dataset),
        "tourism_age": tourism_age_chart(dataset),
        "tourism_province": tourism_province_chart(dataset),
    }


def build_economic(dataset):
    """PNG bytes for every chart used by the economic report."""
    return {
        "economic_growth": economic_growth_chart(dataset),
        "economic_trade": economic_trade_chart(dataset),
        "economic_sectoral": economic_sectoral_chart(dataset),
        "economic_province_gdp": economic_province_gdp_chart(dataset),
        "economic_economies": economic_economies_chart(dataset),
        "economic_overall": economic_overall_chart(dataset),
        "economic_export_partners": economic_partners_chart(dataset, "exports"),
        "economic_import_partners": economic_partners_chart(dataset, "imports"),
        "economic_balance": economic_balance_chart(dataset),
        "economic_salary": economic_salary_chart(dataset),
        "economic_appi": economic_appi_chart(dataset),
    }