<?php

namespace App\Support;

/**
 * Calcoli condivisi sulle righe di una spesa (validazione e servizio).
 */
class RestockLine
{
    public static function toCents(string|float|int $amount): int
    {
        return (int) round(((float) str_replace(',', '.', (string) $amount)) * 100);
    }

    public static function isExpense(array $item): bool
    {
        return ($item['item_type'] ?? 'product') === 'expense';
    }

    public static function quantity(array $item): float
    {
        if (isset($item['quantity']) && (float) $item['quantity'] > 0) {
            return (float) $item['quantity'];
        }

        return (float) ($item['package_count'] ?? 0) * (float) ($item['pieces_per_package'] ?? 0);
    }

    /**
     * Costo totale riga in centesimi: esatto da line_cost, altrimenti quantita x costo unitario.
     * Null se il costo non e stato inserito (0 e un costo valido: omaggio).
     */
    public static function lineCostCents(array $item): ?int
    {
        if (! blank($item['line_cost'] ?? null)) {
            return self::toCents($item['line_cost']);
        }

        $unit = self::unitCostInput($item);
        if ($unit === null) {
            return null;
        }

        return (int) round(self::quantity($item) * $unit);
    }

    public static function unitCostCents(array $item): ?int
    {
        if (! blank($item['line_cost'] ?? null)) {
            $quantity = self::quantity($item);

            return $quantity > 0 ? (int) round(self::toCents($item['line_cost']) / $quantity) : null;
        }

        return self::unitCostInput($item);
    }

    private static function unitCostInput(array $item): ?int
    {
        $value = $item['unit_cost'] ?? $item['cost_amount'] ?? null;

        return blank($value) ? null : self::toCents($value);
    }
}
