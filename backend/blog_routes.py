"""
Blog module.

Writes editorial brand-history articles grounded in the live catalog — not
generic weekly sales roundups. Each generation picks a brand that does not yet
have a story (or the least-recent one), so the journal accumulates unique
articles instead of repeating the same “edit of the week”.

Generation needs no external AI API: heritage copy comes from a curated phrase
bank per house, combined with real products currently in stock.
"""
import os
import re
import sys
import random
import uuid
import html
import collections
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Tuple

from fastapi import APIRouter, HTTPException, Depends, Query
from motor.motor_asyncio import AsyncIOMotorClient

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.append(str(THIS_DIR))
from server import User, get_current_admin  # noqa: E402

blog_router = APIRouter(prefix="/api/blog", tags=["blog"])

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "kayee01_db")]
UPLOADS_DIR = THIS_DIR / "uploads"

GENERATION_INTERVAL_DAYS = 3  # brand stories more often than once a week


def slugify(text: str) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-") or "post"


# ---- Brand heritage banks (house history → editorial prose) ----
# Keys are normalized tokens matched against category / product text.
_BRAND_LORE: Dict[str, dict] = {
    "chanel": {
        "name": "Chanel",
        "founded": "1910",
        "origin": "Paris",
        "lede": (
            "Gabrielle Chanel did not invent elegance — she stripped it of costume. "
            "From a millinery atelier on rue Cambon to a house that redefined how women dress, "
            "Chanel remains a study in restraint, proportion, and confidence without ornament for its own sake."
        ),
        "history": [
            "The early years were hats and jersey suits — practical pieces that freed the body from corsetry.",
            "The little black dress, the quilted handbag, the camellia: each became a vocabulary rather than a trend.",
            "Perfume Nº5 turned scent into signature; costume jewellery made sparkle democratic without losing polish.",
        ],
        "craft": (
            "Look for clean lines, interlocking motifs used sparingly, and finishes that favour touch over flash. "
            "Chanel’s lasting influence is not logo volume — it is silhouette discipline."
        ),
    },
    "louis vuitton": {
        "name": "Louis Vuitton",
        "founded": "1854",
        "origin": "Paris",
        "lede": (
            "Louis Vuitton began with trunks built for travel — flat-topped, stackable, and tough enough for steamships. "
            "The monogram that followed was less decoration than a mark of authenticity in an age of copies."
        ),
        "history": [
            "Early trunks and leather craftsmanship made the house synonymous with departure and arrival.",
            "The LV monogram canvas (1896) answered counterfeiting while becoming one of fashion’s most recognised patterns.",
            "From luggage to ready-to-wear and jewellery, the house kept a traveller’s sense of structure and finish.",
        ],
        "craft": (
            "In pieces we carry today, that heritage reads as construction: edges that hold, hardware that feels considered, "
            "and patterns that still echo the trunk-maker’s precision."
        ),
    },
    "lv": {
        "name": "Louis Vuitton",
        "founded": "1854",
        "origin": "Paris",
        "lede": (
            "Louis Vuitton began with trunks built for travel — flat-topped, stackable, and tough enough for steamships. "
            "The monogram that followed was less decoration than a mark of authenticity in an age of copies."
        ),
        "history": [
            "Early trunks and leather craftsmanship made the house synonymous with departure and arrival.",
            "The LV monogram canvas (1896) answered counterfeiting while becoming one of fashion’s most recognised patterns.",
            "From luggage to ready-to-wear and jewellery, the house kept a traveller’s sense of structure and finish.",
        ],
        "craft": (
            "In pieces we carry today, that heritage reads as construction: edges that hold, hardware that feels considered, "
            "and patterns that still echo the trunk-maker’s precision."
        ),
    },
    "rolex": {
        "name": "Rolex",
        "founded": "1905",
        "origin": "London / Geneva",
        "lede": (
            "Rolex did not invent the wristwatch, but it made the wristwatch inevitable — waterproof, self-winding, "
            "and built as an instrument rather than jewellery alone."
        ),
        "history": [
            "Hans Wilsdorf chased reliability: the Oyster case (1926) and the Perpetual rotor reshaped what a watch could survive.",
            "Explorers, pilots and divers carried Rolex into environments where fashion usually fails.",
            "The Datejust, Submariner and Daytona became archetypes — designs other houses still orbit."
        ],
        "craft": (
            "What endures is legibility and toughness: a dial you can read at a glance, a bracelet that settles on the wrist, "
            "and a reputation earned in use, not only in display."
        ),
    },
    "dior": {
        "name": "Dior",
        "founded": "1946",
        "origin": "Paris",
        "lede": (
            "Christian Dior’s New Look of 1947 restored volume and romance after wartime austerity — "
            "cinched waists, full skirts, and a return of couture as theatre."
        ),
        "history": [
            "The house moved quickly from couture salons to a global language of femininity and finish.",
            "Later decades expanded into ready-to-wear, leather goods and jewellery without abandoning atelier standards.",
            "Each creative director has reinterpreted the Bar silhouette and the Cannage motif for a new decade.",
        ],
        "craft": (
            "Dior pieces still favour architecture: structured lines, careful quilting, and ornaments that feel composed rather than loud."
        ),
    },
    "gucci": {
        "name": "Gucci",
        "founded": "1921",
        "origin": "Florence",
        "lede": (
            "Guccio Gucci started with leather goods inspired by English riding culture — bits, stirrups, and the idea "
            "that luxury could travel from the stable to the city."
        ),
        "history": [
            "The double G, the green-red web, and bamboo handles became shorthand for Italian craftsmanship with a worldly wink.",
            "Mid-century Hollywood adopted Gucci; later decades swung between classic restraint and maximal colour.",
            "Today the house still balances heritage hardware with restless experimentation.",
        ],
        "craft": (
            "Look for leather that softens with wear, motifs used as rhythm rather than noise, and silhouettes that keep a Florentine confidence."
        ),
    },
    "cartier": {
        "name": "Cartier",
        "founded": "1847",
        "origin": "Paris",
        "lede": (
            "Cartier earned the title “jeweller of kings” by treating precious metal like architecture — "
            "clean geometry, precise settings, and icons that outlived fashion cycles."
        ),
        "history": [
            "The Santos (1904) and Tank watches brought jewellery thinking to timekeeping.",
            "Love bracelets, panther motifs and Trinity rings became cultural shorthand for commitment and play.",
            "Across continents, Cartier kept a Parisian clarity: red for passion, clean lines for permanence.",
        ],
        "craft": (
            "In our selection, that heritage appears as balance — weight that feels intentional, clasps that close with certainty, "
            "and forms that photograph as strongly as they wear."
        ),
    },
    "burberry": {
        "name": "Burberry",
        "founded": "1856",
        "origin": "Basingstoke / London",
        "lede": (
            "Thomas Burberry invented gabardine so explorers and officers could move through weather without ceremony. "
            "The trench coat that followed became British design’s most exported silhouette."
        ),
        "history": [
            "Check linings and weatherproof cloth made function fashionable long before “techwear” had a name.",
            "From polar expeditions to city streets, Burberry carried utility into elegance.",
            "Contemporary collections still circle the trench, the check, and a dry English wit.",
        ],
        "craft": (
            "Expect structured outerwear energy even in smaller pieces: clean seams, durable cloth language, and patterns that feel inherited rather than printed on."
        ),
    },
    "hermes": {
        "name": "Hermès",
        "founded": "1837",
        "origin": "Paris",
        "lede": (
            "Hermès began as a harness workshop. The patience of saddle-stitch leatherwork still defines a house "
            "that treats time as an ingredient, not an obstacle."
        ),
        "history": [
            "From equestrian equipment to scarves, watches and bags, craft remained the constant.",
            "The Birkin and Kelly entered popular culture, yet the atelier’s handwork stayed deliberately slow.",
            "Orange boxes and quiet hardware signal a luxury that refuses to hurry.",
        ],
        "craft": (
            "Even when you meet Hermès energy in accessories, the cue is finish: edges, stitching rhythm, and materials chosen to age rather than shine once."
        ),
    },
    "omega": {
        "name": "Omega",
        "founded": "1848",
        "origin": "Switzerland",
        "lede": (
            "Omega built a reputation on precision — Olympic timing, Moon missions, and tool watches that had to work "
            "when the moment could not be repeated."
        ),
        "history": [
            "The Speedmaster’s association with Apollo cemented the brand in exploration history.",
            "Seamaster and Constellation lines balanced sport and dress with Swiss consistency.",
            "Co-Axial escapements later pushed chronometry into a new chapter.",
        ],
        "craft": (
            "What we look for is dial clarity, case proportion, and the sense that the watch was designed to be used — not merely displayed."
        ),
    },
    "prada": {
        "name": "Prada",
        "founded": "1913",
        "origin": "Milan",
        "lede": (
            "Prada turned intellectual minimalism into desire — nylon as luxury, irony as elegance, "
            "and a Milanese cool that never needed to shout."
        ),
        "history": [
            "A leather-goods house reinvented itself in the 1980s and 1990s through Miuccia Prada’s exacting eye.",
            "Industrial materials and clean lines challenged what “precious” was allowed to mean.",
            "The triangle logo became a quiet seal rather than a billboard.",
        ],
        "craft": (
            "Prada pieces reward attention to proportion and material honesty — design that feels smart before it feels loud."
        ),
    },
    "celine": {
        "name": "Celine",
        "founded": "1945",
        "origin": "Paris",
        "lede": (
            "Celine has long spoken softly: precise tailoring, unfussy leather, and a Parisian wardrobe for people "
            "who prefer clarity to costume."
        ),
        "history": [
            "From children’s shoes to a modern house of ready-to-wear and accessories, the through-line is editing.",
            "Creative eras shifted the silhouette, but the preference for clean geometry remained.",
            "Jewellery and small leather goods carry the same economy of line.",
        ],
        "craft": (
            "Expect restrained metalwork, calm surfaces, and pieces that sit easily with an already considered wardrobe."
        ),
    },
    "balenciaga": {
        "name": "Balenciaga",
        "founded": "1919",
        "origin": "Spain / Paris",
        "lede": (
            "Cristóbal Balenciaga sculpted cloth like architecture. Volume, air, and absolute cut made him "
            "the couturier other couturiers studied."
        ),
        "history": [
            "Spanish roots met Paris ateliers in silhouettes that ignored trends in favour of form.",
            "Later decades rediscovered the house through street codes and exaggerated volume.",
            "The tension between atelier purity and cultural noise is now part of the brand’s modern story.",
        ],
        "craft": (
            "Whether classic or contemporary in mood, Balenciaga energy shows in bold shape and decisive construction."
        ),
    },
    "fendi": {
        "name": "Fendi",
        "founded": "1925",
        "origin": "Rome",
        "lede": (
            "Fendi is Roman craftsmanship with a playful intelligence — fur ateliers, artisan leather, "
            "and the baguette that turned a silhouette into a cultural moment."
        ),
        "history": [
            "The Fendi sisters and later Karl Lagerfeld sharpened the house’s wit without dropping atelier standards.",
            "FF motifs and selleria stitching keep handwork visible.",
            "Rome’s warmth still sits under the glamour.",
        ],
        "craft": (
            "Look for tactile surfaces, precise hardware, and accessories that feel made rather than merely assembled."
        ),
    },
    "versace": {
        "name": "Versace",
        "founded": "1978",
        "origin": "Milan",
        "lede": (
            "Versace made Mediterranean boldness couture: gold, Greek keys, and a confidence that treated fashion as celebration."
        ),
        "history": [
            "Gianni Versace fused classical motif with pop culture velocity.",
            "The Medusa and baroque prints became unmistakable signatures.",
            "The house continues to balance theatrical glamour with sharp tailoring.",
        ],
        "craft": (
            "Energy is the craft here — metalwork, print, and silhouette that refuse to whisper."
        ),
    },
    "alexander mcqueen": {
        "name": "Alexander McQueen",
        "founded": "1992",
        "origin": "London",
        "lede": (
            "Lee Alexander McQueen brought theatre, craft and a dark romanticism to British fashion — "
            "tailoring as narrative, not only clothing."
        ),
        "history": [
            "Savile Row discipline met runway storytelling.",
            "Skull motifs, sharp shoulders and dramatic proportion entered the wider culture.",
            "The house still orbits craftsmanship with an emotional edge.",
        ],
        "craft": (
            "Expect sculptural sneakers and accessories that keep a couture attitude even in everyday forms."
        ),
    },
    "mcqueen": {
        "name": "Alexander McQueen",
        "founded": "1992",
        "origin": "London",
        "lede": (
            "Lee Alexander McQueen brought theatre, craft and a dark romanticism to British fashion — "
            "tailoring as narrative, not only clothing."
        ),
        "history": [
            "Savile Row discipline met runway storytelling.",
            "Skull motifs, sharp shoulders and dramatic proportion entered the wider culture.",
            "The house still orbits craftsmanship with an emotional edge.",
        ],
        "craft": (
            "Expect sculptural sneakers and accessories that keep a couture attitude even in everyday forms."
        ),
    },
    "audemars piguet": {
        "name": "Audemars Piguet",
        "founded": "1875",
        "origin": "Le Brassus",
        "lede": (
            "Audemars Piguet comes from the Vallée de Joux, where watchmaking is a village craft elevated to complication art."
        ),
        "history": [
            "Royal Oak (1972) put steel luxury on the wrist and changed status codes forever.",
            "Haut craftsmanship stayed rooted in a small Swiss valley even as the brand went global.",
            "Octagonal bezel and integrated bracelet became a design dialect.",
        ],
        "craft": (
            "Geometry and finishing matter: sharp facets, balanced weight, and a sport-elegant attitude."
        ),
    },
    "richard mille": {
        "name": "Richard Mille",
        "founded": "2001",
        "origin": "Switzerland",
        "lede": (
            "Richard Mille treats the watch like a racing chassis — skeletal, technical, and engineered for shock."
        ),
        "history": [
            "A young maison that borrowed language from motorsport and aviation.",
            "Visible mechanics became the aesthetic, not something to hide under a solid dial.",
            "Athletes and collectors chased the technical theatre of the movement.",
        ],
        "craft": (
            "The story is structure: openworked forms, bold numerals, and a sense of engineered lightness."
        ),
    },
    "hermès": {
        "name": "Hermès",
        "founded": "1837",
        "origin": "Paris",
        "lede": (
            "Hermès began as a harness workshop. The patience of saddle-stitch leatherwork still defines a house "
            "that treats time as an ingredient, not an obstacle."
        ),
        "history": [
            "From equestrian equipment to scarves, watches and bags, craft remained the constant.",
            "Orange boxes and quiet hardware signal a luxury that refuses to hurry.",
            "Handwork stays deliberately slow even when demand accelerates.",
        ],
        "craft": (
            "The cue is finish: edges, stitching rhythm, and materials chosen to age rather than shine once."
        ),
    },
}

# Alias tokens → lore key
_BRAND_ALIASES = {
    "louis-vuitton": "louis vuitton",
    "louisvuitton": "louis vuitton",
    "l-v": "lv",
    "chanel": "chanel",
    "rolex": "rolex",
    "dior": "dior",
    "christian dior": "dior",
    "gucci": "gucci",
    "cartier": "cartier",
    "burberry": "burberry",
    "omega": "omega",
    "prada": "prada",
    "celine": "celine",
    "céline": "celine",
    "balenciaga": "balenciaga",
    "fendi": "fendi",
    "versace": "versace",
    "alexander-mcqueen": "alexander mcqueen",
    "alexandermcqueen": "alexander mcqueen",
    "audemars-piguet": "audemars piguet",
    "audemarspiguet": "audemars piguet",
    "ap": "audemars piguet",
    "richard-mille": "richard mille",
    "richardmille": "richard mille",
    "hermes": "hermes",
    "hermès": "hermes",
    "bvlgari": "bvlgari",
    "bulgari": "bvlgari",
}

_BRAND_LORE["bvlgari"] = {
    "name": "Bvlgari",
    "founded": "1884",
    "origin": "Rome",
    "lede": (
        "Bvlgari brought Roman colour and volume to high jewellery — bold stones, yellow gold, "
        "and a Mediterranean sensuality distinct from Parisian minimalism."
    ),
    "history": [
        "Greek roots in Rome produced a jewellery language of serpent forms and cabochon colour.",
        "Watches and leather goods extended the same sculptural confidence.",
        "The house remains associated with statement rather than whisper.",
    ],
    "craft": (
        "Expect generous form, warm metal tones, and jewellery that occupies space with intention."
    ),
}

_GENERIC_LORE_TEMPLATES = [
    {
        "lede": (
            "{name} sits in our collection as a house with a clear point of view — "
            "pieces that favour finish, proportion and a recognisable attitude over noise."
        ),
        "history": [
            "Like many enduring labels, its reputation grew from consistency: repeating a silhouette until it became familiar.",
            "Craft details — stitching, hardware, dial or clasp — are where the character usually hides.",
            "Collectors return not only for a name, but for a feeling they can recognise across seasons.",
        ],
        "craft": (
            "In the examples below, we look for that through-line: materials that feel considered, and forms that still read clearly up close."
        ),
    },
]


def _esc(text: str) -> str:
    return html.escape(str(text or ""), quote=True)


def _clean(text: str, limit: int = 220) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    text = re.sub(
        r"(?i)\b(factory direct price|wholesale|oem|dropship|replica|mirror quality)\b[^.]*\.?",
        "",
        text,
    )
    text = re.sub(r"\s+", " ", text).strip(" ,.-")
    if len(text) > limit:
        text = text[:limit].rsplit(" ", 1)[0] + "…"
    return text


def _product_href(product: dict) -> str:
    ident = product.get("slug") or product.get("id") or ""
    return f"/product/{ident}" if ident else "/shop"


def _is_usable_image_url(url: str) -> bool:
    if not url or not isinstance(url, str):
        return False
    u = url.strip()
    if not u or "does-not-exist" in u.lower():
        return False
    if u.startswith(("http://", "https://", "//")):
        return True
    return False


async def _local_upload_exists(path: str) -> bool:
    if not path.startswith("/uploads/"):
        return False
    name = os.path.basename(path)
    if (UPLOADS_DIR / name).is_file():
        return True
    doc = await db.media_files.find_one({"filename": name}, {"_id": 1})
    return bool(doc)


async def _cover_is_healthy(url: str) -> bool:
    if _is_usable_image_url(url):
        return True
    if url and url.startswith("/uploads/"):
        return await _local_upload_exists(url)
    return False


def _pick_cover_from_products(products: List[dict]) -> str:
    for p in products:
        for img in p.get("images") or []:
            if _is_usable_image_url(img):
                return img.strip()
    return ""


def _normalize_brand_token(raw: str) -> str:
    s = (raw or "").lower().strip()
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9\s-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _brand_from_category_slug(slug: str) -> Optional[str]:
    """Infer a brand key from category slugs like shoes-gucci, necklace-chanel-necklace."""
    if not slug:
        return None
    s = slug.lower()
    # Try longest alias keys first
    for alias in sorted(_BRAND_ALIASES.keys(), key=len, reverse=True):
        token = alias.replace("-", " ")
        compact = alias.replace("-", "")
        if alias in s or token in s.replace("-", " ") or compact in s.replace("-", ""):
            return _BRAND_ALIASES[alias]
    parts = s.split("-")
    # e.g. shoes-gucci → gucci; bracelet-celine-bracelet → celine
    for part in parts:
        if part in _BRAND_LORE or part in _BRAND_ALIASES:
            return _BRAND_ALIASES.get(part, part)
    return None


def _brand_from_product(product: dict) -> Optional[str]:
    for field in (product.get("brand"), product.get("name"), product.get("category")):
        if not field:
            continue
        norm = _normalize_brand_token(str(field))
        for alias in sorted(_BRAND_ALIASES.keys(), key=len, reverse=True):
            if alias.replace("-", " ") in norm or alias.replace("-", "") in norm.replace(" ", ""):
                return _BRAND_ALIASES[alias]
        for key in _BRAND_LORE:
            if key in norm:
                return key
    return _brand_from_category_slug(product.get("category") or "")


def _display_brand_name(brand_key: str, lore: dict) -> str:
    return lore.get("name") or brand_key.title()


def _lore_for_brand(brand_key: str) -> dict:
    if brand_key in _BRAND_LORE:
        return _BRAND_LORE[brand_key]
    # Generic
    name = brand_key.title()
    tmpl = _GENERIC_LORE_TEMPLATES[0]
    return {
        "name": name,
        "founded": "",
        "origin": "",
        "lede": tmpl["lede"].format(name=name),
        "history": list(tmpl["history"]),
        "craft": tmpl["craft"],
    }


def _unique_slug(base: str) -> str:
    now = datetime.now(timezone.utc)
    return f"{slugify(base)}-{now.strftime('%Y-%m-%d')}-{uuid.uuid4().hex[:6]}"


def build_brand_article(
    brand_key: str,
    products: List[dict],
    categories: List[dict],
) -> dict:
    """Long-form brand history + a few illustrative pieces from the catalog."""
    now = datetime.now(timezone.utc)
    rng = random.Random(f"{brand_key}-{now.strftime('%Y%m%d%H')}-{uuid.uuid4().hex[:4]}")
    lore = _lore_for_brand(brand_key)
    name = _display_brand_name(brand_key, lore)
    date_label = now.strftime("%B %d, %Y")

    title_options = [
        f"The Story of {name}",
        f"{name}: Heritage & Craft",
        f"Inside {name}",
        f"A Brief History of {name}",
        f"{name} — Origins & Attitude",
    ]
    title = rng.choice(title_options)

    cat_names = {c.get("slug"): c.get("name") for c in categories}

    def catname(slug):
        return cat_names.get(slug) or (slug or "Collection").replace("-", " ").title()

    picks = products[:4]
    cover_image = _pick_cover_from_products(picks)

    parts = []
    founded = lore.get("founded") or ""
    origin = lore.get("origin") or ""
    meta_bits = [x for x in [f"Founded {founded}" if founded else "", origin] if x]
    if meta_bits:
        parts.append(
            f'<p class="blog-meta">{" · ".join(_esc(b) for b in meta_bits)}</p>'
        )
    parts.append(f'<p class="blog-lede">{_esc(lore["lede"])}</p>')

    parts.append("<h2>Where it began</h2>")
    for para in lore.get("history") or []:
        parts.append(f"<p>{_esc(para)}</p>")

    parts.append("<h2>What the craft still says</h2>")
    parts.append(f"<p>{_esc(lore.get('craft') or '')}</p>")

    if picks:
        parts.append("<h2>In our collection</h2>")
        parts.append(
            f"<p>A few current { _esc(name) } pieces on Kayee01 — chosen to show how the house’s attitude "
            f"still reads in materials and silhouette, not as a price list.</p>"
        )
        for i, p in enumerate(picks):
            pname = p.get("name") or name
            cat = catname(p.get("category", ""))
            desc = _clean(p.get("description", ""), 160)
            href = _product_href(p)
            img = ""
            for candidate in p.get("images") or []:
                if _is_usable_image_url(candidate):
                    img = candidate.strip()
                    break
            parts.append('<section class="blog-piece">')
            if img:
                parts.append(
                    f'<figure class="blog-figure">'
                    f'<a href="{_esc(href)}">'
                    f'<img src="{_esc(img)}" alt="{_esc(pname)}" loading="lazy" />'
                    f"</a>"
                    f"<figcaption>{_esc(cat)}</figcaption>"
                    f"</figure>"
                )
            parts.append(f"<h3>{_esc(pname)}</h3>")
            body = f"A contemporary reading of { _esc(name) }’s line."
            if desc and desc.lower() not in pname.lower():
                body += f" {_esc(desc)}"
            parts.append(f"<p>{body}</p>")
            parts.append(
                f'<p class="blog-inline-link"><a href="{_esc(href)}">View details</a></p>'
            )
            parts.append("</section>")
            if i < len(picks) - 1:
                parts.append('<hr class="blog-rule" />')

    parts.append(
        f'<p class="blog-closer">The house continues; so does the conversation. '
        f"Explore more { _esc(name) } in the shop when you want to see the craft up close.</p>"
    )
    content_html = "\n".join(parts)
    excerpt = _clean(re.sub(r"<[^>]+>", "", lore["lede"]), 170)
    slug = _unique_slug(f"story-of-{name}")

    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "slug": slug,
        "excerpt": excerpt,
        "content": content_html,
        "cover_image": cover_image,
        "product_ids": [p.get("id") for p in picks if p.get("id")],
        "brand_key": brand_key,
        "brand_name": name,
        "author": "Kayee01 Editorial",
        "tags": ["editorial", "brand-story", "heritage", name.lower()],
        "published": True,
        "date_label": date_label,
        "created_at": now.isoformat(),
        "format_version": 3,
        "article_type": "brand_story",
    }


async def _discover_brands() -> List[Tuple[str, int]]:
    """Return [(brand_key, product_count), ...] sorted by count desc."""
    cats = await db.categories.find({}, {"_id": 0, "slug": 1, "name": 1, "product_count": 1}).to_list(500)
    counter: Dict[str, int] = collections.Counter()

    for c in cats:
        key = _brand_from_category_slug(c.get("slug") or "")
        if not key:
            key = _brand_from_product({"name": c.get("name"), "category": c.get("slug")})
        if not key:
            continue
        counter[key] += int(c.get("product_count") or 0)

    # Also scan a sample of products for brand fields / names
    sample = await db.products.find(
        {}, {"_id": 0, "brand": 1, "name": 1, "category": 1}
    ).limit(800).to_list(800)
    for p in sample:
        key = _brand_from_product(p)
        if key:
            counter[key] += 1

    ranked = [(k, n) for k, n in counter.most_common() if n >= 3]
    return ranked


async def _products_for_brand(brand_key: str, limit: int = 8) -> List[dict]:
    lore_name = _lore_for_brand(brand_key).get("name") or brand_key
    tokens = {brand_key, lore_name.lower(), brand_key.replace(" ", "-")}
    # Match category slug contains brand token
    regexes = []
    for t in tokens:
        t = re.escape(t.replace(" ", "[- ]"))
        regexes.append(t)
    pattern = "|".join(regexes)
    query = {
        "$or": [
            {"category": {"$regex": pattern, "$options": "i"}},
            {"name": {"$regex": pattern, "$options": "i"}},
            {"brand": {"$regex": pattern, "$options": "i"}},
            {"tags": {"$regex": pattern, "$options": "i"}},
        ]
    }
    products = await db.products.find(query, {"_id": 0}).limit(40).to_list(40)
    with_imgs = [
        p for p in products
        if any(_is_usable_image_url(i) for i in (p.get("images") or []))
    ]
    pool = with_imgs or products
    random.shuffle(pool)
    return pool[:limit]


async def _brands_already_covered() -> set:
    posts = await db.blog_posts.find(
        {"article_type": "brand_story"},
        {"_id": 0, "brand_key": 1, "tags": 1, "title": 1},
    ).to_list(500)
    covered = set()
    for p in posts:
        if p.get("brand_key"):
            covered.add(p["brand_key"])
            continue
        # Infer from tags / title for older posts
        for tag in p.get("tags") or []:
            norm = _normalize_brand_token(str(tag))
            if norm in _BRAND_LORE or norm in _BRAND_ALIASES.values():
                covered.add(_BRAND_ALIASES.get(norm, norm))
    return covered


async def generate_brand_post(brand_key: Optional[str] = None) -> Optional[dict]:
    """Create one brand-history article for the next uncovered brand (or a given key)."""
    ranked = await _discover_brands()
    if not ranked and not brand_key:
        return None

    covered = await _brands_already_covered()
    chosen = brand_key
    if not chosen:
        for key, _count in ranked:
            if key not in covered:
                chosen = key
                break
        if not chosen:
            # All known brands have a story — rotate starting from a random house
            chosen = random.choice([k for k, _ in ranked]) if ranked else None
    if not chosen:
        return None

    products = await _products_for_brand(chosen)
    if len(products) < 1:
        # Still write the history even with few products
        products = await db.products.find({}, {"_id": 0}).limit(4).to_list(4)

    categories = await db.categories.find({}, {"_id": 0}).to_list(300)
    post = build_brand_article(chosen, products, categories)
    await db.blog_posts.insert_one(dict(post))
    return post


async def generate_brand_posts_batch(max_posts: int = 8) -> List[dict]:
    """Seed multiple unique brand stories (skips brands that already have one)."""
    max_posts = max(1, min(int(max_posts or 8), 20))
    created = []
    covered = await _brands_already_covered()
    ranked = await _discover_brands()
    for key, _count in ranked:
        if len(created) >= max_posts:
            break
        if key in covered:
            continue
        post = await generate_brand_post(key)
        if not post:
            continue
        created.append(post)
        covered.add(key)
    return created


# Keep a thin weekly “edit” only as fallback when no brands found
_CLOSERS = [
    "The houses continue; so does the collection. Take your time.",
]


async def _select_products() -> List[dict]:
    query = {"$or": [{"featured": True}, {"is_new": True}, {"best_seller": True}]}
    products = await db.products.find(query, {"_id": 0}).limit(40).to_list(40)
    if len(products) < 4:
        products = await db.products.find({}, {"_id": 0}).sort("created_at", -1).limit(24).to_list(24)
    with_imgs = [
        p for p in products
        if any(_is_usable_image_url(i) for i in (p.get("images") or []))
    ]
    pool = with_imgs or products
    random.shuffle(pool)
    return pool


async def generate_post() -> Optional[dict]:
    """Default generator: always prefer a brand story."""
    return await generate_brand_post()


async def _repair_post_cover(post: dict) -> dict:
    cover = post.get("cover_image") or ""
    if await _cover_is_healthy(cover) and _is_usable_image_url(cover):
        return post

    ids = [i for i in (post.get("product_ids") or []) if i]
    products = []
    if ids:
        products = await db.products.find(
            {"id": {"$in": ids}}, {"_id": 0, "images": 1}
        ).to_list(20)
    new_cover = _pick_cover_from_products(products)
    if not new_cover:
        fallback = await db.products.find(
            {"featured": True}, {"_id": 0, "images": 1}
        ).limit(12).to_list(12)
        if not fallback:
            fallback = await db.products.find({}, {"_id": 0, "images": 1}).limit(12).to_list(12)
        new_cover = _pick_cover_from_products(fallback)

    if new_cover and new_cover != cover:
        post["cover_image"] = new_cover
        key = {"id": post["id"]} if post.get("id") else {"slug": post.get("slug")}
        await db.blog_posts.update_one(key, {"$set": {"cover_image": new_cover}})
    return post


async def _rewrite_legacy_post(post: dict) -> dict:
    """Upgrade old promo / weekly-edit posts by regenerating as brand stories when possible."""
    if post.get("format_version", 1) >= 3 and post.get("article_type") == "brand_story":
        return post

    content = post.get("content") or ""
    looks_legacy = (
        post.get("format_version", 1) < 3
        or "This week's highlights" in content
        or "· best seller" in content
        or "Shop the Collection" in content
        or post.get("article_type") != "brand_story"
    )
    if not looks_legacy:
        return post

    # Try to infer brand from title/tags/products
    brand_key = post.get("brand_key")
    if not brand_key:
        for tag in post.get("tags") or []:
            norm = _normalize_brand_token(str(tag))
            if norm in _BRAND_LORE:
                brand_key = norm
                break
            if norm in _BRAND_ALIASES:
                brand_key = _BRAND_ALIASES[norm]
                break
    if not brand_key:
        ids = [i for i in (post.get("product_ids") or []) if i]
        if ids:
            prods = await db.products.find({"id": {"$in": ids}}, {"_id": 0}).to_list(10)
            for p in prods:
                brand_key = _brand_from_product(p)
                if brand_key:
                    break
    if not brand_key:
        ranked = await _discover_brands()
        brand_key = ranked[0][0] if ranked else None
    if not brand_key:
        return post

    products = await _products_for_brand(brand_key)
    categories = await db.categories.find({}, {"_id": 0}).to_list(300)
    rebuilt = build_brand_article(brand_key, products, categories)
    # Keep original slug/title dates for SEO stability when repairing in place —
    # but upgrade content. If slug collided historically, leave slug as-is.
    updates = {
        "content": rebuilt["content"],
        "excerpt": rebuilt["excerpt"],
        "cover_image": rebuilt["cover_image"] or post.get("cover_image") or "",
        "product_ids": rebuilt["product_ids"],
        "brand_key": brand_key,
        "brand_name": rebuilt["brand_name"],
        "tags": rebuilt["tags"],
        "format_version": 3,
        "article_type": "brand_story",
        "title": rebuilt["title"] if post.get("format_version", 1) < 3 else post.get("title"),
    }
    # Prefer story titles for legacy weekly edits
    if post.get("format_version", 1) < 3:
        updates["title"] = rebuilt["title"]
    post.update(updates)
    key = {"id": post["id"]} if post.get("id") else {"slug": post.get("slug")}
    await db.blog_posts.update_one(key, {"$set": updates})
    return post


async def _prepare_post(post: dict, *, full: bool = False) -> dict:
    post = await _repair_post_cover(post)
    if full:
        post = await _rewrite_legacy_post(post)
    return post


def _dedupe_posts(posts: List[dict]) -> List[dict]:
    """Keep newest post per slug (duplicate generates used to collide on the same day)."""
    seen = set()
    out = []
    for p in posts:
        slug = p.get("slug") or p.get("id")
        if not slug or slug in seen:
            continue
        seen.add(slug)
        out.append(p)
    return out


async def _maybe_generate_weekly():
    """Create a new brand story if the latest is older than the interval."""
    try:
        latest = await db.blog_posts.find({}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
        needs = True
        if latest:
            try:
                last_dt = datetime.fromisoformat(latest[0]["created_at"])
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=timezone.utc)
                needs = (datetime.now(timezone.utc) - last_dt) >= timedelta(days=GENERATION_INTERVAL_DAYS)
            except Exception:
                needs = False
        if needs:
            await generate_brand_post()
    except Exception:
        pass


@blog_router.get("")
@blog_router.get("/")
async def list_posts(limit: int = 20):
    await _maybe_generate_weekly()
    limit = max(1, min(limit, 50))
    # Fetch extra then dedupe slug collisions
    posts = await db.blog_posts.find({"published": True}, {"_id": 0, "content": 0}) \
        .sort("created_at", -1).limit(limit * 3).to_list(limit * 3)
    posts = _dedupe_posts(posts)[:limit]
    repaired = []
    for post in posts:
        repaired.append(await _prepare_post(post, full=False))
    return repaired


@blog_router.get("/{slug}")
async def get_post(slug: str):
    # Prefer newest if duplicate slugs exist
    posts = await db.blog_posts.find({"slug": slug}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
    post = posts[0] if posts else None
    if not post:
        post = await db.blog_posts.find_one({"id": slug}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return await _prepare_post(post, full=True)


@blog_router.post("/generate")
async def admin_generate(
    brand: Optional[str] = Query(None, description="Optional brand key, e.g. chanel"),
    admin: User = Depends(get_current_admin),
):
    """Generate one brand-history article (next uncovered brand, or a specific brand)."""
    key = _normalize_brand_token(brand) if brand else None
    if key:
        key = _BRAND_ALIASES.get(key, key)
        if key not in _BRAND_LORE and key not in {k for k, _ in await _discover_brands()}:
            # Still allow generic lore for discovered tokens
            pass
    post = await generate_brand_post(key)
    if not post:
        raise HTTPException(status_code=400, detail="No brands/products available to write about")
    return {
        "message": "Brand story generated",
        "slug": post["slug"],
        "title": post["title"],
        "brand": post.get("brand_name"),
    }


@blog_router.post("/generate-brands")
async def admin_generate_brands(
    max_posts: int = Query(8, ge=1, le=20),
    admin: User = Depends(get_current_admin),
):
    """Seed multiple unique brand-history articles in one click."""
    created = await generate_brand_posts_batch(max_posts=max_posts)
    return {
        "message": f"Generated {len(created)} brand stories",
        "count": len(created),
        "articles": [
            {"title": p["title"], "slug": p["slug"], "brand": p.get("brand_name")}
            for p in created
        ],
    }


@blog_router.post("/repair")
async def admin_repair(admin: User = Depends(get_current_admin)):
    """Rewrite legacy ad-style posts into brand stories and fix broken covers."""
    posts = await db.blog_posts.find({}, {"_id": 0}).to_list(200)
    fixed = 0
    for post in posts:
        before = (post.get("cover_image"), post.get("format_version"), post.get("content"), post.get("title"))
        after = await _prepare_post(dict(post), full=True)
        if (
            after.get("cover_image") != before[0]
            or after.get("format_version") != before[1]
            or after.get("content") != before[2]
            or after.get("title") != before[3]
        ):
            fixed += 1
    # Remove exact duplicate slugs (keep newest)
    all_posts = await db.blog_posts.find({}, {"_id": 0, "id": 1, "slug": 1, "created_at": 1}) \
        .sort("created_at", -1).to_list(500)
    seen = set()
    removed = 0
    for p in all_posts:
        slug = p.get("slug")
        if not slug:
            continue
        if slug in seen:
            await db.blog_posts.delete_one({"id": p["id"]})
            removed += 1
        else:
            seen.add(slug)
    return {
        "message": "Blog posts repaired",
        "updated": fixed,
        "duplicates_removed": removed,
        "scanned": len(posts),
    }


@blog_router.delete("/{post_id}")
async def admin_delete(post_id: str, admin: User = Depends(get_current_admin)):
    result = await db.blog_posts.delete_one({"id": post_id})
    if result.deleted_count == 0:
        result = await db.blog_posts.delete_one({"slug": post_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Deleted"}
