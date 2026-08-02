<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;

class MemberController extends Controller
{
    public function index()
    {
        return User::query()
            ->whereIn('role', [User::ROLE_ADMIN, User::ROLE_MEMBER])
            ->where('is_active', true)
            ->where('can_consume', true)
            ->orderBy('name')
            ->get(['id', 'name', 'last_name', 'role', 'avatar_path']);
    }
}
