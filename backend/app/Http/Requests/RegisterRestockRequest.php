<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Models\ShoppingListItem;
use App\Support\NameNormalizer;
use App\Support\RestockLine;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RegisterRestockRequest extends FormRequest
{
    public const DIFFERENCE_REASONS = ['arrotondamento', 'sacchetto', 'sconto', 'altro_costo', 'errore'];

    public const EXPENSE_CATEGORIES = ['pulizia', 'stoviglie_posate', 'sacchetti', 'altro'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'idempotency_key' => ['nullable', 'string', 'max:100'],
            'total_amount' => ['required', 'numeric', 'min:0.01'],
            'purchased_at' => ['required', 'date'],
            'purchased_time' => ['required', 'date_format:H:i'],
            'receipt_image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'note' => ['nullable', 'string', 'max:1000'],
            'difference_reason' => ['nullable', 'in:'.implode(',', self::DIFFERENCE_REASONS)],
            'items' => ['required', 'array', 'min:1'],
            'items.*.item_type' => ['nullable', 'in:product,expense'],
            'items.*.expense_category' => ['required_if:items.*.item_type,expense', 'nullable', 'in:'.implode(',', self::EXPENSE_CATEGORIES)],
            'items.*.description' => ['nullable', 'string', 'max:255'],
            'items.*.shopping_list_item_id' => ['exclude_if:items.*.item_type,expense', 'nullable', 'exists:shopping_list_items,id'],
            'items.*.product_id' => ['exclude_if:items.*.item_type,expense', 'nullable', 'exists:products,id'],
            'items.*.name' => ['exclude_if:items.*.item_type,expense', 'required_without:items.*.product_id', 'nullable', 'string', 'max:255'],
            'items.*.category' => ['nullable', 'string', 'max:255'],
            'items.*.unit' => ['exclude_if:items.*.item_type,expense', 'required_without:items.*.product_id', 'nullable', 'string', 'max:40'],
            'items.*.package_count' => ['exclude_if:items.*.item_type,expense', 'nullable', 'numeric', 'min:0'],
            'items.*.pieces_per_package' => ['exclude_if:items.*.item_type,expense', 'nullable', 'numeric', 'min:0'],
            'items.*.quantity' => ['exclude_if:items.*.item_type,expense', 'nullable', 'numeric', 'min:0'],
            'items.*.minimum_threshold' => ['nullable', 'numeric', 'min:0'],
            'items.*.selling_price' => ['exclude_if:items.*.item_type,expense', 'required_without:items.*.product_id', 'nullable', 'numeric', 'min:0'],
            'items.*.unit_cost' => ['exclude_if:items.*.item_type,expense', 'nullable', 'numeric', 'min:0'],
            'items.*.line_cost' => ['required_if:items.*.item_type,expense', 'nullable', 'numeric', 'min:0'],
            'items.*.cost_amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.location' => ['nullable', 'string', 'max:255'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
            'items.*.image' => ['exclude_if:items.*.item_type,expense', 'nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ];
    }

    public function messages(): array
    {
        return [
            'required' => 'Il campo :attribute è obbligatorio.',
            'required_without' => 'Il campo :attribute è obbligatorio per i prodotti nuovi.',
            'numeric' => 'Il campo :attribute deve essere un numero.',
            'min.numeric' => 'Il campo :attribute deve essere almeno :min.',
            'date' => 'La data non è valida.',
            'date_format' => "L'ora deve essere nel formato HH:MM.",
            'image' => 'Il file :attribute deve essere un\'immagine.',
            'mimes' => 'Il file :attribute deve essere JPG, PNG o WebP.',
            'receipt_image.max' => 'La foto dello scontrino supera 4 MB.',
            'items.*.image.max' => "L'immagine del prodotto supera 2 MB.",
            'exists' => 'Il valore di :attribute non esiste più. Ricarica la pagina.',
            'in' => 'Il valore di :attribute non è valido.',
            'items.*.line_cost.required_if' => 'Indica l\'importo della voce non magazzino.',
            'items.*.expense_category.required_if' => 'Scegli la categoria della voce non magazzino.',
            'items.min' => 'Aggiungi almeno una riga allo scontrino.',
            'items.required' => 'Aggiungi almeno una riga allo scontrino.',
        ];
    }

    public function attributes(): array
    {
        return [
            'total_amount' => 'totale scontrino',
            'purchased_at' => 'data',
            'purchased_time' => 'ora',
            'receipt_image' => 'foto scontrino',
            'difference_reason' => 'motivo della differenza',
            'items.*.name' => 'nome prodotto',
            'items.*.unit' => 'unità',
            'items.*.quantity' => 'quantità',
            'items.*.selling_price' => 'prezzo di vendita',
            'items.*.unit_cost' => 'costo a pezzo',
            'items.*.line_cost' => 'costo totale riga',
            'items.*.image' => 'immagine prodotto',
            'items.*.product_id' => 'prodotto',
            'items.*.shopping_list_item_id' => 'voce della lista',
            'items.*.expense_category' => 'categoria spesa',
            'items.*.description' => 'descrizione',
        ];
    }

    public function after(): array
    {
        return [fn (Validator $validator) => $this->validateLines($validator)];
    }

    private function validateLines(Validator $validator): void
    {
        if ($validator->errors()->isNotEmpty()) {
            return;
        }

        $items = $this->input('items', []);
        $productIds = collect($items)->pluck('product_id')->filter()->map(fn ($id) => (int) $id);
        $products = Product::query()->whereIn('id', $productIds)->pluck('name', 'id');
        $listItems = ShoppingListItem::query()
            ->whereIn('id', collect($items)->pluck('shopping_list_item_id')->filter())
            ->get(['id', 'status'])
            ->keyBy('id');
        $seenProducts = [];
        $seenNewNames = [];
        $linesTotal = 0;

        foreach ($items as $index => $item) {
            if (($item['item_type'] ?? 'product') === 'expense') {
                $linesTotal += RestockLine::lineCostCents($item) ?? 0;

                continue;
            }

            $productId = ! empty($item['product_id']) ? (int) $item['product_id'] : null;
            $label = $productId ? ($products[$productId] ?? 'prodotto') : ($item['name'] ?? 'nuovo prodotto');

            if (RestockLine::quantity($item) <= 0) {
                $validator->errors()->add("items.$index.quantity", "Indica la quantità acquistata di «{$label}» (quantità oppure confezioni × pezzi).");
            }

            if ($productId) {
                if (isset($seenProducts[$productId])) {
                    $validator->errors()->add("items.$index.product_id", "«{$label}» è inserito due volte nello stesso scontrino: unisci le righe.");
                }
                $seenProducts[$productId] = true;
            } else {
                $normalized = NameNormalizer::normalize((string) ($item['name'] ?? ''));
                if (isset($seenNewNames[$normalized])) {
                    $validator->errors()->add("items.$index.name", "Il prodotto nuovo «{$label}» è inserito due volte.");
                } elseif (Product::query()->where('normalized_name', $normalized)->exists()) {
                    $validator->errors()->add("items.$index.name", "Esiste già un prodotto «{$label}»: cercalo tra i prodotti esistenti.");
                }
                $seenNewNames[$normalized] = true;
            }

            $listItemId = $item['shopping_list_item_id'] ?? null;
            if ($listItemId && in_array($listItems[$listItemId]->status ?? null, ['acquistato', 'annullato'], true)) {
                $validator->errors()->add("items.$index.shopping_list_item_id", "La voce della lista per «{$label}» è già stata acquistata o annullata. Ricarica la pagina.");
            }

            $linesTotal += RestockLine::lineCostCents($item) ?? 0;
        }

        $difference = RestockLine::toCents($this->input('total_amount')) - $linesTotal;
        if ($difference !== 0 && blank($this->input('difference_reason'))) {
            $amount = number_format(abs($difference) / 100, 2, ',', '.');
            $validator->errors()->add('difference_reason', "Il totale dello scontrino e la somma delle righe differiscono di {$amount} €: indica il motivo della differenza.");
        }
    }
}
