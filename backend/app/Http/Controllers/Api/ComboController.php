<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Combo;
use App\Models\Withdrawal;
use App\Support\RestockLine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ComboController extends Controller
{
    private const RELATIONS = ['items.product:id,name,unit,current_quantity,selling_price_cents,image_path,image_alt,is_active,archived_at'];

    public function index(Request $request)
    {
        return Combo::query()
            ->with(self::RELATIONS)
            ->when(! ($request->boolean('include_inactive') && $request->user()?->isAdmin()), fn ($q) => $q->where('is_active', true))
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $combo = DB::transaction(function () use ($data) {
            $combo = Combo::create($this->attributes($data));
            $combo->items()->createMany($this->itemRows($data['items']));

            return $combo;
        });

        return response()->json($combo->load(self::RELATIONS), 201);
    }

    public function update(Request $request, Combo $combo)
    {
        $data = $this->validated($request, $combo);
        DB::transaction(function () use ($combo, $data) {
            $combo->update($this->attributes($data));
            $combo->items()->delete();
            $combo->items()->createMany($this->itemRows($data['items']));
        });

        return $combo->fresh()->load(self::RELATIONS);
    }

    /** Se la combo e gia stata venduta viene solo disattivata, per non perdere lo storico. */
    public function destroy(Combo $combo)
    {
        if (Withdrawal::withArchived()->where('combo_id', $combo->id)->exists()) {
            $combo->update(['is_active' => false]);

            return response()->json(['message' => 'Combo già venduta: è stata disattivata.', 'deactivated' => true]);
        }

        $combo->delete();

        return response()->noContent();
    }

    private function validated(Request $request, ?Combo $combo = null): array
    {
        if (is_string($request->input('price'))) {
            $request->merge(['price' => str_replace(',', '.', $request->input('price'))]);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('combos', 'name')->ignore($combo?->id)],
            'description' => ['nullable', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0.01'],
            'is_active' => ['sometimes', 'boolean'],
            'items' => ['required', 'array', 'min:1', 'max:10'],
            'items.*.product_id' => ['required', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'items.*.choice_group' => ['nullable', 'integer', 'between:1,5'],
        ], [
            'name.unique' => 'Esiste già una combo con questo nome.',
            'items.required' => 'Aggiungi almeno un prodotto alla combo.',
            'items.*.product_id.distinct' => 'Lo stesso prodotto è inserito due volte.',
            'items.*.choice_group.between' => 'La scelta deve essere un numero da 1 a 5.',
        ]);

        // Alternative a scelta: almeno due prodotti per gruppo, tutti con la stessa quantita.
        $groups = collect($data['items'])->filter(fn ($item) => ! empty($item['choice_group']))->groupBy('choice_group');
        foreach ($groups as $number => $alternatives) {
            if ($alternatives->count() < 2) {
                throw ValidationException::withMessages(['items' => "La scelta {$number} ha un solo prodotto: aggiungine almeno un altro o toglila."]);
            }
            if ($alternatives->pluck('quantity')->map(fn ($quantity) => (float) $quantity)->unique()->count() > 1) {
                throw ValidationException::withMessages(['items' => 'I prodotti fra cui si sceglie devono avere la stessa quantità.']);
            }
        }

        // Un posto a scelta conta come un solo prodotto.
        $fixed = collect($data['items'])->filter(fn ($item) => empty($item['choice_group']));
        $slots = $fixed->count() + $groups->count();
        $totalPieces = $fixed->sum(fn ($item) => (float) $item['quantity']) + $groups->sum(fn ($alternatives) => (float) $alternatives->first()['quantity']);
        if ($slots === 1 && $totalPieces < 2) {
            throw ValidationException::withMessages(['items' => 'Una combo deve avere almeno due pezzi (es. 2 prodotti diversi o 3 birre).']);
        }

        return $data;
    }

    private function itemRows(array $items): array
    {
        return array_map(fn (array $item) => [
            'product_id' => $item['product_id'],
            'quantity' => $item['quantity'],
            'choice_group' => $item['choice_group'] ?? null,
        ], $items);
    }

    private function attributes(array $data): array
    {
        return [
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'price_cents' => RestockLine::toCents($data['price']),
            'is_active' => $data['is_active'] ?? true,
        ];
    }
}
