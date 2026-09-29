"""Assembles the comprehensive national dashboard report as a PDF.

Uses reportlab Platypus: A4 portrait, a designed cover page, body pages with
repeating header/footer and page numbers, tables with repeated headers, and
embedded matplotlib charts.
"""

import io
import re
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    HRFlowable,
    Image as RLImage,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

from xml.sax.saxutils import escape

ACCENT = colors.HexColor("#b70011")
ACCENT_DARK = colors.HexColor("#7a0a12")
PRIMARY = colors.HexColor("#0051d5")
TEXT = colors.HexColor("#20202a")
MUTED = colors.HexColor("#5c5c68")
LIGHT = colors.HexColor("#f5f3f1")
LIGHT_ACCENT = colors.HexColor("#fbe9e7")
WHITE = colors.HexColor("#ffffff")
BORDER = colors.HexColor("#e3dedc")
BAND = colors.HexColor("#efece9")

PAGE_W, PAGE_H = A4
MARGIN = 50

# Chart height scale, tuned per report by measuring rendered whitespace. The
# economic report needs smaller charts than national/tourism to avoid pushing a
# trailing section onto a near-empty final page. Held in a ContextVar so
# concurrent requests each keep their own scale.
CHART_SCALE_NATIONAL = 0.95
CHART_SCALE_ECONOMIC = 0.85
_chart_scale = ContextVar("chart_scale", default=CHART_SCALE_NATIONAL)

# Table density. Cell padding and the gap around each table are the two knobs
# that decide how much vertical space a row costs, and therefore how many
# pages the report needs.
CELL_PADDING_V = 5
CELL_PADDING_H = 6
TABLE_SPACE_BEFORE = 6
TABLE_SPACE_AFTER = 10
CONTENT_W = PAGE_W - 2 * MARGIN

_NUM_RE = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")

_TITLE = "National Dashboard Report"
_SUBTITLE = "Nepal Data Explorer"
_DESCRIPTOR = "Population, provinces and economic indicators for the national dashboard"


def _p(value, na="n/a"):
    if value is None:
        return na
    if isinstance(value, float):
        return f"{value:,.2f}"
    return f"{value:,}"


def _name(value):
    return value if value else "Nepal"


def _cell(value, na="n/a"):
    return value if value else na


def _styles():
    return {
        "title": ParagraphStyle(
            "title", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=ACCENT_DARK
        ),
        "subtitle": ParagraphStyle(
            "subtitle", fontName="Helvetica", fontSize=12, leading=15, textColor=MUTED
        ),
        "h1": ParagraphStyle(
            "h1", fontName="Helvetica-Bold", fontSize=15, leading=19, spaceBefore=16,
            spaceAfter=7, textColor=ACCENT_DARK, keepWithNext=1,
        ),
        "h2": ParagraphStyle(
            "h2", fontName="Helvetica-Bold", fontSize=11.5, leading=14, spaceBefore=10,
            spaceAfter=5, textColor=TEXT, keepWithNext=1,
        ),
        "body": ParagraphStyle(
            "body", fontName="Helvetica", fontSize=9.5, leading=13.5, spaceAfter=6,
            alignment=TA_LEFT,
        ),
        "small": ParagraphStyle(
            "small", fontName="Helvetica", fontSize=8, leading=10, textColor=MUTED, spaceAfter=4
        ),
        "bullet": ParagraphStyle(
            "bullet", fontName="Helvetica", fontSize=9.5, leading=13, spaceAfter=4,
            leftIndent=12, bulletIndent=2,
        ),
        "callout": ParagraphStyle(
            "callout", fontName="Helvetica-Bold", fontSize=10.5, leading=13, textColor=TEXT
        ),
        "cover_label": ParagraphStyle(
            "cover_label", fontName="Helvetica-Bold", fontSize=11, leading=15,
            textColor=ACCENT_DARK, alignment=TA_CENTER,
        ),
    }


def _table_style(header_blend=ACCENT, accent=None):
    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), accent or header_blend),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8.5),
            ("FONTSIZE", (0, 1), (-1, -1), 8.5),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("TEXTCOLOR", (0, 1), (-1, -1), TEXT),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, BAND]),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("BOX", (0, 0), (-1, -1), 0.9, BORDER),
            ("LINEABOVE", (0, 0), (-1, 0), 1.6, accent or header_blend),
            ("LINEBELOW", (0, -1), (-1, -1), 0.8, accent or header_blend),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), CELL_PADDING_V),
            ("BOTTOMPADDING", (0, 0), (-1, -1), CELL_PADDING_V),
            ("LEFTPADDING", (0, 0), (-1, -1), CELL_PADDING_H),
            ("RIGHTPADDING", (0, 0), (-1, -1), CELL_PADDING_H),
        ]
    )


class _BytesImage(RLImage):
    """RLImage subclass that accepts raw PNG bytes via a file-like object."""

    def __init__(self, data, width, height):
        super().__init__(io.BytesIO(data), width=width, height=height)


def _image(png_bytes, max_width=CONTENT_W, max_height=245):
    reader = ImageReader(io.BytesIO(png_bytes))
    iw, ih = reader.getSize()
    width = min(max_width, iw)
    height = ih * (width / iw)
    cap = max_height * _chart_scale.get()
    if height > cap:
        height = cap
        width = iw * (height / ih)
    return _BytesImage(png_bytes, width=width, height=height)


def _cover_page(canvas, doc):
    accent = getattr(doc, "accent", ACCENT)
    accent_dark = getattr(doc, "accent_dark", ACCENT_DARK)
    title = getattr(doc, "report_title", _TITLE)
    subtitle = getattr(doc, "report_subtitle", _SUBTITLE)
    tagline = getattr(doc, "report_tagline", "Comprehensive Report")
    descriptor = getattr(doc, "report_descriptor", _DESCRIPTOR)

    canvas.saveState()
    canvas.setFillColor(WHITE)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Decorative accent band on the left edge
    canvas.setFillColor(accent)
    canvas.rect(0, 0, 8 * mm, PAGE_H, fill=1, stroke=0)

    # Top brand bar
    canvas.setFillColor(accent)
    canvas.rect(8 * mm, PAGE_H - 34 * mm, PAGE_W - 8 * mm, 34 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 24)
    canvas.drawString(22 * mm, PAGE_H - 18 * mm, title)
    canvas.setFont("Helvetica", 12.5)
    canvas.drawString(22 * mm, PAGE_H - 28 * mm, f"Generated by the {subtitle} report service")
    canvas.setFillColor(accent_dark)
    canvas.rect(8 * mm, PAGE_H - 36 * mm, PAGE_W - 8 * mm, 2 * mm, fill=1, stroke=0)

    # Brand tag
    canvas.setFillColor(accent_dark)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(22 * mm, PAGE_H - 44 * mm, "NEPAL DATA EXPLORER")

    # Headline + descriptor
    canvas.setFillColor(TEXT)
    canvas.setFont("Helvetica-Bold", 30)
    canvas.drawString(22 * mm, PAGE_H - 92 * mm, tagline)
    canvas.setFont("Helvetica", 13.5)
    canvas.setFillColor(MUTED)
    for i, line in enumerate(
        _wrap_descriptor(descriptor, CONTENT_W - 14 * mm, "Helvetica", 13.5)
    ):
        canvas.drawString(22 * mm, PAGE_H - 104 * mm - i * 7 * mm, line)

    # Report period card
    canvas.setFillColor(LIGHT_ACCENT)
    canvas.roundRect(22 * mm, PAGE_H - 168 * mm, CONTENT_W - 14 * mm, 30 * mm, 5, fill=1, stroke=0)
    canvas.setFillColor(accent_dark)
    canvas.setFont("Helvetica-Bold", 12)
    canvas.drawString(30 * mm, PAGE_H - 152 * mm, "REPORT PERIOD")
    canvas.setFont("Helvetica", 12)
    canvas.setFillColor(TEXT)
    canvas.drawString(96 * mm, PAGE_H - 152 * mm, doc.report_period or "Latest available data")

    # Footer accent bar
    canvas.setFillColor(accent)
    canvas.rect(8 * mm, 0, PAGE_W - 8 * mm, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 8.5)
    canvas.drawString(22 * mm, 3.2 * mm, f"Produced {doc.generated_label}")

    canvas.restoreState()


def _wrap_descriptor(text, max_width, font="Helvetica-Bold", size=13.5):
    """Breaks a descriptor string into display lines that fit `max_width`.

    Wraps on measured text width rather than character count, so wide glyphs
    ("WORLD", "MMM") cannot push a line past the cover's content edge.
    """
    words = str(text or "").split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [text]


def _body_page(canvas, doc):
    title = getattr(doc, "report_title", _TITLE)
    subtitle = getattr(doc, "report_subtitle", _SUBTITLE)
    accent = getattr(doc, "accent", ACCENT)
    accent_dark = getattr(doc, "accent_dark", ACCENT_DARK)

    canvas.saveState()
    # Accent top border
    canvas.setFillColor(accent)
    canvas.rect(0, PAGE_H, PAGE_W, -3, fill=1, stroke=0)

    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, PAGE_H - 15 * mm, PAGE_W - MARGIN, PAGE_H - 15 * mm)
    canvas.setFillColor(accent_dark)
    canvas.setFont("Helvetica-Bold", 9.5)
    canvas.drawString(MARGIN, PAGE_H - 12 * mm, title)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 12 * mm, doc.generated_label)

    # Footer accent bar + page number
    canvas.setFillColor(LIGHT)
    canvas.rect(MARGIN, 14 * mm, CONTENT_W, 12 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(accent_dark)
    canvas.drawString(MARGIN, 9.5 * mm, f"Nepal Data Explorer — {subtitle}")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W - MARGIN, 9.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def _h1_style(accent=None):
    """Section heading with an accent underline, emulating a professional report."""
    style = ParagraphStyle(
        "h1-custom",
        fontName="Helvetica-Bold",
        fontSize=14.5,
        leading=18,
        spaceBefore=18,
        spaceAfter=2,
        textColor=accent or ACCENT_DARK,
        keepWithNext=1,
    )
    return style


def _section(story, styles, title, accent=None):
    """Adds a numbered section heading with an accent underline rule."""
    story.append(
        KeepTogether(
            [
                Paragraph(title, _h1_style(accent)),
                HRFlowable(
                    width="100%",
                    thickness=1.4,
                    color=(accent or ACCENT_DARK),
                    spaceBefore=0,
                    spaceAfter=10,
                    lineCap="butt",
                ),
            ]
        )
    )


_CELL_ALIGN = {TA_LEFT: "LEFT", TA_CENTER: "CENTER", TA_RIGHT: "RIGHT"}

_NUMERIC_RE = re.compile(
    r"^[\s(\[]*-?(?:[\d,]*\d)?(?:\.\d+)?%?\s*[\])]?"
    r"(?:\s*(?:persons/km²|per\s+\d+|kg|km²|NRS|USD|M|m|B|bn|bn)\.?)?$"
)


def _looks_numeric(value):
    """True when a cell is a plain number, currency, percentage or short unit."""
    if isinstance(value, (int, float)):
        return True
    text = str(value).strip()
    if not text or text in {"n/a", "-", "–", "—"}:
        return False
    return bool(_NUMERIC_RE.match(text))


def _column_alignments(data):
    """Derive per-column alignment from the body rows: numbers right, text left."""
    body = data[1:] if len(data) > 1 else []
    if not body:
        return []
    width = max(len(row) for row in body)
    aligns = []
    for col in range(width):
        cells = [row[col] for row in body if col < len(row) and _looks_numeric(row[col])]
        total = sum(1 for row in body if col < len(row))
        # Require a clear majority so one stray "5.8" in a text column does not flip it.
        aligns.append(TA_RIGHT if cells and len(cells) >= max(1, total * 0.6) else TA_LEFT)
    return aligns


def _make_table(data, col_widths, style=None):
    """Builds a Table with wrapping cells and type-aware per-column alignment.

    Cells are wrapped in Paragraphs so long labels wrap inside their column
    instead of overflowing into the neighbouring one, and each column is
    aligned from its own data type rather than a hand-tuned per-table rule.
    """
    aligns = _column_alignments(data)

    def render(row, is_header):
        cells = []
        for col, value in enumerate(row):
            if isinstance(value, Flowable):
                cells.append(value)
                continue
            align = aligns[col] if col < len(aligns) else TA_LEFT
            cell_style = ParagraphStyle(
                f"cell-{is_header}-{col}",
                fontName="Helvetica-Bold" if is_header else "Helvetica",
                fontSize=8.5,
                leading=11,
                textColor=WHITE if is_header else TEXT,
                alignment=align,
            )
            cells.append(Paragraph(escape(str(value)), cell_style))
        return cells

    rendered = [render(data[0], True)] + [render(row, False) for row in data[1:]]
    table = Table(rendered, colWidths=col_widths, repeatRows=1)
    table.setStyle(style if style is not None else _table_style())
    return table


def _table(story, data, col_widths, style=None):
    """Render a table with wrapping, type-aware alignment and consistent spacing.

    Cells are wrapped in Paragraphs so long labels wrap inside their column
    instead of overflowing into the neighbouring one, and each column is
    aligned from its own data type rather than a hand-tuned per-table rule.
    """
    table = _make_table(data, col_widths, style)
    story.append(Spacer(1, TABLE_SPACE_BEFORE))
    story.append(table)
    story.append(Spacer(1, TABLE_SPACE_AFTER))


def build_story(dataset, charts, trends, state):
    """Assembles the report story. Returns (story, meta) for the PDF build."""
    styles = _styles()
    national = dataset.get("national") or {}
    provinces = dataset.get("provinces") or []
    window = dataset.get("gdp_window") or []
    latest_gdp = dataset.get("latest_gdp")
    sectoral = dataset.get("sectoral") or {}
    report_year = dataset.get("report_year") or ""
    generated = datetime.now()
    generated_label = generated.strftime("%B %d, %Y at %H:%M")

    report_period = report_year or "Latest available data"
    period_fragment = report_year.replace("/", "-").replace(" ", "_") if report_year else "latest"
    filename = f"National_Dataset_Report_{period_fragment}.pdf"

    meta = {
        "filename": filename,
        "report_period": report_period,
        "generated_label": generated_label,
        "document_title": "Nepal Data Explorer National Dashboard Report",
        "title": _TITLE,
        "subtitle": _SUBTITLE,
        "tagline": "Comprehensive Report",
        "descriptor": _DESCRIPTOR,
        "accent": ACCENT,
        "accent_dark": ACCENT_DARK,
    }

    story = []
    story.append(NextPageTemplate("Body"))
    story.append(PageBreak())

    # Executive summary ------------------------------------------------------------------
    _section(story, styles, "1. Executive Summary")
    growth = national.get("growth_rate")
    summary_parts = [
        f"This report summarises the data powering the Nepal Data Explorer national "
        f"dashboard. The national population is recorded as "
        f"<b>{_p(national.get('total_population'))}</b> persons",
    ]
    if growth is not None:
        summary_parts.append(f"growing at <b>{_p(growth)}%</b> per year")
    if provinces:
        largest = max(provinces, key=lambda p: p["total_population"])
        summary_parts.append(
            f"with the largest provincial population in <b>{_name(largest['name'])}</b> "
            f"({_p(largest['total_population'])} persons, {_p(largest['pct'])}% of the total)"
        )
    if latest_gdp:
        summary_parts.append(
            f"and the latest World Output real growth rate used by the GDP trend is "
            f"<b>{_p(latest_gdp['value'])}%</b> ({latest_gdp['year']})"
        )
    story.append(Paragraph(" ".join(summary_parts) + ".", styles["body"]))

    fig = charts.get("gdp_trend")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.92, max_height=200))

    # Key indicators -------------------------------------------------------------------
    _section(story, styles, "2. Key Indicators")
    kpi_rows = [
        ["Indicator", "Value"],
        ["Total population", _p(national.get("total_population"))],
        ["Annual population growth", f"{_p(national.get('growth_rate'))}%"],
        ["Population density", f"{_p(national.get('population_density'))} persons/km²"],
    ]
    if national.get("male") is not None and national.get("female") is not None:
        kpi_rows += [
            ["Male population", _p(national.get("male"))],
            ["Female population", _p(national.get("female"))],
        ]
    if latest_gdp:
        kpi_rows.append(["GDP growth rate (World Output, real)", f"{_p(latest_gdp['value'])}% ({latest_gdp['year']})"])
    if sectoral.get("fiscal_year"):
        kpi_rows.append(["Latest economic reference (sectoral)", f"FY {sectoral['fiscal_year']}"])

    kpi_widths = [CONTENT_W * 0.42, CONTENT_W * 0.58]
    kpi_style = _table_style()
    kpi_style.add("ALIGN", (0, 0), (0, -1), "LEFT")
    _table(story, kpi_rows, kpi_widths, kpi_style)

    # Population ----------------------------------------------------------------------
    _section(story, styles, "3. Population Overview")
    story.append(
        Paragraph(
            f"Population figures are taken from the national population dataset "
            f"(Nepal Census 2021). The total recorded population is "
            f"<b>{_p(national.get('total_population'))}</b>, with a sex ratio of "
            f"{_p(national.get('sex_ratio'))} males per 100 females. The distribution "
            f"across the seven provinces is shown below.",
            styles["body"],
        )
    )
    fig = charts.get("population_distribution")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=215))

    # Provincial comparison ------------------------------------------------------------
    _section(story, styles, "4. Provincial Comparison")
    story.append(
        Paragraph(
            "Provincial summaries are aggregated from the same district-level "
            "population data used by the dashboard. Shares are percentages of the "
            "national population.",
            styles["body"],
        )
    )
    if provinces:
        province_rows = [
            ["Province", "Population", "Share (%)", "Density (persons/km²)"]
        ]
        province_rows += [
            [_name(p["name"]), _p(p["total_population"]), _p(p["pct"]), _p(p.get("population_density"))]
            for p in provinces
        ]
        _table(
            story,
            province_rows,
            [CONTENT_W * 0.34, CONTENT_W * 0.22, CONTENT_W * 0.2, CONTENT_W * 0.24],
        )

    fig = charts.get("density")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=215))

    filtered_province = dataset.get("_filtered_province")
    if filtered_province:
        story.append(
            Paragraph(
                f"<b>Selected on the dashboard:</b> {_name(filtered_province.get('name'))} "
                f"({_p(filtered_province.get('pct'))}% of the national population).",
                styles["body"],
            )
        )

    # Economic / GDP -------------------------------------------------------------------
    econ_section_no = 5
    _section(story, styles, f"{econ_section_no}. Economic Indicators & GDP")
    story.append(
        Paragraph(
            "Nepal-specific GDP in national currency (NPR) is not yet available in the "
            "backend dataset. The GDP trend shown on the national dashboard reflects the "
            "global World Output real growth series available in the backend, which the "
            "dashboard GDP trend chart also displays.",
            styles["body"],
        )
    )
    if window:
        gdp_rows = [["Year", "Real growth (%)"]]
        gdp_rows += [[point["year"], _p(point["value"])] for point in window]
        gdp_style = _table_style()
        gdp_style.add("ALIGN", (0, 0), (1, -1), "CENTER")
        _table(story, gdp_rows, [CONTENT_W * 0.3, CONTENT_W * 0.3], gdp_style)

    # Foreign trade (mirrors the National hero metric cards)
    trade_by_year = (dataset.get("trade") or {}).get("trade_by_year") or []
    trade_unit = (dataset.get("trade") or {}).get("unit") or "Units as recorded"
    if trade_by_year:
        story.append(Paragraph("<b>Foreign trade (exports vs imports)</b>", styles["h2"]))
        story.append(
            Paragraph(
                "Total exports and imports by fiscal year from the foreign trade dataset, "
                "matching the totals shown on the national dashboard metric cards.",
                styles["body"],
            )
        )
        trade_rows = [["Fiscal year", "Exports", "Imports", "Balance"]]
        for pair in trade_by_year:
            exports = pair.get("exports")
            imports = pair.get("imports")
            balance = exports - imports if exports is not None and imports is not None else None
            trade_rows.append([
                _cell(pair.get("fiscal_year")),
                _p(exports),
                _p(imports),
                _p(balance),
            ])
        trade_style = _table_style()
        trade_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
        _table(
            story,
            trade_rows,
            [CONTENT_W * 0.24, CONTENT_W * 0.25, CONTENT_W * 0.25, CONTENT_W * 0.26],
            trade_style,
        )
        story.append(
            Paragraph(f"Trade values are reported in: {trade_unit}.", styles["small"])
        )

    fig = charts.get("sectoral")
    if fig:
        story.append(Paragraph(f"<b>Latest sectoral growth (FY {sectoral.get('fiscal_year') or 'latest'})</b>", styles["h2"]))
        story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=220))
        story.append(
            Paragraph(
                "Sectoral growth values come from the backend's sectoral growth dataset and "
                "supplement the dashboard GDP trend; they describe sector-level performance "
                "for the most recent available fiscal year.",
                styles["small"],
            )
        )

    # Key trends -----------------------------------------------------------------------
    trends_section_no = econ_section_no + 1
    _section(story, styles, f"{trends_section_no}. Key Trends & Observations")
    for i, observation in enumerate(trends, start=1):
        story.append(Paragraph(f"<b>{i}.</b> {observation}", styles["bullet"]))

    # Data sources ---------------------------------------------------------------------
    sources_section_no = trends_section_no + 1
    _section(story, styles, f"{sources_section_no}. Data Sources")
    sources_rows = [
        ["Dataset", "Fields", "Reference"],
        ["National Population (Census 2021)", "Population, sex, households, growth, density", "PopulationBySex · Nepal"],
        ["World Output (real)", "Annual real growth rates", f"GlobalEconomicSeries · {latest_gdp['year'] if latest_gdp else 'latest'}"],
        ["Foreign Trade", "Total exports / imports per fiscal year", "ForeignTradeStatistic"],
        ["Sectoral Growth", "Sector-level annual growth", f"SectoralGrowth · FY {sectoral.get('fiscal_year') or 'latest'}"],
    ]
    sources_style = _table_style()
    sources_style.add("ALIGN", (1, 0), (1, -1), "LEFT")
    _table(
        story,
        sources_rows,
        [CONTENT_W * 0.36, CONTENT_W * 0.36, CONTENT_W * 0.28],
        sources_style,
    )

    # Methodology -----------------------------------------------------------------------
    methods_section_no = sources_section_no + 1
    _section(story, styles, f"{methods_section_no}. Methodology")
    story.append(
        Paragraph(
            "All figures are queried directly from the backend database that also powers the "
            "dashboard APIs, so this report is consistent with the on-screen dashboard. "
            "Population values are sourced from the national population dataset "
            "(Nepal Census 2021). The GDP trend uses the World Output real growth series, "
            "deduplicated to the most recently published value per calendar year. Provincial "
            "shares are computed as a percentage of the national population total. Charts are "
            "rendered from the same retrieved data; the provincial map uses the boundary "
            "geometry shared with the frontend map component.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            "Indicators whose values are not present in the backend (for example "
            "Nepal-specific GDP in NPR) are deliberately excluded rather than approximated.", 
            styles["body"],
        )
    )

    # Data dictionary -------------------------------------------------------------------
    dict_section_no = methods_section_no + 1
    _section(story, styles, f"{dict_section_no}. Data Dictionary")
    dictionary = [
        ["Variable", "Description", "Unit"],
        ["Total population", "Recorded population at the reference census", "Persons"],
        ["Male / Female", "Population split by sex", "Persons"],
        ["Growth rate", "Annual population growth rate", "%"],
        ["Population density", "Persons per square kilometre of land area", "Persons/km²"],
        ["Sex ratio", "Males per 100 females", "Ratio"],
        ["GDP growth rate", "Real growth of the World Output series", "%"],
        ["Sectoral growth", "Growth by economic sector for the fiscal year", "%"],
    ]
    _table(
        story,
        dictionary,
        [CONTENT_W * 0.26, CONTENT_W * 0.46, CONTENT_W * 0.28],
    )

    # Appendix -------------------------------------------------------------------------
    appendix_section_no = dict_section_no + 1
    _section(story, styles, f"{appendix_section_no}. Appendix: Report Parameters")
    selected = state.get("selected_indicators") or []
    province_value = state.get("selected_province")
    if isinstance(province_value, dict):
        province_value = province_value.get("name") or "Selected province"
    params = [
        ["Parameter", "Value"],
        ["Report period", report_period],
        ["Selected indicators", ", ".join(selected) if selected else "All available"],
        ["Province filter", province_value or "None (all provinces)"],
        ["Dashboard filters", ", ".join(f"{k}: {v}" for k, v in (state.get("filters") or {}).items()) or "None"],
        ["Generated at", generated_label],
    ]
    story.append(
        KeepTogether(
            [
                Spacer(1, TABLE_SPACE_BEFORE),
                _make_table(params, [CONTENT_W * 0.4, CONTENT_W * 0.6], _table_style_aligned_left()),
                Spacer(1, TABLE_SPACE_AFTER),
                Paragraph(
                    "This report was generated automatically from live database values and may be "
                    "regenerated at any time as new data becomes available.",
                    styles["small"],
                ),
            ]
        )
    )

    return story, meta


def _table_style_aligned_left():
    style = _table_style()
    style.add("ALIGN", (0, 0), (0, -1), "LEFT")
    return style


def _build_pdf(story, meta):
    """Wraps an already-assembled story + meta into a built PDF."""
    return _build_pdf_inner(story, meta)


@contextmanager
def _chart_scaling(scale):
    """Scopes the chart height scale over story assembly *and* PDF build.

    `_image` resolves its geometry when the story is assembled, so the scale
    has to be active before `build_*_story` runs, not just around `doc.build`.
    """
    token = _chart_scale.set(scale)
    try:
        yield
    finally:
        _chart_scale.reset(token)


def _build_pdf_inner(story, meta):
    pdf_buffer = io.BytesIO()
    doc = BaseDocTemplate(
        pdf_buffer,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=60,
        bottomMargin=80,
        title=meta.get("document_title", _TITLE),
        author="Nepal Data Explorer",
    )
    doc.report_period = meta["report_period"]
    doc.generated_label = meta["generated_label"]
    doc.report_title = meta.get("title", _TITLE)
    doc.report_subtitle = meta.get("subtitle", _SUBTITLE)
    doc.report_tagline = meta.get("tagline", "Comprehensive Report")
    doc.report_descriptor = meta.get("descriptor", _DESCRIPTOR)
    doc.accent = meta.get("accent", ACCENT)
    doc.accent_dark = meta.get("accent_dark", ACCENT_DARK)

    cover_frame = Frame(0, 0, PAGE_W, PAGE_H, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    body_frame = Frame(MARGIN, 80, CONTENT_W, PAGE_H - 60 - 80)
    doc.addPageTemplates(
        [
            PageTemplate(id="Cover", frames=[cover_frame], onPage=_cover_page),
            PageTemplate(id="Body", frames=[body_frame], onPage=_body_page),
        ]
    )

    doc.build(story)
    return pdf_buffer.getvalue(), meta["filename"]


def build_pdf(dataset, charts, trends, state):
    """Builds the full national dashboard PDF."""
    with _chart_scaling(CHART_SCALE_NATIONAL):
        story, meta = build_story(dataset, charts, trends, state)
        return _build_pdf(story, meta)


def build_tourism_story(dataset, charts, trends, state):
    """Assembles the tourism dashboard report story."""
    styles = _styles()
    kpis = dataset.get("kpis") or {}
    trend = dataset.get("arrival_trend") or []
    top_source = kpis.get("top_source_country")
    top_markets = dataset.get("source_market_top") or []
    source_year = dataset.get("source_market_year")
    revenue = dataset.get("revenue") or []
    latest_revenue = dataset.get("latest_revenue")
    report_year = dataset.get("report_year") or ""
    generated = datetime.now()
    generated_label = generated.strftime("%B %d, %Y at %H:%M")

    report_period = report_year or "Latest available data"
    period_fragment = str(report_year).replace("/", "-").replace(" ", "_") if report_year else "latest"
    filename = f"Tourism_Dataset_Report_{period_fragment}.pdf"

    meta = {
        "filename": filename,
        "report_period": report_period,
        "generated_label": generated_label,
        "document_title": "Nepal Data Explorer Tourism Dashboard Report",
        "title": "Tourism Dashboard Report",
        "subtitle": "Nepal Data Explorer",
        "tagline": "Comprehensive Report",
        "descriptor": "Tourist arrivals, source markets, revenue, length of stay, purpose of visit, trekking activity, arrivals by sex, arrivals by age group and provincial tourism for the tourism dashboard",
        "accent": ACCENT,
        "accent_dark": ACCENT_DARK,
    }

    story = []
    story.append(NextPageTemplate("Body"))
    story.append(PageBreak())

    # Executive summary -----------------------------------------------------------------
    _section(story, styles, "1. Executive Summary")
    parts = [
        "This report summarises the data powering the Nepal Data Explorer tourism dashboard.",
    ]
    if kpis.get("total_tourists"):
        growth = kpis.get("growth_percent")
        growth_note = (
            f"growing {_p(growth)}% over the previous year"
            if growth is not None
            else "in the latest reference year"
        )
        parts.append(f"Total recorded tourist arrivals stood at <b>{_p(kpis['total_tourists'])}</b> {growth_note}")
    if top_source:
        parts.append(
            f"with <b>{_cell(top_source['nationality'])}</b> the top source market "
            f"({_p(top_source['arrivals'])} arrivals)"
        )
    if latest_revenue:
        parts.append(
            f"and latest annual tourism revenue of <b>${_p(latest_revenue.get('value'))} million</b> (US$)"
        )
    story.append(Paragraph(" ".join(parts) + ".", styles["body"]))

    fig = charts.get("tourism_arrivals")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.92, max_height=200))

    # Key indicators --------------------------------------------------------------------
    _section(story, styles, "2. Key Indicators")
    kpi_rows = [
        ["Indicator", "Value"],
        ["Total tourists (latest year)", _p(kpis.get("total_tourists"))],
        ["Annual growth", f"{_p(kpis.get('growth_percent'))}%"],
    ]
    if top_source:
        kpi_rows.append([
            "Top source market",
            f"{_cell(top_source['nationality'])} ({_p(top_source['arrivals'])} arrivals)",
        ])
    if latest_revenue:
        kpi_rows.append([
            "Latest tourism revenue",
            f"${_p(latest_revenue.get('value'))} million ({latest_revenue.get('fiscal_year')})",
        ])
    _table(story, kpi_rows, [CONTENT_W * 0.42, CONTENT_W * 0.58], _table_style_aligned_left())

    # Arrivals trend --------------------------------------------------------------------
    _section(story, styles, "3. Tourist Arrivals Trend")
    story.append(
        Paragraph(
            "Annual tourist arrivals split between third-country and Indian visitors, from the "
            "Department of Tourism data used by the dashboard.",
            styles["body"],
        )
    )
    if trend:
        arrival_rows = [
            ["Year", "Third country", "Indian", "Total", "Change (%)"]
        ]
        arrival_rows += [
            [
                _p(point["year"]),
                _p(point.get("third_country_arrivals")),
                _p(point.get("indian_arrivals")),
                _p(point.get("total_arrivals")),
                _p(point.get("percent_change")),
            ]
            for point in trend
        ]
        arrival_style = _table_style()
        arrival_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
        _table(
            story,
            arrival_rows,
            [CONTENT_W * 0.16, CONTENT_W * 0.21, CONTENT_W * 0.21, CONTENT_W * 0.21, CONTENT_W * 0.21],
            arrival_style,
        )

    # Source markets --------------------------------------------------------------------
    _section(story, styles, "4. Top Source Markets")
    subtitle_text = (
        f"Arrivals by nationality for {source_year}, ordered by volume. Shares are percentages "
        f"of the year's total arrivals."
        if source_year
        else "Arrivals by nationality from the Department of Tourism data."
    )
    story.append(Paragraph(subtitle_text, styles["body"]))
    fig = charts.get("tourism_source_markets")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=250))
    if top_markets:
        market_rows = [["Nationality", "Arrivals", "Share (%)"]]
        market_rows += [
            [
                _cell(market["nationality"]),
                _p(market["arrivals"]),
                _p(market.get("percent")),
            ]
            for market in top_markets
        ]
        market_style = _table_style()
        market_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
        _table(
            story,
            market_rows,
            [CONTENT_W * 0.5, CONTENT_W * 0.25, CONTENT_W * 0.25],
            market_style,
        )

    # Revenue ---------------------------------------------------------------------------
    _section(story, styles, "5. Tourism Revenue")
    story.append(
        Paragraph(
            "Annual tourism revenue in US$ millions as recorded by Nepal Rastra Bank and used by "
            "the dashboard revenue trend.",
            styles["body"],
        )
    )
    fig = charts.get("tourism_revenue")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=200))
    if revenue:
        revenue_rows = [["Fiscal year", "Revenue (US$ million)"]]
        revenue_rows += [[point["fiscal_year"], _p(point.get("value"))] for point in revenue]
        revenue_style = _table_style()
        revenue_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
        _table(story, revenue_rows, [CONTENT_W * 0.4, CONTENT_W * 0.6], revenue_style)

    # Average length of stay -----------------------------------------------------------
    stay_trend = dataset.get("avg_stay_trend") or []
    if stay_trend:
        _section(story, styles, "6. Average Length of Stay")
        story.append(
            Paragraph(
                "Average number of days a visitor stayed in Nepal per year, as recorded in the "
                "tourism statistics that also drive the dashboard's length-of-stay trend.",
                styles["body"],
            )
        )
        fig = charts.get("tourism_stay")
        if fig:
            story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=200))
        stay_rows = [["Year", "Average stay (days)"]]
        stay_rows += [[_p(point.get("year")), _p(point.get("value"))] for point in stay_trend]
        stay_style = _table_style()
        stay_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
        _table(story, stay_rows, [CONTENT_W * 0.4, CONTENT_W * 0.6], stay_style)

    # Purpose of visit -----------------------------------------------------------------
    purpose_trend = dataset.get("purpose_trend") or []
    if purpose_trend:
        purpose_year = dataset.get("latest_purpose_year")
        year_rows = [
            row for row in purpose_trend if row.get("year") == purpose_year
        ] or purpose_trend
        year_rows = sorted(year_rows, key=lambda row: row.get("value") or 0, reverse=True)
        total_purpose = sum(row.get("value") or 0 for row in year_rows)
        _section(story, styles, "7. Purpose of Visit")
        story.append(
            Paragraph(
                f"Recorded arrivals by purpose of visit for {purpose_year}, ordered by volume. "
                f"Shares are percentages of the year's purpose total.",
                styles["body"],
            )
        )
        fig = charts.get("tourism_purpose")
        if fig:
            story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=230))
        if year_rows:
            purpose_rows = [["Purpose", "Arrivals", "Share (%)"]]
            purpose_rows += [
                [
                    _cell(row.get("category")),
                    _p(row.get("value")),
                    _p(round((row.get("value") or 0) / total_purpose * 100, 1) if total_purpose else 0),
                ]
                for row in year_rows
            ]
            purpose_style = _table_style()
            purpose_style.add("ALIGN", (0, 0), (0, -1), "LEFT")
            _table(
                story,
                purpose_rows,
                [CONTENT_W * 0.5, CONTENT_W * 0.25, CONTENT_W * 0.25],
                purpose_style,
            )

    # Trekking areas -------------------------------------------------------------------
    trekking_trend = dataset.get("trekking_trend") or []
    if trekking_trend:
        trekking_year = dataset.get("latest_trekking_year")
        year_rows = [
            row for row in trekking_trend if row.get("year") == trekking_year
        ] or trekking_trend
        year_rows = sorted(year_rows, key=lambda row: row.get("trekkers") or 0, reverse=True)
        total_trekkers = sum(row.get("trekkers") or 0 for row in year_rows)
        _section(story, styles, "8. Trekking Areas & Trekkers")
        story.append(
            Paragraph(
                f"Trekkers recorded per trekking area for {trekking_year}, ordered by volume.",
                styles["body"],
            )
        )
        fig = charts.get("tourism_trekking")
        if fig:
            story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=230))
        if year_rows:
            trek_rows = [["Trekking area", "Trekkers", "Share (%)"]]
            trek_rows += [
                [
                    _cell(row.get("region")),
                    _p(row.get("trekkers")),
                    _p(round((row.get("trekkers") or 0) / total_trekkers * 100, 1) if total_trekkers else 0),
                ]
                for row in year_rows
            ]
            trek_style = _table_style()
            trek_style.add("ALIGN", (0, 0), (0, -1), "LEFT")
            _table(
                story,
                trek_rows,
                [CONTENT_W * 0.5, CONTENT_W * 0.25, CONTENT_W * 0.25],
                trek_style,
            )

    # Arrivals by sex ------------------------------------------------------------------
    sex_trend = dataset.get("sex_trend") or []
    if sex_trend:
        sex_year = dataset.get("latest_sex_year")
        number_rows = [
            row for row in sex_trend
            if (row.get("statistic_type") or "").strip().lower() == "number"
        ]
        sex_rows = [
            row for row in number_rows if row.get("year") == sex_year
        ] or number_rows
        female = next((row for row in sex_rows if "female" in str(row.get("gender")).lower()), None)
        male = next((row for row in sex_rows if "male" in str(row.get("gender")).lower()), None)
        female_count = (female or {}).get("value") or 0
        male_count = (male or {}).get("value") or 0
        total_sex = female_count + male_count
        _section(story, styles, "9. Arrivals by Sex")
        story.append(
            Paragraph(
                f"Annual tourist arrivals split by gender for {sex_year}. Female visitors "
                f"accounted for {_p(round(female_count / total_sex * 100, 1) if total_sex else 0)}% "
                f"of the recorded total in this year.",
                styles["body"],
            )
        )
        fig = charts.get("tourism_sex")
        if fig:
            story.append(_image(fig, max_width=CONTENT_W * 0.7, max_height=230))
        if female is not None or male is not None:
            sex_table_rows = [["Gender", "Arrivals", "Share (%)"]]
            for label, count in (("Female", female_count), ("Male", male_count)):
                sex_table_rows.append([
                    _cell(label),
                    _p(count),
                    _p(round(count / total_sex * 100, 1) if total_sex else 0),
                ])
            sex_style = _table_style()
            sex_style.add("ALIGN", (0, 0), (0, -1), "LEFT")
            _table(
                story,
                sex_table_rows,
                [CONTENT_W * 0.4, CONTENT_W * 0.3, CONTENT_W * 0.3],
                sex_style,
            )

    # Arrivals by age group ------------------------------------------------------------
    age_trend = dataset.get("age_trend") or []
    if age_trend:
        age_year = dataset.get("latest_age_year")
        age_rows = [
            row for row in age_trend if row.get("year") == age_year
        ] or age_trend
        age_rows = sorted(age_rows, key=lambda row: row.get("value") or 0, reverse=True)
        total_age = sum(row.get("value") or 0 for row in age_rows)
        _section(story, styles, "10. Arrivals by Age Group")
        story.append(
            Paragraph(
                f"Annual tourist arrivals grouped by age band for {age_year}, ordered by volume.",
                styles["body"],
            )
        )
        fig = charts.get("tourism_age")
        if fig:
            story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=230))
        if age_rows:
            age_table_rows = [["Age group", "Arrivals", "Share (%)"]]
            age_table_rows += [
                [
                    _cell(row.get("age_group")),
                    _p(row.get("value")),
                    _p(round((row.get("value") or 0) / total_age * 100, 1) if total_age else 0),
                ]
                for row in age_rows
            ]
            age_style = _table_style()
            age_style.add("ALIGN", (0, 0), (0, -1), "LEFT")
            _table(
                story,
                age_table_rows,
                [CONTENT_W * 0.4, CONTENT_W * 0.3, CONTENT_W * 0.3],
                age_style,
            )

    # Tourism by province --------------------------------------------------------------
    province_tourism = dataset.get("province_tourism") or {}
    province_rows = province_tourism.get("latest") or []
    if province_rows:
        province_year = province_tourism.get("latest_year")
        _section(story, styles, "11. Tourism by Province")
        story.append(
            Paragraph(
                f"Official destination visits grouped by province for {province_year}, "
                "from the Nepal Tourism Statistics provincial dataset.",
                styles["body"],
            )
        )
        fig = charts.get("tourism_province")
        if fig:
            story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=230))
        province_table_rows = [["Province", "Visitors", "Share (%)"]]
        province_table_rows += [
            [
                _cell(row.get("province")),
                _p(row.get("visitors")),
                _p(row.get("share")),
            ]
            for row in province_rows
        ]
        province_style = _table_style()
        province_style.add("ALIGN", (0, 0), (0, -1), "LEFT")
        _table(
            story,
            province_table_rows,
            [CONTENT_W * 0.4, CONTENT_W * 0.3, CONTENT_W * 0.3],
            province_style,
        )
        all_destinations = [
            (item.get("province"), dest)
            for item in province_rows
            for dest in item.get("destinations") or []
            if dest.get("visitors")
        ]
        if all_destinations:
            dest_style = _table_style()
            dest_style.add("ALIGN", (0, 0), (0, -1), "LEFT")
            for item in province_rows:
                province_dests = [
                    d for d in (item.get("destinations") or []) if d.get("visitors")
                ]
                if not province_dests:
                    continue
                province_dests = sorted(
                    province_dests, key=lambda d: d.get("visitors") or 0, reverse=True
                )[:8]
                provincial_total = sum(d.get("visitors") or 0 for d in province_dests)
                story.append(
                    Paragraph(
                        f"<b>{_name(item.get('province'))}</b> ({province_year})",
                        styles["body"],
                    )
                )
                dest_table_rows = [["Destination", "Visitors", "Share (%)"]]
                dest_table_rows += [
                    [
                        _cell(dest.get("name")),
                        _p(dest.get("visitors")),
                        _p(round((dest.get("visitors") or 0) / provincial_total * 100, 1) if provincial_total else 0),
                    ]
                    for dest in province_dests
                ]
                _table(
                    story,
                    dest_table_rows,
                    [CONTENT_W * 0.6, CONTENT_W * 0.2, CONTENT_W * 0.2],
                    dest_style,
                )

    # Key trends ------------------------------------------------------------------------
    _section(story, styles, "12. Key Trends & Observations")
    for i, observation in enumerate(trends, start=1):
        story.append(Paragraph(f"<b>{i}.</b> {observation}", styles["bullet"]))

    # Data sources ----------------------------------------------------------------------
    _section(story, styles, "13. Data Sources")
    sources_rows = [
        ["Dataset", "Fields", "Reference"],
        ["Tourist Arrivals (annual)", "Total, third-country and Indian arrivals, change", "TouristArrivalByYear"],
        ["Arrivals by Nationality", "Nationality, arrivals, share", "TouristArrivalByNationality"],
        ["Tourism Revenue", "Fiscal year, value, unit", "TourismRevenue"],
        ["Average Length of Stay", "Year, average stay", "TourismStatistic (Avg_Stay)"],
        ["Purpose of Visit", "Year, purpose category, arrivals", "TouristArrivalByPurpose"],
        ["Trekking Areas", "Year, trekking area, trekkers", "TrekkerByRegion"],
        ["Arrivals by Sex", "Year, gender, arrivals, share", "TouristArrivalBySex"],
        ["Arrivals by Age Group", "Year, age group, arrivals", "TouristArrivalByAgeGroup"],
        ["Provincial Tourism", "Province, destination, year, visits", "ProvinceTourismVisit"],
    ]
    sources_style = _table_style()
    sources_style.add("ALIGN", (1, 0), (2, -1), "LEFT")
    _table(
        story,
        sources_rows,
        [CONTENT_W * 0.38, CONTENT_W * 0.36, CONTENT_W * 0.26],
        sources_style,
    )

    # Methodology -----------------------------------------------------------------------
    _section(story, styles, "14. Methodology")
    story.append(
        Paragraph(
            "All figures are queried directly from the backend database that also powers the "
            "tourism dashboard APIs, so this report is consistent with the on-screen dashboard. "
            "Arrival totals are the sum of third-country and Indian visitor records. Source "
            "market shares are percentages of the reference year's total arrivals. Revenue "
            "figures use the US$ million series only, matching the dashboard revenue trend. "
            "Purpose-of-visit, trekking, arrivals-by-sex and arrivals-by-age-group figures are "
            "shown for the latest year with recorded data, while the average length of stay is "
            "reported for the full recorded series. Provincial tourism figures show official "
            "destination visits per province for the latest published year. "
            "Charts are rendered from the same retrieved data.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            "Values recorded as 'n/a' are not present in the backend dataset and are deliberately "
            "excluded rather than approximated.",
            styles["body"],
        )
    )

    # Data dictionary -------------------------------------------------------------------
    _section(story, styles, "15. Data Dictionary")
    dictionary = [
        ["Variable", "Description", "Unit"],
        ["Total arrivals", "Recorded annual tourist arrivals", "Persons"],
        ["Third country / Indian", "Arrival split by visitor origin", "Persons"],
        ["Change (%)", "Year-on-year change in total arrivals", "%"],
        ["Revenue", "Annual tourism revenue", "US$ million"],
        ["Average stay", "Average length of stay per visitor", "Days"],
        ["Purpose of visit", "Arrivals grouped by travel purpose", "Persons"],
        ["Trekkers", "Trekkers recorded per trekking area", "Persons"],
        ["Arrivals by sex", "Arrivals split by visitor gender", "Persons"],
        ["Arrival age group", "Arrivals grouped by age band", "Persons"],
        ["Provincial visits", "Official visits per province / destination", "Visitors"],
    ]
    _table(
        story,
        dictionary,
        [CONTENT_W * 0.26, CONTENT_W * 0.46, CONTENT_W * 0.28],
    )

    # Appendix --------------------------------------------------------------------------
    _section(story, styles, "16. Appendix: Report Parameters")
    params = [
        ["Parameter", "Value"],
        ["Report period", report_period],
        ["Active tab", state.get("active_tab") or "arrivals"],
        ["Arrival range", state.get("arrival_range") or "5"],
        ["Revenue range", state.get("revenue_range") or "5"],
        ["Purpose year", state.get("purpose_year") or "Latest available"],
        ["Trekking year", state.get("trekking_year") or "Latest available"],
        ["Sex year", state.get("sex_year") or "Latest available"],
        ["Age group year", state.get("age_year") or "Latest available"],
        ["Dashboard filters", ", ".join(f"{k}: {v}" for k, v in (state.get("filters") or {}).items()) or "None"],
        ["Generated at", generated_label],
    ]
    story.append(
        KeepTogether(
            [
                Spacer(1, TABLE_SPACE_BEFORE),
                _make_table(params, [CONTENT_W * 0.4, CONTENT_W * 0.6], _table_style_aligned_left()),
                Spacer(1, TABLE_SPACE_AFTER),
                Paragraph(
                    "This report was generated automatically from live database values and may be "
                    "regenerated at any time as new data becomes available.",
                    styles["small"],
                ),
            ]
        )
    )

    return story, meta


def build_tourism_pdf(dataset, charts, trends, state):
    """Builds the full tourism dashboard PDF."""
    with _chart_scaling(CHART_SCALE_NATIONAL):
        story, meta = build_tourism_story(dataset, charts, trends, state)
        return _build_pdf(story, meta)


def build_economic_story(dataset, charts, trends, state):
    """Assembles the economic dashboard report story."""
    styles = _styles()
    growth = dataset.get("global_growth") or []
    latest_growth = dataset.get("latest_global_growth")
    trade = dataset.get("trade_by_year") or []
    sectors = dataset.get("sectoral_growth") or []
    latest_sector_year = dataset.get("latest_sectoral_year")
    province_gdp = dataset.get("province_gdp") or {}
    province_latest = province_gdp.get("latest")
    report_year = dataset.get("report_year") or ""
    generated = datetime.now()
    generated_label = generated.strftime("%B %d, %Y at %H:%M")

    report_period = report_year or "Latest available data"
    period_fragment = str(report_year).replace("/", "-").replace(" ", "_") if report_year else "latest"
    filename = f"Economic_Dataset_Report_{period_fragment}.pdf"

    meta = {
        "filename": filename,
        "report_period": report_period,
        "generated_label": generated_label,
        "document_title": "Nepal Data Explorer Economic Dashboard Report",
        "title": "Economic Dashboard Report",
        "subtitle": "Nepal Data Explorer",
        "tagline": "Comprehensive Report",
        "descriptor": "World output, global economies, foreign trade, sectoral, economy-wide, salary, agricultural prices and province-level GDP growth for the economic dashboard",
        "accent": ACCENT,
        "accent_dark": ACCENT_DARK,
    }

    story = []
    story.append(NextPageTemplate("Body"))
    story.append(PageBreak())

    # Executive summary -----------------------------------------------------------------
    _section(story, styles, "1. Executive Summary")
    parts = [
        "This report summarises the data powering the Nepal Data Explorer economic dashboard.",
    ]
    if latest_growth:
        parts.append(
            f"the latest World Output real growth rate is <b>{_p(latest_growth['value'])}%</b> "
            f"({latest_growth['year'].replace('Real_', '')})"
        )
    latest_trade = trade[-1] if trade else None
    if latest_trade and latest_trade.get("exports") is not None and latest_trade.get("imports") is not None:
        parts.append(
            f"with exports of <b>{_p(latest_trade['exports'])}</b> against imports of "
            f"<b>{_p(latest_trade['imports'])}</b> for fiscal year {latest_trade['fiscal_year']}"
        )
    latest_sectors = [
        sector for sector in sectors
        if sector["fiscal_year"] == latest_sector_year and sector.get("value") is not None
    ] if latest_sector_year else []
    if latest_sectors:
        top_sector = max(latest_sectors, key=lambda s: s["value"])
        parts.append(
            f"and the strongest recorded sector growth of <b>{_p(top_sector['value'])}%</b> "
            f"in {_cell(top_sector['sector'])}"
        )
    province_latest_records = (
        list(province_latest["provinces"].values()) if province_latest and province_latest.get("provinces") else []
    )
    province_note = None
    if len(province_latest_records) >= 2:
        scaled = [
            (record.get("province"), record.get("growth_basic_price"))
            for record in province_latest_records
            if record.get("growth_basic_price") is not None
        ]
        if len(scaled) >= 2:
            fastest = max(scaled, key=lambda pair: pair[1])
            slowest = min(scaled, key=lambda pair: pair[1])
            province_note = (
                f"and province-level GDP growth spanning <b>{_p(fastest[1])}%</b> "
                f"({_cell(fastest[0])}) to <b>{_p(slowest[1])}%</b> ({_cell(slowest[0])}) "
                f"in fiscal year {province_latest['fiscal_year']}"
            )
            parts.append(province_note)
    story.append(Paragraph(" ".join(parts) + ".", styles["body"]))

    fig = charts.get("economic_growth")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.92, max_height=200))

    # Key indicators --------------------------------------------------------------------
    _section(story, styles, "2. Key Indicators")
    kpi_rows = [
        ["Indicator", "Value"],
    ]
    if latest_growth:
        kpi_rows.append([
            "World Output real growth",
            f"{_p(latest_growth['value'])}% ({latest_growth['year'].replace('Real_', '')})",
        ])
    if latest_trade and latest_trade.get("exports") is not None:
        kpi_rows.append(["Total exports", f"{_p(latest_trade['exports'])} ({latest_trade['fiscal_year']})"])
    if latest_trade and latest_trade.get("imports") is not None:
        kpi_rows.append(["Total imports", f"{_p(latest_trade['imports'])} ({latest_trade['fiscal_year']})"])
    if top_sectors_note := (latest_sectors[0] if latest_sectors else None):
        kpi_rows.append([
            "Strongest sector growth",
            f"{_cell(top_sectors_note['sector'])} ({_p(top_sectors_note['value'])}%)",
        ])
    if len(kpi_rows) > 1:
        _table(story, kpi_rows, [CONTENT_W * 0.42, CONTENT_W * 0.58], _table_style_aligned_left())

    # World output ----------------------------------------------------------------------
    _section(story, styles, "3. World Output Real Growth")
    story.append(
        Paragraph(
            "The real growth series for global World Output, deduplicated to the most recently "
            "published value per calendar year, matching the dashboard growth chart.",
            styles["body"],
        )
    )
    if growth:
        growth_rows = [["Year", "Real growth (%)"]]
        growth_rows += [
            [point["year"].replace("Real_", ""), f"{_p(point['value'])}%"]
            for point in growth[-12:]
        ]
        growth_style = _table_style()
        growth_style.add("ALIGN", (0, 1), (1, -1), "CENTER")
        _table(story, growth_rows, [CONTENT_W * 0.3, CONTENT_W * 0.3], growth_style)

    # Global economies ----------------------------------------------------------------
    _section(story, styles, "4. Global Economies Growth")
    economies = dataset.get("economies_growth") or []
    story.append(
        Paragraph(
            "Real growth for the major global economies and economic blocs covered by the "
            "GlobalEconomicSeries dataset, de-duplicated to the most recently published value "
            "per calendar year, matching the dashboard economies chart.",
            styles["body"],
        )
    )
    fig = charts.get("economic_economies")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.94, max_height=240))
    if economies:
        latest_economy_year = economies[-1]
        year_label = str(latest_economy_year.get("year", "")).replace("Real_", "")
        economy_rows = [["Economy", f"Real growth (%) — {year_label}"]]
        ordered_contexts = sorted(
            [(k, v) for k, v in latest_economy_year.items() if k != "year" and v is not None],
            key=lambda pair: pair[1],
            reverse=True,
        )
        economy_rows += [[_cell(context), f"{_p(value)}%"] for context, value in ordered_contexts]
        if len(economy_rows) > 1:
            economy_style = _table_style()
            economy_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
            _table(story, economy_rows, [CONTENT_W * 0.7, CONTENT_W * 0.3], economy_style)

    # Foreign trade ---------------------------------------------------------------------
    _section(story, styles, "5. Foreign Trade (Exports vs Imports)")
    story.append(
        Paragraph(
            "Total exports and imports by fiscal year from the foreign trade dataset used by "
            "the dashboard.",
            styles["body"],
        )
    )
    fig = charts.get("economic_trade")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=210))
    if trade:
        trade_rows = [["Fiscal year", "Exports", "Imports", "Balance"]]
        for pair in trade:
            exports = pair.get("exports")
            imports = pair.get("imports")
            balance = exports - imports if exports is not None and imports is not None else None
            trade_rows.append([
                pair["fiscal_year"],
                _p(exports),
                _p(imports),
                _p(balance),
            ])
        trade_style = _table_style()
        trade_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
        _table(
            story,
            trade_rows,
            [CONTENT_W * 0.22, CONTENT_W * 0.26, CONTENT_W * 0.26, CONTENT_W * 0.26],
            trade_style,
        )

    # Trade by partner & balance -----------------------------------------------------------
    _section(story, styles, "6. Trade by Partner & Balance")
    exports_partner = dataset.get("exports_by_partner") or []
    imports_partner = dataset.get("imports_by_partner") or []
    balance_rows = dataset.get("trade_balance") or []
    story.append(
        Paragraph(
            "Bilateral trade flows split by major partner (India, China and other countries) "
            "and the resulting annual trade balance, from the foreign-trade statistic rows "
            "recorded per fiscal year.",
            styles["body"],
        )
    )
    fig_exports = charts.get("economic_export_partners")
    if fig_exports:
        story.append(_image(fig_exports, max_width=CONTENT_W * 0.9, max_height=210))
    fig_imports = charts.get("economic_import_partners")
    if fig_imports:
        story.append(_image(fig_imports, max_width=CONTENT_W * 0.9, max_height=210))
    fig_balance = charts.get("economic_balance")
    if fig_balance:
        story.append(_image(fig_balance, max_width=CONTENT_W * 0.9, max_height=200))
    if exports_partner:
        latest_partner_year = exports_partner[-1]["fiscal_year"]
        partner_rows = [["Partner", f"Exports — {latest_partner_year}", f"Imports — {latest_partner_year}"]]
        imports_latest = imports_partner[-1] if imports_partner else {}
        for partner in ("India", "China", "Other Countries"):
            partner_rows.append([
                _cell(partner),
                _p(exports_partner[-1].get(partner)),
                _p(imports_latest.get(partner)),
            ])
        if len(partner_rows) > 1:
            partner_style = _table_style()
            partner_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
            _table(story, partner_rows, [CONTENT_W * 0.3, CONTENT_W * 0.35, CONTENT_W * 0.35], partner_style)

    # Economy-wide growth -------------------------------------------------------------------
    _section(story, styles, "7. Economy-wide Growth")
    overall_growth = dataset.get("overall_growth") or []
    story.append(
        Paragraph(
            "Growth decomposed into agriculture, non-agriculture, industry and service "
            "components from the SectoralGrowth 'Overall' sector records per fiscal year.",
            styles["body"],
        )
    )
    fig = charts.get("economic_overall")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=210))
    if overall_growth:
        overview_rows = [["Fiscal year", "Agriculture (%)", "Non-agriculture (%)", "Industry (%)", "Service (%)"]]
        for pair in overall_growth:
            overview_rows.append([
                _cell(pair["fiscal_year"]),
                _p(pair.get("agriculture")),
                _p(pair.get("nonagriculture")),
                _p(pair.get("industry")),
                _p(pair.get("service")),
            ])
        overview_style = _table_style()
        overview_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
        _table(
            story,
            overview_rows,
            [CONTENT_W * 0.2, CONTENT_W * 0.2, CONTENT_W * 0.22, CONTENT_W * 0.18, CONTENT_W * 0.2],
            overview_style,
        )

    # Sectoral growth -------------------------------------------------------------------
    _section(story, styles, "8. Sectoral Growth")
    story.append(
        Paragraph(
            f"Sector-level annual growth for the most recent fiscal year "
            f"({latest_sector_year or 'latest'}), from the backend sectoral growth dataset.",
            styles["body"],
        )
    )
    fig = charts.get("economic_sectoral")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.9, max_height=260))
    if latest_sectors:
        ordered_sectors = sorted(latest_sectors, key=lambda s: s["value"], reverse=True)[:15]
        sector_rows = [["Sector", "Growth (%)"]]
        sector_rows += [[_cell(sector["sector"]), f"{_p(sector['value'])}%"] for sector in ordered_sectors]
        sector_style = _table_style()
        sector_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
        _table(story, sector_rows, [CONTENT_W * 0.7, CONTENT_W * 0.3], sector_style)

    # Province-level GDP ---------------------------------------------------------------
    _section(story, styles, "9. Province-level GDP Growth")
    story.append(
        Paragraph(
            f"GDP growth at basic prices for each province in the most recent fiscal year "
            f"({province_latest['fiscal_year'] if province_latest else 'latest'}), from the "
            "province-level GDP dataset.",
            styles["body"],
        )
    )
    fig = charts.get("economic_province_gdp")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.92, max_height=220))
    if province_latest and province_latest.get("provinces"):
        province_rows = [["Province", "GDP (basic prices)", "GDP (purchaser prices)", "Status"]]
        ordered_provinces = [p for p in (province_gdp.get("provinces") or []) if p in province_latest["provinces"]]
        for province in ordered_provinces:
            record = province_latest["provinces"][province]
            province_rows.append([
                _cell(record["province"]),
                f"{_p(record.get('growth_basic_price'))}%",
                f"{_p(record.get('growth_purchaser_price'))}%",
                _cell(record.get("data_status") or ""),
            ])
        province_style = _table_style()
        province_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
        _table(
            story,
            province_rows,
            [CONTENT_W * 0.34, CONTENT_W * 0.24, CONTENT_W * 0.26, CONTENT_W * 0.16],
            province_style,
        )

    # Salary & wage rate index -------------------------------------------------------------
    _section(story, styles, "10. Salary & Wage Rate Index")
    salary_index = dataset.get("salary_index") or []
    story.append(
        Paragraph(
            "The salary and wage rate index series by category, one aggregate value per fiscal "
            "year and group from the SalaryIndex dataset.",
            styles["body"],
        )
    )
    fig = charts.get("economic_salary")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.94, max_height=240))
    salary_years = sorted({row["year"] for row in salary_index})
    latest_salary_year = salary_years[-1] if salary_years else None
    if latest_salary_year:
        salary_rows = [["Category", f"Index — {latest_salary_year}"]]
        for row in sorted(
            [item for item in salary_index if item["year"] == latest_salary_year],
            key=lambda item: item["value"] or 0,
            reverse=True,
        ):
            salary_rows.append([_cell(row["group"]), _p(row["value"])])
        salary_style = _table_style()
        salary_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
        _table(story, salary_rows, [CONTENT_W * 0.7, CONTENT_W * 0.3], salary_style)

    # Agriculture producer price index ------------------------------------------------------
    _section(story, styles, "11. Agriculture Producer Price Index")
    appi_rows = dataset.get("appi") or []
    story.append(
        Paragraph(
            "Agricultural producer price indices by product, quarter and base year from the "
            "AgricultureProducerPriceIndex dataset. The chart shows the annual index for the "
            "most recent recorded base year.",
            styles["body"],
        )
    )
    fig = charts.get("economic_appi")
    if fig:
        story.append(_image(fig, max_width=CONTENT_W * 0.94, max_height=280))
    if appi_rows:
        appi_years = sorted(
            {row["base_year"] for row in appi_rows},
            key=lambda year: int(_NUM_RE.search(str(year)).group(0)) if _NUM_RE.search(str(year)) else 0,
        )
        latest_appi_year = appi_years[-1] if appi_years else None
        latest_base = [row for row in appi_rows if row["base_year"] == latest_appi_year]
        if latest_base:
            ordered_products = sorted(latest_base, key=lambda row: row["value"] or 0, reverse=True)[:15]
            appi_table = [["Product", "Index"]]
            appi_table += [
                [_cell(row["product"]), _p(row["value"])]
                for row in ordered_products
            ]
            appi_style = _table_style()
            appi_style.add("ALIGN", (0, 1), (0, -1), "LEFT")
            _table(story, appi_table, [CONTENT_W * 0.7, CONTENT_W * 0.3], appi_style)

    # Key trends ------------------------------------------------------------------------
    _section(story, styles, "12. Key Trends & Observations")
    for i, observation in enumerate(trends, start=1):
        story.append(Paragraph(f"<b>{i}.</b> {observation}", styles["bullet"]))

    # Data sources ----------------------------------------------------------------------
    _section(story, styles, "13. Data Sources")
    sources_rows = [
        ["Dataset", "Fields", "Reference"],
        ["Global Economics", "Context, real growth values, published year", "GlobalEconomicSeries"],
        ["Foreign Trade", "Total exports / imports per fiscal year", "ForeignTradeStatistic"],
        ["Trade by Partner & Balance", "Bilateral flows by partner and trade balance", "ForeignTradeStatistic"],
        ["Sectoral Growth", "Sector-level annual growth", "SectoralGrowth"],
        ["Economy-wide Growth", "Agriculture / non-agriculture / industry / service growth", "SectoralGrowth"],
        ["Salary & Wage Rate Index", "Index values by category per fiscal year", "SalaryIndex"],
        ["Agriculture Producer Price Index", "Producer price indices by product, quarter and base year", "AgricultureProducerPriceIndex"],
        ["Province GDP Growth", "GDP growth at basic / purchaser prices by province", "ProvinceGDPStatistic"],
    ]
    sources_style = _table_style()
    sources_style.add("ALIGN", (1, 0), (2, -1), "LEFT")
    _table(
        story,
        sources_rows,
        [CONTENT_W * 0.36, CONTENT_W * 0.38, CONTENT_W * 0.26],
        sources_style,
    )

    # Methodology -----------------------------------------------------------------------
    _section(story, styles, "14. Methodology")
    story.append(
        Paragraph(
            "All figures are queried directly from the backend database that also powers the "
            "economic dashboard APIs, so this report is consistent with the on-screen dashboard. "
            "World Output real growth is deduplicated to the most recently published value per "
            "calendar year, as are the global economies series (one value per economy and year). "
            "Foreign trade uses the total exports and total imports series only, with partner "
            "flows limited to India, China and other countries and the trade balance taken from "
            "the recorded balance series. "
            "Economy-wide growth decomposes the 'Overall' sector records into agriculture, "
            "non-agriculture, industry and service. Salary index values are one aggregate row "
            "per category and fiscal year, preferring the broadest index when several rows "
            "share a category. "
            "Sectoral performance shows the sectors recorded for the most recent fiscal year. "
            "Province-level GDP growth is taken one record per province and fiscal year, "
            "preferring the most recently published status. "
            "Charts are rendered from the same retrieved data.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            "Values recorded as 'n/a' are not present in the backend dataset and are deliberately "
            "excluded rather than approximated.",
            styles["body"],
        )
    )

    # Data dictionary -------------------------------------------------------------------
    _section(story, styles, "15. Data Dictionary")
    dictionary = [
        ["Variable", "Description", "Unit"],
        ["World Output real growth", "Real growth of global output", "%"],
        ["Global economies growth", "Real growth by economy / economic bloc", "%"],
        ["Exports / Imports", "Total value traded per fiscal year", "As recorded"],
        ["Trade by partner", "Exports / imports with India, China, other countries", "As recorded"],
        ["Trade balance", "Exports minus imports per fiscal year", "As recorded"],
        ["Economy-wide growth", "Agriculture / non-agriculture / industry / service growth", "%"],
        ["Sectoral growth", "Growth by economic sector", "%"],
        ["Salary & Wage Rate Index", "Index by category and fiscal year", "Index"],
        ["Agriculture producer price index", "Price index by product, quarter and base year", "Index"],
        ["Province GDP growth", "Growth at basic / purchaser prices by province", "%"],
    ]
    _table(
        story,
        dictionary,
        [CONTENT_W * 0.28, CONTENT_W * 0.44, CONTENT_W * 0.28],
    )

    # Appendix --------------------------------------------------------------------------
    _section(story, styles, "16. Appendix: Report Parameters")
    params = [
        ["Parameter", "Value"],
        ["Report period", report_period],
        ["Active indicator", state.get("indicator") or "growth"],
        ["Indicator range", state.get("range") or "5"],
        ["Selected year", state.get("year") or "All"],
        ["Dashboard filters", ", ".join(f"{k}: {v}" for k, v in (state.get("filters") or {}).items()) or "None"],
        ["Generated at", generated_label],
    ]
    story.append(
        KeepTogether(
            [
                Spacer(1, TABLE_SPACE_BEFORE),
                _make_table(params, [CONTENT_W * 0.4, CONTENT_W * 0.6], _table_style_aligned_left()),
                Spacer(1, TABLE_SPACE_AFTER),
                Paragraph(
                    "This report was generated automatically from live database values and may be "
                    "regenerated at any time as new data becomes available.",
                    styles["small"],
                ),
            ]
        )
    )

    return story, meta


def build_economic_pdf(dataset, charts, trends, state):
    """Builds the full economic dashboard PDF."""
    with _chart_scaling(CHART_SCALE_ECONOMIC):
        story, meta = build_economic_story(dataset, charts, trends, state)
        return _build_pdf(story, meta)