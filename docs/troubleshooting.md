# Troubleshooting - Canoe Scoreboard V3

---

## Scoreboard se nepřipojí k serveru

1. Zkontrolujte že C123 server běží: `curl http://host:port/api/discover`
2. Zkontrolujte CORS nastavení na serveru
3. Ověřte WebSocket port (typicky stejný jako HTTP)

---

## Závodník na trati bliká/mizí

**Příčina:** C123 server posílá OnCourse po jednom závodníkovi (partial messages)

**Řešení:**
- Detekce v `c123ServerMapper.ts`: `total > competitors.length`
- Context merguje partial do existujícího seznamu místo nahrazení

---

## Výsledky se nezobrazují

1. Zkontrolujte `activeRaceId` - Results jsou filtrovány podle aktuální kategorie
2. Ověřte že Results message obsahuje správný `raceId`
3. Při změně kategorie se Results mažou (očekávané chování)

---

## Highlight nefunguje po dojetí

**Princip:** Highlight je timestamp-based, ne diff-based

**Flow:**
1. dtFinish → pendingHighlightBib
2. Čeká na Results (max 10s)
3. Results přijdou → highlightBib aktivován

**Debug:**
- Zkontrolujte `onCourseFinishedAt` v dev tools
- Timeout 10s pokud Results nepřijdou

---

## DNS/DNF/DSQ zobrazení

- Zobrazuje se pouze explicitní status z dat (ne inference)
- Prázdný čas bez statusu = `---`
- Styl: šedá, italic, opacity 0.7

---

## WebSocket reconnect problémy

**Příznaky:** Scoreboard se odpojí a nereconnectuje

**Kontrola:**
1. Network tab v dev tools - WebSocket connection status
2. Console log pro reconnect pokusy
3. Ověřte že server podporuje WebSocket upgrade

**Řešení:**
- Provider má exponential backoff reconnect
- Po reconnectu se provede REST sync

---

## React StrictMode double-mount

**Příznaky:** Duplikované WebSocket připojení v development módu

**Příčina:** React 18 StrictMode volá useEffect dvakrát

**Řešení:** Deduplikace connect volání v providerech (implementováno)

---

## Partial OnCourse messages

**Příznaky:** Když jsou 2+ závodníci na trati, jeden "pohasíná"

**Příčina:** C123 server posílá OnCourse střídavě:
```
Zpráva 1: {total: 2, competitors: [závodník A]}
Zpráva 2: {total: 2, competitors: [závodník B]}
```

**Řešení:**
- Mapper detekuje `total > competitors.length` → partial message
- Context merguje partial do existujícího seznamu
- Grace period 5s pro závodníky s dtFinish
