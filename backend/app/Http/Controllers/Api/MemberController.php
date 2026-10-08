<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class MemberController extends Controller
{
    /** Soci per login e prelievi; con include_guests=1 anche gli ospiti presenti (per Mangia con un amico). */
    public function index(Request $request)
    {
        return User::query()
            ->consumers($request->boolean('include_guests'))
            ->orderByRaw("CASE WHEN role = 'guest' THEN 1 ELSE 0 END")
            ->orderBy('name')
            ->get(['id', 'name', 'last_name', 'role', 'avatar_path', 'avatar_key']);
    }
}
