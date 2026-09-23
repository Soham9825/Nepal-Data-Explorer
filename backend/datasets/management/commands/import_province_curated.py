from __future__ import annotations

import csv
from pathlib import Path
from urllib.parse import quote

from django.core.management.base import BaseCommand
from django.db import transaction

from datasets.models import TourismDestination


# Wikipedia/Wikimedia Commons files shown for each destination (verified 2026-09).
# Used to build https://commons.wikimedia.org/wiki/Special:FilePath/<file>?width=1280
WIKIMEDIA_COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath"

# Official DoT/MoCTCA "number of trekkers in different trekking areas" CSV.
# Shipped under datasets/data. Only restricted-area/trek-region figures are
# mapped here (open areas such as Everest or Annapurna are not in this file),
# so unmatched destinations keep their existing annual_visitors value.
DEFAULT_TREKKERS_FILE = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "12number-of-trekkers-in-different-trekking-areas-20012024.csv"
)

# Official "Nepal Tourism Statistics 2025" destination visitor counts, shipped
# under datasets/data. Maps the official CSV destination name -> the curated
# destination it feeds. Official figures take precedence over the trekkers file.
DEFAULT_VISITORS_FILE = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "nepal_tourism_province_clean_2020_2025_final.csv"
)

# Official CSV destination -> curated destination name (as keyed in DESTINATIONS).
OFFICIAL_TO_CURATED = {
    "Chitwan National Park": "Chitwan National Park",
    "Pashupatinath": "Pashupatinath Temple",
    "Langtang National Park": "Langtang Valley",
    "Annapurna Conservation Area": "Annapurna Base Camp",
    "Mustang": "Mustang (Lo Manthang)",
    "Rara National Park": "Rara Lake",
    "SheyPhoksundo National Park": "Shey Phoksundo Lake",
    "Humla": "Simikot, Humla",
    "Sagarmatha National Park": "Sagarmatha (Everest) Region",
    "Kanchanjunga": "Kanchenjunga Region",
    "KoshiTappu Wildlife Reserve": "Koshi Tappu Wildlife Reserve",
    "Lumbini": "Lumbini, Birthplace of Buddha",
    "Shukla Phata Wildlife Reserve": "Shuklaphanta National Park",
    "Khaptad National Park": "Khaptad National Park",
}

# Canonical, project-wide province names (Koshi -> Sudurpashchim).
PROVINCE_NAMES = [
    "Koshi",
    "Madhesh",
    "Bagmati",
    "Gandaki",
    "Lumbini",
    "Karnali",
    "Sudurpashchim",
]

# Curated, well-known tourism destinations per province. Values are
# (name, description) pairs; visitor counts are intentionally left null rather
# than risk fabricated figures. Rank is assigned per-province by list order.
DESTINATIONS = {
    "Koshi": [
        (
            "Sagarmatha (Everest) Region",
            "The Khumbu Himal and gateway to the world's highest peak, centred on Namche Bazaar and Everest Base Camp.",
        ),
        (
            "Kanchenjunga Region",
            "Remote trekking trails around the world's third-highest mountain, Kanchenjunga, shared between Taplejung and India.",
        ),
        (
            "Ilam Tea Gardens",
            "Rolling tea estates and viewpoints such as Kanyam and Antu Danda in the far-eastern hills of Ilam.",
        ),
        (
            "Pathibhara Devi Temple",
            "A revered hilltop shrine in Taplejung, a popular pilgrimage and trekking destination.",
        ),
        (
            "Halesi Mahadev Temple",
            "A cave temple complex in Khotang, regarded as the 'Pashupatinath of eastern Nepal'.",
        ),
        (
            "Koshi Tappu Wildlife Reserve",
            "Wetland reserve in Sunsari famous for wild water buffalo, migratory birds and wetland birdwatching.",
        ),
        (
            "Baraha Chhetra",
            "A sacred site at the confluence of the Koka and Saptakoshi rivers in Sunsari, a major pilgrimage spot.",
        ),
    ],
    "Madhesh": [
        (
            "Janaki Temple, Janakpur",
            "One of Nepal's most important Hindu temples, dedicated to Goddess Sita at Janakpur Dham.",
        ),
        (
            "Chhinnamasta Bhagawati Temple",
            "A famous Shakti shrine near Rajbiraj in Saptari, dedicated to Goddess Chhinnamasta.",
        ),
        (
            "Dhanushadham Temple",
            "A pilgrimage site in Dhanusha believed to enshrine a piece of the bow used at Sita's swayamvar.",
        ),
        (
            "Gadhimai Temple",
            "A temple in Bara district whose festival draws huge crowds of pilgrims from Nepal and India.",
        ),
        (
            "Koshi Barrage",
            "An engineering landmark spanning the Saptakoshi river, a popular riverside site near Biratnagar-adjacent Sunsari.",
        ),
    ],
    "Bagmati": [
        (
            "Pashupatinath Temple",
            "Nepal's most revered Shiva temple on the banks of the Bagmati river in Kathmandu, a UNESCO World Heritage site.",
        ),
        (
            "Chitwan National Park",
            "Nepal's most famous wildlife safari park and a UNESCO World Heritage site, home to one-horned rhinos, tigers and gharials.",
        ),
        (
            "Swayambhunath Stupa",
            "The ancient 'monkey temple' crowning a hill west of Kathmandu, one of Nepal's oldest Buddhist monuments.",
        ),
        (
            "Boudhanath Stupa",
            "One of the largest Buddhist stupas in the world and the heart of Kathmandu's Tibetan community.",
        ),
        (
            "Kathmandu Durbar Square",
            "The historic royal square of the Malla kings, packed with temples, palaces and courtyards (UNESCO).",
        ),
        (
            "Patan Durbar Square",
            "The architectural gem of Lalitpur, famed for Newari craftsmanship and the Krishna Mandir.",
        ),
        (
            "Bhaktapur Durbar Square",
            "A well-preserved medieval city with the 55-window palace, Nyatapola temple and Taumadhi Tole.",
        ),
        (
            "Langtang Valley",
            "A scenic high-Himalaya trek in Rasuwa, close to Kathmandu and home to the Langtang Lirung range.",
        ),
        (
            "Nagarkot",
            "A hill station near Bhaktapur offering sunrise panoramas across the Himalayas all the way to Everest.",
        ),
        (
            "Changu Narayan Temple",
            "A hilltop UNESCO-listed temple in Bhaktapur, among the oldest Hindu shrines in the Kathmandu valley.",
        ),
    ],
    "Gandaki": [
        (
            "Pokhara",
            "Nepal's tourism capital set beside Phewa lake with close-up views of the Annapurna and Machhapuchhre ranges.",
        ),
        (
            "Phewa Lake",
            "The largest lake in Pokhara, famous for boating at sunrise and the Tal Barahi temple on its island.",
        ),
        (
            "Sarangkot",
            "A hilltop above Pokhara renowned for sunrise views of the Annapurna range and paragliding.",
        ),
        (
            "Annapurna Base Camp",
            "One of the world's classic treks, reaching the amphitheatre beneath Annapurna I's south face.",
        ),
        (
            "Mustang (Lo Manthang)",
            "The walled 15th-century capital of Upper Mustang, offering high-desert landscapes and Tibetan culture.",
        ),
        (
            "Ghandruk",
            "A Gurung village on the Annapurna trail with stone houses, museums and direct Machhapuchhre views.",
        ),
        (
            "Manakamana Temple",
            "A cable-car-served temple of Goddess Bhagwati in Gorkha, one of Nepal's most visited shrines.",
        ),
        (
            "Jomsom",
            "The windy administrative hub of Mustang and a staging point for the Annapurna and Upper Mustang circuits.",
        ),
    ],
    "Lumbini": [
        (
            "Lumbini, Birthplace of Buddha",
            "The UNESCO World Heritage site where the Buddha was born, centred on the Mayadevi temple and sacred garden.",
        ),
        (
            "Asoka Pillar, Lumbini",
            "The 3rd-century-BCE pillar inscribed by Emperor Asoka, confirming Lumbini as the Buddha's birthplace.",
        ),
        (
            "Kapilvastu (Tilaurakot)",
            "Archaeological remains of the Shakya capital where Siddhartha Gautama spent his youth before renunciation.",
        ),
        (
            "Tansen, Palpa",
            "A historic hill bazaar on the Siddhartha Highway, famed for its traditional Newari-Magar townscape.",
        ),
        (
            "Rani Mahal, Palpa",
            "A neoclassical riverside palace on the Kali Gandaki built in memory of Rani Resham Kumari, known as Nepal's 'Taj Mahal'.",
        ),
    ],
    "Karnali": [
        (
            "Rara Lake",
            "Nepal's largest lake and a turquoise jewel in Mugu at 2,990 metres, inside Rara National Park.",
        ),
        (
            "Shey Phoksundo Lake",
            "A deep alpine lake in Dolpa at 3,600 metres, at the heart of Shey Phoksundo National Park.",
        ),
        (
            "Sinja Valley, Jumla",
            "The ancient capital of the Khas kingdom and cradle of the Nepali language, with medieval ruins.",
        ),
        (
            "Simikot, Humla",
            "A remote high-altitude town and the traditional gateway for pilgrims trekking towards Mount Kailash.",
        ),
    ],
    "Sudurpashchim": [
        (
            "Khaptad National Park",
            "A grassland plateau park across Bajhang, Bajura, Doti and Achham, sacred to the Baba Khaptad ashram.",
        ),
        (
            "Shuklaphanta National Park",
            "Ericaceous wetland grassland in Kanchanpur, home to swamp deer, wild elephants and Bengal tigers.",
        ),
        (
            "Badimalika Temple",
            "A revered goddess temple on a 4,200-metre ridge in Bajura, a major pilgrimage destination.",
        ),
        (
            "Parashuram Dham",
            "A sacred temple by the Mahakali river in Dadeldhura, dedicated to the warrior-sage Parashuram.",
        ),
        (
            "Saipal Himal",
            "A 7,031-metre summit and remote trekking region in Baitadi, among the least-visited Himalayas in Nepal.",
        ),
    ],
}

# Wikimedia Commons filenames, matched by index to each province's DESTINATIONS list.
IMAGES = {
    "Koshi": [
        "Everest, Himalayas.jpg",
        "Kangchenjunga.jpg",
        "Ilam tea garden.jpg",
        "Pathivara,Taplejung temple.jpg",
        "Halesi Mahadev Temple.jpg",
        "Jungle-Jungle in Koshi Tappu Wildlife Reserve, Nepal.jpg",
        "Barahachhetra sapta koshi.JPG",
    ],
    "Madhesh": [
        "Janaki Mandir.jpg",
        "Chinnamasta Temple Rajbiraj Saptari NPSAP01 (13).jpg",
        "Dhanush Mandir, Dhanushadham Janakpur.jpg",
        "Gadhimai Temple (2).JPG",
        "Koshi Barrage -00003921.jpg",
    ],
    "Bagmati": [
        "Pashupatinath.jpg",
        "Rhinoceros in Chitwan National Park.jpg",
        "Swayambhunath.jpg",
        "Boudhanath Stupa.jpg",
        "Kathmandu Durbar Square.jpg",
        "Patan Durbar Square.jpg",
        "Bhaktapur Durbar Square.jpg",
        "Langtang Lirung.jpg",
        "Nagarkot view.jpg",
        "Changu Narayan Temple.jpg",
    ],
    "Gandaki": [
        "Pokhara.jpg",
        "Phewa Lake.jpg",
        "Sarangkot.jpg",
        "Annapurna Base Camp.jpg",
        "Lo Manthang.jpg",
        "Ghandruk.jpg",
        "Manakamana Temple.jpg",
        "Jomsom.jpg",
    ],
    "Lumbini": [
        "Lumbini Maya Devi Temple 1.jpg",
        "Ashoka Pillar, Mayadevi Temple, Lumbini.jpg",
        "Tilaurakot, Taulihawa Kapilbastu Lumbini Zone Western Nepal 3, Rajesh Dhungana.jpg",
        "Tansen, Palpa, Nepal.jpg",
        "Rani Mahal,Palpa.jpg",
    ],
    "Karnali": [
        "Rara Lake.jpg",
        "Shey-Phoksundo Lake in Dolpa.jpg",
        "Sinja Valley.JPG",
        "Simikot.jpg",
    ],
    "Sudurpashchim": [
        "Khaptad, Khaptad National Park, Nepal.jpg",
        "Shuklaphanta National park.jpg",
        "Badimalika Temple, Bajura, Nepal.jpg",
        "Parashuramdham (1).jpg",
        "Saipal Himal.jpg",
    ],
}


def commons_file_url(filename):
    """Absolute URL for a Wikimedia Commons file, resized to 1280px."""
    return f"{WIKIMEDIA_COMMONS}/{quote(filename)}?width=1280"


# Canonical curated destination -> official trekking region(s) in the DoT CSV.
# The figures are summed across listed regions for the latest available year.
TREKKERS_REGION_MAP = {
    "Kanchenjunga Region": ["Kanchanjunga"],
    "Mustang (Lo Manthang)": ["Mustang"],
    "Simikot, Humla": ["Humla"],
    "Shey Phoksundo Lake": ["Lower Dolpa", "Upper Dolpa"],
}


def load_official_counts(path):
    """Latest-year official visitor counts keyed by curated destination name.

    Uses the "Nepal Tourism Statistics 2025" per-destination CSV; the most recent
    year available for each official destination wins.
    """
    latest = {}
    with open(path, newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            try:
                year = int(str(row.get("year", "")).strip())
                destination = str(row.get("destination", "")).strip()
                value = int(str(row.get("visitor_count", "")).replace(",", "").strip())
            except (ValueError, AttributeError, TypeError):
                continue
            if not destination or not value:
                continue
            previous = latest.get(destination)
            if previous is None or year > previous[0]:
                latest[destination] = (year, value)

    counts = {}
    years = {}
    for official, curated in OFFICIAL_TO_CURATED.items():
        hit = latest.get(official)
        if not hit:
            continue
        counts[curated] = hit[1]
        years[curated] = hit[0]
    return counts, years


def load_trekker_counts(path):
    """Latest-year official trekker counts keyed by curated destination name.

    Returns (counts, years): counts maps a destination to its total annual trekkers
    from the most recent year with data; years maps a destination to that year.
    """
    latest = {}
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            try:
                year = int(str(row.get("Year", "")).strip())
                region = str(row.get("Region", "")).strip()
                value = int(str(row.get("Value", "")).replace(",", "").strip())
            except (ValueError, AttributeError, TypeError):
                continue
            if not region or not value:
                continue
            previous = latest.get(region)
            if previous is None or year > previous[0]:
                latest[region] = (year, value)

    counts = {}
    years = {}
    for destination, regions in TREKKERS_REGION_MAP.items():
        matched = [(y, v) for y, v in (latest.get(r) for r in regions) if v]
        if not matched:
            continue
        total = sum(value for _, value in matched)
        year = max(y for y, _ in matched)
        counts[destination] = total
        years[destination] = year
    return counts, years


class Command(BaseCommand):
    help = (
        "Seed curated tourism destination data across the seven provinces. "
        "Designed to be run repeatedly: rows are upserted by (name, province) "
        "and any previously active destination dropped from this list is "
        "soft-deactivated. Where an official visitor figure exists (Nepal Tourism "
        "Statistics dataset first, DoT trekkers as fallback), annual_visitors is "
        "populated from the latest year."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--visitors-file",
            default=str(DEFAULT_VISITORS_FILE),
            help=(
                "Path to the official Nepal Tourism Statistics per-destination CSV. "
                "Pass an empty string to skip. Figures take precedence over --trekkers-file."
            ),
        )
        parser.add_argument(
            "--trekkers-file",
            default=str(DEFAULT_TREKKERS_FILE),
            help=(
                "Path to the official DoT trekkers-per-region CSV. "
                "Pass an empty string to skip visitor counts."
            ),
        )

    def handle(self, *args, **options):
        expected = set(PROVINCE_NAMES)
        provided = set(DESTINATIONS)
        missing = sorted(expected - provided)
        unknown = sorted(provided - expected)
        if missing:
            self.stderr.write(self.style.ERROR(f"Missing destinations for provinces: {', '.join(missing)}"))
        if unknown:
            self.stderr.write(self.style.ERROR(f"Unknown provinces in data: {', '.join(unknown)}"))
        if missing or unknown:
            raise SystemExit(1)

        visitor_counts = {}
        visitor_years = {}
        visitors_file = options.get("visitors_file") or ""
        if visitors_file:
            path = Path(visitors_file)
            if path.exists():
                visitor_counts, visitor_years = load_official_counts(path)
            else:
                self.stderr.write(
                    self.style.WARNING(f"Visitors file not found: {path} — official figures skipped.")
                )
        else:
            self.stderr.write(self.style.WARNING("Visitors file skipped — official figures ignored."))

        trekkers_file = options.get("trekkers_file") or ""
        trekker_counts = {}
        trekker_years = {}
        if trekkers_file:
            path = Path(trekkers_file)
            if path.exists():
                trekker_counts, trekker_years = load_trekker_counts(path)
            else:
                self.stderr.write(
                    self.style.WARNING(
                        f"Trekkers file not found: {path} — trekking fallback skipped."
                    )
                )
        else:
            self.stderr.write(self.style.WARNING("Trekkers file skipped — trekking fallback ignored."))

        # Official 2025 figures win; the trekkers file only fills destinations the
        # official dataset does not cover (e.g. Dolpa Lower/Upper totalled).
        for destination, value in trekker_counts.items():
            if destination not in visitor_counts:
                visitor_counts[destination] = value
                visitor_years[destination] = trekker_years.get(destination)

        created_count = 0
        updated_count = 0
        visitors_applied = 0
        with transaction.atomic():
            for province in PROVINCE_NAMES:
                place_rows = DESTINATIONS[province]
                images = IMAGES.get(province, [])
                for rank, (name, description) in enumerate(place_rows, start=1):
                    filename = images[rank - 1] if rank - 1 < len(images) else ""
                    defaults = {
                        "rank": rank,
                        "description": description,
                        "image_url": commons_file_url(filename) if filename else "",
                        "is_active": True,
                    }
                    if name in visitor_counts:
                        defaults["annual_visitors"] = visitor_counts[name]
                        visitors_applied += 1
                    _, created = TourismDestination.objects.update_or_create(
                        name=name,
                        province=province,
                        defaults=defaults,
                    )
                    if created:
                        created_count += 1
                    else:
                        updated_count += 1

            active_names = set()
            for province in PROVINCE_NAMES:
                active_names.update(name for name, _ in DESTINATIONS[province])
            deactivated = TourismDestination.objects.filter(
                province__in=PROVINCE_NAMES, is_active=True
            ).exclude(name__in=active_names)
            deactivated_count = deactivated.update(is_active=False)

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {created_count} destinations created, {updated_count} updated, "
                f"{deactivated_count} deactivated across {len(active_names)} curated places. "
                f"{visitors_applied} destinations got official visitor counts"
                + (
                    f" ({', '.join(sorted({str(y) for y in visitor_years.values()}))} data)."
                    if visitor_years
                    else "."
                )
            )
        )