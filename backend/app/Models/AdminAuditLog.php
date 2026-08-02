<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['admin_id', 'target_user_id', 'action', 'changes'])]
class AdminAuditLog extends Model
{
    protected function casts(): array
    {
        return ['changes' => 'array'];
    }
}
