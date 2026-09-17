"""Assembles the comprehensive national dashboard report as a PDF.

Uses reportlab Platypus: A4 portrait, a designed cover page, body pages with
repeating header/footer and page numbers, tables with repeated headers, and
embedded matplotlib charts.
"""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image as RLImage,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ACCENT = colors.HexColor("#b70011")
ACCENT_DARK = colors.HexColor("#7a0a12")
PRIMARY = colors.HexColor("#0051d5")
TEXT = colors.HexColor("#20202a")
MUTED = colors.HexColor("#5c5c68")
LIGHT = colors.HexColor("#f5f3f1")
LIGHT_ACCENT = colors.HexColor("#fbe9e7")
WHITE = colors.HexColor("#ffffff")
BORDER = colors.HexColor("#e3dedc")

PAGE_W, PAGE_H = A4
MARGIN = 50
CONTENT_W = PAGE_W - 2 * MARGIN

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
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 8.5),
            ("FONTSIZE", (0, 1), (-1, -1), 8.5),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("TEXTCOLOR", (0, 0), (-1, -1), TEXT),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT]),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("BOX", (0, 0), (-1, -1), 0.9, BORDER),
            ("LINEABOVE", (0, 0), (-1, 0), 1.6, accent or header_blend),
            ("LINEBELOW", (0, -1), (-1, -1), 0.8, accent or header_blend),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
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
    if height > max_height:
        height = max_height
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
    for i, line in enumerate(_wrap_descriptor(descriptor, 92)):
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


def _wrap_descriptor(text, limit):
    """Breaks a descriptor string into display lines for the cover page."""
    words = str(text or "").split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= limit:
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
    story.append(Paragraph(title, _h1_style(accent)))
    story.append(
        HRFlowable(
            width="100%",
            thickness=1.4,
            color=(accent or ACCENT_DARK),
            spaceBefore=0,
            spaceAfter=10,
            lineCap="butt",
        )
    )


def _table(story, data, col_widths, style=None):
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(style if style is not None else _table_style())
    story.append(Spacer(1, 4))
    story.append(table)
    story.append(Spacer(1, 8))


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
    _table(
        story,
        params,
        [CONTENT_W * 0.4, CONTENT_W * 0.6],
        _table_style_aligned_left(),
    )
    story.append(
        Paragraph(
            "This report was generated automatically from live database values and may be "
            "regenerated at any time as new data becomes available.",
            styles["small"],
        )
    )

    return story, meta


def _table_style_aligned_left():
    style = _table_style()
    style.add("ALIGN", (0, 0), (0, -1), "LEFT")
    return style


def _build_pdf(story, meta):
    """Wraps a story + meta into a built PDF. Returns (pdf_bytes, filename)."""
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
        "descriptor": "Tourist arrivals, source markets and revenue for the tourism dashboard",
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

    # Key trends ------------------------------------------------------------------------
    _section(story, styles, "6. Key Trends & Observations")
    for i, observation in enumerate(trends, start=1):
        story.append(Paragraph(f"<b>{i}.</b> {observation}", styles["bullet"]))

    # Data sources ----------------------------------------------------------------------
    _section(story, styles, "7. Data Sources")
    sources_rows = [
        ["Dataset", "Fields", "Reference"],
        ["Tourist Arrivals (annual)", "Total, third-country and Indian arrivals, change", "TouristArrivalByYear"],
        ["Arrivals by Nationality", "Nationality, arrivals, share", "TouristArrivalByNationality"],
        ["Tourism Revenue", "Fiscal year, value, unit", "TourismRevenue"],
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
    _section(story, styles, "8. Methodology")
    story.append(
        Paragraph(
            "All figures are queried directly from the backend database that also powers the "
            "tourism dashboard APIs, so this report is consistent with the on-screen dashboard. "
            "Arrival totals are the sum of third-country and Indian visitor records. Source "
            "market shares are percentages of the reference year's total arrivals. Revenue "
            "figures use the US$ million series only, matching the dashboard revenue trend. "
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
    _section(story, styles, "9. Data Dictionary")
    dictionary = [
        ["Variable", "Description", "Unit"],
        ["Total arrivals", "Recorded annual tourist arrivals", "Persons"],
        ["Third country / Indian", "Arrival split by visitor origin", "Persons"],
        ["Change (%)", "Year-on-year change in total arrivals", "%"],
        ["Revenue", "Annual tourism revenue", "US$ million"],
    ]
    _table(
        story,
        dictionary,
        [CONTENT_W * 0.26, CONTENT_W * 0.46, CONTENT_W * 0.28],
    )

    # Appendix --------------------------------------------------------------------------
    _section(story, styles, "10. Appendix: Report Parameters")
    params = [
        ["Parameter", "Value"],
        ["Report period", report_period],
        ["Active tab", state.get("active_tab") or "arrivals"],
        ["Arrival range", state.get("arrival_range") or "5"],
        ["Revenue range", state.get("revenue_range") or "5"],
        ["Dashboard filters", ", ".join(f"{k}: {v}" for k, v in (state.get("filters") or {}).items()) or "None"],
        ["Generated at", generated_label],
    ]
    _table(
        story,
        params,
        [CONTENT_W * 0.4, CONTENT_W * 0.6],
        _table_style_aligned_left(),
    )
    story.append(
        Paragraph(
            "This report was generated automatically from live database values and may be "
            "regenerated at any time as new data becomes available.",
            styles["small"],
        )
    )

    return story, meta


def build_tourism_pdf(dataset, charts, trends, state):
    """Builds the full tourism dashboard PDF."""
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
        "descriptor": "World output, foreign trade and sectoral growth for the economic dashboard",
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

    # Foreign trade ---------------------------------------------------------------------
    _section(story, styles, "4. Foreign Trade (Exports vs Imports)")
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

    # Sectoral growth -------------------------------------------------------------------
    _section(story, styles, "5. Sectoral Growth")
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

    # Key trends ------------------------------------------------------------------------
    _section(story, styles, "6. Key Trends & Observations")
    for i, observation in enumerate(trends, start=1):
        story.append(Paragraph(f"<b>{i}.</b> {observation}", styles["bullet"]))

    # Data sources ----------------------------------------------------------------------
    _section(story, styles, "7. Data Sources")
    sources_rows = [
        ["Dataset", "Fields", "Reference"],
        ["Global Economics", "Context, real growth values, published year", "GlobalEconomicSeries"],
        ["Foreign Trade", "Total exports / imports per fiscal year", "ForeignTradeStatistic"],
        ["Sectoral Growth", "Sector-level annual growth", "SectoralGrowth"],
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
    _section(story, styles, "8. Methodology")
    story.append(
        Paragraph(
            "All figures are queried directly from the backend database that also powers the "
            "economic dashboard APIs, so this report is consistent with the on-screen dashboard. "
            "World Output real growth is deduplicated to the most recently published value per "
            "calendar year. Foreign trade uses the total exports and total imports series only. "
            "Sectoral performance shows the sectors recorded for the most recent fiscal year. "
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
    _section(story, styles, "9. Data Dictionary")
    dictionary = [
        ["Variable", "Description", "Unit"],
        ["World Output real growth", "Real growth of global output", "%"],
        ["Exports / Imports", "Total value traded per fiscal year", "As recorded"],
        ["Balance", "Exports minus imports", "As recorded"],
        ["Sectoral growth", "Growth by economic sector", "%"],
    ]
    _table(
        story,
        dictionary,
        [CONTENT_W * 0.28, CONTENT_W * 0.44, CONTENT_W * 0.28],
    )

    # Appendix --------------------------------------------------------------------------
    _section(story, styles, "10. Appendix: Report Parameters")
    params = [
        ["Parameter", "Value"],
        ["Report period", report_period],
        ["Active indicator", state.get("indicator") or "growth"],
        ["Indicator range", state.get("range") or "5"],
        ["Selected year", state.get("year") or "All"],
        ["Dashboard filters", ", ".join(f"{k}: {v}" for k, v in (state.get("filters") or {}).items()) or "None"],
        ["Generated at", generated_label],
    ]
    _table(
        story,
        params,
        [CONTENT_W * 0.4, CONTENT_W * 0.6],
        _table_style_aligned_left(),
    )
    story.append(
        Paragraph(
            "This report was generated automatically from live database values and may be "
            "regenerated at any time as new data becomes available.",
            styles["small"],
        )
    )

    return story, meta


def build_economic_pdf(dataset, charts, trends, state):
    """Builds the full economic dashboard PDF."""
    story, meta = build_economic_story(dataset, charts, trends, state)
    return _build_pdf(story, meta)