from __future__ import annotations

from workers.stock_scanner.models import Ticker


NASDAQ_TECH_UNIVERSE: list[Ticker] = [
    Ticker("ADBE", "ADBE", "Adobe", "Technology", "Software", "software", "NASDAQ"),
    Ticker("AMD", "AMD", "Advanced Micro Devices", "Technology", "Semiconductors", "semiconductor", "NASDAQ"),
    Ticker("GOOGL", "GOOGL", "Alphabet Class A", "Technology", "Internet", "mega_cap_platform", "NASDAQ"),
    Ticker("GOOG", "GOOG", "Alphabet Class C", "Technology", "Internet", "mega_cap_platform", "NASDAQ"),
    Ticker("ADI", "ADI", "Analog Devices", "Technology", "Semiconductors", "semiconductor", "NASDAQ"),
    Ticker("AAPL", "AAPL", "Apple", "Technology", "Consumer Electronics", "mega_cap_platform", "NASDAQ"),
    Ticker("AMAT", "AMAT", "Applied Materials", "Technology", "Semiconductor Equipment", "semiconductor", "NASDAQ"),
    Ticker("APP", "APP", "AppLovin", "Technology", "Software", "software", "NASDAQ"),
    Ticker("ARM", "ARM", "Arm Holdings", "Technology", "Semiconductors", "semiconductor", "NASDAQ"),
    Ticker("ASML", "ASML", "ASML Holding", "Technology", "Semiconductor Equipment", "semiconductor", "NASDAQ"),
    Ticker("AVGO", "AVGO", "Broadcom", "Technology", "Semiconductors", "ai_infrastructure", "NASDAQ"),
    Ticker("CDNS", "CDNS", "Cadence Design Systems", "Technology", "Design Software", "software", "NASDAQ"),
    Ticker("CSCO", "CSCO", "Cisco Systems", "Technology", "Networking", "enterprise_software", "NASDAQ"),
    Ticker("CTSH", "CTSH", "Cognizant", "Technology", "IT Services", "enterprise_software", "NASDAQ"),
    Ticker("DDOG", "DDOG", "Datadog", "Technology", "Observability", "cloud_data", "NASDAQ"),
    Ticker("FTNT", "FTNT", "Fortinet", "Technology", "Cybersecurity", "cybersecurity", "NASDAQ"),
    Ticker("INTC", "INTC", "Intel", "Technology", "Semiconductors", "semiconductor", "NASDAQ"),
    Ticker("INTU", "INTU", "Intuit", "Technology", "Software", "enterprise_software", "NASDAQ"),
    Ticker("KLAC", "KLAC", "KLA", "Technology", "Semiconductor Equipment", "semiconductor", "NASDAQ"),
    Ticker("LRCX", "LRCX", "Lam Research", "Technology", "Semiconductor Equipment", "semiconductor", "NASDAQ"),
    Ticker("MAR", "MAR", "Marriott International", "Consumer", "Travel Platform", "consumer_internet", "NASDAQ"),
    Ticker("MCHP", "MCHP", "Microchip Technology", "Technology", "Semiconductors", "semiconductor", "NASDAQ"),
    Ticker("MDB", "MDB", "MongoDB", "Technology", "Database", "cloud_data", "NASDAQ"),
    Ticker("META", "META", "Meta Platforms", "Technology", "Internet", "consumer_internet", "NASDAQ"),
    Ticker("MRVL", "MRVL", "Marvell Technology", "Technology", "Semiconductors", "ai_infrastructure", "NASDAQ"),
    Ticker("MSFT", "MSFT", "Microsoft", "Technology", "Software / Cloud", "mega_cap_platform", "NASDAQ"),
    Ticker("MU", "MU", "Micron Technology", "Technology", "Memory", "semiconductor", "NASDAQ"),
    Ticker("NFLX", "NFLX", "Netflix", "Communication Services", "Streaming", "consumer_internet", "NASDAQ"),
    Ticker("NVDA", "NVDA", "Nvidia", "Technology", "Semiconductors", "ai_infrastructure", "NASDAQ"),
    Ticker("NXPI", "NXPI", "NXP Semiconductors", "Technology", "Semiconductors", "semiconductor", "NASDAQ"),
    Ticker("ON", "ON", "ON Semiconductor", "Technology", "Semiconductors", "semiconductor", "NASDAQ"),
    Ticker("ORCL", "ORCL", "Oracle", "Technology", "Cloud Software", "enterprise_software", "NYSE"),
    Ticker("PANW", "PANW", "Palo Alto Networks", "Technology", "Cybersecurity", "cybersecurity", "NASDAQ"),
    Ticker("PYPL", "PYPL", "PayPal", "Technology", "Payments", "software", "NASDAQ"),
    Ticker("QCOM", "QCOM", "Qualcomm", "Technology", "Semiconductors", "semiconductor", "NASDAQ"),
    Ticker("ROP", "ROP", "Roper Technologies", "Technology", "Vertical Software", "enterprise_software", "NASDAQ"),
    Ticker("SNPS", "SNPS", "Synopsys", "Technology", "Design Software", "software", "NASDAQ"),
    Ticker("TEAM", "TEAM", "Atlassian", "Technology", "Collaboration Software", "enterprise_software", "NASDAQ"),
    Ticker("TSLA", "TSLA", "Tesla", "Consumer", "EV / AI", "consumer_internet", "NASDAQ"),
    Ticker("TXN", "TXN", "Texas Instruments", "Technology", "Semiconductors", "semiconductor", "NASDAQ"),
    Ticker("WDAY", "WDAY", "Workday", "Technology", "Enterprise Software", "enterprise_software", "NASDAQ"),
    Ticker("WDC", "WDC", "Western Digital", "Technology", "Storage", "semiconductor", "NASDAQ"),
    Ticker("ZS", "ZS", "Zscaler", "Technology", "Cybersecurity", "cybersecurity", "NASDAQ"),
    Ticker("CRWD", "CRWD", "CrowdStrike", "Technology", "Cybersecurity", "cybersecurity", "NASDAQ"),
    Ticker("SNOW", "SNOW", "Snowflake", "Technology", "Data Cloud", "cloud_data", "NYSE"),
    Ticker("NOW", "NOW", "ServiceNow", "Technology", "Workflow Software", "enterprise_software", "NYSE"),
    Ticker("CRM", "CRM", "Salesforce", "Technology", "CRM Software", "enterprise_software", "NYSE"),
    Ticker("SHOP", "SHOP", "Shopify", "Technology", "Commerce Platform", "software", "NYSE"),
    Ticker("UBER", "UBER", "Uber", "Technology", "Mobility Platform", "consumer_internet", "NYSE"),
    # --- Small-cap emergence names (the flagship high-upside shortlist) ---------------------------
    # These are the small/micro caps the World-Radar / lifecycle engine surfaces as early + backed.
    # They were previously NEVER scanned - the live universe was 100% large-cap, so every high-upside
    # name fell back to a neutral momentum of 50 and the "market is turning" leg was structurally dead.
    # Scanning them here wires real momentum into the emergence shortlist. Thin names may have sparse
    # data; the scanner tolerates missing bars per-symbol without failing the run.
    Ticker("POWL", "POWL", "Powell Industries", "Industrials", "Electrical Equipment", "small_cap_emergence", "NASDAQ"),
    Ticker("APLD", "APLD", "Applied Digital", "Technology", "Data Center Infrastructure", "small_cap_emergence", "NASDAQ"),
    Ticker("LUNR", "LUNR", "Intuitive Machines", "Industrials", "Aerospace", "small_cap_emergence", "NASDAQ"),
    Ticker("RDW", "RDW", "Redwire", "Industrials", "Aerospace", "small_cap_emergence", "NYSE"),
    Ticker("BKSY", "BKSY", "BlackSky Technology", "Industrials", "Geospatial Intelligence", "small_cap_emergence", "NYSE"),
    Ticker("FLNC", "FLNC", "Fluence Energy", "Industrials", "Energy Storage", "small_cap_emergence", "NASDAQ"),
    Ticker("LEU", "LEU", "Centrus Energy", "Energy", "Nuclear Fuel", "small_cap_emergence", "NYSE"),
    Ticker("UUUU", "UUUU", "Energy Fuels", "Energy", "Uranium", "small_cap_emergence", "NYSE"),
    Ticker("NB", "NB", "NioCorp Developments", "Materials", "Critical Minerals", "small_cap_emergence", "NASDAQ"),
    Ticker("CAMT", "CAMT", "Camtek", "Technology", "Semiconductor Equipment", "small_cap_emergence", "NASDAQ"),
    Ticker("ONDS", "ONDS", "Ondas Holdings", "Industrials", "Drones", "small_cap_emergence", "NASDAQ"),
    Ticker("HSAI", "HSAI", "Hesai Group", "Technology", "Lidar", "small_cap_emergence", "NASDAQ"),
    Ticker("SERV", "SERV", "Serve Robotics", "Technology", "Robotics", "small_cap_emergence", "NASDAQ"),
    Ticker("RGTI", "RGTI", "Rigetti Computing", "Technology", "Quantum Computing", "small_cap_emergence", "NASDAQ"),
]


def universe_by_symbol() -> dict[str, Ticker]:
    return {ticker.symbol: ticker for ticker in NASDAQ_TECH_UNIVERSE}
