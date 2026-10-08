<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountReset;
use App\Models\Product;
use App\Models\User;
use App\Models\Withdrawal;
use App\Support\ConsumerAuth;
use App\Services\WithdrawalService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class WithdrawalController extends Controller
{
    public function store(Request $request, WithdrawalService $withdrawalService)
    {
        $data = $request->validate([
            'product_id' => ['required', 'exists:products,id'],
            'member_id' => ['required', 'exists:users,id'],
            'pin' => ['nullable', 'regex:/^\d{3}$/'],
            'quantity' => ['required', 'numeric', 'min:0.001'],
            'payment_status' => ['required', 'in:paid,coppone'],
            'notes' => ['nullable', 'string'],
            'sponsor_id' => ['nullable', 'exists:users,id'],
            'sponsor_pin' => ['nullable', 'regex:/^\d{3}$/'],
        ], ['pin.regex' => 'Il PIN deve avere 3 cifre.', 'sponsor_pin.regex' => 'Il PIN del garante deve avere 3 cifre.']);

        $member = ConsumerAuth::resolve($request->user(), $data['member_id'], $data['pin'] ?? null, $request->ip() ?: 'local');

        // Ospite: un socio presente fa da garante confermando con il suo PIN.
        $options = [];
        if ($member->isGuest()) {
            if (empty($data['sponsor_id'])) {
                throw ValidationException::withMessages(['sponsor_id' => 'Scegli il socio garante: deve confermare con il suo PIN.']);
            }
            $sponsor = ConsumerAuth::resolve($request->user(), $data['sponsor_id'], $data['sponsor_pin'] ?? null, $request->ip() ?: 'local', 'sponsor_id', 'sponsor_pin');
            if ($sponsor->isGuest()) {
                throw ValidationException::withMessages(['sponsor_id' => 'Il garante deve essere un socio, non un ospite.']);
            }
            $options['sponsor'] = $sponsor;
        }

        try {
            $withdrawal = $withdrawalService->take(
                Product::findOrFail($data['product_id']),
                $member,
                $request->user(),
                (float) $data['quantity'],
                $data['payment_status'],
                $data['notes'] ?? null,
                $options,
            );

            return response()->json($withdrawal, 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function index(Request $request)
    {
        return Withdrawal::query()
            ->with('member:id,name', 'originalMember:id,name', 'product:id,name,unit', 'actor:id,name', 'debts:id,withdrawal_id,user_id,original_amount_cents,paid_amount_cents,remaining_amount_cents,status')
            ->when($request->member_id, fn ($q, $id) => $q->where('user_id', $id))
            ->when($request->product_id, fn ($q, $id) => $q->where('product_id', $id))
            ->when($request->date_from, fn ($q, $date) => $q->whereDate('withdrawn_at', '>=', $date))
            ->when($request->date_to, fn ($q, $date) => $q->whereDate('withdrawn_at', '<=', $date))
            ->latest('withdrawn_at')
            ->latest('id')
            ->paginate(min(max($request->integer('per_page', 30), 1), 100));
    }

    public function reassign(Withdrawal $withdrawal, Request $request, WithdrawalService $withdrawalService)
    {
        $data = $request->validate([
            'member_id' => ['required', 'exists:users,id'],
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ], [
            'reason.required' => 'Indica il motivo della riassegnazione.',
            'reason.min' => 'Il motivo deve avere almeno 3 caratteri.',
        ]);

        $member = $this->consumer($data['member_id']);

        try {
            return $withdrawalService->reassign($withdrawal, $member, $request->user(), $data['reason']);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function manual(Request $request, WithdrawalService $withdrawalService)
    {
        $data = $request->validate([
            'member_id' => ['required', 'exists:users,id'],
            'product_id' => ['required', 'exists:products,id'],
            'quantity' => ['required', 'numeric', 'min:0.001'],
            'payment_status' => ['required', 'in:paid,coppone'],
            'withdrawn_date' => ['required', 'date'],
            'withdrawn_time' => ['required', 'date_format:H:i'],
            'affects_stock' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $withdrawnAt = Carbon::parse($data['withdrawn_date'].' '.$data['withdrawn_time'], AccountReset::LOCAL_TIMEZONE)->setTimezone(config('app.timezone'));
        if ($withdrawnAt->gt(now()->addMinutes(5))) {
            return response()->json(['message' => 'La data del prelievo non può essere nel futuro.'], 422);
        }

        $cutoff = AccountReset::currentCutoff();
        if ($cutoff && $withdrawnAt->lt($cutoff)) {
            return response()->json(['message' => 'Non puoi inserire prelievi prima dell\'azzeramento dei conti del '.$cutoff->copy()->setTimezone(AccountReset::LOCAL_TIMEZONE)->format('d/m/Y').'.'], 422);
        }

        try {
            $withdrawal = $withdrawalService->take(
                Product::findOrFail($data['product_id']),
                $this->consumer($data['member_id']),
                $request->user(),
                (float) $data['quantity'],
                $data['payment_status'],
                trim('Inserito a mano. '.($data['notes'] ?? '')),
                ['withdrawn_at' => $withdrawnAt, 'affects_stock' => $request->boolean('affects_stock', true), 'is_manual' => true],
            );

            return response()->json($withdrawal, 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    /** Acquisti degli ospiti in attesa di verifica (admin). */
    public function pendingGuestPayments()
    {
        return Withdrawal::query()
            ->with('member:id,name', 'sponsor:id,name', 'product:id,name,unit', 'combo:id,name')
            ->where('payment_status', Withdrawal::PAYMENT_PENDING)
            ->latest('withdrawn_at')
            ->get();
    }

    public function verifyGuestPayment(Withdrawal $withdrawal, Request $request, WithdrawalService $withdrawalService)
    {
        $data = $request->validate(['outcome' => ['required', 'in:paid,unpaid']]);

        try {
            return $withdrawalService->verifyGuestPayment($withdrawal, $data['outcome'], $request->user());
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    private function consumer(int|string $id): User
    {
        return User::query()
            ->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MEMBER])
            ->where('is_active', true)
            ->whereKey($id)
            ->firstOr(fn () => throw ValidationException::withMessages(['member_id' => 'Socio non valido o disattivato.']));
    }
}
