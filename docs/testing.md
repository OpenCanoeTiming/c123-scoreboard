# Testování - Canoe Scoreboard V3

---

## Příkazy

```bash
# Unit testy (600+ testů)
npm test

# Integrační test CLI vs C123
npm run test:providers

# Vizuální testy Playwright
npm run test:visual

# Lint kontrola
npm run lint

# Build
npm run build
```

---

## Mock servery pro vývoj

```bash
# Mock TCP server (Canoe123 protokol)
npm run mock:tcp -- -f ../analysis/recordings/rec-2025-12-28T09-34-10.jsonl

# Mock WS server (CLI protokol)
npm run mock:ws -- -f ../analysis/recordings/rec-2025-12-28T09-34-10.jsonl
```

---

## Nahrávky

| Nahrávka | Popis |
|----------|-------|
| `../analysis/recordings/rec-2025-12-28T09-34-10.jsonl` | Úvodní nahrávka s TCP (Canoe123) i WS (CLI) daty |

---

## Testovací pokrytí

### Unit testy
- `c123ServerMapper.ts` - 21+ testů
- `C123ServerProvider.ts` - 31+ testů
- `ScoreboardContext.tsx` - partial messages, category flow, grace period
- `Title` komponenta - formátování, fallback

### E2E testy (Playwright)
- Vizuální srovnání CLI vs C123
- Screenshot comparison

---

## Testování proti V2

Pro ověření kompatibility je doporučeno testovat V3 proti V2 na stejné sadě vstupních dat:

1. Pustit C123 server proti nahrávce
2. Spustit V2 a V3 scoreboard současně
3. Porovnat zobrazení - musí být ZCELA STEJNÉ (kromě BR1/BR2 merge)
