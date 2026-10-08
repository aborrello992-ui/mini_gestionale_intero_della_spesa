<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'last_name', 'aliases', 'email', 'password', 'role', 'is_active', 'can_consume', 'pin_hash', 'avatar_path', 'guest_expires_at'])]
#[Hidden(['password', 'pin_hash', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_ADMIN = 'admin';
    public const ROLE_MEMBER = 'member';
    public const ROLE_DEVICE = 'device';
    public const ROLE_GUEST = 'guest';

    /** Ruoli che prelevano prodotti a proprio nome. */
    public const CONSUMER_ROLES = [self::ROLE_ADMIN, self::ROLE_MEMBER, self::ROLE_GUEST];

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isGuest(): bool
    {
        return $this->role === self::ROLE_GUEST;
    }

    /** Accesso personale (socio, admin o ospite con PIN): preleva a proprio nome senza ridigitare il PIN. */
    public function isPersonalConsumer(): bool
    {
        // null = non ancora riletto dal database: vale il default della colonna (true).
        return in_array($this->role, self::CONSUMER_ROLES, true) && ($this->is_active ?? true) && ($this->can_consume ?? true)
            && (! $this->isGuest() || ($this->guest_expires_at && $this->guest_expires_at->isFuture()));
    }

    /** Soci, admin e ospiti ancora validi che possono prelevare. */
    public function scopeConsumers($query, bool $includeGuests = true)
    {
        return $query->where('is_active', true)->where('can_consume', true)->where(function ($q) use ($includeGuests) {
            $q->whereIn('role', [self::ROLE_ADMIN, self::ROLE_MEMBER]);
            if ($includeGuests) {
                $q->orWhere(fn ($guest) => $guest->where('role', self::ROLE_GUEST)->where('guest_expires_at', '>', now()));
            }
        });
    }

    public function withdrawals(): HasMany
    {
        return $this->hasMany(Withdrawal::class, 'user_id');
    }

    public function memberDebts(): HasMany
    {
        return $this->hasMany(MemberDebt::class, 'user_id');
    }

    public function personalCashMovements(): HasMany
    {
        return $this->hasMany(CashMovement::class, 'member_id');
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'is_active' => 'boolean',
            'can_consume' => 'boolean',
            'aliases' => 'array',
            'password' => 'hashed',
            'pin_hash' => 'hashed',
            'guest_expires_at' => 'datetime',
        ];
    }
}
