-- 006_universe_expansion.sql
-- Expand the scan universe toward the vision's "first 100 US technology stocks".
-- Adds 54 major US-listed tech / AI names on top of the 49 seeded in 001 (=> ~103).
-- Idempotent: re-running is safe (existing symbols are left untouched).

insert into stock_tickers (symbol, provider_symbol, company_name, sector, industry, category, exchange, country, currency, scan_timeframe, is_active, scan_enabled)
values
-- Mega-cap platforms
('AMZN','AMZN','Amazon','Technology','Consumer Internet','mega_cap_platform','NASDAQ','US','USD','1h',true,true),
-- AI infrastructure / compute / networking / data-centre
('TSM','TSM','Taiwan Semiconductor','Technology','Semiconductors','ai_infrastructure','NYSE','US','USD','1h',true,true),
('PLTR','PLTR','Palantir Technologies','Technology','AI Software','ai_infrastructure','NASDAQ','US','USD','1h',true,true),
('SMCI','SMCI','Super Micro Computer','Technology','Hardware','ai_infrastructure','NASDAQ','US','USD','1h',true,true),
('DELL','DELL','Dell Technologies','Technology','Hardware','ai_infrastructure','NYSE','US','USD','1h',true,true),
('ANET','ANET','Arista Networks','Technology','Networking','ai_infrastructure','NYSE','US','USD','1h',true,true),
('CRWV','CRWV','CoreWeave','Technology','Cloud GPU','ai_infrastructure','NASDAQ','US','USD','1h',true,true),
('NBIS','NBIS','Nebius Group','Technology','Cloud GPU','ai_infrastructure','NASDAQ','US','USD','1h',true,true),
('VRT','VRT','Vertiv Holdings','Technology','Data Center Infrastructure','ai_infrastructure','NYSE','US','USD','1h',true,true),
-- Semiconductors / equipment
('QRVO','QRVO','Qorvo','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('SWKS','SWKS','Skyworks Solutions','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('GFS','GFS','GlobalFoundries','Technology','Semiconductors','semiconductor','NASDAQ','US','USD','1h',true,true),
('WOLF','WOLF','Wolfspeed','Technology','Semiconductors','semiconductor','NYSE','US','USD','1h',true,true),
('ENTG','ENTG','Entegris','Technology','Semiconductor Equipment','semiconductor','NASDAQ','US','USD','1h',true,true),
('TER','TER','Teradyne','Technology','Semiconductor Equipment','semiconductor','NASDAQ','US','USD','1h',true,true),
('COHR','COHR','Coherent','Technology','Photonics','semiconductor','NYSE','US','USD','1h',true,true),
-- Enterprise / design / application software
('IBM','IBM','IBM','Technology','IT Services','software','NYSE','US','USD','1h',true,true),
('ADSK','ADSK','Autodesk','Technology','Design Software','software','NASDAQ','US','USD','1h',true,true),
('ANSS','ANSS','Ansys','Technology','Simulation Software','software','NASDAQ','US','USD','1h',true,true),
('PTC','PTC','PTC','Technology','Industrial Software','software','NASDAQ','US','USD','1h',true,true),
('HUBS','HUBS','HubSpot','Technology','Software','software','NYSE','US','USD','1h',true,true),
('DOCU','DOCU','DocuSign','Technology','Software','software','NASDAQ','US','USD','1h',true,true),
('GTLB','GTLB','GitLab','Technology','DevOps Software','software','NASDAQ','US','USD','1h',true,true),
('PATH','PATH','UiPath','Technology','Automation Software','software','NYSE','US','USD','1h',true,true),
('AI','AI','C3.ai','Technology','AI Software','software','NYSE','US','USD','1h',true,true),
('TWLO','TWLO','Twilio','Technology','Communications Software','software','NYSE','US','USD','1h',true,true),
('ZM','ZM','Zoom Communications','Technology','Communications Software','software','NASDAQ','US','USD','1h',true,true),
('DBX','DBX','Dropbox','Technology','Cloud Software','software','NASDAQ','US','USD','1h',true,true),
-- Cloud / data infrastructure
('NET','NET','Cloudflare','Technology','Cloud Infrastructure','cloud_data','NYSE','US','USD','1h',true,true),
('ESTC','ESTC','Elastic','Technology','Search & Data','cloud_data','NYSE','US','USD','1h',true,true),
('PSTG','PSTG','Pure Storage','Technology','Data Storage','cloud_data','NYSE','US','USD','1h',true,true),
('NTAP','NTAP','NetApp','Technology','Data Storage','cloud_data','NASDAQ','US','USD','1h',true,true),
('DOCN','DOCN','DigitalOcean','Technology','Cloud Infrastructure','cloud_data','NYSE','US','USD','1h',true,true),
('CFLT','CFLT','Confluent','Technology','Data Streaming','cloud_data','NASDAQ','US','USD','1h',true,true),
-- Cybersecurity
('S','S','SentinelOne','Technology','Cybersecurity','cybersecurity','NYSE','US','USD','1h',true,true),
('OKTA','OKTA','Okta','Technology','Identity Security','cybersecurity','NASDAQ','US','USD','1h',true,true),
('CYBR','CYBR','CyberArk Software','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('QLYS','QLYS','Qualys','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('TENB','TENB','Tenable Holdings','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('RPD','RPD','Rapid7','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('VRNS','VRNS','Varonis Systems','Technology','Cybersecurity','cybersecurity','NASDAQ','US','USD','1h',true,true),
('AKAM','AKAM','Akamai Technologies','Technology','Security & CDN','cybersecurity','NASDAQ','US','USD','1h',true,true),
-- Consumer internet / platforms
('DASH','DASH','DoorDash','Technology','Consumer Internet','consumer_internet','NASDAQ','US','USD','1h',true,true),
('ABNB','ABNB','Airbnb','Technology','Consumer Internet','consumer_internet','NASDAQ','US','USD','1h',true,true),
('RBLX','RBLX','Roblox','Technology','Gaming','consumer_internet','NYSE','US','USD','1h',true,true),
('SPOT','SPOT','Spotify Technology','Technology','Streaming','consumer_internet','NYSE','US','USD','1h',true,true),
('PINS','PINS','Pinterest','Technology','Social','consumer_internet','NYSE','US','USD','1h',true,true),
('SNAP','SNAP','Snap','Technology','Social','consumer_internet','NYSE','US','USD','1h',true,true),
('RDDT','RDDT','Reddit','Technology','Social','consumer_internet','NYSE','US','USD','1h',true,true),
-- Fintech technology
('COIN','COIN','Coinbase Global','Technology','Fintech','fintech_tech','NASDAQ','US','USD','1h',true,true),
('HOOD','HOOD','Robinhood Markets','Technology','Fintech','fintech_tech','NASDAQ','US','USD','1h',true,true),
('XYZ','XYZ','Block','Technology','Fintech','fintech_tech','NYSE','US','USD','1h',true,true),
('AFRM','AFRM','Affirm Holdings','Technology','Fintech','fintech_tech','NASDAQ','US','USD','1h',true,true),
('SOFI','SOFI','SoFi Technologies','Technology','Fintech','fintech_tech','NASDAQ','US','USD','1h',true,true)
on conflict (symbol) do nothing;
