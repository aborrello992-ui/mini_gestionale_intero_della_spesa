<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;

class MemberController extends Controller
{
    public function index()
    {
        return User::query()
            ->where('role', User::ROLE_MEMBER)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'avatar_path']);
    }
}
