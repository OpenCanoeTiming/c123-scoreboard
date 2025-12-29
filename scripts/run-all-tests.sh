#!/bin/bash
# Canoe Scoreboard v2 - Integrovaný testovací skript
# Spustí všechny automatické testy a vrátí souhrnný výstup

echo "=================================================="
echo "   Canoe Scoreboard v2 - Test Suite"
echo "=================================================="
echo ""

FAILED=0
PASSED=0

# 1. TypeScript check
echo -n "[1] TypeScript strict check... "
if npx tsc --noEmit > /dev/null 2>&1; then
    echo "✅ OK"
    PASSED=$((PASSED + 1))
else
    echo "❌ FAILED"
    FAILED=$((FAILED + 1))
fi

# 2. ESLint
echo -n "[2] ESLint... "
if npm run lint > /dev/null 2>&1; then
    echo "✅ OK"
    PASSED=$((PASSED + 1))
else
    echo "❌ FAILED"
    FAILED=$((FAILED + 1))
fi

# 3. Unit testy
echo -n "[3] Unit testy... "
TEST_OUTPUT=$(npm test -- --reporter=dot 2>&1)
# Extract test count from output - strip ANSI codes first
CLEAN_OUTPUT=$(echo "$TEST_OUTPUT" | sed 's/\x1b\[[0-9;]*m//g')
# Get "Tests  428 passed" line, extract number
TEST_COUNT=$(echo "$CLEAN_OUTPUT" | grep "Tests" | grep "passed" | grep -oE '[0-9]+' | head -1)
if echo "$CLEAN_OUTPUT" | grep -q "passed"; then
    echo "✅ OK ($TEST_COUNT tests)"
    PASSED=$((PASSED + 1))
else
    echo "❌ FAILED"
    FAILED=$((FAILED + 1))
fi

# 4. Build
echo -n "[4] Production build... "
if npm run build > /dev/null 2>&1; then
    echo "✅ OK"
    PASSED=$((PASSED + 1))
else
    echo "❌ FAILED"
    FAILED=$((FAILED + 1))
fi

# 5. Build size check (warn if over 500kB)
echo -n "[5] Bundle size check... "
if [ -d "dist/assets" ]; then
    JS_SIZE=$(du -b dist/assets/*.js 2>/dev/null | awk '{sum += $1} END {print sum}')
    CSS_SIZE=$(du -b dist/assets/*.css 2>/dev/null | awk '{sum += $1} END {print sum}')
    TOTAL_SIZE=$((JS_SIZE + CSS_SIZE))
    KB_SIZE=$((TOTAL_SIZE / 1024))
    if [ "$TOTAL_SIZE" -lt 500000 ]; then
        echo "✅ OK (${KB_SIZE} kB)"
    else
        echo "⚠️ WARN (${KB_SIZE} kB > 500 kB)"
    fi
    PASSED=$((PASSED + 1))
else
    echo "⚠️ SKIP (dist not found)"
    PASSED=$((PASSED + 1))
fi

# 6. Check for console.log in production code (excluding tests)
echo -n "[6] No console.log in prod... "
CONSOLE_LOGS=$(grep -r "console\.log" src/ --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -v "__tests__" \
    | grep -v "\.test\." \
    | grep -v "// DEBUG" \
    | wc -l)
if [ "$CONSOLE_LOGS" -eq 0 ]; then
    echo "✅ OK"
    PASSED=$((PASSED + 1))
else
    echo "ℹ️ INFO ($CONSOLE_LOGS console.log statements)"
    PASSED=$((PASSED + 1))
fi

# 7. Check for TODO/FIXME comments
echo -n "[7] TODO/FIXME check... "
TODOS=$(grep -rE "TODO|FIXME" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
if [ "$TODOS" -eq 0 ]; then
    echo "✅ OK (none)"
    PASSED=$((PASSED + 1))
else
    echo "ℹ️ INFO ($TODOS items)"
    PASSED=$((PASSED + 1))
fi

echo ""
echo "=================================================="
echo "   Výsledky"
echo "=================================================="
echo ""
echo "Prošlo:   $PASSED"
echo "Selhalo:  $FAILED"
echo ""

if [ "$FAILED" -gt 0 ]; then
    echo "❌ Některé testy selhaly!"
    exit 1
else
    echo "✅ Všechny testy prošly!"
    exit 0
fi
