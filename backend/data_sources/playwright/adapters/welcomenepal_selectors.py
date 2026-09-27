"""Isolated selectors and DOM contract for the Welcome Nepal public directory.

All CSS / XPath / semantic selectors are isolated in this module so that layout
changes on the public source can be updated in a single place without touching
adapter logic, normalization, or database models.
"""

from __future__ import annotations

# Container elements
CONTAINER_HOTEL_LISTINGS = ".hotel-listings"
HOTEL_CARD = "article.hotel-card"

# Hotel Identity and Metadata selectors
HOTEL_NAME = ".hotel-name"
HOTEL_DISTRICT = ".hotel-district"
HOTEL_PROVINCE = ".hotel-province"
HOTEL_ADDRESS = ".hotel-address"
HOTEL_STARS = ".hotel-stars"
HOTEL_TYPE = ".hotel-type"
HOTEL_ROOMS = ".hotel-rooms"
HOTEL_WEBSITE = "a.hotel-website"
HOTEL_PHONE = ".hotel-phone"
HOTEL_DETAIL_LINK = "a.hotel-detail-link"

# Search form selectors
SEARCH_FORM = "form.search-form"
SEARCH_INPUT = "input.search-input"
SEARCH_SUBMIT = "button.search-submit"

# Pricing & Room Selectors
RATE_OPTION = ".rate-option"
ROOM_TYPE = ".room-type"
RATE_PRICE = ".rate-price"
RATE_TAX = ".rate-tax"
RATE_FEE = ".rate-fee"
RATE_AVAILABILITY = ".rate-availability"
NO_RATE_NOTICE = ".no-rate-notice"

# Antibot / Access Control indicators (must detect, NEVER bypass)
CAPTCHA_CHALLENGE = ".g-recaptcha, .cf-turnstile, #captcha, iframe[src*='captcha']"
ACCESS_DENIED = "h1:has-text('Access Denied'), h1:has-text('403 Forbidden')"