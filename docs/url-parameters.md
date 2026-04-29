# URL parametry - kompletní reference

Scoreboard V3 podporuje konfiguraci přes URL parametry. Parametry se přidávají za `?` v URL.

**Příklad:**
```
http://192.168.1.100:5173/?server=192.168.1.50:27123&type=ledwall&displayRows=5
```

---

## Přehled parametrů

| Parametr | Typ | Default | Popis |
|----------|-----|---------|-------|
| `server` | string | auto-discovery | Adresa serveru (host:port) |
| `source` | string | - | Zdroj dat (`replay` pro testování) |
| `category` | string | - | Fixace na kategorii (`K1M`, `C1W`, ...) |
| `type` | string | auto-detect | Layout mód (`vertical`, `ledwall`) |
| `displayRows` | number | auto | Fixní počet řádků (3-20) |
| `scrollToFinished` | boolean | `true` | Scroll na dojetého závodníka |
| `browseAfterHighlight` | boolean | `false` | Procházení výsledků po highlightu (ledwall) |
| `disableScroll` | boolean | `false` | Vypne auto-scroll (pro screenshoty) |
| `clientId` | string | - | Identifikátor klienta pro server |
| `speed` | number | `10` | Rychlost přehrávání (pouze replay) |
| `loop` | boolean | `true` | Opakovat přehrávání (pouze replay) |
| `pauseAfter` | number | - | Pozastavit po N zprávách (pouze replay) |
| `customTitle` | string | - | Vlastní název události (přepíše název z API) |
| `logoUrl` | string | `/assets/logo.svg` | URL hlavního loga |
| `partnerLogoUrl` | string | `/assets/partners.png` | URL partnerského loga |
| `footerImageUrl` | string | `/assets/footer.png` | URL patičky (banneru) |

---

## Detailní popis

### server

Explicitní adresa serveru. Pokud není zadáno, provede se auto-discovery na lokální síti.

```
?server=192.168.1.50:27123    # C123 Server
?server=192.168.1.50:8081     # CLI nástroj (fallback)
```

**Chování:**
1. Pokud server odpovídá na `/api/discover` jako C123 Server → použije C123ServerProvider
2. Pokud server odpovídá, ale není C123 → fallback na CLIProvider
3. Pokud server neodpovídá → chyba

---

### source

Zdroj dat. Jediná podporovaná hodnota je `replay` pro vývojové/testovací účely.

```
?source=replay                # Přehrává nahrávku z /recordings/
```

**Poznámka:** Replay má přednost před `server` parametrem.

---

### category

Fixace scoreboardu na konkrétní kategorii (třídu). Scoreboard zobrazuje pouze data pro zadanou kategorii a ignoruje ostatní.

```
?category=K1M     # Pouze K1 muži
?category=C1W     # Pouze C1 ženy
?category=C2M     # Pouze C2 muži
```

**Chování:**
- Scoreboard přijímá pouze výsledky a on-course data pro zadanou kategorii
- Výsledky jiných kategorií jsou tiše ignorovány (žádné mazání)
- Den a jízda (BR1/BR2) se řídí automaticky z dat
- Bez parametru se scoreboard chová standardně (sleduje aktuální kategorii)
- Hodnota je case-insensitive (`k1m` = `K1M`)

**Použití:** Více displejů vedle sebe, každý na jinou kategorii:
```
http://display1:5173/?category=K1M&type=ledwall
http://display2:5173/?category=C1W&type=ledwall
http://display3:5173/?category=C1M&type=ledwall
http://display4:5173/?category=K1W&type=ledwall
```

---

### type

Vynucený layout mód. Pokud není zadáno, detekuje se z poměru stran obrazovky.

```
?type=vertical    # Portrait TV (výška > šířka * 1.5)
?type=ledwall     # Široké zobrazení (šířka >= výška * 1.5)
```

**Auto-detekce:**
- Aspect ratio >= 1.5 → `ledwall`
- Ostatní → `vertical`

---

### displayRows

Fixní počet zobrazených řádků výsledků. Používá se pro scaling na LED stěně.

```
?displayRows=5    # 5 řádků, viewport se škáluje
?displayRows=8    # 8 řádků
```

**Omezení:** Hodnota se clampuje na rozsah 3-20.

**Chování:** Když je nastaveno, vypočítá se scale factor pro vyplnění celé výšky viewportu.

---

### scrollToFinished

Zda scrollovat na pozici dojetého závodníka ve výsledkové listině.

```
?scrollToFinished=false    # Pouze highlight, bez scrollu
```

**Default:** `true` (scrolluje na dojetého)

**Použití:** Při `false` se závodník pouze zvýrazní, ale zobrazení zůstane na aktuální pozici.

---

### browseAfterHighlight

Po zobrazení dojetého závodníka (highlight) na ledwallu pomalu scrolluje dolů výsledky, aby diváci viděli kontext kolem závodníkovy pozice.

```
?browseAfterHighlight=true    # Zapne browse scroll po highlightu
```

**Default:** `false` (po highlightu se vrací na začátek výsledků)

**Chování:**
- Funguje pouze na `ledwall` layoutu — na vertikálním se ignoruje
- Po skončení highlightu (5s) začne pomalý plynulý scroll dolů (20px/s)
- Po dojetí na konec výsledků se vrátí na začátek
- Pokud se horní část výsledků nezobrazila déle než 3 minuty, browse se přeskočí a zobrazí se top výsledků (aby diváci viděli čelo závodu)
- Nový finish okamžitě přeruší browse a zobrazí nového závodníka

---

### disableScroll

Vypne veškerý auto-scroll. Užitečné pro pořizování screenshotů.

```
?disableScroll=true
```

**Poznámka:** Highlight zůstává funkční.

---

### clientId

Identifikátor klienta pro C123 Server. Umožňuje adresovat konkrétní scoreboard při centrální správě.

```
?clientId=ledwall-01
?clientId=tv-foyer
```

**Fallback chain:**
1. URL parametr (nejvyšší priorita)
2. localStorage (server-assigned přes ConfigPush)
3. null (identifikace podle IP adresy)

---

### speed, loop, pauseAfter (pouze replay)

Parametry pro ReplayProvider během vývoje/testování.

```
?source=replay&speed=5       # 5x rychlost
?source=replay&loop=false    # Nepřehrávat znovu
?source=replay&pauseAfter=100  # Pozastavit po 100 zprávách
```

---

### customTitle

Vlastní název události. Přepíše název získaný z API (discover endpoint).

```
?customTitle=Mistrovství%20ČR%202025
```

**Poznámka:** Může být také nastaven přes ConfigPush z C123 Serveru.

---

### logoUrl, partnerLogoUrl, footerImageUrl

Custom assety. Pouze relativní nebo absolutní URL (data URI nejsou povoleny v URL).

```
?logoUrl=/custom/logo.png
?partnerLogoUrl=https://example.com/sponsor.png
?footerImageUrl=/banners/footer-2024.jpg
```

**Fallback chain:**
1. localStorage (přes ConfigPush - nejvyšší priorita)
2. URL parametry
3. Default assety (`/assets/...`)

**Poznámka:** Data URI lze nastavit pouze přes ConfigPush.

---

## Příklady kompletních URL

### Základní použití (auto-discovery)
```
http://scoreboard.local:5173/
```

### LED stěna s 5 řádky
```
http://scoreboard.local:5173/?type=ledwall&displayRows=5
```

### Explicitní server s clientId
```
http://scoreboard.local:5173/?server=192.168.1.50:27123&clientId=ledwall-main
```

### Vertikální TV bez scrollu při dojetí
```
http://scoreboard.local:5173/?type=vertical&scrollToFinished=false
```

### Testování s replay daty
```
http://localhost:5173/?source=replay&speed=10&loop=true
```

### Více displejů — každý na jinou kategorii
```
http://scoreboard.local:5173/?category=K1M&type=ledwall&displayRows=5
http://scoreboard.local:5173/?category=C1W&type=ledwall&displayRows=5
http://scoreboard.local:5173/?category=C1M&type=ledwall&displayRows=5
```

### Custom assety
```
http://scoreboard.local:5173/?logoUrl=/event/logo.png&footerImageUrl=/event/sponsors.jpg
```

---

## ConfigPush override

C123 Server může přes WebSocket poslat ConfigPush zprávu, která přepíše některé parametry:

| ConfigPush pole | Přepisuje URL param |
|-----------------|---------------------|
| `type` | `type` |
| `displayRows` | `displayRows` |
| `scrollToFinished` | `scrollToFinished` |
| `browseAfterHighlight` | `browseAfterHighlight` |
| `clientId` | `clientId` (ukládá do localStorage) |
| `logoUrl` | `logoUrl` (ukládá do localStorage) |
| `partnerLogoUrl` | `partnerLogoUrl` (ukládá do localStorage) |
| `footerImageUrl` | `footerImageUrl` (ukládá do localStorage) |
| `customTitle` | `customTitle` (přidává do URL) |
| `forceRefresh` | - (vyvolá page reload) |

**Poznámka:** ConfigPush assety se ukládají do localStorage a mají nejvyšší prioritu.

---

## Viz také

- [docs/architecture.md](architecture.md) - celková architektura
- [docs/troubleshooting.md](troubleshooting.md) - řešení problémů
