<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function index()
    {
        return Location::orderBy('name')->get();
    }

    public function store(Request $request)
    {
        return response()->json(Location::create($request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:locations,name'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ])), 201);
    }

    public function update(Request $request, Location $location)
    {
        $location->update($request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:locations,name,'.$location->id],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]));

        return $location;
    }
}
